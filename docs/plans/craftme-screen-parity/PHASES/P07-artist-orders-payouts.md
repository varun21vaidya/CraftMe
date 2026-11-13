# P07 Artist overview, order inbox and detail, payouts, Amount Owed payment, settings

**Goal.** Build the Artist's working screens: the overview (S21), the order inbox with stage tabs (S24), a full order page with address, packing, shipping and tracking edits (S25), payouts with statements and the Razorpay payment of an Amount Owed (S26, D10), and settings with verification status, payout details, email preferences and close shop (S28).

**Coverage.** All of S21, S24 (S24.i.06 text waits for P11), S25, S26, S28.

**Depends on.** P06 (shell), P01 (order shape, gift note, payment seam). **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD05, PD14, PD17, PD18, PD19.

**Glossary beats the mock here.** `GLOSSARY.md` says an Order is Shipped "optionally with a tracking number". The reference marks tracking as required. Tracking stays optional.

## Paths

Existing, to modify:

- `src/pages/ArtistInbox.jsx` (rebuilt as S24), `src/pages/ProfileEdit.jsx` (replaced by the settings page)
- `src/api/gateway.js` (`RPC.markShipped`, `useArtistInbox`, `allowedActions`), `src/api/checkout.js`
- `src/lib/format.js`, `src/lib/notifications.js` (targets to `/dashboard/orders/:id`, `/dashboard/payouts`), `src/App.jsx`
- `supabase/functions/api/index.ts` (`webhook`, new commands)
- `supabase/schema.test.mjs`

PROPOSED, to create:

