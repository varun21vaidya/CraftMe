# P00 verification record (incomplete: usage limit reached)

Branch `craftme/p00-foundations`. Plan docs committed as 662b544. Everything below is uncommitted in the working tree.

## Checks run
| Check | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` (vitest, includes new `providers.test.js`) | pass, 58 tests |
| `npm run test:schema` (includes 4 new RULES-vs-SQL checks) | pass, 135 passed |
| `npm run build` | pass |
| `git grep` for old paths in `src` | only the 3 redirect lines in `App.jsx` |
| `npx supabase start` | started in the background, not confirmed finished |
| `npx playwright test` | NOT RUN |

## Scenarios
| ID | Status | Note |
| --- | --- | --- |
| QA-SYS-02 | unit passed (`providers.test.js`); API e2e unverified | needs `supabase functions serve api` |
| QA-SH-01, 02, 03, 04, 06, 07, 08, S20-01, S20-02, S13-08, X-06 | unverified | specs written in `e2e/shell.spec.js`, never executed |
| QA-S36-02 to 05 | unverified | `e2e/ui-kit.spec.js` not written |
| QA-S36-01, S36-06 | unverified | |

## Known gaps against the plan
- Browsers: Playwright 1.65 wants Chromium rev 1254, only 1234 is cached. Use `PW_CHANNEL=msedge`.
- `.env.e2e` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `supabase status`. `QA_PASSWORD` is already set there.
- `seed_qa.sql` has only people, W1 to W8, O2 and settings. Never run: the seed and `db:seed` are untested.
- Account menu lacks Profile, Notifications, Become an Artist, Admin. Footer has no For Artists column and no `/legal/*` pages except privacy. Dialog tabs, Stepper, Pagination, Timeline and Admin routes belong to later packages.
- Artist links left the header, so Add artwork and My works are reachable only from the Artist page owner bar until P06/P07.
- `window.confirm` check and the plain-dialog case (FakePayDialog) not exercised.

## Changed paths
`src/App.jsx`, `src/index.jsx`, `src/api/checkout.js`, `src/components/common/{Layout,Guards}.jsx`, `src/components/cart/CartConflictDialog.jsx`, `src/pages/{ArtworkPage,OrderPage,ArtistPage,InstagramReturn,MyWorks}.jsx`, `src/lib/notifications.js`, `src/lib/gallery.test.js`, `src/ui/styles.css`, `supabase/functions/api/index.ts`, `supabase/schema.test.mjs`, `package.json`, `.env.example`, `.gitignore`.
New: `src/components/ui/{Dialog,Toast,Menu,CopyButton,ThemeToggle}.jsx`, `src/components/cart/FakePayDialog.jsx`, `src/lib/{rules,theme}.js`, `src/pages/NotFound.jsx`, `supabase/functions/api/providers.{ts,test.js}`, `supabase/{config.toml,seed_qa.sql}`, `playwright.config.js`, `e2e/helpers/*`, `e2e/shell.spec.js`.

## Migration order
No new migrations.
