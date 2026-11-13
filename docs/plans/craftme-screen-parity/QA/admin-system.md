# QA scripts: Admin, emails, UI kit, system rules

Format, fixtures and defaults are in [README.md](README.md).

## S29 Admin overview

### QA-S29-01 Overview
Covers: S29, S29.st.default, S29.i.03, i.04, i.05, i.06 · Type: e2e (`e2e/admin-queues.spec.js`) and schema · Role: AD1 · Route: `/admin` · View: all
See: Four tiles; two charts each with a hidden data table; "Recent Orders" (5 newest) with "All Orders"; "Needs a decision" with five rows, counts and "Oldest {age}" (Damage Reports 1 for O10, Overdue 1 for O3, Reviews 2, Reports 2, Verification 1 for A2), each linking to its tab; "Watch list" with the next run date and "Tanvi Rao, ₹3,200, day 52. Restricted automatically on day 60." A3 (already restricted) is not on the watch list.
Data: `admin_queue_counts()` equals direct counts on the fixture tables.

### QA-S29-02 Period, comparisons and boundaries
Covers: S29.i.01, i.02, i.08 · Type: schema and e2e · Role: AD1 · Route: `/admin`
Do: Choose 7, 30, 90 days and This year; reload on 90.
See: Tiles change; `?days=90` survives reload. With no orders in the previous period the change line reads "No earlier data". With no orders at all: zeros and "No orders in this period."
Data: Schema: an order paid at 23:59 IST on the last day of a period counts in it, one paid at 00:01 the next day does not; commission equals `commission_of(total - refunded_total, commission_bps)` summed; a fully refunded order adds to Paid and to Refunds and nothing to Commission.

### QA-S29-03 Not an Admin
Covers: S29.i.07 · Type: e2e (`e2e/admin-access.spec.js`) and schema · Role: G, B1, A1
Do: Open `/admin`, `/admin/queues`, `/admin/orders`, `/admin/payouts`, `/admin/artists`, `/admin/settings`. Call each `admin_*` function and each Admin Edge command directly.
See: G: login. B1, A1: `/` with the no-access toast.
Data: Every function and command answers `forbidden`; no admin data in any response.

## S30 Queues

### QA-S30-01 Queue page and the damage dialog
Covers: S30, S30.st.default, S30.tab.q-dmg, S30.dlg.dmg, S30.i.01 · Type: e2e (`e2e/admin-queues.spec.js`) · Role: AD1 · Route: `/admin/queues` · View: all
Do: 1. Read the tabs. 2. On Damage Reports press "Review" for O10. 3. Press "Record decision" with nothing chosen. 4. Choose "Reject", leave the note empty, record. 5. Type a note, record.
See: Step 1: five tabs with counts. Step 2: the report code, both photos (each opens full size), the Buyer's text, the claimed line and amount, shipped, received and reported dates with "(inside the 3-day window)", Artist history. Step 3: "Choose a decision." Step 4: "Write a note for both people." Step 5: toast "Decision recorded. Buyer and Artist notified."; the row leaves; the count drops.
Data: Report `rejected` with the note, `decided_by` AD1; order `open_report` false; after the sweep the order becomes `payable`; notifications `damage_rejected` (buyer) and `damage_decided` (artist); one audit row.

### QA-S30-02 Uphold a Damage Report
Covers: S30.i.09 · Type: e2e (fake provider) and schema · Role: AD1 · Route: `/admin/queues`
Do: Review O10, choose "Uphold", note "Photos show the tube crushed.", record. Run B: the fake provider times out.
See: A: toast "Upheld. ₹{amount} refunded through Razorpay." B: the dialog stays with "The decision is recorded. Razorpay didn't confirm the refund. Check it under Orders, Refunds to check."
Data: A: report `upheld`; one `refunds` row `issued` for exactly the reported line's full quantity; the other line untouched; order stays `received` with `refunded_total` raised; `open_report` false. B: the same but the refund is `unknown` and the fake provider shows at most one refund attempt. Recording again answers `already_decided` in both runs.

