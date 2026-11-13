# P10 Admin orders and refunds, payout run, settings

**Goal.** The Admin's money screens: every Order with search, filters and per-line refunds including the "unknown" refund check (S31), the payout run with transfer references (S32), and settings for fees, switches, Admins and integration status (S34).

**Coverage.** All of S31, S32 (S32.i.05 text waits for P11), S34, S30.i.07, SH.14.

**Depends on.** P09 (shell, audit, refund provider step), P07 (credit in payouts). **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD19, PD23. **External:** XD01, XD08.

## Paths

Existing, to modify:

- `supabase/functions/api/index.ts` (`issueRefund`, `setRole`), `supabase/functions/api/providers.ts` (fake branch for the refunds list)
- `src/components/common/AdminShell.jsx` (three more links), `src/components/common/Layout.jsx` (demo banner)
- `src/api/gateway.js` (`RPC.buildPayoutRun`, `RPC.recordPayout`), `src/lib/format.js`, `src/App.jsx`
- `supabase/schema.test.mjs`

PROPOSED, to create:

- `supabase/migrations/0028_admin_money.sql`
- `src/pages/admin/AdminOrders.jsx`, `AdminPayoutRun.jsx`, `AdminSettings.jsx`
- `src/components/admin/OrderDialog.jsx`, `RefundsToCheck.jsx`, `RecordRunDialog.jsx`, `PayoutLinesDialog.jsx`, `AddAdminDialog.jsx`
- `e2e/admin-orders.spec.js`, `e2e/admin-payouts.spec.js`, `e2e/admin-settings.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `reserve_refund`, `confirm_refund`, `mark_refund_unknown`, `owed_after_refund`, `commission_of`, `payout_calc`, `_build_payout_run`, `build_payout_run`, `record_payout` | `0003_logic.sql` (re-created in `0025`) | |
| `commands.issueRefund`, `commands.setRole`, `setRoleFlag`, `requireRole` | `supabase/functions/api/index.ts` | |
| Cron `craftme-payout-run` | `0005_cron.sql` | Still builds the draft at 09:00 IST on the 1st and 15th |
| `settings` table, `settings_read` policy, column grant `(id, switches)` | `0001_init.sql` | Fees stay hidden from clients |
| `RULES` | `src/lib/rules.js` (P00) | "Shop rules" list |
| `useSwitches` | P03 | Demo banner |
| `Dialog`, `Pagination`, `CopyButton`, `Field`, `useToast` | P00 | |

## Migration `0028_admin_money.sql`

All functions are security definer, Admin-only, and write `audit_log`.

1. **Orders.**
   - `admin_orders(p jsonb) returns jsonb`: keys `q` (order code, or a Buyer's email looked up in `auth.users`, or a payment id; exact match, case-insensitive), `stage` (`hold`, `paid`, `shipped`, `received`, `refunded`, `overdue`), `artist`, `days` (7, 30, 365), `page`. Returns `{total, items}`, 20 per page, newest first; each item has code, placed time, Buyer short name and city, Artist, total, stage, `overdue`, and a payout status: `not_yet`, `payable`, `paid_out` with its date, or `owed` with the amount.
   - The order dialog needs no function: an Admin may already select `orders` with `order_lines`, `refunds` and `order_shipping` (RLS). It reads: lines with quantity, unit, total and refunded quantity; payment id, method, gateway fee, commission rate; refunds with status; payout id.
   - `refund_preview(p_order uuid, p_lines jsonb) returns jsonb`: no writes. `{amount, afterPayout, owedDelta, payoutDrop}` using the same arithmetic as `reserve_refund`.
2. **Refund record.** `alter table public.refunds add column reason_code text check (reason_code in ('damage','overdue','removed','other')), add column note text not null default '', add column checked_at timestamptz;` `refunds_to_check() returns jsonb`: refunds with status `unknown`, or `pending` for more than five minutes.
3. **Payout run.**
   - Re-create `_build_payout_run(p_day date default null)`: `p_day` defaults to the most recent 1st or 15th on or before today (Asia/Kolkata), so a rebuild on the 2nd refreshes the run of the 1st and never makes an off-schedule run (D13). It first deletes `draft` rows of earlier run days (their orders are still unpaid and are picked up again). `build_payout_run()` keeps its signature.
   - `create unique index payouts_reference on public.payouts (reference) where status = 'sent';` `record_payout` maps the violation to `conflict` `duplicate_reference`.
   - `admin_payout_run(p_day date default null) returns jsonb`: the run day, rows per Artist (name, verified, order count, gross, refunds, commission, gateway fees, owed deducted, credit added, net, destination, method, reference, status), blocked Artists (payable orders, not verified, with totals), and run totals.
   - The lines dialog needs no function: it selects `orders` where `payout_id` equals the payout, with the `order_net` field (P07), as the Artist's statement does.
4. **Settings.**
   - `admin_settings() returns jsonb`: commission in basis points, onboarding fee in paise, switches.
   - `update_fees(p_commission_bps integer, p_fee_paise bigint)`: commission 0 to 5000, fee 0 to 10000000 paise; outside that `invalid` with the field.
   - `set_switch(p_key text, p_value boolean)`: keys `instagramConnect`, `acceptArtists`, `demoBanner`.
   - `user_id_by_email(p_email text) returns uuid` (service role only).
5. Revoke and grant as usual.

Edge Function:

| Command (all Admin) | Behaviour |
| --- | --- |
| `issueRefund` | Input gains `reasonCode` and `note` (`other` needs a note). Lines are `{lineId, quantity}` as today. |
| `checkRefund` `{refundId}` | For an `unknown` or old `pending` refund: asks Razorpay for the payment's refunds. A refund of that amount made after the reservation: `confirm_refund` with its id, answer `issued`. None: answer `not_found`. |
| `retryRefund` `{refundId}` | Only after `checkRefund` answered `not_found` in this request chain: checks once more, then sends the refund and confirms it. Provider error: stays `unknown`. |
| `listAdmins` | Users whose `app_metadata.admin` is true: id, email, name |
| `grantAdmin` `{email}` | Finds the account; unknown email: `conflict` `not_found`; sets the role; audit row |
| `revokeAdmin` `{uid}` | Refuses yourself (`self_demote`, existing) and the last Admin (`last_admin`); audit row |
| `integrationStatus` | `{razorpay: {configured, mode: 'live'|'test'|'fake'|null, webhook: boolean}, email: {configured}, whatsapp: {configured}, instagram: {configured, switchOn}}`. Booleans and the key prefix only, never a secret. |

Listing a payment's refunds is one more `rz` call (`GET /payments/<id>/refunds`); `fakeRz` learns that path.

Rollout: schema test, apply `0028`, deploy the Edge Function, deploy the web app.

## Proposed interfaces

```js
// src/api/gateway.js
RPC.buildPayoutRun = () => ['build_payout_run', {}];                                                   // unchanged
RPC.recordPayout   = (i) => ['record_payout', { p_payout: i.payoutId, p_reference: i.reference }];     // unchanged
RPC.updateFees     = (i) => ['update_fees', { p_commission_bps: i.commissionBps, p_fee_paise: i.feePaise }];
RPC.setSwitch      = (i) => ['set_switch', { p_key: i.key, p_value: i.value }];
// Edge commands: 'issueRefund', 'checkRefund', 'retryRefund', 'listAdmins', 'grantAdmin', 'revokeAdmin', 'integrationStatus'

