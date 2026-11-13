# P08 Instagram: dedicated page, posts and reels, 9-slot Showcase, disconnect that deletes imports

**Goal.** Move Instagram to its own dashboard page with the five reference states, apply D09 (a Showcase of up to 9 mixed posts and reels; disconnect deletes the token and every API-imported pick and keeps pasted links), and show the Showcase on the public profile.

**Coverage.** All of S27; S04.st.default, S04.st.no-instagram, S04.tab.t-ig.

**Depends on.** P06 (shell, artwork editor's reel field). **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD07. **External:** XD07 (posts permission, App Review). Pasted links work without Meta.

## Paths

Existing, to modify:

- `supabase/functions/api/instagram.ts` (`MAX_REELS`, `mediaOf`, `disconnect`, `instagramStatus`, `instagramMedia`, `instagramImport`, `dataDeletion`, `deauthorize`)
- `supabase/functions/api/instagram_pure.js`, `instagram_pure.test.js` (`filterMedia`)
- `src/components/dashboard/InstagramConnect.jsx`, `ReelsManager.jsx` (split into the new page's parts)
- `src/components/ReelCard.jsx` (post variant), `src/pages/ArtistPage.jsx` (Showcase tab)
- `src/api/gateway.js` (`useReels`, `saveReel`), `src/lib/reels.js`, `src/lib/reels.test.js`, `src/lib/instagram.js`, `src/lib/format.js`
- `src/pages/ProfileEdit.jsx` (deleted once `/dashboard/instagram` no longer uses it)
- `src/content/legal/privacy.jsx`, `deletion.jsx` (P04; wording of what disconnect deletes)
- `supabase/schema.test.mjs`, `supabase/README.md`

PROPOSED, to create:

- `supabase/migrations/0026_showcase.sql`
- `src/pages/InstagramPage.jsx`
- `src/components/dashboard/ShowcaseManager.jsx`, `PostPicker.jsx`, `PasteLinkForm.jsx`, `ArtworkReelsList.jsx`, `DisconnectDialog.jsx`
- `e2e/instagram.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `makeInstagram`, `fetchMedia`, `copyThumbnail`, `dropCover`, `markReconnect`, `callback`, `route` | `instagram.ts` | The popup flow and callbacks are kept (KD07) |
| `authorizeUrl`, `encryptToken`, `decryptToken`, `parseSignedRequest`, `filterMedia` | `instagram_pure.js` | |
| `INSTAGRAM_CHANNEL`, `POPUP_NAME`, `instagramMessage` | `src/lib/instagram.js` | |
| `reelCode`, `reelLabel`, `reelEmbedUrl` | `src/lib/reels.js` | The link pattern already accepts `/p/` |
| `reels_guard`, `artworks_reel_guard`, `reels_verified_guard` | `0008_reels.sql`, `0009_instagram.sql` | `reels_guard` is replaced |
| `useReels`, `saveReel`, `deleteReel`, `upload`, `call` | `src/api/gateway.js` | |
| `useSwitches` | P03 | `instagramConnect` switch |
| `Dialog`, `Tabs`, `EmptyState`, `useToast` | P00 | |

## Migration `0026_showcase.sql`

1. `alter table public.reels add column kind text not null default 'reel' check (kind in ('reel','post'));` Backfill `post` where the URL path starts with `/p/`. A `before insert or update of url` trigger sets `kind` from the URL, so no client can mislabel it.
2. Replace `reels_guard`: at most 9 rows with `highlighted` per Artist (`invalid` `showcase_full`); at most 50 rows per Artist in total (`invalid` `reel_limit`, PD07). Existing data has at most 6 highlighted and 12 rows, so nothing is cut: "current highlights are migrated" means they stay as they are.
3. `reorder_showcase(p_ids uuid[])` (security definer, owner checked): sets `position` to each id's index in one statement. Ids must all be the caller's highlighted rows.
4. Revoke and grant; `reorder_showcase` to `authenticated`.

Edge Function:

| Part | Change |
| --- | --- |
| `filterMedia` | Keeps images and carousels too. Each item gains `kind` (`reel` for `REELS` or `VIDEO`, else `post`) and uses `media_url` as the thumbnail for images. |
| `mediaOf`, `instagramMedia` | Requests `media_url`; takes an optional `after` cursor and returns `next` for "Load older posts"; returns `slotsLeft = 9 - highlighted count`. |
| `instagramImport` | Up to `slotsLeft` ids; inserted rows are `highlighted`; a full Showcase refuses with `showcase_full`. |
| `disconnect` (D09) | Deletes the token row, deletes every row with `ig_media_id` and its copied cover, clears the verified flags. Rows the Artist pasted (`ig_media_id` null) stay. The handle stays as a plain, unverified link. Used by `instagramDisconnect`, Meta's `deauthorize`, `dataDeletion` and `instagramDeleteMyData`. An Artwork whose reel was imported loses it (`reel_id` is set null by the foreign key). |
| `instagramStatus` | Adds `connectedAt` and `switchOn`. `enabled` is true only when the secrets exist and `settings.switches.instagramConnect` is not false. |

Rollout: schema test, apply `0026`, deploy the Edge Function, deploy the web app.

## Proposed interfaces

```js
// src/api/gateway.js
export const useReels = (artistId, { mine = false } = {}) => …          // unchanged signature; rows now carry kind ('reel' | 'post')
export const saveReel = (uid, fields, id) => …                           // unchanged; 'kind' is set by the database from the URL, never sent
RPC.reorderShowcase = (i) => ['reorder_showcase', { p_ids: i.ids }];
export const linkReelToArtwork = (artworkId, reelId /* or null */) => …  // artworks.reel_id update (grant exists since 0008)
export const useMyArtworkReels = (uid) => …                               // own artworks: id, title, photos[0], status, reel:reels(id, url, title)

// src/lib/reels.js
// no JS copy of the post-or-reel rule: rows and picker items carry `kind` from the server; the paste form needs only reelCode() to validate
export const SHOWCASE_MAX = 9
```

```ts
// supabase/functions/api/instagram.ts (commands keep their names)
instagramStatus      {}                      -> { enabled, switchOn, connected, username, needsReconnect, connectedAt }
instagramMedia       { after?: string }      -> { items: [{ id, kind, permalink, thumbnail, caption, timestamp, imported }], next: string | null, slotsLeft }
instagramImport      { mediaIds: string[] }  -> { added: string[], refused: [{ id, reason: 'not_yours' | 'already_added' | 'showcase_full' | 'failed' }] }
instagramDisconnect  {}                      -> {}            // now deletes imported rows and their covers (D09)
const SHOWCASE_MAX = 9;                                        // replaces MAX_REELS
```

```js
// supabase/functions/api/instagram_pure.js
export const filterMedia = (items) => [{ id, kind, permalink, thumbnail, caption, timestamp }]   // keeps IMAGE and CAROUSEL_ALBUM as kind 'post'
```

```sql
-- 0026_showcase.sql
reorder_showcase(p_ids uuid[]) returns jsonb     -- authenticated; every id must be the caller's highlighted row, else invalid ["ids"]
```

New `reason` value: `showcase_full`. `reel_limit` keeps its code with new wording (50 rows, PD07).

## UI specification: `/dashboard/instagram`

Header: "Instagram", "Show your posts and reels on your CraftMe profile, and link a reel to each Artwork. Nothing is copied: CraftMe stores links only."

| State | What is drawn |
| --- | --- |
| `S27.st.disconnected` (enabled, no account) | Connect card: "Connect your Instagram", three points (Read only; You choose, up to 9; Links, not copies. "Disconnect any time and we delete your access and the posts you picked."), the notice "Business or Creator accounts only. Personal accounts can't connect. You can still paste links to posts and reels below.", "Connect Instagram" ("Opening Instagram…"), "I'll paste links instead" (jumps to the paste form) |
| `S27.st.disabled` (secrets missing or switch off) | Info alert "Connecting Instagram isn't available yet. You can still add posts and reels by pasting their links below." No connect button. |
| `S27.st.connected` | Account row: "@{username}", badge "Connected", "connected {date}", "Pick posts", "Disconnect". Then the Showcase manager. |
| `S27.st.picker` (`?pick=1`) | The picker section under the Showcase manager |
| `S27.st.lapsed` (`needsReconnect`) | Warning "Instagram access has ended. You can't pick new posts until you reconnect. Everything already on your profile keeps working." with "Reconnect Instagram"; badge "Expired"; "Pick posts" hidden |

- **Connect.** Unchanged popup flow (KD07): the window opens during the click; if the browser blocks it, the same tab is used and the return page brings the Artist back. Results arrive on the broadcast channel and show as a `role="status"` line: connected, cancelled ("Instagram access was not approved."), took too long, personal account ("No Instagram account was shared. Choose a creator or business account…"), already linked to another Artist, failed.
- **Showcase manager.** "Your Showcase", "Shown on your public profile, in this order. {n} of 9 used.", "View on my profile". A grid of tiles (cover or a plain card, a "Reel" or "Post" tag, a "from Instagram" mark on imports, the Artist's name for it). Each tile has "Move earlier", "Move later", "Remove from Showcase" buttons. Moving calls `reorder_showcase` once; on failure the order snaps back with an error toast. Removing a pasted link un-highlights it and offers "Delete link"; removing an import deletes it. A last tile "Add more ({k} slots left)" opens the picker (connected) or jumps to the paste form. Empty: "Nothing in your Showcase yet."
- **Picker.** "Pick posts for your Showcase", "Your latest posts and reels from Instagram. Tap to select. {n} selected (up to 9 in total).", chips All, Reels, Posts, a grid of selectable tiles (`role="checkbox"`, Space and Enter toggle, already-added tiles are marked and disabled, further tiles are disabled once the free slots are used), "Load older posts" (hidden when there are none), "Cancel", "Add to Showcase" ("Adding…"). Result line: "Added {n}." plus "Skipped {m}: already added, Showcase full, not found on your account." Loading: skeleton tiles. `reconnect`: switches to the lapsed state. `instagram_down`: "Instagram isn't answering right now. Try again in a minute."
- **Paste a link.** "Works for any Instagram account, no connection needed." Field "Instagram link" with "Add". Help: "Looks like instagram.com/p/… or instagram.com/reel/…". A wrong link shows "That isn't an Instagram post or reel link." under the field. Optional Name (80) and Cover picture, as today. Select "Link it to an Artwork": "Show on my profile only" (uses a Showcase slot) or one of the Artist's works (shows on that Artwork's page and uses no slot). The existing checkbox "This is mine, or I have permission to show it on CraftMe." stays required. Full Showcase with "profile only": "Your Showcase is full. Remove one first, or link this to an Artwork."
- **Reels on your Artworks.** One row per published or draft work: thumbnail, title, "Reel linked · {short link}" or "No reel", "Change" or "Add" (opens a small picker of the Artist's links, or jumps to the paste form).
- **`S27.dlg.disc`.** Alert dialog "Disconnect Instagram?": "CraftMe deletes your Instagram access and the posts you picked from Instagram, and removes them from your Showcase and Artworks. Links you pasted yourself stay. Your Instagram isn't changed. You can reconnect and pick again at any time." "Keep connected" and "Disconnect and delete" ("Disconnecting…"). Success: toast "Instagram disconnected.", state becomes disconnected.
- Restricted Artist: the page works (reels are hidden publicly by `reels_read`), with the shop-paused alert.

### Public profile, Instagram Showcase tab (S04)

The highlighted rows in order, as `ReelCard` tiles: reels keep the tap-to-play embed with the Instagram fallback (KD06); posts show the cover with a "Post" tag and "View ↗" to Instagram. A "Follow @{handle}" link when a handle exists. Lead: "Posts and reels {name} chose to show. They stay on Instagram and open there." Footnote: "Embeds load only when you tap them." Empty (`S04.st.no-instagram`): "No Instagram posts yet. {name} hasn't added any posts or reels." Embeds never load before a tap.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `instagramImport` | Artist only; media not on the account: refused per item (`not_yours`) | Slots used in another tab: `showcase_full` per item | Already added: refused per item (unique `ig_media_id`) | Some added, some refused: both lists returned and shown | Re-picking skips the added ones | List re-read |
| `reorder_showcase` | Own rows only | Row removed elsewhere: `invalid`, list reloads | Idempotent | None (one statement) | Yes | — |
| Paste link | RLS and the link pattern | Showcase filled meanwhile: `showcase_full` | A duplicate link is allowed (no unique rule); the form disables while saving | Cover uploaded, insert failed: cover removed | Form keeps values | — |
| `instagramDisconnect` | Artist only | Already disconnected: ok | Idempotent | Token deleted, a cover file failed to delete: the file stays in the Artist's own folder | Safe | State from `instagramStatus` |
| Meta `deauthorize`, `data-deletion` | Signed request checked with the app secret | Unknown account: 200 and nothing happens | Idempotent | — | Meta retries | Status page by code |

## Steps

1. Migration and schema checks: a tenth highlighted row is refused; the 51st row is refused; `kind` follows the URL; `reorder_showcase` rejects foreign ids.
2. `filterMedia` change with updated unit tests (image, carousel, reel, missing permalink).
3. Edge changes in the table; fake Instagram provider for end-to-end tests (a fixed media list with reels and posts, a second page, one id that simulates a dead token).
4. Build `InstagramPage.jsx` and its parts from `ReelsManager.jsx` and `InstagramConnect.jsx`; route `/dashboard/instagram`; delete `ProfileEdit.jsx`, `ReelsManager.jsx`, `InstagramConnect.jsx` when unused.
5. `ReelCard.jsx` post variant; `ArtistPage.jsx` Showcase tab.
6. Legal text: the privacy and deletion pages say what disconnect deletes and what stays (D09).
7. `format.js`: `showcase_full`; update `reel_limit` wording.
8. `supabase/README.md`: replace "12 reels, 6 highlighted".

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/instagram.spec.js
```

## Completion gate

- [ ] QA-S27-03 to 08 and QA-S04-04 pass with the fake provider; QA-S27-01, 02, 09 are listed for Gate B (Meta development mode).
- [ ] After a disconnect in QA-S27-05 the database holds no row with `ig_media_id` for that Artist and no `instagram_accounts` row, and pasted rows are still there.
- [ ] `git grep -n "MAX_HIGHLIGHT\|12 reels" src supabase` returns nothing.