### QA-S30-03 Overdue: extend once
Covers: S30.tab.q-over, S30.i.02, D05 · Type: e2e and schema · Role: AD1 · Route: `/admin/queues?tab=over`
Do: 1. Press "Extend 2 days" on O3. 2. Run the sweep now. 3. Move `ship_by` into the past, run the sweep, reload.
See: Step 1: toast "Deadline extended by 2 days."; the row leaves. Step 3: O3 is back with a disabled "Extended".
Data: Step 1: `ship_by` +2 days, `overdue` false, `ship_extended` true, notifications to A1 and B2. A second call answers `already_extended`. Nothing is refunded automatically at any point.

### QA-S30-04 Overdue: full refund
Covers: S30.dlg.refund · Type: e2e (fake provider) · Role: AD1
Do: Press "Refund" on O3, read the dialog, "Cancel"; again, "Refund ₹2,200".
See: "Refund ₹2,200 in full through Razorpay…" and the fee line showing O3's real gateway fee. After confirming: toast; the row leaves.
Data: O3 `refunded`, `refunded_total` = total, one refund `issued` with reason code `overdue`; stock is not returned to the listing; B2 gets `refund_issued`; O3 never becomes payable.

### QA-S30-05 Reviews: approve, reject, approve edited
Covers: S30.tab.q-rev, S30.dlg.rrej, S30.i.03, PD10 · Type: e2e and schema · Role: AD1, G · Route: `/admin/queues?tab=rev`
Do: 1. Approve O12's review. 2. On O13's review (contains a phone number) read the warning, press "Approve edited", delete the number, confirm. 3. On a third pending review press "Reject", choose "Abusive or unlawful", confirm.
See: The warning "Contains a phone number…" on O13 only. Toasts after each. As G, A4's and A2's profiles show the approved texts; O13's shows the edited text.
Data: Step 1: `approved`; A4's `rating_count` +1. Step 2: `comment` is the edited text, `original_comment` holds the old one and cannot be selected by `authenticated` or `anon`; the buyer is notified. Step 3: `rejected`, `reject_reason 'abusive'`, the Artist's average unchanged. Rejecting without a reason answers `invalid`.

### QA-S30-06 Reports: dismiss, take down, restrict
Covers: S30.tab.q-rep, S30.dlg.down, S30.i.04 · Type: e2e and schema · Role: AD1, G, A2 · Route: `/admin/queues?tab=rep`
Do: 1. On REP1 (W6) press "Take down", leave the reason empty, confirm; then type "Looks traced. Please send proof.", confirm. 2. As G open `/artwork/<W6>`. 3. As A2 open the dashboard list. 4. On REP2 press "Restrict…", complete the Restrict dialog. 5. File a new report and press "Dismiss".
See: Step 1: reason required; then toast "Artwork taken down". Step 2: not found. Step 3: A2 has a notification with the reason; the work is gone from the list and cannot be edited. Step 4: A2 is Restricted; REP2 leaves the queue. Step 5: the row leaves.
Data: W6 `removed`, `takedown_reason` set, listings `ended`; any other open report on W6 is closed as `taken_down`; REP2 `resolved` / `restricted`; the dismissed one `dismissed`. O4 (a shipped order for W6) is unaffected.

### QA-S30-07 Verification
Covers: S30.tab.q-ver, S30.dlg.ver · Type: e2e and schema · Role: AD1, A2 · Route: `/admin/queues?tab=ver`
Do: 1. Press "Check" on A2. 2. Press "Request changes", note "Name on PAN doesn't match the UPI holder." 3. As A2 change the payout details in settings. 4. As AD1 open "Check" again, tick both boxes, "Mark verified".
See: Step 1: legal name, PAN, destination, phone "verified by code", fee paid with its payment id; "Mark verified" disabled until both boxes are ticked. Step 2: toast; A2 sees the note in settings and a notification. Step 3: the note clears. Step 4: toast "Artist verified. Payouts enabled."; A2's profile shows "Verified Artist".
Data: `changes_requested` set, then null; `verified_at` set; `profiles.verified` true; audit rows for both decisions. `mark_verified` for a person with no submitted details answers `not_found`.

