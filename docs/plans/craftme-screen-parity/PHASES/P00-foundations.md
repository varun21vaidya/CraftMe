# P00 Foundations: shared components, routes, shell, test harness

**Goal.** Give every later package the parts it needs: dialog, toast, tabs and the other UI kit components as React components; the final route map with redirects; a header and footer that can hold the new links; a provider seam with fake modes; and an end-to-end test runner.

**Coverage.** S01.i.08, SH.01, SH.02, SH.03, SH.05, SH.08, SH.09, SH.10, SH.11, SH.15, S20, S20.st.default, S20.i.01, S20.i.03, S36.dlg.kmodal, S36.dlg.kalert, S36.tab.kt1, S36.tab.kt2, S36.i.02–i.06, S36.i.08, S36.i.09, X.06, X.07, SYS.02.

**Approved 2026-11-13:** PD01 (Playwright and a local Supabase stack), PD02 (fake provider mode), PD28 (a theme switch). Docker Desktop is running (XD11 closed). Steps 1 to 11 and every later package's code can proceed without it, verified by `npm test`, `npm run test:schema` and the QA scripts run by hand. Only Gate A needs the end-to-end runner.

**Build only what has a caller.** P00 itself creates `Dialog`, `Toast`, `Menu`, `CopyButton`, `NotFound` and the theme start-up, because P00 has screens that use them. Every other component named below is created by the first package that draws it (same path, same props), so nothing is written before something calls it: `Tabs`, `Pagination`, `Stepper`, `Timeline`, `Breadcrumbs`, `QtyStepper`, `Field` in P01; `Dropzone`, `RateInput` in P02; `Stars` in P03; `CodeInput` in P05; `Chart`, `StatTile` in P07; `EmptyState` wherever a second empty state would otherwise copy the first.

## Paths

Existing, to modify:

- `src/App.jsx`
- `src/components/common/Layout.jsx`
- `src/components/common/Guards.jsx`
- `src/components/common/Icon.jsx`
- `src/components/cart/CartConflictDialog.jsx`
- `src/pages/ArtistPage.jsx` (links to `/dashboard/profile`, `/dashboard/works`)
- `src/lib/notifications.js` (`/dashboard/profile` target)
- `src/api/checkout.js`
- `supabase/functions/api/index.ts`
- `supabase/schema.test.mjs`
- `package.json`, `.env.example`, `.gitignore`

PROPOSED, to create:

- `src/components/ui/Dialog.jsx`, `Toast.jsx`, `Tabs.jsx`, `Stepper.jsx`, `Timeline.jsx`, `Pagination.jsx`, `Breadcrumbs.jsx`, `Menu.jsx`, `CopyButton.jsx`, `Field.jsx`, `QtyStepper.jsx`, `Dropzone.jsx`, `Stars.jsx`, `RateInput.jsx`, `CodeInput.jsx`, `StatTile.jsx`, `EmptyState.jsx`, `Chart.jsx`, `ThemeToggle.jsx`
- `src/lib/theme.js`, `src/lib/rules.js`
- `src/pages/NotFound.jsx`
- `supabase/functions/api/providers.ts`
- `supabase/config.toml`, `supabase/seed_qa.sql`
- `playwright.config.js`, `e2e/helpers/session.js`, `e2e/helpers/db.js`, `e2e/shell.spec.js`, `e2e/ui-kit.spec.js`

## Existing symbols to reuse

