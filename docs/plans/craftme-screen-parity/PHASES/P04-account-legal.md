# P04 Account: login return, profile, saved address, notifications, legal pages, account deletion

**Goal.** Finish the Google-only login (return path, cancelled consent, policy acceptance), build the buyer profile with a saved address and self-serve deletion (D11), the full notifications page with every producer, and the legal hub with the seven pages Razorpay and the reference need (D14).

**Coverage.** SH.04, SH.12, S03.i.11, all in-scope rows of S05, all of S16 (S16.i.10 is finished in P09), S17, S19.

**Depends on.** P00. Only the saved-address panel (S16.dlg.addr, S16.i.03) waits for P01's `saved_addresses` and `AddressFields`; build login, notifications, legal and deletion first. **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD12, PD13, PD21, PD24, PD25.

## Paths

Existing, to modify:

- `src/components/auth/Login.jsx`, `src/components/common/Guards.jsx`, `src/contexts/AuthContext.jsx`
- `src/components/common/NotificationBell.jsx`, `src/contexts/NotificationsContext.jsx`, `src/lib/notifications.js`
- `src/components/common/Layout.jsx` (menu and footer links)
- `src/pages/Privacy.jsx` (content moves), `src/pages/InstagramDeletion.jsx` (linked from the hub)
- `src/api/gateway.js` (`signInWithGoogle`, `saveProfile`, `useNotifications`), `src/lib/format.js`, `src/App.jsx`
- `supabase/functions/api/index.ts`, `supabase/functions/api/instagram.ts`
- `supabase/schema.test.mjs`, `supabase/README.md` (redirect URL note), `package.json`

PROPOSED, to create:

