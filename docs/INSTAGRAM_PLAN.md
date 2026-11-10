# Instagram for artists: full plan

Status on 11 Nov 2026 (updated): **Everything that can be built without Meta access is built and live.**
- Phase 1 fixes (1.1 to 1.4): done.
- Phase 2 code: done and deployed (migrations `0009`, `0010`; Edge Function version 4; front end on `main`). It stays **off** until the secrets in section 3.8 exist: the Connect card is hidden and the Instagram commands answer "unavailable".
- Not yet exercised against real Instagram: the OAuth flow, token exchange, media list, import, and Meta's callbacks. These need the Meta app set up (steps 2.1 to 2.4) and the secrets, then testing with tester accounts (section 3.7, manual list).
- The Meta app exists; the business portfolio is blocked until the Facebook account is older.
- Still unchecked in a real browser: all the Phase 1 and Phase 2 screens (the browser tool can't reach localhost; check on the live site once deployed).

Items marked **CODE** are code changes. Use a stronger model for them.

---

## 0. Decisions (settled)

- Google stays the only login. Instagram is an optional link added after Google sign-in. No "Sign in with Instagram".
- Phase 1 (pasted reel links) ships first and keeps working even if Meta never approves Phase 2.
- Reels show on artist and product pages only. Browse cards come in a later version.
- Limits: 12 reels per artist, 6 highlighted, one optional reel per product. One reel can be linked to several products.
- Optional artist-uploaded cover picture per reel in Phase 1. Phase 2 adds real thumbnails.
- Meta credentials live only in Supabase secrets. Never in code, `.env`, `VITE_*` variables, or chat.
- Each business gets its own Meta business portfolio; the same developer account administers all of them. CraftMe's portfolio holds only CraftMe's details.

## 0a. Open questions (recommended answers in bold)

1. When an artist disconnects Instagram, what happens to reels they imported? **Keep them, mark them unverified.**
2. Show a verified badge next to the Instagram handle on the artist page? **Yes, a small "Verified on Instagram" label.**
3. When a connected artist's token can't be refreshed, hide their imported reels? **No. Keep showing them; show the artist a "Reconnect Instagram" banner.**
4. Import only reels, or also video posts? **Reels and videos (`media_product_type` REELS, or `media_type` VIDEO). No photos.**

---

## 0b. What exists today

| Part | Where | State |
|---|---|---|
| Meta app "CraftMe" | App ID `1115039771351587`, development mode | Created; Instagram API use case added |
| Business portfolio | Meta Business Settings | Not created ("account too new"); retry later |
| `reels` table, limits, RLS | `supabase/migrations/0008_reels.sql` | Applied to production |
| Reel helper | `src/lib/reels.js` (+ test) | Done |
| Gateway | `useReels`, `useReel`, `saveReel`, `deleteReel` in `src/api/gateway.js` | Done, bug 1.1 |
| Dashboard | `src/components/dashboard/ReelsManager.jsx` inside `ProfileEdit` | Done, bugs 1.1 and 1.2 |
| Product form | Reel dropdown in `ArtworkUploadForm.jsx` | Done |
| Pages | `ReelCard.jsx` on `ArtistPage` and `ArtworkPage` | Done |
| Privacy | Instagram section in `src/pages/Privacy.jsx` | Done, wording 1.4 |
| Edge Function | `supabase/functions/api/index.ts` (Razorpay commands + webhook) | No Instagram code yet |
| Schema tests | `supabase/schema.test.mjs` | 78 pass, includes reel rules |

---

## 1. Phase 1 fixes **CODE** (do first, about 1 hour)

### 1.1 Must fix: the reel list doesn't update after a change
- **Why:** `useQuery` in `src/api/gateway.js` refreshes only every 30 seconds. After Add, Highlight, an arrow, or Remove, the list looks unchanged, so artists click again and add duplicates.
- **Change:** in `useQuery`, add a counter state and include it in the effect's dependencies. Return it as a 4th item:
  ```js
  const [tick, setTick] = useState(0);
  // effect deps: [...deps, tick]
  return [state.data, state.loading, state.error, () => setTick((n) => n + 1)];
  ```
  Existing callers read only the first three items, so they don't change.
- In `ReelsManager.jsx`: `const [reels, loading, , reload] = useReels(uid, { mine: true });` and call `reload()` after each successful add, highlight, move and remove.
- **Done when:** each action shows its result immediately.

### 1.2 Must fix: the arrows stop working after a delete
- **Why:** new reels get `position = list.length`. After a delete, two reels can share a position, and swapping equal positions does nothing.
- **Change:** in `ReelsManager.jsx` `add`, use `position: list.reduce((m, r) => Math.max(m, r.position + 1), 0)`.
- **Done when:** add 3, delete the middle one, add 1, and both arrows reorder correctly.

### 1.3 Nice to have: one error wrapper instead of two
- **Change:** in `src/api/gateway.js`, make `safe` catch with `return fromDbError(e, crypto.randomUUID())`, then delete `safeCommand` and use `safe` in `saveReel` and `deleteReel`.
- **Done when:** a 13th reel shows "You can add up to 12 reels", and profile save still works.

### 1.4 Nice to have: privacy wording
- **Change:** in `src/pages/Privacy.jsx`, "We store only the link, an optional cover picture, and the artist's own choices."

### 1.5 Checks after the fixes
- `npm test`, `npm run test:schema`, `npx eslint src`, `npm run build` all pass.
- In a real browser, as an artist: add a reel (with and without a cover), highlight 6 and try a 7th, reorder, remove, link a reel to a new product, then view the artist page and the product page and tap Watch.
- Paste a `/p/` post link and check that it plays through the `/reel/` embed address. If it doesn't, change `reelEmbedUrl` in `src/lib/reels.js` to keep the original path type.
- Ship: commit, merge to `main`, push.

---

## 2. Meta setup (you, no code)

### 2.1 Business portfolio
1. Wait until Meta allows it (the Facebook account was too new), then go to business.facebook.com and click **Create account**.
2. Name `CraftMe`, your first and last name, a business email, website `https://craftme-india.vercel.app`, CraftMe's address.
3. In the Meta app (`1115039771351587`) go to **Settings → Basic**: set **Privacy policy URL** `https://craftme-india.vercel.app/privacy` and the contact email. Save.
4. Link the app to the portfolio (**Settings → Basic → Business portfolio**), or send me the portfolio ID and I'll link it with the Meta tool.

### 2.2 Business verification (blocking for review)
5. business.facebook.com/settings → **Security Center → Start verification**. CraftMe's legal name and address as on its documents.
6. If Meta asks for a registered business and you don't have one, stop and tell me.

### 2.3 Instagram settings in the app (after Phase 2 is deployed, see 3.9)
7. **Instagram → API setup with Instagram login → Set up Instagram business login**: add the redirect URI, deauthorize URL and data-deletion URL from 3.9.
8. Copy the **Instagram app ID** and **Instagram app secret** shown there. These are not the same as the Meta app ID. Set them as secrets (3.8). Never paste them in chat.

### 2.4 Testers and accounts
9. **App roles → Roles → Add people → Instagram tester**: add your own creator account and each test artist's Instagram username.
10. Each tester accepts in the Instagram app: **Settings and activity → Apps and websites → Tester invites**.
11. Each tester's account must be **Creator** or **Business**: **Settings and activity → Account type and tools → Switch account type**.

---

## 3. Phase 2: Connect Instagram **CODE** (about 1 week, after 2.1–2.4)

### 3.1 What the artist sees
1. On **Your public profile** (dashboard), a "Connect Instagram" card with the hint "Use a creator or business account".
2. Click → Instagram's approval screen → back to the dashboard with "Connected as @handle".
3. "Import from Instagram" opens a picker: their recent reels as thumbnails, with checkboxes, showing how many slots are left (12 minus current reels).
4. Imported reels appear in the list with a "From Instagram" mark and their real thumbnail; they can be highlighted and linked to products like any other reel.
5. The handle field becomes read-only with "Verified on Instagram"; it updates from Instagram.
6. "Disconnect" removes the connection (reels stay, marked unverified).
7. If the token can't be refreshed: a "Reconnect Instagram" banner.

### 3.2 Endpoints we call (checked against Meta's docs on 11 Nov 2026; re-check when building)
| Step | Request |
|---|---|
| Ask for permission | Browser → `https://www.instagram.com/oauth/authorize?client_id=…&redirect_uri=…&response_type=code&scope=instagram_business_basic&state=…` |
| Code → short-lived token (1 hour) | `POST https://api.instagram.com/oauth/access_token` form: `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code` → `access_token`, `user_id` |
| Short → long-lived token (60 days) | `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=…&access_token=…` → `access_token`, `expires_in` |
| Refresh (token ≥ 24 h old, not expired) | `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=…` → new 60-day token |
| Who is this | `GET https://graph.instagram.com/me?fields=user_id,username,account_type&access_token=…` |
| Their media | `GET https://graph.instagram.com/me/media?fields=id,media_type,media_product_type,permalink,thumbnail_url,caption,timestamp&limit=25&access_token=…` |

Notes from the docs:
- `media_url` can be missing; use `thumbnail_url` or `permalink` instead. We never use `media_url`.
- The app secret must never reach the browser.
- Strip a trailing `#_` from the returned `code` if present (verify when building).

### 3.3 Database: migration `0009_instagram.sql` **CODE**
```sql
-- private: service role only, no client grants, RLS on with no policies
create table public.instagram_accounts (
  artist_id uuid primary key references public.profiles(id) on delete cascade,
  ig_user_id text not null unique,
  username text not null,
  token_cipher text not null,          -- AES-GCM ciphertext, base64 (iv + data)
  token_expires_at timestamptz not null,
  refreshed_at timestamptz not null default now(),
  needs_reconnect boolean not null default false,
  connected_at timestamptz not null default now()
);
alter table public.instagram_accounts enable row level security;

-- one-time OAuth states (stops forged callbacks), 10-minute life
create table public.instagram_states (
  state text primary key,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.instagram_states enable row level security;

-- Meta data-deletion requests (status page reads by code)
create table public.instagram_deletions (
  code text primary key,
  ig_user_id text not null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.instagram_deletions enable row level security;

alter table public.reels add column ig_media_id text unique, add column verified boolean not null default false;
alter table public.profiles add column instagram_verified boolean not null default false,
                            add column instagram_needs_reconnect boolean not null default false;
```
Guards (triggers, so no client can fake them):
- **Handle lock:** when `profiles.instagram_verified` is true, a change to `instagram_handle` by a client role is refused (`{"code":"invalid","reason":"handle_verified"}`). The service role can still change it.
- **Verified reel lock:** when `reels.verified` is true, a client can't change `url`. Highlight, position and cover stay editable.
- No client grants on `verified`, `ig_media_id`, `instagram_verified`, `instagram_needs_reconnect`, or the three new tables. Existing reads (`select` on `reels` and `profiles`) expose the new columns, which is fine: they hold no secrets.
- Cleanup: the sweep also deletes expired `instagram_states`.

### 3.4 Edge Function changes **CODE**
Keep Instagram code in a new module `supabase/functions/api/instagram.ts`, imported by `index.ts`. Pure helpers (no network) go in a file the tests can import.

**Routing change (important):** `Deno.serve` today refuses anything but POST. The OAuth callback is a browser **GET**. Route `GET …/instagram/callback` before the POST check.

New routes and commands:

| Route / command | Who calls it | What it does |
|---|---|---|
| command `instagramStart` | signed-in artist, `POST /api` | Creates a random `state` (32 bytes) in `instagram_states` (10 min), returns the authorize URL. |
| `GET /api/instagram/callback?code&state` | Instagram, via the browser | Looks up and deletes the state (refuse if missing or expired). Exchanges code → short token → long token. Reads `/me`. Refuses `account_type` other than creator/business with a clear reason. Encrypts the token, upserts `instagram_accounts`, sets `profiles.instagram_handle` and `instagram_verified = true`. Redirects 302 to `SITE_URL/dashboard/profile?instagram=connected`, or `?instagram=error&reason=…`. Never puts tokens in the URL. |
| command `instagramMedia` | signed-in artist | Decrypts the token, reads `/me/media`, keeps reels and videos, returns `{id, permalink, thumbnail, caption, timestamp, imported}`. No token in the response. |
| command `instagramImport {mediaIds[]}` | signed-in artist | Re-reads the artist's own media list and accepts only IDs in it (proves ownership). Copies each thumbnail into the `artworks` bucket under the artist's folder (Instagram thumbnail links expire). Inserts `reels` rows with `ig_media_id`, `verified = true`, `url = permalink`, `cover = stored copy`, `owner_confirmed = true`. The 12-reel limit still applies; return how many were added and which were refused. |
| command `instagramDisconnect` | signed-in artist | Deletes `instagram_accounts`, sets `instagram_verified = false`, `reels.verified = false` for that artist. Keeps the reels. |
| `POST /api/instagram/deauthorize` | Meta | Verifies `signed_request` (HMAC-SHA256 with the app secret, base64url), finds the account by `user_id`, does the same as disconnect. Answers 200. |
| `POST /api/instagram/data-deletion` | Meta | Verifies `signed_request`, deletes `instagram_accounts`, deletes reels with an `ig_media_id` for that user and their stored thumbnails, writes `instagram_deletions`, answers `{ "url": "SITE_URL/instagram-deletion?code=…", "confirmation_code": "…" }`. |
| `POST /api/instagram/refresh` | pg_cron (3.5) | Requires header `x-cron-secret` = `INSTAGRAM_CRON_SECRET`. Refreshes tokens that expire within 14 days and are ≥ 24 h old, at most 50 per run. On failure, sets `needs_reconnect` on the account and `instagram_needs_reconnect` on the profile, and adds a notification `instagram_reconnect`. |

Security rules for all of it:
- Token encryption: AES-256-GCM with `INSTAGRAM_TOKEN_KEY` (WebCrypto), new random IV per write.
- Never log tokens, codes, or `signed_request` bodies.
- Compare signatures with the existing constant-time `safeEqual`.
- Commands check the caller is an artist (`meta.artist`), like the other artist commands.
- Rate: `instagramMedia` reads at most one page (25 items); the picker has a "Load more" only if needed later.

### 3.5 Token refresh schedule **CODE**
- Enable `pg_net` (Supabase extension) and store `INSTAGRAM_CRON_SECRET` in Supabase Vault.
- Add to a migration: `cron.schedule('craftme-instagram-refresh', '15 2 * * *', …)` calling `net.http_post` to `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/refresh` with the secret header, read from Vault.
- Once a day is enough: tokens last 60 days and we refresh 14 days early.

### 3.6 Front end **CODE**
- `src/api/gateway.js`: thin wrappers using the existing `call()` for `instagramStart` (then `window.location.assign(url)`), `instagramMedia`, `instagramImport`, `instagramDisconnect`. No new hook needed: connection status comes from the profile (`instagramVerified`, `instagramNeedsReconnect`, `instagramHandle`).
- `ReelsManager.jsx` (or a small new `InstagramConnect.jsx` beside it): the connect card, picker, disconnect, and reconnect banner from 3.1. The picker disables checkboxes when no slots are left.
- `ProfileEdit.jsx`: read `?instagram=connected|error&reason=` once, show a message, then remove the query with `history.replaceState`. Make the handle field read-only when verified.
- `ReelCard.jsx`: verified reels say "From @handle on Instagram"; others keep "Added by the Artist".
- `ArtistPage.jsx`: "Verified on Instagram" next to the handle when `instagramVerified`.
- New public page `src/pages/InstagramDeletion.jsx` at `/instagram-deletion`: shows "Your Instagram data was deleted on <date>" for a valid code (read through a small `security definer` function that returns only the date), or "We couldn't find that request".
- `Privacy.jsx`: describe the connection: what we store (Instagram user ID, username, an encrypted access token, IDs and thumbnails of reels you import), what we don't (passwords, messages, followers), how to remove it (Disconnect, or remove CraftMe in Instagram's Apps and websites), and the deletion status page.