### QA-S30-08 Two Admins decide the same thing
Covers: S30.i.05 · Type: e2e (two contexts: AD1, AD2) and schema · Role: AD1, AD2
Do: Both open the same Damage Report and the same pending review. AD1 records first, then AD2.
See: AD2: "Someone already decided this report." (and the same for the review); the list reloads.
Data: One decision each; one refund at most.

### QA-S30-09 Damage photos are private
Covers: S30.i.06 · Type: schema (with the storage stand-in) and e2e · Role: AD1, A1, A2, B1
Do: Request O10's photo objects as each role; open a signed URL after 61 minutes.
See: —
Data: Allowed: the reporting buyer (B2), the order's Artist (A1), Admins. Refused: A2 and B1. The expired URL fails.

### QA-S30-10 Empty and error per tab
Covers: S30.i.08 · Type: e2e · Role: AD1
Setup: Empty each queue in turn; then make each tab's read fail.
See: "No Damage Reports waiting.", "No Overdue Orders.", "No Reviews to approve.", "No open Reports.", "No Artists waiting for verification."; on failure each tab shows its own alert with "Try again" while the other tabs still work.
Data: none.

## S31 Orders (Admin)

### QA-S31-01 Search, filters, payout column, pages
Covers: S31, S31.st.default, S31.i.01, i.02, i.03, i.08 · Type: e2e (`e2e/admin-orders.spec.js`) and schema · Role: AD1 · Route: `/admin/orders` · View: all
Do: Search O2's code; clear; search B1's email; search O4's payment id; choose Stage "Overdue"; choose Artist "Meera Iyer"; choose "Last 7 days"; reload.
See: Each search returns the right orders; Overdue lists O3; filters and page are in the URL and survive reload. Payout column: O2 "Not yet", O6 "Payable", O7 "Paid out {date}", O11 "Owed ₹3,200". 20 per page.
Data: `admin_orders` as B1 answers `forbidden`. The response carries the Buyer's short name and city, not the email or street address.

### QA-S31-02 Refund selected lines with a preview
Covers: S31.dlg.ord, S31.i.04 · Type: e2e (fake provider) and schema · Role: AD1
Do: 1. Open O2. 2. Press "Refund selected lines" with nothing ticked. 3. Tick the W2 Print line, set "How many" to 1, reason "Other", no note. 4. Add the note "Goodwill", read the preview, refund.
See: Step 2: the button is disabled. Step 3: "Add a note for 'Other'." Step 4: preview "Refund to Buyer ₹2,200… The Artist's Payout for this Order drops by ₹{payoutDrop}."; toast "Refund of ₹2,200 issued through Razorpay."; the line shows "Refunded 1 of 2".
Data: `refund_preview` returned the same amount `reserve_refund` then recorded; `order_lines.refunded_quantity` 1; order still `paid`; refund `issued` with `reason_code 'other'`, note stored; one audit row.

### QA-S31-03 A real refund in the Razorpay sandbox
Covers: S31.i.07 · Type: sandbox and schema · Role: Admin test account
Do: Refund one line of an order paid with test keys. Then try to refund the same quantity again.
See: The refund appears in the Razorpay test dashboard with the same amount. The second attempt: "Those lines were already refunded."
Data: `razorpay_refund_id` equals the dashboard's id. Schema: `exceeds_paid` on the repeat.

### QA-S31-04 Provider answer unknown, then reconciliation
Covers: S31.i.05, S30.i.07 · Type: e2e (fake provider) · Role: AD1, B1 · Route: `/admin/orders`
Setup: The fake provider times out on refund. Run A: it did in fact refund. Run B: it did not.
Do: 1. Refund a line of O5. 2. Read "Refunds to check". 3. Press "Check with Razorpay". 4. Run B: press "Send refund again", confirm.
See: Step 1: "The refund is recorded but Razorpay didn't confirm it. Don't refund again…". Step 2: the row with amount and "unknown". Run A step 3: toast "Razorpay confirms this refund."; row leaves. Run B step 3: "Razorpay has no refund for this." and the resend button; step 4: toast, row leaves. Throughout, B1's order page says "being processed" and then "issued".
Data: The reservation is never undone. Run A: provider has one refund; Run B: one refund, made in step 4. Status ends `issued` with the provider id.