- `supabase/migrations/0025_artist_money.sql`
- `src/pages/DashboardHome.jsx`, `src/pages/ArtistOrderPage.jsx`, `src/pages/PayoutsPage.jsx`, `src/pages/ArtistSettings.jsx`
- `src/components/dashboard/ShipDialog.jsx`, `StatementDialog.jsx`, `PayoutDetailsDialog.jsx`, `CloseShopDialog.jsx`, `OwedBanner.jsx`
- `src/lib/money.js` (`nextPayoutDate`, `mask`), `src/lib/money.test.js`
- `e2e/artist-orders.spec.js`, `e2e/payouts.spec.js`, `e2e/artist-settings.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `mark_shipped`, `payout_calc`, `commission_of`, `owed_after_refund`, `reserve_refund`, `_build_payout_run`, `record_payout`, `_set_standing`, `sweep`, `submit_verification` | `0003_logic.sql` | `_build_payout_run`, `record_payout`, `reserve_refund` are re-created to know about credit |
| `useArtistInbox`, `useOrder`, `call`, `saveProfile`, `upload`, `refreshClaims` | `src/api/gateway.js` | |
| `commands`, `markPaid`, `markFeePaid`, `webhook`, `setRoleFlag`, `requireRole` | `supabase/functions/api/index.ts` | |
| `rz`, `configured` | `supabase/functions/api/index.ts` | Fake branch from P00 |
| `payWithRazorpay`, `ConfirmingPayment` | `src/api/checkout.js`, P01 | Same uncertain-result pattern |
| `orderTimeline` | `src/lib/orderTimeline.js` (P01) | Artist wording variant |
| `ReelsManager`, `InstagramConnect` | `src/components/dashboard/` | Stay reachable at `/dashboard/instagram` until P08 |
| `Tabs`, `Pagination`, `Dialog`, `Timeline`, `StatTile`, `Chart`, `CopyButton`, `Field`, `useToast` | P00 | |
| `RULES` | `src/lib/rules.js` (P00) | |

## Migration `0025_artist_money.sql`

1. **Audit.** `create table public.audit_log (id uuid primary key default gen_random_uuid(), actor uuid, action text not null, target_type text not null, target_id uuid, note text not null default '', data jsonb not null default '{}', created_at timestamptz not null default now());` RLS on; Admins may select; no client writes. Used here for owed payments and shop closure, and by P09 and P10 for Admin decisions (PD16).
2. **Tracking.** `update_tracking(p_order uuid, p_courier text, p_tracking text)`: the order's Artist only, stage `shipped` only, same trimming and 60-character limits as `mark_shipped`; inserts a buyer notification `tracking_updated`.
3. **Counts and reads** (security definer, `auth.uid()` must be an Artist; each returns only that Artist's data):
   - `artist_order_counts() returns jsonb`: to ship, shipped, received, refunded, all (holds excluded).
   - `artist_dashboard() returns jsonb`: sales and order counts for this and last calendar month (Asia/Kolkata), to-ship and in-transit counts, the next payout date and its expected net (`payout_calc` over payable unpaid orders and the current Amount Owed), weekly paid and net totals for 26 weeks, the three stages of "coming up" orders.
   - `artist_payout_view() returns jsonb`: ready (`payout_calc` result), upcoming net, `amountOwed`, `owedSince`, the order that caused it, `credit`, lifetime paid and payout count, `verified`, masked destination and method.
   - `order_net(o public.orders) returns bigint` (stable, security invoker): `greatest(k - commission_of(k, coalesce(o.commission_bps, 0)) - o.gateway_fee, 0)` with `k = o.total - o.refunded_total`. PostgREST exposes it as a computed field, so any order read can ask for `order_net` (`select=*,order_net`). The money rule stays in SQL only; nothing re-implements it in JavaScript. Row access is still decided by `orders_read`.
4. **Payout record.** `alter table public.payouts add column destination text, add column credit_added bigint not null default 0;`
5. **Amount Owed payment (D10).**
   - `alter table public.artist_private add column credit bigint not null default 0 check (credit >= 0), add column email_prefs jsonb not null default '{"payout_sent": true}';`
   - `create table public.owed_payments (id uuid primary key default gen_random_uuid(), artist_id uuid not null references public.profiles(id), amount bigint not null check (amount > 0), razorpay_order_id text unique, razorpay_payment_id text unique, status text not null default 'pending' check (status in ('pending','paid','credited','expired')), applied bigint not null default 0, credited bigint not null default 0, created_at timestamptz not null default now(), settled_at timestamptz);` plus `create unique index owed_one_pending on public.owed_payments (artist_id) where status = 'pending';` RLS on; the Artist and Admins may select; no client writes.
   - `start_owed_payment(p_artist uuid) returns jsonb` (service role): locks the Artist's `artist_private` row. Nothing owed: `conflict` `nothing_owed`. A pending attempt younger than 15 minutes for the same amount is returned as is. An older or different one is set `expired`. Otherwise inserts a pending row for exactly `amount_owed`.
   - `settle_owed_payment(p_rz_order text, p_payment text, p_amount bigint) returns jsonb` (service role), one transaction: locks the attempt and the Artist's row. An attempt already `paid` or `credited` returns its stored result. `applied = least(p_amount, amount_owed)`; `amount_owed` falls by `applied`; `credit` rises by `p_amount - applied` (D10a: late, duplicate or excess money becomes credit, never a cash refund); `owed_since` is cleared at zero; status becomes `paid`, or `credited` when nothing was applied. If the balance is now zero and the Artist is restricted only for `owed_60_days`, call `_set_standing(artist, false, '')`. Write an `audit_log` row `owed_payment_settled` with the amounts.
6. **Credit in payouts and refunds.** Re-create `reserve_refund`: a new Amount Owed first uses up any `credit`. Re-create `_build_payout_run` and `record_payout`: the Artist's `credit` is added to the net, stored as `credit_added`, and set to zero when the payout is recorded; `record_payout` also stores the destination. The `rebuild` check compares net plus credit.
7. **Email preference.** `set_email_pref(p_key text, p_value boolean)`: only `payout_sent` may change (PD18).
8. **Close shop.** `artist_obligations(p_artist uuid) returns text[]` (callable by that Artist or an Admin): `open_orders` (Paid or Shipped), `open_reports`, `unpaid_payouts` (Received orders not yet paid out, or a draft payout), `amount_owed` (PD17). This is the same list account deletion needs for an Artist, so `deletion_blockers` (P04) calls it instead of repeating the four checks; whichever of P04 and P07 is built first creates it with `create or replace`, and the other reuses it. `close_shop(p_artist uuid)` (service role): fails `conflict` `shop_not_clear` with that list; otherwise ends every listing, sets every artwork `draft`, writes an audit row.
9. Revoke and grant as usual. To `authenticated`: `update_tracking`, `artist_order_counts`, `artist_dashboard`, `artist_payout_view`, `order_net`, `set_email_pref`, `artist_obligations`. `start_owed_payment`, `settle_owed_payment` and `close_shop` are for `service_role` only.

Edge Function:

| Command | Behaviour |
| --- | --- |
| `payAmountOwed` (Artist) | `configured()`, `start_owed_payment`, create a Razorpay order for exactly that amount if the attempt has none, store its id, return `{razorpayOrderId, keyId, amount}` |
| `confirmOwedPayment` (Artist) | Signature check as in `confirmPayment`, then `markOwedPaid` |
| `markOwedPaid` (shared with the webhook) | Ask Razorpay for the payment: captured, amount equal to the attempt, order id matches; then `settle_owed_payment` |
| `webhook` | Order id lookup order: Orders, then `fee_orders`, then `owed_payments` |
| `closeShop` (Artist) | `close_shop`, then `setRoleFlag(uid, meta, 'artist', false)` |

Rollout: schema test, apply `0025`, deploy the Edge Function, deploy the web app.

## Proposed interfaces

```js
// src/api/gateway.js: database commands (added to the RPC table, called with call(name, input))
RPC.markShipped    = (i) => ['mark_shipped',    { p_order: i.orderId, p_courier: i.courier, p_tracking: i.trackingNumber ?? '' }];   // unchanged
RPC.updateTracking = (i) => ['update_tracking', { p_order: i.orderId, p_courier: i.courier, p_tracking: i.trackingNumber ?? '' }];
RPC.setEmailPref   = (i) => ['set_email_pref',  { p_key: i.key, p_value: i.value }];
// Edge commands, called the same way (no RPC entry): 'payAmountOwed', 'confirmOwedPayment', 'closeShop'