- `supabase/migrations/0022_account.sql`
- `src/pages/ProfilePage.jsx`, `src/pages/NotificationsPage.jsx`, `src/pages/LegalPage.jsx`
- `src/components/account/TermsGate.jsx`, `DeleteAccountDialog.jsx`, `SavedAddressPanel.jsx`, `DeletionStatus.jsx`
- `src/content/legal/terms.jsx`, `privacy.jsx`, `refunds.jsx`, `shipping.jsx`, `contact.jsx`, `artist.jsx`, `deletion.jsx`, `index.js`
- `src/lib/returnTo.js`, `src/lib/returnTo.test.js`, `src/lib/notifications.test.js`
- `scripts/check-legal.mjs`
- `e2e/login.spec.js`, `e2e/profile.spec.js`, `e2e/notifications.spec.js`, `e2e/legal.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `signInWithGoogle`, `watchAuth`, `signOutUser`, `saveProfile`, `upload`, `markRead`, `markAllRead`, `useNotifications`, `getDeletionStatus` | `src/api/gateway.js` | |
| `ProtectedRoute`, `RoleRoute` | `Guards.jsx` | The terms gate hangs here |
| `NotificationsProvider`, `useNotificationList` | `NotificationsContext.jsx` | Bell keeps showing unread only |
| `notificationTarget`, `TEXT` | `src/lib/notifications.js`, `NotificationBell.jsx` | `TEXT` moves into the lib |
| `handle_new_user` | `0001_init.sql` | Unchanged |
| `_notify_order_stage`, `sweep` | `0003_logic.sql` | Re-created |
| `disconnect`, `dataDeletion`, `dropCover` | `supabase/functions/api/instagram.ts` | The purge inside `dataDeletion` is pulled out and shared |
| `AddressFields`, `saveAddress`, `useSavedAddress` | P01 | |
| `Dialog`, `Tabs`, `Pagination`, `Field`, `EmptyState`, `useToast`, `ThemeToggle` | P00 | |
| `RULES` | `src/lib/rules.js` (P00) | Numbers in legal text |

## Migration `0022_account.sql`

1. **Policy acceptance.** `alter table public.profiles add column terms_accepted_at timestamptz, add column terms_version text;` no client grant. `accept_terms(p_version text)` sets both for `auth.uid()`; granted to `authenticated`.
2. **Avatars.** Bucket `avatars`: public, 5 MB, JPEG or PNG. Policies: insert and delete for `authenticated` in the caller's own folder; public read.
3. **Notification producers**, all as triggers so the command functions are not edited:
   - re-create `_notify_order_stage`: Paid (buyer `order_paid`, artist `order_new`), Shipped (buyer `order_shipped`), Received (artist `order_received`; buyer `review_prompt` with `reviewBy` and `auto: true` when `received_at >= auto_receive_at`). It no longer sends `order_refunded`;
   - `refunds` after insert or update of `status`, when the new status is `issued`: buyer `refund_issued` `{orderId, code, amount}`;
   - `damage_reports` after insert: artist `damage_reported`; after `status` changes: buyer `damage_upheld` or `damage_rejected`, artist `damage_decided`;
   - `reviews` after `status` changes: buyer `review_approved` or `review_rejected`; on approval the artist gets `review_new`;
   - `payouts` after `status` becomes `sent`: artist `payout_sent` `{payoutId, net, reference}`;
   - `artist_private` after `verified_at` goes from null to a time: `artist_verified`;
   - `profiles` after `restricted` changes: `shop_restricted` or `shop_reinstated`.
   Index `notifications_unread on public.notifications (user_id) where not read`.
4. **Deletion requests.** `create table public.deletion_requests (user_id uuid primary key references public.profiles(id), scope text not null check (scope in ('everything','instagram')), status text not null default 'pending' check (status in ('pending','waiting','done','cancelled')), blockers text[] not null default '{}', requested_at timestamptz not null default now(), checked_at timestamptz, done_at timestamptz);` RLS: the owner and Admins may select. No client writes.
   - `request_deletion(p_scope text, p_confirm text)`: `p_confirm` must be exactly `DELETE`, else `invalid` `["confirm"]`. Upserts a pending row. Returns `{status, blockers}` after one immediate check.
   - `cancel_deletion()`: sets `cancelled` while the row is `pending` or `waiting` (PD24).
   - `deletion_blockers(p_user uuid) returns text[]` (internal): `buyer_open_orders` (stage `hold`, `paid`, `shipped`, or `received` with an open report or inside the damage window), plus everything `artist_obligations(p_user)` returns (one shared function, see P07 item 8; create it here if P07 is not built yet). For reference those are: `artist_open_orders` (`paid` or `shipped`), `open_reports`, `unpaid_payouts` (payable orders not yet paid out, or a draft payout), `amount_owed`.
   - `process_deletions() returns uuid[]` (service role only): for each `pending` or `waiting` request of scope `everything`: if blockers exist, store them and set `waiting`; otherwise, in one transaction, anonymise and set `done`. Anonymise means: `profiles` name to "Deleted user", photo, bio, handle, city and state emptied, roles emptied, `restricted` left as is; `saved_addresses`, `notifications`, `saved_works`, `collections`, `saved_cart_items`, `reels`, `instagram_accounts` rows deleted; `reviews.buyer_name` to "Buyer"; `order_shipping` rows of the person's finished orders deleted; the person's artworks set to `removed` and their listings to `ended`; `artist_private.payout_method` set to null (legal name and PAN are kept when the Artist ever had a payout, PD25). Orders, order lines, refunds, payouts and reviews stay. Returns the ids it finished.
5. Revoke and grant as usual; `request_deletion`, `cancel_deletion`, `accept_terms` to `authenticated`.

Edge Function: job `deletions` of the single `/api/cron` route (cron secret): calls `process_deletions()`, then for each id removes the avatar and never-sold artwork files from storage and deletes the auth user with `admin.auth.admin.deleteUser`. New command `instagramDeleteMyData` (artist only): the shared purge (imported reels, covers, token). Scheduling goes in `0030_cron_parity.sql` (P11), daily; until then it is run by hand for QA.

Rollout: schema test, apply `0022`, deploy the Edge Function, add `https://<site>/login` to the Supabase redirect list, deploy the web app.