export const useAdminOrders = (filters) => …            // admin_orders -> { total, items }
export const useAdminOrder = (orderId) => …             // direct select: orders + order_lines + refunds + order_shipping
export const useRefundPreview = (orderId, lines) => …   // refund_preview; null while nothing is ticked
export const useRefundsToCheck = () => …                // refunds_to_check; polls 30 s
export const useAdminPayoutRun = () => …                // admin_payout_run
export const usePayoutLines = (payoutId) => …           // same hook as the Artist's usePayoutOrders (P07)
export const useAdminSettings = () => …                 // admin_settings
```

```ts
// supabase/functions/api/index.ts
issueRefund        { orderId, lines: [{ lineId, quantity }], reasonCode: 'damage' | 'overdue' | 'removed' | 'other', note?: string }
                   -> { refundId, amount, status: 'issued' } | unavailable "refund_unknown" { refundId } | conflict "exceeds_paid" | conflict "wrong_stage"
checkRefund        { refundId }  -> { status: 'issued' | 'not_found' }
retryRefund        { refundId }  -> { status: 'issued' }   | unavailable "refund_unknown"
listAdmins         {}            -> { admins: [{ uid, email, name }] }
grantAdmin         { email }     -> {}                     | conflict "not_found"
revokeAdmin        { uid }       -> {}                     | conflict "self_demote" | conflict "last_admin"
integrationStatus  {}            -> { razorpay: { configured, mode, webhook }, email: { configured }, whatsapp: { configured }, instagram: { configured, switchOn } }