// reads (each a use* hook on the private useQuery; tuple [data, loading, error, reload])
export const useArtistOrders = (uid, { stage, page }) => …   // orders + order_lines + order_shipping, 20 per page, count: 'exact'; never hold or hold_expired
export const useArtistOrder = (orderId) => …                 // one order for /dashboard/orders/:id; null when not this Artist's or a hold; polls 15 s
export const useArtistOrderCounts = (uid) => …               // rpc artist_order_counts -> { toShip, shipped, received, refunded, all }
export const useArtistDashboard = (uid) => …                 // rpc artist_dashboard
export const usePayoutView = (uid) => …                      // rpc artist_payout_view; polls 4 s while an owed payment is confirming
export const useMyPayouts = (uid) => …                       // payouts rows, newest first
export const usePayoutOrders = (payoutId) => …               // orders where payout_id = id, for the statement
export const useMyPayoutDetails = (uid) => …                 // the Artist's own artist_private row (the owner may already read it under artist_private_read); the page shows it through mask()
export const useCloseShopBlockers = (uid) => …               // rpc artist_obligations -> string[]

// allowedActions(o, 'artist', now) gains:
//   canEditTracking: o.stage === 'shipped'
```

```js
// src/lib/money.js
// no orderNet here: every order read selects the computed field order_net (SQL)
// no estimateNet here: pre-sale estimates come from earnings_estimate (P06)
export const nextPayoutDate = (now = new Date()) => Date                                  // next 1st or 15th in Asia/Kolkata; the run day itself counts until 09:00 IST
export const mask = (value, keepStart = 1, keepEnd = 0) => string                         // 'm•••@okhdfc', 'ABCDE••••F'; display only
```

```ts
// supabase/functions/api/index.ts
payAmountOwed       {}                                                 -> { razorpayOrderId, keyId, amount }   | conflict "nothing_owed" | unavailable "payments_not_configured"
confirmOwedPayment  { razorpayOrderId, razorpayPaymentId, signature }  -> { status: 'paid' | 'credited', applied, credited, amountOwed }
closeShop           {}                                                 -> {}                                    | conflict "shop_not_clear" { blockers: string[] }
async function markOwedPaid(rzOrderId: string, paymentId: string)      // shared by confirmOwedPayment and webhook(); idempotent
```

```sql
-- 0025_artist_money.sql (signatures; bodies are described under "Migration")
update_tracking(p_order uuid, p_courier text, p_tracking text) returns jsonb          -- authenticated; owner checked inside
artist_order_counts() returns jsonb                                                  -- authenticated, Artist only
artist_dashboard() returns jsonb
artist_payout_view() returns jsonb
order_net(o public.orders) returns bigint                                            -- computed field; anon has no grant
set_email_pref(p_key text, p_value boolean) returns jsonb
artist_obligations(p_artist uuid) returns text[]                                     -- authenticated; p_artist must equal auth.uid() unless Admin; shared with P04
start_owed_payment(p_artist uuid) returns jsonb                                      -- service_role: { id, amount, razorpayOrderId | null }
settle_owed_payment(p_rz_order text, p_payment text, p_amount bigint) returns jsonb  -- service_role: { status, applied, credited, amountOwed }
close_shop(p_artist uuid) returns jsonb                                              -- service_role
```

New `reason` values for `src/lib/format.js`: `nothing_owed`, `shop_not_clear`, and the blocker words `open_orders`, `open_reports`, `unpaid_payouts`, `amount_owed`. New notification type: `tracking_updated`.

## Authoritative state, transactions, time and idempotency

| Topic | Rule |
| --- | --- |
| Shipped | `mark_shipped`, one transaction, the order's Artist only, from Paid only. `shipped_at` is the server time (PD05). It cannot be undone. |
| What the Artist receives | `payout_calc` is the only rule: price minus refunds, minus commission on the price after refunds at the rate stored on the order, minus the whole gateway fee. Per-order figures on screen come from the SQL computed field `order_net`, which uses the same `commission_of`. Before payment, figures are estimates from `earnings_estimate` and say so. |
| Amount Owed | `artist_private.amount_owed`, changed only by `reserve_refund` (up), `record_payout` (down by deduction) and `settle_owed_payment` (down by payment). |
| Owed payment amount | Exactly the balance at the moment the attempt is created. No partial amounts. One pending attempt per Artist, enforced by a unique index. |
| Settlement | Only after Razorpay reports the payment captured for that amount and order. The browser's proof and the webhook both lead to the same idempotent function. |
| Late, duplicate, excess | Becomes credit, shown on S26 and added to the next payout, or used against a later Amount Owed (D10a). No refund is sent. |
| Gateway fee on the owed payment | CraftMe's cost. Nothing is added to the Artist's amount. |
| Attempt lifetime | 15 minutes for reuse. A capture on an older attempt still settles. |
| Uncertain result | The page shows "Confirming your payment…" and the balance read from the server. It never shows "failed" on its own guess. |
| Payout day | 1st and 15th, built by cron at 09:00 IST (`0005_cron.sql`). `nextPayoutDate` in the UI is the next of those two days. |

## UI specification

### S21 Overview, `/dashboard`

- Header: today's date, "Good morning/afternoon/evening, {first name}", "Here's what needs you today.", "View my shop", "Add Artwork".
- `S21.st.restricted`: error alert "Your shop is paused. You have a balance of ₹{owed} to clear. Your pieces are hidden for now and you can't take new orders. Please still post your {n} open orders." with "Clear my balance" (to `/dashboard/payouts#owed`). For a manual restriction the text is the Admin's reason and there is no balance button.
- `S21.st.owed` (owed but not restricted): warning alert "₹{owed} will be taken from your next payment. A customer was refunded for order {code} after you were paid." with "See details".
- Four `StatTile`s: Sales this month (with the change against last month, or no change line when last month was zero); Orders this month ("{n} to ship · {m} on the way"); Next payment, {date} (expected net; "On its way to you"); Rating (stars and review count, or "No Reviews yet").
- "Orders to ship {n}": table of the oldest five Paid orders (code, items, ship-by with "in {n} days" or "Overdue · was {date}", total, "Ship" or "Ship now" to the order page) and "All Orders".
- "Sales, last 8 weeks": `Chart` with two lines (Paid by Buyers, You receive) and a toggle "8 weeks / 6 months".
- "Coming up for payment": order, stage (Shipped, Settling in, Ready), when ("After Received + 3 days", the date), amount; link to Payouts.
- Aside: "Your shop" checklist (Shop opened; "We're checking your details so you can be paid." until verified; "Connect Instagram to show your reels" when not connected; "{n} Artworks are drafts. Publish them."), "Recent Reviews" (two newest approved), "Activity" (five newest notifications).
- A new Artist with nothing: tiles show ₹0 and 0, the tables are replaced by "No orders yet. Add your first Artwork to start selling." Loading: skeleton tiles. Error: alert with "Try again"; the page never shows zeros because a read failed.

