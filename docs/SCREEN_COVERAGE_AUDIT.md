# CraftMe screen coverage audit

See the [detailed scenario inventory](SCREEN_SCENARIO_INVENTORY.md) for every screen's controls, dialogs, validation, state variants, implementation differences, and acceptance checks.

Reference: [Claude design](https://claude.ai/artifact/9gvXp25jEJw3bMJdhugrmJ) and its checked-in [screen index](screens/index.html) and [state registry](screens/data.js). Implementation baseline: commit `0815969`. The hosted index and repository registry agree on the 36 screens. This is a source audit, including route, UI, gateway, and migration inspection. Status describes code present at this commit. Production deployment, live integrations, and pixel parity require separate verification.

**Status:** Covered = main reference behavior present in source. Partial = reachable implementation with gaps or a different flow. Backend only = relevant server capability exists but the screen is absent. Missing = no equivalent workflow found. Deferred = explicit product decision. A mock state is a scenario to exercise, never evidence that the application implements it.

## Storefront and account

| Screen | Status and implementation | Remaining scenarios and edge cases |
| --- | --- | --- |
| [S01 Home](screens/home.html) | Partial. `/` opens Browse. | Separate landing experience with hero, featured works, category entry, buying explanation and seller callout. Seller entry was deferred in the latest phase. |
| [S02 Browse](screens/browse.html) | Partial. Category groups, artwork grid, pagination, global artwork/artist query, loading, no results and search retry. | Reference sorting and filter controls beyond categories; verify empty filters, URL restoration and pagination on tied timestamps in normal Browse. |
| [S03 Artwork](screens/artwork.html) | Partial. Photos/reel, listings, owner links, sold availability, cart clash and collection picker. | Buyer-facing Report action and confirmation; verify sold original with live print, no media, restricted artist, and owner cannot buy. Verify both cart-clash outcomes. |
| [S04 Artist profile](screens/artist-profile.html) | Partial. Bio, rating summary, highlights, catalogue including sold works, owner links and restricted notice. | Add the public approved-review list and empty reviews state. Verify with/without Instagram and no works. |
| [S05 Log in](screens/login.html) | Partial by decision. Google sign-in and protected routes. | Email/password and wrong-password state only if Google-only is revisited. Verify cancelled OAuth, error and return to intended page. |
| [S06 Sign up](screens/signup.html) | Deferred by auth choice. First Google sign-in creates a profile via database trigger. | Reference account form and validation if email auth is adopted. Verify duplicate OAuth and profile creation on first login. |
| [S07 Reset password](screens/reset.html) | Deferred by auth choice. | Reference request and link-sent states require password accounts. If adopted, add expired/used link and password update. |
| [S16 Buyer profile](screens/profile.html) | Missing. Artist profile editor exists separately. | Buyer name/photo/bio, saved address, validation and checkout prefill; enforce owner-only address visibility. |
| [S17 Notifications](screens/notifications.html) | Partial. Header bell lists notifications, opens order and marks read. | Full list route and durable history, empty/loading/error, unread and read-all behavior across devices. |
| [S18 Become an Artist](screens/become-artist.html) | Deferred. Verification and onboarding fee/payment handlers exist in the backend. | Details, phone verification, fee, and completion screens; cancel, failed or late fee confirmation, resume, and role refresh. Keep the seller entry deferred until explicitly reopened. |
| [S19 Legal](screens/legal.html) | Partial. Privacy and Instagram data-deletion routes. | Terms, refund policy, artist agreement and consolidated navigation; confirm general account deletion scope separately from Instagram deletion. |
| [S20 Not found](screens/not-found.html) | Covered. Wildcard page with home link. | Verify invalid resource IDs, deep links, and distinction between unavailable resources and network errors. |

## Buying

| Screen | Status and implementation | Remaining scenarios and edge cases |
| --- | --- | --- |
| [S08 Cart](screens/cart.html) | Partial. With items, empty, live totals, one artist, unavailable lines, saved carts and restore. | Reference price-changed review state; distinguish changed price from stock loss and offer reconfirmation. Verify switch cancellation, repeated click, replay after reload, quantity caps and group restore with an unavailable work. |
| [S09 Checkout](screens/checkout.html) | Partial. Shipping form validation, server hold, countdown, payment launch and recovery. | Verify address errors and explicit hold-expired recovery, including stock or price changing before the next attempt and returning to a pending hold. |
| [S10 Payment](screens/payment-modal.html) | Partial. Razorpay owns the payment window; frontend launches it and handles confirmation, backend verifies provider state and supports webhook reconciliation. | Sandbox verification of card, UPI, success, failure, dismissal, late webhook, duplicate callback and paid-after-expiry handling. Provider UI is the equivalent surface. |
| [S11 Order placed](screens/order-placed.html) | Partial. Payment success routes to normal order detail. | Dedicated confirmation state at `?placed`, stable after refresh; avoid presenting success while payment is still pending. |
| [S12 My orders](screens/orders.html) | Covered at core. Order history, stage labels, and empty state. | Verify all stages, fetch failure/retry and history beyond the current query limit. |
| [S13 Order detail](screens/order-detail.html) | Partial. Stage label, line totals, tracking, refunds and eligible receipt/damage/review actions. | Reference timeline, artist and buyer address display, explicit paid/shipped/received/refunded panels and partial refund details. Verify access denial and a hold expiring on-page. |
| [S14 Damage report](screens/damage-report.html) | Partial. Inline form uploads photos and calls report command; eligibility is gated by order state/window. | Dedicated form/submitted view, select affected lines, durable submitted status, retry after upload or submit failure, duplicate and expired-window handling. Current UI submits all order lines. |
| [S15 Review](screens/review.html) | Partial. Inline review form and server eligibility rules. | Deep-linked form, window-closed explanation, already-reviewed and submitted states, including a window closing while the form is open. |

## Artist dashboard

| Screen | Status and implementation | Remaining scenarios and edge cases |
| --- | --- | --- |
| [S21 Overview](screens/dash-home.html) | Missing screen. Orders and payout primitives exist. | To-do counts, sales, next payout, normal/owed/restricted states and direct links. |
| [S22 My Artworks](screens/dash-artworks.html) | Partial. `/dashboard/works` has drafts, publish, prices, take down and relist. | Verify list/empty, multiple listings per work, sold-only and restricted states; decide whether to retain current route or add the reference alias. |
| [S23 Artwork editor](screens/dash-artwork-edit.html) | Partial. `/dashboard/new` handles creation, photos, listings and reel selection; My Works handles limited edits. | Full existing-artwork editor for details/media and listing lifecycle, deep link and validation, failed upload/draft recovery, sold and restricted edits. |
| [S24 Order inbox](screens/dash-orders.html) | Partial. `/dashboard/orders` renders artist orders and inline shipping controls. | Reference stage views and counts; verify empty, overdue, errors and paging, and link to artist order detail. |
| [S25 Artist order detail](screens/dash-order-detail.html) | Partial. Inbox shows shipping data/actions for eligible orders. | Dedicated artist-owned detail with lines, address, tracking and to-ship/shipped variants. Verify address is hidden before payment and other artists cannot read it. |
| [S26 Payouts](screens/dash-payouts.html) | Backend only. Payout data and run operations exist. | Artist statements, payable orders, normal/owed states and ownership checks; verify net totals after refunds and empty histories. |
| [S27 Instagram](screens/dash-instagram.html) | Partial. Artist profile editor offers link management, connect, picker/import, reconnect and links-only fallback. | Dedicated route or documented replacement. Verify all five states against the configured provider, plus popup failure/cancel, duplicate import, token lapse, disconnect and public visibility. |
| [S28 Artist settings](screens/dash-settings.html) | Partial. Public profile and reels editor. | Verification status, private payout settings, notifications preferences, agreement access and restricted editing behavior. |

## Admin and system

| Screen | Status and implementation | Remaining scenarios and edge cases |
| --- | --- | --- |
| [S29 Admin overview](screens/admin-dashboard.html) | Missing screen. No Admin route in the app. | Role-gated dashboard with orders, sales, commission, queues and empty/error states. |
| [S30 Admin queues](screens/admin-queues.html) | Backend only. Damage/review decisions, reports and verification primitives. | Damage, overdue, review, reports and verification queues; evidence access, assignment/status, stale decisions, empty and error states. Verify any queue action lacking a command. |
| [S31 Admin orders](screens/admin-orders.html) | Backend only. Line refund reservation and provider reconciliation exist. | Order search/filter/detail, partial and full line refunds, repeat prevention, provider timeout/unknown and reconciliation workflow. |
| [S32 Admin payout run](screens/admin-payout-run.html) | Backend only. Run construction and transfer recording commands. | Draft and recorded screens, 1st/15th selection, zero-payable and amount-owed cases, repeat run/recording, transfer-reference validation. |
| [S33 Admin artists](screens/admin-artists.html) | Backend only. Verification/restriction operations and public restriction behavior. | Artist lookup, verification and restriction/reinstate controls, reason/audit history, restricted storefront and existing order behavior. |
| [S34 Admin settings](screens/admin-settings.html) | Backend only. Settings table and reads used by existing flows. | Admin form for commission, onboarding fee and Instagram switch. Verify server write permissions, range validation, and effects on new versus existing orders. |
| [S35 Launch emails](screens/emails.html) | Missing. Reference HTML and in-app notifications are present. The audit found no email sender in the application or Supabase functions. | Buyer payment receipt, artist new-order email, and artist payout-sent email. Verify destination, retry, duplicate suppression and broken-link handling. |
| [S36 UI kit](screens/components.html) | Partial. Shared CSS and reusable UI in source. | Audit buttons/forms/badges/alerts/tables/tabs/dialogs/cards against reference states in both themes. Verify keyboard focus, modal behavior, narrow screens and long content as missing routes ship. |

## Additions and decisions outside the reference

| Addition or deviation | Why and evidence |
| --- | --- |
| Wishlist, collections, scoped saved search, and collection picker | Lets buyers curate works for later, organize them into multiple collections, and return to them from artwork pages. Product rationale and limits are in [the wishlist plan](WISHLIST_PLAN.md). Added in `09cce1a` and expanded in `0815969`. |
| Global search and artist results | The reference shows header search, but has no distinct indexed artist-results screen or URL-backed search flow. The current implementation gives catalogue-wide discovery and keeps saved-work search private. User-requested in the implementation plan for `0815969`. |
| Saved for later and transactional artist swaps | The reference has a cart clash dialog. The current app saves the outgoing cart so buyers keep their selections while each order stays one parcel from one artist. See [the order ADR](adr/0002-one-artist-per-order.md) and [the migration](../supabase/migrations/0017_saved_cart.sql). |
| Pot brand, favicon and app icons | Selected branding from the logo exploration. Commit `1a4aac3` records header, favicon, manifest and icon integration. |
| Expanded categories and stocked handmade products | The catalogue supports crafts beyond originals and prints. Product rationale and examples are in [the catalogue plan](CATALOGUE_PLAN.md). |
| Inline reel in artwork carousel, link fallback, named reels and picker | Extends the reference's media/showcase concept. The fallback preserves a working way to watch when embedding fails. [Product page plan](PRODUCT_PAGE_PLAN.md), [Instagram plan](INSTAGRAM_PLAN.md), commits `1762a50`, `3502eb6`, `fb54209`. |
| Meta popup return, verified imports and Instagram deletion | Integration-specific flows required to connect/import without replacing the Google login. The plan records provider requirements and alternate approaches. Live configuration remains unverified. [Instagram plan](INSTAGRAM_PLAN.md). |
| Supabase/Postgres implementation, Razorpay and Google-only auth | The current code uses Postgres migrations, RLS and a gateway seam. A standalone migration rationale was not established in this audit. The [payments ADR](adr/0004-craftme-collects-and-pays-artists.md) records why verified centralized payments replaced direct UPI. Google-only is documented in the [Instagram plan](INSTAGRAM_PLAN.md). |
| Responsive artist navigation, stale-deployment recovery and checkout phone reuse | Commits `9b9c246`, `304f586`, and `99ca301` record the purpose: reach dashboard links on phones, recover from stale deployments, and avoid asking for the same phone number twice. |

## Implementation handoff

Current additions also need regression checks. In particular, the wishlist's **Add all by artist** action only requests the first listing when another artist is active. Decide and test whole-group behavior before calling that path complete. Exercise collection creation when adding the artwork fails after creation, cart restore after a reload, and global search paging while catalogue entries change.

1. Close the buyer flow first: price confirmation, hold/payment recovery, order confirmation, order detail, damage and review states. Test through the existing gateway and database command interfaces; keep payment confirmation and eligibility rules behind those seams.
2. Add the missing public and account screens. Keep Google-only auth and deferred seller onboarding visible as decisions; implement their reference states only when those decisions change.
3. Build artist detail, editor, settings and payout views on the existing gateway interface. Keep ownership and write rules in database modules to preserve locality across buyer, artist and admin callers.
4. Add admin routes and queue/read interfaces before wiring admin mutations. Use the existing order, review, damage, verification and payout commands where present. Add test coverage at those interfaces for duplicate requests and access denial.
5. Add email delivery and theme/keyboard coverage. Use the 36 rows as the acceptance checklist. For each state, record route, fixture, role, expected outcome and runtime result. Prioritize light/dark, 375/768/1280px, direct navigation, forbidden access and retry states across flows.

Implementation source map: [routes](../src/App.jsx), [pages](../src/pages), [gateway](../src/api/gateway.js), [edge commands](../supabase/functions/api/index.ts), [database migrations](../supabase/migrations), [schema scenarios](../supabase/schema.test.mjs). Production state and live provider behavior are open verification items.