### QA-S31-05 Refund after the Artist was paid
Covers: S31.i.06 · Type: e2e and schema · Role: AD1 · Route: `/admin/orders`
Do: Open O7 (paid out), tick its line, reason "Damage Report upheld", read the preview, refund.
See: Preview: "The Artist was already paid. ₹{owedDelta} becomes an Amount Owed."
Data: A1's `amount_owed` rises by `owed_after_refund(...)`, `owed_since` set; refund `after_payout` true; A1's dashboard shows the owed banner; the next run deducts it.

### QA-S31-06 Refunds are Admin-only
Covers: S31.i.09 · Type: schema and e2e (API) · Role: B1, A1
Do: Call `issueRefund`, `checkRefund`, `retryRefund`, `refund_preview`, `admin_orders` as each; select O7's `refunds` and `order_shipping` rows as A2.
See: —
Data: `forbidden` each time; no reservation is made; A2's selects return zero rows.

## S32 Payout run

### QA-S32-01 Draft run
Covers: S32, S32.st.default, S32.dlg.lines, S32.i.02, S32.i.03 · Type: e2e (`e2e/admin-payouts.spec.js`) and schema · Role: AD1 · Route: `/admin/payouts` · View: all
Do: 1. Read the page. 2. Press "Lines" for A1. 3. Press "Copy transfer list". 4. Copy A4's destination.
See: Title with the run day (a 1st or 15th) and "Draft"; totals; rows for A1 and A4 with Price, Refunds, Commission, Gateway fee, Owed deducted (A4: ₹3,200), Credit added, Net, destination, an empty reference input. The lines dialog lists O6 with its figures. Toasts on copy. At 375 px the table scrolls inside its box.
Data: Each row equals `payout_calc` for that Artist. The clipboard list has one line per verified Artist with a net above zero.

### QA-S32-02 Blocked Artists
Covers: S32.i.01 · Type: e2e and schema · Role: AD1
See: Alert "1 Artist can't be paid yet. Imran Sheikh isn't verified. Their Orders stay Payable and roll into the next run."; A2's row reads "₹0 now", "Blocked", "Rolls to the next run", with "Verify" opening the verification tab.
Data: No `payouts` row for A2; A2's order stays `payable` with no `payout_id`.

### QA-S32-03 Record the run
Covers: S32.dlg.done, S32.i.04 · Type: e2e and schema · Role: AD1
Do: 1. Type reference `UTR1001` for A1 only. 2. Press "Record run". 3. Read the dialog, press "Go back". 4. Press "Record run" again and confirm.
See: Step 3: "This marks {n} Orders as paid out… 1 rows have no transfer reference…". Step 4: progress, then A1's row shows "Sent" with a read-only reference; A4's row is listed under "Left for the next run".
Data: A1's payout `sent`, reference stored, destination stored; O6 has `payout_id`; A1 gets `payout_sent`; one audit row. A4's draft is unchanged and A4's Amount Owed is still ₹3,200.

### QA-S32-04 Recorded state
Covers: S32.st.sent · Type: e2e · Role: AD1
Setup: Record A4's row as well with `UTR1002`.
See: Badge "Recorded"; status alert "Run recorded. 2 transfers, ₹{total} paid out. A recorded transfer can't be edited…"; no editable inputs; no "Record run" button. No sentence about emailed statements while the `emails` switch is off.
Data: A4: `owed_deducted` 320000, `amount_owed` 0, `owed_since` null.

### QA-S32-05 The numbers changed since the draft
Covers: S32.i.06 · Type: e2e and schema · Role: AD1
Do: 1. With the draft open, refund a line of O6 in another tab. 2. Enter a reference for A1 and record. 3. Press "Rebuild", check the new net, record.
See: Step 2: on A1's row "The numbers changed since the draft. Press Rebuild, check, and record again."; nothing recorded. Step 3: toast "Draft rebuilt"; the lower net; then "Sent".
Data: Step 2: `rebuild`; O6 has no `payout_id`. Step 3: the recorded net equals `payout_calc` after the refund. A rebuild on the 2nd keeps `run_date` on the 1st.

