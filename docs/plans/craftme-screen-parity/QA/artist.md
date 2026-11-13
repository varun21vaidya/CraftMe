# QA scripts: Artist dashboard

Format, fixtures and defaults are in [README.md](README.md).

## S21 Overview

### QA-S21-01 Overview for an active Artist
Covers: S21, S21.st.default, S21.i.01, i.02, i.03, i.05, i.07 · Type: e2e (`e2e/artist-orders.spec.js`) and schema · Role: A1 · Route: `/dashboard` · View: all
See: Date and greeting; "View my shop" and "Add Artwork"; four tiles; "Orders to ship 2" listing O3 first as "Overdue · was {date}" with "Ship now", then O2 with "in 7 days" and "Ship"; "Coming up for payment" with O14 (Shipped), O5 (Settling in) and O6 (Ready, the next run date); two recent reviews; recent activity. Clicking "Ship" opens `/dashboard/orders/<O2>`.
Data: The schema test compares `artist_dashboard()` for A1 with sums computed directly from the fixture rows (sales this month, next payout net from `payout_calc`). Called as A2 it returns A2's numbers only.

### QA-S21-02 Sales chart
Covers: S21.i.04 · Type: e2e · Role: A1 · Route: `/dashboard`
Do: Toggle "6 months", then "8 weeks".
See: Two lines, a legend ("Paid by Buyers", "You receive"), eight or 26 points; a hidden table under the chart carries the same numbers for screen readers; weeks with no sales show zero, not a gap.
Data: none.

### QA-S21-03 Owed and restricted banners
Covers: S21.st.owed, S21.st.restricted · Type: e2e · Role: A4, A3 · Route: `/dashboard`
See: A4: warning "₹3,200 will be taken from your next payment. A customer was refunded for order {O11 code} after you were paid." with "See details" to `/dashboard/payouts#owed`. A3: error alert "Your shop is paused. You have a balance of ₹3,200 to clear… Please still post your 1 open orders." with "Clear my balance". A manually restricted Artist sees the Admin's reason and no balance button.
Data: none.

### QA-S21-04 A brand-new Artist, and a failed load
Covers: S21.i.06, S21.i.08 · Type: e2e · Role: B1 just after QA-S18-05, A1
Do: Open `/dashboard` as the new Artist; as A1 with the dashboard read failing.
See: New Artist: tiles at ₹0 and 0, "No orders yet. Add your first Artwork to start selling.", checklist with "We're checking your details so you can be paid." and "Connect Instagram…". Failure: an alert with "Try again"; no zeros are shown in place of data.
Data: none.

## S22 My Artworks

### QA-S22-01 List, tabs, search, pages
Covers: S22, S22.st.default, S22.i.01, i.02, i.03, i.06 · Type: e2e (`e2e/artist-works.spec.js`) and unit (`src/lib/works.test.js`) · Role: A1 · Route: `/dashboard/artworks` · View: all
Do: Press each tab; type `kolam`; clear; go to page 2; reload on "Ended".
See: Counts match the fixtures: W1 and W2 Published, W3 Sold, W4 Draft ("No Listings yet", "Finish"), W5 Ended ("Reopen"). W1 shows two listing lines. Views and Updated columns are filled. Search narrows as typed. At 375 px rows become cards.
Data: Unit test: `workStatus` for each fixture shape.

### QA-S22-02 End and reopen
Covers: S22.dlg.end, S22.i.04 · Type: e2e and schema · Role: A1, G
Do: 1. Press "End" on W2, then "Keep selling". 2. Press "End", then "End Listings". 3. As G open `/artwork/<W2>` and `/browse`. 4. As A1 press "Reopen" on W2. 5. Press "Reopen" on a work whose only listing has no stock.
See: Step 1: nothing changes. Step 2: toast "Listings ended"; W2 moves to Ended. Step 3: not found; absent from Browse. Step 4: toast "Listings reopened"; W2's Print is live again; its sold Original stays Sold. Step 5: "Nothing left to sell. Add stock to a Listing first."
Data: Listings `ended` then `live`; O2 (a Paid order containing W2) is unchanged.

