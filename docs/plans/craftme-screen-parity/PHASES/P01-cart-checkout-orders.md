# P01 Cart, checkout, payment and the buyer's order pages

**Goal.** Close the buyer's path from Cart to a confirmed Order: price-change review, the whole-group cart switch (D07), the full address form with a saved address, hold resume and expiry, an honest "confirming" state while payment is uncertain, the order-placed page, order history and the order detail page.

**Coverage.** S03.st.cart-clash, S03.dlg.newcart, S03.i.06, all of S08, S09, S10, S11 (except S11.i.03), S12, S13 (except i.13, i.14), SYS.03.

**Depends on.** P00. **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD04, PD08, PD14.

## Paths

Existing, to modify:

- `src/contexts/cart.js`, `src/contexts/cart.test.js`, `src/contexts/CartContext.jsx`
- `src/components/cart/CartConflictDialog.jsx`
- `src/pages/CartPage.jsx`, `src/pages/CheckoutPage.jsx`, `src/pages/OrdersPage.jsx`, `src/pages/OrderPage.jsx`
- `src/pages/WishlistPage.jsx` (`addAll`), `src/pages/ArtworkPage.jsx` (Buy now)
- `src/api/gateway.js`, `src/api/checkout.js`, `src/lib/format.js`, `src/App.jsx`
- `supabase/functions/api/index.ts`, `supabase/schema.test.mjs`

PROPOSED, to create:

- `supabase/migrations/0019_checkout.sql`
- `src/components/orders/OrderPlaced.jsx`, `StageTracker.jsx`, `OrderItems.jsx`, `ConfirmReceivedDialog.jsx`, `OrderReceipt.jsx`
- `src/components/checkout/AddressFields.jsx`, `OrderSummary.jsx`, `HoldTimer.jsx`, `ConfirmingPayment.jsx`
- `src/lib/orderTimeline.js`, `src/lib/orderTimeline.test.js`, `src/lib/address.js` (state list, validation), `src/lib/address.test.js`
- `e2e/cart.spec.js`, `e2e/checkout.spec.js`, `e2e/orders.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `cartReducer`, `emptyCart`, `parseCart`, `serializeCart`, `MAX_QTY` | `src/contexts/cart.js` | Extend, keep the shape `{artistId, items, conflict}` |
| `useCart` (`add`, `setQty`, `remove`, `clear`, `restore`, `startNewCart`, `dismissConflict`, `pending`, `locked`, `retry`, `message`, `saved`) | `src/contexts/CartContext.jsx` | The journal `cm-cart-operation:<uid>` and `run()` stay as they are |
| `switchSavedCart`, `useSavedCart`, `useListingsByIds`, `useOrder`, `useMyOrders`, `call`, `allowedActions`, `toOrder`, `ORDERS` | `src/api/gateway.js` | |
| `payWithRazorpay` | `src/api/checkout.js` | |
| `useCountdown` | `src/lib/useCountdown.js` | |
| `formatINR`, `formatClock`, `formatDate`, `STAGE_LABEL`, `errorText` | `src/lib/format.js` | Add reasons listed below |
| `cartAction`, `buyable`, `groupByArtist` | `src/lib/wishlist.js` | For the group add |
| `commands.placeOrder`, `commands.confirmPayment`, `markPaid`, `webhook`, `claim`, `ADDR` | `supabase/functions/api/index.ts` | |
| `place_order`, `expire_hold`, `mark_paid`, `refund_oversold`, `confirm_received`, `_set_received`, `sweep`, `switch_saved_cart` | `0003_logic.sql`, `0017_saved_cart.sql` | |
| `Dialog`, `Toast`, `Stepper`, `Timeline`, `Tabs`, `Pagination`, `Breadcrumbs`, `CopyButton`, `Field`, `QtyStepper` | P00 | |

## Migration `0019_checkout.sql`

Additive. The deployed web app and Edge Function keep working after it is applied.

1. `alter table public.order_shipping add column address2 text not null default '', add column landmark text not null default '';` with length checks of 300 and 120.
2. `alter table public.orders add column gift_note text not null default '' check (char_length(gift_note) <= 120), add column payment_method text;`
3. `create table public.saved_addresses (user_id uuid primary key references public.profiles(id) on delete cascade, name text not null, phone text not null check (phone ~ '^[6-9][0-9]{9}$'), address text not null, address2 text not null default '', landmark text not null default '', city text not null, state text not null, pin text not null check (pin ~ '^[0-9]{6}$'), updated_at timestamptz not null default now());` RLS on. Policies: select, insert, update, delete where `user_id = auth.uid()`. Grants to `authenticated`: select, delete, and insert and update on every column except none hidden. `grant all` to `service_role`. No grant to `anon`.
4. `create or replace` `place_order` with its **existing signature** `(p_buyer uuid, p_artist uuid, p_lines jsonb, p_address jsonb)`. Same body, plus three optional keys read from `p_address`: `address2`, `landmark` (stored on `order_shipping`), `note` (stored as `left(btrim(note), 120)` in `gift_note`) and `save` (boolean; when true, upsert `saved_addresses` in the same transaction). Returns the same object plus `'serverNow', now()`. Nothing is dropped, so the deployed Edge Function keeps working unchanged.
5. `mark_paid` is **not changed**. The payment method is display data, not money: `markPaid` in `index.ts` writes `orders.payment_method` with a plain update right after `mark_paid` returns, the same way `placeOrder` already writes `razorpay_order_id`.
6. No `received_by` column and no change to `_set_received`, `confirm_received` or `sweep`. Whether an Order was received automatically is derived: `received_at >= auto_receive_at`. (A Buyer who confirms in the few minutes between the 14-day mark and the next sweep is labelled automatic, which is harmless.)
7. `create function public.my_order_counts() returns jsonb` (security invoker, `auth.uid()`): counts of the caller's orders for `paid`, `shipped`, `received`, `refunded`, and the total excluding `hold_expired`.
8. `create function public.switch_saved_cart_many(p_buyer uuid, p_operation uuid, p_active jsonb, p_add uuid[]) returns jsonb` (security definer). Under the same advisory lock and the same `saved_cart_operations` replay as `switch_saved_cart`: checks that every `p_add` listing belongs to one artist; moves outgoing lines from other artists into `saved_cart_items` (adding quantities); returns `{artistId, items, skipped: [{listingId, reason}]}` where reason is `sold`, `held`, `own` or `gone`, and `items` holds each eligible listing at quantity 1 merged with any active lines of the same artist.
9. For every new function: `revoke execute ... from public, anon, authenticated; grant execute ... to service_role;` then grant `my_order_counts` and `switch_saved_cart_many` to `authenticated`. A new function is executable by everyone until revoked; `0003_logic.sql` revoked only the functions that existed then.

Rollout: schema test, apply `0019`, deploy the Edge Function, deploy the web app. Any order of the last two is safe.

## Proposed interfaces

```js
// cart.js: an item may carry the unit price the buyer last saw
{ listingId, qty, seen?: number }                 // paise; absent means "not yet compared"
dispatch({ type: 'ADD', artistId, listingId, price })
dispatch({ type: 'ACCEPT_PRICES', prices: { [listingId]: paise } })
dispatch({ type: 'REMOVE_MANY', listingIds })

// CartContext.jsx
addMany(artistId, listings /* [{id, price, title}] */, { then })   // D07: one dialog, then one switch_saved_cart_many
buyNow(artistId, listing)                                          // add (or switch), then navigate('/checkout')

// gateway.js
export const switchSavedCartMany = (uid, operation) => …           // rpc switch_saved_cart_many
export const useSavedAddress = (uid) => …                           // saved_addresses row or null
export const saveAddress = (uid, fields) => …                       // upsert; also used by P04
export const useMyOrders = (uid, { stage, page }) => …              // 20 per page, count: 'exact'
export const useMyOrderCounts = (uid) => …                          // rpc my_order_counts
export const useOrder = (id) => …   // select adds order_shipping(*), refunds(*), damage_reports(id,status,created_at,decided_at,decision,line_ids), artist:profiles!artist_id(id,display_name)
```

```ts
// index.ts commands
placeOrder   input adds { note?: string, saveAddress?: boolean, address: {…, address2?, landmark?} }   // folded into p_address as note / save
             output adds { serverNow: number, code: string }
