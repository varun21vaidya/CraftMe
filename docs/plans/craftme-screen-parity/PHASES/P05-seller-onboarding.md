# P05 Become an Artist: details, WhatsApp phone check, onboarding fee, role

**Goal.** Build S18 end to end (D02): the details form, the phone check over WhatsApp through Supabase's Send SMS Hook (D03), the onboarding fee through Razorpay, the Artist role, and the live seller entry on S01, S16 and the header.

**Coverage.** All of S18; unhides S01.i.06 and S16.i.05.

**Depends on.** P04 (profile, terms, `/legal/artist`), P00 (provider seam). **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD27. **External:** XD01, XD04, XD08.

## Paths

Existing, to modify:

- `supabase/functions/api/index.ts` (`payOnboardingFee`, `markFeePaid`, `becomeArtist`, `webhook`)
- `supabase/functions/api/providers.ts` (P00; fake WhatsApp branch)
- `src/api/gateway.js`, `src/api/checkout.js`, `src/lib/format.js`, `src/App.jsx`
- `src/components/common/Layout.jsx` ("Sell your art" link)
- `supabase/config.toml` (P00), `supabase/schema.test.mjs`, `supabase/README.md`

PROPOSED, to create:

- `supabase/migrations/0023_onboarding.sql`
- `supabase/functions/api/whatsapp_pure.js`, `supabase/functions/api/whatsapp_pure.test.js` (message body builder and hook signature check; same pattern as `instagram_pure.js`)
- `src/pages/BecomeArtistPage.jsx`
- `src/components/onboarding/DetailsStep.jsx`, `PhoneStep.jsx`, `FeeStep.jsx`, `DoneStep.jsx`
- `src/lib/onboarding.js` (which step comes next, validators), `src/lib/onboarding.test.js`
- `e2e/become-artist.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `submit_verification` | `0003_logic.sql` | Replaced with a wider signature; its PAN, UPI, account and IFSC patterns are kept |
| `commands.payOnboardingFee`, `markFeePaid`, `commands.becomeArtist`, `setRoleFlag`, `webhook`, `hmacHex`, `safeEqual` | `supabase/functions/api/index.ts` | |
| `RPC.submitVerification`, `call`, `refreshClaims` | `src/api/gateway.js` | |
| `refreshClaims`, `isArtist` | `src/contexts/AuthContext.jsx` | |
| `payWithRazorpay` | `src/api/checkout.js` | |
| `useSwitches` | P03 | `acceptArtists` |
| `GROUPS` | `src/lib/categories.js` | "What do you make?" chips (KD05) |
| `STATES` | `src/lib/address.js` (P01) | |
| `Stepper`, `CodeInput`, `Field`, `Timeline`, `useToast` | P00 | |

## Migration `0023_onboarding.sql`

1. `alter table public.artist_private add column holder_name text, add column phone text, add column specialties text[] not null default '{}', add column agreed_own_work_at timestamptz, add column agreed_terms_at timestamptz, add column submitted_at timestamptz;`
2. `create table public.fee_orders (razorpay_order_id text primary key, profile_id uuid not null references public.profiles(id) on delete cascade, amount bigint not null check (amount > 0), created_at timestamptz not null default now(), payment_id text unique, paid_at timestamptz, refunded_at timestamptz);` RLS on, no client access, `grant all` to `service_role`. Reason: today each `payOnboardingFee` call overwrites `artist_private.onboarding_order_id`, so a payment made on an earlier order id is ignored by `markFeePaid`.
3. Replace `submit_verification`: drop `(text, text, jsonb)`, create `submit_verification(p_legal_name text, p_pan text, p_method jsonb, p_profile jsonb default null)`.
   - Same name, PAN, UPI and bank checks. A bank method also needs `holder` (1 to 100 characters).
   - When `p_profile` is given (the onboarding form): `city` and `state` 1 to 80, `bio` 1 to 300, `specialties` at least one entry and each a key of the five groups, `ownWork` and `agreement` both true, else `invalid` with the field names. Writes `profiles.city`, `state`, `bio`, and the private columns, and the two agreement times.
   - Does not set `phone_verified` any more (the Edge command below does). Still sets `verified_at = null` on any change (existing rule: an edit re-opens the Admin's check).
4. `create function public.onboarding_fee() returns bigint` (security definer, stable): the fee in paise, or null when zero. Granted to `authenticated` (the `settings` column itself stays hidden).
5. `create function public.record_fee_payment(p_order text, p_payment text) returns jsonb` (service role): marks the `fee_orders` row paid and, if the Artist's fee is not yet recorded, writes `artist_private.onboarding_paid_at`, `onboarding_payment_id`, `onboarding_order_id`, `onboarding_amount` in the same transaction and returns `{paid: true}`. If the fee was already recorded from another payment it returns `{duplicate: true}`.
6. Revoke and grant as usual; `submit_verification` and `onboarding_fee` to `authenticated`.

## Edge Function changes

| Command or route | Behaviour |
| --- | --- |
| `confirmPhone` (new) | Reads the caller with `admin.auth.admin.getUserById`. If `phone_confirmed_at` is set, writes `artist_private.phone_verified = true` and `phone`. Else `conflict` `phone_not_verified`. |
| `payOnboardingFee` | Refuses when `switches.acceptArtists` is false (`conflict` `artists_closed`). Reuses an unpaid `fee_orders` row of the same amount made in the last 15 minutes; otherwise creates a Razorpay order and inserts a row. Returns `{razorpayOrderId, keyId, amount}`. |
| `confirmFeePayment` (new) | `{razorpayOrderId, razorpayPaymentId, signature}`. Checks the row belongs to the caller and the signature, then `markFeePaid`. |
| `markFeePaid` | Looks the order up in `fee_orders`. Asks Razorpay for the payment (captured, amount, order id). Calls `record_fee_payment`. On `duplicate`, refunds that payment through the provider and stamps `refunded_at` (PD27). |
| `becomeArtist` | Unchanged checks, plus `artists_closed`. |
| `webhook` | Unchanged routing: an order id that is not an Order goes to `markFeePaid`. |
| `POST /api/sms-hook` (new route in the existing function, beside `/webhook` and `/instagram/*`; no second function to deploy) | Supabase's Send SMS Hook target. Verifies the hook signature with `SEND_SMS_HOOK_SECRET`, then sends the code with the Meta Cloud API as an approved authentication template (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG`). Without those secrets it answers an error, and the browser sees "not set up". The exact hook payload and signature scheme must be read from the Supabase Auth Hooks documentation when building; the decision log only verified that the hook exists and fits WhatsApp. |

Auth settings (dashboard for production, `supabase/config.toml` for local): phone provider on, Send SMS Hook pointing at `/functions/v1/api/sms-hook`, code length 6, code life 600 seconds, one send per 60 seconds. Local testing uses the fixed test codes table in `config.toml` (`[auth.sms.test_otp]`), so no message is sent.

## Proposed interfaces

```js
// gateway.js
export const useOnboarding = (uid) => …        // { legalName, payoutType, phoneVerified, feePaidAt, verifiedAt } from artist_private, or null
export const useOnboardingFee = () => …         // rpc onboarding_fee -> paise | null
export const startPhoneCheck = (phone) => …     // supabase.auth.updateUser({ phone: '+91' + phone })
export const verifyPhoneCode = (phone, code) => … // supabase.auth.verifyOtp({ phone, token, type: 'phone_change' }) then call('confirmPhone')
export const resendPhoneCode = (phone) => …     // supabase.auth.resend({ type: 'phone_change', phone })
RPC.submitVerification = (i) => ['submit_verification', { p_legal_name: i.legalName, p_pan: i.pan, p_method: i.payoutMethod, p_profile: i.profile ?? null }];

// src/lib/onboarding.js
export const nextStep = ({ isArtist, onboarding }) => 'step1' | 'step2' | 'step3' | 'finish' | 'done'
```

## UI specification: `/become-artist`

Signed in only (returns here after login). The step shown is always the one the server state allows (`nextStep`), so a reload or a second device resumes at the right place. `?step=1` lets the person go back to edit details.

Common frame for steps 1 to 3: eyebrow "Sell on CraftMe", `h1` "Become an Artist", "Three short steps. You can keep buying with the same Account.", `Stepper` (Your details, Verify phone, Open your shop).

**Closed.** `acceptArtists` off: "CraftMe isn't taking new Artists right now." with "Browse art". No form.

**Step 1, details** (`S18.st.step1`). Two columns over 900 px (form, "How selling works" aside).

- "Who you are", with the notice "Private to you. Buyers never see this. We use it to pay you." Legal name\* ("Exactly as on your PAN card."), PAN\* (typed letters are upper-cased; "10 characters, like ABCDE1234F."), City\*, State\* (select).
- "Where should we pay you?" with "You're paid twice a month, on the 1st and 15th." Radio cards: UPI ID, Bank account. UPI: UPI ID\*. Bank: Account holder name\*, IFSC\* (upper-cased), Account number\*, Confirm account number\* ("The two account numbers don't match."). The fields of the unselected method are hidden, not disabled.
- "Your shop": Short bio\* (300, counter); "What do you make?" chips for the five groups, at least one; checkbox "Everything I sell is my own work."; checkbox "I am 18 or older and I accept the Artist agreement." (link to `/legal/artist`).
- "Cancel" (to `/profile`) and "Continue to phone check" ("Saving…").
- Errors: a summary alert and inline messages per field. Server `invalid` with `fields` (`legalName`, `pan`, `upi`, `account`, `ifsc`, `payoutMethod`, and the profile fields) marks the same fields.

**Step 2, phone** (`S18.st.step2`).

- First view: Phone\* with a fixed "+91" (prefilled from the saved address), "Send code on WhatsApp".
- Second view: "We sent a 6-digit code on WhatsApp to +91 {number}. It works for 10 minutes." `CodeInput` (typing moves forward, Backspace moves back, a pasted 6-digit code fills every box). "Didn't get it? Resend in 0:59", which becomes a "Resend code" button. "Change number" returns to the first view. "Back" (to step 1) and "Verify and continue" (enabled at six digits; "Checking…").

| Failure | Message |
| --- | --- |
| Wrong code | "That code isn't right. Check it and try again." Boxes cleared, focus on the first. |
| Expired code | "That code has expired. Send a new one." |
| Too many sends or tries | "Too many tries. Wait a minute, then try again." |
| Number already on another account | "That number is already used on another CraftMe account." |
| Hook not configured or Meta refused the send | "Phone checks aren't working right now. Please try again later." (D15) |
| Code accepted but `confirmPhone` failed | "Your number is verified. We couldn't save that yet." with "Try again", which calls only `confirmPhone` |

**Step 3, fee** (`S18.st.step3`). "Open your shop". The amount from `onboarding_fee()`. Three included items. Info: "You only pay when you sell. A small share of each sale. Nothing monthly." Checkbox "I understand this payment isn't refunded." (required). Button "Open my shop for ₹{fee}". "What happens after" as a `Timeline`.

| Case | Behaviour |
| --- | --- |
| Fee not set (`onboarding_fee()` null or `fee_not_set`) | "The fee to open a shop isn't set yet. Please check back soon." Button hidden. |
| Payments not configured | "Payments aren't set up on this site yet." Button disabled. |
| Window closed without paying | Stay on the step. No message. |
| Paid | A "Confirming your payment…" panel: `confirmFeePayment` with a fixed `requestId`, retried on `unavailable`; it also polls `useOnboarding` every 4 seconds for `feePaidAt` (the webhook may win). Then `becomeArtist`, `refreshClaims`, Done. |
| `already_paid` | Skip straight to `becomeArtist`. |
| `becomeArtist` fails after the fee is recorded | "Your payment is recorded. We couldn't open your shop yet." with "Try again". A reload lands on the same finishing state (`nextStep` returns `finish`). |
| A second payment arrives for an Artist whose fee is recorded | It is refunded automatically; nothing is shown unless the person is on the page, where the panel says "You were charged twice. The second payment is being returned." (PD27) |

**Done** (`S18.st.done`). `role="status"`: "You're an Artist on CraftMe. Your shop is ready for its first piece." "Your first steps": Open your shop (Done), Add your first Artwork (to `/dashboard/artworks/new`), Connect Instagram (optional, to `/dashboard/instagram`), "We're checking your details so you can be paid" (Pending). "Go to my dashboard". An existing Artist who opens `/become-artist` sees this view.

**Seller entry.** With `acceptArtists` on: "Sell your art" in the header and footer, the Home buttons (P03), "Become an Artist" in the account menu and on the profile (P04). For an Artist these become "Artist dashboard".

## Authoritative state and money

| Topic | Rule |
| --- | --- |
| Fee paid | Only `record_fee_payment`, after Razorpay reports the payment captured for the exact fee amount and that order id. |
| Fee amount | Fixed on the `fee_orders` row when the order is created. A later change in S34 affects new orders only. |
| Role | `app_metadata.artist`, written only by `setRoleFlag` in `becomeArtist`, after legal name, PAN, verified phone and recorded fee are all present. |
| Phone | Verified by Supabase Auth. `confirmPhone` copies the fact; the browser cannot set `phone_verified`. |
| Repeat | `payOnboardingFee` reuses a recent unpaid order. `confirmFeePayment`, the webhook and `becomeArtist` are idempotent. |
| Uncertain payment | The confirming panel never says "failed". It waits for the server state. |

## Steps

1. Migration and schema checks: profile fields required and stored; bank needs a holder; an edit clears `verified_at`; `record_fee_payment` marks once and reports a duplicate; a second order id for the same Artist still settles; clients cannot read `fee_orders`; `onboarding_fee` returns null for zero.
2. The `/sms-hook` route with a unit test for the message body builder and signature check (`whatsapp_pure.js`), and the auth configuration for local.
3. Edge commands as in the table; fake Razorpay already covers the fee (P00).
4. `onboarding.js` with tests for every server state.
5. The page and its four steps; route `/become-artist` with `signedIn`.
6. Turn on the seller entries behind `acceptArtists`.
7. `format.js`: `artists_closed`, `phone_not_verified`, `fee_not_set`, `verification_missing`, `already_paid`.
8. `supabase/README.md`: replace the "Known gaps" line about phone verification with the new secrets and settings.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `submit_verification` | Own row only (`auth.uid()`) | Editing after verification clears `verified_at` (payouts pause, stated in S28) | Idempotent upsert | — | Form keeps values | Step from server state |
| Send or verify code | Auth session only | Number changed: old code no longer valid | Send limited to one a minute | Verified but not copied: retry `confirmPhone` | Yes | Step 2 until `phone_verified` |
| `payOnboardingFee` | Signed in; closed switch refuses | Fee changed between view and click: the button shows the amount returned by the command; if it differs from what was drawn, the page asks to confirm the new amount before opening the window | Recent order reused | Order made, window never opened: row stays unpaid, harmless | Yes | Step 3 |
| `confirmFeePayment` / webhook | Row must belong to the caller | Already recorded: `{paid: true}` | Idempotent | Provider read fails: `unavailable`, retried | Same `requestId` | Finishing state |
| `becomeArtist` | Needs all four facts | — | Idempotent | Role set in auth but profile mirror failed: next call repairs (`setRoleFlag` writes both) | Yes | Finishing state |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/become-artist.spec.js
```

## Completion gate

- [ ] QA-S18-01, 02, 04 (local test codes), 06 to 09 pass; QA-S18-05 passes with the fake provider.
- [ ] QA-S18-03 (real WhatsApp message) and QA-S18-05 with Razorpay test keys are listed for Gate B.
- [ ] With `acceptArtists` off, no seller link is visible anywhere and `/become-artist` shows the closed view.
