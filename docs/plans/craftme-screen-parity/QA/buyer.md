# QA scripts: Cart, checkout, payment, orders, damage, review

Format, fixtures and defaults are in [README.md](README.md). "Fake window" is the local test payment dialog with Pay, Fail and Close (P00).

## S08 Cart

### QA-S08-01 Cart with items
Covers: S08, S08.st.default, S08.i.01, i.02, i.05, i.06 · Type: e2e (`e2e/cart.spec.js`) · Role: B1 · Route: `/cart` · View: all
Setup: Cart holds W2 Print ×2 and W1 Print ×1.
Do: 1. Read the page. 2. Type a 121-character gift note, then "Happy birthday". 3. Reload.
See: "3 items from one Artist…", the Artist block for Meera Iyer with "View Artist", two lines with kind, stock and prices, Items (3) ₹6,900, "Shipping within India: Included", Total ₹6,900, an enabled Checkout, the one-Artist note. The note field stops at 120 and its text survives the reload. At 375 px the summary sits under the lines.
Data: Nothing on the server; the Cart and note are in `localStorage`.

### QA-S08-02 Empty Cart
Covers: S08.st.empty · Type: e2e (`e2e/cart.spec.js`) · Role: B2 · Route: `/cart`
See: "Your Cart is empty" with "Browse art", and "Saved for later" below with "No items saved for later." Opening `/checkout` redirects to `/cart`.
Data: none.

### QA-S08-03 Price changed and a sold line
Covers: S08.st.price-changed, S08.i.04 · Type: e2e (`e2e/cart.spec.js`) · Role: B1 · Route: `/cart`
Setup: Cart holds W2 Print ×2 (seen ₹2,200) and W1 Original ×1. Then: `update listings set price = 240000` for W2 Print, and mark W1 Original `sold` with stock 0.
Do: 1. Open the Cart. 2. Try Checkout. 3. Press "Accept new prices". 4. Press Checkout.
See: Step 1: alert "Some things changed since you added them": "Kolam at Dawn (Print) went from ₹2,200 to ₹2,400." and "Monsoon Over Marina (Original) was Sold to another Buyer and was removed."; the Original line is gone; the Print line shows "Price changed", ₹2,200 struck through, ₹2,400 each; total ₹4,800. Step 2: Checkout is disabled. Step 3: toast "New prices accepted", alert gone. Step 4: `/checkout`.
Data: The stored Cart item has `seen: 240000`. A line that is live but fully held by another buyer is not removed and shows "Being bought by someone else right now".

### QA-S08-04 Quantity limits
Covers: S08.i.03, S08.i.07 · Type: unit (`src/contexts/cart.test.js`) and e2e · Role: B1 · Route: `/cart`
Setup: Cart holds W2 Print ×1 (stock 12) and W8 frame ×1 (stock 5).
Do: 1. Press plus on the frame until it stops. 2. Press plus on the Print until it stops. 3. Press minus on the frame down to zero.
See: The frame stops at 5, the Print at 10, each with "That's all there is." An Original line has no stepper. At zero the frame line disappears. The unit price and line totals follow.
Data: Unit test: `SET_QTY` clamps to 1–10 and removes below 1.

### QA-S08-05 Saved for later: restore a group and one item
Covers: S08.i.08, KD03 · Type: e2e (`e2e/cart.spec.js`) and schema · Role: B1 · Route: `/cart`
Setup: Saved for later holds W2 Print ×3 and W1 Print ×1 (A1). The active Cart holds W6 (A2).
Do: 1. Press "Move to cart" on W1 Print, confirm "Switch Cart". 2. Press "Restore cart" on the remaining group.
See: Step 1: the dialog names Imran Sheikh; afterwards the Cart holds W1 Print and Saved for later holds W6 and W2. Step 2: the Cart holds W1 Print ×1 and W2 Print ×3.
Data: `saved_cart_items` matches the page after each step; quantities are never doubled.