### QA-S22-03 Delete rules
Covers: S22.i.05, S23.dlg.del · Type: e2e and schema · Role: A1
Do: 1. Look at W3's row. 2. Delete the draft W4 from the list: "Keep it", then "Delete Artwork". 3. Open the editor of W1 and look at the danger zone. 4. Call `delete_artwork` for W1 directly. 5. Put an unsold work in another buyer's open hold and try to delete it.
See: Step 1: "Delete" disabled with "Artworks with sales can't be deleted". Step 2: W4 leaves the list with a toast. Step 3: no delete button, the sentence about ending Listings instead.
Data: W4 `removed`; its files gone from storage. Steps 4 and 5 answer `has_sales`.

### QA-S22-04 A restricted Artist
Covers: S22.i.07 · Type: e2e and schema · Role: A3 · Route: `/dashboard/artworks`
Do: Try "Reopen", "Add Artwork" and saving an edit.
See: The shop-paused alert on every dashboard page; Reopen answers "Your shop is paused, so Listings can't be reopened."; the editor is disabled.
Data: Inserts and updates are refused by policy; `publish_artwork` answers `artist_restricted`.

### QA-S22-05 Empty
Covers: S22.st.empty · Type: e2e · Role: a new Artist · Route: `/dashboard/artworks`
See: "Your wall is empty…" with "Add your first Artwork" opening `/dashboard/artworks/new`. A search with no match shows "Nothing here."
Data: none.

## S23 Artwork editor

### QA-S23-01 Create a work and publish
Covers: S23, S23.st.default, S23.i.01 · Type: e2e (`e2e/artwork-editor.spec.js`) · Role: A1 · Route: `/dashboard/artworks/new` · View: all
Do: Title "Temple Bells", Category "Paintings", Year 2026, Medium "Acrylic on canvas", Signed "On the back", Description "A small study.", two JPEG photos, one Original listing (Size "30 × 40 cm", Medium "Acrylic, unframed", Price 12000), press "Publish Artwork".
See: Counters under Title and Description; the checklist ticks turn on one by one; after publishing, the status badge reads Published and "View" opens the public page with the wall label filled.
Data: `artworks` row `published` with year, medium, signed, two photo URLs; one `listings` row `live`, kind `original`, price 1200000, stock 1; `from_price_paise` 1200000, `available` true.

### QA-S23-02 What stops publishing
Covers: S23.st.errors, S23.i.06 · Type: e2e and schema · Role: A1 · Route: `/dashboard/artworks/new`
Do: 1. Press "Publish Artwork" on the empty form. 2. Add a title and category only, press Publish. 3. As A2 (unverified) open the editor.
See: Step 1: "Add a title and category to save a draft." Step 2: alert "2 things stop you publishing" listing photos and listings as links; inline "Add at least one photo." and "Add at least one Listing with a price." Step 3: the note "We're checking your details. You can publish now, and you'll be paid once that's done."
Data: `publish_artwork` on such a draft answers `invalid` with `fields: ["photos","listings"]`.

### QA-S23-03 Listings dialog
Covers: S23.dlg.lst, S23.i.04, S23.i.05, KD05 · Type: e2e and schema · Role: A1 · Route: `/dashboard/artworks/<W1>`
Do: 1. Press "Add Listing". 2. Look at the type cards. 3. Choose "Ready-made item", Size "A4 frame", Medium "Wood", Price `0`, Stock `0`, save. 4. Price `900`, Stock `5`, save. 5. Edit the Print: set Stock below the number currently held. 6. Press "End" on the new listing, then "Reopen".
See: Step 2: Original is disabled (W1 has one). Step 3: "Enter a price of at least ₹1." and "Enter how many you have, from 1 to 1000." Step 4: "What you'd receive: about ₹{n}" appears with the word estimate; the row is added as Live. Step 5: "{n} are in someone's checkout right now." and the save is refused. Step 6: status Ended, then Live.
Data: Listing rows as described; a second Original is refused by the unique index; `earnings_estimate(90000)` equals price minus commission at the current rate minus 2.36%.

### QA-S23-04 Photos: add, remove, reorder
Covers: S23.i.02 · Type: e2e · Role: A1 · Route: `/dashboard/artworks/<W1>`
Do: 1. Move photo 3 to first with the "Move earlier" button, using the keyboard. 2. Remove photo 2. 3. Add three files (one 6 MB). 4. Save.
See: The first tile carries "Cover"; "4 of 5 added"; the oversize file is refused by name; after saving, the public page shows the new cover first.
Data: `artworks.photos` is the new order; the removed photo's file is gone from storage; no more than five entries.

