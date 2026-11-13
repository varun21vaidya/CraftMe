# P06 Artist shell, My Artworks and the Artwork editor

**Goal.** Give Artists the reference dashboard frame, a list of their works with status tabs and the End, Reopen and Delete rules, and one editor for new and existing works with photos, video or reel, several Listings and a publish checklist.

**Coverage.** SH.06, all of S22 and S23. The Overview page itself (S21) is P07; until then `/dashboard` redirects to `/dashboard/artworks`.

**Depends on.** P00. Uses the `year`, `medium`, `signed` columns from `0021` (P03); if P03 has not shipped, move that `alter table` into `0024`. **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD06, PD09, PD19.

## Paths

Existing, to modify:

- `src/App.jsx` (dashboard routes move under the new shell)
- `src/pages/MyWorks.jsx` (rebuilt as the S22 page), `src/pages/NewArtwork.jsx` (replaced by the editor)
- `src/components/dashboard/ArtworkUploadForm.jsx`, `ArtworkUploadForm.test.js` (`KINDS` and `schema` move; the form is replaced)
- `src/components/Gallery.jsx` (uploaded video slide), `src/pages/ArtworkPage.jsx` (preview banner, view count call)
- `src/api/gateway.js` (`DRAFT_FIELDS`, `saveDraft`, `sellArtwork`, `publishWork`, `setWorkOnSale`, `setListingPrice`, `useMyWorks`)
- `src/lib/format.js`, `supabase/schema.test.mjs`

PROPOSED, to create:

- `supabase/migrations/0024_artist_catalogue.sql`
- `src/components/common/ArtistShell.jsx`
- `src/pages/ArtworkEditor.jsx`
- `src/components/dashboard/ListingDialog.jsx`, `PhotoManager.jsx`, `VideoPicker.jsx`, `PublishPanel.jsx`, `WorksTable.jsx`
- `src/lib/works.js` (`KINDS`, `workStatus`, `publishProblems`), `src/lib/works.test.js`
- `e2e/artist-works.spec.js`, `e2e/artwork-editor.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `useMyWorks`, `saveDraft`, `setListingPrice`, `upload`, `useReels`, `saveReel` | `src/api/gateway.js` | `sellArtwork`, `publishWork`, `setWorkOnSale` are removed once nothing calls them |
| `KINDS`, `schema`, `Previews` | `ArtworkUploadForm.jsx` | `KINDS` moves to `src/lib/works.js`; importers: `MyWorks.jsx`, the P03 type filter |
| `CATEGORIES`, `GROUPS` | `src/lib/categories.js` | |
| `reelCode`, `reelLabel` | `src/lib/reels.js` | Link check |
| Policies `artworks_insert`, `artworks_update`, `listings_insert`, `listings_update`; triggers `_sync_artwork`, `_start_open`, `artworks_reel_guard` | `0001_init.sql`, `0003_logic.sql`, `0008_reels.sql` | Unchanged. `listings_update` already allows `ended`. |
| Buckets `artworks`, `videos`, policy `craftme_delete_own_media` | `0004_storage.sql` | |
| `NotificationBell` | `src/components/common/NotificationBell.jsx` | In the shell header |
| `Tabs`, `Pagination`, `Dialog`, `Dropzone`, `Field`, `Breadcrumbs`, `Menu`, `EmptyState`, `useToast` | P00 | |

## Migration `0024_artist_catalogue.sql`

1. `alter table public.artworks add column updated_at timestamptz not null default now();` and a `before update` trigger that sets it.
2. `create unique index listings_one_original on public.listings (artwork_id) where kind = 'original' and status <> 'ended';`
3. Trigger `listings_live_guard` (before insert or update): a listing may become `live` only when `stock - held > 0`, else `invalid` `out_of_stock`.
4. Functions, all security definer with the owner checked inside (`artist_id = auth.uid()` and `public.is_artist()`), all refusing a restricted Artist with `conflict` `artist_restricted` except `end_artwork` and `delete_artwork`:
   - `publish_artwork(p_artwork uuid)`: needs a title, at least one photo and at least one listing that is `draft` or `live`; sets the artwork `published` and every `draft` listing `live` in one transaction. Missing parts fail `invalid` with `fields` among `title`, `photos`, `listings`. Calling it again changes nothing.
   - `end_artwork(p_artwork uuid)`: every `live` or `draft` listing becomes `ended`, the artwork becomes `draft` (hidden from the shop). Paid orders are untouched.
   - `reopen_artwork(p_artwork uuid)`: every `ended` listing with stock left becomes `live`, the artwork `published`. With no stock left anywhere: `conflict` `out_of_stock`.
   - `delete_artwork(p_artwork uuid)`: allowed only when `has_sales` is false and no `order_lines` row points at it (open holds count). Sets the artwork `removed` and its listings `ended`. Otherwise `conflict` `has_sales`. Returns the photo and video URLs so the caller can remove the files.
   - `set_listing_stock(p_listing uuid, p_stock integer)`: not for an Original (`invalid` `original_stock`); `p_stock` between the current `held` and 1000; a `sold` listing given stock becomes `live`.
   - `earnings_estimate(p_price bigint) returns jsonb`: `{commission, gateway, net}` from the current `commission_bps` and an assumed gateway cost of 236 basis points (PD19). Artists only.
   - `bump_view(p_artwork uuid)`: adds one to `views` of a published work. Callable by `anon` and `authenticated`.
5. Revoke execute from `public, anon, authenticated` on each, then grant as stated.

Legacy data: works taken down before this package have a `draft` artwork with `draft` listings. They appear under Drafts with a "Finish" action. No backfill is attempted, because a failed publish looks the same.

Rollout: schema test, apply `0024`, deploy the web app.

## Proposed interfaces

```js
// gateway.js
export const useWork = (id) => …                       // own artwork with listings(*), for the editor
export const saveArtwork = (uid, id, fields) => …      // insert (draft) or update: title, description, category, year, medium, signed, photos, video, reelId
export const saveListing = (uid, id, fields) => …      // insert (draft) or update: kind (insert only), size, medium, price, stock (insert only), title
RPC.publishArtwork = (i) => ['publish_artwork', { p_artwork: i.artworkId }];
RPC.endArtwork = (i) => ['end_artwork', { p_artwork: i.artworkId }];
RPC.reopenArtwork = (i) => ['reopen_artwork', { p_artwork: i.artworkId }];
RPC.deleteArtwork = (i) => ['delete_artwork', { p_artwork: i.artworkId }];
RPC.setListingStock = (i) => ['set_listing_stock', { p_listing: i.listingId, p_stock: i.stock }];
RPC.earningsEstimate = (i) => ['earnings_estimate', { p_price: i.pricePaise }];
export const endListing = (id) => …  /  reopenListing = (id) => …     // direct status updates allowed by listings_update
export const bumpView = (artworkId) => …               // rpc, once per session per artwork (sessionStorage)

