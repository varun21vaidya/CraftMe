# Public Artist page — plan

Goal: any buyer or signed-out visitor can find and read an Artist's page, which they can only view, not change.
The Artist sees the same page, plus a bar that only they see.

## What already exists (no change needed)

| Fact | Where |
|---|---|
| `/artist/:id` is public: no login, no role check | `src/App.jsx` route, `src/pages/ArtistPage.jsx` |
| Anyone can read `profiles` (name, photo, bio, Instagram, rating, restricted) | `0001_init.sql` `profiles_read using (true)` |
| Private data (legal name, PAN, payout, phone, money owed) is in `artist_private`: the Artist and admins only | `0001_init.sql` |
| Works and listings of a restricted Artist are hidden by row security (`artist_open`) | `artworks_read`, `listings_read` |
| Reels of a restricted Artist are hidden | `0008_reels.sql` `reels_read` |
| Only **approved** reviews change `rating_count` / `rating_avg`; rejected reviews never count | `0003_logic.sql` `decide_review` |
| A buyer's id shows "We couldn't find this Artist" (buyers have no public page) | `ArtistPage.jsx` role check |
| Taken-down works (`status = 'draft'`) never show, even to the owner on this page | `useArtistWorks` filters `published` |

No database migration is needed. All changes are in the front end.

## Decisions (from the grilling)

1. **Discovery:** each Browse card shows the Artist's name, linking to their page. The "By …" link on the product page stays.
2. **Content:** add the photo (initials in a circle when there is none) and a rating summary. No review list and no "selling since" line for now.
3. **Restricted Artist:** keep the name and photo, and show the neutral notice "This Artist isn't taking orders right now." No reason is given, and no works or reels are shown.
4. **Own page:** a bar saying "This is how buyers see your page", with **Edit profile** and **My works** buttons. Only the owner sees it.
5. **Sold works:** works on sale come first, then sold works with a "Sold" tag.
6. **More than 24 works:** a **Show more** button loads the next 24.
7. **Rating:** shown from the first approved review, always with the count, e.g. "4.5 ★ · 2 reviews".
8. **Load failure:** "We couldn't load this page" with **Try again**. "Couldn't find" is shown only when the row really doesn't exist.

## Changes

### 1. `src/api/gateway.js`
- `useArtistWorks(id, page)`: order by `available desc, created_at desc` and use `.range(page*24, page*24+23)`. Offset paging is fine at this scale; there's no cursor because the sort has two keys.
  `shortcut: offset paging can skip or repeat a work if one sells while someone pages; switch to a keyset cursor if an Artist has hundreds of works.`
- `useArtworks` (Browse) and `useArtistWorks`: select `*, artist:profiles!artworks_artist_id_fkey(display_name)`, so a card gets the name in the same request. This avoids one request per card.
- `useArtist` stays as it is. It already returns `[data, loading, error, reload]`.

### 2. `src/components/ArtCard.jsx`
- Today the whole card is one `<Link>`. A second link can't go inside a link (invalid HTML, and the click goes to the wrong place).
- New structure: `<article className="art-card">`, holding a `<Link>` around the photo and title, then a separate `<Link className="small muted" to="/artist/…">by {name}</Link>`.
- New prop `hideArtist`, used on the Artist's own page, where "by <same name>" would repeat on every card.
- Keep the hover lift (CSS uses `.art-card`). Check the hover and focus outline still work on the `article`.

### 3. `src/pages/ArtistPage.jsx`
Decide what to show, in this order:
1. **Loading:** the skeleton (unchanged).
2. **Error** (`error` set): "We couldn't load this page" with a **Try again** button that calls `reload`.
3. **Not found:** no row, or `roles` lacks `artist`. Show the existing "We couldn't find this Artist".
4. **Restricted** (`artist.restricted`): head (photo, name) plus the notice. No bio links, reels or works. The owner also sees the bar (see 5).
5. **Normal:** head, then reels, then works.

Head:
- **Photo:** `artist.photoURL`, shown only if it starts with `https://`. Otherwise, or if the image fails to load (`onError`), use the `.avatar.xl` initials: the first letters of up to two words of the name, or "A" if the name is empty.
- **Name:** shown in the `h1`. An empty name shows "Artist". Long names wrap (`overflow-wrap: anywhere`).
- **Rating:** shown only when `ratingCount > 0`: `{ratingAvg.toFixed(1)} ★ · {n} review(s)`. Use singular or plural correctly. Label it for screen readers: `aria-label="Rated 4.5 out of 5 from 2 reviews"`.
- Bio and Instagram: unchanged.