### QA-S23-05 Video or reel
Covers: S23.i.03, PD06 · Type: e2e · Role: A1 · Route: `/dashboard/artworks/<W2>`
Do: 1. Choose "Instagram reel", paste `https://example.com/video`, press "Check link". 2. Paste `https://www.instagram.com/reel/Cx9aB2_demo/`, check, save. 3. Choose "Upload a video", pick a 60 MB MP4, then a 4-minute 20 MB MP4, then a 20-second 5 MB MP4, save.
See: Step 1: "That isn't an Instagram post or reel link." Step 2: "Link looks right"; the public page shows the reel slide. Step 3: "Videos can be up to 50 MB.", "Videos can be up to 3 minutes."; the third uploads and the public gallery shows a video slide; the reel is no longer attached.
Data: Step 2: a `reels` row, not highlighted, and `artworks.reel_id` set. Step 3: `artworks.video` set and `reel_id` null.

### QA-S23-06 Save draft, preview, failed save
Covers: S23.i.07, S23.i.08 · Type: e2e · Role: A1, G
Do: 1. New work: title and category, "Save draft". 2. Press "Preview". 3. As G open the preview URL. 4. Add two photos and save with the row update made to fail. 5. Change the title and try to leave the page.
See: Step 1: "Saved {time}", badge Draft. Step 2: a new tab with the public layout and the banner "Preview. Buyers can't see this until you publish." Step 3: not found. Step 4: "We couldn't save. Try again."; the photos are still in the form. Step 5: the browser asks before leaving.
Data: After step 4 the `artworks` bucket holds no file from that attempt.

### QA-S23-07 Publishing twice makes no duplicate
Covers: S23.i.09 · Type: schema and e2e · Role: A1
Do: Double-click "Publish Artwork"; then make the first publish call time out and press it again.
See: One success state.
Data: One artwork, the same listings as before; `publish_artwork` twice leaves every count unchanged.

### QA-S23-08 Sold listings, other Artists, unknown ids
Covers: S23.i.10, S23.i.11 · Type: schema and e2e · Role: A1, A2
Do: 1. Open W2's editor and look at the sold Original row. 2. As A2 open `/dashboard/artworks/<W1>`. 3. Open `/dashboard/artworks/not-a-uuid`. 4. As A2 call `end_artwork`, `publish_artwork`, `set_listing_stock` on A1's rows.
See: Step 1: the row is read-only. Steps 2 and 3: the 404 page.
Data: Step 4: `forbidden` each time; nothing changes.

## S24 Order inbox

### QA-S24-01 Tabs, columns, overdue
Covers: S24, S24.st.default, S24.i.01, i.02, i.03 · Type: e2e (`e2e/artist-orders.spec.js`) and schema · Role: A1 · Route: `/dashboard/orders` · View: all
Do: Press each tab; reload on "Shipped".
See: "To ship 2": O3 first ("Overdue · was {date}", "Ship now"), then O2 ("in 7 days", "Ship"). Buyer column "Rahul N." and "Ananya V." with the city. "You receive" shows an amount and the estimate note below the table. Shipped lists O14. Counts match `artist_order_counts()`.
Data: The row's amount is the `order_net` field returned with the order; the schema test shows it equals `payout_calc` for O2 alone.

### QA-S24-02 Empty, error, paging
Covers: S24.st.empty, S24.i.07 · Type: e2e · Role: a new Artist, A1
Do: Open as a new Artist; as A1 with the read failing; with 45 extra received orders.
See: "No Orders to ship. When a Buyer pays for one of your Listings, the Order appears here." with "Check my Listings" and no mention of email while the switch is off; an alert with "Try again"; 20 per page.
Data: none.