### S24 Order inbox, `/dashboard/orders`

- Header: "Orders", "Ship within 7 days of payment. You see a Buyer's address once the Order is Paid."
- `Tabs` with counts, in `?tab=`: To ship (default), Shipped, Received, Refunded, All. Orders in `hold` or `hold_expired` never appear.
- Table (cards under 760 px): Order, Buyer ("Ananya V." and city, from the shipping row), Items, Paid, Ship by (To ship tab; overdue in the error colour, oldest deadline first), You receive, and "Ship", "Ship now" or "View". Below: "'You receive' is an estimate of what you will be paid for each order."
- `Pagination`, 20 per page.
- `S24.st.empty` (nothing to ship): "No Orders to ship. When a Buyer pays for one of your Listings, the Order appears here." with "Check my Listings". The words "and you get an email" are added by P11. Other empty tabs: "Nothing here yet."
- Loading: skeleton rows. Error: alert with "Try again".

### S25 Order, Artist view, `/dashboard/orders/:id`

Two columns over 900 px. An order that is not this Artist's, or is still a hold, shows the 404 page.

- `Breadcrumbs` Orders, {code}. Header: code, stage badge, "Paid {date, time} by {buyer short name}, {city}". Primary button: Paid: "Mark as Shipped". Shipped: "Edit tracking".
- Stage alert. Paid: "Ship by {date}, in {n} days. If it isn't Shipped by then the Order becomes Overdue and CraftMe reviews it. Late Orders are usually refunded to the Buyer, and that can count against you." (D05). Overdue: "This Order is overdue. Post it now and add the tracking." Shipped: "Shipped {date}. The Buyer confirms it arrived, or we do on {autoReceiveAt}. You are paid soon after." Received: "Received {date}." plus "In your {date} payment" or "Paid to you on {date}, reference {ref}". Refunded: "Refunded to the Buyer: ₹{amount}. {reason}".
- "Pack list": lines (photo, title, kind, unit price, quantity), "Buyer paid", the packing tip, and the gift note when present ("Gift note for the packing slip: …").
- "Shipment" (Shipped and later): courier, tracking with `CopyButton`, shipped date.
- "Timeline" from `orderTimeline` in the Artist's words.
- Aside "Ship to" (Paid, Shipped, Received only; the database hides it otherwise): "Only you see this", the address and phone, "Copy address", "Use this only to post this parcel. It's shown because the Order is Paid."
- Aside "What you receive": Buyer paid; Refunds (when any); CraftMe's share and payment cost; You receive; "You're paid on the next 1st or 15th after it arrives."
- **`S25.dlg.ship`.** "Mark as Shipped": Courier\* (DTDC, India Post, Delhivery, Blue Dart, Other; Other shows a text field), Tracking number (optional; "Add it if your courier gives one."), the note "The Buyer is notified and sees the tracking number. You can't undo 'Shipped', but you can edit the tracking." "Cancel" and "Mark as Shipped" ("Saving…"). "Edit tracking" opens the same fields with "Save tracking". `wrong_stage` on marking: the dialog closes, the page reloads, toast "This Order was already marked Shipped."