resumeHold   { orderId } -> { orderId, razorpayOrderId, keyId, amount, holdUntil, serverNow, code } | conflict "not_found" | conflict "hold_over"
cancelHold   { orderId } -> {}                    // owner only; calls expire_hold(p_force => true)
```

`ADDR` gains `address2: /^[\s\S]{0,300}$/` and `landmark: /^[\s\S]{0,120}$/`.

## Authoritative state, transactions, time and idempotency

| Topic | Rule |
| --- | --- |
| Who decides an Order is Paid | Only `mark_paid`, called by `markPaid` after it asks Razorpay for the payment and sees `captured`, the exact order total and the matching Razorpay order id. The browser's proof and the webhook event only trigger that check. |
| Stock | `listings.held` rises inside `place_order` (row locks in listing-id order). `mark_paid` moves held to sold. `expire_hold` gives it back. All three are single transactions. The checks `held <= stock` and `stock >= 0` make an oversell impossible. |
| Price | The server price at `place_order` time is the price of the Order. The Cart shows a preview. The client sends the price the buyer accepted as `seenUnitPaise`; a difference fails with `price_changed` and nothing is held. |
| Hold length | `hold_until = now() + 15 minutes` on the database clock. The page counts down against `holdUntil` corrected by `serverNow` so a wrong device clock does not matter. At zero the Pay button is disabled even if the sweep has not run. |
| Between expiry and the sweep (up to 5 minutes) | The stage is still `hold` and the stock is still held. A payment captured in that gap is accepted as a normal payment. |
| After the sweep | Stage `hold_expired`. A late capture is accepted if the stock is still free; otherwise `oversold`, an automatic full refund, stage `refunded`, reason `sold_during_payment`. |
| Repeat submission of "Pay" | The page keeps one `requestId` per attempt in a ref and reuses it on a network retry. `claim()` replays a finished result and answers `in_progress` while the first is running. The button is disabled while submitting. |
| Repeat payment events | `processed_events` drops a repeated webhook. `mark_paid` returns the current stage for a paid, shipped, received or refunded order and changes nothing. |
| Partial failure: hold made, Razorpay order creation fails | Already handled: `expire_hold(p_force)` releases the stock and the buyer sees `payments_down`. |
| Partial failure: paid at Razorpay, `confirmPayment` fails or times out | The Order becomes Paid by the webhook or by a retry. The page shows "Confirming your payment", never an error, until the stage is known. |
| Cart switch | `switch_saved_cart` and `switch_saved_cart_many` run under a per-buyer advisory lock and replay by `operation_id`. The journal in `localStorage` re-runs an unfinished switch after a reload. |
| When the Cart is emptied | Only when the Order's stage is `paid` or later, as read from the server. |

## UI specification

### S08 Cart

Layout: `.split`; lines left, sticky summary right; one column under 900 px with the summary below the lines.

- **Header.** "Your Cart", then "N items from one Artist. Prices include shipping within India." and a "Keep browsing" link.
- **Artist group.** Avatar or initials, name, rating when present, "ships within 7 days" (`RULES.shipDays`), "View Artist" link. City appears once `profiles.city` exists (P03).
- **Line.** Photo link, title link, kind and size, stock text ("12 in stock", or "Only 1 available" for an Original), `QtyStepper` with `max = min(stock - held, 10)` and `max = 1` for an Original, Remove, line total, unit price. Decreasing below 1 removes the line. The stepper's plus is disabled at the cap with the hint "That's all there is."
- **Price changed** (`S08.st.price-changed`). When a line's `seen` differs from today's price: an alert with `role="alert"`, title "Some things changed since you added them", one sentence per line ("Kolam at Dawn (Print) went from ₹2,200 to ₹2,400."), and "Accept new prices". Each changed line shows a "Price changed" badge, the old price struck through and the new one. Checkout is disabled until accepted. Accepting dispatches `ACCEPT_PRICES` and fires the toast "New prices accepted".
- **Sold or gone line.** A listing that is `null`, `sold`, `ended` or `draft` after loading is removed from the Cart and named in the same alert: "Monsoon Over Marina (Original) was Sold to another Buyer and was removed." A listing that is live but fully held shows a badge "Being bought by someone else right now" and blocks Checkout without being removed.
- **Summary.** Items (count), "Shipping within India: Included", Total, Checkout button (an `aria-disabled` link when not ready), the two trust lines, and the gift note field (120, counter, "Shown on the packing slip"). The note is kept in cart state and sent with the order.
- **Empty** (`S08.st.empty`). Existing empty state; Saved for later stays below it.
- **Saved for later** (KD03). Unchanged behaviour. Buttons become `.btn` styles and its messages become `role="status"` text plus a toast on success.
- **Loading.** Lines show a skeleton until `useListingsByIds` answers. **Error.** "We couldn't load your Cart. Try again." with a retry button; Checkout disabled.

### Cart switch dialog (D07)

`CartConflictDialog` on `Dialog`. Title "Start a new Cart?". Body: "Your Cart has work from {outgoing artist}. Each Order is one parcel from one Artist. If you switch, everything in this Cart moves to Saved for later." For a group add it adds "{n} works by {artist} will be added." Buttons "Keep my Cart" and "Switch Cart" (saving label "Switching…", "Try again" after a failure). Escape and "Keep my Cart" change nothing. After a group switch a `role="status"` line and a toast report "{n} added. {m} skipped: sold, already in your Cart, or a version must be chosen." "Buy now" uses the same dialog and goes to `/checkout` only after the switch succeeds.

### S09 Checkout

Layout: `.split`; form left, summary right; under 900 px the summary moves above the Pay button.

- `Breadcrumbs` Cart, Checkout. `Stepper` Address, Pay, Done.
- **Address fields**, in order: Full name\*, Phone\* with a fixed "+91" prefix (`inputMode="numeric"`, 10 digits), Address line 1\*, Address line 2, Landmark, PIN code\* (6 digits), City\*, State\* (select from `src/lib/address.js`), "Save this address to my profile" (checked by default when no saved address exists). Autocomplete tokens as in the reference. Prefilled from `useSavedAddress`.
- **Errors** (`S09.st.error`). On submit with errors: an alert at the top, "Fix N things before paying", listing the field labels as links that focus the field; focus moves to the alert. Each field shows its own message ("Enter a 10-digit mobile number.", "PIN codes have 6 digits.", "Choose your State."). Server `invalid` with `fields` marks the same fields.
- **Notices.** "CraftMe delivers within India only. Your address is shared with {artist} only after payment, to post your parcel."
- **Payment.** One sentence and the method names as text. Checkbox "I agree to the Terms and Refund policy" with links to `/legal/terms` and `/legal/refunds`; required; its error is "You need to agree to continue."
- **Pay button.** "Pay ₹{total}". While placing: "Holding your pieces…". While the window is open: "Waiting for payment window…".
- **Summary.** Hold timer ("Almost yours", `mm:ss`, "Finish paying in time to keep these pieces.") once a hold exists; "Your Order", "Edit Cart" link, artist name, lines, Items, Shipping Included, Total.
- **Held.** After `placeOrder` succeeds the address fields become read-only. Two actions: "Pay ₹{total}" and "Change address or Cart", which calls `cancelHold` and unlocks the form.
- **Resume.** On mount the page looks for the buyer's open hold (stored order id in `localStorage['cm-pending-order:<uid>']`, checked with `resumeHold`). If one exists and its lines equal the Cart, the page opens in the Held state. If the Cart differs, a notice offers "Continue paying for that Order" or "Cancel it and use my Cart".
- **Expired** (`S09.st.expired`). Alert "These took too long to pay for. The pieces went back on the wall. They're still in your Cart. Check they're available, then pay." with "Return to Cart"; Pay disabled.
- **Not configured.** `payments_not_configured`: alert "Payments aren't set up on this site yet." Pay disabled. No hold is made.
- **Too many holds.** `too_many_holds`: existing text, plus a link to My orders.

### S10 Payment window and the uncertain state

The window is Razorpay's. CraftMe sets `description` to "Order {code}", prefills name, email and phone (KD10), and handles three outcomes:

| Outcome | What the buyer sees |
| --- | --- |
| Proof returned | `ConfirmingPayment`: a panel with a spinner, "Confirming your payment…", `aria-live="polite"`. It calls `confirmPayment` with a fixed `requestId` and polls the order every 4 seconds. On `paid`: clear the Cart, go to `/orders/:id?placed=1`. |
| `confirmPayment` answers `unavailable`, `internal`, `in_progress`, or the network fails | Stay on the confirming panel. Retry the same `requestId` after 2, 4 and 8 seconds. After 30 seconds add: "This is taking longer than usual. Your payment is safe. You can leave this page; your Order will show the result." with a link to the order page. No "failed" wording. |
| `sold_during_payment` | "It sold while you were paying. Your money is being returned." with a link to the order, which shows the refund. The Cart keeps its other lines. |
| `bad_signature`, `amount_mismatch` | "We couldn't confirm that payment. If money left your account, it will be returned." Link to the order page; the hold stays until it expires. |
| Window dismissed | Back to the Held state, timer still running, no message beyond the timer. |
| Checkout script fails to load | Alert "We couldn't open the payment window. Check your connection and try again." Held state stays. |

### S11 Order placed

`OrderPage` with `?placed=1`:

- Stage `paid` or later: `OrderPlaced`. `Stepper` at Done. A `role="status"` header "Thank you, {first name}. Your Order is Paid.", the order code with `CopyButton`, "What happens next" as a `Timeline` using `paidAt`, `shipBy`, `RULES.autoReceiveDays`, `RULES.reviewDays`, the payment method when known, the recap (lines, Paid total, Ship to, From), and the buttons "View Order" (same URL without the query) and "Keep browsing". No email sentence until P11.
- Stage `hold`: the confirming panel.
- Stage `hold_expired` or `refunded`: the normal order page (no success header).

### S12 My orders

`Tabs` with counts from `useMyOrderCounts`: All, To be shipped (`paid`), Shipped, Received, Refunded; the tab is kept in `?tab=`. An open hold is shown above the tabs as an alert with "Finish paying" (to `/checkout`). Expired holds are not listed. Each row: code, stage badge, placed date, total, first photo, items with quantities, "From {artist}", and a hint by stage (ship-by date; tracking number; "Received {date}" or "Reviewed"; "₹{refunded} refunded"). Actions: "View Order"; "Mark Received" for a shipped order (opens `ConfirmReceivedDialog`); "Write a Review" when `buyerActions.canReview`. `Pagination`, 20 per page. Loading: three skeleton rows. Error: alert with "Try again". Empty history: "No Orders yet" with "Browse art". Empty tab with other orders present: "Nothing in this stage."

### S13 Order detail

Two columns over 900 px (main and a 320 px aside), one below.

- **Header.** `Breadcrumbs`, code, stage badge, "Placed {date} · From {artist link}", "Receipt" (opens `/orders/:id/receipt`, a print-styled page: lines, totals, payment reference, ship-to; PD08).
- **StageTracker.** Paid, Shipped, Received as a `Stepper`; a refunded order keeps the steps it reached.
- **Stage message.**
  - Paid: "{Artist} is preparing your Order. They have until {shipBy} to ship it. If they don't, CraftMe reviews the Order and usually refunds you in full." (D05). When `overdue`: "This Order is late. CraftMe is reviewing it. Late Orders are usually refunded in full."
  - Shipped: "On its way, shipped {date}. Tap 'I've received it' when it arrives. If you don't, we'll mark it Received on {autoReceiveAt}."
  - Received: "It arrived. Enjoy it." and, while `canReportDamage`, "Something not right? Tell us by {damageWindowEnds}."
  - Refunded or partly refunded: by refund status. `issued`: "Your ₹{amount} refund was issued on {date}. It goes back to your original payment method." `pending` or `unknown`: "Your ₹{amount} refund is being processed. We'll update this page."
  - Hold: "Waiting for your payment. We're keeping your pieces for {mm:ss}." with "Finish paying". At zero it changes at once to "The time to pay ran out. Your pieces went back on the wall." with "Return to Cart".
- **Items.** Photo, title link, kind, quantity, unit price, line total; a refunded line shows "Refunded ₹{amount} · {quantity} of {quantity}". Total paid; "Refunded −₹{refundedTotal}" when above zero.
- **Shipment** (shipped and later). Courier, tracking number with `CopyButton`, shipped date.
- **Refund** (one block per `refunds` row). Reason, amount and lines, issued date or "Processing".
- **Timeline.** From `orderTimeline(order)`, newest first: paid, waiting to ship with the deadline, shipped, waiting to confirm with the auto date, received ("you confirmed" or "marked Received automatically"), damage reported, damage decided, each refund.
- **Actions.** "I've received it" opens `ConfirmReceivedDialog` ("Confirm it arrived? Only confirm if the parcel is in your hands. You can then review {artist}.", buttons "Not yet" and "Yes, it arrived"; while saving the primary reads "Saving…"; on `wrong_stage` it closes and reloads the order). "Something not right?" links to `/orders/:id/damage`. "Review {artist}" links to `/orders/:id/review`. Until P02 ships those two routes, the existing inline forms stay. A disabled "Cancel Order" for a Paid order with "Orders can't be cancelled once Paid. If you need a change, contact CraftMe and we'll ask {artist}." "Contact CraftMe" links to `/legal/contact` (P04); before P04 it is hidden.
- **Aside.** "Ship to" (name, lines, landmark, city, PIN, state, phone). "Payment": method when known, payment reference.
- **Not found or not yours.** The existing "We couldn't find this order" for both, so nothing is revealed. **Network error.** "We couldn't load this Order. Try again."

## Steps

1. Write `0019_checkout.sql` and add it to the `migrations` array in `supabase/schema.test.mjs`. Add checks: address2, landmark and note are stored; `p_save_address` writes the saved address; another user cannot read it; `my_order_counts` counts only the caller's orders; `switch_saved_cart_many` saves outgoing lines once, reports skipped listings, and replays by operation id; an Order received by the sweep has `received_at >= auto_receive_at` and one confirmed early does not; the old four-key address still places an order.
2. Edge Function: extend `ADDR` and `placeOrder`; add `resumeHold` and `cancelHold` (owner check, then `expire_hold` with `p_force`); store the payment `method` after `mark_paid`.
3. `cart.js`: `seen` on items, `ACCEPT_PRICES`, `REMOVE_MANY`; `parseCart` keeps an integer `seen`. Update `cart.test.js`.
4. `CartContext.jsx`: `addMany` and `buyNow`; pending-order key handling (set on hold, cleared on paid, expired or cancelled); on mount, if the pending order is paid, clear the Cart.
5. `gateway.js`: the interfaces above. `allowedActions` is unchanged.
6. Rebuild `CartPage.jsx`, `CheckoutPage.jsx`, `OrdersPage.jsx`, `OrderPage.jsx` to the specification, splitting into the proposed components. Keep `HeldPayment`'s behaviour inside the new Held state.
7. `WishlistPage.jsx` `addAll`: call `addMany` with every `cartAction(...).kind === 'add'` listing; report skipped works. `ArtworkPage.jsx`: add "Buy now" next to "Add to Cart" (full quantity stepper arrives in P03).
8. `format.js`: add `payments_not_configured`, `hold_over`, `fake_mode_in_production`, and a `REFUND_STATUS_LABEL`.
9. Write the end-to-end specs.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `placeOrder` | Buyer is the artist: `own_listing` | Price moved: `price_changed`, Cart shows the review; stock gone: `sold` with the listing id | Same `requestId` replays; a second click is disabled | Razorpay order fails: stock released, `payments_down` | New attempt gets a new `requestId` after a definite answer | Open hold is resumed |
| `confirmPayment` | Other buyer: `forbidden` | Order already paid by webhook: returns the stage | Replays | Provider read fails: `unavailable`, key freed, page keeps confirming | Same `requestId`, backoff | `/orders/:id?placed=1` shows confirming, then success |
| `cancelHold` | Other buyer: `forbidden` | Hold already expired: returns ok | Idempotent | — | Safe | Form unlocked |
| `confirm_received` | Other buyer or artist: `forbidden` | Auto-received meanwhile: `wrong_stage`, page reloads to Received | Second call `wrong_stage`, treated as success | — | Safe | Stage read from server |
| `switch_saved_cart_many` | `p_buyer` not the caller: error 42501 | Listing sold meanwhile: in `skipped` | Replay by operation id | Journal re-runs after reload | "Try again" in the dialog | Journal |
| `saveAddress` | RLS: own row only | Last write wins | Idempotent | Order still placed if the profile save is refused (it is inside `place_order`, so it cannot fail separately) | — | — |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/cart.spec.js e2e/checkout.spec.js e2e/orders.spec.js
```
```bash
npm run lint
```
```bash
npm run build
```

## Completion gate

- [ ] QA-S03-05, QA-S03-06, QA-S08-01 to 09, QA-S09-01 to 09, QA-S10-03 to 08 (fake provider), QA-S11-01 to 03, QA-S12-01 to 04, QA-S13-01 to 08 and 10, QA-SYS-03 pass.
- [ ] QA-S10-01, 02 are listed as waiting for Gate B (Razorpay test keys).
- [ ] The schema test count has grown and is green.
- [ ] No buyer-facing sentence promises an email (checked by QA-S35-06 later; grep for "email" in the four pages now).
