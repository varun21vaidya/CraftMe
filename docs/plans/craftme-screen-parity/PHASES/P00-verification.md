# P00 verification record

Branch `craftme/p00-foundations` (work committed as 19c1f7d). Later fixes made while running these checks landed on
`craftme/p01-cart-checkout-orders` and are listed below. Environment as in [P01-verification.md](P01-verification.md):
local stack, `seed_qa.sql`, `api` served with `PROVIDER_MODE=fake`, Playwright driving Edge.

## Checks

| Check | Result |
| --- | --- |
| `npm run lint`, `npm test`, `npm run test:schema`, `npm run build` | pass |
| `npx supabase start` | pass after `0007` was made to skip the hosted-only `rls_auto_enable()` helper (fix on the P01 branch) |
| `npm run db:seed` | `node e2e/helpers/seed.mjs` loads `seed_qa.sql` (re-runnable); `supabase db reset` re-applies migrations |
| `npx playwright test e2e/shell.spec.js e2e/ui-kit.spec.js` | pass on desktop light; the all-views scripts were run on the other five projects (see P01 record) |

## Scenarios

| ID | Result | Note |
| --- | --- | --- |
| QA-SH-01 | passed | All views. Account menu holds what P00 builds (My orders, Wish list, Artist dashboard, theme, Log out). At 640 px and below the Wish list icon lives in the burger menu (an existing rule kept so the header fits 375 px), and under 400 px the logo word is visually hidden for the same reason |
| QA-SH-02 | passed in part | Keyboard and Log out pass. Profile, Notifications, Become an Artist and Admin entries arrive with P04, P05 and P09 |
| QA-SH-03 | passed | phone and tablet widths |
| QA-SH-04 | passed in part | Shop links and Privacy pass; the other `/legal/*` pages and "Sell your art" arrive with P04 and P05 |
| QA-SH-06 | passed in part | Visitor to login; buyer to Home with the toast and no artist data read. `/admin` routes and `admin_queue_counts` arrive with P09 |
| QA-SH-07 | passed | |
| QA-SH-08 | passed | |
| QA-S20-01 | passed | All views; the 404 page's search stays open where the header's collapses to a toggle |
| QA-S20-02 | passed | supabase-js retries a failed read three times (about 7 s) before the error view shows |
| QA-S13-08 | passed | all four order routes, see P01 record |
| QA-S36-02 | passed in part | icon-only buttons named; the field, chip, code input and dropzone checks belong to the packages that build those screens |
| QA-S36-03 | passed | alert dialog (cart switch) and plain dialog (test payment window); Escape, backdrop, focus return, scroll lock, full width at 375 px |
| QA-S36-04 | passed in part | errors as alerts, at most three, close button, gone after about 4 s. A success toast after a server answer is covered by P01 ("New prices accepted", "Marked as Received") |
| QA-S36-05 | passed (P01) | tabs, pagination, stepper, timeline, breadcrumbs exercised by P01 specs |
| QA-S36-01, QA-S36-06 | unverified | `e2e/visual.spec.js` is P12 |
| QA-X-06 | passed in part | public header; the artist and admin shells arrive with P06/P07 and P09 |
| QA-SYS-02 | passed | unit (`providers.test.js`) and API (`e2e/provider-modes.spec.js`, function served with `PROVIDER_MODE=fake APP_ENV=production`, and without fake mode) |

## Changes against the plan

- `Dialog` wraps Tab itself: the native `<dialog>` does not keep Tab inside in Chromium.
- `ToastProvider` sits inside `BrowserRouter` and outside `AuthProvider`, so the guards and the Cart can use it.
- Hosted-only `rls_auto_enable()` guarded in `0007` so the local stack starts.

## Remaining work

Entries that belong to later packages, as listed above.