## Proposed interfaces

```js
// gateway.js
export const signInWithGoogle = async (returnTo) => …   // stores returnTo, redirectTo: `${origin}/login`
export const useMyProfile = (uid) => …                   // profiles row incl. terms_accepted_at
export const acceptTerms = (version) => call('acceptTerms', { version })            // RPC accept_terms
export const useNotificationsPage = (uid, { filter, page }) => …                     // 20 per page, count: 'exact'
export const useDeletionRequest = (uid) => …
RPC.requestDeletion = (i) => ['request_deletion', { p_scope: i.scope, p_confirm: i.confirm }];
RPC.cancelDeletion = () => ['cancel_deletion', {}];
RPC.acceptTerms = (i) => ['accept_terms', { p_version: i.version }];
// saveProfile also accepts photoUrl, city, state

// src/lib/returnTo.js
export const rememberReturn = (path) => …   // sessionStorage 'cm-return'; only same-site paths that start with one '/'
export const takeReturn = () => path | '/'

// src/lib/notifications.js
export const notificationText = (type, data) => ({ title, detail, icon, category: 'orders'|'reviews'|'shop' })
export const notificationTarget = (type, data) => path | null     // extended for the new types

// src/content/legal/index.js
export const LEGAL_PAGES = [{ slug, title, updated, draft, Body }]   // terms, privacy, refunds, shipping, contact, artist, deletion
export const TERMS_VERSION = '2026-…'
```

## UI specification

### S05 Log in, `/login`

A centred card (420 px) and, over 900 px, a side panel with one featured artwork (photo, title and year, artist and city) linked to its page. Card: "Welcome to CraftMe", one sentence, "Continue with Google" ("Opening Google…" while starting), and a line "By continuing you agree to the Terms and Privacy policy" with links. No email fields (D01).

| Case | Behaviour |
| --- | --- |
| Arrived from a guarded page or a "log in to continue" action | The path is remembered before leaving for Google and restored after return. Unknown or off-site values fall back to `/`. |
| Already signed in | Redirect to the remembered path |
| Google could not be reached | Inline `role="alert"`: "We couldn't reach Google. Try again." |
| Consent cancelled or refused (the URL comes back with an `error` parameter or hash) | Inline alert: "Google sign-in was cancelled. Try again when you're ready." The error is removed from the address bar. |
| First sign-in | `handle_new_user` makes the profile; the terms gate appears on the first guarded screen |

### Terms gate (S05.i.06, PD21)

`Dialog` with `alert`, not dismissible by Escape or backdrop. Title "Before you continue". Checkbox "I agree to the Terms, Privacy policy and Refund policy" (three links that open in a new tab). Buttons "Log out" and "Continue" (disabled until checked; "Saving…"). It is drawn by `ProtectedRoute` whenever the signed-in profile has no `terms_accepted_at` or an older `terms_version`. Failure to save shows "We couldn't save that. Try again." and keeps the dialog.

### S16 Profile, `/profile`

Two columns over 900 px (main, 300 px aside), one below.

