# P03 verification record

Branch `craftme/p03-storefront`, cut from `main` at the P02 merge (P00 is the prerequisite; P01 and P02 are on the same line; see [P02-verification.md](P02-verification.md)).
Environment: local stack, `seed_qa.sql`, Playwright 1.65 driving Microsoft Edge (`PW_CHANNEL=msedge`).

## Repository checks

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` | pass, 94 tests (8 new in `browseParams.test.js`, 2 new in `cart.test.js`) |
| `npm run test:schema` | pass, 237 checks (186 before P03) |
| `npm run build` | pass |
| `npx playwright test e2e/home.spec.js e2e/browse.spec.js e2e/artwork.spec.js e2e/artist.spec.js e2e/extras.spec.js` (desktop light) | pass |
| QA-S01-01, S03-01 and S04-01 on all six views | pass (18 tests) |
| Whole desktop-light suite (P00 to P03) | 120 passed, 3 failed on the first run; the three were stale expectations from earlier packages (below) and pass now. The affected files were re-run after the fixes |
| Edge Function | not touched in P03 |

## Scenarios

| ID | Result | Evidence |
| --- | --- | --- |
| QA-S01-01 | passed | `home.spec.js`, all views (one `h1`, section order, both buttons, `?kind=original` chip, no animation after load or on scroll with reduced motion) |
| QA-S01-02 | passed | `home.spec.js` (group ticked from the row link; `/#how` and `/#questions` sit below the sticky header) |
| QA-S01-03 | passed | `home.spec.js` (switch true and false, images blocked, FAQ wording) |
| QA-S02-01 | passed | `browse.spec.js` + schema (the four steps and their chips; `acrylic` by medium; `meera` by Artist; no draft, ended or restricted work) |
| QA-S02-02 | passed | `browse.spec.js` + schema (three sorts, pages of 24 and 11, every work exactly once; Rated sort starts with A1) |
| QA-S02-03 | passed | `browse.spec.js` |
| QA-S02-04 | passed | `browse.spec.js` |
| QA-S02-05 | passed | `browse.spec.js` (twelve skeletons, failure alert and recovery, a slow older answer never replaces a newer one) |
| QA-S02-06 | passed | `browse.spec.js` at 375 and 1280 px |
| QA-S03-01 | passed | `artwork.spec.js`, all views. The Print reads "49 in stock", not 50: fixture O1 holds one (the script's figure is stale) |
| QA-S03-02 | passed | `artwork.spec.js` |
| QA-S03-03 | passed | `artwork.spec.js` + schema (`place_order` as own Artist was already checked in P00) |
| QA-S03-04 | passed | `artwork.spec.js` + `cart.test.js` |
| QA-S03-07 | passed | `artwork.spec.js` + schema. The "back to the artwork after signing in" half is checked only as far as the redirect to `/login` (sign-in is Google-only) |
| QA-S03-08 | passed | `artwork.spec.js` (no request to Instagram before Play; link offered; frame fits) |
| QA-S03-09 | passed | `artwork.spec.js` (no `buyer_id` in any reviews response) |
| QA-S04-01 | passed | `artist.spec.js`, all views + schema (slugs, a second "Meera Iyer" gets `-2`, rename keeps the slug) |
| QA-S04-02 | passed | `artist.spec.js` |
| QA-S04-03 | passed | `artist.spec.js` + schema (reject one, approve one: count rose by one) |
| QA-S04-05 | passed | `artist.spec.js` + schema (`artist_public_stats` null for A3) |
| QA-S04-06 | passed | `artist.spec.js` |
| QA-S04-07 | passed | `artist.spec.js` |
| QA-S20-02 | passed | `shell.spec.js` (the wording check became case-insensitive: "Artwork") |
| QA-X-01 | passed, reading chosen | `extras.spec.js`. The script's steps ("press twice quickly, then once more") and its data ("none at the end") disagree; the test presses twice (saved, then not saved) and ends with no row |
| QA-X-05 | passed | `extras.spec.js` |

Completion gate: signed out, no reviews response carries `buyer_id` (`artwork.spec.js` and the schema test); "Sell your art" follows `settings.switches.acceptArtists` (the local seed sets it true, so the link shows locally while `/become-artist` does not exist yet; hosted has it unset).

## Changes against the plan (recorded, not product decisions)

- **A view counter.** QA-S03-01 needs `artworks.views` to rise once per session; the plan has no function for it. `0021` adds `bump_view(p_artwork)`, called once per browser session per work.
- **Ended-only works are hidden.** The plan's rule ("published and open") would show W5 (its only Listing ended); QA-S02-01 and QA-S04-02 say it never appears. A work now needs a live or sold Listing. `browse_catalogue` also takes `onlySold` for the Artist page's Sold chip.
- **Add to Cart stays on the page** (S03), so the P00 test QA-S36-03 and P01's flow no longer expect a jump to `/cart`; "View Cart" sits under "Buy now" so a double press cannot land on it.
- **Buy now and a clash add one unit.** The server's switch function (`switch_saved_cart`) fixes a new Cart's first line at 1; a quantity above 1 chosen before a clash is kept in the dialog's selection but the switch adds 1.
- **Fixtures** (`seed_qa.sql`): thirty filler works (F01 stays A1's; its Listing is now Ready-made so A1's Prints stay W1 and W2), cities, `verified`, wall-label fields, a linked reel on W1, and the two extra approved Reviews hang on two new received Orders of Admin Two (O16, O17) so O9, O10 and the review scripts keep their meaning.
- **Playwright** `expect` timeout is 10 s (the first load of a page compiles it on the dev server).
- **Stars** is a new shared component; the Review page from P02 still draws its own and can switch to it.
- Dead links until P04: "Read the refund policy" (`/legal/refunds`).

## Changed paths

`supabase/migrations/0021_storefront.sql` (new), `supabase/schema.test.mjs`, `supabase/seed_qa.sql`;
`src/api/gateway.js`, `src/App.jsx`, `src/contexts/{cart.js,cart.test.js,CartContext.jsx}`, `src/lib/{browseParams.js,browseParams.test.js}` (new), `src/ui/styles.css`,
`src/components/ArtCard.jsx`, `src/components/ReportDialog.jsx`, `src/components/ui/Stars.jsx`, `src/components/browse/{Filters,ActiveFilters}.jsx`, `src/components/artwork/{WallLabel,ReviewsPreview,RelatedWorks}.jsx`, `src/components/artist/{ReviewsTab,AboutTab,ArtistStats}.jsx` (all new),
`src/pages/{Home,Browse,ArtworkPage,ArtistPage}.jsx`;
`e2e/{home,browse,artwork,artist,extras}.spec.js` (new), `e2e/{shell,ui-kit}.spec.js`, `playwright.config.js`.

## Migration order

`0021_storefront.sql` only. Rollout: schema test, apply `0021`, deploy the web app. Before `0021` the new pages call functions that do not exist, so apply it first. The hosted project needs `0016` to `0020` already (applied on 2026-11-13).

## Remaining work

- Apply `0021` to the hosted project (not done).
- `/legal/refunds` and the Sell links' target `/become-artist` (P04, P05); keep `acceptArtists` unset on hosted until then.
- Artist edit of the short name (UI for `set_artist_slug`) and of year, medium and signed (P06).
- Showcase tab: still the reels strip until P08.