### 3.7 Tests **CODE**
- `supabase/schema.test.mjs` (add `0009_instagram`):
  - clients can't read or write `instagram_accounts`, `instagram_states`, `instagram_deletions`;
  - a client can't set `reels.verified`, `ig_media_id`, or `profiles.instagram_verified`;
  - the handle lock and the verified-reel URL lock refuse client changes; the service role can still make them;
  - the 12-reel limit still applies to imports.
- Unit tests (vitest) for the pure helpers in the Instagram module: `signed_request` check (good, bad signature, wrong algorithm), AES-GCM encrypt/decrypt round trip, the `#_` code clean-up, media filtering (keeps REELS and VIDEO, drops IMAGE and CAROUSEL).
- Manual with tester accounts: connect, import 3, highlight one, link one to a product, disconnect, reconnect, a personal account (clear refusal), a forged or expired `state` (refused), and a forced refresh failure (banner appears).

### 3.8 Secrets (set by you, never in chat)
```bash
npx supabase secrets set \
  INSTAGRAM_APP_ID=... \
  INSTAGRAM_APP_SECRET=... \
  INSTAGRAM_REDIRECT_URI=https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/callback \
  INSTAGRAM_TOKEN_KEY=$(openssl rand -base64 32) \
  INSTAGRAM_CRON_SECRET=$(openssl rand -hex 32) \
  SITE_URL=https://craftme-india.vercel.app \
  --project-ref iftjiddrgigqmvsdiasw
```
- The two `openssl` values are generated on your machine; keep a private copy of `INSTAGRAM_TOKEN_KEY`. Losing it means every artist must reconnect.
- `INSTAGRAM_CRON_SECRET` also goes into Supabase Vault for the cron job (3.5).
- Until these exist, the Instagram commands answer `unavailable` and the Connect card is hidden (feature off by default).

