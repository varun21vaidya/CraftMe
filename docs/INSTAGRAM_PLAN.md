# Instagram for artists: full plan

Status on 11 Nov 2026 (updated again): **Phase 2 was rewritten for Unified Login and is deployed.** It stays **off** until the secrets below exist.

Why the rewrite: Meta says "API setup with Instagram login is not available for newer apps"; this app must use **Unified login** (Facebook Login for Business). That flow has a different dialog, token exchange, token type and API host. See section 3.
- Phase 1 and its fixes: done, live.
- Phase 2 code for Unified Login: done and deployed (migrations `0009`, `0011`; `0010`/`0012` added then removed a refresh job; Edge Function version 5).
- Meta app: created (ID `1115039771351587`), Instagram use case added, Unified login configuration created (config ID `1687288436092442`) with the redirect URL saved. The config should request only `instagram_basic`.
- Not yet exercised against real Meta: the login, the token exchange, the account list, the media list, import, and the two Meta callbacks. They need the secrets (3.8), the callback URLs in the app settings (3.9) and a tester account.
- Still unchecked in a real browser: all Phase 1 and Phase 2 screens.

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
3. When a connected artist's token stops working, hide their imported reels? **No. Keep showing them; show the artist a "Reconnect Instagram" banner (done).**
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