- **About you.** Photo with "Change photo" (JPEG or PNG, up to 5 MB; a wrong file shows "Use a JPEG or PNG up to 5 MB." and changes nothing) and "Remove". Name (required, 100). Email, read-only, "Signed in with Google. Email can't be changed here." Short bio (200, counter, "Shown next to your Reviews"). "Save changes" ("Saving…"). Success: toast "Profile saved". Failure: inline error, typed values kept. A new photo is uploaded first; if the profile save then fails, the uploaded file is removed.
- **Saved address.** The address as text, or "No saved address yet." "Edit" or "Add" opens `S16.dlg.addr`: the P01 `AddressFields` (name, phone, lines, landmark, PIN, city, state), "Cancel", "Save address". Success: toast "Address saved". "Remove" asks once in a small confirm dialog. Under it: "Used to fill Checkout. Each Order stores its own copy, so editing this never changes Orders already placed." The reference's separate Phone field lives here (PD12).
- **Sign-in.** One sentence: "You sign in with Google, so there is no CraftMe password." (D01).
- **Delete your data.** Text from the reference, then "Delete my Account" opening `S16.dlg.del`: alert dialog, "This can't be undone. You'll be logged out and your data deleted within 30 days.", input "Type DELETE to confirm". "Delete Account" stays disabled until the input is exactly `DELETE`. On confirm: `request_deletion`, sign out, go to `/`, toast "Deletion requested". If the call fails nothing is signed out and the dialog shows the error.
- **Deletion status.** A person who signs in again while a request is `pending` or `waiting` sees a banner on every page: "Your Account is set to be deleted." For `waiting`: "We can't finish yet: {reasons in words}. We'll delete it once that is settled." and "Keep my Account" (cancels, PD24).
- **Aside.** "Your roles": Buyer; Artist "not yet" with "Become an Artist" (drawn when `acceptArtists` is on and P05 has shipped) or "Artist" with "Go to my dashboard". "Shortcuts": My orders, Notifications, Privacy policy.
- Loading: skeleton. Load error: "We couldn't load your profile. Try again."

### S17 Notifications, `/notifications`

- Header "Notifications", lead, "Mark all as read" (drawn when something is unread).
- Chips, kept in `?filter=`: All, Unread {n}, Orders, Reviews. Shop notices (verification, restriction, payout) show under All and Unread.
- Groups "Today" and "Earlier" by the reader's local date. Each row: icon, title (a link to its target), one detail line, relative time ("2 h ago", then a date), a "New" badge while unread. Choosing a row marks it read, then navigates. A row whose target no longer exists goes to the list page for its kind.
- `Pagination`, 20 per page.
- `S17.st.empty`: "You're all caught up. Order updates, Review decisions and refunds appear here." with "Browse art". An empty filter with other notices present: "Nothing here."
- Loading: five skeleton rows. Error: alert with "Try again". "Mark all" failure: error toast, rows stay New.
- Bell (SH.04): unchanged list of unread items, plus a "See all" link to this page in its header.

Titles and details (data only carries ids and numbers; wording lives in `notificationText`):

| Type | Title | Target |
| --- | --- | --- |
| `order_paid` | Payment received for {code} | `/orders/:id` |
| `order_shipped` | Your Order {code} was Shipped | `/orders/:id` |
| `review_prompt` | How is your Order {code}? (auto: "{code} was marked Received") | `/orders/:id/review` |
| `refund_issued` | Refund of ₹{amount} issued for {code} | `/orders/:id` |
| `damage_upheld`, `damage_rejected` | Your Damage Report for {code} was decided | `/orders/:id/damage` |
| `review_approved`, `review_rejected` | Your Review is now public / Your Review wasn't published | `/orders/:id/review` |
| `order_new`, `ship_reminder`, `order_received`, `damage_reported`, `damage_decided` | artist wording | `/dashboard/orders/:id` (list page until P07) |
| `review_new` | You have a new Review | `/artist/:me?tab=reviews` |
| `payout_sent` | ₹{net} was paid to you | `/dashboard/payouts` (after P07) |
| `artist_verified`, `shop_restricted`, `shop_reinstated`, `instagram_reconnect` | shop wording | `/dashboard/settings`, `/dashboard/instagram` |

### S19 Legal, `/legal/:page`

One page shell with a tab row of links (Terms, Privacy, Cancellation and Refunds, Shipping, Contact, Artist agreement, Delete my data). Each tab is its own URL, so deep links work and every page is reachable signed out. `/legal` goes to `/legal/terms`. An unknown slug shows the 404 page. Each page: "Last updated {date}", headings, body. The tab row scrolls sideways under 640 px.