### 3.9 URLs to enter in the Meta app (step 2.3)
| Field | Value |
|---|---|
| Redirect URI | `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/callback` |
| Deauthorize callback URL | `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/deauthorize` |
| Data deletion request URL | `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/data-deletion` |
| Privacy policy URL | `https://craftme-india.vercel.app/privacy` |

If CraftMe moves to its own domain, only `SITE_URL` and the privacy URL change.

### 3.10 Deploy order
1. Migration `0009` (and the cron migration) applied with the Supabase tool, after `npm run test:schema` passes.
2. Edge Function deployed with the Supabase tool (`verify_jwt` stays off, as today).
3. Front end merged to `main` (Vercel deploys it). The Connect card stays hidden until the secrets exist.
4. You set the secrets (3.8) and the Meta URLs (3.9).
5. Test with testers (3.7, manual list).

---

## 4. App Review (you, after Phase 2 works with testers)

1. **Settings → Basic:** app icon (1024×1024), privacy policy URL, data deletion URL, category, contact email.
2. **App Review → Permissions and features:** request `instagram_business_basic`.
3. Screen recording (under 3 minutes): sign in with Google → Connect Instagram → approve → import a reel → see it on the artist page → disconnect.
4. Notes for the reviewer: "Artists choose their own reels to show on their CraftMe shop page. We read only the artist's own profile and media, after they approve. We don't post, message, or read other users." Plus step-by-step test instructions and a tester account.
5. Expect at least one round of questions. Keep Phase 1 running meanwhile.
6. After approval, switch the app to **Live** mode. Then any creator or business account can connect, not only testers.