### QA-S08-06 Restore past the quantity cap, and an unavailable saved work
Covers: S08.i.09 · Type: schema and e2e · Role: B1 · Route: `/cart`
Setup: Saved: W2 Print ×8. Active: W2 Print ×5. A second saved line whose listing is `ended`.
Do: Press "Move to cart" on W2 Print.
See: Cart shows ×10 and the message "The cart quantity limit was reached. Extra units are still saved for later."; Saved keeps ×3. The ended line reads "Unavailable", its button is disabled, and "Restore cart" for that group is disabled.
Data: `saved_cart_items.qty = 3` for W2 Print.

### QA-S08-07 A switch that fails, then a reload
Covers: S08.i.10 · Type: e2e (`e2e/cart.spec.js`) · Role: B1 · Route: `/artwork/<W6>`
Setup: Cart holds W2 Print. Block the `switch_saved_cart` request.
Do: 1. Add W6 and press "Switch Cart". 2. Reload the page with the block still on. 3. Remove the block and press "Try again".
See: Step 1: "Could not switch carts. Try again." and the button reads "Try again"; "Keep my Cart" is disabled while the operation is unfinished. Step 2: the unfinished switch is retried on load and fails again with a retry offered on the Cart page. Step 3: the Cart holds W6.
Data: `localStorage['cm-cart-operation:<B1>']` exists until success, then is removed; exactly one `saved_cart_operations` row; W2 Print saved once.

### QA-S08-08 Saved lines never reach checkout
Covers: S08.i.11 · Type: e2e · Role: B1 · Route: `/checkout`
Setup: Cart: W6. Saved: W2 Print ×3.
Do: Place the order and pay in the fake window.
See: The order shows W6 only.
Data: `order_lines` has one row; `saved_cart_items` is unchanged.

### QA-S08-09 Add all by artist with another Artist's Cart active
Covers: S08.i.12, D07 · Type: e2e (`e2e/cart.spec.js`) and schema · Role: B1 · Route: `/wishlist`
Setup: B1 saved four A1 works: W1 (two live versions), W2 (one live version), W3 (sold), F01 (one live version). Cart holds W6 (A2).
Do: 1. Press "Add all by Meera Iyer to Cart". 2. Press "Keep my Cart". 3. Press it again, then "Switch Cart". 4. Double-click "Switch Cart" in a fresh run. 5. Reload mid-switch in a third run.
See: Step 1: one dialog: names Imran Sheikh, says the Cart is saved, "2 works by Meera Iyer will be added." Step 2: nothing changes. Step 3: Cart holds W2 Print and F01; status line "2 added. 2 skipped: sold, already in your Cart, or a version must be chosen."
Data: W6 is in `saved_cart_items` once. Steps 4 and 5 leave exactly one operation row and the same Cart.

## S09 Checkout

### QA-S09-01 Checkout page and a clean run
Covers: S09, S09.st.default, S09.i.01, i.02, i.05, i.06, i.08, i.09 · Type: e2e (`e2e/checkout.spec.js`) · Role: B1 · Route: `/checkout` · View: all
Setup: Cart: W2 Print ×2, W1 Print ×1; gift note "Happy birthday".
Do: 1. Read the page. 2. Press "Pay ₹6,900". 3. Choose Pay in the fake window.
See: Step 1: steps Address, Pay, Done; the form prefilled from the saved address; State is a select; the India-only and privacy notice naming Meera Iyer; the payment sentence; the consent box; "Your Order" with both lines, Items (3), Total ₹6,900 and "Edit Cart". Step 2: button reads "Holding your pieces…", then the hold timer "Almost yours" counting down from about 15:00, and the address fields become read-only. Step 3: "Confirming your payment…", then `/orders/<id>?placed=1`.
Data: One `orders` row `paid`, total 690000, `gift_note` set, `payment_method 'upi'`, `commission_bps 1000`, `ship_by` 7 days after `paid_at`; `order_shipping` with address2 and landmark; listing stock down by the quantities and `held` back to its earlier value; the Cart is empty.