### QA-S32-06 Recorded twice; reference reused
Covers: S32.i.07 · Type: schema and e2e (two contexts) · Role: AD1, AD2
Do: Both Admins record A1's row at the same moment. Then use `UTR1001` for A4.
See: One sees "Sent"; the other also ends on "Sent" with no error. A4's row: "That reference was already used."
Data: One state change; the second call answered `already_sent`; the reuse answered `duplicate_reference`.

### QA-S32-07 Nothing to send
Covers: S32.i.08 · Type: schema and e2e · Role: AD1
Setup: An Artist whose payable net is smaller than their Amount Owed; and a day with no payable orders at all.
See: That Artist's row: Net ₹0, "Nothing to send" in place of the reference input; it is recorded with an automatic reference. Empty day: "Nothing to pay out for {run day}. The next run is {date}."
Data: The orders get a `payout_id`; the remaining debt stays in `amount_owed`; no `payout_sent` email row is created for a zero net (after P11).

## S33 Artists (Admin)

### QA-S33-01 List, filters, search
Covers: S33, S33.st.default, S33.i.01, i.02, i.05 · Type: e2e (`e2e/admin-artists.spec.js`) and schema · Role: AD1 · Route: `/admin/artists` · View: all
Do: Press each filter; search `tan`; reload.
See: Counts: All 4, Needs verification 1 (A2), Owes money 2 (A3, A4), Restricted 1 (A3). Columns filled; A4 shows "₹3,200 · day 52"; A3 shows "Restricted" with the reason. Search finds Tanvi Rao.
Data: The `admin_artists` response has no PAN and no payout destination.

### QA-S33-02 Restrict
Covers: S33.dlg.rs, S33.i.03 · Type: e2e and schema · Role: AD1, G, A1
Do: 1. Press "Restrict…" on A1. 2. Confirm with an empty reason. 3. Choose "Repeated Overdue Orders", edit the text, confirm. 4. As G open A1's profile and W1. 5. As A1 mark O2 as shipped.
See: Step 1: the box says "Meera Iyer must still ship 2 Paid Orders…". Step 2: reason required. Step 3: toast "Meera Iyer is now Restricted". Step 4: "This Artist isn't taking orders right now."; W1 not found. Step 5: works.
Data: `profiles.restricted` true; reason appended; every artwork and listing `artist_open` false with listing statuses untouched; B1's Cart line for W1 now blocks Checkout; `place_order` on W1 answers `artist_restricted`; A1 notified; audit row.

### QA-S33-03 Lift, and the history
Covers: S33.dlg.lift, S33.i.06, PD16 · Type: e2e and schema · Role: AD1
Do: Press "Lift…" on A1 (after QA-S33-02): empty note, then "Provided a shipping plan."
See: Note required; then toast "Restriction lifted"; A1's works are back at once with exactly the listings that were live before.
Data: `restricted` false; `artist_open` true; two audit rows for A1 (restrict, lift) with actor, note and time.

### QA-S33-04 A restriction for money owed, and the Admin override
Covers: S33.i.04, PD26 · Type: schema and e2e · Role: AD1
Do: 1. Press "Lift…" on A3, read the warning, add a note, confirm. 2. Run the sweep twice. 3. Record a payout that clears A3's debt, then refund another paid-out order of A3, move `owed_since` back 61 days, run the sweep. 4. Separately: pay a restricted Artist's balance (QA-S26-04) without any override.
See: Step 1: the warning "Naina Kapoor still owes ₹3,200. Lifting now overrides the 60-day rule for this debt…"; after confirming, A3 is Open and still shows "₹3,200 · day 61". Step 2: A3 stays Open. Step 3: A3 is Restricted again. Step 4: the Artist is Open.
Data: Step 1: `restricted` false, `owed_override_since` equals `owed_since`, `amount_owed` unchanged, an audit row with the note. Step 2: the sweep's `restrictOwed` count is 0. Step 3: the new debt has a new `owed_since`, so the override no longer matches and the sweep restricts once. Step 4: paying lifts only when `owed_60_days` is the sole reason; with a manual reason also present the Artist stays restricted.

## S34 Settings (Admin)

