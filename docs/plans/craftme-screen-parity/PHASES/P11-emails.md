# P11 Three launch emails through an outbox and Resend

**Goal.** Send exactly three emails (D04): the Buyer's payment receipt, the Artist's new order, the Artist's payout sent. Each is written to an outbox after the authoritative event, sent once per recipient and event, retried on failure, and can never undo a payment or a payout. Every other screen's wording about email is brought in line.

**Coverage.** All of S35, S11.i.03, S24.i.06, S32.i.05, and the cron schedules that P02 and P04 left for this package.

**Depends on.** P01, P07, P10. **External:** XD05 (Resend key and sender domain), XD09 (support address, site URL).

## Paths

Existing, to modify:

- `supabase/functions/api/index.ts` (the cron route), `supabase/functions/api/providers.ts` (fake email branch)
- `src/pages/ArtistInbox.jsx`
- Created by earlier packages: `src/components/orders/OrderPlaced.jsx` (P01), `src/pages/ArtistSettings.jsx` (P07), `src/components/admin/RecordRunDialog.jsx` (P10), `src/pages/admin/AdminSettings.jsx` (P10)
- `supabase/schema.test.mjs`, `supabase/README.md`

PROPOSED, to create:

- `supabase/migrations/0029_email_outbox.sql`
- `supabase/migrations/0030_cron_parity.sql` (needs `pg_cron` and `pg_net`; not in the PGlite list, like `0005`, `0010`, `0012`)
- `supabase/functions/api/emails_pure.js`, `supabase/functions/api/emails_pure.test.js` (templates; already matched by the vitest include `supabase/functions/**/*.test.js`)
- `supabase/functions/api/emails.ts` (the sender)
- `e2e/emails.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `orders_notify` trigger, `_notify_order_stage` | `0003_logic.sql` (re-created in `0022`) | The outbox uses its own triggers, so notifications are untouched |
| `payout_calc`, `commission_of` | `0003_logic.sql` | Figures in the Artist emails |
| `instagram_pure.js` and its test | `supabase/functions/api/` | The pattern for a pure, unit-tested module beside the Edge code |
| Cron pattern with a Vault secret and `net.http_post` | `0010_instagram_cron.sql` | Reused for the three jobs |
| `providerMode` | `providers.ts` (P00) | Fake email provider |
| `set_switch`, `integrationStatus` | P10 | New switch `emails`; status gains outbox counts |
| `formatINR` logic | `src/lib/format.js` | Re-implemented in `emails_pure.js` (the Edge Function cannot import from `src/`); a unit test pins the same outputs |

## Migration `0029_email_outbox.sql`

1. `create table public.email_outbox (id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('buyer_paid','artist_new_order','artist_payout_sent')), user_id uuid not null, dedupe_key text not null unique, payload jsonb not null, status text not null default 'pending' check (status in ('pending','sent','failed','skipped')), attempts integer not null default 0, next_attempt_at timestamptz not null default now(), last_error text, provider_id text, created_at timestamptz not null default now(), sent_at timestamptz);` RLS on. No client access at all. `grant all` to `service_role`.
2. Producers. Both are `after update` triggers whose body is wrapped in `begin … exception when others then null; end`, so a fault in the email path can never fail the payment or payout transaction:
   - `orders`, when the stage becomes `paid`: two rows, `buyer_paid` (key `buyer_paid:<order id>`) and `artist_new_order` (key `artist_new_order:<order id>`), `on conflict (dedupe_key) do nothing`. The payload holds ids only; amounts and names are read at send time.
   - `payouts`, when the status becomes `sent` and the net is above zero: `artist_payout_sent` (key `artist_payout_sent:<payout id>`). If the Artist turned "Payment sent" off (`email_prefs.payout_sent` false) the row is inserted as `skipped`.
3. `claim_emails(p_limit integer) returns setof public.email_outbox` (service role): picks due `pending` rows with `for update skip locked`, adds one to `attempts`, and pushes `next_attempt_at` forward by the backoff (1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours) before returning them. A row at 6 attempts becomes `failed`. Rows still `pending` 24 hours after creation become `skipped` with `last_error = 'stale'`, so a receipt is never sent days late.
4. `mark_email_sent(p_id uuid, p_provider text)` and `mark_email_error(p_id uuid, p_error text)` (service role).
5. `email_context(p_id uuid) returns jsonb` (service role): everything a template needs. Buyer receipt: recipient email, first name, order code, lines, total, shipping address, Artist name, `ship_by`. Artist new order: email, Buyer short name and city, lines, `ship_by`, estimated net. No address. Payout: email, net, date, masked destination, reference, order count, gross, deductions.
6. Admin functions: `admin_email_outbox() returns jsonb` (counts by status and the 20 newest failed rows with their error) and `retry_failed_emails()` (sets failed rows back to pending with attempts 0). The manual retry was approved by the user on 2026-11-13 (PD29).
7. Re-create `set_switch` to accept the key `emails`.

`0030_cron_parity.sql`: **one** `cron.schedule` call, every minute, using `net.http_post` to `/api/cron` with the header `x-cron-secret` read from Vault (name `craftme_cron_secret`, equal to the function secret `CRON_SECRET`). With no `job` parameter the route runs `emails` every time and runs `cleanup` (P02) and `deletions` (P04) when the minute is 0; both are idempotent, so hourly is safe. One job and one secret instead of three. Until both secrets exist the call answers 401 and nothing happens.

Edge Function, job `emails` of `/api/cron`: refuses a wrong secret; if `RESEND_API_KEY`, `EMAIL_FROM` or `SITE_URL` is missing it returns `{configured: false}` and claims nothing; otherwise claims up to 20 rows, builds each with `email_context` and `emails_pure.js`, sends through Resend's HTTP API, and marks each row. The row id is passed as an idempotency key if Resend's API accepts one; confirm in Resend's documentation when building. In fake mode the provider stores the rendered subject and HTML in the row's `last_error` field prefixed `fake:` and marks it sent, so tests can read it.

Rollout: schema test, apply `0029`, deploy the Edge Function, set the secrets, apply `0030`, deploy the web app, then turn the `emails` switch on in S34.

## Proposed interfaces

```js
// supabase/functions/api/emails_pure.js (no network, unit-tested)
export const render = (kind, context, { siteUrl, supportEmail }) => ({ subject, html, text })   // kind: 'buyer_paid' | 'artist_new_order' | 'artist_payout_sent'
export const formatINR = (paise) => string        // same outputs as formatINR in src/lib/format.js
export const escapeHtml = (value) => string
```

```ts
// supabase/functions/api/emails.ts
export async function sendDueEmails(admin, limit = 20): Promise<{ configured: boolean; sent: number; failed: number }>
// one function; it posts to Resend with fetch, as rz() does for Razorpay. In fake mode it records the message instead of sending.