// src/lib/works.js
export const KINDS = [...]                                               // moved, unchanged
export const workStatus = (work) => 'draft' | 'published' | 'sold' | 'ended'
export const publishProblems = (work, listings) => ['title' | 'description' | 'photos' | 'listings' | 'year' | 'medium']
```

`workStatus`: `published` when the artwork is published and a listing is live; `sold` when published with no live listing and at least one sold; `ended` when not published and at least one listing is `ended`; otherwise `draft`.

## UI specification

### Artist shell (SH.06)

A layout route for `/dashboard/*`. Header: logo with the small label "Artist", "View my shop" (to `/artist/:me`), the bell, the account menu. Left sidebar (`.side`), group label "My shop": Overview, Artworks, Orders with a badge of orders to ship, Payouts, Instagram, Settings; at the foot "Back to CraftMe" and "Log out". The current section has `aria-current="page"`. Under 900 px the sidebar becomes a horizontal, scrollable link row under the header. Links to pages not yet built point at their P00 stand-ins. A non-artist is redirected by `artistOnly`.

A restricted Artist sees, on every dashboard page, an alert: "Your shop is paused. Buyers can't see your pieces and you can't take new orders. Please still post your open orders." with the newest reason from `artist_private.restriction_reasons`.

### S22 My Artworks, `/dashboard/artworks`

- Header: "My Artworks", "An Artwork is what Buyers browse. Its Listings are what they buy.", "Add Artwork".
- `Tabs` with counts, kept in `?tab=`: All, Published, Drafts, Sold, Ended. A search box "Search my Artworks" filters the loaded list by title as you type.
- Table (`.table-wrap`; stacked cards under 760 px): thumbnail, title, "{category} · {year}"; one line per listing ("Original ₹42,000 · 1 left", "Print ₹2,500 · 50 in stock", "Sold", "Ended"), or "No Listings yet"; status badge; Views; Updated date; actions.

| Status | Actions |
| --- | --- |
| Published | Edit, End (opens `S22.dlg.end`), View |
| Sold | View, Edit; "Delete" disabled with the tooltip and visible hint "Artworks with sales can't be deleted" |
| Draft | Finish (to the editor), Delete (opens the delete dialog) |
| Ended | Edit, Reopen |

- `S22.dlg.end` (alert dialog): "End all Listings of this Artwork? Ended Listings leave the shop and can't be bought. Paid Orders aren't affected, and you can reopen them any time." "Keep selling" and "End Listings" ("Ending…"). Success: toast "Listings ended", the row moves to Ended.
- Reopen acts at once: toast "Listings reopened"; `out_of_stock`: "Nothing left to sell. Add stock to a Listing first."; restricted: "Your shop is paused, so Listings can't be reopened."
- `Pagination`, 20 per page, over the filtered list. The page loads up to 500 works; beyond that a note says "Showing your 500 newest Artworks."
- `S22.st.empty`: "Your wall is empty. Add your first Artwork with photos, then create a Listing for the Original, a Print, or both." with "Add your first Artwork". An empty tab or search: "Nothing here."
- Loading: skeleton rows. Error: alert with "Try again". While an action runs, that row's buttons are disabled.

### S23 Artwork editor, `/dashboard/artworks/new` and `/dashboard/artworks/:id`

Two columns over 1000 px (form, 320 px sticky publish panel); one column below with the panel after the form.

- `Breadcrumbs` My Artworks, title or "New Artwork". Heading "Add Artwork" or "Edit Artwork", status badge, "Saved {time}" after each successful save, "Preview" (opens `/artwork/:id?preview=1` in a new tab; enabled once a draft exists), "Save draft".
- **Details.** Title\* (100, counter); Category\* (select grouped by the five groups); Year made\* (four digits, 1900 to this year); Medium\* (100, hint "Like 'Acrylic on canvas' or 'Cast brass'."); Signed (On the back, On the front, Unsigned); Description\* (1000, counter).
- **Photos\*.** "{n} of 5 added. The first photo is the cover." A grid of thumbnails, the first tagged "Cover"; each has "Remove photo {n}", "Move earlier", "Move later" buttons (keyboard reachable). `Dropzone` for more, up to 5 in total, JPEG or PNG, 5 MB each; refused files are named with the reason. New photos upload when the form is saved.
- **Video (optional).** Radios: None; Instagram reel (recommended); Upload a video. Reel: a link field with "Check link" ("Link looks right" or "That isn't an Instagram post or reel link."), or a choice from the Artist's saved reels (existing picker). Saving a pasted link creates a reel row that is not in the Showcase. Upload: MP4 or WebM, up to 50 MB and 3 minutes (the length is read in the browser before upload; PD06). Only one of reel or video is kept.
- **Listings\*.** "What Buyers can actually buy. Prices include shipping within India." Table: Type, Details, Price, Stock, Status, "Edit", and "End" or "Reopen". "Add Listing" opens the dialog.
- **`S23.dlg.lst`.** Title "Add Listing" or "Edit Listing". Type radio cards: Original ("One of a kind. Stock is always 1."), Print ("Reproductions. You set the stock."), Ready-made item (KD05). The type cannot change after creation; Original is disabled when the work already has one. Size\*, Medium and finish\*, Price\* (₹, whole rupees, at least 1), Stock (fixed 1 for an Original; 1 to 1000 otherwise; when editing, not below the quantity currently held, with the hint "{n} are in someone's checkout right now."). "What you'd receive: about ₹{net}" with "An estimate, after CraftMe's share and the payment cost." (PD19; refreshed 300 ms after the price changes; hidden if the estimate call fails). "Cancel" and "Save Listing" ("Saving…"). A new work is saved as a draft first if needed, so the listing has something to attach to.
- **Publish panel.** "Ready to publish?" with a tick or cross for: Title and description; At least one photo; At least one Listing with a price. When the Artist is not yet verified: "We're checking your details. You can publish now, and you'll be paid once that's done." Button "Publish Artwork" (or "Save changes" for a published work), "Save draft", the note "Published Artworks go live straight away. CraftMe can take one down if it's reported."
- **`S23.st.errors`.** Pressing Publish with gaps shows an alert "{n} things stop you publishing" listing them as links to the fields, and inline messages ("Add a title. It shows on the wall label.", "Add at least one photo.", "Add at least one Listing with a price.").
- **Danger zone.** "Delete Artwork". Never sold: `S23.dlg.del` (alert dialog) "Delete this Artwork? This can't be undone. Its photos and Listings are removed. It has never sold, so no Orders are affected." "Keep it" and "Delete Artwork"; success returns to the list with a toast. Has sales: the button is replaced by "This Artwork has sales, so it can't be deleted. End its Listings instead."
- **Saving.** "Save draft" needs a title and a category ("Add a title and category to save a draft."). Order of work: upload new files, save the row, then remove files that were dropped. If the row save fails, the files uploaded in this attempt are removed and the form keeps its values with "We couldn't save. Try again." There is no timed autosave; leaving with unsaved changes asks the browser's "leave page?" question.
- **Sold listings** show as read-only rows. **A restricted Artist** sees the form disabled under the shop-paused alert. **Another Artist's id or an unknown id** shows the 404 page.

### Public page additions

- `Gallery` shows an uploaded video as a slide with native controls, loaded only when played.
- `ArtworkPage` with `?preview=1` for the owner shows a banner "Preview. Buyers can't see this until you publish." Buyers visiting a draft get the not-found view (RLS).
- `ArtworkPage` calls `bumpView` once per browser session per artwork, never for the owner.

## Steps

1. Migration and schema checks: `publish_artwork` refuses each missing part and is idempotent; `end_artwork` and `reopen_artwork` round trip; `delete_artwork` refuses a sold work and a work with an open hold; a second Original is refused; a listing cannot go live with no stock; `set_listing_stock` cannot go below held and revives a sold print; a restricted Artist is refused where stated; another Artist cannot call any of them on this work; `bump_view` ignores drafts.
2. `src/lib/works.js` with tests; move `KINDS`; update `ArtworkUploadForm.test.js` to the new location or delete it with the form.
3. `gateway.js` changes.
4. `ArtistShell.jsx` and the route tree: `/dashboard` (redirect to `/dashboard/artworks` for now), `/dashboard/artworks`, `/dashboard/artworks/new`, `/dashboard/artworks/:id`, and the existing `/dashboard/orders`, `/dashboard/settings`, `/dashboard/instagram` inside the shell. Remove the artist links from `Layout.jsx`'s header; the account menu's "Artist dashboard" is the way in.
5. Rebuild `MyWorks.jsx` as the S22 page.
6. Build `ArtworkEditor.jsx` and its parts; delete `NewArtwork.jsx` and `ArtworkUploadForm.jsx` when nothing imports them.
7. `Gallery.jsx` video slide; `ArtworkPage.jsx` preview banner and view call.
8. `format.js`: `has_sales`, `out_of_stock`, `original_stock`, and the publish field names.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| Save artwork | RLS: own, not restricted, not removed | Another tab saved first: last write wins; the editor reloads the row after each save | Idempotent update | Files uploaded, row failed: new files removed | Values kept | Unsaved edits are lost after the browser's warning |
| Save listing | RLS; sold listings refuse | Price changed while in a buyer's Cart: the buyer gets the price review (P01) | Insert is not idempotent: the dialog disables its button and closes on success | — | Dialog stays with values | — |
| `publish_artwork` | Owner, not restricted | Listing ended in another tab: `listings` problem returned | Idempotent | None (one transaction) | Safe | Status from server |
| `end_artwork` / `reopen_artwork` | Owner | Sold meanwhile: sold listings untouched | Idempotent | None | Safe | — |
| `delete_artwork` | Owner | A buyer started a hold meanwhile: `has_sales` | Second call: `not_found` treated as done | Row removed, file removal failed: files stay (harmless, own folder) | Safe | Row gone from the list |
| `set_listing_stock` | Owner, not restricted | Held rose meanwhile: refused below held | Idempotent | — | — | — |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/artist-works.spec.js e2e/artwork-editor.spec.js
```
```bash
npm run lint
```

## Completion gate

- [ ] QA-SH-05 (artist part), QA-S22-01 to 05, QA-S23-01 to 08 pass.
- [ ] `git grep -n "sellArtwork\|publishWork\|setWorkOnSale\|window.confirm" src/pages src/components/dashboard/ArtworkUploadForm.jsx` returns nothing.
- [ ] A work created before this package can still be opened, edited and published.
