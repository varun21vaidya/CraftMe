# CraftMe screen coverage — detailed acceptance inventory

This expands the [coverage audit](SCREEN_COVERAGE_AUDIT.md) at app commit `0815969`. Each entry links to the checked-in HTML for the [Claude reference](https://claude.ai/artifact/9gvXp25jEJw3bMJdhugrmJ). The [registry](screens/data.js) names the switchable states. The [demo runtime](screens/ui.js) uses `data-s` to show state content, `data-open` to open dialogs, and `data-demo` / `data-toast` to simulate actions. A mock button or example total is not proof of a live operation. Amounts, dates, names and counts in the mock are fixtures unless an accepted policy establishes the rule.

**How to read:** **Reference** inventories what the design shows, including controls inside dialogs. **App** records evidence and differences. **Acceptance** adds verification cases; these are proposed checks, not extra reference states or implementation claims. A scenario can be implemented in a different route or module and still meet the outcome. Live provider behavior and visual parity are unverified.

## Storefront

### S01 · Home — [reference](screens/home.html)

- **Reference:** Default landing page with original art hero, Browse art and Sell your art entry points, categories, original-versus-print explanation, buying in three steps (pay, receive from artist, confirm arrival), FAQ, artist callout and final browse CTA. Footer links category browsing, buying help, refunds, artist agreement, terms/privacy and deletion. FAQ covers artist shipping within seven days, paid order cancellation through support, one artist per parcel, India-only delivery, and reviews from received orders subject to moderation.
- **App:** `/` and `/browse` share Browse. Footer and brand are present. Landing content and section links are missing. Seller entry remains explicitly deferred.
- **Acceptance:** Category links open their matching filters; anchor navigation works with the sticky header; empty or missing featured media does not break entry to Browse. FAQ and policy links reflect accepted rules.

### S02 · Browse — [reference](screens/browse.html)

- **Reference:** Results, Loading, No results. Result count, sort by newest, both price directions and highest-rated artist; filters for text (title, artist or medium), categories, original/print, min/max price, three quick price bands, artist and hide sold originals. Selected chips, filter count, clear-all, numbered pagination, skeletons, and empty recovery via clearing filters or browsing everything.
- **App:** Category groups and catalogue paging, header search with Artworks/Artists views, URL query/category, skeleton or search status, empty and retry. Search matches title in Artworks and name in Artists. No in-results medium search, combined type/price/artist filters, rated sort, or numbered parity. Existing catalogue includes stocked products, so type filters need a mapping.
- **Acceptance:** Combine filters and sort, remove one chip, clear all, refresh/back, tie-break equal values, handle inverted range and zero matches. Separate empty from fetch failure and avoid stale results when query or category changes. Decide how “hide sold originals” treats work with live prints.

### S03 · Artwork — [reference](screens/artwork.html)

- **Reference:** Available, Original sold, Viewed by its Artist, Cart clash dialog. Breadcrumbs and wall label (year, medium, size, category, signature, ships-from, code); photo/video/reel, artist summary and reviews, related works and category link. Original and print show attributes and stock; original quantity stays one, print quantity and shipping-inclusive total vary. Sold original still leaves prints purchasable. Owner gets edit link and cannot buy. Add to Cart and Buy now; trust copy covers shipping, hold and damage window.
- **Reference dialogs:** Report reason choices for copied work, mismatch, offensive content and other, optional 500-character details, anonymity from the artist, cancel/send. Cart clash names the outgoing work and artist, explains one parcel, and offers keep or replace; mock replacement discards the cart.
- **App:** Artwork route, carousel and reel fallback, version choice, cart, owner path, related artist link, wishlist and collection actions. Report UI and full wall-label/review/related-work parity are missing or incomplete. Cart switch intentionally saves outgoing work.
- **Acceptance:** Sold original plus live print, all listings sold, quantity at stock limits, guest sign-in return, owner purchase denial, missing media or blocked reel, removed/restricted work, cancel/confirm cart switch, invalid/repeated report. State whether Buy now goes to checkout and test that it honors the same conflict rules.

### S04 · Artist profile — [reference](screens/artist-profile.html)

- **Reference:** With Instagram and No Instagram. Avatar, verification badge, specialty, city/state, joined date, rating/count, bio, copy link, report, artwork/orders-shipped/average-shipping stats. Artworks, Showcase, Reviews, About tabs. All/Originals/Prints/Sold catalogue filters; ordered Instagram posts and reels, lazy embeds, follow/open links, no-content message. Review histogram, received-order badge, dates and pagination. About panel explains verification and shipping. Report dialog has impersonation/stolen work, mismatch, offensive content and other reasons, optional details, cancel/send.
- **App:** Public profile, photo/bio, rating summary, Instagram highlights, sold works and owner/restricted variants. Public approved reviews, histogram, stats, report, copy and complete filter/tab parity remain.
- **Acceptance:** Unknown or non-artist profile, missing bio/photo/ratings, no available works, private or deleted reel, restricted shop and owner view, only approved reviews in public counts, report acknowledgement.

## Account and legal

### S05 · Log in — [reference](screens/login.html)

- **Reference:** Default and Wrong password. Google plus email/password, reset and signup links, keep-me-logged-in control, invalid-credentials alert and inline wrong-password hint with attempts before temporary lock.
- **App:** Google-only login by documented choice. Email form, attempt counts and reset are outside that choice.
- **Acceptance:** Verify Google consent cancellation/failure, protected-route return, and existing vs new account behavior. If password auth returns, define session persistence and lockout with provider behavior and avoid leaking account existence.

### S06 · Sign up — [reference](screens/signup.html)

- **Reference:** Default and Validation errors. Google or name/email/password/confirmation; password-strength indicator and eight-character minimum; terms/privacy/refund acknowledgement; invalid email, short password and missing consent displayed together; existing account link.
- **App:** Google sign-in creates the initial profile; no signup page or consent flow equivalent.
- **Acceptance:** If email auth is adopted, test password mismatch, malformed email, duplicate account, missing acknowledgement and retry. Decide how to record policy acceptance for Google sign-in as well.

### S07 · Reset password — [reference](screens/reset.html)

- **Reference:** Request and Link sent. Email request, one-hour link guidance, neutral “if an account exists” response, spam hint, 30-second resend countdown, and back to login.
- **App:** No password reset under Google-only sign-in.
- **Acceptance:** If enabled, verify unknown and known email responses match, resend throttling, expired/used links, and return to login after reset. The actual reset completion form is additional coverage beyond these two mock states.

### S16 · Buyer profile — [reference](screens/profile.html)

- **Reference:** Profile photo upload/remove (JPEG/PNG up to 5 MB), name, immutable Google email, optional +91 phone, 200-character bio, save changes. Saved address editor and checkout prefill, with earlier orders retaining their own address snapshot. Google accounts see password explanation; email accounts see current/new password. Roles, seller entry, orders/notification/privacy shortcuts. Destructive deletion dialog requires typing DELETE and explains sign-out, deletion within 30 days and retained anonymized order/review records.
- **App:** No buyer profile route. Artist editor and order-specific checkout address are separate.
- **Acceptance:** Owner-only saved address, invalid upload and partial save, editing address after checkout, mismatched deletion confirmation, a deletion request with open orders, and preserved order accounting after anonymization. Align deletion policy before implementing.

### S17 · Notifications — [reference](screens/notifications.html)

- **Reference:** List and Empty. All, Unread with count, Orders, Reviews; Today/Earlier groups, New marker, pagination and mark all as read. Example events: shipped with tracking, payment received, review approved, review prompt, refund issued, and automatic receipt with review time remaining. Empty state links Browse.
- **App:** Header bell, read marking and order links. No full archive route or equivalent filters.
- **Acceptance:** Verify unseen vs already-read, count synchronization, mark-all failure and retry, event with missing or inaccessible target, and order or review link routing. Validate notifications against actual producers.

### S18 · Become an Artist — [reference](screens/become-artist.html)

- **Reference Details:** Same account keeps buying. Private legal name/PAN, city/state, UPI or bank payout fields (holder, IFSC, account and confirmation), short shop bio and categories, own-work declaration, age and artist agreement, cancel/continue.
- **Reference Phone check:** Six-digit SMS code, ten-minute validity, resend countdown, change number and back. **Fee:** Nonrefundable acknowledgement, fee amount and Razorpay action, what opens immediately and what stays under verification. **Done:** Buyer/artist role coexistence, dashboard, first artwork, optional Instagram, verification pending before payout.
- **App:** Deferred by decision. Server has verification details, fee and role primitives. A complete user-facing OTP flow is not established by this audit.
- **Acceptance if reopened:** Wrong/expired codes, resend/number change, UPI vs bank validation, cancelled or duplicate payment, late confirmation, resume after reload, restricted applicant and refresh of role claims. Resolve fee and seller-entry policy before shipping.

### S19 · Legal — [reference](screens/legal.html)

- **Reference:** Tabs/deep links for terms, privacy, refunds/payouts, artist agreement and deletion. Terms cover account roles, purchase/hold/cancellation, reviews and reporting; privacy covers address visibility, payment provider, PAN/payout data and Instagram access. Refund and payout copy includes damage/overdue, original payment method, after-receipt eligibility, owed balance and restriction. Deletion distinguishes account anonymization, Instagram disconnect/provider revocation, and request form with “Everything” vs “Only my Instagram data”. Reference labels copy as draft.
- **App:** Privacy and Instagram data-deletion routes only. No equivalent combined policy hub, general deletion form or accepted terms/refund/artist agreement routes in the route map.
- **Acceptance:** Resolve source of truth for policy dates and business rules. Test deep links, fallback for inaccessible profile, deletion request failure, and provider revocation status. No mock policy text should silently become production policy.

### S20 · Not found — [reference](screens/not-found.html)

- **Reference:** 404 states that the page moved or the work was taken down; search, Home and Browse recovery.
- **App:** Wildcard route has a home action; shared navigation/search supplies some recovery. Resource pages have separate not-found handling.
- **Acceptance:** Unknown route, malformed artwork/artist/order ID, taken-down work, unauthorized order and network failure. Do not reveal existence of private records in error copy.

## Buying

### S08 · Cart — [reference](screens/cart.html)

- **Reference:** With items, Empty, Price changed. One-artist summary, artist location/rating/shipping, link to profile, per-line type/details/stock/quantity/remove/unit and total, shipping included, checkout, trust note and optional gift note. Price-changed banner shows old/new price and an original sold to someone else and removed, then asks buyer to accept new prices. Empty state offers Browse art.
- **App:** Cart lines and live totals, active/saved separation, group/item restore and switch confirmation. Checkout can reject stale price, but cart lacks explicit old/new acknowledgement, the sold-removal notification, gift note and full artist summary.
- **Acceptance:** Quantity decreases to zero, original max one, unavailable or held stock, old/new price snapshot, sold line mixed with live lines, empty active cart with saved items, restore cap/excess, failing switch and refresh replay. Confirm saved lines never reach checkout.

### S09 · Checkout — [reference](screens/checkout.html)

- **Reference:** Default, Address errors, Hold expired. Address/Pay/Done indicator, full name, +91 phone, address lines, optional landmark, PIN/city/state and address save. Error summary plus inline 10-digit phone, six-digit/unserved PIN, and missing state. India-only and seller-address privacy notice. Itemized summary and edit-cart link; payment methods, terms/refund consent, hold countdown. On expiry disable payment and return to cart for availability check.
- **App:** Required name/phone/address/city/state/PIN, backend hold, countdown, return-to-cart expiry and Razorpay. No dedicated optional line/landmark, address save/prefill, PIN-assisted city/state/serviceability, consent/progress parity, or reference review panel.
- **Acceptance:** Unserved PIN distinct from invalid format, refresh during hold, stock/price race, payment dismissal/retry while held, expiry during payment, and buyer address access limited to the order's paid seller. Test this with S08/S10 rather than duplicating hold rules in UI.

### S10 · Payment — [reference](screens/payment-modal.html)

- **Reference:** Card, UPI, Success, Failed. Order/amount/artist and time left; card number, expiry, CVV, name; UPI ID or QR with approval wait; Netbanking and Wallet choices. Bank decline message and retry/alternate method, successful payment confirmation while bank proof settles, return to CraftMe, card details never shared with CraftMe.
- **App:** Razorpay checkout and confirmation/webhook paths supply the payment interface. Which methods render depends on account configuration. Test-mode mock is not a requirement to collect card data in CraftMe.
- **Acceptance:** Provider sandbox for card, UPI, QR where offered, failure, dismissal, late/duplicate event, signature or amount mismatch, held stock released, and automatic refund when payment captures after stock was sold. Verify cart clears only after authoritative success.

### S11 · Order placed — [reference](screens/order-placed.html)

- **Reference:** Done step, payment-confirmed heading, copyable order code, payment amount/method/time, artist ship deadline, tracking/notification explanation, receipt and auto-receipt guidance, 30-day review window, email acknowledgement, line summary, ship-to and artist, View Order and Keep browsing.
- **App:** Checkout navigates to normal order detail without `?placed` or confirmation presentation. Email acknowledgement has no established delivery flow.
- **Acceptance:** Deep-link/refresh after confirmed payment, no paid banner during pending or failed confirmation, copy feedback, ownership, and email language that matches delivery state.

### S12 · My orders — [reference](screens/orders.html)

- **Reference:** Orders and None yet. Stage tabs/counts All, To be shipped, Shipped, Received and Refunded. Rows include code/date, items, artist/location, total and stage-specific deadline/tracking/reviewed/refund hints. View Order, Mark Received or Write a Review where applicable, numbered paging, and empty Browse action.
- **App:** Order list and empty state with stage labels and detail links. Reference filter/counts and row-action parity remain.
- **Acceptance:** Verify filtering with held/expired and partially refunded records, oldest page, tracking absent, reviewed vs eligible, loading/error and truly empty history.

### S13 · Order detail — [reference](screens/order-detail.html)

- **Reference Paid:** Receipt action, artist/location, deadline and full refund language if overdue, paid cancellation disabled with contact path. **Shipped:** Courier/tracking/date, auto-received date, confirm-arrival dialog explaining irreversibility. **Received:** Damage deadline, damage/report action and review. **Refunded:** Affected line/quantity, refund amount/reason/issued date, original method and arrival estimate, itemized totals and still-visible review action where eligible. All use stepper/timeline, line details, buyer address, payment method and relevant event times.
- **App:** Status, item totals, tracking, refund total, receipt confirmation action and inline damage/review forms. Missing reference stepper/timeline, confirmation modal, receipt output, ship-to/artist/payment panels and refund line details. Buyer review eligibility currently gates on received stage, so confirm refunded-stage behavior explicitly.
- **Acceptance:** Verify all four reference states and hold/expired extensions. Test authorization, repeated receipt confirmation, auto-receipt, paid order cannot cancel, partial vs full refund and capability changes at damage/review cutoffs.

### S14 · Damage report — [reference](screens/damage-report.html)

- **Reference Form:** Deadline, select affected order lines with quantities/price, damage type (torn/crushed, broken, moisture, wrong item, other), required 800-character description, at least two photos (outer parcel and close-up), up to six JPEG/PNG at 5 MB each, dropzone, cancel/send. One report per order, per-line refund decisions. **Submitted:** Reference number, time sent, review/decision timeline, two-working-day guidance and back to order.
- **App:** Inline form sends all lines, has a required 500-character note and accepts up to five optional photos in UI. SQL checks buyer, received stage, deadline, prior report, line ownership and path prefix. Reference line selection, type, upload rule alignment and durable submitted view are missing.
- **Acceptance:** No selected line, mixed valid/invalid files, oversize/corrupt upload, partial upload then retry, already submitted, cutoff crossed during upload, and approve/refuse or partial refund. Decide how photos are cleaned up after failure and enforce accepted limits on the server.

### S15 · Write a review — [reference](screens/review.html)

- **Reference:** Form and Window closed. Artist/order context, received date, countdown, 1–5 rating, required review text up to 500, no personal data/links reminder, suggested topic chips, moderation and cannot-edit notice. Closed state shows exact close date and back to order.
- **App:** Inline rating/comment form and SQL checks for buyer, received, one per order and 30-day deadline. No dedicated route, closed page, suggested chips or public moderation status journey.
- **Acceptance:** Blank/out-of-range rating, overlong text, repeated submit, deadline race, moderation rejected vs approved, and whether refunds change eligibility. Only approved reviews should affect public presentation.

## Artist dashboard

### S21 · Overview — [reference](screens/dash-home.html)

- **Reference:** Normal, Amount Owed, Restricted. Shop/add artwork shortcuts, monthly sales/orders, next payout/rating, ship queue including overdue, 8 weeks/6 months chart, upcoming payout stages (in transit, settling, ready), setup/verification/draft/Instagram prompts, recent reviews and activity. Owed banner explains post-payout refund deduction; restricted banner hides selling while existing orders still ship and offers clear-balance entry.
- **App:** No overview route. Artist inbox, public profile and SQL payout/restriction rules supply parts.
- **Acceptance:** New artist with no activity, mismatched month/date range, unverified payout, owed amount/date, restricted shop with open orders, and notification links. Verify whether balance payment exists before wiring the CTA.

### S22 · My Artworks — [reference](screens/dash-artworks.html)

- **Reference:** List and None yet. All/Published/Drafts/Sold/Ended with search, counts where shown, multiple listing rows with price/stock/status, views and updated date, paging. Actions Edit, End, View, Delete, Finish, Reopen. End confirmation says paid orders remain and reopening is possible. Empty CTA creates first artwork.
- **App:** My Works route supports drafts, publishing, price changes and takedown/relist. Full filters, multi-listing lifecycle, destructive rules and view metrics parity remain.
- **Acceptance:** Mixed draft/live/sold/ended versions, no listing, cannot delete sold work despite reference list showing a Delete action, reopen after restriction lift, and pending action/error recovery. Align that list action with S23's stricter rule.

### S23 · Artwork editor — [reference](screens/dash-artwork-edit.html)

- **Reference:** Editing and Validation errors. Draft/last saved, preview, save draft, title 100, category, year, medium, signed state, description 1,000, cover and up to five JPEG/PNG 5 MB photos. Optional none/reel/video (MP4 up to three minutes/200 MB in mock), link checking, Instagram picker. Original or print listing dialog with size/medium/price/stock, original stock one, net earnings estimate. Publish checklist shows missing title/photo/priced listing, pending verification but publishing allowed. Delete confirm only if never sold, otherwise end listings.
- **App:** New Artwork and limited My Works edits, photos, listable product types, drafts and reel picker. Existing work editor, full media lifecycle, listing add/edit/end parity, autosave, preview and delete protections in UI remain.
- **Acceptance:** Failed save after upload, publish retry without duplicate listing, cover removal/reorder, invalid or oversized media, no valid listing, valid original plus print, sold work deletion refusal, and owner/restricted write policies.

### S24 · Order inbox — [reference](screens/dash-orders.html)

- **Reference:** Inbox and Empty. To ship/Shipped/Received/Refunded/All with counts; item summary, buyer city, paid date, deadline or overdue, estimated net, Ship/Ship now. Empty to-ship state links listings and mentions email on paid order.
- **App:** Artist inbox and shipping actions. Filter/count parity and full detail route remain.
- **Acceptance:** Zero to ship with historical orders, overdue, active hold hidden, refunded/received transitions, retry, and other artist's orders excluded. Do not promise email until S35 exists.

### S25 · Artist order detail — [reference](screens/dash-order-detail.html)

- **Reference:** To ship and Shipped. Paid deadline, pack list and packing guidance, address and phone with copy action and private-use notice, payout estimate. Shipping modal requires courier/tracking and shows date posted, buyer notification and irreversible shipped transition. Shipped view shows tracking, date, auto-received deadline, edit tracking and timeline.
- **App:** Inbox exposes paid shipping address and mark-shipped workflow. No dedicated artist detail, packing/net/timeline parity or confirmed tracking edit path.
- **Acceptance:** Owner-only address after paid; held order or other artist cannot access it. Missing tracking, repeated mark-shipped, invalid dates, edit tracking after shipped, notification, and no reversal into paid state.

### S26 · Artist payouts — [reference](screens/dash-payouts.html)

- **Reference:** Normal and Amount Owed. Ready/upcoming/deduction/lifetime cards, next payout date and masked destination, upcoming eligible orders with buyer price, commission, gateway fee, refunds and net. History with date/count/recipient/reference/status, statement modal and payout change link. Owed banner links source order, deduction and Pay now. Statement shows per-order reconciliation.
- **App:** SQL payout data and calculations exist. Artist route and payoff UI absent.
- **Acceptance:** Open damage hold, verification pending, fully refunded order, refund after payout, owed larger than payable net, zero payment, and authorization. Derive statement figures from ledger; sample totals and sample rounding copy are not authoritative.

### S27 · Instagram — [reference](screens/dash-instagram.html)

- **Reference Not connected/Connect off:** Explain read-only scopes, creator/business requirement, link-only fallback, invalid URL example, paste post or reel and optionally link artwork. **Connected:** Account, access status, ordered Showcase with count up to nine, profile preview, add/remove/reorder, artwork link map. **Picking:** All/Reels/Posts, multi-select, count/cap, load older, cancel/add. **Lapsed:** Existing public picks remain while new imports are blocked and reconnect is offered. Disconnect confirmation explains token, picked content and linked reels removal.
- **App:** Combined profile/Instagram management, verified imports and manual reel links, highlighted reels ordered on profile. Current UI caps 12 reels and six highlighted. Full post support, nine-item Showcase and dedicated screen differ. Verify actual disconnect semantics before promising linked content deletion.
- **Acceptance:** Personal account, popup blocked/cancelled, partial import/duplicate, cap/older page, invalid/private/deleted links, token lapse and reconnect, links-only switch, ownership of artwork/reel, provider revocation and deletion callback. Preserve documented fallback and decide which limit/type model governs.

### S28 · Artist settings — [reference](screens/dash-settings.html)

- **Reference:** Verification timeline (PAN submitted, phone verified, shop opened, checking), masked payout data, payout edit modal warning payments pause until rechecked, public photo/name/city/bio/link, email preferences with new order required and review email later. Role/shop/Instagram status and agreement. Close shop disabled with open shipping or unsettled obligations; successful closure ends listings and artist role, fee not returned.
- **App:** Artist profile and reel editing exist; private payout recheck, preferences, closure and dedicated settings absent.
- **Acceptance:** Mask sensitive fields, role-gate reads, distinguish editable from pending, reverify changed destination before payout, reject closure with open order or unsettled payout, and keep buyer access after closure.

## Admin and system

### S29 · Admin overview — [reference](screens/admin-dashboard.html)

- **Reference:** Period selector (7/30/90 days or year), order count, paid gross, commission and payable amount with comparisons; weekly sales/commission and category charts, recent order links, queue counts and oldest-age labels, next payout run and near-60-day owed watch list.
- **App:** No Admin UI route. Source tables exist.
- **Acceptance:** Role denial, empty period and previous-period zero, refunded vs gross/commission totals, timezone/date boundaries, queue counts from actual actionable items, and auto-restriction watch list deduplicated.

### S30 · Admin queues — [reference](screens/admin-queues.html)

- **Reference Damage:** Oldest-first, order/buyer/artist/claim/photos/age/amount, payout hold, modal with claimed lines, received/report dates, artist history, uphold/refund or reject/release, mandatory note and cancel/record. **Overdue:** Paid unshipped after seven days, extend two days or refund, already-extended indicator, full-refund confirmation and fee impact. **Reviews:** Approve, reject with buyer-visible reason, and approve edited for personal data. **Reports:** Artwork/artist target, reason/details/age, dismiss, take-down with reason, restrict. **Verification:** Private legal/PAN/payout/phone/fee evidence, name/PAN checks, request changes or verify.
- **App:** No queue UI. SQL and gateway provide portions of damage/review/refund/report/verification/restriction commands. Review command approves/rejects; edited approval, overdue extension, takedown/resolve and verification request-changes need explicit implementation/evidence.
- **Acceptance:** Empty/error in each tab, stale or double decision, private evidence access, required reason and disclosure by role, refund and payout behavior after damage decision, requeue failed provider refund, and repeat/expiry rules for extensions.

### S31 · Admin orders — [reference](screens/admin-orders.html)

- **Reference:** Search by order code, buyer email or payment ID; stage (including hold, overdue and refunded), artist/date filters, pagination. Rows show payout status including payable, already paid and owed. Detail drawer lists quantities/unit/total, payment ID/method/gateway fee/commission. Select refund lines, choose reason and optional note, preview amount, provider timing and artist payout effect; close or confirm.
- **App:** No admin UI. Reservation/provider/confirmation refund operations exist and preserve an unknown state on ambiguous provider response.
- **Acceptance:** Filter without exposing private data to other roles, refund subset/all, repeated line refusal, provider timeout and reconciliation, fee retention, adjustment after artist already paid and correct buyer status.

### S32 · Admin payout run — [reference](screens/admin-payout-run.html)

- **Reference Draft:** Scheduled 1st/15th run, totals, unverified artists blocked and rolled forward, copy transfer list, per-artist price/refunds/commission/fee/owed/net/destination/UTR, order lines modal. Record run confirmation flags missing reference and allows leaving that artist for later. **Recorded:** Closed and immutable with count/time, statements sent; correction goes to next run; transfer cannot be recorded twice.
- **App:** Build and record payout operations exist, no run screen. Email and whole-run interaction are unverified.
- **Acceptance:** Rebuild/retry idempotency, blocked or zero-payable artist, missing/duplicate UTR, partial run, transfer already recorded, record while eligibility changes, reconcile statement and future corrections.

### S33 · Admin artists — [reference](screens/admin-artists.html)

- **Reference:** All/Needs verification/Owes money/Restricted with counts and search/paging. Joined, verification, orders, ratings, overdue in 30 days, owed age/balance and shop state. Restrict dialog explains hiding listings and blocking new orders while existing obligations remain, suggested reasons plus artist-facing required reason. Lift requires a note and says listings return immediately.
- **App:** Verification and restriction operations exist with public hiding behavior. No admin list/detail or corresponding dialogs.
- **Acceptance:** Repeat/reversed restriction, restricted artist still ships/refunds, multi-reason/audit history, debt-triggered restriction vs manual lift, and no exposure of payout details in list data.

### S34 · Admin settings — [reference](screens/admin-settings.html)

- **Reference:** Editable commission and onboarding fee with earnings preview and prospective commission semantics. Switches for Instagram Connect, accepting artists and demo banner. Read-only shop rules (15-minute hold, seven-day shipping, auto-received after 14 days, three-day damage, 30-day review, 1st/15th payouts, 60-day owed restriction). Admin add/remove with existing-account email dialog and explicit access scope. Integration status for Razorpay, email and Instagram.
- **App:** Settings and role operations exist in parts; no Admin settings route, complete configuration writes or status page demonstrated.
- **Acceptance:** Fee bounds and correct rounding, old orders keep snapshot, provider-disabled Instagram still allows links, artist entry switch respects phase decision, sensitive admin grants audited, and prevent removing the last admin. Integration status must come from actual configuration.

### S35 · Launch emails — [reference](screens/emails.html)

- **Reference:** Light email presentation independent of app theme. Buyer Paid email with items/amount/shipping address/artist deadline/order link; artist New order with deadline, items, estimated net and secure order link, omitting buyer address; artist Payout sent with amount/date/destination/reference/breakdown and statement link. Support/reply path in each.
- **App:** No email sender located. In-app notifications are separate and mock provider badges are not evidence of live delivery.
- **Acceptance:** Emit after authoritative paid or recorded transfer, once per recipient/event despite retry, fail/retry without rolling back payment, protect buyer and payout data, valid deep links, and no demo values in production. Other email promises in S11/S14/S24/S28 must be reconciled with the three-email launch scope.

### S36 · UI kit — [reference](screens/components.html)

- **Reference:** Colour, Type, Buttons, Forms, Feedback, Navigation, Data, Art, Overlays, Icons. Button variants/sizes/icon/disabled/saving/block; input empty/filled/error/valid/disabled/read-only, prefix/suffix, counter, select, checkbox/radio/switch/option card, quantity/filter/range/code/dropzone. Badge variants, alert states and action, success/error toast, empty/skeleton; tabs, stepper and timeline including failed, pagination/breadcrumb/menu; stat tiles, avatars, progress, tables, key-value and chart; artwork and embed cards; regular/destructive dialogs, dismiss/keep/confirm.
- **App:** Shared styles, icons, reusable cards, loading/empty/error states and dialogs in routes. No app parity gallery and no proof of every combination. Current brand/theme may differ from sample tokens.
- **Acceptance:** Light/dark, semantic labels, focus visibility and restoration, Escape, focus trap, reduced motion, narrow widths, overflow in tables/forms, long titles and counters, loading/disabled announcements and error recovery. Test actual app surfaces, not only the standalone mock UI kit.

## Decisions and cross-screen cases to resolve

| Topic | Reference and app differ | Closure |
| --- | --- | --- |
| Auth | Email/password/reset and policies in S05–S07/S16 vs Google-only in the app. | Keep the documented choice or explicitly reopen password auth. Track those scenarios as deferred meanwhile. |
| Seller onboarding | S01/S16 link to S18; existing seller flow was explicitly postponed. | Preserve deferral and decide when to expose the entry; never link to a dead screen. |
| Cart | S03 replacement discards the cart; current implementation saves outgoing works. | Keep Saved for later and document expected copy and whole-group behavior. Current wishlist bulk add only requests the first conflicting listing. |
| Damage intake | S14 requires 2–6 photos and 800-character description; current inline flow accepts up to five optional photos and 500 characters. | Decide limits once, enforce in storage, SQL and UI, and test both form and moderation with those limits. |
| Refund/overdue | Mock copy alternates between refund after deadline and admin extend/refund. Current sweep flags overdue for admin action. | Resolve operator vs automated policy, keep copy consistent, and verify payout hold/refund handling. |
| Reviews after refund | S13 shows Review in refunded variant; SQL currently requires received. | Decide eligibility after partial/full refund and synchronize buyer action gating, SQL and public reviews. |
| Instagram | S27 has posts plus reels and nine Showcase slots; current implementation uses reels and separate total/highlight caps. | Decide content types, caps and disconnect behavior before treating matching layouts as parity. |
| Money and email | Reference sample totals, demo fees, transfer timing and email notices are illustrative. | Use accepted [payments ADR](adr/0004-craftme-collects-and-pays-artists.md), live configuration and ledger values. Verify reconciliation and actual message delivery. |

For each scenario, record route, role, fixture, action, expected result, implementation evidence and runtime result. Use fresh signed-out/buyer/artist/admin sessions and check ownership on both reads and writes. Use the existing gateway and database command interfaces for behavior tests so timing, permissions and retry rules stay in one place.

## Reference replay checklist

The 36 screens define 74 registered states, counting each screen's default. The following keys come from the registry. Use the reference state bar to select them. Dialogs and tab panels below are additional interactions within those states; they are not included in the count.

| Screen | State keys | Dialog IDs | Tab panel IDs |
| --- | --- | --- | --- |
| [S01](screens/home.html) | `default` | — | — |
| [S02](screens/browse.html) | `default` (Results), `loading`, `empty` (No results) | — | — |
| [S03](screens/artwork.html) | `default` (Available), `sold` (Original sold), `own` (Viewed by its Artist), `cart-clash` (Cart clash dialog) | `newcart`, `report` | — |
| [S04](screens/artist-profile.html) | `default` (With Instagram), `no-instagram` (No Instagram) | `rep` | `t-art`, `t-ig`, `t-rev`, `t-about` |
| [S05](screens/login.html) | `default`, `error` (Wrong password) | — | — |
| [S06](screens/signup.html) | `default`, `error` (Validation errors) | — | — |
| [S07](screens/reset.html) | `default` (Request), `sent` (Link sent) | — | — |
| [S08](screens/cart.html) | `default` (With items), `empty`, `price-changed` (Price changed) | — | — |
| [S09](screens/checkout.html) | `default`, `error` (Address errors), `expired` (Hold expired) | — | — |
| [S10](screens/payment-modal.html) | `card`, `upi`, `success`, `failed` | — | — |
| [S11](screens/order-placed.html) | `default` | — | — |
| [S12](screens/orders.html) | `default` (Orders), `empty` (None yet) | — | — |
| [S13](screens/order-detail.html) | `paid`, `shipped`, `received`, `refunded` | `recv` | — |
| [S14](screens/damage-report.html) | `default` (Form), `submitted` | — | — |
| [S15](screens/review.html) | `default` (Form), `closed` (Window closed) | — | — |
| [S16](screens/profile.html) | `default` | `addr`, `del` | — |
| [S17](screens/notifications.html) | `default` (List), `empty` | — | — |
| [S18](screens/become-artist.html) | `step1` (Details), `step2` (Phone check), `step3` (Onboarding Fee), `done` | — | — |
| [S19](screens/legal.html) | `default` | — | `terms`, `privacy`, `refunds`, `artist`, `deletion` |
| [S20](screens/not-found.html) | `default` | — | — |
| [S21](screens/dash-home.html) | `default` (Normal), `owed` (Amount Owed), `restricted` | — | — |
| [S22](screens/dash-artworks.html) | `default` (List), `empty` (None yet) | `end` | — |
| [S23](screens/dash-artwork-edit.html) | `default` (Editing), `errors` (Validation errors) | `lst`, `del` | — |
| [S24](screens/dash-orders.html) | `default` (Inbox), `empty` | — | — |
| [S25](screens/dash-order-detail.html) | `paid` (To ship), `shipped` | `ship` | — |
| [S26](screens/dash-payouts.html) | `default` (Normal), `owed` (Amount Owed) | `stmt` | — |
| [S27](screens/dash-instagram.html) | `disconnected` (Not connected), `connected`, `picker` (Picking posts), `lapsed` (Token lapsed), `disabled` (Connect off (links only)) | `disc` | — |
| [S28](screens/dash-settings.html) | `default` | `pay` | — |
| [S29](screens/admin-dashboard.html) | `default` | — | — |
| [S30](screens/admin-queues.html) | `default` | `dmg`, `refund`, `rrej`, `down`, `ver` | `q-dmg`, `q-over`, `q-rev`, `q-rep`, `q-ver` |
| [S31](screens/admin-orders.html) | `default` | `ord` | — |
| [S32](screens/admin-payout-run.html) | `default` (Draft), `sent` (Recorded) | `done`, `lines` | — |
| [S33](screens/admin-artists.html) | `default` | `rs`, `lift` | — |
| [S34](screens/admin-settings.html) | `default` | `adm` | — |
| [S35](screens/emails.html) | `default` | — | `em-buyer`, `em-new`, `em-pay` |
| [S36](screens/components.html) | `default` | `kmodal`, `kalert` | `kt1`, `kt2` |

The S30 restriction control has an empty dialog target in the mock. Use the working restriction dialog in S33 to define that interaction. S36 also contains a sample pair of tab panels. Other tabs in S36 are catalogue navigation within the kit.

## Shared shell and interactions

- **Public header:** Verify signed-out and buyer navigation, catalogue menu, global search, cart count, notifications, account menu, logout and mobile navigation. In the reference the seller entry is visible; preserve the current deferral. The reference notification preview links to the full list; the app's direct order navigation is an intentional implementation difference. Ensure the preview offers a reliable route to the archive once S17 lands.
- **Artist/Admin shells:** Reference has separate navigation with current section, shortcuts back to the public shop/storefront and queue counts. Current artist navigation is in the shared header. Admin navigation and access are still missing. Test that a hidden link and a direct URL enforce the same permissions.
- **Reference-only controls:** Screen index role filters, state selector, previous/next screen links and Labels mode are review tools. Use them to inspect variants. Production theme behavior is a separate concern; verify both palettes on the actual app and preserve the selected theme between routes.
- **Feedback:** Where a reference action only emits a demo toast, verify the real mutation before showing success. This applies to copy, send/report, profile saves, approvals, refund/record actions and address/deletion requests. Exercise cancel, failure/retry, and a rapid repeat on the real interface.