| Symbol | File | Use |
| --- | --- | --- |
| `screen`, `signedIn`, `artistOnly` | `src/App.jsx` | Wrap every new route the same way; add `adminOnly` |
| `ProtectedRoute`, `RoleRoute` | `src/components/common/Guards.jsx` | Guards; `RoleRoute` already accepts `role="admin"` |
| `ErrorBoundary` | `src/components/common/ErrorBoundary.jsx` | Unchanged |
| `Icon`, `PATHS` | `src/components/common/Icon.jsx` | Add icon paths copied from `docs/screens/ui.js` `icons` as screens need them |
| `MarketplaceSearch` | `src/components/common/MarketplaceSearch.jsx` | Unchanged; reused on the 404 page |
| `NotificationBell` | `src/components/common/NotificationBell.jsx` | Unchanged here |
| `GROUPS` | `src/lib/categories.js` | Categories menu and footer |
| `signOutUser` | `src/api/gateway.js` | Account menu |
| `useAuth` (`isArtist`, `isAdmin`) | `src/contexts/AuthContext.jsx` | Menu entries |
| `rz`, `configured`, `hmacHex`, `safeEqual` | `supabase/functions/api/index.ts` | Move `rz` behind the provider seam |
| CSS classes `.modal-backdrop`, `.modal`, `.modal-head`, `.modal-body`, `.modal-foot`, `.toasts`, `.toast`, `.tabs`, `.tab`, `.stepper`, `.timeline`, `.pagination`, `.crumbs`, `.dd`, `.menu`, `.field`, `.hint`, `.error-msg`, `.counter`, `.qty`, `.dropzone`, `.dz-previews`, `.stars`, `.rate-input`, `.otp`, `.stat`, `.empty`, `.chart`, `.kv`, `.table`, `.table-wrap`, `.shell`, `.side`, `.content` | `src/ui/styles.css` | All exist already. Do not restyle. |

## Proposed interfaces

```jsx
// Dialog.jsx
<Dialog open onClose={fn} title="Confirm it arrived?" alert={false} busy={false}
        footer={<><button>Not yet</button><button>Yes, it arrived</button></>}>…</Dialog>
// Toast.jsx
<ToastProvider>…</ToastProvider>            // mounted once in App.jsx, inside BrowserRouter
const toast = useToast(); toast('Address saved'); toast('Could not save', { kind: 'err' });
// Tabs.jsx
<Tabs label="Order filters" tabs={[{ id: 'all', label: 'All', count: 5 }]} value={id} onChange={setId} />
// Others
<Stepper steps={['Address','Pay','Done']} current={1} />
<Timeline items={[{ label, at, state: 'done'|'current'|'failed'|'future' }]} />
<Pagination page={1} pages={8} onPage={fn} label="Pagination" />
<Breadcrumbs items={[{ to: '/browse', label: 'Browse' }, { label: 'Monsoon Over Marina' }]} />
<Menu label="Account menu" button={<Avatar/>} items={[{ to, label, icon } | { onSelect, label } | 'divider']} />
<CopyButton text="CM-20418" label="Copy" />            // toast "Copied CM-20418"; on failure "Press Ctrl+C to copy …"
<Field id label hint error required counter={{ value, max }}>{input}</Field>
<QtyStepper value={2} min={1} max={12} onChange={fn} label="Quantity of Kolam at Dawn" />
<Dropzone files onChange accept="image/jpeg,image/png" maxFiles={6} maxBytes={5*1024*1024} />
<Stars value={4.9} size={14} />   <RateInput value={4} onChange={fn} labelledBy="rate-l" />
<CodeInput length={6} value onChange onComplete />
<Chart kind="line"|"bars" title labels series money height />
```

```js
// src/lib/rules.js: the one place the UI reads shop rules from (A5)
export const RULES = { holdMinutes: 15, shipDays: 7, autoReceiveDays: 14, damageDays: 3, reviewDays: 30,
  owedRestrictDays: 60, payoutDays: [1, 15], maxQty: 10, maxOpenHolds: 3 };
```

```ts
// supabase/functions/api/providers.ts
export type Mode = "live" | "fake";
export function providerMode(): Mode;      // "fake" only when PROVIDER_MODE=fake AND APP_ENV !== "production"; throws at start-up otherwise
export async function fakeRz(admin, path: string, method: "GET" | "POST", body?: unknown): Promise<any>;   // same shape rz() returns
```

## Component behaviour (applies to every screen that uses them)

**Dialog.** Built on the native `<dialog>` element opened with `showModal()`. The browser then supplies the focus trap, the inert page behind, Escape and the return of focus to the opener, so none of that is hand-written. The existing `.modal` classes go on the `<dialog>` and `.modal-backdrop` styling moves to `dialog::backdrop`. `role="alertdialog"` is set when `alert`. `aria-labelledby` the title. On open: focus the first field, or the first footer button when there is no field; for `alert`, focus the safe button ("Keep it", "Cancel"). Tab and Shift+Tab stay inside (native). Escape and the close button call `onClose`; while `busy` the dialog's `cancel` event is prevented. A click on the backdrop closes a plain dialog, never an `alert` one. On close, focus returns to the element that opened it. Page scroll is locked while open. Under 560 px the dialog is full-width with its footer buttons stacked (existing CSS at `max-width: 560px`). While `busy`, the primary button shows its saving label and both footer buttons are disabled.