Owner bar (`currentUser?.uid === id`):
- Normal page: "This is how buyers see your page." with [Edit profile] (`/dashboard/profile`) and [My works] (`/dashboard/works`).
- Restricted: "Buyers can't see your works right now." with [Edit profile]. No reason is shown here either; it lives in the dashboard.
- Signed-out visitors and other users never see the bar.

Works:
- Use `useArtistWorks(id, page)`, adding each page's results to the list.
- Show **Show more** only when the last page came back with exactly 24 works.
- Empty list: "No work on sale right now" (unchanged).
- Cards use `hideArtist`.

`document.title`: set it to `{name} · CraftMe`, and put it back when leaving the page.

### 4. Browse and other card users
- Grep every use of `ArtCard`. Each must still render now that `art.artist` may be missing (old cached data, demo rows). If `art.artist?.displayName` is missing, hide the "by" line.

## Edge cases checklist

| Case | Expected |
|---|---|
| Signed-out visitor opens `/artist/<id>` | Full public page, no login prompt |
| Signed-in buyer | Same as signed out; no bar |
| Another Artist | Same as signed out; no bar |
| Admin | Same as signed out (admins can read drafts, but the query filters to `published`) |
| The Artist themself | Page plus the bar; drafts and taken-down works still hidden |
| Id is not a UUID (`/artist/abc`) | Postgres returns error 22P02. Treat it as **not found**, not as a network error |
| Id of a buyer (no `artist` role) | Not found |
| Id that doesn't exist / deleted profile | Not found |
| Artist lost the `artist` role | Not found |
| Restricted Artist | Photo, name and neutral notice only |
| Restricted Artist views their own page | Notice plus "Buyers can't see your works right now" |
| Network down or Supabase error | Error with Try again; reload works without refreshing the page |
| No photo / broken photo URL / non-https URL | Initials |
| Empty display name | "Artist" and initial "A" |
| Very long name or 500-character bio | Wraps at 390 px, no sideways scroll |
| No reviews, or only pending or rejected ones | No rating shown |
| 1 approved review | "5.0 ★ · 1 review" |
| No reels | Reels section hidden (unchanged) |
| No works | "No work on sale right now" |
| All works sold | Shown, each tagged "Sold" |
| 24 works exactly | No Show more button, or a button that loads an empty page and then hides. Acceptable |
| 25+ works | Show more loads the rest |
| A work sells while the page is open | Refreshes within 30 s (existing refresh); it moves to the Sold group |
| Instagram unverified / verified / disconnected | Unchanged labels; a disconnected account shows no "verified" |
| Stale page after a deploy | The existing ErrorBoundary reloads once |
| Browse card without artist data | No "by" line, card still works |
| Keyboard user on a card | Two separate tab stops: work, then Artist |

## Tests

- **Unit** (`src/pages/ArtistPage.test.jsx`, mocking `../api/gateway`): one render each for loading, error with retry, not found (no row, no role, bad id), restricted, normal with and without photo, rating hidden at 0, rating "1 review", owner bar shown only to the owner.
- **Unit** (`ArtCard.test.jsx`): "by" link present with a name, absent without one, absent with `hideArtist`.
- **Schema** (`supabase/schema.test.mjs`): signed out (`anon`) can read an Artist's profile; anon gets no works or reels for a restricted Artist; anon can't read `artist_private`; a pending review doesn't change `rating_count`. Some may already be covered, so check first and add only the missing ones.
- **Browser** (live site after deploy, signed out, at 390 px and desktop): open an Artist from a Browse card, check photo or initials, rating, works and Show more. Then check a bad id, and a buyer id.
- Run `npm run lint`, `npm test`, `npm run test:schema` and `npm run build` before merging.

## Out of scope (named, not built)
- A page listing all Artists (`/artists`).
- A list of written reviews, and "selling since".
- Readable URLs (`/artist/varun-around`) instead of the UUID.
- Link previews for WhatsApp or Instagram (Open Graph tags). The site is a single-page app with no server rendering, so shared links show the generic CraftMe preview.
- An admin screen to approve reviews. **Checked: none exists.** `decideReview` is defined in `gateway.js` but no screen calls it, so every review stays pending, `rating_count` stays 0 and the rating summary never appears. Until a screen exists, approve reviews by running `decide_review` in the Supabase SQL editor.