// no new provider method: checkRefund calls rz(`/payments/${paymentId}/refunds`, "GET")
```

```sql
-- 0028_admin_money.sql
admin_orders(p jsonb) returns jsonb
refund_preview(p_order uuid, p_lines jsonb) returns jsonb    -- { amount, afterPayout, owedDelta, payoutDrop }; no writes
refunds_to_check() returns jsonb
_build_payout_run(p_day date default null) returns jsonb     -- replaces the no-argument version
build_payout_run() returns jsonb                             -- same signature
admin_payout_run(p_day date default null) returns jsonb
admin_settings() returns jsonb
update_fees(p_commission_bps integer, p_fee_paise bigint) returns jsonb
set_switch(p_key text, p_value boolean) returns jsonb
user_id_by_email(p_email text) returns uuid                  -- service_role only
```

`_build_payout_run` changes its argument list, so the migration drops `_build_payout_run()` and creates the new one in the same file. The cron job text `select public._build_payout_run()` in `0005_cron.sql` still resolves, because the new argument has a default.

New `reason` values: `duplicate_reference`, `last_admin`. Reused: `rebuild`, `already_sent`, `artist_unverified`, `exceeds_paid`, `refund_unknown`.

## Authoritative state, transactions, time and idempotency

| Topic | Rule |
| --- | --- |
| Refund order of work | Reserve in the database (one transaction: line quantities, order total, stage, Amount Owed if already paid out), then Razorpay, then confirm. Two Admins cannot refund the same quantity: the second reservation fails `exceeds_paid`. |
| Provider answer missing | The reservation stays, status `unknown`. It is never undone automatically, because Razorpay may have refunded. The Buyer sees "being processed" (P01). The Admin resolves it with Check, then Retry only if Razorpay shows nothing. |
| Refund after payout | Raises the Artist's Amount Owed by the refund minus the commission CraftMe gives back, starts the 60-day clock if none runs, and uses up credit first (P07). |
| Fee on refunds | Razorpay keeps its fee. The preview states the order's real `gateway_fee` share; it is CraftMe's cost before payout and part of the Artist's deduction rule only as already defined in `payout_calc`. |
| Payout amounts | Recomputed inside `record_payout` from the orders as they are now. A difference from the draft fails `rebuild`. |
| Recording | One Artist row at a time, each its own transaction: marks the orders paid out, stores reference and destination, settles owed and credit. A row is recorded once (`already_sent`); a reference is used once (`duplicate_reference`). |
| Run day | Only the 1st and 15th exist as run days (D13). Rows without a reference stay as drafts and are rebuilt into the next run. |
| Commission change | Applies to orders paid after the save. Each order keeps the rate stored when it was paid (`orders.commission_bps`). |

## UI specification

### S31 Orders, `/admin/orders`

- Header: "Orders", "Every Order on CraftMe. Issue a Refund per Order Line from here."
- Filters in the URL: Search ("CM code, email, payment ID"; applies on Enter), Stage (Any, Hold, Paid, Shipped, Received, Refunded, Overdue), Artist (type-ahead), Placed (Last 30 days, Last 7 days, This year). "Clear".
- **Refunds to check** (shown above the table only when any exist): one row per refund: order, amount, since, status, "Check with Razorpay". Result `issued`: toast "Razorpay confirms this refund." and the row leaves. Result `not_found`: the row shows "Razorpay has no refund for this." and a "Send refund again" button with a confirm dialog.
- Table: Order, Placed, Buyer and city, Artist, Total, Stage badge (Overdue in the warning colour), Payout ("Not yet", "Payable", "Paid out {date}", "Owed ₹{amount}"), "Open". `Pagination`. Empty: "No Orders match." Loading and error as elsewhere.
- **`S31.dlg.ord`.** Title "Order {code} · {stage}", sub-line Buyer, Artist, placed time. Table of lines with a checkbox each, quantity, unit, line total, and "Refunded {n} of {m}" where it applies; a fully refunded line has no checkbox. For a line with quantity above 1, ticking it shows a small number input "How many" (1 to the unrefunded quantity). Key-value block: Razorpay payment id (with `CopyButton`), Method, Gateway fee, Commission ("10% · ₹690"), Payout status. Then "Reason\*" (Damage Report upheld; Overdue, not shipped; Artwork removed; Other (add a note)), "Note" (required for Other). A live preview from `refund_preview`: "Refund to Buyer ₹{amount}. Goes back to the Buyer's original payment method. Razorpay keeps its fee." and either "The Artist's Payout for this Order drops by ₹{payoutDrop}." or "The Artist was already paid. ₹{owedDelta} becomes an Amount Owed." Buttons "Close" and "Refund selected lines" (disabled with nothing ticked, or for stages that cannot be refunded: hold, expired, refunded; "Refunding…").

| Result | What the Admin sees |
| --- | --- |
| Issued | Toast "Refund of ₹{amount} issued through Razorpay."; the dialog reloads with the lines marked |
| `refund_unknown` | Warning in the dialog: "The refund is recorded but Razorpay didn't confirm it. Don't refund again. Check it under 'Refunds to check'." |
| `exceeds_paid` | "Those lines were already refunded." and the dialog reloads |
| `wrong_stage` | "This Order can't be refunded at this stage." |
| Payments not configured | The refund section is replaced by "Refunds aren't set up on this site yet." |

### S32 Payout run, `/admin/payouts`

- Header: "Payout run, {run day}" with a badge "Draft" or "Recorded".
- `S32.st.default` (at least one draft row): lead "Built automatically on the morning of the 1st and 15th. Send each transfer from your bank, then enter its reference." Buttons "Copy transfer list" (copies lines of Artist, destination, amount for verified rows; toast "Copied"), "Rebuild" (calls `build_payout_run`; toast "Draft rebuilt"), "Record run".
- Blocked alert: "{n} Artists can't be paid yet. {names} aren't verified. Their Orders stay Payable and roll into the next run." with a link to the verification queue.
- Totals: Artists ("{n} of {m}"), Orders, Paid by Buyers, Commission kept, Net to pay out.
- Table (scrolls sideways under 1000 px): Artist with a Verified or Not verified badge, Orders, Price, Refunds, Commission, Gateway fee, Owed deducted, Credit added, Net, Pay to (destination with `CopyButton`), Reference (text input "UTR / reference" for a draft row; read-only text for a sent row), "Lines" (`S32.dlg.lines`). A blocked row shows "₹0 now", "Blocked", "Rolls to the next run", "Verify". A row whose net is zero (Amount Owed took it all) needs no transfer: its reference input is replaced by "Nothing to send" and it is recorded with the reference `none-{run day}-{artist short id}`.
- **`S32.dlg.done`** (alert dialog): "Record this run? This marks {orders} Orders as paid out. You can't undo it or record it twice." When rows lack a reference: "{k} rows have no transfer reference. Enter them first, or leave those Artists for the next run." "Go back" and "Record run". Recording goes row by row and shows progress ("Recording 3 of 14…"). The words "and emails each Artist their statement" are added by P11.

| Per-row result | Shown on the row |
| --- | --- |
| Recorded | Badge "Sent", reference read-only |
| `rebuild` | "The numbers changed since the draft. Press Rebuild, check, and record again." Recording stops; rows already recorded stay recorded. |
| `duplicate_reference` | "That reference was already used." The input is marked. |
| `artist_unverified` | The row becomes Blocked |
| `already_sent` | Treated as recorded |
| Network failure | "Couldn't record. Try again." on that row; the dialog offers "Continue" |

- `S32.st.sent` (no draft row with a reference left to record and at least one sent): status alert "Run recorded. {n} transfers, ₹{total} paid out. A recorded transfer can't be edited. Corrections go in the next run." Rows left as drafts are listed under "Left for the next run".
- No run yet, or nothing payable: "Nothing to pay out for {run day}. The next run is {date}."

### S34 Settings, `/admin/settings`

- **Fees** form: Commission (percent, up to two decimals, 0 to 50), Onboarding fee (whole rupees). Note: "A new Commission applies to Orders paid after you save. Existing Orders keep the rate they were paid at." Live preview on a ₹2,500 example: "Commission ₹{c} · payment cost about ₹{g} · Artist receives about ₹{n}" (PD19). "Save fees" ("Saving…"); toast "Fees saved". Out-of-range values show a message on the field. When the fee is 0: a warning "No onboarding fee is set. New Artists can't finish joining." (XD08).
- **Switches**, each saved on change with a toast, and flipped back with an error toast on failure: Instagram Connect ("Off until Meta approves the app. Artists can still paste links."); Accept new Artists ("Off hides 'Become an Artist'."); Demo banner ("The 'test mode' strip at the top of every page. Turn off at go-live.").
- **Shop rules** (read-only, from `RULES`): Checkout Hold 15 minutes; Ship deadline 7 days after payment; Auto-Received 14 days after Shipped; Damage Report window 3 days after Received; Review window 30 days after Received; Payout runs 1st and 15th; Amount Owed before Restricted 60 days. "These are set in code. Changing one is a release, not a setting."
- **Admins**: list (initials, name, email, "You" on your own row, "Remove" on others). "Add" opens **`S34.dlg.adm`**: "Email of an existing Account", the note "Admins can see Artist payout details and issue Refunds.", "Cancel", "Grant Admin". Unknown email: "No Account uses that email. They need to sign in once first." Remove asks in an alert dialog. `last_admin`: "You can't remove the last Admin."
- **Integrations** (from `integrationStatus`): Razorpay ("Live", "Test mode", "Test double (fake)", or "Not set up", and "Webhook secret set / missing"); Email (Resend) ("Connected" or "Not set up"); WhatsApp codes; Instagram app ("Set up, switch on", "Set up, switch off", "Not set up").

### Demo banner (SH.14)

When `switches.demoBanner` is true, `Layout`, `ArtistShell` and `AdminShell` show a thin strip at the top: "Test mode. No real payments are taken." It is not shown on the legal pages' print view.

## Mutation cases

| Mutation | Wrong role | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `issueRefund` | `forbidden` | Lines refunded by another Admin: `exceeds_paid` | Same `requestId` replays; new attempt refused by the reservation | Reserved, provider unknown: `unknown` | Check, then Retry | Dialog reloads from server |
| `checkRefund` / `retryRefund` | `forbidden` | Confirmed meanwhile: answers `issued` | Idempotent check; retry re-checks first | Provider error: stays `unknown` | Yes | List re-read |
| `build_payout_run` | `forbidden` | — | Idempotent for drafts; sent rows untouched | — | Safe | — |
| `record_payout` | `forbidden` | Refund since the draft: `rebuild` | `already_sent` | Run half recorded: each row stands alone; the page shows which are sent | Per row | Status from server |
| `update_fees`, `set_switch` | `forbidden` | Last write wins; the form reloads after saving | Idempotent | — | — | — |
| `grantAdmin`, `revokeAdmin` | `forbidden` | Already granted or already removed: no change | Idempotent | Auth role written, profile mirror failed: next call repairs (`setRoleFlag`) | Safe | List re-read |

## Steps

1. Migration and schema checks: search by code, email and payment id; each stage filter; payout status values; `refund_preview` equals what `reserve_refund` then does, before and after payout; the run day is always a 1st or 15th; stale drafts are removed; a reused reference is refused; fee bounds; switch keys; non-admins refused everywhere.
2. Edge commands; `fakeRz` answers the refunds-list path and can be told "refund exists" or "no refund".
3. `gateway.js` hooks and `RPC` entries.
4. Three pages and dialogs; routes `/admin/orders`, `/admin/payouts`, `/admin/settings`; shell links.
5. Demo banner in the three layouts.
6. `format.js`: `duplicate_reference`, `last_admin`, `rebuild`, `already_sent`, `artist_unverified`, `exceeds_paid`.

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/admin-orders.spec.js e2e/admin-payouts.spec.js e2e/admin-settings.spec.js
```

## Completion gate

- [ ] QA-S31-01, 02, 04, 05, 06, QA-S32-01 to 07, QA-S34-01 to 05 pass with the fake provider; QA-S31-03 is listed for Gate B (Razorpay test refund).
- [ ] A run recorded in QA leaves every paid-out order with a `payout_id`, each payout's net equal to the sum of its lines minus owed plus credit, and the Artist's Amount Owed and credit as the statement says.
- [ ] `integrationStatus` returns no secret value (checked by reading the response in QA-S34-05).