### S26 Payouts, `/dashboard/payouts`

- Header: "Payouts", "You're paid on the 1st and 15th for orders that have arrived."
- `S26.st.owed` (`id="owed"`): warning alert "₹{owed} will be taken from your next payment. A customer was refunded for order {code} after you were paid. You can also pay it now." with "Pay ₹{owed} now".
- Not verified: info alert "We're still checking your details. Payments start once that's done. Your Orders keep adding up."
- Four tiles: Ready for your {date} payment; Coming up ("On their way to customers"); To come off your next payment (₹0 or the Amount Owed); Paid to you so far ({n} Payouts). When credit is above zero, a line: "Credit of ₹{credit} will be added to your next payment."
- "In your {date} payment": Order, Received, Price, CraftMe's share, Payment cost, Refunds, You receive; a total row; with an Amount Owed two more rows, "Taken for the refund −₹{owed}" and "You're paid ₹{net}". Empty: "No Orders are ready for this payment yet."
- "Payout history": Date, Orders, Net, Sent to (masked), Reference, Status, "Statement". Empty: "No Payouts yet."
- **`S26.dlg.stmt`.** "Payout statement, {date}", "Reference {ref} · sent to {masked destination}". Rows per order: Price, Refunds, CraftMe's share, Cost, Net. Then total, "Amount Owed taken" and "Credit added" when not zero, and "Paid to you ₹{net}". Every figure comes from the stored payout and its orders; the total always equals the payout's net. The reference's sentence about rounding is not shown (A6).
- Aside "Next Payout": the date, "in {n} days", "Sent to {masked}", Method, "Change payout details" (to settings). Aside "How you're paid": the five lines of the rule.
- **Pay now (D10).** The button calls `payAmountOwed` and opens Razorpay for exactly the balance.