### QA-S09-02 Address errors
Covers: S09.st.error, S09.i.03, S09.i.07 · Type: e2e (`e2e/checkout.spec.js`) and unit (`src/lib/address.test.js`) · Role: B2 · Route: `/checkout`
Setup: B2 has W6 in the Cart and no saved address.
Do: 1. Press Pay on the empty form. 2. Enter name "Rahul Nair", phone `98765 4321`, line 1 "12 MG Road", PIN `40005`, city "Pune", leave State, untick the consent box, press Pay. 3. Fix phone `9876543210`, PIN `411001`, State "Maharashtra", tick consent, press Pay.
See: Step 1: alert "Fix 6 things before paying" listing the fields as links; focus on the alert. Step 2: "Fix 4 things…": "Enter a 10-digit mobile number.", "PIN codes have 6 digits.", "Choose your State.", "You need to agree to continue."; clicking an item focuses its field. Step 3: the hold starts. No message about a PIN "not being served" ever appears (PD04).
Data: No order row until step 3. A direct `placeOrder` call with a bad phone answers `invalid` with `fields: ["phone"]`.

### QA-S09-03 Save the address at checkout
Covers: S09.i.04, A4 · Type: e2e and schema · Role: B2 · Route: `/checkout`
Do: 1. Fill a valid address, leave "Save this address to my profile" ticked, pay. 2. Start a second order, untick the box, change the city, pay.
See: The second checkout opens prefilled with the first address.
Data: After step 1 `saved_addresses` has B2's row. After step 2 it is unchanged; the second order's `order_shipping` has the new city.

### QA-S09-04 Refresh during a hold, and resume
Covers: S09.i.10, S09.i.11 · Type: e2e (`e2e/checkout.spec.js`) · Role: B1 · Route: `/checkout`
Do: 1. Press Pay, then Close in the fake window. 2. Reload. 3. Go to `/cart`, add one more unit, return to `/checkout`. 4. Choose "Cancel it and use my Cart".
See: Step 1: Held state, timer running. Step 2: Held state again with the same order and the remaining time; no second hold. Step 3: a notice offering "Continue paying for that Order" or "Cancel it and use my Cart". Step 4: the editable form with the new quantity.
Data: Steps 1–3: exactly one `hold` order for B1. Step 4: that order is `hold_expired` and `held` on its listings fell back.

### QA-S09-05 The hold expires on the page
Covers: S09.st.expired · Type: e2e (`e2e/checkout.spec.js`) · Role: B1 · Route: `/checkout`
Setup: In the Held state, set `hold_until = now() + interval '5 seconds'` for the order.
Do: Wait for zero. Then run `select public.sweep()`.
See: At zero, without a reload: alert "These took too long to pay for…" with "Return to Cart"; Pay is disabled. The Cart still holds the items.
Data: After the sweep the order is `hold_expired` and the stock is free.

### QA-S09-06 Stock and price races at "Pay"
Covers: S09.i.12 · Type: schema and e2e · Role: B1 · Route: `/checkout`
Setup: Cart: W1 Original. With the checkout page open, (a) another buyer's hold takes the Original; in a second run (b) the price rises by ₹1,000.
Do: Press Pay.
See: (a) "Someone else just bought this one." with "Check your Cart"; (b) "A price changed since you added it. Please check your Cart.", and the Cart shows the price review.
Data: No order row remains for B1 in either run; `held` is unchanged by the failed attempt (schema: "a refused order leaves no hold behind").

### QA-S09-07 Payments not configured
Covers: S09.i.15, D15 · Type: e2e · Role: B1 · Route: `/checkout`
Setup: Fake mode off, no Razorpay keys.
See: Alert "Payments aren't set up on this site yet."; Pay disabled.
Data: `placeOrder` answers `unavailable` / `payments_not_configured`; no order row; no stock held.

### QA-S09-08 Three open holds
Covers: S09.i.14, KD12 · Type: schema and e2e · Role: B1
Setup: Create three `hold` orders for B1 with time left.
Do: Press Pay on a fourth Cart.
See: "You have a few payments waiting. Finish or wait a few minutes before starting another." with a link to My orders.
Data: `rate_limited` / `too_many_holds`; still three holds.

### QA-S09-09 The address is private until payment
Covers: S09.i.16 · Type: schema · Role: A1, A2, B2
Do: Select `order_shipping` for O1 (hold) as A1; for O2 (paid) as A1, as A2, as B2.
See: —
Data: O1: zero rows for A1. O2: one row for A1, zero for A2 and B2.