- Text is supplied by the user (XD03). Until then each content file exports `draft: true` and placeholder headings only. A draft page shows a visible notice in development. `scripts/check-legal.mjs` fails the production build while any page is a draft. The reference's draft wording is not copied in.
- Numbers (15 minutes, 7, 14, 3, 30 days, 1st and 15th, 60 days) are written through `RULES`, and the overdue sentence follows D05: "reviewed by CraftMe and usually refunded in full".
- **Contact** (PD13): support email from `VITE_SUPPORT_EMAIL`, business name and address lines supplied by the user.
- **Delete my data**: explains Account deletion and Instagram disconnect, links to `/profile` and `/dashboard/instagram`, and a request form. Signed in: a select "Everything" or "Only my Instagram data" and "Request deletion". "Everything" opens the same DELETE dialog as the profile. "Only my Instagram data" (shown to artists) asks once, calls `instagramDeleteMyData`, and answers "Your Instagram data was deleted." Signed out: "Log in to request deletion" (returns here). The Meta status lookup stays at `/instagram-deletion?code=…` and is linked from this page (KD07).
- Footer and header menus now link to all seven pages; the checkout and terms-gate links point here.

## Steps

1. Migration and schema checks: each trigger fires once with the right recipient; a full refund produces `refund_issued` and no `order_refunded`; `request_deletion` needs `DELETE`; blockers are reported for each case; with no blockers the profile is anonymised, the address and notifications are gone, orders and reviews remain and still add up; another user cannot read a request; `accept_terms` writes only the caller's row; avatars policy keeps users in their own folder.
2. Edge Function: the `deletions` cron job, `instagramDeleteMyData` (pull the purge out of `dataDeletion` into one function used by both).
3. `returnTo.js`, `Login.jsx`, `Guards.jsx` (remember the path, then the terms gate), `AuthContext.jsx` (expose the profile and a `reloadProfile`).
4. `ProfilePage.jsx` and its parts; route `/profile`.
5. `notifications.js` (text and targets for every type), `NotificationsPage.jsx`, bell "See all"; route `/notifications`.
6. `LegalPage.jsx`, content stubs, `check-legal.mjs`, script `build:prod` (`node scripts/check-legal.mjs && vite build`); route `/legal/:page`; move the `Privacy.jsx` text into `src/content/legal/privacy.jsx` and delete the old page.
7. `Layout.jsx`: account menu gains Profile and Notifications; footer gains the legal links.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| Save profile | RLS: own row | Last write wins | Idempotent | Photo uploaded, save failed: file removed, error shown | Values kept in the form | Reloaded from the server |
| Save address | RLS: own row | Last write wins | Idempotent | — | Dialog stays open with the values | — |
| `accept_terms` | Own row only | Newer version published meanwhile: gate shows again | Idempotent | — | Dialog stays | Gate re-evaluated from the profile |
| `request_deletion` | Own account only | Blockers appear later: status `waiting` | A second request updates the same row | Request saved but sign-out fails: banner shows on the next page | — | Banner from the stored request |
| Deletion job | Service role only | A new order arrives before the job runs: blocker | A finished request is skipped | Database step done, auth delete failed: the job retries the auth delete next run (it deletes any auth user whose request is `done`) | Daily | — |
| Mark read, mark all | RLS: own rows, `read` may only become true | — | Idempotent | Failure restores the items (existing `restore`) | — | Counts re-read every 20 s |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/login.spec.js e2e/profile.spec.js e2e/notifications.spec.js e2e/legal.spec.js
```
```bash
node scripts/check-legal.mjs
```

The last command is expected to fail until the user supplies the legal text. That failure is the gate working.

## Completion gate

- [ ] QA-S05-01 to 04, QA-S16-01 to 06, QA-S17-01 to 05, QA-S19-01 to 05 pass (QA-S19-05 passes by failing the build on draft text).
- [ ] The Supabase redirect list contains the `/login` URL for production and `http://localhost:5173/login`.
- [ ] Gate C item "legal pages live" stays open until XD03 is delivered.
