# P03 Storefront: Home, Browse, Artwork, Artist profile

**Goal.** A real landing page at `/`, Browse with filters, sorting and numbered pages, the full artwork page (quantity, wall label, reviews, related works, Report), and the artist profile with tabs, public reviews, stats and Report.

**Coverage.** All of S01 (except S01.i.08), S02, S03 (except the cart-clash rows and S03.i.11), S04 (except the Showcase rows, which P08 finishes), X.05.

**Depends on.** P00. **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD03, PD20, PD22.

## Paths

Existing, to modify:

- `src/App.jsx` (`/` renders `Home`)
- `src/pages/Browse.jsx`, `src/pages/ArtworkPage.jsx`, `src/pages/ArtistPage.jsx`
- `src/components/ArtCard.jsx` (kind line, "Sold" tag)
- `src/contexts/cart.js`, `src/contexts/CartContext.jsx` (`add` takes a quantity)
- `src/api/gateway.js`, `src/lib/format.js`, `src/lib/artist.js`
- `supabase/schema.test.mjs`

PROPOSED, to create:

- `supabase/migrations/0021_storefront.sql`
- `src/pages/Home.jsx`
- `src/components/browse/Filters.jsx`, `ActiveFilters.jsx`
- `src/components/artwork/WallLabel.jsx`, `ReviewsPreview.jsx`, `RelatedWorks.jsx`
- `src/components/artist/ReviewsTab.jsx`, `AboutTab.jsx`, `ArtistStats.jsx`
- `src/components/ReportDialog.jsx`
- `src/lib/browseParams.js`, `src/lib/browseParams.test.js` (URL to filter object and back)
- `e2e/home.spec.js`, `e2e/browse.spec.js`, `e2e/artwork.spec.js`, `e2e/artist.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `useArtworks`, `useCatalogueSearch`, `useArtwork`, `useListings`, `useArtist`, `useArtistWorks`, `useReels`, `useReel`, `RPC.report` | `src/api/gateway.js` | `useCatalogueSearch` stays for the Artists result view (KD02) |
| `search_catalogue` | `0016_catalogue_search.sql` | Unchanged |
| `report`, `mark_verified`, `submit_verification` | `0003_logic.sql` | Re-created with the same or wider signatures |
| `GROUPS`, `CATEGORIES` | `src/lib/categories.js` | Category filter and home tiles (KD05) |
| `KINDS` | `src/components/dashboard/ArtworkUploadForm.jsx` | Type filter labels |
| `ArtCard`, `Gallery`, `ReelCard`, `SaveButton`, `CollectionMenu` | `src/components/` | Kept (KD01, KD06) |
| `initials`, `safePhoto`, `ratingText`, `isBadId` | `src/lib/artist.js` | |
| `Tabs`, `Pagination`, `Breadcrumbs`, `Dialog`, `CopyButton`, `QtyStepper`, `Stars`, `EmptyState`, `useToast` | P00 | |
| `buyNow` | `CartContext.jsx` (P01) | If P01 has not shipped, the Buy now button is left out |

## Migration `0021_storefront.sql`

1. `alter table public.profiles add column city text not null default '' check (char_length(city) <= 80), add column state text not null default '' check (char_length(state) <= 80), add column verified boolean not null default false;` Grant `update (city, state)` to `authenticated`. `verified` has no client grant.
   Also `add column slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 30)` with no client grant (PD22, final answer). **The id is the permanent address.** The slug is only a short name that redirects to `/artist/<id>`; nothing in the database or the app refers to an Artist by slug. A `before update of roles` trigger on `profiles` fills `slug` the first time `'artist'` enters `roles` and the slug is null: the display name lower-cased, non-letters and non-digits turned into single hyphens, cut to 30 characters, `artist` if that leaves fewer than 3, and `-2`, `-3`, … appended until unique. Backfill: the same rule for every existing Artist, oldest first. The Artist may change it later with `set_artist_slug(p_slug text)` (security definer, Artists only, own row): lower-cases and trims; refuses a bad shape (`invalid` `["slug"]`), a value that parses as a uuid, and a taken name (`conflict` `slug_taken`). The old slug is released at once and stops redirecting; no history is kept (see the open point in DECISIONS.md section 9).
2. `alter table public.artworks add column year smallint check (year between 1900 and 2100), add column medium text not null default '' check (char_length(medium) <= 100), add column signed text check (signed in ('back','front','unsigned'));` Grant insert and update on the three columns to `authenticated` (the editor arrives in P06; the public page shows them when filled).
3. `create or replace` `mark_verified` (also sets `profiles.verified = true`) and `submit_verification` (also sets it `false`). Backfill: `update public.profiles p set verified = true from public.artist_private a where a.profile_id = p.id and a.verified_at is not null;`
4. Reports: `alter table public.reports add column details text not null default '' check (char_length(details) <= 500);` and `create unique index reports_one_open on public.reports (reporter_id, target_type, target_id) where status = 'open';` Replace `report`: drop `(text, uuid, text)`, create `report(p_target_type text, p_target uuid, p_reason text, p_details text default '')`. `p_reason` must be one of `copied`, `mismatch`, `offensive`, `other` for an artwork, or `impersonation`, `mismatch`, `offensive`, `other` for an artist. The target must exist and be public. A report on your own work or profile fails `conflict` `own_target`. A second open report by the same person fails `conflict` `already_exists`.
5. `create function public.browse_catalogue(p jsonb) returns jsonb` (stable, security invoker). Keys: `q`, `categories` (text[]), `kinds` (text[] of `original`, `print`, `product`), `minPaise`, `maxPaise`, `artist` (uuid), `hideSold` (boolean), `sort` (`new`, `price_asc`, `price_desc`, `rating`), `page` (0-based). Returns `{total, items}` with 24 items per page. Rules:
   - only `status = 'published' and artist_open` works of unrestricted artists;
   - `q` matches the title, the artist's display name, `artworks.medium`, or the `medium` of any live listing (case-insensitive substring, `%` and `_` treated as plain text, cut to 100 characters);
   - `kinds` keeps a work that has a live listing of one of those kinds;
   - price compares `from_price_paise`; if both bounds are given and reversed they are swapped;
   - `hideSold` keeps `available = true` (a sold Original with a live Print stays, A8);
   - order: `new` by `created_at desc`; prices by `from_price_paise` with nulls last; `rating` by the artist's `rating_avg desc`, `rating_count desc`, then `created_at desc`; every order ends with `id` so pages never repeat or skip a row.
6. `create function public.artist_public_stats(p_artist uuid) returns jsonb` (stable, security definer): `{artworks, ordersShipped, avgShipHours}` for an unrestricted artist; null otherwise. `avgShipHours` is the mean of `shipped_at - paid_at` over shipped orders, null when none.
7. `create function public.artist_review_summary(p_artist uuid) returns jsonb` (stable, security invoker): counts of approved reviews per star.
8. Hardening: `revoke select on public.reviews from anon;` then `grant select (order_id, artist_id, rating, comment, buyer_name, status, created_at) on public.reviews to anon;` so a signed-out visitor never reads `buyer_id`.
9. Revoke execute from `public, anon, authenticated` on all four functions; grant `browse_catalogue`, `artist_public_stats`, `artist_review_summary` to `anon, authenticated`; `report` to `authenticated`; all to `service_role`.

Rollout: schema test, apply `0021`, deploy the web app. No Edge Function change.

## Proposed interfaces

```js
// gateway.js
export const useBrowse = (filters) => …                 // rpc browse_catalogue -> { total, items } (camelCased)
export const useSwitches = () => …                       // settings.switches, {} when unset
export const useArtist = (id) => …                       // unchanged: by id only
export const useArtistIdBySlug = (slug) => …             // profiles.select('id').eq('slug', slug): only for the redirect
RPC.setArtistSlug = (i) => ['set_artist_slug', { p_slug: i.slug }];
export const useArtistStats = (id) => …
export const useArtistReviews = (id, page) => …          // approved reviews, 10 per page, count: 'exact', newest first
export const useArtistReviewSummary = (id) => …
RPC.report = (i) => ['report', { p_target_type: i.targetType, p_target: i.targetId, p_reason: i.reason, p_details: i.details ?? '' }];

