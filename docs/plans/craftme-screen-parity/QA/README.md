# QA: fixtures, harness and how to run the scripts

Scripts live in four files:

| File | Scripts |
| --- | --- |
| [storefront-account.md](storefront-account.md) | QA-SH, QA-S01 to S05, QA-S16 to S20, QA-X |
| [buyer.md](buyer.md) | QA-S08 to S15 |
| [artist.md](artist.md) | QA-S21 to S28 |
| [admin-system.md](admin-system.md) | QA-S29 to S36, QA-SYS |

Every script ID is the one cited in [COVERAGE.md](../COVERAGE.md). All paths below are proposed (PD01) unless they exist at commit `0815969`.

## Environments

| Name | What | Used for |
| --- | --- | --- |
| **local** | `npx supabase start` (Docker), `supabase/seed_qa.sql`, Edge Function served locally with `PROVIDER_MODE=fake`, `npm run dev` | Gate A. Every script whose Type is `schema`, `unit` or `e2e`. |
| **sandbox** | A Supabase branch or the project with test credentials: Razorpay `rzp_test_…` keys and webhook, Resend test key, Meta app in development mode, a WhatsApp test number | Gate B. Scripts marked `sandbox`. |
| **production** | The live project and domain | Gate C. Scripts marked `production`, run once at launch by the user. |

Never run a `sandbox` script against live keys, and never point the local stack at the production database.

## Commands

```bash
npx supabase start
```
```bash
npm run db:seed
```
```bash
npx supabase functions serve api --env-file supabase/.env.local
```
```bash
npm run dev
```
```bash
npx playwright test
```

`npm run db:seed` (proposed script) runs `supabase db reset` and then `supabase/seed_qa.sql`. It is the **default cleanup** for every script: unless a script says otherwise, re-seed before the next one that writes data. Playwright does this once per spec file.

`supabase/.env.local` (git-ignored, proposed) holds `PROVIDER_MODE=fake`, `APP_ENV=local`, `RAZORPAY_KEY_ID=rzp_fake_local`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` (any local value), `CRON_SECRET`, `SITE_URL=http://localhost:5173`. Test passwords live in `.env.e2e` as `QA_PASSWORD`; they are never written in this plan.

## Signing in during tests

Production is Google-only (D01). The local stack also enables email-and-password sign-in in `supabase/config.toml` so a test can log in without Google. `e2e/helpers/session.js` exports `signInAs(page, 'B1')`, which signs the fixture user in through the Supabase client and stores the session in the page before the first navigation. `sandbox` and `production` scripts sign in with real Google accounts by hand.

## Fixtures (`supabase/seed_qa.sql`)

All names and amounts here are test data. They are never requirements.

**People**

| Key | Who | State |
| --- | --- | --- |
| G | Signed-out visitor | — |
| B1 | Buyer "Ananya Verma" | Terms accepted. Saved address in Mumbai, PIN 400050, phone 9876543210. 6 notifications, 2 unread. |
| B2 | Buyer "Rahul Nair" | First sign-in: no terms accepted, no saved address |
| A1 | Artist "Meera Iyer", Chennai | Verified, shop open, UPI destination, rating from 3 approved reviews, Instagram not connected, 1 pasted reel |
| A2 | Artist "Imran Sheikh", Lucknow | Details submitted, phone verified, fee paid, **not verified** |
| A3 | Artist "Naina Kapoor" | **Restricted** for `owed_60_days`, Amount Owed ₹3,200 since 61 days ago, 1 Paid order to ship |
| A4 | Artist "Tanvi Rao" | Verified, Amount Owed ₹3,200 since 52 days ago, not restricted, 2 payable orders worth more than the debt |
| AD1 | Admin | `app_metadata.admin = true` |
| AD2 | Second Admin | Same |

**Artworks**

| Key | Work | Listings |
| --- | --- | --- |
| W1 | "Monsoon Over Marina", A1, Paintings, 3 photos, reel linked | Original ₹42,000 stock 1 live; Print ₹2,500 stock 50 live |
| W2 | "Kolam at Dawn", A1 | Original sold; Print ₹2,200 stock 12 live |
| W3 | "Temple Tank, Evening", A1 | Original sold (nothing else) |
| W4 | "Coconut Grove, Study 2", A1 | Draft, no listings |
| W5 | "Pongal Morning", A1 | Print ended (work hidden) |
| W6 | "Brass Heron", A2, Sculptures | Original ₹28,000 stock 1 live |
| W7 | "Peacock Study", A3 | Hidden because A3 is restricted |
| W8 | "Riso Sunrise", A4, Art Prints | Print ₹1,800 stock 40; Ready-made frame ₹900 stock 5 |
| F01–F30 | Thirty filler works spread over A1, A2 and A4, all five groups, prices ₹500 to ₹60,000, six of them with identical `created_at` and four with identical prices | One live listing each |