### QA-S34-01 Fees
Covers: S34, S34.st.default, S34.i.01, i.02, i.07 · Type: e2e (`e2e/admin-settings.spec.js`) and schema · Role: AD1 · Route: `/admin/settings` · View: all
Do: 1. Enter Commission `60`, save. 2. Enter `12.5` and fee `599`, save. 3. Pay a new order as B1. 4. Open `/dashboard/payouts` as A1.
See: Step 1: "Commission can be 0 to 50%." Step 2: the preview updates as typed; toast "Fees saved". Step 4: O6 still shows 10%; the new order's share is 12.5%.
Data: `settings.commission_bps` 1250, `onboarding_fee_paise` 59900; O6 `commission_bps` 1000; the new order 1250. Anonymous and Buyer selects of the fee columns are refused. An audit row.

### QA-S34-02 Shop rules match the code
Covers: S34.i.04, A5 · Type: schema · Role: AD1
See: The read-only list shows 15 minutes, 7 days, 14 days, 3 days, 30 days, 1st and 15th, 60 days.
Data: Schema: a fresh hold lasts 15 minutes; `ship_by` is 7 days after payment; `auto_receive_at` 14 days after shipping; `damage_window_ends` 3 and `review_by` 30 days after receipt; the sweep restricts at 60 days owed; the cron expression is `30 3 1,15 * *`. The schema test reads the numbers from `src/lib/rules.js`, so the list on screen and the SQL cannot drift apart.

### QA-S34-03 Switches
Covers: S34.i.03, SH.14 · Type: e2e · Role: AD1, G, A1
Do: Turn each switch off, check, then on.
See: Demo banner: the strip "Test mode. No real payments are taken." appears or disappears on the public site and both shells within one reload. Accept new Artists: seller links and `/become-artist` as in QA-S18-09. Instagram Connect: QA-S27-07. A failed save flips the switch back with an error toast.
Data: `settings.switches` holds the three keys; `set_switch('other', true)` answers `invalid`.

### QA-S34-04 Admins
Covers: S34.dlg.adm, S34.i.05, PD23 · Type: e2e and API · Role: AD1
Do: 1. Press "Add", enter `nobody@example.com`. 2. Enter B1's email, "Grant Admin". 3. Press "Remove" on B1 and confirm. 4. Try to remove yourself. 5. Remove AD2, then (as the only Admin) call `revokeAdmin` on yourself.
See: Step 1: "No Account uses that email. They need to sign in once first." Step 2: B1 appears in the list; after B1 signs in again `/admin` opens for them. Step 3: B1 leaves the list. Step 4: no Remove button on your own row. Step 5: "You can't remove the last Admin."
Data: `app_metadata.admin` set and removed for B1; `profiles.roles` mirrors it; audit rows; `self_demote` and `last_admin` answers.

### QA-S34-05 Integration status
Covers: S34.i.06 · Type: e2e and API · Role: AD1
Setup: Local fake mode; then with test keys; then with keys removed.
See: "Razorpay: Test double (fake)", "Test mode", "Not set up"; webhook secret set or missing; Email (Resend) and WhatsApp "Not set up" until their secrets exist; Instagram "Set up, switch off" when the switch is off.
Data: The `integrationStatus` response contains booleans and a mode word only; no key, secret or token substring appears in it.

## S35 Emails

### QA-S35-01 Buyer receipt
Covers: S35, S35.st.default, S35.tab.em-buyer, S35.i.06, S11.i.03 · Type: unit (`emails_pure.test.js`), e2e (fake provider) and sandbox (Resend test key, a real inbox) · Role: B1
Do: Pay an order with the `emails` switch on. Run `cron('emails')`.
See: Order-placed page: "A receipt is on its way to {B1's email}." Email: subject "Your CraftMe Order {code} is Paid", greeting by first name, the ship-by date, each line and amount, "Shipping within India: Included", total, the shipping address, a "View your Order" button to `/orders/<id>`, the reply line. Light background in a dark-mode mail client. A plain-text part exists.
Data: `email_outbox` row `buyer_paid:<order id>` goes `pending` to `sent` with a provider id.

