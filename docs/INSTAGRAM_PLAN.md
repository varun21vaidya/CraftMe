# Instagram for artists: plan

## Goal
Artists keep signing in with Google. They can then link Instagram, show chosen reels on their page, and attach a reel to each product.

## Decisions
- **Google stays the only login.** Instagram is a link on top of an existing account, not a second way in.
- **Reels first by pasted link.** No Meta approval needed, so it ships first. The Instagram connection comes second.
- **Reels show on artist and product pages only.** Browse cards come in the next version.
- **Optional artist cover picture** per reel. No thumbnails from Meta until Phase 2.
- **Limits:** 12 reels per artist, 6 highlighted, one optional reel per product. A reel can feature on several products.

## Phase 1: paste a reel link (DONE, live on `main` at `3cee7a0`)
- `reels` table with limits, link-format check, ownership tick box, and access rules.
- Dashboard "Your reels" section, product reel dropdown, reel cards on artist and product pages.
- Privacy page has an Instagram section.
- Pending: a browser check of the pages (the browser tool couldn't reach localhost).

## Phase 2: Connect Instagram (needs Meta approval)

**Coding changes: yes.** Build with a stronger model.

### What the artist sees
1. On the dashboard, a **Connect Instagram** button (after Google sign-in).
2. A short hint: "Switch to a creator account first, in Instagram settings."
3. They approve on Instagram. CraftMe returns them to the dashboard.
4. A list of their recent reels with real thumbnails. They pick which to import; picked reels are marked **verified**.
5. The confirmed Instagram handle replaces the typed one, and is marked verified.

### How it works (server-side only)
- **Login:** Instagram Login (OAuth), scope `instagram_business_basic`. The button sends the browser to Instagram's authorize page. Instagram returns to a callback in the existing `api` Edge Function.
- **Token exchange:** the callback exchanges the code for a short-lived token, then a long-lived token (about 60 days).
- **Storage:** the token goes in a private table (RLS on, no client grants, service role only). Never sent to the browser.
- **Reading reels:** the Edge Function calls the media endpoint with the token and returns recent reels (id, permalink, thumbnail, caption, timestamp).
- **Refresh:** a pg_cron job refreshes tokens about 2 weeks before expiry, and removes any that fail.
- **Disconnect:** the artist can disconnect; we delete the token and mark imported reels as unverified.
- **Meta-required endpoints:** a deauthorize callback and a data-deletion callback, both in the `api` Edge Function. Meta needs both before review.
- **Verify all endpoint names against Meta's current docs when building.** Meta changes them.

### Database changes (planned migration `0009`)
- `instagram_accounts` (artist_id, ig_user_id, username, token_encrypted, token_expires_at, connected_at). Service role only.
- `reels`: add `ig_media_id text unique`, `verified boolean default false`.
- `profiles`: `instagram_verified boolean default false`. The existing `instagram_handle` is overwritten with the confirmed handle when connected.

### Placeholders to fill once Meta access is granted
These go into **Supabase secrets** (never in code, `.env`, or `VITE_*` variables):

| Placeholder | Where it comes from | Where it goes |
|---|---|---|
| `INSTAGRAM_APP_ID` | Meta app dashboard → Instagram → API setup | Supabase secret |
| `INSTAGRAM_APP_SECRET` | Meta app dashboard → Instagram → API setup (reveal) | Supabase secret |
| `INSTAGRAM_REDIRECT_URI` | Our callback URL (set in Meta, see below) | Supabase secret |
| `INSTAGRAM_TOKEN_KEY` | Random 32-byte key we generate | Supabase secret (encrypts stored tokens) |

Set them with:
```bash
npx supabase secrets set INSTAGRAM_APP_ID=... INSTAGRAM_APP_SECRET=... INSTAGRAM_REDIRECT_URI=... INSTAGRAM_TOKEN_KEY=... --project-ref iftjiddrgigqmvsdiasw
```

In the Meta app, set:
- **Redirect URI:** the callback URL in the `api` function.
- **Deauthorize callback URL** and **Data deletion request URL:** endpoints in the `api` function.

### Test before review
- Add the test accounts as Instagram testers (see the steps).
- Test: connect, list reels, import one, disconnect, token refresh (force an expiry in a test), and an account that isn't a creator (should show a clear message).
- Add the schema test cases for `instagram_accounts` RLS and the verified flag.

### App Review (submit after Phase 2 works)
- Privacy page section (done) and the data deletion URL.
- Screen recording of the connect and import flow.
- Test instructions and a test account for the reviewer.
- Request `instagram_business_basic`.

## Risks
- **Meta approval can be refused or slow.** Phase 1 keeps working without it.
- **Personal Instagram accounts can't connect.** They keep using Phase 1 with a "not verified" label.
- **Tokens are sensitive.** Stored encrypted with the key above, never logged, never sent to the browser.
- **Meta can change its API.** Keep the Instagram code in one Edge Function module so changes stay contained.
- **Deleted or private reels.** Show "reel unavailable" and never break the page.

## Order
1. Meta: business portfolio, verification, app setup (you).
2. Give me the four placeholder values through the Supabase secrets command above, not in chat.
3. Build Phase 2 (stronger model).
4. Test with testers, then submit App Review.

## Questions still open
1. Should an artist disconnect also remove the verified mark from reels they imported? (Recommended: yes, mark them unverified but keep them.)
2. Do we show the Instagram handle as verified only after connection, or also show a "verified" badge on the artist page? (Recommended: a small badge.)