---

## 5. Later version (not in this plan's build)

- **CODE** Reels on Browse cards (like Flipkart and Myntra): a small play badge on cards with a linked reel, opening the reel in a dialog. Keep the grid light: no embed until tap.
- **CODE** "Load more" in the Instagram picker.

---

## 6. Risks and how the plan handles them

| Risk | Handling |
|---|---|
| Meta refuses or delays review | Phase 1 keeps working; Connect stays tester-only. |
| No registered business | Verification may be blocked; tell me what Meta says. |
| Personal Instagram accounts can't connect | Clear message; they keep using pasted links. |
| Token leak | Encrypted at rest, server-only, never logged or sent to the browser. |
| Forged callback | One-time `state` with a 10-minute expiry. |
| Thumbnail links expire | Copied into our storage on import. |
| Meta changes endpoints | All calls in one module; re-check 3.2 before building. |
| Deleted or private reels | The card still shows "Open on Instagram"; the embed shows Instagram's own message. Never breaks the page. |
| Concurrent adds pass the 12 limit | Harmless at this scale (one artist editing at a time); accepted. |

---

## 7. Other open items outside Instagram (for reference)

- Domain for Google brand verification (cheapest `craftme.xyz`, about $2 the first year, $13 renewal). Waiting on your choice.
- Real money: registered business, live Razorpay keys, and deleting all demo items first (`delete from public.artworks where demo;`; items with orders need hiding instead).
- Vercel still holds unused server-side Supabase secrets from the integration; removing them in the Vercel dashboard is tidier.
- Database advisor: 17 access rules could be made faster at scale (`auth.uid()` → `(select auth.uid())`). **CODE**, low priority.

---

## 8. Full order

1. **CODE** Phase 1 fixes 1.1 and 1.2 (1.3 and 1.4 optional), browser check, ship.
2. You: business portfolio (2.1), verification (2.2), testers and creator accounts (2.4).
3. **CODE** Phase 2 (3.3–3.7), deploy (3.10 steps 1–3).
4. You: secrets (3.8) and Meta URLs (3.9, 2.3).
5. Test with testers.
6. You: App Review (4), then Live mode.