### QA-S24-03 Holds and other Artists' orders stay out
Covers: S24.i.04, S24.i.05 · Type: schema and e2e · Role: A1, A2
See: O1 (a hold on A1's listing) appears in no tab and is not counted. A2's inbox lists only O4 and O13.
Data: A2 selecting `orders` where `artist_id = A1` gets zero rows.

## S25 Order, Artist view

### QA-S25-01 A Paid order
Covers: S25, S25.st.paid, S25.i.01, i.02, i.03 · Type: e2e and schema · Role: A1 · Route: `/dashboard/orders/<O2>` · View: all
Do: Press "Copy address".
See: "Paid {date, time} by Ananya V., Mumbai"; "Ship by {date}, in 7 days. If it isn't Shipped by then the Order becomes Overdue and CraftMe reviews it…"; pack list with both lines, "Buyer paid ₹6,900" and "Gift note for the packing slip: Happy birthday"; "Ship to" with "Only you see this", the full address and phone, and the use notice; "What you receive". Toast "Copied".
Data: The clipboard holds the address without the phone number.

### QA-S25-02 Mark as Shipped
Covers: S25.dlg.ship, S25.i.08 · Type: e2e and schema · Role: A1 · Route: `/dashboard/orders/<O2>`
Do: 1. Open the dialog, press "Mark as Shipped" with no courier. 2. Choose "Other", type "Shree Maruti", leave tracking empty, confirm. 3. In a second tab still showing the Paid view, mark it shipped again.
See: Step 1: "Choose a courier." Step 2: "Saving…", then the Shipped view with "Shree Maruti" and no tracking line; the button is now "Edit tracking". Step 3: toast "This Order was already marked Shipped." and the page reloads.
Data: Order `shipped`, `shipped_at` now, `auto_receive_at` 14 days on, `tracking_number` empty; B1 has an `order_shipped` notification; the second call answered `wrong_stage`.

### QA-S25-03 Shipped view and editing tracking
Covers: S25.st.shipped, S25.i.05, S25.i.06 · Type: e2e and schema · Role: A2 · Route: `/dashboard/orders/<O4>`
Do: Press "Edit tracking", change the number to `DT999`, save. Then confirm receipt as B1 and try to edit again.
See: The Shipment block with a copy button; the timeline "You marked it Shipped" and "Waiting for the Buyer to confirm Received, auto-received {date}". After the edit: toast and the new number on both the Artist's and the Buyer's page. After receipt: no edit button; a direct call says "This Order has already arrived."
Data: `tracking_number 'DT999'`; `shipped_at` unchanged; B1 got `tracking_updated`.

### QA-S25-04 Who may open it
Covers: S25.i.07 · Type: schema and e2e · Role: A2, A1
Do: As A2 open `/dashboard/orders/<O2>`; as A1 open `/dashboard/orders/<O1>` (a hold).
See: The 404 page both times.
Data: A1 selecting `order_shipping` for O1 gets zero rows.

### QA-S25-05 What you receive
Covers: S25.i.04 · Type: schema · Role: A1
Do: Compare the panel on O2 (paid), O8 (partly refunded) and O7 (paid out).
See: Buyer paid; Refunds where any; "CraftMe's share and payment cost"; "You receive". O7 adds "Paid to you on {date}, reference 3048827711".
Data: Each "You receive" is the order's `order_net`. The schema test shows `order_net` equals `payout_calc(array[order], 0).net` for zero refunds, a partial refund, a full refund (zero), and a gateway fee larger than the remainder (zero, never negative).

### QA-S25-06 Received and Refunded variants
Covers: S25.i.09 · Type: e2e · Role: A1 · Route: `/dashboard/orders/<O6>`, `/dashboard/orders/<O9>`
See: O6: "Received {date}." and "In your {next run date} payment"; address still shown. O9: "Refunded to the Buyer: ₹{total}." with the reason; no "Ship to" panel (the database no longer returns it); no ship button.
Data: none.

## S26 Payouts

### QA-S26-01 Payouts page
Covers: S26, S26.st.default, S26.i.01, i.02 · Type: e2e (`e2e/payouts.spec.js`) and schema · Role: A1 · Route: `/dashboard/payouts` · View: all
See: Four tiles; "In your {date} payment" with O6's row (Price, CraftMe's share, Payment cost, Refunds, You receive) and a total equal to the first tile; "To come off your next payment ₹0"; history with P1.
Data: `artist_payout_view()` for A1 equals `payout_calc` over A1's payable unpaid orders; called as A2 it never includes A1's rows.

### QA-S26-02 History and statement
Covers: S26.dlg.stmt, S26.i.03, S26.i.05 · Type: e2e · Role: A1 · Route: `/dashboard/payouts`
Do: Press "Statement" on P1; close with Escape.
See: "Payout statement, {date}", "Reference 3048827711 · sent to m•••@…", one row for O7, a total, "Paid to you ₹{net}" equal to the history row. No sentence about rounding. Focus returns to the button.
Data: The statement total equals `payouts.net` for P1.