**Toast.** One live region, `aria-live="polite"`; error toasts use `role="alert"`. Shown for 4 seconds, at most three at once, newest last, a close button on each. A toast is fired only after the server has answered. It never replaces an inline error next to a field.

**Tabs.** `role="tablist"`. Left and Right arrows move, Home and End jump, the selected tab has `tabIndex=0`. Counts are in a badge. When `syncParam` is given, the tab id is kept in the URL (`?tab=`), so refresh and Back restore it.

**Menu.** Button with `aria-expanded`. Opens on click, Enter, Space or Down. Up and Down move, Escape closes and returns focus, an outside click closes, choosing an item closes.

**Pagination.** Numbered links with `aria-current="page"`, Previous and Next with labels, an ellipsis past seven pages. Disabled ends are real `disabled` buttons.

**Field.** Label bound by `htmlFor`. Hint and error are joined in `aria-describedby`. An error sets `aria-invalid` and the `.has-error` class. A required field shows the `.req` star and has `aria-required`.

**Theme.** `src/lib/theme.js` reads `localStorage['cm-theme']`, applies `data-theme` on `<html>` before first paint (called at the top of `src/index.jsx`), and falls back to the system setting. `ThemeToggle` sits in the footer and in the account menu. Storage failures are ignored.

## Route map after P00

New paths render the existing pages until their package replaces them, so no link is dead at any time.

| Path | Renders in P00 | Final owner |
| --- | --- | --- |
| `/` | `Browse` | P03 `Home` |
| `/dashboard/artworks` | `MyWorks` | P06 |
| `/dashboard/artworks/new` | `NewArtwork` | P06 |
| `/dashboard/settings` | `ProfileEdit` | P07 |
| `/dashboard/instagram` | `ProfileEdit` | P08 |
| `/legal/privacy` | `Privacy` | P04 |
| `/dashboard/works` → `/dashboard/artworks`, `/dashboard/new` → `/dashboard/artworks/new`, `/dashboard/profile` → `/dashboard/settings`, `/privacy` → `/legal/privacy` | `<Navigate replace>` keeping the query string | permanent |
| `/instagram-deletion` | stays (`InstagramDeletion`); Meta's callback returns this URL (`instagram.ts` `dataDeletion`) | P04 links it from `/legal/deletion` |
| `/instagram/return` | stays | — |
| `*` | `NotFound` page | — |

## Steps