### QA-S35-02 Artist new order
Covers: S35.tab.em-new, S35.i.03, S24.i.06 · Type: unit, e2e (fake), sandbox · Role: A1
See: Subject "New Order {code}: ship by {date}"; "{Buyer short name} in {city} paid for {n} items"; lines; "You receive (estimate)"; a button to `/dashboard/orders/<id>`; "The address is on the Order page, not in this email…". The street address, PIN and phone appear nowhere in the HTML or text part. The inbox empty state now says "…and you get an email."
Data: Row `artist_new_order:<order id>` sent.

### QA-S35-03 Artist payout sent
Covers: S35.tab.em-pay, S32.i.05 · Type: unit, e2e (fake), sandbox · Role: AD1, A1
Do: Record A1's payout row.
See: Subject "Your CraftMe Payout of ₹{net} was sent"; amount, masked destination, date, reference; order count and price paid; deductions; any Amount Owed taken or credit added; "Net Payout"; a button to `/dashboard/payouts`. The record dialog and recorded alert now mention emailed statements.
Data: Row `artist_payout_sent:<payout id>` sent. With A1's "Payment sent" preference off the row is `skipped` and nothing is sent.

### QA-S35-04 Once per recipient and event
Covers: S35.i.01 · Type: schema · Role: service
Do: Call `mark_paid` twice; deliver a duplicate webhook; run the email job twice at once; record a payout and call `record_payout` again.
See: —
Data: Exactly two rows per paid order and one per payout; each sent once (`for update skip locked`); no row for an order that never reached Paid, for an oversold auto-refund, or for a zero-net payout.

### QA-S35-05 Failures, retries and "not configured"
Covers: S35.i.02, S35.i.05, D15 · Type: schema and e2e (fake provider set to fail) · Role: service, AD1
Do: 1. Make the provider fail; pay an order; run the job six times, moving `next_attempt_at` back each time. 2. Look at S34, then press "Retry failed" with the provider working and run the job. 3. Remove the Resend key; pay an order; run the job; age the row 25 hours; run again. 4. Drop the outbox table and pay an order.
See: S34 shows "1 failed" with the provider's error text, then 0 failed after the retry.
Data: Step 1: the order is `paid` regardless; attempts 1 to 6 with growing delays, then `failed` with the error text; no further automatic attempt. Step 2: the row is `pending` with attempts 0, then `sent`; a Buyer calling `retry_failed_emails` gets `forbidden`. Step 3: the job answers `configured: false` and claims nothing; the aged row becomes `skipped` / `stale`. Step 4: the payment still succeeds (the trigger swallows its own error).

### QA-S35-06 No other screen promises email
Covers: S35.i.04 · Type: unit (a test that scans `src/` for "email" outside the switch helper) and e2e · Role: B1, A1, AD1
Setup: `emails` switch off.
See: S11, S24 empty state, S28, S32 dialog and recorded alert carry no email sentence. S14's submitted view says "notification" in both switch states.
Data: none.

## S36 UI kit

### QA-S36-01 Both themes on every screen
Covers: S36, S36.st.default, S36.i.01, SH.09 · Type: e2e (`e2e/visual.spec.js`) and manual review · Role: G, B1, A1, AD1 · View: all
Do: Toggle the theme from the account menu and from the footer. Visit every route in the route map in each theme and width; save screenshots.
See: The choice survives navigation and reload and wins over the system setting; with no stored choice the system setting is followed. No unreadable text, no hard-coded light surface in dark mode. Compare with `docs/screens/shots/` for layout, not pixels.
Data: `localStorage['cm-theme']`. An automated contrast check passes 4.5:1 for text on every page.

### QA-S36-02 Buttons, form controls, icons
Covers: S36.i.02, i.03, i.08 · Type: e2e (`e2e/ui-kit.spec.js`) · Role: B1
Do: On real screens: a saving button (profile save), a disabled button (delete dialog), a field with hint, error and counter (profile bio), a prefixed input (checkout phone), a select (State), checkbox and radio (damage form), option cards (payout method), quantity stepper (Cart), chips (Browse), code input (onboarding), dropzone (damage form).
See: Each has a visible label, a visible focus ring, the right disabled look, and announces its error (`aria-invalid`, described-by). Icon-only buttons have accessible names.
Data: none.