### QA-S26-03 Next payout and masked destination
Covers: S26.i.04 · Type: unit (`src/lib/money.test.js`) and e2e · Role: A1
See: "Next Payout {date}" is the next 1st or 15th after today, "in {n} days"; "Sent to" shows a masked UPI id; "Change payout details" opens `/dashboard/settings`.
Data: Unit: `nextPayoutDate` for the 1st (same day before the run counts as today), the 2nd, the 15th, the 16th, the 31st and across a year end. The page shows the destination only through `mask()`; the full value never appears in the DOM.

### QA-S26-04 Pay an Amount Owed
Covers: S26.st.owed, D10 · Type: e2e (fake provider), schema, and sandbox (Razorpay test keys) · Role: A3 · Route: `/dashboard/payouts`
Do: 1. Read the alert. 2. Press "Pay ₹3,200 now", choose Close. 3. Press it again, choose Pay.
See: Step 1: "₹3,200 will be taken from your next payment… You can also pay it now." Step 2: nothing changes. Step 3: "Confirming your payment…", then the alert is gone, toast "Balance cleared.", the shop-paused alert is gone, "To come off your next payment ₹0". (An Admin could also have lifted it by override, QA-S33-04; payment is the Artist's own way.)
Data: One `owed_payments` row, amount 320000, reused between steps 2 and 3, status `paid`, applied 320000; `amount_owed` 0, `owed_since` null; `profiles.restricted` false and A3's works visible again; an `audit_log` row `owed_payment_settled`. The amount charged in the provider is exactly 320000 (no fee added).

### QA-S26-05 Late, duplicate and excess payments become credit
Covers: S26.i.06, D10a · Type: schema and e2e (fake provider) · Role: A4
Do: 1. Start a payment for ₹3,200 and leave it pending. 2. Record A4's payout so the debt is deducted. 3. Deliver the webhook for the pending payment. 4. Deliver the same webhook again. 5. Refund another paid-out order of A4 for less than the credit.
See: After step 3 the page shows "Credit of ₹3,200 will be added to your next payment."
Data: Step 3: attempt `credited`, `credit` 320000, `amount_owed` 0, no provider refund. Step 4: nothing changes. Step 5: the new Amount Owed is taken from the credit first. The next recorded payout has `credit_added` equal to what remains and `credit` returns to 0.

### QA-S26-06 Not yet verified
Covers: S26.i.07 · Type: e2e and schema · Role: A2 · Route: `/dashboard/payouts`
See: "We're still checking your details. Payments start once that's done. Your Orders keep adding up."; the payable table lists A2's order.
Data: `build_payout_run` lists A2 under `blocked` and makes no payout row for A2.

### QA-S26-07 Refund after payout; debt larger than the payable net
Covers: S26.i.08 · Type: schema · Role: service
Do: Refund a line of O7 (already paid out). Then build a run where the Artist's payable net is smaller than the debt.
See: —
Data: `amount_owed` rises by the refund minus the commission given back; `owed_since` set once; the run has `owed_deducted` equal to the available net, `net` 0, and the remainder stays owed after recording.

### QA-S26-08 Empty and private
Covers: S26.i.09 · Type: e2e and schema · Role: a new Artist, B1
See: New Artist: "No Orders are ready for this payment yet." and "No Payouts yet." B1 opening `/dashboard/payouts` is redirected.
Data: B1 selecting `payouts` or `owed_payments` gets zero rows.

## S27 Instagram

### QA-S27-01 Connect with a real Meta test account
Covers: S27, S27.st.disconnected, S27.i.01 · Type: sandbox · Role: a test Artist · Route: `/dashboard/instagram`
Do: Press "Connect Instagram", sign in with a test creator account, approve.
See: The card explains read-only access and the Business or Creator rule. After approval the page shows "@{username}", "Connected".
Data: One `instagram_accounts` row with an encrypted token; `profiles.instagram_verified` true. The browser never receives the token (check the network tab).

### QA-S27-02 Popup blocked, cancelled, personal account
Covers: S27.i.02, S27.i.03, KD07 · Type: sandbox and e2e (simulated return URLs) · Role: A1
Do: 1. Block popups and press Connect. 2. Press Cancel at Meta. 3. Return with `?instagram=error&reason=no_account`. 4. Return with `reason=expired` and `reason=already_linked`.
See: Step 1: the same tab goes to Meta and comes back to the page. Step 2: "Instagram access was not approved." Step 3: the personal-account explanation. Step 4: the matching messages. The query is removed from the address bar each time.
Data: No account row in any of these.

### QA-S27-03 Connected: manage the Showcase
Covers: S27.st.connected, S27.i.04 · Type: e2e (`e2e/instagram.spec.js`, fake provider) and schema · Role: A1 · Route: `/dashboard/instagram`
Setup: A1 connected, 3 highlighted rows.
Do: 1. Press "Move later" on the first tile. 2. Reload. 3. Remove an imported tile. 4. Make the reorder call fail and move a tile.
See: "3 of 9 used."; the order changes and survives the reload; the public profile shows the same order; removing updates the count; in step 4 the tile snaps back with an error toast.
Data: `position` values 0, 1, 2 without gaps after step 1; the removed import's row and cover file are gone. A tenth highlighted row is refused (`showcase_full`).

### QA-S27-04 Picker: filters, cap, older posts, duplicates
Covers: S27.st.picker, S27.i.05, S27.i.06 · Type: e2e (fake provider) · Role: A1
Setup: Showcase has 7 rows. The fake account has 6 media on page one (3 reels, 3 posts, one already imported) and 4 on page two.
Do: 1. Press "Pick posts". 2. Press "Posts", then "All". 3. Select tiles until no more can be selected. 4. Press "Load older posts". 5. Press "Add to Showcase". 6. Open the picker again.
See: Step 2: three tiles, then six. The imported tile is marked "Already added" and cannot be selected. Step 3: after two selections the rest are disabled; "2 selected (up to 9 in total)". Step 4: four more tiles; the button disappears. Step 5: "Added 2."; "9 of 9 used."; "Add more" is gone. Step 6: all tiles disabled with "Your Showcase is full."
Data: Two new rows with `ig_media_id`, `verified` true, `kind` set from the media type, `highlighted` true.

### QA-S27-05 Disconnect deletes imports and keeps pasted links
Covers: S27.dlg.disc, D09 · Type: e2e (fake provider) and schema · Role: A1 · Route: `/dashboard/instagram`
Setup: 2 imported rows (one linked to W1) and 1 pasted row.
Do: 1. Press "Disconnect", then "Keep connected". 2. Press it again, read the text, press "Disconnect and delete".
See: The dialog says imports are deleted and pasted links stay. After step 2: toast, the not-connected state, the Showcase shows the pasted link only; W1's public page has no reel.
Data: No `instagram_accounts` row; no row with `ig_media_id`; their cover files removed; the pasted row intact; `artworks.reel_id` null for W1; `instagram_verified` false; the handle text unchanged.

### QA-S27-06 Access lapsed
Covers: S27.st.lapsed · Type: e2e (fake provider's dead-token id) · Role: A1
Do: Press "Pick posts" while the fake account reports a dead token.
See: The warning "Instagram access has ended…" with "Reconnect Instagram"; badge "Expired"; no "Pick posts"; existing Showcase tiles still listed and still public. A1 gets an `instagram_reconnect` notification.
Data: `needs_reconnect` true on the account and the profile.

### QA-S27-07 Connect switched off or not configured
Covers: S27.st.disabled · Type: e2e · Role: A1
Setup: Run A: switch `instagramConnect` false. Run B: Meta secrets absent.
See: Both: "Connecting Instagram isn't available yet. You can still add posts and reels by pasting their links below." and a working paste form; no Connect button.
Data: `instagramStatus` returns `enabled: false`.

### QA-S27-08 Paste a link; link it to an Artwork; the Artwork reels list
Covers: S27.i.07, S27.i.08 · Type: e2e and schema · Role: A1 · Route: `/dashboard/instagram`
Do: 1. Paste `https://example.com/video`, press Add. 2. Paste `https://www.instagram.com/p/Cabc123/` without ticking the ownership box. 3. Tick it, choose "Show on my profile only", Add. 4. Paste a reel link, choose "Kolam at Dawn", Add. 5. In "Reels on your Artworks" press "Change" on W1.
See: Step 1: "That isn't an Instagram post or reel link." Step 2: the ownership message. Step 3: a new "Post" tile in the Showcase. Step 4: the Showcase count does not change; W2's row reads "Reel linked". Step 5: a picker of A1's links.
Data: Step 3 row: `kind 'post'`, highlighted. Step 4 row: not highlighted; `artworks.reel_id` for W2 set. Linking another Artist's reel is refused (`reel_not_yours`).

### QA-S27-09 Meta removes access or asks for deletion
Covers: S27.i.09, KD07 · Type: unit (`instagram_pure.test.js` for the signed request) and sandbox · Role: a test Artist
Do: In Instagram's settings remove the CraftMe app. Separately, trigger Meta's data-deletion request for the test user.
See: The Artist's page returns to not connected. The deletion callback's URL opens the status page showing the date and the code.
Data: Same end state as QA-S27-05; an `instagram_deletions` row with `done_at`. A callback with a bad signature answers 400 and changes nothing.

## S28 Artist settings

### QA-S28-01 Settings page
Covers: S28, S28.st.default, S28.i.01, i.02, i.06 · Type: e2e (`e2e/artist-settings.spec.js`) · Role: A2, A1 · Route: `/dashboard/settings` · View: all
See: A2: "CraftMe is checking", timeline with dates and a masked phone, current step "CraftMe checks your details". A1: "Verified {date}". "Where we pay you" shows legal name, PAN as `ABCDE••••F`, a masked destination, and the lock note. "Account status" with Role, Shop, Instagram and the agreement link.
Data: No element on the page contains the full PAN or destination (the values are the Artist's own and are masked for display). As A2 or B1, a select on A1's `artist_private` row returns nothing.

### QA-S28-02 Change payout details
Covers: S28.dlg.pay · Type: e2e and schema · Role: A1
Do: Press "Edit", enter UPI `meera.new@okaxis`, press "Save and send for checking".
See: The warning "Payments wait until we have checked your new details."; toast "Sent for checking"; the timeline returns to checking; the Payouts page shows the not-verified notice.
Data: `payout_method` updated; `verified_at` null; `profiles.verified` false; the next `build_payout_run` blocks A1 until an Admin verifies again.

### QA-S28-03 Shop profile
Covers: S28.i.03 · Type: e2e · Role: A1
Do: 1. Change the display name, city and a 301-character bio; save. 2. In Profile link type `Meera Paints!`, press "Change link". 3. Type `tanvi-rao` (A4's). 4. Type `meera-paints`, press "Change link", copy it. 5. Open `/artist/meera-paints`, then `/artist/meera-iyer`.
See: The bio stops at 300; toast "Shop profile saved"; the public profile shows the changes; the link still reads `meera-iyer` after the name change. Step 2: "Use 3 to 30 letters, numbers and hyphens." Step 3: "That name is taken." Step 4: toast "Profile link changed"; the clipboard holds `{origin}/artist/meera-paints`. Step 5: the first redirects to `/artist/<A1 id>`; the second shows "We couldn't find this Artist".
Data: `profiles` updated for A1 only; `slug` is `meera-paints`; A1's id, orders, works and reviews are untouched; `set_artist_slug` called by a Buyer answers `forbidden`; a direct `update profiles set slug` by A1 is refused.

### QA-S28-04 Email preferences
Covers: S28.i.04, PD18 · Type: e2e and schema · Role: A1
Do: Turn "Payment sent" off; reload; try to change "New Order" and "Review approved".
See: The switch stays off after reload; the other two are disabled with their explanations.
Data: `email_prefs.payout_sent` false. `set_email_pref('order_new', false)` answers `invalid`. With the preference off a recorded payout creates a `skipped` outbox row (after P11).

### QA-S28-05 Close shop
Covers: S28.i.05, PD17 · Type: e2e and schema · Role: A1, then an Artist with nothing open
Do: 1. As A1 look at the section. 2. As an Artist with no open orders, no report, nothing payable and nothing owed, press "Close my shop", "Keep my shop", then again and confirm.
See: Step 1: button disabled, "2 Orders still need shipping." Step 2: redirect to `/profile`, toast "Your shop is closed."; the account menu offers "Become an Artist" again.
Data: `close_shop` for A1 answers `shop_not_clear` with `open_orders`. Step 2: listings `ended`, artworks hidden, `app_metadata.artist` removed, `profiles.roles` without `artist`, the onboarding fee record untouched, an audit row.

### QA-S28-06 Restricted editing; buying after closing
Covers: S28.i.07 · Type: e2e · Role: A3, the closed Artist
Do: As A3 change the bio and payout details. As the closed Artist buy W6.
See: A3 can save both under the shop-paused alert. The former Artist checks out normally.
Data: A3's works stay hidden.