### 2.3 Unified login configuration (done by you on 11 Nov 2026; check it)
7. **Use cases → Manage messaging & content on Instagram → Customize → API setup with Unified login.** The configuration `1687288436092442` exists with the redirect URL saved. Make sure its permissions are only `instagram_basic` (remove ads, messages, comments and publish) and the asset is the Instagram account only.
8. Copy the **Meta app ID and app secret** from **App settings → Basic** (not an "Instagram app ID", which this app doesn't have). Set them as secrets (3.8). Never paste them in chat.
9. Enter the deauthorize and data-deletion URLs from 3.9 in the app settings.

### 2.4 Testers and accounts
10. **App roles → Roles → Add people → Instagram tester**: add your own creator account and each test artist's Instagram username.
11. Each tester accepts on Instagram **on the web**: Settings → Website permissions → Apps and websites → Tester invites. (Test users aren't supported: testers need a real Instagram professional account.)
12. Each tester's account must be **Creator** or **Business**: **Settings and activity → Account type and tools → Switch account type**.

---

## 3. Phase 2: Connect Instagram (Unified Login) **CODE: done**

### 3.1 What the artist sees
1. On **Your public profile**, an Instagram card: "Connect Instagram" with the hint "Use a creator or business account".
2. Click: the Meta login window (Instagram or Facebook login, then pick the Instagram account to share). Back to the dashboard with "Instagram connected."
3. "Import from Instagram": a picker of recent reels with thumbnails and the free-slot count.
4. Imported reels carry "Verified on Instagram". The handle becomes read-only and verified.
5. "Disconnect" unlinks (reels stay, unverified). If the token stops working: a "Reconnect Instagram" banner.

### 3.2 Flow (checked against Meta's docs on 11 Nov 2026; confirm when testing)
| Step | Call |
|---|---|
| Dialog | Browser to `https://www.facebook.com/dialog/oauth?client_id=<META_APP_ID>&config_id=<CONFIG_ID>&redirect_uri=<our callback>&response_type=code&override_default_response_type=true&state=<one-time state>&prompt=login` |
| Code to token | `GET https://graph.facebook.com/v26.0/oauth/access_token?client_id&client_secret&code` (Meta app ID and secret, not an "Instagram app ID") |
| Business id | `GET /v26.0/me?fields=client_business_id` |
| Accounts shared | `GET /v26.0/me/assigned_instagram_accounts?fields=id,username` (needs `instagram_basic`) |
| Media | `GET /v26.0/<instagram account id>/media?fields=id,media_type,media_product_type,permalink,thumbnail_url,caption,timestamp&limit=50` |

Notes:
- The token is a business-level "system user" token. **It never expires** with the default configuration, so there is no refresh job. It stops working if the client removes the app or moves the account (error code 190); we then mark the artist "needs reconnect".
- If the artist shares several accounts, only the first is used (documented shortcut).
- The token exchange follows Meta's guide (no `redirect_uri`); on a 400 the code retries once with it (documented shortcut; drop one after testing).
- Meta also lists a webhook endpoint as a requirement of the Unified Login setup. We request no messages or comments permissions, so it should not be needed. Confirm during App Review.

### 3.3 Database (done)
- `0009_instagram.sql`: private `instagram_accounts`, `instagram_states`, `instagram_deletions` (no client access); `reels.ig_media_id`, `reels.verified`; `profiles.instagram_verified`, `profiles.instagram_needs_reconnect`; locks so a client can't change a verified handle or reel link; `instagram_deletion_status(code)` for the public status page.
- `0011_instagram_unified.sql`: `token_expires_at` is now optional; adds `client_business_id` and `app_user_id`.
- `0010` added a daily refresh job; `0012` removed it (tokens don't expire).

### 3.4 Server (done): `supabase/functions/api/instagram.ts` (+ `instagram_pure.js`)
- Commands: `instagramStatus`, `instagramStart`, `instagramMedia`, `instagramImport`, `instagramDisconnect`.
- Routes: `GET /instagram/callback` (browser), `POST /instagram/deauthorize` and `POST /instagram/data-deletion` (Meta, `signed_request` checked with the Meta app secret; matched by the account id or the app-scoped id, confirm which Meta sends).
- Tokens encrypted with AES-256-GCM (`INSTAGRAM_TOKEN_KEY`), never logged, never sent to the browser. One-time `state` (10 minutes) against forged callbacks. Import accepts only media the artist's own account returned, and copies thumbnails into our storage.

### 3.5 Front end (done)
`InstagramConnect.jsx` (connect card, picker, disconnect, reconnect banner), verified labels on `ReelCard` and the artist page, read-only verified handle, result message on the profile page, `/instagram-deletion` status page, privacy text.

### 3.6 Tests (done)
14 unit tests (signed request, token encryption, dialog URL, media filter) and 92 database checks.

### 3.7 Manual test with a tester account (after 3.8 and 3.9)
Connect, list reels, import 2, highlight one, link one to a product, disconnect, reconnect, and remove CraftMe in Instagram's Apps and websites (the deauthorize callback should clear it).

### 3.8 Secrets (you; never in chat or git)
```bash
npx supabase secrets set META_APP_ID=... META_APP_SECRET=... INSTAGRAM_CONFIG_ID=1687288436092442   INSTAGRAM_REDIRECT_URI=https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/callback   SITE_URL=https://craftme-india.vercel.app --project-ref iftjiddrgigqmvsdiasw
npx supabase secrets set INSTAGRAM_TOKEN_KEY=$(openssl rand -base64 32) --project-ref iftjiddrgigqmvsdiasw
```
`META_APP_ID` and `META_APP_SECRET` are on **App settings, Basic**. Keep a private copy of `INSTAGRAM_TOKEN_KEY`: losing it means every artist must reconnect. The earlier `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` and `INSTAGRAM_CRON_SECRET` are no longer used, and there is no Vault entry to create.

### 3.9 Settings in the Meta app (you)
| Where | Value |
|---|---|
| Unified login configuration: Redirect URL | `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/callback` (saved) |
| Configuration permissions | only `instagram_basic`; Instagram account as the asset; no ad account |
| App settings, Basic: Privacy policy URL | `https://craftme-india.vercel.app/privacy` |
| App settings, Basic: User data deletion URL | `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/data-deletion` |
| Deauthorize callback URL (app settings) | `https://iftjiddrgigqmvsdiasw.supabase.co/functions/v1/api/instagram/deauthorize` |

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