| Case | What the Artist sees |
| --- | --- |
| Paid | "Confirming your payment…", then the alert disappears, toast "Balance cleared.", and a shop paused for the balance reopens |
| Window closed | Nothing changes |
| Result uncertain (call failed after paying) | The confirming panel stays and re-checks every 4 seconds; after 30 seconds: "Your payment is safe. This page will update when it is confirmed." |
| `nothing_owed` (a payout cleared it meanwhile) | "Nothing is owed any more." and the page reloads |
| Money arrives when nothing is owed, or twice | The credit line appears: "₹{credit} is held as credit for you." |
| Payments not configured | The button is replaced by "Paying online isn't set up yet. The amount will be taken from your next payment." |

### S28 Artist settings, `/dashboard/settings`

- "Shop checks": a `Timeline` with Identity and PAN submitted ({date}), Phone verified ({masked}), Shop opened ({date}), and "CraftMe checks your details. You're paid once this is done." as the current step, or "Verified {date}" when done; the badge reads "CraftMe is checking" or "Verified".
- "Where we pay you": Legal name, PAN and Paid to shown through `mask()`, the lock note "Only you and CraftMe can see this. If you change it, payments wait until we have checked it again.", "Edit" opening **`S28.dlg.pay`**: warning "Payments wait until we have checked your new details.", method radios and the UPI or bank fields from P05, "Cancel", "Save and send for checking". Success: toast "Sent for checking", the timeline returns to checking.
- "Shop profile": photo ("Change photo", stored in the `avatars` bucket from P04), Display name, City, State, Bio (300, counter), Profile link: the prefix `{origin}/artist/` and an editable name field (3 to 30 lower-case letters, digits and hyphens; typed capitals are lower-cased), a `CopyButton`, and its own "Change link" button (PD22). Hint: "This short link opens your profile. If you change it, the old link stops working." Errors under the field: "Use 3 to 30 letters, numbers and hyphens.", "That name is taken." Success: toast "Profile link changed". Changing the display name does not change the link, "Save profile". Success: toast "Shop profile saved".
- "Notifications": "In-app notifications are always on. These control email." New Order (checked, disabled, "Required, so you never miss an Order to ship."), Payment sent (a working switch), Review approved (unchecked, disabled, "Coming in a later release.") (PD18). Until P11 ships, a note says "Emails start soon."
- "Close my shop": the reference text, then the button. Disabled while anything blocks it, with the reason in words ("3 Orders still need shipping.", "A Payout is still to come.", "₹{owed} is still owed.", "A Damage Report is open."). Enabled: opens `CloseShopDialog` (alert dialog): "Close your shop? All your Listings end and you stop being an Artist. Your Buyer account stays. The payment to open your shop isn't refunded.", "Keep my shop", "Close my shop". Success: claims refreshed, redirect to `/profile`, toast "Your shop is closed."
- Aside "Account status": Role (Artist, Buyer), Shop (Open, Paused), Instagram (Connected, Not connected), link "Artist agreement".
- A restricted Artist can still edit payout details and profile text; publishing is blocked elsewhere.

