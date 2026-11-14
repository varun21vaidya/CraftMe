# P06 verification record

Branch `craftme/p06-artist-catalogue`, cut from `craftme/p05-seller-onboarding` (P00 is the prerequisite; `0021`'s `year`, `medium`, `signed` and `bump_view` were already on the line, so nothing moved into `0024`).
Environment: local stack, `seed_qa.sql`, the `api` function served locally (`PROVIDER_MODE=fake`), Playwright 1.65 driving Microsoft Edge (`PW_CHANNEL=msedge`).

## Repository checks

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` | pass, 139 tests (new: `works.test.js`) |
| `npm run test:schema` | pass, 332 checks (301 before P06; the P03 checkout block now puts its second Original on its own Artwork, because of the new unique index) |
| `npm run build` | pass |
| `git grep "sellArtwork\|publishWork\|setWorkOnSale\|window.confirm" src/pages src/components/dashboard/ArtworkUploadForm.jsx` | nothing (the form is deleted). `window.confirm` still exists in `InstagramConnect.jsx` and `ReelsManager.jsx`, which P08 rebuilds |
| `e2e/artist-works.spec.js` and `e2e/artwork-editor.spec.js`, desktop-light | all pass (19 tests) |
| the same two files, phone-dark | 16 passed, 3 failed: see "Phone" below |
| Edge Function type check | not applicable (no Edge Function change) |

## Scenarios

| ID | Result | Evidence |
| --- | --- | --- |
| QA-SH-05 (Artist part) | passed on desktop; phone: the header link was hidden, fixed afterwards and not re-run | `artist-works.spec.js` (sidebar links, "2 to ship" badge, `aria-current`, "View my shop", the public header has no Artist links) |
| QA-S22-01 | passed on desktop; phone: failed in the search step, cause not found | tabs, listing lines, actions, search, reload on a tab, 20 to a page. Counts are checked against the database because A1 also owns the P03 filler works |
| QA-S22-02 | passed | end, keep selling, signed-out Not found and Browse, reopen, O2 unchanged, nothing left to sell |
| QA-S22-03 | passed | sold row disabled with its hint, draft deleted, editor danger zone, `delete_artwork` answers `has_sales` for a sold work and for one in an open hold |
| QA-S22-04 | passed | shop-paused alert on two dashboard pages, the Reopen message, a disabled editor, `publish_artwork` answers `artist_restricted`, a direct insert is refused |
| QA-S22-05 | passed | |
| QA-S23-01 | passed | counters, checklist, draft saved first, publish, database rows, public page |
| QA-S23-02 | passed | empty form message, "2 things stop you publishing", inline messages, `invalid` with `fields`, the unverified note (A2 is given the Artist claim in the test: the seed has none for A2) |
| QA-S23-03 | passed | dialog types, validation texts, estimate, live on a published work, below-held refusal, End and Reopen, the second Original refused by the index (`23505`), `earnings_estimate` equals price less commission and 2.36% |
| QA-S23-04 | passed | keyboard reorder, remove, refused oversize file, 4 of 5, new order saved and shown first; a removed uploaded photo leaves storage |
| QA-S23-05 | passed on desktop (the length is read through a stand-in for the video element; no real 4-minute file was used) | link check, reel row not highlighted, 50 MB and 3 minute refusals, upload keeps video and clears the reel, video slide with `preload="none"` |
| QA-S23-06 | passed | draft, preview banner, signed-out Not found, failed row update leaves no file and keeps the photos, the browser's leave-page question |
| QA-S23-07 | passed | double click on Publish, `publish_artwork` called twice |
| QA-S23-08 | passed | read-only sold row, `not-a-uuid` and unknown ids and another Artist's work give the 404, `forbidden` from the three commands |

## Phone (375 px)

Failed: the search step of QA-S22-01 (typing `kolam` leaves no visible row; the same step passes at desktop width and a direct load of a tab shows its row on a phone), and QA-S23-05's thumbnail check (the strip is not drawn on a phone; the test now skips it there), and QA-SH-05's "View my shop" (it sat in a navigation that is hidden on a phone; now a button in the header). The last two are fixed in the tree but not re-run on a phone. The first is open.

## Changes against the plan (recorded, not product decisions)

- **What stops publishing.** The database and `publishProblems` check title, photos and Listings only. The plan's list also names description, year and medium, but QA-S23-02 expects exactly "2 things" for a title-and-category draft. Those three are required in the form (marked `*`), checked for format when filled, and not enforced at publish.
- **Status of a published work whose Listings are all ended.** `workStatus` calls it Ended (the seed's W5 is stored that way; the plan's rule would call it Draft).
- **Stock text.** A Print or Ready-made row reads the stock as set ("50 in stock"), not stock less held, as QA-S22-01 says.
- **A Listing added to a published work** goes live at once (QA-S23-03); on a draft it waits for Publish.
- **The Artist shell sits beside the public layout**, not inside it, so there is one header.
- **`bump_view`** already existed from P03; the page now skips the owner.
- **Seed.** `seed_qa.sql` sets `has_sales` on W1 to W3 (the flag the payment path sets), so the editor's danger zone shows the sales sentence.
- **Overview and Payouts** are stand-ins: `/dashboard` goes to Artworks, `/dashboard/payouts` says it is not built.

## Changed paths

`supabase/migrations/0024_artist_catalogue.sql` (new), `supabase/schema.test.mjs`, `supabase/seed_qa.sql`;
`src/App.jsx`, `src/api/gateway.js`, `src/components/Gallery.jsx`, `src/components/common/{ArtistShell.jsx (new),Layout.jsx}`, `src/pages/{ArtworkEditor.jsx (new),MyWorks.jsx,ArtworkPage.jsx}`, `src/pages/NewArtwork.jsx` and `src/components/dashboard/ArtworkUploadForm.jsx` (+ its test) deleted, `src/components/dashboard/{ListingDialog,PhotoManager,VideoPicker,PublishPanel,WorksTable}.jsx` (new), `src/lib/{works.js,works.test.js (new),format.js}`, `src/ui/styles.css`;
`e2e/{artist-works,artwork-editor}.spec.js` (new), `e2e/become-artist.spec.js` (header link check moved to the account menu).

## Migration order

`0024_artist_catalogue.sql` after `0023_onboarding.sql` (needs `0001` to `0023`). Rollout: schema test, apply `0024`, deploy the web app. Applied only to the local stack so far.

## Remaining work

- Apply `0024` to the hosted project; then merge.
- The phone search failure in QA-S22-01; re-run the phone project after the two fixes.
- Overview (S21) and Payouts pages (P07).
- A real 4-minute video was not tried.