// src/lib/browseParams.js
export const readFilters = (searchParams) => ({ q, group, categories, kinds, min, max, artist, hideSold, sort, page })
export const writeFilters = (filters) => URLSearchParams      // drops defaults; page resets to 0 when any other key changes
export const activeChips = (filters, artistName) => [{ key, label, without }]

// cart
add(artistId, listingId, { qty = 1, price } = {})
```

URL keys: `q`, `group`, `cat` (comma list), `kind` (comma list), `min`, `max` (rupees), `artist`, `sold=hide`, `sort`, `page`, and the existing `type=artists`. The old `category` key is still read.

## UI specification

### S01 Home, `/`

Sections in the reference order. One column under 760 px; images use `LazyLoadImage` and fixed aspect ratios so missing images leave a tinted block, never a broken layout.

1. **Hero.** `h1` "Original art from Indian artists", one sentence, "Browse art" (to `/browse`) and "Sell your art" (to `/become-artist`). One featured image: the newest available work's first photo.
2. **Categories.** The five groups of `GROUPS` (KD05), each a row with a short line and a "Browse" link to `/browse?group=…`; hovering or focusing a row swaps the side image to the newest work of that group; under 760 px the image is hidden.
3. **Original or print.** Heading, two sentences, "Browse Originals" to `/browse?kind=original`. A static image. The reference's "develops" effect may be added only under `prefers-reduced-motion: no-preference`.
4. **Buying in 3 steps** (`id="how"`), **Questions** (`id="questions"`, five question and answer pairs and a link to the refund policy), **Sell your art** (`id="artists"`, "Start selling").
5. **Closing band** with "Browse art".

"Sell your art" and "Start selling" render only when `useSwitches().acceptArtists === true`. The switch is unset until P10 and P05 ship, so no link ever points at a missing page. Section anchors scroll with `scroll-margin-top` equal to the sticky header height. FAQ numbers come from `RULES`. FAQ wording: shipping within 7 days; a Paid Order can't be cancelled by the Buyer, write to CraftMe; one artist per Cart; India only; only Buyers whose Order was Received can review, and CraftMe approves every Review.

### S02 Browse, `/browse`

Two columns over 1000 px: a 280 px filter panel and the results. Under 1000 px the panel is a closed `<details>` whose summary reads "Filters" with the active count.

- **Header.** "Browse art" (or "Results for “{q}”" with the Artworks and Artists chips when a header search is active, KD02). Under it "{total} Artworks match your filters." Sort select: Newest first, Price: low to high, Price: high to low, Highest rated Artist.
- **Filters.** Search box "Title, Artist or medium" (applies 300 ms after typing stops). Category: the five groups as collapsible checkbox lists. Type: Originals, Prints, Ready-made. Price: minimum and maximum number inputs in rupees plus three quick bands (Under ₹2,000; ₹2,000 to ₹10,000; Over ₹10,000) that fill both. Artist: a type-ahead over `search_catalogue` artist results. "Hide Sold Originals" checkbox. "Clear all".
- **Active filters.** One removable chip per active filter, each with `aria-label="Remove {name}"`.
- **Grid.** `ArtCard` in `.grid.g3`, 24 per page. `Pagination` with numbered pages; the page is in the URL.
- **Loading** (`S02.st.loading`). Twelve skeleton tiles, `aria-busy`, the count line reads "Searching…". Filters stay usable; a newer answer always replaces an older one.
- **Empty** (`S02.st.empty`). "Nothing matches those filters. Try removing a Category or widening the price range." with "Clear all filters" and "Browse everything".
- **Error.** Alert "We couldn't load the catalogue." with "Try again". Never the empty text.
- **Refresh and Back** rebuild the same view from the URL. Changing any filter resets the page to 1 and uses `replace` for typing and `push` for clicks.

### S03 Artwork, `/artwork/:id`

`.split`: gallery left, purchase panel right and sticky; one column under 900 px with the panel after the gallery.

- `Breadcrumbs`: Home, Browse, {category} (to the category filter), title.
- **Gallery.** Unchanged (KD06). A "Sold" tag over the photo when no listing can be bought.
- **Purchase panel.** Eyebrow "{category} · {year} · {medium}" (parts shown when filled). Title. Artist link with city and rating. Listings as radio cards: kind, stock text ("Only 1 available", "{n} in stock", "Sold"), a detail line (size, medium), price. `QtyStepper` (hidden for an Original, with the note "Originals are always 1"; `max = min(stock - held, 10)`). "Total, shipping included". Buttons: "Add to Cart" and "Buy now".
  - Add to Cart keeps the buyer on the page, fires the toast "Added to your Cart", and the button becomes "In your Cart" with a "View Cart" link. A conflict opens the P01 dialog.
  - `S03.st.sold`: the sold radio is disabled, a note says "This Original has found a home. Prints of this Artwork are still available." when another listing is live; when nothing is live both buttons are replaced by a disabled "Sold".
  - `S03.st.own`: an alert "This is your Artwork. Artists can't buy their own Listings." with "Edit in dashboard" (to `/dashboard/artworks/:id`); no cart buttons, no heart, no Report.
  - Signed out: Add to Cart, Buy now, Save and Report send the visitor to `/login` and back to this page.
- **Trust list.** "Shipped by {artist}, within 7 days of payment. Shipping within India is included." "Yours while you pay. Nobody else can buy it while you check out." "Arrives safely or you get your money back. If it is damaged, tell us within 3 days."
- "Report this Artwork" opens `ReportDialog`.
- **About this piece** and **Wall label** (key and value list): Artist, Title, Year, Medium, Size (from the listings), Category, Signed, Ships from (city, state), Item code (first eight characters of the id, upper-case, with `CopyButton`). A row is left out when its value is empty.
- **What Buyers say about {artist}.** The three newest approved reviews and "All {n} Reviews" to `/artist/:id?tab=reviews`. Hidden when there are none.
- **More from {artist}** (up to four other available works) and **More {category}** (up to four). Each hidden when empty.
- **Loading.** Skeleton. **Unknown, removed, restricted or malformed id.** "We couldn't find this Artwork. It may have been taken down." with "Browse art". **Network error.** "We couldn't load this page." with "Try again".

### ReportDialog (S03.dlg.report, S04.dlg.rep)

`Dialog`. Artwork: title "Report this Artwork", sentence "Reports go to the CraftMe team. The Artist isn't told who reported.", four radios (It looks copied or stolen from another Artist; It isn't what the photos show; Offensive or inappropriate; Something else), the first not pre-selected. Artist: title "Report this Artist", a select with Impersonation or stolen work; Selling something other than what is shown; Offensive content; Other. Both: "Details (optional)", 500, counter. "Cancel" and "Send report" ("Sending…"). Success closes the dialog and fires "Report sent. Thank you." `already_exists`: inline "You've already reported this. We're looking at it." `unavailable`: inline "We couldn't send your report. Try again." and the text is kept.

### S04 Artist profile, `/artist/:id`

- **Header.** Photo or initials, name, "Verified Artist" badge when `verified`, a line "{city}, {state} · On CraftMe since {month year}" (parts shown when filled), rating with a link to the Reviews tab, bio, Instagram link when a handle exists, "Copy profile link" (copies the short link `{origin}/artist/{slug}`). On `/artist/:key`, a key that is a uuid renders the profile; any other key is looked up as a slug and replaced in the address bar by `/artist/<id>` (`<Navigate replace>`, keeping the query string, so `?tab=reviews` survives); an unknown slug shows "We couldn't find this Artist". Every in-app link, email and notification keeps using the id, "Report" (hidden for the owner).
- **Stats.** Artworks, Orders shipped, Average time to ship ("2.4 days", "under a day", or a dash when unknown).
- **Tabs**, kept in `?tab=`: Artworks {n}, Instagram Showcase, Reviews {n}, About.
  - Artworks: chips All, Originals, Prints, Ready-made, Sold; "Showing {n} Artworks"; grid; `Pagination`. Empty: "No work on sale right now."
  - Instagram Showcase: the current reels strip until P08 replaces it; empty text "No Instagram posts yet. {name} hasn't added any posts or reels."
  - Reviews: large average, stars, "Based on {n} Reviews from Buyers who received their Orders", five histogram bars, the review list (initials, first name, "Received Order" badge, date, stars, text), `Pagination` 10 per page. Empty: "No Reviews yet."
  - About: Based in, Joined, Verified ("Identity and payout details checked by CraftMe", or "Checks in progress"), Ships ("Within 7 days, India only").
- Existing owner bar, restricted view, unknown-artist view and error view are kept.

## Steps

1. Migration and schema checks: the filter rules one by one (text over title, artist, medium; kinds; reversed price bounds; hide sold keeps a sold Original with a live Print; each sort with equal values paging without repeats); a draft, a removed work and a restricted artist's work never appear; `report` validates the reason code, refuses own targets and repeats; anonymous `select buyer_id from reviews` fails; stats are null for a restricted artist; `verified` follows `mark_verified` and a re-submitted verification; a slug is made when the Artist role is granted, two Artists with the same name get different slugs, a display-name change does not change it, a direct client update of `slug` is refused, a name with no letters still gets one, `set_artist_slug` changes only the caller's slug, refuses a taken name, a bad shape and a uuid-shaped value, and frees the old name for someone else.
2. `gateway.js` and `browseParams.js` with tests (round trip, defaults dropped, page reset).
3. `Home.jsx`, then `App.jsx` (`/` to `Home`; `/browse` unchanged).
4. Rebuild `Browse.jsx` around `useBrowse`; keep `SearchPage` for `type=artists`.
5. Rebuild `ArtworkPage.jsx` and `ArtistPage.jsx`; add `ReportDialog`.
6. `cart.js` `ADD` accepts `qty` and `price`; tests.
7. `format.js`: `own_target`, and labels for report reasons.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `report` | Signed out: sent to login; own target: `own_target` (button hidden) | Target removed meanwhile: `not_found`, dialog says "This is no longer on CraftMe." | Unique open report: `already_exists` | None | Text kept in the dialog | Dialog closed; nothing half-saved |
| Add to Cart | Own work: buttons absent; server refuses at `place_order` | Stock fell: stepper cap updates on the 10 s listing poll; the server decides at checkout | A second press adds one more up to the cap | — | — | Cart is in `localStorage` |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/home.spec.js e2e/browse.spec.js e2e/artwork.spec.js e2e/artist.spec.js
```
```bash
npm run lint
```

## Completion gate

- [ ] QA-S01-01 to 03, QA-S02-01 to 06, QA-S03-01 to 04 and 07 to 09, QA-S04-01 to 03 and 05 to 07, QA-X-05 pass.
- [ ] Signed out, the network tab shows no request that returns `buyer_id` from `reviews`.
- [ ] No "Sell your art" link is visible while `/become-artist` does not exist.