**Orders** (Buyer B1 unless stated)

| Key | Stage and age | Detail |
| --- | --- | --- |
| O1 | `hold`, 10 minutes left | W1 Print ×1 |
| O2 | `paid` today | W2 Print ×2 and W1 Print ×1, ₹6,900, A1, gift note "Happy birthday" |
| O3 | `paid` 8 days ago, `overdue` | Buyer B2, A1, W2 Print ×1, never extended |
| O4 | `shipped` 2 days ago | A2, W6, courier DTDC, tracking DT4830012IN |
| O5 | `received` yesterday (damage window open, review open) | A1, two lines |
| O6 | `received` 10 days ago, payable, not reviewed | A1 |
| O7 | `received` 40 days ago (review window closed), paid out in P1, reviewed (approved) | A1 |
| O8 | `received`, one of two lines refunded, refund `issued` | A1 |
| O9 | `refunded` in full | A1 |
| O10 | `received` 1 day ago with an **open Damage Report** (2 photos, 1 of 2 lines) | Buyer B2, A1 |
| O11 | `received`, paid out, then refunded: the cause of A4's Amount Owed | A4 |
| O12 | `received` 3 days ago with a **pending review** | A4 |
| O13 | `received` 2 days ago with a pending review whose text contains a phone number | A2 |
| O14 | `shipped` 15 days ago (auto-receive due) | A1 |
| O15 | `paid` today | A3 (restricted Artist's open order) |

**Other rows**

- Payout P1: A1, sent on the 1st of last month, reference `3048827711`, order O7.
- A draft payout run for the current run day containing A1 (O6) and A4 (two orders, Amount Owed deducted); A2 is blocked (unverified, one payable order).
- Reports: REP1 on W6 (open, "copied"); REP2 on A2 (open, "mismatch").
- Settings: commission 1000 basis points, onboarding fee ₹499 (49900 paise), switches `{acceptArtists: true, instagramConnect: true, demoBanner: true, emails: false}`.
- Local auth test codes: phone `+919000000001` accepts `123456`.

## Helpers (`e2e/helpers/db.js`)

`sql(text)` runs a statement with the local service role. Time is moved by editing rows, then running the sweep:

```sql
-- expire a hold now
update public.orders set hold_until = now() - interval '1 minute' where id = :O1;
-- cross the damage window
update public.orders set damage_window_ends = now() - interval '1 minute' where id = :O5;
-- cross the review window
update public.orders set review_by = now() - interval '1 minute' where id = :O6;
-- then, when a rule is time-based
select public.sweep();
```

`webhook(event)` posts a signed Razorpay event to the local `/api/webhook` using the local webhook secret. `cron(job)` calls `/api/cron?job=<emails|cleanup|deletions>` with the local cron secret.

## Script format

```
### QA-S08-03 Title
Covers: coverage IDs · Type: e2e (file) | schema | unit (file) | sandbox | production · Role: B1 · Route: /cart · View: default
Setup: fixture changes before the first step
Do: numbered actions with exact inputs
See: what is visible
Data: what is stored, and side effects
```

Defaults when a line is absent: **View** is desktop 1280 × 800, light theme. **Setup** is the seed as is. **Cleanup** is `npm run db:seed`. "View: all" means run at 375, 768 and 1280 px in both themes.

**Type** says how the case is automated or checked:

- `schema`: an assertion added to `supabase/schema.test.mjs` (runs in memory, no network).
- `unit`: a vitest file.
- `e2e`: a Playwright spec against **local** with fake providers.
- `sandbox`: done by a person with provider test credentials; evidence is a screenshot or the provider dashboard entry.
- `production`: done once by the user at launch.

A script may list two types: the automated one for Gate A and a `sandbox` repeat for Gate B.

<a id="recording-results"></a>
## Recording results

`QA/RESULTS.md` (created in P12) has one row per run: script ID, date, commit, environment, pass or fail, link to evidence, note. A script is "passing" for a gate when its newest row for the required environment is a pass on the commit being released.
