# Coverage: every reference item, its status and its test

Baseline: commit `0815969`. Reference files are in `docs/screens/`. App paths are relative to the repository root `artist-marketplace/`.

## How to read

**ID.** `S08` is a screen. `S08.st.empty` is a registered state (the key in `data.js` and in the page's `data-states`). `S13.dlg.recv` is a dialog (`id` of the hidden element opened by `data-open`). `S04.tab.t-rev` is a tab panel (`id` of the `role="tabpanel"`). `S08.i.04` is an interaction or edge case. `SH.*` is the shared shell, `X.*` a kept extra, `SYS.*` a system rule. IDs never change once written; retired items keep their row.

**Reference.** File, then the state key (`data-s`), element `id`, or the `data-c` component label where the markup has one.

**Disposition.**

| Code | Meaning |
| --- | --- |
| BUILD | **Missing UI.** No screen or control exists. Backend may also be missing. |
| WIRE | **Backend only.** The database or Edge command exists; the UI is missing. |
| EXTEND | Partly present. The UI, the backend or both need changes. |
| VERIFY | **Exists but unverified.** Keep the behaviour and prove it with the QA script. |
| KEEP | An approved extra (KD in DECISIONS.md). Keep and regression-test. |
| PROVIDER | Drawn by the payment or identity provider. Verified in the provider sandbox, not built. |
| DIVERGE | Built differently from the reference on purpose. Reason given. |
| DEFER | Not built. Reason given. |

**Pkg** is the work package in [PHASES/](PHASES/). **QA** is the script in [QA/](QA/README.md).

## Shared shell

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| SH.01 | `ui.js` `publicHeader()`: logo, Browse, Categories menu, Sell your art, search, cart, bell, account menu; guest sees Log in | `src/components/common/Layout.jsx`: logo, Browse, artist links, `MarketplaceSearch`, cart, wishlist, bell, My orders, log out. No Categories menu, no Sell link, no account menu. | EXTEND | P00 | QA-SH-01 |
| SH.02 | `ui.js` `avatarMenu()`: My orders, Profile, Notifications, role entry (Become an Artist, Artist dashboard, Admin), Log out | Missing. Log out is an icon button. | BUILD | P00 | QA-SH-02 |
| SH.03 | `ui.js` `.mobile-menu`, `.mobile-search`, `data-burger` | Burger menu exists (`Layout.jsx` `open`), search toggle exists (`MarketplaceSearch.jsx`). Escape and focus return exist for search only. | EXTEND | P00 | QA-SH-03 |
| SH.04 | `ui.js` `bell()`: preview list, "See all" to notifications, Mark all as read | `NotificationBell.jsx` lists unread only, marks read, navigates to the order. No "See all". | EXTEND | P04 | QA-S17-03 |
| SH.05 | `ui.js` `footer()`: Shop, For Artists, Help columns, legal line | `Layout.jsx` footer: one line and a Privacy link. | EXTEND | P00 | QA-SH-04 |
| SH.06 | `ui.js` `sidebar('artist')`, `shellHeader('artist')`: Overview, Artworks, Orders (count), Payouts, Instagram, Settings, View my shop, Back to CraftMe | Missing. Artist links sit in the public header. | BUILD | P06 | QA-SH-05 |
| SH.07 | `ui.js` `sidebar('admin')`: Overview, Queues (count), Orders, Payout run, Artists, Settings | Missing. No admin route exists (`src/App.jsx`). | BUILD | P09 | QA-SH-05 |
| SH.08 | Inventory "Shared shell": a hidden link and a direct URL enforce the same permission | `Guards.jsx` `ProtectedRoute`, `RoleRoute`; RLS and `is_admin()` on the server. `RoleRoute` does not remember the intended page. | EXTEND | P00 | QA-SH-06 |
| SH.09 | `ui.js` `toggleTheme()`, `localStorage['cm-theme']`, `data-theme` | `src/ui/styles.css:44-57` has both palettes. No toggle, nothing sets `data-theme`. | BUILD | P00 | QA-S36-01 |
| SH.10 | `ui.js` `toast()`, `.toasts` | CSS only. No component. Pages show inline messages. | BUILD | P00 | QA-S36-04 |
| SH.11 | A1 route list | `/dashboard/works`, `/dashboard/profile`, `/dashboard/new`, `/privacy`, `/instagram-deletion` exist; reference paths do not. | BUILD | P00 | QA-SH-07 |
| SH.12 | `ui.js` layout `auth`: logo and "Continue browsing" | `/login` renders inside the full `Layout`. | DIVERGE: keep the full header on `/login`; one layout is simpler and the header already offers Browse. | P04 | QA-S05-01 |
| SH.13 | `ui.js` reviewer bar, state selector, Labels, `index.html` | Not product features. | DEFER: review tools only. | — | — |
| SH.14 | `ui.js` `.testbar`; S34 "Demo banner" switch | Missing. `settings.switches` exists and is world-readable. | BUILD | P10 | QA-S34-03 |
| SH.15 | — (KD10) | `ErrorBoundary.jsx` per route, `STALE_PAGE` reload once a minute | KEEP | P00 | QA-SH-08 |

## S01 Home (`home.html`, route `/`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S01 | `home.html` | `/` renders `Browse` (`App.jsx:54`) | BUILD | P03 | QA-S01-01 |
| S01.st.default | `default` | — | BUILD | P03 | QA-S01-01 |
| S01.i.01 | `#hero-h` "Browse art", "Sell your art" | — | BUILD | P03 | QA-S01-01 |
| S01.i.02 | `#range` six category rows with peek image (`data-peek-to`) | Categories differ (KD05) | BUILD, mapped to the five groups in `GROUPS` | P03 | QA-S01-02 |
| S01.i.03 | `#buy` Original versus print, `data-moment="picture-develops"` | — | BUILD as a static image; the scroll effect is optional and must respect reduced motion | P03 | QA-S01-01 |
| S01.i.04 | `#how` three steps | — | BUILD | P03 | QA-S01-01 |
| S01.i.05 | `#questions` five answers (7 days, no cancel after Paid, one artist per Order, India only, moderated reviews) | — | BUILD; copy must match D05, ADR-0002, ADR-0003 | P03 | QA-S01-03 |
| S01.i.06 | `#artists` "Start selling" | — | BUILD; hidden when the "Accept new Artists" switch is off | P03 | QA-S01-03 |
| S01.i.07 | Header anchors `#how`, `#artists`, `#questions` under a sticky header | — | BUILD | P03 | QA-S01-02 |
| S01.i.08 | Footer columns and legal links | See SH.05 | EXTEND | P00 | QA-SH-04 |
| S01.i.09 | Inventory: missing featured media does not block Browse | — | BUILD | P03 | QA-S01-03 |

## S02 Browse (`browse.html`, `/browse`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S02 | `browse.html`; `data-c="Breadcrumbs"` | `src/pages/Browse.jsx` `BrowseCatalogue` | EXTEND | P03 | QA-S02-01 |
| S02.st.default | `default` Results; `data-c="Artwork grid"` | Grid and Previous or Next | EXTEND | P03 | QA-S02-01 |
| S02.st.loading | `loading` | Six skeleton tiles, `aria-busy` | VERIFY | P03 | QA-S02-05 |
| S02.st.empty | `empty` "Nothing matches those filters", Clear all filters, Browse everything; `data-c="Empty state"` | "Nothing here yet. Try another category." | EXTEND | P03 | QA-S02-04 |
| S02.i.01 | `#sort`: Newest, Price low to high, Price high to low, Highest rated Artist | Newest only (`useArtworks`) | BUILD (PD20) | P03 | QA-S02-02 |
| S02.i.02 | `#q` "Title, Artist or medium" | Header search matches title (artworks) or name (artists) only (`search_catalogue`) | EXTEND | P03 | QA-S02-01 |
| S02.i.03 | Category checkboxes with counts; `data-c="Filters"` | Group and category chips, single choice | EXTEND to multi-select. Counts: DEFER, they need an aggregate per filter change and are fixtures in the mock. | P03 | QA-S02-01 |
| S02.i.04 | Type: Originals, Prints | None | BUILD with Ready-made (PD03, KD05) | P03 | QA-S02-01 |
| S02.i.05 | `#rmin`, `#rmax`, three price bands | None | BUILD; an inverted range is swapped, not an error | P03 | QA-S02-03 |
| S02.i.06 | `#artist` select | None | BUILD as a type-ahead over artists | P03 | QA-S02-01 |
| S02.i.07 | "Hide Sold Originals" | `artworks.available` exists | BUILD (A8) | P03 | QA-S02-03 |
| S02.i.08 | `data-c="Active filters"` chips, `#fcount`, Clear all | None | BUILD | P03 | QA-S02-03 |
| S02.i.09 | `data-c="Pagination"` numbered | Cursor paging on `created_at`, which can skip rows with equal timestamps | EXTEND: offset paging with a stable tie-break on id | P03 | QA-S02-02 |
| S02.i.10 | Inventory: refresh and Back restore filters | `group`, `category`, `q`, `type` are in the URL | EXTEND for the new filters | P03 | QA-S02-03 |
| S02.i.11 | "86 Artworks match your filters"; `data-c="Page header"` | None | BUILD (total from the same query) | P03 | QA-S02-01 |
| S02.i.12 | Inventory: fetch failure is not "empty"; no stale results | Error alert exists; components are keyed by the query string | VERIFY | P03 | QA-S02-05 |
| S02.i.13 | Inline script: filters collapsed under 1000 px | None | BUILD | P03 | QA-S02-06 |

## S03 Artwork (`artwork.html`, `/artwork/:id`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S03 | `artwork.html` | `src/pages/ArtworkPage.jsx` | EXTEND | P03 | QA-S03-01 |
| S03.st.default | `default` Available; `data-c="Artist link"`; `data-c="Purchase panel"` | Present | EXTEND | P03 | QA-S03-01 |
| S03.st.sold | `sold` "Original sold", prints still buyable | Sold listing is a disabled radio; another live listing is picked | VERIFY, add the "found a home" notice | P03 | QA-S03-02 |
| S03.st.own | `own` notice and "Edit in dashboard"; `data-c="Own listing notice"` | Notice present, no edit link | EXTEND | P03 | QA-S03-03 |
| S03.st.cart-clash | `cart-clash` opens `#newcart` | `CartConflictDialog` | KEEP (KD03) | P01 | QA-S03-05 |
| S03.dlg.newcart | `#newcart` "Replace with this" discards | Saves the outgoing cart instead | DIVERGE (D07, KD03): names the outgoing artist, says the cart is saved | P01 | QA-S03-05 |
| S03.dlg.report | `#report` four reasons, `#why-d` 500 | `report` function exists (`0003_logic.sql`), no UI, no details column | WIRE | P03 | QA-S03-07 |
| S03.i.01 | `data-c="Breadcrumbs"` | None | BUILD | P03 | QA-S03-01 |
| S03.i.02 | `data-c="Gallery"`, `data-c="Instagram reel"` | `Gallery.jsx`, `ReelCard.jsx` | KEEP (KD06) | P03 | QA-S03-08 |
| S03.i.03 | `data-c="Listings"` with stock and attribute lines | Radio buttons: kind, size, price | EXTEND | P03 | QA-S03-01 |
| S03.i.04 | Quantity stepper (`data-max`), "Originals are always 1", total | None; quantity is set in the Cart | BUILD | P03 | QA-S03-04 |
| S03.i.05 | Add to Cart, toast, stay on page | Adds and navigates to `/cart` | EXTEND | P03 | QA-S03-04 |
| S03.i.06 | "Buy now" | None | BUILD (D07): same conflict dialog, then `/checkout` | P01 | QA-S03-06 |
| S03.i.07 | `data-c="Shipping and protection"` | None | BUILD | P03 | QA-S03-01 |
| S03.i.08 | `data-c="Details"` wall label and item-code copy | Description only. No year, medium, signed, city columns. | BUILD (columns added in P06, shown when filled) | P03 | QA-S03-01 |
| S03.i.09 | `data-c="Artist Reviews"` three reviews, link to all | None. `reviews_read` allows approved rows. | WIRE | P03 | QA-S03-09 |
| S03.i.10 | `data-c="More from the Artist"`, `data-c="Similar Artworks"` | None | BUILD | P03 | QA-S03-09 |
| S03.i.11 | Inventory: guest add returns after login | `navigate('/login', {state:{from}})` exists; lost across the Google redirect (see S05.i.02) | EXTEND | P04 | QA-S05-02 |
| S03.i.12 | Inventory: owner purchase refused | UI disables; `place_order` fails `own_listing`; `orders` check `buyer_id <> artist_id` | VERIFY | P03 | QA-S03-03 |
| S03.i.13 | Inventory: removed, restricted or unknown work | "We couldn't find this artwork"; bad id not handled like `isBadId` | EXTEND | P03 | QA-S20-02 |
| S03.i.14 | Inventory: all listings sold | Button reads "Sold" | VERIFY | P03 | QA-S03-02 |
| S03.i.15 | Inventory: invalid or repeated report, signed-out reporter | `report` requires `auth.uid()`; no duplicate rule | EXTEND | P03 | QA-S03-07 |
| S03.i.16 | — (KD01) Save and collection buttons | `SaveButton`, `CollectionMenu` | KEEP | P03 | QA-X-01 |

## S04 Artist profile (`artist-profile.html`, `/artist/:id`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S04 | `artist-profile.html`; `data-c="Tabs"` | `src/pages/ArtistPage.jsx` | EXTEND | P03 | QA-S04-01 |
| S04.st.default | `default` With Instagram | Reels strip when highlighted reels exist | EXTEND | P08 | QA-S04-04 |
| S04.st.no-instagram | `no-instagram` empty message in the Showcase tab | Section hidden when empty | EXTEND | P08 | QA-S04-04 |
| S04.dlg.rep | `#rep` reason select `#rp-r`, details `#rp-d` | `report` function, no UI | WIRE | P03 | QA-S04-06 |
| S04.tab.t-art | `#t-art` All, Originals, Prints, Sold | One list, on-sale first, "Show more" | EXTEND | P03 | QA-S04-02 |
| S04.tab.t-ig | `#t-ig` posts and reels, Follow link; `data-c="Instagram Showcase"` | Reels only | EXTEND (D09) | P08 | QA-S04-04 |
| S04.tab.t-rev | `#t-rev` summary, histogram, list, pages; `data-c="Rating summary"`; `data-c="Reviews"` | None | WIRE | P03 | QA-S04-03 |
| S04.tab.t-about | `#t-about` based in, joined, verified, ships | None | BUILD | P03 | QA-S04-01 |
| S04.i.01 | `data-c="Profile header"`: avatar, Verified Artist, field, city, since, rating, bio | Avatar, name, rating, bio, Instagram link. No verified badge, city or date. | EXTEND | P03 | QA-S04-01 |
| S04.i.02 | `data-copy` "Copy profile link" (`craftme.in/artist/meera-iyer`) | None. Links use the id. | BUILD a short link `/artist/<slug>` that redirects to the permanent `/artist/<id>` (PD22). The Artist can change the slug in settings. | P03 | QA-S04-01 |
| S04.i.03 | `data-c="Artist stats"`: artworks, orders shipped, average time to ship | None | BUILD (read function) | P03 | QA-S04-05 |
| S04.i.04 | Inventory: unknown or non-artist id | Handled (`isBadId`, `roles` check) | VERIFY | P03 | QA-S04-07 |
| S04.i.05 | Inventory: restricted shop, owner view | Handled (`ownerBar`, restricted empty state) | VERIFY | P03 | QA-S04-07 |
| S04.i.06 | Inventory: only approved reviews count | `decide_review` updates the average on approval only | VERIFY | P03 | QA-S04-03 |
| S04.i.07 | Inventory: no bio, photo, ratings or works | Handled piecemeal | VERIFY | P03 | QA-S04-07 |

## S05 Log in, S06 Sign up, S07 Reset password

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S05 | `login.html` | `src/components/auth/Login.jsx` | EXTEND | P04 | QA-S05-01 |
| S05.st.default | `default`: Google button, email form; `data-c="Log in card"` | Google button only | DIVERGE (D01): Google only | P04 | QA-S05-01 |
| S05.st.error | `error` Wrong password; `data-c="Error alert"` | — | DEFER (D01) | — | — |
| S05.i.01 | Inventory: Google consent cancelled or failed | `signInWithGoogle` reports only a start failure; a cancelled consent returns to the site with an error in the URL, unhandled | EXTEND | P04 | QA-S05-03 |
| S05.i.02 | Inventory: return to the intended page | `Login.jsx` reads `location.state.from`, but `signInWithOAuth` redirects to `window.location.origin`, so the state is lost on return | EXTEND | P04 | QA-S05-02 |
| S05.i.03 | Inventory: new versus existing account | `handle_new_user` trigger creates the profile once | VERIFY | P04 | QA-S05-04 |
| S05.i.04 | `#email`, `#pw`, "Keep me logged in", "Forgot password?", "Create an Account" | — | DEFER (D01) | — | — |
| S05.i.05 | `data-c="Side artwork"` | None | BUILD (one featured work, hidden under 900 px) | P04 | QA-S05-01 |
| S05.i.06 | D01: policy acceptance on first sign-in | None | BUILD (PD21) | P04 | QA-S05-04 |
| S06 | `signup.html`; `data-c="Sign up card"` | No route | DEFER (D01) | — | — |
| S06.st.default | `default` | — | DEFER (D01) | — | — |
| S06.st.error | `error` Validation errors | — | DEFER (D01). Its consent checkbox survives as S05.i.06. | — | — |
| S07 | `reset.html`; `data-c="Reset card"` | No route | DEFER (D01) | — | — |
| S07.st.default | `default` Request | — | DEFER (D01) | — | — |
| S07.st.sent | `sent` Link sent | — | DEFER (D01) | — | — |

## S08 Cart (`cart.html`, `/cart`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S08 | `cart.html` | `src/pages/CartPage.jsx`, `src/contexts/CartContext.jsx`, `src/contexts/cart.js` | EXTEND | P01 | QA-S08-01 |
| S08.st.default | `default` With items; `data-c="One Artist note"` | Lines, summary, one-artist note | EXTEND | P01 | QA-S08-01 |
| S08.st.empty | `empty`; `data-c="Empty Cart"` | Empty state plus Saved for later | VERIFY | P01 | QA-S08-02 |
| S08.st.price-changed | `price-changed`, `data-c="Price changed alert"`, "Accept new prices" | The Cart shows today's price with no notice. `place_order` rejects `price_changed` with `changedLines`. | BUILD | P01 | QA-S08-03 |
| S08.i.01 | Header "2 items from one Artist", Keep browsing; `data-c="Page header"` | Title and one sentence | EXTEND | P01 | QA-S08-01 |
| S08.i.02 | `data-c="Artist group"`: name, city, ships within 7 days, rating, View Artist | None | BUILD | P01 | QA-S08-01 |
| S08.i.03 | `data-c="Cart line"`: kind, details, stock, stepper (`data-max`), remove, unit, total | Title, stepper to 10, remove, totals. Not capped by stock. | EXTEND | P01 | QA-S08-04 |
| S08.i.04 | Sold line removed with a notice | Badge "No longer available. Please remove it."; checkout disabled | EXTEND: one-click "Remove unavailable" and a named notice | P01 | QA-S08-03 |
| S08.i.05 | `data-c="Summary"` | Present | VERIFY | P01 | QA-S08-01 |
| S08.i.06 | `#promo` Gift note, 120 | None | BUILD (PD14) | P01 | QA-S08-01 |
| S08.i.07 | Inventory: quantity to zero removes | `SET_QTY` below 1 removes (`cart.js`) | VERIFY | P01 | QA-S08-04 |
| S08.i.08 | — (KD03) Saved for later: restore group, move one, unavailable | `SavedCart` in `CartPage.jsx`, `switch_saved_cart` | KEEP | P01 | QA-S08-05 |
| S08.i.09 | Inventory: restore cap and excess | `excess` message (`CartContext.jsx`) | VERIFY | P01 | QA-S08-06 |
| S08.i.10 | Inventory: failing switch, replay after reload | Journal `cm-cart-operation:<uid>`, `retry` | VERIFY | P01 | QA-S08-07 |
| S08.i.11 | Inventory: saved lines never reach checkout | Checkout sends `cart.items` only | VERIFY | P01 | QA-S08-08 |
| S08.i.12 | D07: Add all by artist with another artist's cart active | `WishlistPage.jsx` `addAll` adds only the first work | EXTEND | P01 | QA-S08-09 |

## S09 Checkout (`checkout.html`, `/checkout`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S09 | `checkout.html` | `src/pages/CheckoutPage.jsx` | EXTEND | P01 | QA-S09-01 |
| S09.st.default | `default` | Six-field form, then `HeldPayment` | EXTEND | P01 | QA-S09-01 |
| S09.st.error | `error`: summary "Fix 3 things", inline hints | Inline errors after blur; no summary | EXTEND | P01 | QA-S09-02 |
| S09.st.expired | `expired`, `data-c="Hold expired"`, disabled Pay, Return to Cart | "Your time ran out" with Back to Cart | EXTEND | P01 | QA-S09-05 |
| S09.i.01 | `data-c="Steps"` Address, Pay, Done | None | BUILD | P01 | QA-S09-01 |
| S09.i.02 | `#cn`, `#cph` (+91), `#a1`, `#a2`, `#lm`, `#pin`, `#ct`, `#st` select; `data-c="Shipping address"` | name, phone, address, city, state (text), pin. `order_shipping` has one `address` column. | EXTEND | P01 | QA-S09-01 |
| S09.i.03 | "PIN codes have 6 digits. This one isn't served.", "We'll fill city and State when we can." | Format check only | DEFER the lookup and autofill (PD04). Format check stays. | P01 | QA-S09-02 |
| S09.i.04 | "Save this address to my profile" | None | BUILD (A4) | P01 | QA-S09-03 |
| S09.i.05 | Address privacy notice | None | BUILD | P01 | QA-S09-01 |
| S09.i.06 | `data-c="Payment method note"` | None | BUILD | P01 | QA-S09-01 |
| S09.i.07 | Terms and Refund policy checkbox | None | BUILD | P01 | QA-S09-02 |
| S09.i.08 | Pay button with amount | "Continue to payment", then "Pay ₹…" | EXTEND | P01 | QA-S09-01 |
| S09.i.09 | `data-c="Order summary"`, Edit Cart | None on this page | BUILD | P01 | QA-S09-01 |
| S09.i.10 | `data-c="Hold timer"` | `useCountdown`, shown after the hold starts | EXTEND | P01 | QA-S09-04 |
| S09.i.11 | Inventory: refresh during a hold; return to a pending hold | The hold lives in React state. A refresh loses it and a new order makes a second hold (up to 3). | BUILD: resume the open hold | P01 | QA-S09-04 |
| S09.i.12 | Inventory: stock or price race | `place_order`: `sold`, `price_changed`; error text exists | VERIFY | P01 | QA-S09-06 |
| S09.i.13 | Inventory: dismissal and retry while held | `HeldPayment` "Pay" again | VERIFY | P01 | QA-S10-03 |
| S09.i.14 | — (KD12) three open holds | `too_many_holds`, text exists | VERIFY | P01 | QA-S09-08 |
| S09.i.15 | D15: payments not configured | `configured()` throws `payments_not_configured`; no specific text | EXTEND | P01 | QA-S09-07 |
| S09.i.16 | Inventory: address visible to the order's artist only after payment | `order_shipping_read` policy; schema test "artist cannot see address while on hold" | VERIFY | P01 | QA-S09-09 |

## S10 Payment (`payment-modal.html`, the provider window)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S10 | `payment-modal.html`, `data-c="Gateway pop-up"` | Razorpay Checkout via `src/api/checkout.js` `payWithRazorpay` | PROVIDER | P01 | QA-S10-01 |
| S10.st.card | `card` | Provider | PROVIDER | P01 | QA-S10-01 |
| S10.st.upi | `upi` | Provider | PROVIDER | P01 | QA-S10-02 |
| S10.st.success | `success` "Confirming with the bank…" | Provider, then `confirmPayment` | PROVIDER, plus our own confirming state (S10.i.07) | P01 | QA-S10-01 |
| S10.st.failed | `failed` | Provider | PROVIDER | P01 | QA-S10-03 |
| S10.i.01 | Order panel: amount, order, time left; `data-c="Order panel"` | Amount and "CraftMe order" description; phone prefilled (KD10) | EXTEND: description carries the order code | P01 | QA-S10-01 |
| S10.i.02 | Close button: "Your pieces are still held." | `ondismiss` resolves `dismissed` | VERIFY | P01 | QA-S10-03 |
| S10.i.03 | Inventory: late webhook after the page closed | `webhook()` calls `markPaid`; `useOrder` polls every 4 s | VERIFY | P01 | QA-S10-04 |
| S10.i.04 | Inventory: duplicate callback or event | `processed_events`, `mark_paid` returns the stage untouched; schema test "mark_paid twice changes nothing" | VERIFY | P01 | QA-S10-05 |
| S10.i.05 | Inventory: signature or amount mismatch | `bad_signature`, `amount_mismatch` | VERIFY | P01 | QA-S10-07 |
| S10.i.06 | Inventory: captured after expiry | `mark_paid` accepts if stock is free, else `oversold`, `refund_oversold`, `sold_during_payment` | VERIFY | P01 | QA-S10-06 |
| S10.i.07 | Uncertain result: proof returned but confirmation failed or timed out | `setError(errorText)`; the buyer may have paid and sees an error | BUILD: "Confirming your payment" state that polls | P01 | QA-S10-08 |
| S10.i.08 | Inventory: the cart clears only after success | `clear()` after `confirmPayment` ok | VERIFY; also clear when the poll sees Paid | P01 | QA-S10-04 |
| S10.i.09 | Netbanking, Wallet, QR | Depends on the Razorpay account | PROVIDER | P01 | QA-S10-02 |

## S11 Order placed (`order-placed.html`, `/orders/:id?placed`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S11 | `order-placed.html` | Checkout navigates to `/orders/:id` | BUILD | P01 | QA-S11-01 |
| S11.st.default | `default` | — | BUILD | P01 | QA-S11-01 |
| S11.i.01 | `data-c="Success header"`, copy order code | — | BUILD | P01 | QA-S11-01 |
| S11.i.02 | `data-c="What happens next"` with the real ship-by date, 14 days, 30 days | `ship_by`, `auto_receive_at`, `review_by` exist on the order | BUILD | P01 | QA-S11-01 |
| S11.i.03 | "A confirmation was sent to …" | No email sender | BUILD in P11; until then the line is not shown (D04) | P11 | QA-S35-01 |
| S11.i.04 | `data-c="Order recap"` ship to, from | — | BUILD | P01 | QA-S11-01 |
| S11.i.05 | Inventory: refresh and deep link stay correct | — | BUILD | P01 | QA-S11-02 |
| S11.i.06 | Inventory: no Paid banner while pending or failed | — | BUILD | P01 | QA-S11-03 |
| S11.i.07 | Inventory: ownership | `orders_read` RLS | VERIFY | P01 | QA-S13-08 |

## S12 My orders (`orders.html`, `/orders`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S12 | `orders.html` | `src/pages/OrdersPage.jsx` | EXTEND | P01 | QA-S12-01 |
| S12.st.default | `default`; `data-c="Order list"` | List of links with stage badge | EXTEND | P01 | QA-S12-01 |
| S12.st.empty | `empty` "No Orders yet"; `data-c="Empty state"` | Present | VERIFY | P01 | QA-S12-03 |
| S12.i.01 | `data-c="Filter tabs"` All, To be shipped, Shipped, Received, Refunded with counts | None | BUILD | P01 | QA-S12-01 |
| S12.i.02 | Row: code, stage, date, total, thumbnail, items, artist and city, stage hint | Code, titles, date, total, badge | EXTEND | P01 | QA-S12-01 |
| S12.i.03 | Row actions: View Order, Mark Received, Write a Review | Whole row is a link | BUILD | P01 | QA-S12-02 |
| S12.i.04 | Pagination | `limit(50)`, no paging | BUILD | P01 | QA-S12-04 |
| S12.i.05 | Inventory: loading, error, retry | Skeleton; error ignored | EXTEND | P01 | QA-S12-03 |
| S12.i.06 | Inventory: held, expired and partly refunded orders | Listed with `STAGE_LABEL` | EXTEND: expired holds are hidden from the list; an open hold shows "Finish paying" | P01 | QA-S12-01 |

## S13 Order detail (`order-detail.html`, `/orders/:id`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S13 | `order-detail.html` | `src/pages/OrderPage.jsx` | EXTEND | P01 | QA-S13-01 |
| S13.st.paid | `paid` | Stage label, lines, total | EXTEND | P01 | QA-S13-01 |
| S13.st.shipped | `shipped` | Tracking line, "I received it" | EXTEND | P01 | QA-S13-02 |
| S13.st.received | `received` | Inline review and damage forms | EXTEND | P01 | QA-S13-03 |
| S13.st.refunded | `refunded` | "Refunded ₹…" row | EXTEND | P01 | QA-S13-04 |
| S13.dlg.recv | `#recv` "Confirm it arrived?" Not yet, Yes | Button acts at once | BUILD | P01 | QA-S13-02 |
| S13.i.01 | `data-c="Order header"`, Receipt | Header only | BUILD (PD08) | P01 | QA-S13-07 |
| S13.i.02 | `data-c="Stage tracker"` | None | BUILD | P01 | QA-S13-01 |
| S13.i.03 | `data-c="Stage message"` per stage; Paid says reviewed and usually refunded if late (D05) | None | BUILD; the reference's "refunds you in full" wording is replaced per D05 | P01 | QA-S13-01 |
| S13.i.04 | `data-c="Items"` with per-line refund mark | Lines without refund marks; `order_lines.refunded_quantity` exists | EXTEND | P01 | QA-S13-04 |
| S13.i.05 | `data-c="Tracking"` courier, number copy, date | One text line | EXTEND | P01 | QA-S13-02 |
| S13.i.06 | `data-c="Refund details"` reason, amount, issued, arrival | `refunds` rows are readable by the buyer; unused | WIRE | P01 | QA-S13-04 |
| S13.i.07 | `data-c="Timeline"` | None. Times exist on `orders`, `refunds`, `damage_reports`. | BUILD from existing timestamps | P01 | QA-S13-01 |
| S13.i.08 | `data-c="Actions"`: received, damage link, review link, disabled Cancel, Contact CraftMe | Receive; inline forms | EXTEND (PD13) | P01 | QA-S13-03 |
| S13.i.09 | `data-c="Shipping address"`, `data-c="Payment"` method | None. No payment-method column. | BUILD | P01 | QA-S13-01 |
| S13.i.10 | Inventory: hold and expired extensions, hold expiring on the page | Info alert with countdown; no pay button; after expiry nothing changes until the poll | EXTEND | P01 | QA-S13-05 |
| S13.i.11 | Inventory: access denial | RLS returns no row, page says "We couldn't find this order" | VERIFY | P01 | QA-S13-08 |
| S13.i.12 | Inventory: repeated confirmation, auto-receipt | `confirm_received` fails `wrong_stage` the second time; `sweep` auto-receives | VERIFY | P01 | QA-S13-06 |
| S13.i.13 | D06: Review after a refund | `canReview` needs `received`; a full refund sets `refunded` | VERIFY; show Review in the refunded panel only for a partial refund | P02 | QA-S15-05 |
| S13.i.14 | Inventory: capability changes at cut-offs while open | `buyerActions` computed at fetch time; refreshed by the 4 s poll | VERIFY | P02 | QA-S13-09 |
| S13.i.15 | Refund still pending or unknown at the provider | `refunds.status` exists; unused in the UI | WIRE | P01 | QA-S13-10 |

## S14 Damage Report (`damage-report.html`, `/orders/:id/damage`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S14 | `damage-report.html` | `DamageForm` inside `OrderPage.jsx` | EXTEND | P02 | QA-S14-01 |
| S14.st.default | `default` Form | Inline form: note 500, up to 5 optional photos, all lines | EXTEND (D08) | P02 | QA-S14-01 |
| S14.st.submitted | `submitted`, reference number, "What happens now"; `data-c="Submitted"` | A one-line message that is lost on refresh | BUILD | P02 | QA-S14-05 |
| S14.i.01 | `data-c="Window notice"` deadline | None | BUILD | P02 | QA-S14-01 |
| S14.i.02 | `data-c="Affected items"` checkboxes | Sends every line | BUILD | P02 | QA-S14-02 |
| S14.i.03 | Type of damage, five radios; `data-c="What happened"` | None; no column | BUILD | P02 | QA-S14-01 |
| S14.i.04 | `#dd` 800 with counter | 500 in the UI and in `report_damage` | EXTEND | P02 | QA-S14-02 |
| S14.i.05 | `data-c="Photos"` dropzone, 2 to 6, JPEG or PNG, 5 MB, previews, remove | File input, up to 5, optional. Bucket also allows WebP. SQL checks the path prefix only. | EXTEND | P02 | QA-S14-03 |
| S14.i.06 | Inventory: partial upload then retry | `Promise.all` uploads, first failure aborts, files stay in storage | EXTEND | P02 | QA-S14-04 |
| S14.i.07 | Inventory: already submitted | `already_exists`; unique `(order_id)` | VERIFY | P02 | QA-S14-06 |
| S14.i.08 | Inventory: cut-off crossed during upload | `window_closed` | VERIFY | P02 | QA-S14-07 |
| S14.i.09 | D08: orphaned photos after a failed submit | No cleanup; no delete policy on the `damage` bucket | BUILD | P02 | QA-S14-04 |
| S14.i.10 | Inventory: wrong role or order | `forbidden` | VERIFY | P02 | QA-S14-08 |
| S14.i.11 | `data-c="What to expect"` | None | BUILD | P02 | QA-S14-01 |
| S14.i.12 | "We'll email you when we've decided." | No such email (D04) | DIVERGE: "You'll get a notification here when we've decided." | P02 | QA-S14-05 |

## S15 Write a Review (`review.html`, `/orders/:id/review`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S15 | `review.html` | `ReviewForm.jsx` inline on `OrderPage.jsx` | EXTEND | P02 | QA-S15-01 |
| S15.st.default | `default` Form | Rating buttons and a text box | EXTEND | P02 | QA-S15-01 |
| S15.st.closed | `closed` with the close date; `data-c="Window closed"` | None; the form disappears | BUILD | P02 | QA-S15-03 |
| S15.i.01 | `data-c="Artist and Order"`, "Window closes in 11 days" | None | BUILD | P02 | QA-S15-01 |
| S15.i.02 | `data-rate` stars, "4 of 5"; `data-c="Rating"` | Five buttons with `role="radio"` | EXTEND | P02 | QA-S15-01 |
| S15.i.03 | `#rc` 500, counter, "Don't include your address, phone number or links" | 500 enforced in Yup and SQL | EXTEND | P02 | QA-S15-02 |
| S15.i.04 | "Good things to mention" chips | None | BUILD (PD11) | P02 | QA-S15-01 |
| S15.i.05 | Moderation and cannot-edit notice | Thanks message after sending | EXTEND | P02 | QA-S15-01 |
| S15.i.06 | Inventory: repeated submit, already reviewed | `already_exists` | VERIFY; add an "already reviewed" view with the review's status | P02 | QA-S15-04 |
| S15.i.07 | Inventory: deadline race | `window_closed` | VERIFY | P02 | QA-S15-03 |
| S15.i.08 | Inventory: approved versus rejected, visible to the buyer | `reviews_read` lets the buyer read their own row | WIRE | P02 | QA-S15-06 |

## S16 Profile (`profile.html`, `/profile`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S16 | `profile.html` | No route. `ProfileEdit.jsx` is the artist editor. | BUILD | P04 | QA-S16-01 |
| S16.st.default | `default` | — | BUILD | P04 | QA-S16-01 |
| S16.dlg.addr | `#addr` Edit saved address | — | BUILD (A4) | P04 | QA-S16-03 |
| S16.dlg.del | `#del` alertdialog, type DELETE; `data-c="Delete account"` | — | BUILD (D11) | P04 | QA-S16-05 |
| S16.i.01 | Change photo, Remove (JPEG or PNG, 5 MB) | `photo_url` is writable; no bucket a non-artist may upload to | BUILD | P04 | QA-S16-02 |
| S16.i.02 | `#pn` name, `#pe` read-only email, `#pph` phone, `#pb` bio 200; `data-c="Profile form"` | `saveProfile` writes name, bio (500), handle | EXTEND (PD12) | P04 | QA-S16-01 |
| S16.i.03 | `data-c="Saved address"` | — | BUILD | P04 | QA-S16-03 |
| S16.i.04 | `data-c="Change password"` | — | DIVERGE (D01): one sentence, "You sign in with Google." No fields. | P04 | QA-S16-01 |
| S16.i.05 | `data-c="Roles"`, Become an Artist | — | BUILD | P04 | QA-S16-01 |
| S16.i.06 | `data-c="Shortcuts"` | — | BUILD | P04 | QA-S16-01 |
| S16.i.07 | Inventory: owner-only address | — | BUILD with RLS | P04 | QA-S16-04 |
| S16.i.08 | Inventory: deletion with open orders; accounting kept | — | BUILD (D11) | P04 | QA-S16-06 |
| S16.i.09 | Inventory: invalid upload, partial save | — | BUILD | P04 | QA-S16-02 |
| S16.i.10 | D11: Admin sees pending deletion requests | — | BUILD | P09 | QA-S16-07 |

## S17 Notifications (`notifications.html`, `/notifications`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S17 | `notifications.html` | Bell only (`NotificationBell.jsx`, `NotificationsContext.jsx`) | BUILD | P04 | QA-S17-01 |
| S17.st.default | `default` List | — | BUILD | P04 | QA-S17-01 |
| S17.st.empty | `empty` "You're all caught up"; `data-c="Empty state"` | Bell shows that line | BUILD | P04 | QA-S17-02 |
| S17.i.01 | `data-c="Filter chips"` All, Unread (count), Orders, Reviews | — | BUILD | P04 | QA-S17-01 |
| S17.i.02 | Today, Earlier, "New" marker, relative time; `data-c="Today"`; `data-c="Earlier"` | — | BUILD | P04 | QA-S17-01 |
| S17.i.03 | Pagination | `useNotifications` reads the latest 20 | BUILD | P04 | QA-S17-01 |
| S17.i.04 | Mark all as read | `markAllRead` | WIRE | P04 | QA-S17-03 |
| S17.i.05 | Events drawn: shipped, paid, review approved, review prompt, refund issued, auto-received | Producers exist for `order_paid`, `order_new`, `order_shipped`, `order_received`, `order_refunded`, `ship_reminder`, `instagram_reconnect` | EXTEND: add review decided, damage decided, auto-received, review prompt, payout sent, verification, restriction | P04 | QA-S17-04 |
| S17.i.06 | Inventory: missing or inaccessible target | `notificationTarget` returns a list page | VERIFY | P04 | QA-S17-05 |
| S17.i.07 | Inventory: counts agree across devices | Polling every 20 s | VERIFY | P04 | QA-S17-03 |

## S18 Become an Artist (`become-artist.html`, `/become-artist`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S18 | `become-artist.html`; `data-c="Stepper"` | No route. Backend: `submit_verification`, `payOnboardingFee`, `markFeePaid`, `becomeArtist`. | WIRE | P05 | QA-S18-01 |
| S18.st.step1 | `step1` Details | `submit_verification` (legal name, PAN, payout method) | WIRE | P05 | QA-S18-01 |
| S18.st.step2 | `step2` Phone check | No OTP provider; `phone_verified` is read from the JWT phone claim | BUILD (D03) | P05 | QA-S18-03 |
| S18.st.step3 | `step3` Onboarding Fee | `payOnboardingFee`, webhook `markFeePaid` | WIRE | P05 | QA-S18-05 |
| S18.st.done | `done`; `data-c="Done"` | `becomeArtist`, `refreshClaims` | WIRE | P05 | QA-S18-06 |
| S18.i.01 | `data-c="Identity"`: legal name, PAN, city, state | Name and PAN validated; no city or state | EXTEND | P05 | QA-S18-01 |
| S18.i.02 | `data-c="Payout details"`: UPI or bank, holder, IFSC, account, confirm account | UPI and bank validated; no holder name | EXTEND | P05 | QA-S18-02 |
| S18.i.03 | `data-c="Your shop"`: bio 300, what you make, two declarations | None | BUILD | P05 | QA-S18-01 |
| S18.i.04 | `data-c="Phone check"`: six digits, 10 minutes, resend timer, change number | None | BUILD; copy says WhatsApp (D03) | P05 | QA-S18-03, QA-S18-04 |
| S18.i.05 | `data-c="Onboarding fee"`: amount, not-refunded checkbox, pay | Amount from `settings.onboarding_fee_paise` | WIRE | P05 | QA-S18-05 |
| S18.i.06 | Inventory: cancelled, duplicate or late fee payment | `already_paid`; the webhook records the fee | VERIFY | P05 | QA-S18-07 |
| S18.i.07 | Inventory: resume after reload | State is on the server (`artist_private`) | BUILD the resume logic | P05 | QA-S18-08 |
| S18.i.08 | Inventory: role claims refresh | `refreshClaims` in `AuthContext.jsx` | WIRE | P05 | QA-S18-06 |
| S18.i.09 | S34 "Accept new Artists" off | No switch read | BUILD | P05 | QA-S18-09 |
| S18.i.10 | D15: OTP or payments not configured | — | BUILD | P05 | QA-S18-09 |
| S18.i.11 | `data-c="How selling works"` | — | BUILD | P05 | QA-S18-01 |

## S19 Legal (`legal.html`, `/legal/*`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S19 | `legal.html` | `Privacy.jsx` at `/privacy`, `InstagramDeletion.jsx` at `/instagram-deletion` | EXTEND | P04 | QA-S19-01 |
| S19.st.default | `default` | — | BUILD | P04 | QA-S19-01 |
| S19.tab.terms | `#terms` | None | BUILD (D14) | P04 | QA-S19-01 |
| S19.tab.privacy | `#privacy` | `Privacy.jsx` text | EXTEND | P04 | QA-S19-01 |
| S19.tab.refunds | `#refunds` | None | BUILD as "Cancellation and Refunds" (D14) | P04 | QA-S19-02 |
| S19.tab.artist | `#artist` | None | BUILD | P04 | QA-S19-01 |
| S19.tab.deletion | `#deletion` and the request form | Instagram status page only | BUILD (D11) | P04 | QA-S19-03 |
| S19.i.01 | D14: Shipping Policy and Contact Us pages | None | BUILD (PD13) | P04 | QA-S19-01 |
| S19.i.02 | `data-c="Draft notice"` | — | DIVERGE: never shipped. A build check fails if placeholder text remains. | P04 | QA-S19-05 |
| S19.i.03 | Deep links and tab hash (`data-hash`); `data-c="Page tabs"` | — | BUILD: `/legal/:page`; `/privacy` redirects | P04 | QA-S19-01 |
| S19.i.04 | — (KD07) Instagram deletion status | `InstagramDeletion.jsx`, `instagram_deletion_status` | KEEP | P04 | QA-S19-04 |
| S19.i.05 | Inventory: policy numbers match the rules | — | BUILD from one constants file | P04 | QA-S19-02 |

## S20 Not found (`not-found.html`, `*`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S20 | `not-found.html` | `NotFound` in `App.jsx` | EXTEND | P00 | QA-S20-01 |
| S20.st.default | `default` "This wall is empty.", search, Go to Home, Browse art | Title and "Go home" | EXTEND | P00 | QA-S20-01 |
| S20.i.01 | Inventory: malformed artwork, artist or order id | Artist handles it (`isBadId`); artwork and order treat it as an error or empty | EXTEND | P00 | QA-S20-02 |
| S20.i.02 | Inventory: private records are not revealed | Order page says "couldn't find" for both cases | VERIFY | P00 | QA-S13-08 |
| S20.i.03 | Inventory: network error is not "not found" | Artist page separates them; others do not | EXTEND | P00 | QA-S20-02 |

## S21 Dashboard overview (`dash-home.html`, `/dashboard`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S21 | `dash-home.html` | No route | BUILD | P07 | QA-S21-01 |
| S21.st.default | `default` Normal | — | BUILD | P07 | QA-S21-01 |
| S21.st.owed | `owed`, `data-c="Amount Owed banner"` | `artist_private.amount_owed` readable by the owner | WIRE | P07 | QA-S21-03 |
| S21.st.restricted | `restricted`, `data-c="Restricted banner"`, "Clear my balance" | `profiles.restricted`, `restriction_reasons` | WIRE | P07 | QA-S21-03 |
| S21.i.01 | `data-c="Page header"`: date, greeting, View my shop, Add Artwork | — | BUILD | P07 | QA-S21-01 |
| S21.i.02 | `data-c="Stats"`: sales and orders this month, next payment, rating | — | BUILD (read function) | P07 | QA-S21-01 |
| S21.i.03 | `data-c="Orders to ship"` with overdue | `useArtistInbox` | WIRE | P07 | QA-S21-01 |
| S21.i.04 | `data-c="Sales chart"` 8 weeks, 6 months | — | BUILD | P07 | QA-S21-02 |
| S21.i.05 | `data-c="Coming up for payment"` | — | BUILD | P07 | QA-S21-01 |
| S21.i.06 | `data-c="Setup checklist"` | — | BUILD | P07 | QA-S21-04 |
| S21.i.07 | `data-c="New Reviews"`, `data-c="Activity"` | Reviews readable by the artist; activity from notifications | WIRE | P07 | QA-S21-01 |
| S21.i.08 | Inventory: new artist with no activity | — | BUILD | P07 | QA-S21-04 |

## S22 My Artworks (`dash-artworks.html`, `/dashboard/artworks`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S22 | `dash-artworks.html` | `src/pages/MyWorks.jsx` at `/dashboard/works` | EXTEND | P06 | QA-S22-01 |
| S22.st.default | `default` List | Cards with price editing and take down | EXTEND | P06 | QA-S22-01 |
| S22.st.empty | `empty` "Your wall is empty"; `data-c="Empty state"` | "No works yet" | EXTEND | P06 | QA-S22-05 |
| S22.dlg.end | `#end` alertdialog "End all Listings of this Artwork?" | `window.confirm`, and "take down" sets listings back to `draft`, not `ended` | EXTEND | P06 | QA-S22-02 |
| S22.i.01 | Tabs All, Published, Drafts, Sold, Ended with counts; `data-c="Toolbar"` | None | BUILD | P06 | QA-S22-01 |
| S22.i.02 | "Search my Artworks" | None | BUILD (in the loaded list) | P06 | QA-S22-01 |
| S22.i.03 | `data-c="Artworks table"`: listings per work, status, views, updated | Listings shown; no views, no updated date | EXTEND (PD09) | P06 | QA-S22-01 |
| S22.i.04 | Actions Edit, End, View, Finish, Reopen | View, Take down, Put back, Save price, Put on sale | EXTEND | P06 | QA-S22-02 |
| S22.i.05 | Delete: disabled with sales, allowed for a draft | None. Clients cannot set `removed`. | BUILD (mismatch 10: B10 rule) | P06 | QA-S22-03 |
| S22.i.06 | Pagination | `limit(100)` | BUILD | P06 | QA-S22-01 |
| S22.i.07 | Inventory: restricted artist | Policies block inserts; updates need `artist_open` | VERIFY, plus a banner | P06 | QA-S22-04 |

## S23 Artwork editor (`dash-artwork-edit.html`, `/dashboard/artworks/:id`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S23 | `dash-artwork-edit.html` | `NewArtwork.jsx` and `ArtworkUploadForm.jsx` create only | EXTEND | P06 | QA-S23-01 |
| S23.st.default | `default` Editing | Create form | EXTEND | P06 | QA-S23-01 |
| S23.st.errors | `errors` "3 things stop you publishing" | Inline Yup errors | EXTEND | P06 | QA-S23-02 |
| S23.dlg.lst | `#lst` Add or edit Listing | One listing at creation; price edit in `MyWorks` | BUILD | P06 | QA-S23-03 |
| S23.dlg.del | `#del` Delete this Artwork? | None | BUILD | P06 | QA-S22-03 |
| S23.i.01 | `data-c="Details"`: title 100, category, year, medium, signed, description 1000 | Title, description, category. No year, medium, signed. | EXTEND | P06 | QA-S23-01 |
| S23.i.02 | `data-c="Photos"`: up to 5, cover first, remove | Choose files once; no remove or reorder; no editing later | EXTEND | P06 | QA-S23-04 |
| S23.i.03 | `data-c="Video"`: none, reel link with "Check link", upload | Reel picker from the artist's reels. `video` column unused by the UI. | EXTEND (PD06) | P06 | QA-S23-05 |
| S23.i.04 | `data-c="Listings"` table: Edit, End | — | BUILD | P06 | QA-S23-03 |
| S23.i.05 | "What you'd receive: ≈ ₹…" | Commission is hidden from clients | BUILD (PD19) | P06 | QA-S23-03 |
| S23.i.06 | `data-c="Publish panel"` checklist, verification note | Publish button | EXTEND | P06 | QA-S23-02 |
| S23.i.07 | "Saved automatically", Save draft, Preview | Publishes at once; a failure leaves a draft | EXTEND: explicit Save draft and Preview; no timed autosave | P06 | QA-S23-06 |
| S23.i.08 | Inventory: failed save after upload | Message tells the artist a draft was kept | EXTEND | P06 | QA-S23-06 |
| S23.i.09 | Inventory: publish retry makes no duplicate listing | `sellArtwork` inserts a listing each call | EXTEND | P06 | QA-S23-07 |
| S23.i.10 | Inventory: sold work and restricted artist edits | Policies: sold listings are not updatable | VERIFY | P06 | QA-S23-08 |
| S23.i.11 | Inventory: other artist's work | RLS | VERIFY | P06 | QA-S23-08 |

## S24 Order inbox (`dash-orders.html`, `/dashboard/orders`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S24 | `dash-orders.html` | `src/pages/ArtistInbox.jsx` | EXTEND | P07 | QA-S24-01 |
| S24.st.default | `default` Inbox | Cards with an inline ship form | EXTEND | P07 | QA-S24-01 |
| S24.st.empty | `empty` "No Orders to ship", Check my Listings | "No orders yet" | EXTEND | P07 | QA-S24-02 |
| S24.i.01 | Tabs To ship, Shipped, Received, Refunded, All with counts; `data-c="Tabs"` | None | BUILD | P07 | QA-S24-01 |
| S24.i.02 | Columns: order, buyer and city, items, paid, ship by, you receive; `data-c="Orders table"` | Code, date, items, total, stage | EXTEND | P07 | QA-S24-01 |
| S24.i.03 | Overdue marker, "Ship now" | `orders.overdue` unused | WIRE | P07 | QA-S24-01 |
| S24.i.04 | Inventory: open holds hidden | `useArtistInbox` returns every stage, including `hold` and `hold_expired` | EXTEND | P07 | QA-S24-03 |
| S24.i.05 | Inventory: other artists' orders excluded | RLS and `.eq('artist_id')` | VERIFY | P07 | QA-S24-03 |
| S24.i.06 | "…and you get an email" | Only true after P11 | BUILD in P11; text gated until then | P11 | QA-S35-02 |
| S24.i.07 | Inventory: paging and errors | `limit(50)`; error ignored | EXTEND | P07 | QA-S24-02 |

## S25 Order, Artist view (`dash-order-detail.html`, `/dashboard/orders/:id`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S25 | `dash-order-detail.html` | No route. Ship form is inline in the inbox. | BUILD | P07 | QA-S25-01 |
| S25.st.paid | `paid` To ship | `mark_shipped` | WIRE | P07 | QA-S25-01 |
| S25.st.shipped | `shipped`; `data-c="Tracking"` | — | BUILD | P07 | QA-S25-03 |
| S25.dlg.ship | `#ship`: courier select, tracking\*, date posted | Courier text, optional tracking | EXTEND. Tracking stays optional: `GLOSSARY.md` ("optionally with a tracking number") outranks the mock. Date posted is not stored (PD05). | P07 | QA-S25-02 |
| S25.i.01 | `data-c="Deadline"` | — | BUILD; wording follows D05 | P07 | QA-S25-01 |
| S25.i.02 | `data-c="Pack list"` | — | BUILD, with the gift note (PD14) | P07 | QA-S25-01 |
| S25.i.03 | `data-c="Ship to"`, Copy address, privacy note | `order_shipping` is readable once Paid; the inbox does not show it | WIRE | P07 | QA-S25-01 |
| S25.i.04 | `data-c="Your share"` | — | BUILD from order figures | P07 | QA-S25-05 |
| S25.i.05 | "Edit tracking" after Shipped | No function | BUILD | P07 | QA-S25-03 |
| S25.i.06 | `data-c="Timeline"` | — | BUILD | P07 | QA-S25-03 |
| S25.i.07 | Inventory: held order or other artist cannot open it | RLS | VERIFY | P07 | QA-S25-04 |
| S25.i.08 | Inventory: repeated mark-shipped, no reversal | `wrong_stage` | VERIFY | P07 | QA-S25-02 |
| S25.i.09 | Received and Refunded orders opened from the inbox tabs | — | BUILD (two more read-only variants) | P07 | QA-S25-06 |

## S26 Payouts (`dash-payouts.html`, `/dashboard/payouts`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S26 | `dash-payouts.html` | No route. `payouts` rows are readable by the artist. | WIRE | P07 | QA-S26-01 |
| S26.st.default | `default` Normal | — | WIRE | P07 | QA-S26-01 |
| S26.st.owed | `owed`, `#owed`, "Pay ₹3,200 now"; `data-c="Amount Owed"` | No payment path (mismatch 6) | BUILD (D10) | P07 | QA-S26-04 |
| S26.dlg.stmt | `#stmt` statement per order | Orders carry `payout_id` | WIRE | P07 | QA-S26-02 |
| S26.i.01 | `data-c="Summary"` four tiles | — | BUILD (read function) | P07 | QA-S26-01 |
| S26.i.02 | `data-c="Payable Orders"` with price, share, payment cost, refunds, net | `payout_calc` holds the rule | WIRE | P07 | QA-S26-01 |
| S26.i.03 | `data-c="History"` | `payouts` | WIRE | P07 | QA-S26-02 |
| S26.i.04 | `data-c="Next Payout"` date, masked destination, Change payout details; `data-c="How it's worked out"` | — | BUILD | P07 | QA-S26-03 |
| S26.i.05 | "You were paid ₹22,340 after small rounding changes." | Fixture | DIVERGE (A6): statements show ledger figures only; the line is not shown | P07 | QA-S26-02 |
| S26.i.06 | D10a: excess or duplicate payment becomes a credit | — | BUILD | P07 | QA-S26-05 |
| S26.i.07 | Inventory: verification pending | `_build_payout_run` blocks unverified artists | WIRE (notice) | P07 | QA-S26-06 |
| S26.i.08 | Inventory: refund after payout, owed larger than payable | `reserve_refund`, `payout_calc` | VERIFY | P07 | QA-S26-07 |
| S26.i.09 | Inventory: empty history, authorization | RLS | VERIFY | P07 | QA-S26-08 |

## S27 Instagram (`dash-instagram.html`, `/dashboard/instagram`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S27 | `dash-instagram.html` | `ReelsManager.jsx` and `InstagramConnect.jsx` inside `ProfileEdit.jsx` | EXTEND | P08 | QA-S27-01 |
| S27.st.disconnected | `disconnected`, `data-c="Connect card"` | Connect card | EXTEND | P08 | QA-S27-01 |
| S27.st.connected | `connected`, `data-c="Connected account"`, `data-c="Showcase manager"` | "Connected as @…", reel list with highlight | EXTEND | P08 | QA-S27-03 |
| S27.st.picker | `picker`, `#picker`; `data-c="Post picker"` | Checkbox grid, reels and videos only | EXTEND (D09) | P08 | QA-S27-04 |
| S27.st.lapsed | `lapsed`, `data-c="Lapsed"` | `needsReconnect` alert | VERIFY | P08 | QA-S27-06 |
| S27.st.disabled | `disabled`, `data-c="Connect off"` | The card is hidden when not configured | EXTEND: show the notice | P08 | QA-S27-07 |
| S27.dlg.disc | `#disc` "Disconnect and delete" | `window.confirm`; keeps reels as plain links | EXTEND (D09) | P08 | QA-S27-05 |
| S27.i.01 | Read-only explanation, Business or Creator only | Short sentence | EXTEND | P08 | QA-S27-01 |
| S27.i.02 | Inventory: popup blocked or cancelled | Same-tab fallback; `denied`, `expired` messages (`src/lib/instagram.js`) | KEEP (KD07) | P08 | QA-S27-02 |
| S27.i.03 | Inventory: personal account | `no_account` message | VERIFY | P08 | QA-S27-02 |
| S27.i.04 | Showcase: order, "6 of 9 used", move, remove, View on my profile | 12 total, 6 highlighted, up and down arrows | EXTEND (D09) | P08 | QA-S27-03 |
| S27.i.05 | Picker: All, Reels, Posts; multi-select; cap; Load older posts | First 50 media, no paging, no posts | EXTEND | P08 | QA-S27-04 |
| S27.i.06 | Inventory: duplicate or partial import | `added`, `refused` with reasons | VERIFY | P08 | QA-S27-04 |
| S27.i.07 | `#paste`: link input, wrong-link example, link to an Artwork; `data-c="Paste links"` | Paste form with ownership checkbox, name, cover | EXTEND | P08 | QA-S27-08 |
| S27.i.08 | `data-c="Artwork reels"` list | Reel chosen in the artwork form | BUILD the list | P08 | QA-S27-08 |
| S27.i.09 | Inventory: provider revocation and deletion callback | `deauthorize`, `dataDeletion` | KEEP (KD07) | P08 | QA-S27-09 |
| S27.i.10 | Inventory: public visibility of picks | `useReels(id)` highlighted only | VERIFY | P08 | QA-S04-04 |

## S28 Artist settings (`dash-settings.html`, `/dashboard/settings`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S28 | `dash-settings.html` | `ProfileEdit.jsx` (name, bio, handle) | EXTEND | P07 | QA-S28-01 |
| S28.st.default | `default` | — | EXTEND | P07 | QA-S28-01 |
| S28.dlg.pay | `#pay` Edit payout details | `submit_verification` re-opens the check on any edit | WIRE | P07 | QA-S28-02 |
| S28.i.01 | `data-c="Verification"` timeline | `artist_private` readable by the owner | WIRE | P07 | QA-S28-01 |
| S28.i.02 | `data-c="Payout details"` masked | — | BUILD (shown through one `mask()` helper; the row is the Artist's own and stays unreadable to anyone else under `artist_private_read`) | P07 | QA-S28-01 |
| S28.i.03 | `data-c="Shop profile"`: photo, name, city, bio 300, profile link | Name, bio, handle | EXTEND (PD22: the short link is editable; it redirects to the id URL) | P07 | QA-S28-03 |
| S28.i.04 | `data-c="Notifications"` email switches | — | BUILD (PD18) | P07 | QA-S28-04 |
| S28.i.05 | `data-c="Close shop"` | — | BUILD (A8, PD17) | P07 | QA-S28-05 |
| S28.i.06 | `data-c="Account status"`, Artist agreement | — | BUILD | P07 | QA-S28-01 |
| S28.i.07 | Inventory: restricted editing; buyer access after closure | — | BUILD | P07 | QA-S28-06 |

## S29 Admin overview (`admin-dashboard.html`, `/admin`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S29 | `admin-dashboard.html` | No route | BUILD | P09 | QA-S29-01 |
| S29.st.default | `default` | — | BUILD | P09 | QA-S29-01 |
| S29.i.01 | `#rng` period: 7, 30, 90 days, this year | — | BUILD | P09 | QA-S29-02 |
| S29.i.02 | `data-c="KPIs"` orders, paid, commission, payable, with comparison | — | BUILD (PD15) | P09 | QA-S29-02 |
| S29.i.03 | `data-c="Sales chart"`, `data-c="Orders by category"` | — | BUILD | P09 | QA-S29-01 |
| S29.i.04 | `data-c="Recent Orders"` | Admin can read `orders` | WIRE | P09 | QA-S29-01 |
| S29.i.05 | `data-c="Queues"` counts and oldest age | — | BUILD | P09 | QA-S29-01 |
| S29.i.06 | `data-c="Watch list"`: next run, artists near 60 days owed | `owed_since` exists | WIRE | P09 | QA-S29-01 |
| S29.i.07 | Inventory: role denial | `RoleRoute role="admin"` exists, unused | WIRE | P09 | QA-S29-03 |
| S29.i.08 | Inventory: empty period, previous period zero, date boundaries | — | BUILD | P09 | QA-S29-02 |

## S30 Queues (`admin-queues.html`, `/admin/queues`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S30 | `admin-queues.html` | No route | BUILD | P09 | QA-S30-01 |
| S30.st.default | `default` | — | BUILD | P09 | QA-S30-01 |
| S30.tab.q-dmg | `#q-dmg`; `data-c="Damage Reports"` | `damage_reports` readable by Admin | WIRE | P09 | QA-S30-01 |
| S30.tab.q-over | `#q-over`; `data-c="Overdue"` | `orders.overdue` set by `sweep` | WIRE | P09 | QA-S30-03 |
| S30.tab.q-rev | `#q-rev`; `data-c="Reviews"` | `reviews` pending | WIRE | P09 | QA-S30-05 |
| S30.tab.q-rep | `#q-rep`; `data-c="Reports"` | `reports` open | WIRE | P09 | QA-S30-06 |
| S30.tab.q-ver | `#q-ver`; `data-c="Verification"` | `artist_private` readable by Admin | WIRE | P09 | QA-S30-07 |
| S30.dlg.dmg | `#dmg`: photos, items, dates, artist history, decision, note | `decide_damage` (no refund step; note optional) | EXTEND | P09 | QA-S30-01, QA-S30-02 |
| S30.dlg.refund | `#refund` full refund of an overdue order | `issueRefund` with every line | WIRE | P09 | QA-S30-04 |
| S30.dlg.rrej | `#rrej` reason the buyer sees | `decide_review` has no reason | EXTEND | P09 | QA-S30-05 |
| S30.dlg.down | `#down` take down with a reason | No takedown function | BUILD | P09 | QA-S30-06 |
| S30.dlg.ver | `#ver` evidence, two checks, Request changes, Mark verified | `mark_verified`; no request-changes | EXTEND | P09 | QA-S30-07 |
| S30.i.01 | Tab counts; `data-c="Queue tabs"` | — | BUILD | P09 | QA-S30-01 |
| S30.i.02 | "Extend 2 days" once, "Extended" marker | No function (D05) | BUILD | P09 | QA-S30-03 |
| S30.i.03 | "Approve edited" | None | BUILD (PD10) | P09 | QA-S30-05 |
| S30.i.04 | Reports: Dismiss; "Restrict…" with an empty target (mismatch 11) | `reports.status` has `resolved`; no function | BUILD; Restrict opens the S33 `rs` dialog | P09 | QA-S30-06 |
| S30.i.05 | Inventory: stale or double decision | `already_decided` | VERIFY | P09 | QA-S30-08 |
| S30.i.06 | Inventory: private evidence access | `craftme_read_damage` policy, 1-hour signed URLs | VERIFY | P09 | QA-S30-09 |
| S30.i.07 | Inventory: failed provider refund is re-queued | `refunds.status = 'unknown'` | WIRE | P10 | QA-S31-04 |
| S30.i.08 | Inventory: empty and error state per tab | — | BUILD | P09 | QA-S30-10 |
| S30.i.09 | Damage upheld: refund the chosen lines, payout hold released | `decide_damage` clears `open_report` only | EXTEND: uphold then refund in one guided step | P09 | QA-S30-02 |

## S31 Orders, Admin (`admin-orders.html`, `/admin/orders`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S31 | `admin-orders.html` | No route | BUILD | P10 | QA-S31-01 |
| S31.st.default | `default` | — | BUILD | P10 | QA-S31-01 |
| S31.dlg.ord | `#ord`: lines with checkboxes, payment id, method, fee, commission, reason, note, preview | `issueRefund`, `reserve_refund` (whole remaining lines by quantity) | WIRE | P10 | QA-S31-02 |
| S31.i.01 | `#of-q` search by order code, buyer email, payment id | Email lives in `auth.users` | BUILD (admin read function) | P10 | QA-S31-01 |
| S31.i.02 | `#of-s`, `#of-a`, `#of-d` filters; `data-c="Filters"` | — | BUILD | P10 | QA-S31-01 |
| S31.i.03 | Payout column: Not yet, Payable, Paid out, Owed; `data-c="Orders table"` | Derivable from `payable`, `payout_id`, refunds | BUILD | P10 | QA-S31-01 |
| S31.i.04 | Refund preview: amount, provider timing, artist effect | `owed_after_refund` holds the rule | BUILD (preview function, no writes) | P10 | QA-S31-02 |
| S31.i.05 | Inventory: provider timeout, unknown state, reconciliation | `mark_refund_unknown`; no way to resolve an unknown refund | EXTEND | P10 | QA-S31-04 |
| S31.i.06 | Inventory: refund after the artist was paid | `reserve_refund` raises Amount Owed | VERIFY | P10 | QA-S31-05 |
| S31.i.07 | Inventory: repeated line refund refused | `exceeds_paid` | VERIFY | P10 | QA-S31-03 |
| S31.i.08 | Pagination | — | BUILD | P10 | QA-S31-01 |
| S31.i.09 | Inventory: other roles see nothing | `is_admin()` checks | VERIFY | P10 | QA-S31-06 |

## S32 Payout run (`admin-payout-run.html`, `/admin/payouts`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S32 | `admin-payout-run.html` | No route. `build_payout_run`, `record_payout`, cron on the 1st and 15th. | WIRE | P10 | QA-S32-01 |
| S32.st.default | `default` Draft | Draft rows in `payouts` | WIRE | P10 | QA-S32-01 |
| S32.st.sent | `sent` Recorded | `status = 'sent'` per artist | WIRE | P10 | QA-S32-04 |
| S32.dlg.done | `#done` Record this run? | Recording is per artist | EXTEND | P10 | QA-S32-03 |
| S32.dlg.lines | `#lines` per-order lines | `order_ids` on the payout | WIRE | P10 | QA-S32-01 |
| S32.i.01 | `data-c="Blocked rows"` unverified artists roll forward | `blocked` array returned by the build | WIRE | P10 | QA-S32-02 |
| S32.i.02 | `data-c="Totals"` | — | BUILD | P10 | QA-S32-01 |
| S32.i.03 | "Copy transfer list", copy UPI id | Destination is in `artist_private.payout_method` | BUILD | P10 | QA-S32-01 |
| S32.i.04 | Reference input per artist; `data-c="Run table"` | `record_payout(p_payout, p_reference)` | WIRE | P10 | QA-S32-03 |
| S32.i.05 | "Each Artist has been emailed a statement." | P11 | BUILD in P11; text gated | P11 | QA-S35-03 |
| S32.i.06 | Inventory: rebuild, eligibility changes while recording | `rebuild` error | VERIFY | P10 | QA-S32-05 |
| S32.i.07 | Inventory: transfer recorded twice, duplicate reference | `already_sent`; no uniqueness on the reference | EXTEND | P10 | QA-S32-06 |
| S32.i.08 | Inventory: zero payable, Amount Owed absorbs the net | `payout_calc` | VERIFY | P10 | QA-S32-07 |

## S33 Artists, Admin (`admin-artists.html`, `/admin/artists`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S33 | `admin-artists.html` | No route | BUILD | P09 | QA-S33-01 |
| S33.st.default | `default` | — | BUILD | P09 | QA-S33-01 |
| S33.dlg.rs | `#rs` Restrict: common reason, reason shown to the Artist | `restrict_artist` requires a reason | WIRE | P09 | QA-S33-02 |
| S33.dlg.lift | `#lift` Lift with a note | `restrict_artist(false)`; note not required or stored | EXTEND | P09 | QA-S33-03 |
| S33.i.01 | Filters All, Needs verification, Owes money, Restricted with counts; search; pages; `data-c="Filters"` | — | BUILD | P09 | QA-S33-01 |
| S33.i.02 | Columns: joined, verification, orders, rating, overdue in 30 days, owed and its age, shop; `data-c="Artists table"` | — | BUILD (read function) | P09 | QA-S33-01 |
| S33.i.03 | Inventory: restricted artist still ships and refunds | `mark_shipped` has no restriction check | VERIFY | P09 | QA-S33-02 |
| S33.i.04 | Inventory: owed-based restriction versus manual lift | `sweep` restricts at 60 days; a manual lift is re-restricted on the next sweep while the debt remains | EXTEND: an Admin may lift it (override, PD26); the sweep then skips that debt and restricts again only for a new debt | P09 | QA-S33-04 |
| S33.i.05 | Inventory: no payout details in the list | — | BUILD so by design | P09 | QA-S33-01 |
| S33.i.06 | Inventory: reason and audit history | `restriction_reasons` array | EXTEND (PD16) | P09 | QA-S33-03 |

## S34 Settings, Admin (`admin-settings.html`, `/admin/settings`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S34 | `admin-settings.html` | No route. `settings` table, no write function. | BUILD | P10 | QA-S34-01 |
| S34.st.default | `default` | — | BUILD | P10 | QA-S34-01 |
| S34.dlg.adm | `#adm` Add an Admin by email | `setRole` by uid | EXTEND (PD23) | P10 | QA-S34-04 |
| S34.i.01 | `data-c="Fees"`: commission %, onboarding fee | — | BUILD | P10 | QA-S34-01 |
| S34.i.02 | Earnings preview | — | BUILD (PD19) | P10 | QA-S34-01 |
| S34.i.03 | `data-c="Switches"`: Instagram Connect, Accept new Artists, Demo banner | `settings.switches` empty object | BUILD | P10 | QA-S34-03 |
| S34.i.04 | `data-c="Fixed rules"` read-only | Values live in SQL intervals (A5) | BUILD from a constants file checked against SQL | P10 | QA-S34-02 |
| S34.i.05 | `data-c="Admins"` list, Remove | — | BUILD | P10 | QA-S34-04 |
| S34.i.06 | `data-c="Integrations"` status | — | BUILD from real configuration; "SendGrid" becomes Resend (D04) | P10 | QA-S34-05 |
| S34.i.07 | Inventory: old orders keep their commission | `orders.commission_bps` snapshot at payment | VERIFY | P10 | QA-S34-01 |

## S35 Emails (`emails.html`)

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S35 | `emails.html` | No sender (mismatch 7) | BUILD | P11 | QA-S35-01 |
| S35.st.default | `default`; `data-c="Email tabs"` | — | BUILD | P11 | QA-S35-01 |
| S35.tab.em-buyer | `#em-buyer` Order confirmation | — | BUILD | P11 | QA-S35-01 |
| S35.tab.em-new | `#em-new` New Order, no address | — | BUILD | P11 | QA-S35-02 |
| S35.tab.em-pay | `#em-pay` Payout sent | — | BUILD | P11 | QA-S35-03 |
| S35.i.01 | Inventory: sent after authoritative payment or recorded transfer, once per recipient and event | — | BUILD (outbox with a unique key) | P11 | QA-S35-04 |
| S35.i.02 | Inventory: failure and retry never roll back a payment | — | BUILD | P11 | QA-S35-05 |
| S35.i.03 | Inventory: no buyer address in the artist email, no payout details beyond a masked destination | — | BUILD | P11 | QA-S35-02 |
| S35.i.04 | Inventory: other email promises (S11, S14, S24, S28, S32) | Copy audit | BUILD | P11 | QA-S35-06 |
| S35.i.05 | D15: not configured | — | BUILD | P11 | QA-S35-05 |
| S35.i.06 | Light background regardless of theme; reply path | — | BUILD | P11 | QA-S35-01 |

## S36 UI kit (`components.html`)

No app route is built for the kit. Each component is verified on the real screens that use it.

| ID | Reference | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| S36 | `components.html` | CSS classes all present in `src/ui/styles.css`; few React components | EXTEND | P00, P12 | QA-S36-01 |
| S36.st.default | `default` | — | DIVERGE: no gallery page in the app; the checklist in P12 replaces it | P12 | QA-S36-01 |
| S36.dlg.kmodal | `#kmodal` dialog: head, body, grey foot; `data-c="Overlays"` | `CartConflictDialog.jsx` hand-rolled, no focus trap or Escape | BUILD (`Dialog`) | P00 | QA-S36-03 |
| S36.dlg.kalert | `#kalert` alertdialog, Keep it, Delete | None | BUILD (`Dialog` with `alert`) | P00 | QA-S36-03 |
| S36.tab.kt1 | `#kt1` | `WishlistPage.jsx` uses `.tabs` as links | BUILD (`Tabs`) | P00 | QA-S36-05 |
| S36.tab.kt2 | `#kt2` | — | BUILD (`Tabs`) | P00 | QA-S36-05 |
| S36.i.01 | `#k-color`, `#k-type` tokens; `data-c="Colour tokens", `data-c="Typography"` | Present in CSS | VERIFY in both themes | P12 | QA-S36-01 |
| S36.i.02 | `#k-btn`: variants, sizes, icon, disabled, saving, block; `data-c="Buttons"` | Classes used ad hoc | VERIFY; add a saving state helper | P00 | QA-S36-02 |
| S36.i.03 | `#k-form`: input states, prefix, counter, select, checks, switch, option card, quantity, chips, range, code input, dropzone; `data-c="Form controls"` | Classes exist; components: none | BUILD `Field`, `Counter`, `CodeInput`, `Dropzone`, `QtyStepper` | P00 | QA-S36-02 |
| S36.i.04 | `#k-feedback`: badges, alerts, toasts, skeleton, empty; `data-c="Feedback"` | Toast missing | BUILD `Toast`, `EmptyState` | P00 | QA-S36-04 |
| S36.i.05 | `#k-nav`: tabs, stepper, timeline with failed step, pagination, breadcrumb, menu; `data-c="Navigation"` | None as components | BUILD | P00 | QA-S36-05 |
| S36.i.06 | `#k-data`: stat tile, avatar, stars, rate input, table, key-value, chart; `data-c="Data display"` | Avatar and initials exist (`src/lib/artist.js`) | BUILD `Stars`, `RateInput`, `Chart`, `StatTile` | P00 | QA-S36-06 |
| S36.i.07 | `#k-art`: art card, embed card; `data-c="Art components"` | `ArtCard.jsx`, `ReelCard.jsx` | KEEP | P12 | QA-X-01 |
| S36.i.08 | `#k-icons`; `data-c="Icons"` | `Icon.jsx` has 15 of the reference icons | EXTEND as screens need them | P00 | QA-S36-02 |
| S36.i.09 | Inventory: focus visible and restored, Escape, focus trap, reduced motion | Partial | BUILD in `Dialog`, `Menu` | P00 | QA-S36-03 |
| S36.i.10 | Inventory: narrow widths, table overflow, long titles | `.table-wrap` exists | VERIFY | P12 | QA-S36-06 |

## Kept extras and system rules

| ID | Item | Now | Disp | Pkg | QA |
| --- | --- | --- | --- | --- | --- |
| X.01 | Heart on cards and artwork page (KD01) | `SaveButton.jsx`, `SavedContext.jsx` | KEEP | P12 | QA-X-01 |
| X.02 | Collections: create, rename, delete, add, remove, limits (KD01) | `WishlistPage.jsx`, `wishlist_guard` | KEEP | P12 | QA-X-02 |
| X.03 | Saved-works search and the gone list (KD01) | `WishlistPage.jsx` | KEEP | P12 | QA-X-03 |
| X.04 | Collection created but adding the work fails (audit handoff) | `NewCollectionForm.jsx` | VERIFY | P12 | QA-X-04 |
| X.05 | Global search: artworks and artists, paging while the catalogue changes (KD02) | `SearchPage` in `Browse.jsx` | KEEP | P03 | QA-X-05 |
| X.06 | Branding (KD04) | `public/brand/`, `index.html` | KEEP | P00 | QA-X-06 |
| X.07 | Wishlist and saved-cart pages inside the new header and menus | Header links exist | KEEP | P00 | QA-SH-01 |
| SYS.01 | The 5-minute sweep: holds, reminders, overdue, auto-receive, payable, owed restriction | `sweep()` in `0003_logic.sql`, cron in `0005_cron.sql` | VERIFY | P12 | QA-SYS-01 |
| SYS.02 | Fake provider mode cannot run in production (PD02) | — | BUILD | P00 | QA-SYS-02 |
| SYS.03 | Request replay by `requestId` | `claim()` in `index.ts` | VERIFY | P01 | QA-SYS-03 |

<a id="reconciliation"></a>
## Reconciliation

Checked against `docs/screens/data.js` and the replay table in `docs/SCREEN_SCENARIO_INVENTORY.md`.

| Check | Result |
| --- | --- |
| Screens | 36 of 36 have a row (`S01` to `S36`). |
| Registered states | 74 of 74 have a `.st.` row: S01 1, S02 3, S03 4, S04 2, S05 2, S06 2, S07 2, S08 3, S09 3, S10 4, S11 1, S12 2, S13 4, S14 2, S15 2, S16 1, S17 2, S18 4, S19 1, S20 1, S21 3, S22 2, S23 2, S24 2, S25 2, S26 2, S27 5, S28 1, S29 1, S30 1, S31 1, S32 2, S33 1, S34 1, S35 1, S36 1. |
| Dialogs | 26 of 26 have a `.dlg.` row: `newcart`, `report`, `rep`, `recv`, `addr`, `del` (S16), `end`, `lst`, `del` (S23), `ship`, `stmt`, `disc`, `pay`, `dmg`, `refund`, `rrej`, `down`, `ver`, `ord`, `done`, `lines`, `rs`, `lift`, `adm`, `kmodal`, `kalert`. |
| Tab panels | 19 of 19: S04 `t-art`, `t-ig`, `t-rev`, `t-about`; S19 `terms`, `privacy`, `refunds`, `artist`, `deletion`; S30 `q-dmg`, `q-over`, `q-rev`, `q-rep`, `q-ver`; S35 `em-buyer`, `em-new`, `em-pay`; S36 `kt1`, `kt2`. Tabs that only filter one list (S12 `all-o`, S22 `aw-t`, S24 `o-all`) are covered as `.i.01` rows. |
| In-scope rows without a package | None. |
| In-scope rows without a QA script | None. |
| Deferred or divergent rows without a reason | None. |

### Rows by kind

| Kind | Where |
| --- | --- |
| **Missing UI** (BUILD) | S01, S11, S16, S17, S21, S25, S29, S30, S31, S33, S34, S35 as whole screens; plus the BUILD rows inside S02, S03, S08, S09, S12, S13, S14, S15, S22, S23, S26, S27, S28 |
| **Backend only** (WIRE) | S18 (verification, fee, role), S26 (payout rows), S32 (build and record), S30 tabs and S33 restrict (decisions), S31 refunds, S13 refund details, S03 and S04 reports and reviews |
| **Exists but unverified** (VERIFY) | Payment idempotency and late or duplicate events (S10.i.03–06), cart switch replay (S08.i.09–11), address privacy (S09.i.16), owner purchase refusal (S03.i.12), restricted and unknown artist (S04.i.04–07), payout maths after refunds (S26.i.08, S32.i.06, S32.i.08), stale decisions (S30.i.05), the sweep (SYS.01) |

### Deferred or divergent, with reasons

| ID | Reason |
| --- | --- |
| S05.st.error, S05.i.04, S06 and its 2 states, S07 and its 2 states | D01: Google is the only login. |
| SH.13 | Review tooling of the mock, not product. |
| SH.12 | One layout for every public page. |
| S02.i.03 (counts only) | Fixture numbers; an aggregate per filter change is not worth its cost at launch. |
| S03.dlg.newcart | D07: the cart is saved, not discarded. |
| S09.i.03 | PD04: no PIN data source. |
| S14.i.12 | D04: no damage-decision email. |
| S16.i.04 | D01: no password. |
| S19.i.02 | Draft text must never ship. |
| S26.i.05 | A6: a fixture sentence about rounding. |
| S36.st.default | The kit is verified on real screens. |

### Remaining gaps

1. Every VERIFY row is unverified until its script runs. No test was run while writing this file.
2. All PD items are answered (DECISIONS.md section 9).
3. S19 copy does not exist (XD03).
4. Category counts (S02.i.03) and PIN lookup (S09.i.03) are not planned.
5. The reference icon set (`ui.js` `icons`) was not mapped one by one; `Icon.jsx` grows as screens need them (S36.i.08).
6. Hosted `assets/` were not compared with the repository copy.