1. Commit the modified `PROJECT_BLUEPRINT.md`, `docs/adr/0004-…md` and the untracked docs. Create a branch for the package.
2. Build the components above, one file each, using the existing classes. Port the SVG chart drawing from `docs/screens/ui.js` (`data-chart`) into `Chart.jsx`; add a visually hidden table of the same numbers under each chart.
3. Replace the hand-rolled markup in `CartConflictDialog.jsx` with `Dialog`. Keep its text and its `useCart` wiring exactly (`startNewCart`, `dismissConflict`, `pending`, `locked`, `retry`, `message`).
4. `Layout.jsx`: add the Categories `Menu` (the five group names, each linking to `/browse?group=…`), the account `Menu` (My orders, Wish list, Log out; "Artist dashboard" for artists linking to `/dashboard/orders` until P07; later packages add Profile, Notifications, Become an Artist, Admin), and the footer columns (Shop: the five groups; For Artists and Help columns hold only links that exist, the rest arrive in P04 and P05). Keep the cart, wish list and bell icons and the burger menu (KD10). The burger menu closes on Escape and returns focus to its button.
5. `App.jsx`: add the alias routes and redirects from the table, `adminOnly`, the `ToastProvider`, and move `NotFound` to `src/pages/NotFound.jsx` with the reference copy ("This wall is empty."), `MarketplaceSearch`, "Go to Home" and "Browse art".
6. Update in-app links to the new paths: `Layout.jsx`, `ArtistPage.jsx` (`ownerBar`), `src/lib/notifications.js`, `NewArtwork.jsx`.
7. `Guards.jsx`: `RoleRoute` passes `state={{ from }}` like `ProtectedRoute`. A signed-in user without the role is sent to `/` with a toast "You don't have access to that page."
8. Resource pages: treat Postgres error `22P02` (bad uuid) as not found on `ArtworkPage` and `OrderPage`, reusing `isBadId` from `src/lib/artist.js`; a network error shows "We couldn't load this page" with "Try again", as `ArtistPage` already does.
9. `src/lib/rules.js` and one schema check: `supabase/schema.test.mjs` imports `RULES` from `../src/lib/rules.js` and asserts that a fresh hold lasts `holdMinutes`, `ship_by` is `shipDays` after payment, `auto_receive_at` `autoReceiveDays` after shipping, `damage_window_ends` `damageDays` and `review_by` `reviewDays` after receipt. One test ties the UI's numbers to the SQL; no separate unit test repeats the constants.
10. Provider seam: `rz()` in `index.ts` stays the one place that talks to Razorpay (it has 8 call sites today). Add one branch at its top: in fake mode it returns `fakeRz(admin, path, method, body)` from `providers.ts`. No call site changes and no wrapper type is added. `fakeRz` answers by path: `POST /orders` returns `order_fake_<uuid>`; `GET /payments/pay_fake_ok_<n>` reports `captured` with the amount of the order or fee that owns the Razorpay order id, a fee of 2.36% and method `upi`; `pay_fake_declined_<n>` reports `failed`; `POST /payments/<id>/refund` returns `rfnd_fake_<uuid>`, or throws for an id starting `pay_fake_timeout_`. `confirmPayment` accepts the signature `fake` only in fake mode.
11. `src/api/checkout.js`: when `keyId` starts with `rzp_fake`, `payWithRazorpay` opens a small `Dialog` ("Test payment window") with buttons Pay, Fail and Close that resolve the same shapes as the real handler. This branch is behind `import.meta.env.DEV`.
12. Harness: `supabase init` (creates `supabase/config.toml`), enable the email provider for local only, write `supabase/seed_qa.sql` (fixtures in [QA/README.md](../QA/README.md)), add `@playwright/test`, `playwright.config.js` (projects: desktop 1280×800, tablet 768×1024, phone 375×812, each in light and dark), and scripts `test:e2e`, `db:local`, `db:seed`.

## Mutations and their edge cases

This package adds no data mutation. Behaviour to prove:

| Case | Expected |
| --- | --- |
| `PROVIDER_MODE=fake` with `APP_ENV=production` | The function refuses to start commands: every command answers `unavailable`, reason `fake_mode_in_production` (QA-SYS-02) |
| Fake mode off and no Razorpay keys | `payments_not_configured`, as today |
| Old path with a query string | Redirect keeps it (`/privacy?x=1` → `/legal/privacy?x=1`) |
| Direct URL to an artist or admin route without the role | Redirect to `/` and a toast; the server still refuses the data |

## Verification commands

```bash
npm run lint
```
```bash
npm test
```
```bash
npm run test:schema
```
```bash
npm run build
```
```bash
npx supabase start
```
```bash
npm run db:seed
```
```bash
npx playwright test e2e/shell.spec.js e2e/ui-kit.spec.js
```

## Completion gate

- [ ] All commands above pass.
- [ ] QA-SH-01, 02, 03, 04, 06, 07, 08, QA-S20-01, QA-S20-02, QA-S36-02 to QA-S36-05, QA-X-06, QA-SYS-02 pass.
- [ ] No page in `src/pages/` or `src/components/` uses `window.confirm` for a flow this package touched (the remaining ones are replaced by their own packages: `MyWorks.jsx`, `ReelsManager.jsx`, `InstagramConnect.jsx`).
- [ ] `git grep -n "dashboard/works\|dashboard/profile\|dashboard/new\|to=\"/privacy\"\|href=\"/privacy\"" src` returns only the redirect lines in `App.jsx`.