// supabase/functions/api/index.ts: one route (requires the header x-cron-secret to equal CRON_SECRET, else 401)
POST /api/cron?job=emails|cleanup|deletions   -> { emails?: { configured, sent, failed }, cleanup?: { removed }, deletions?: { finished } }   // no job: emails always, the other two at minute 0
// integrationStatus (P10) gains: email: { configured, pending, sent, failed }
```

```sql
-- 0029_email_outbox.sql
claim_emails(p_limit integer) returns setof public.email_outbox    -- service_role
mark_email_sent(p_id uuid, p_provider text) returns void           -- service_role
mark_email_error(p_id uuid, p_error text) returns void             -- service_role
email_context(p_id uuid) returns jsonb                             -- service_role
admin_email_outbox() returns jsonb                                 -- authenticated, Admin only
retry_failed_emails() returns jsonb                                -- authenticated, Admin only
set_switch(p_key text, p_value boolean) returns jsonb              -- same signature; now accepts 'emails'
```

```js
// src/api/gateway.js
RPC.retryFailedEmails = () => ['retry_failed_emails', {}];
export const useEmailOutbox = () => …             // admin_email_outbox, for S34
// useSwitches() (P03) also exposes `emails`
```

Secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SITE_URL` (exists today), `CRON_SECRET`, and the Vault secret `craftme_cron_secret`.

## Templates (`emails_pure.js`)

`render(kind, context, { siteUrl, supportEmail }) -> { subject, html, text }`. Inline styles, a fixed light background and dark text whatever the reader's theme, one column up to 600 px, the pot logo as a hosted image with alt text "CraftMe", a plain-text part for every email, and a footer line with the support address.