### QA-S36-03 Dialogs
Covers: S36.dlg.kmodal, S36.dlg.kalert, S36.i.09 · Type: e2e (`e2e/ui-kit.spec.js`, `e2e/a11y.spec.js`) · Role: B1 · View: 375 × 812 and 1280 × 800
Do: For one plain dialog (confirm received) and one alert dialog (delete account): open with the keyboard; Tab through twice; Shift+Tab; press Escape; reopen and click the backdrop; reopen and start saving, then press Escape.
See: Focus enters, cycles inside, and returns to the opener on close. Escape closes both. A backdrop click closes the plain dialog only. Nothing closes while saving. The page behind does not scroll. At 375 px the dialog is full width with stacked buttons. Roles are `dialog` and `alertdialog` with a labelled title.
Data: none.

### QA-S36-04 Toasts and feedback
Covers: S36.i.04, SH.10 · Type: e2e · Role: B1
Do: Trigger a success toast (save profile), an error toast (mark-all with a failed request), four toasts in a row; trigger an action whose request fails.
See: Success is announced politely, errors as alerts; each leaves after about 4 seconds or on its close button; at most three show. No success toast appears before the server answers, and none at all when the request fails.
Data: none.

### QA-S36-05 Tabs, stepper, timeline, pagination, breadcrumbs, menu
Covers: S36.tab.kt1, S36.tab.kt2, S36.i.05 · Type: e2e (`e2e/ui-kit.spec.js`) · Role: B1
Do: On My orders: move between tabs with Left, Right, Home, End; reload. On the order page: read the tracker and timeline of O2 and O9. On Browse: use the page numbers with the keyboard. Open the account menu with Down, move, Escape.
See: One tab is in the tab order at a time; `aria-selected` follows; the tab survives reload. The tracker marks done and current steps; the timeline is newest first. The current page has `aria-current="page"`; disabled ends cannot be focused. Menu behaviour as in QA-SH-02.
Data: none.

### QA-S36-06 Narrow widths and long content
Covers: S36.i.06, S36.i.10 · Type: e2e (`e2e/visual.spec.js`) · Role: A1, AD1, B1 · View: 375 × 812
Setup: A work titled with 100 characters and a 30-character unbroken word; an order of ₹10,00,00,000; a 60-character display name.
Do: Open Browse, the artwork page, Cart, the order page, the Artist's tables (artworks, orders, payouts), the Admin's tables (queues, orders, payout run), and one chart.
See: No sideways page scroll; long words wrap; tables scroll inside their own box or stack; amounts are not cut off; stat tiles and charts stay inside the viewport; star ratings and the rate input are usable by touch and keyboard.
Data: none.

## System rules

### QA-SYS-01 The sweep
Covers: SYS.01 · Type: schema · Role: service
Do: Prepare one row for each rule (see P12 section 5), run `select public.sweep()` twice.
See: —
Data: First run: the hold expires and its stock returns; one `ship_reminder`; `overdue` set; the order shipped 14 days ago becomes `received` with `received_at >= auto_receive_at`; the order past its damage window with no open report becomes `payable`, the one with an open report does not; the Artist owing for 60 days is restricted. Second run: every counter in the result is zero and nothing changes.

### QA-SYS-02 Fake provider mode cannot run in production
Covers: SYS.02, PD02 · Type: unit (provider seam) and e2e (API) · Role: developer
Do: Start the function with `PROVIDER_MODE=fake` and `APP_ENV=production`; call `placeOrder`, `confirmPayment` with the signature `fake`, and the webhook.
See: —
Data: Every command answers `unavailable` / `fake_mode_in_production`; no order is created; with `PROVIDER_MODE` unset, a `fake` signature answers `bad_signature`. At launch, repeat once on the live project (`production`).

### QA-SYS-03 Request replay
Covers: SYS.03 · Type: e2e (API) · Role: B1
Do: Send `placeOrder` twice with the same `requestId` at the same moment; again after it finished; send a command with no `requestId`; make the first run crash and retry after 61 seconds.
See: —
Data: One order. The concurrent second call answers `conflict` / `in_progress`; the later one returns the stored result byte for byte; the missing id answers `invalid`; the stale pending claim is taken over and runs once. A retryable failure (`unavailable`) frees the id so a retry runs again.