## S10 Payment

### QA-S10-01 Card payment in the Razorpay sandbox
Covers: S10, S10.st.card, S10.st.success, S10.i.01 · Type: sandbox · Role: a test buyer · Route: `/checkout`
Do: Pay with Razorpay's published test card.
See: Razorpay's window shows "CraftMe", "Order {code}", the amount, and the name, email and phone prefilled. After success: the confirming panel, then the order-placed page.
Data: Order `paid`; `razorpay_payment_id` set; `gateway_fee` equals the fee on the payment in the Razorpay test dashboard; the webhook delivery shows 200.

### QA-S10-02 UPI and other methods in the sandbox
Covers: S10.st.upi, S10.i.09 · Type: sandbox · Role: a test buyer
Do: Pay with Razorpay's test UPI id for success. Note which of Netbanking, Wallet and QR the account offers.
See: Success path as QA-S10-01. Methods the account does not offer are simply absent; CraftMe draws none of them.
Data: `payment_method` reads `upi`. Record the offered methods in `RESULTS.md`.

### QA-S10-03 Failure and dismissal keep the hold
Covers: S10.st.failed, S10.i.02, S09.i.13 · Type: e2e (fake window) and sandbox (Razorpay's failing test card) · Role: B1 · Route: `/checkout`
Do: 1. Press Pay, choose Fail. 2. Press Pay again, choose Close. 3. Press Pay, choose Pay.
See: Steps 1 and 2: back in the Held state with the timer still running; no error banner for a plain close. Step 3: success.
Data: One order throughout, `hold` until step 3.

### QA-S10-04 The webhook arrives after the buyer left
Covers: S10.i.03, S10.i.08 · Type: e2e (`e2e/checkout.spec.js`) · Role: B1
Do: 1. Start a hold and close the browser tab. 2. Send the signed `payment.captured` webhook for a fake successful payment. 3. Open `/cart`, then `/orders`.
See: The Cart is empty; the order is listed as Paid.
Data: Order `paid`; one `order_paid` and one `order_new` notification; `cm-pending-order:<B1>` removed.

### QA-S10-05 Duplicate callback and duplicate event
Covers: S10.i.04, SYS.03 · Type: schema and e2e · Role: B1
Do: After a successful payment, call `confirmPayment` again with the same `requestId`, then with a new one; send the same webhook event id twice, then the `order.paid` event for the same payment.
See: Each answers the Paid stage; nothing changes on screen.
Data: Stock moved once; one `order_paid` notification; `processed_events` has each event id once.

### QA-S10-06 Captured after the hold expired
Covers: S10.i.06, KD12 · Type: schema and e2e (fake provider) · Role: B1
Setup: Run A: expire O1 with the sweep, stock still free. Run B: expire it and sell the last unit to someone else.
Do: Send the webhook for a captured payment on that order.
See: A: the order page shows Paid. B: the order page shows Refunded with "It sold while you were paying. Your money is being returned."
Data: A: `paid`, stock down by one. B: `refunded`, `refund_reason 'sold_during_payment'`, one `refunds` row `issued` for the full total, the fake provider recorded exactly one refund; a second webhook does not refund again.

### QA-S10-07 Bad signature and wrong amount
Covers: S10.i.05 · Type: e2e (API calls) · Role: B1, B2
Do: Call `confirmPayment` (fake mode off, test secret) with a wrong signature; with another buyer's order id; and make the provider report a different amount.
See: "We couldn't confirm that payment. If money left your account, it will be returned."
Data: `bad_signature`, `forbidden`, `amount_mismatch`; the order stays `hold`; no stock moves.

### QA-S10-08 The result is uncertain
Covers: S10.i.07 · Type: e2e (`e2e/checkout.spec.js`) · Role: B1 · Route: `/checkout`
Setup: Make `confirmPayment` fail with a network error three times, then succeed; in run B never succeed but deliver the webhook after 20 seconds; in run C neither for 40 seconds.
Do: Pay in the fake window.
See: All runs: "Confirming your payment…" and never the word "failed". A: success after the retries. B: success when the poll sees Paid. C: after 30 seconds the extra text "This is taking longer than usual. Your payment is safe…" with a link to the order.
Data: The retries reuse one `requestId`; the order becomes `paid` once.

## S11 Order placed

### QA-S11-01 Confirmation page
Covers: S11, S11.st.default, S11.i.01, i.02, i.04 · Type: e2e (`e2e/orders.spec.js`) · Role: B1 · Route: `/orders/<O2>?placed=1` · View: all
Do: 1. Read the page. 2. Press "Copy". 3. Press "View Order".
See: Steps at Done; "Thank you, Ananya. Your Order is Paid."; the order code; "What happens next" with the real ship-by date (7 days after payment), the 14-day and 30-day sentences; the recap with both lines, Paid ₹6,900, Ship to and From; no sentence about email while the `emails` switch is off. Step 2: toast "Copied {code}". Step 3: the order page without the query.
Data: none.

### QA-S11-02 Refresh and deep link
Covers: S11.i.05 · Type: e2e · Role: B1, B2
Do: Reload `/orders/<O2>?placed=1`; open it in a new tab; open it as B2.
See: The same page each time for B1; B2 sees "We couldn't find this order".
Data: none.

### QA-S11-03 No success header unless Paid
Covers: S11.i.06 · Type: e2e · Role: B1
Do: Open `/orders/<O1>?placed=1` (hold), then expire O1 and reload, then `/orders/<O9>?placed=1` (refunded).
See: Hold: the confirming panel. Expired and refunded: the normal order page, no "Thank you".
Data: none.

## S12 My orders

### QA-S12-01 Tabs, counts, rows
Covers: S12, S12.st.default, S12.i.01, i.02, i.06 · Type: e2e (`e2e/orders.spec.js`) and schema · Role: B1 · Route: `/orders` · View: all
Do: Press each tab; reload on "Shipped".
See: Counts equal the fixtures (To be shipped: O2; Shipped: O4, O14; Received: O5, O6, O7, O8; Refunded: O9; All: the sum). O1 appears only as the alert "Finish paying". An expired hold is not listed. Row hints: ship-by date for O2, tracking for O4, "Reviewed" for O7, "₹… refunded" for O8 and O9. The tab survives the reload.
Data: `my_order_counts()` as B2 counts only B2's orders.

### QA-S12-02 Row actions
Covers: S12.i.03 · Type: e2e · Role: B1 · Route: `/orders?tab=shipped`
Do: 1. Press "Mark Received" on O4, then "Not yet". 2. Again, then "Yes, it arrived". 3. On the Received tab press "Write a Review" on O6.
See: Step 1: nothing changes. Step 2: O4 leaves Shipped; counts update. Step 3: `/orders/<O6>/review`. O7 shows "Reviewed" and no button.
Data: O4 `received`, `damage_window_ends` 3 days on, `review_by` 30 days on.

### QA-S12-03 Empty, loading, error
Covers: S12.st.empty, S12.i.05 · Type: e2e · Role: a buyer with no orders, B1
Do: Open `/orders` with no orders; as B1 with the request delayed; with it failing.
See: "No Orders yet…" with "Browse art"; three skeleton rows; an alert with "Try again" that works.
Data: none.

### QA-S12-04 Paging
Covers: S12.i.04 · Type: e2e · Role: B1 · Route: `/orders`
Setup: Add 45 received orders for B1.
Do: Walk the pages on All.
See: 20 per page, numbered; every order appears once; the oldest is on the last page.
Data: none.

## S13 Order detail

### QA-S13-01 Paid
Covers: S13, S13.st.paid, S13.i.02, i.03, i.07, i.09 · Type: e2e (`e2e/orders.spec.js`) · Role: B1, B2 · Route: `/orders/<O2>`, `/orders/<O3>` · View: all
See: O2: breadcrumbs; badge Paid; tracker with Paid done; "Meera Iyer is preparing your Order. They have until {date} to ship it. If they don't, CraftMe reviews the Order and usually refunds you in full."; items; timeline with "Paid ₹6,900" and "Waiting for Meera to ship, deadline {date}"; Ship to with the full address and phone; Payment "UPI"; a disabled "Cancel Order" with the explanation and "Contact CraftMe". O3 (as B2): "This Order is late. CraftMe is reviewing it. Late Orders are usually refunded in full." Nowhere a promise of an automatic refund (D05).
Data: none.

### QA-S13-02 Shipped, and confirming receipt
Covers: S13.st.shipped, S13.dlg.recv, S13.i.05 · Type: e2e · Role: B1 · Route: `/orders/<O4>`
Do: 1. Copy the tracking number. 2. Press "I've received it", then Escape. 3. Press it again, Tab through the dialog, press "Yes, it arrived".
See: Courier DTDC, tracking DT4830012IN, shipped date, "we'll mark it Received on {date 14 days after shipping}". Step 1: toast. Step 2: dialog closes, focus back on the button, stage unchanged. Step 3: focus stays inside the dialog; the button reads "Saving…"; the page then shows Received with the damage deadline.
Data: As QA-S12-02.

### QA-S13-03 Received and its actions
Covers: S13.st.received, S13.i.08 · Type: e2e · Role: B1 · Route: `/orders/<O5>`
See: "It arrived. Enjoy it." and "Something not right? Tell us by {date}."; links "Something not right?" to `/orders/<O5>/damage` and "Review Meera" to `/orders/<O5>/review`; no Cancel button. On O7 (window closed, reviewed) neither action is drawn.
Data: none.

### QA-S13-04 Refunded and partly refunded
Covers: S13.st.refunded, S13.i.04, S13.i.06 · Type: e2e · Role: B1 · Route: `/orders/<O9>`, `/orders/<O8>`
See: O9: badge Refunded; "Your ₹{total} refund was issued on {date}. It goes back to your original payment method."; each line marked refunded; a Refund block with reason, amount, lines and date; "Refunded −₹{total}"; no Review action. O8: badge Received; one line marked "Refunded ₹… · 1 of 1", the other not; the Refund block; "Review" still offered.
Data: Figures equal the `refunds` rows and `orders.refunded_total`.

### QA-S13-05 A hold, and a hold expiring on the page
Covers: S13.i.10 · Type: e2e · Role: B1 · Route: `/orders/<O1>`
Setup: Set O1's `hold_until` to 5 seconds from now.
Do: Wait.
See: Before: "Waiting for your payment. We're keeping your pieces for 0:0x." with "Finish paying". At zero, without reload: "The time to pay ran out. Your pieces went back on the wall." with "Return to Cart"; no pay button.
Data: none until the sweep.

### QA-S13-06 Repeat confirmation and auto-receipt
Covers: S13.i.12 · Type: schema and e2e · Role: B1
Do: 1. Call `confirm_received` twice for O4. 2. Run the sweep (O14 is 15 days shipped). 3. Open `/orders/<O14>`.
See: Step 3: Received; the timeline says "marked Received automatically".
Data: Second call fails `wrong_stage`. O14: `received_at >= auto_receive_at`, and B1 has a `review_prompt` notification with `auto: true`.

### QA-S13-07 Receipt
Covers: S13.i.01, PD08 · Type: e2e · Role: B1 · Route: `/orders/<O2>/receipt`
See: A print-styled page: CraftMe, order code and date, lines and totals, payment reference and method, ship-to. It says "Order summary", not "Tax invoice". The browser's print preview fits one page. B2 opening it sees "We couldn't find this order".
Data: none.

### QA-S13-08 Someone else's order
Covers: S13.i.11, S11.i.07, S20.i.02 · Type: schema and e2e · Role: B2, G
Do: As B2 open `/orders/<O2>`, `/orders/<O2>/damage`, `/orders/<O2>/review`, `/orders/<O2>/receipt`; as G open `/orders/<O2>`.
See: B2: "We couldn't find this order" on each, with the same words as for an id that does not exist. G: the login page.
Data: B2's selects on `orders`, `order_lines`, `order_shipping` for O2 return zero rows.

### QA-S13-09 Actions disappear at their cut-offs
Covers: S13.i.14 · Type: e2e · Role: B1 · Route: `/orders/<O5>`
Do: 1. With the page open, move `damage_window_ends` into the past. 2. Wait 5 seconds. 3. In a second tab opened earlier on `/orders/<O5>/damage`, press "Send report" on a complete form. 4. Move `review_by` into the past and wait.
See: Step 2: "Something not right?" is gone. Step 3: the "time to report damage ended" view. Step 4: "Review" is gone.
Data: No `damage_reports` row for O5.

### QA-S13-10 Refund still being processed
Covers: S13.i.15 · Type: e2e · Role: B1 · Route: `/orders/<O8>`
Setup: Set O8's refund status to `unknown`, then `pending`.
See: "Your ₹{amount} refund is being processed. We'll update this page."; no issue date. After setting `issued` and waiting for the poll, the issued sentence appears.
Data: none.

## S14 Damage Report

### QA-S14-01 Form page
Covers: S14, S14.st.default, S14.i.01, i.03, i.11 · Type: e2e (`e2e/damage.spec.js`) · Role: B1 · Route: `/orders/<O5>/damage` · View: all
See: Breadcrumbs; "Please tell us by {date}."; both order lines unticked; five damage types, none chosen; the 800-character box with a counter; the photo area with the 2-to-6 rule; "What to expect" with the three points including one report per Order; Cancel returns to the order.
Data: none.

### QA-S14-02 Validation
Covers: S14.i.02, S14.i.04 · Type: e2e and schema · Role: B1 · Route: `/orders/<O5>/damage`
Do: 1. Press "Send report" on the empty form. 2. Tick one line, choose "Torn, creased or crushed", paste 900 characters, add one photo, send.
See: Step 1: a summary with "Choose at least one item.", "Choose the type of damage.", "Describe what happened.", "Add at least 2 photos." Step 2: the box holds 800 characters; only the photo message remains.
Data: No report. The schema test refuses 1 photo, 7 photos, 801 characters, no line, a duplicate line, a line from another order.

### QA-S14-03 Mixed files
Covers: S14.i.05 · Type: unit (`src/lib/uploads.test.js`) and e2e · Role: B1
Do: Drop five files at once: two 1 MB JPEGs, one 6 MB PNG, one PDF, one WebP. Then add five more valid JPEGs. Remove one preview.
See: The two JPEGs appear as previews. Three lines name the refused files: too large; not JPEG or PNG (twice). Of the next five, four are accepted (six in total) and one is refused: "Up to 6 photos." Removing a preview frees a slot.
Data: Nothing uploaded yet.

### QA-S14-04 Upload fails part-way; retry; orphans
Covers: S14.i.06, S14.i.09 · Type: e2e (`e2e/damage.spec.js`) · Role: B1
Setup: Three valid photos. Make the second upload fail once. In run B make `report_damage` fail with a network error once. In run C, after two uploads, press Cancel.
Do: Send; then "Try again".
See: Run A: "Uploading photo 2 of 3…", then the second photo marked "Didn't upload"; "Try again" uploads only that one and sends. Run B: "We couldn't send your report. Your photos are saved. Try again."; the retry makes no new upload request. Run C: back on the order page.
Data: A and B: three objects in `damage/<B1>/`, one report. C: zero objects left. An object left behind on purpose and aged 25 hours is removed by `cron('cleanup')`; a referenced one is not.

### QA-S14-05 Submitted view is durable
Covers: S14.st.submitted, S14.i.12 · Type: e2e · Role: B1 · Route: `/orders/<O5>/damage`
Do: 1. Send a complete report (one line, two photos). 2. Reload. 3. Open the same URL in another browser context as B1. 4. As Admin reject it with a note; reload as B1.
See: "Report sent", "Reference {code}", "You'll get a notification here when we've decided." (no mention of email), the three-step timeline with the sent time. Step 4: "Not upheld" and the Admin's note.
Data: `damage_reports`: `kind`, `line_ids` with one id, `photos` two paths, note, status `open`; order `open_report` true and not payable while open.

### QA-S14-06 Already reported
Covers: S14.i.07 · Type: schema and e2e · Role: B2 · Route: `/orders/<O10>/damage`
Do: Open the page; call `report_damage` directly a second time; in two tabs submit at the same moment on a fresh order.
See: The submitted view, never the form.
Data: `already_exists`; one row per order (unique `order_id`).

### QA-S14-07 The window closes during upload
Covers: S14.i.08 · Type: e2e · Role: B1
Setup: Delay uploads 3 seconds; during them move `damage_window_ends` into the past.
Do: Send.
See: "The time to report damage ended on {date}." with "Back to Order" and "Contact CraftMe".
Data: `window_closed`; no report; the uploaded objects are removed.

### QA-S14-08 Wrong person or wrong stage
Covers: S14.i.10 · Type: schema · Role: B2, A1
Do: Call `report_damage` for O5 as B2 and as A1; for O2 (paid) as B1; with a photo path in another user's folder.
See: —
Data: `forbidden`, `forbidden`, `wrong_stage`, `invalid` (`photoPaths`).

## S15 Review

### QA-S15-01 Form page and a good review
Covers: S15, S15.st.default, S15.i.01, i.02, i.04, i.05 · Type: e2e (`e2e/review.spec.js`) · Role: B1 · Route: `/orders/<O6>/review` · View: all
Do: 1. Read the page. 2. Choose 4 stars with the keyboard. 3. Type "Exactly as photographed." 4. Press "Packed well" and "Fast shipping", then unpress "Fast shipping". 5. Press "Send Review".
See: "Review Meera Iyer", "Order {code} · Received {date} · Window closes in 20 days", "4 of 5", the counter, the no-personal-details hint, the approval notice. Step 4: the text ends with " Packed well." and the second chip's sentence comes and goes. Step 5: `/orders` with the toast "Thanks. Your Review will appear once CraftMe approves it."
Data: `reviews` row: rating 4, the text, status `pending`, `buyer_name 'Ananya'`; `orders.reviewed` true; A1's public rating unchanged.

### QA-S15-02 Validation and length
Covers: S15.i.03 · Type: e2e and schema · Role: B1
Do: Send with no rating and no text; then with 5 stars and 500 characters, and try pressing a chip.
See: "Pick a rating." and "Write a few words."; at 500 characters the chips are disabled.
Data: The schema test refuses rating 0 and 6, an empty comment, 501 characters.

### QA-S15-03 Window closed, including while the form is open
Covers: S15.st.closed, S15.i.07 · Type: e2e · Role: B1 · Route: `/orders/<O6>/review`
Do: 1. With the form filled in, move `review_by` into the past and press "Send Review". 2. Reload.
See: Both: "The Review window has closed. Reviews can be written for 30 days after an Order is Received. This one closed on {date}." with "Back to Order".
Data: `window_closed`; no review row.

### QA-S15-04 Already reviewed and double submit
Covers: S15.i.06 · Type: schema and e2e · Role: B1 · Route: `/orders/<O7>/review`
Do: Open O7's page; on O6 double-click "Send Review".
See: O7: "You reviewed Meera Iyer" with stars, text, date and "Published". O6: one toast, one navigation.
Data: One row per order (primary key); the second call answers `already_exists`.

### QA-S15-05 Refunds and eligibility
Covers: S13.i.13, D06 · Type: schema and e2e · Role: B1
Do: Open `/orders/<O8>/review` (partly refunded), `/orders/<O9>/review` (fully refunded), `/orders/<O2>/review` (paid).
See: O8: the form. O9: "This Order was refunded in full, so it can't be reviewed." O2: "You can review Meera Iyer once the Order is Received."
Data: `submit_review` on O9 and O2 answers `wrong_stage`.

### QA-S15-06 The buyer sees what happened to their review
Covers: S15.i.08 · Type: e2e · Role: B1, AD1
Do: 1. B1 reviews O6. 2. AD1 rejects it with "Contains personal details". 3. B1 opens `/orders/<O6>/review`. 4. Repeat with approval on O5.
See: Step 3: badge "Not published" and the reason in words. Step 4: "Published"; the review appears on A1's profile.
Data: B1 has `review_rejected` and `review_approved` notifications; only the approved review changed A1's average.