| Kind | Subject | Body |
| --- | --- | --- |
| `buyer_paid` | Your CraftMe Order {code} is Paid | "Thank you, {first name}. Your Order is Paid." "{Artist} has been told to pack your Order. They have until {shipBy} to ship it, and you'll get a tracking number when they do." Lines and amounts, "Shipping within India: Included", "Total paid". "Ship to: …". Button "View your Order" to `{site}/orders/{id}`. "Anything wrong? Reply to this email and we will help." |
| `artist_new_order` | New Order {code}: ship by {shipBy} | "You have a new Order to ship." "{Buyer short name} in {city} paid for {n} items. Please post them by {shipBy}." Lines and amounts, "You receive (estimate)". Button "See address and ship" to `{site}/dashboard/orders/{id}`. "The address is on the Order page, not in this email, so it stays private." |
| `artist_payout_sent` | Your CraftMe Payout of ₹{net} was sent | "We sent ₹{net} to {masked destination} on {date}. Reference {reference}." "{n} Orders, price paid", "CraftMe's share and payment cost", any Amount Owed taken or credit added, "Net Payout". Button "See the full statement" to `{site}/dashboard/payouts`. "Didn't get it within 2 working days? Reply to this email with your reference." |

All values are escaped. No demo values, no full payout destination, no Buyer address in either Artist email. From: `EMAIL_FROM`. Reply-To: `EMAIL_REPLY_TO`.

## Wording on other screens (S35.i.04)

Text that mentions email is drawn only when `useSwitches().emails` is true:

| Screen | With emails on | With emails off |
| --- | --- | --- |
| S11 Order placed | "A receipt is on its way to {email}." | Line absent |
| S24 empty inbox | "…the Order appears here and you get an email." | "…the Order appears here." |
| S28 settings | The email switches work | "Emails start soon." |
| S32 record dialog and recorded alert | "…and emails each Artist their statement." | Sentence absent |
| S14 submitted | Always "You'll get a notification here…" (no such email exists) | same |
| S34 integrations | "Email (Resend): Connected · {n} sent · {m} failed", the newest failure's error text, and a "Retry failed" button when any failed | "Not set up" |

## Rules

| Topic | Rule |
| --- | --- |
| When a row is created | Inside the same transaction that made the Order Paid or the Payout sent, by trigger. Never from the browser. |
| Once per recipient and event | The unique `dedupe_key`. A second `mark_paid`, a duplicate webhook or a re-recorded payout cannot add a row. |
| Failure | The row stays pending and is retried with backoff. Nothing about the Order or Payout changes. After six tries it is `failed` and visible to the Admin. |
| Provider accepted but the mark failed | The row is retried and could be sent twice. The idempotency key, where supported, prevents it; otherwise this is the accepted worst case. |
| Not configured | Rows wait up to 24 hours, then are skipped. Screens do not promise email (switch off). |
| Privacy | Address only in the Buyer's own email. Artist emails link to the page that enforces access. |
| Links | Built from `SITE_URL`; the target pages already send signed-out readers to log in and back (P04). |

## Steps

1. Migration and schema checks: paying an order adds exactly two rows; `mark_paid` twice adds none; a payout sent adds one, or a skipped one when the preference is off, or none at zero net; a trigger fault does not stop the payment (simulate by dropping the outbox table inside a savepoint); `claim_emails` backs off and gives up at six; stale rows are skipped; clients cannot read the table.
2. `emails_pure.js` with tests: each template's subject and key sentences, escaping of a name containing `<`, no address in the Artist emails, rupee formatting equal to `formatINR`.
3. `emails.ts` sender, the cron route, the fake provider.
4. `0030_cron_parity.sql`; add the Vault secret and function secret steps to `supabase/README.md` and replace its "SendGrid emails … are not ported" line.
5. The wording switches on the five screens; the S34 status line and "Retry failed".

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/emails.spec.js
```

## Completion gate

- [ ] QA-S35-01 to 06 pass with the fake provider; QA-S35-01 to 03 are listed for Gate B (a real inbox through Resend's test key).
- [ ] `git grep -n -i "email" src/pages src/components` shows no sentence promising an email outside the switch.
- [ ] The one new cron job exists on the project (`select jobname from cron.job`) after `0030`.