## Steps

1. Migration and schema checks: `update_tracking` only when Shipped and only by the Artist; the read functions return only the caller's data; an owed payment settles once, a repeat returns the same result, a larger amount leaves credit, a payment with nothing owed is all credit, settling lifts only an owed-based restriction; one pending attempt per Artist; credit is consumed by a later refund-after-payout and added to the next payout; `record_payout` still refuses a stale draft; `close_shop` refuses each blocker; `order_net` for one order equals `payout_calc(array[that order], 0).net` for no refund, a partial refund, a full refund and a fee larger than the remainder.
2. Edge commands and webhook routing.
3. `src/lib/money.js` (`nextPayoutDate`, `mask`) with tests.
4. `gateway.js`: `RPC.updateTracking`, `RPC.setEmailPref`, hooks `useArtistOrders({stage, page})`, `useArtistOrderCounts`, `useArtistDashboard`, `usePayoutView`, `useMyPayouts`, `usePayoutOrders(payoutId)`, `useMyPayoutDetails`.
5. Build the four pages and the dialogs; routes `/dashboard`, `/dashboard/orders`, `/dashboard/orders/:id`, `/dashboard/payouts`, `/dashboard/settings`; `/dashboard/instagram` keeps `ReelsManager` until P08.
6. Update notification targets.
7. `format.js`: `nothing_owed`, `shop_not_clear`, and blocker wording.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `mark_shipped` | Other Artist: `forbidden` | Refunded or shipped meanwhile: `wrong_stage`, page reloads | Second call `wrong_stage`, shown as already done | None | Safe | Stage from server |
| `update_tracking` | Other Artist: `forbidden` | Received meanwhile: `wrong_stage` ("This Order has already arrived.") | Idempotent | None | Safe | — |
| `payAmountOwed` | Artist only | Balance changed since the page loaded: the command returns the real amount; if it differs, the page asks to confirm before opening the window | Pending attempt reused | Attempt made, Razorpay order failed: retry reuses the attempt | Yes | Balance from server |
| `confirmOwedPayment` / webhook | Attempt must belong to the caller | Already settled: stored result | Idempotent | Provider read failed: retried; webhook also settles | Same `requestId` | Confirming, then cleared |
| `submit_verification` (payout edit) | Own row | — | Idempotent | — | Dialog keeps values | Timeline from server |
| `set_email_pref` | Own row | Last write wins | Idempotent | Switch flips back on failure with an error toast | — | — |
| `closeShop` | Artist only | A new order arrived: `shop_not_clear` with the reason | Second call: role already gone, treated as done | Listings ended but role removal failed: next call finishes (both steps are idempotent) | Yes | Role from refreshed claims |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/artist-orders.spec.js e2e/payouts.spec.js e2e/artist-settings.spec.js
```

## Completion gate

- [ ] QA-S21-01 to 04, QA-S24-01 to 03, QA-S25-01 to 06, QA-S26-01 to 03 and 05 to 08, QA-S28-01 to 06 pass; QA-S26-04 passes with the fake provider and is listed for Gate B with Razorpay test keys.
- [ ] `docs/adr/0004-craftme-collects-and-pays-artists.md` already records D10 (uncommitted edit at baseline); confirm it is committed.
- [ ] No Artist page shows a rupee figure that is not read from the server or labelled "estimate".
