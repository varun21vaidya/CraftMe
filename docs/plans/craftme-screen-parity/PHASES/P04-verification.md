# P04 verification record

Branch `craftme/p04-account-legal`, cut from `craftme/p03-storefront` (P00 is the prerequisite; P01's `saved_addresses` and `AddressFields` are on the same line, so the saved-address panel was built, not deferred).
Environment: local stack, `seed_qa.sql`, the `api` function served locally (`PROVIDER_MODE=fake`), Playwright 1.65 driving Microsoft Edge (`PW_CHANNEL=msedge`).

## Repository checks

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` | pass, 121 tests (new: `returnTo`, `notifications`, `legal` content and `check-legal`) |
| `npm run test:schema` | pass, 282 checks (237 before P04) |
| `npm run build` | pass; the built files contain no draft-notice text |
| `node scripts/check-legal.mjs` | fails, naming all seven pages. This is the gate working (QA-S19-05); it stays red until the legal text (XD03) is supplied |
| `npx playwright test e2e/login.spec.js e2e/profile.spec.js e2e/notifications.spec.js e2e/legal.spec.js` | desktop-light: all pass. phone-dark: 46 passed |
| Whole desktop-light suite (P00 to P04) | 154 passed, 14 failed on the first run, all by the 30 s test timeout while the machine was busy with a build; the same 14 (25 tests in those files) pass on a re-run with a 90 s timeout |
| Edge Function type check | not run (no Deno installed); the new job and command were exercised through the served function |

## Scenarios

| ID | Result | Evidence |
| --- | --- | --- |
| QA-S05-01 | passed | `login.spec.js` (card, terms links, no email or password field, featured work over 900 px only, no sideways scroll) |
| QA-S05-02 | passed (local sign-in); real Google unverified | `login.spec.js`: guarded page, heart, crafted `//evil.example`, already signed in; `cm-return` removed after use. A press of the button leaves for the Supabase authorize URL with `redirect_to=…/login` and the path remembered |
| QA-S05-03 | passed (simulated); real Google unverified | `login.spec.js`: `#error=…` and `?error=…` give the message and leave the address bar; the sign-in service blocked gives "We couldn't reach Google. Try again." and the button works again |
| QA-S05-04 | passed | `login.spec.js` (Escape and outside click keep the gate; Continue disabled until ticked; version, B2 only; a second sign-in shows no gate; failure keeps the dialog; an older version asks again). "A second insert of the same auth user makes no second profile" is covered only by the unchanged `on conflict (id) do nothing` in `handle_new_user`, not by a new test |
| QA-S16-01 | passed | `profile.spec.js` (the counter blocks at 200, see changes below) |
| QA-S16-02 | passed | `profile.spec.js` (6 MB JPEG and PDF refused; PNG saved; failed update leaves no avatar file; Remove clears `photo_url`) |
| QA-S16-03 | passed | `profile.spec.js` (PIN error and focus, saved, Checkout prefilled, O2 still 400050, Remove with confirm) |
| QA-S16-04 | passed | `schema.test.mjs` (the `anon` read is a stand-in: see changes) |
| QA-S16-05 | passed | `profile.spec.js` |
| QA-S16-06 | passed | `profile.spec.js` through the real `deletions` job: waiting with `buyer_open_orders`, banner, Keep my Account, anonymised, Orders, lines, refunds and A1's payouts unchanged, the auth user gone and sign-in refused. Blockers for each case and the anonymise step also in `schema.test.mjs` |
| QA-S16-07 | unverified | Admin queue is P09. The RLS half (another user sees only their own request) passes in `schema.test.mjs` |
| QA-S17-01 | passed | `notifications.spec.js` |
| QA-S17-02 | passed | `notifications.spec.js` |
| QA-S17-03 | passed | `notifications.spec.js` (two browser contexts; the second device's bell cleared within one 20 s poll) |
| QA-S17-04 | passed | `schema.test.mjs` (every producer once for the right person; full refund gives `refund_issued` and no `order_refunded`; auto-receive gives `auto: true`) |
| QA-S17-05 | passed | `notifications.test.js` and `notifications.spec.js` |
| QA-S19-01 | passed | `legal.spec.js` (seven pages signed out, 404, `/privacy` redirect, tab row scrolls on a phone) |
| QA-S19-02 | passed | `legal.test.jsx` (numbers follow altered `RULES`) and `legal.spec.js` |
| QA-S19-03 | passed | `legal.spec.js` (Instagram data and imports gone, pasted link kept, no `deletion_requests` row) |
| QA-S19-04 | passed | `legal.spec.js` |
| QA-S19-05 | passed | `legal.test.jsx` (script fails and names the page, then passes) and a build with no "Draft legal text" in the output |

## Changes against the plan (recorded, not product decisions)

- **Google sign-in check.** `signInWithGoogle` asks the Supabase auth service for its health first, so "We couldn't reach Google" can actually show; the browser otherwise just leaves for an error screen.
- **Bio limit.** The textarea stops at 200 characters (the counter "blocks"); the "Use 200 characters or fewer." message only appears for a longer bio saved earlier (Artists may have up to 500).
- **Listings of a deleted Artist.** Only draft and live Listings become `ended`; a sold Listing keeps its status so Order history still reads.
- **Scope.** `request_deletion` accepts only `everything`; Instagram-only deletion never creates a request (QA-S19-03).
- **Instagram reminder** still opens `/dashboard/settings`, as the existing test pins it; the plan also names `/dashboard/instagram`.
- **Artist notices** open the Orders list (and payouts too) until P07 builds their targets. "Become an Artist" follows `acceptArtists` only, as the header does, and points at `/become-artist` which P05 builds.
- **Terms columns** sit on `profiles`, which anyone can read; they carry no personal data. 
- **Seed and helper.** `signInAs` marks the fixture person as having accepted the current Terms so older scripts keep working (`{ terms: false }` leaves it); `seed_qa.sql` clears `deletion_requests` before the profiles.
- **Test stand-ins.** The in-memory schema test has no `anon` read on storage, so avatar reads are checked as a signed-in user (the policy has no role limit).
- **Local redirects.** `config.toml` lists `http://localhost:5173/login` and `http://127.0.0.1:5173/login`.

## Changed paths

`supabase/migrations/0022_account.sql` (new), `supabase/schema.test.mjs`, `supabase/seed_qa.sql`, `supabase/config.toml`, `supabase/README.md`, `supabase/functions/api/{index.ts,instagram.ts}`;
`src/api/gateway.js`, `src/App.jsx`, `src/contexts/AuthContext.jsx`, `src/components/common/{Guards,Layout,NotificationBell}.jsx`, `src/components/auth/Login.jsx`, `src/lib/{format.js,notifications.js,notifications.test.js,returnTo.js,returnTo.test.js}`, `src/ui/styles.css`,
`src/components/account/{TermsGate,DeleteAccountDialog,SavedAddressPanel,DeletionStatus}.jsx`, `src/pages/{ProfilePage,NotificationsPage,LegalPage}.jsx`, `src/content/legal/*` (seven pages, `index.js`, `version.js`, `legal.test.jsx`), `src/pages/Privacy.jsx` (deleted);
`scripts/check-legal.mjs`, `package.json` (`build:prod`), `.env.example` (`VITE_SUPPORT_EMAIL`);
`e2e/{login,profile,notifications,legal}.spec.js` (new), `e2e/helpers/session.js`.

## Migration order

`0022_account.sql` only (needs `0001` to `0021`). Rollout: schema test, apply `0022`, deploy the Edge Function (adds the `deletions` job and `instagramDeleteMyData`), add the `/login` redirect URLs, deploy the web app. Before `0022` the web app calls functions that do not exist, so apply it first. Applied only to the local stack so far.

## Remaining work

- Apply `0022` and deploy the Edge Function to the hosted project (not done).
- Add `https://<site>/login` to the hosted Supabase redirect list (dashboard step, yours to do), and set `VITE_SUPPORT_EMAIL` on Vercel.
- Run the real Google cancel and return-path checks in a sandbox.
- Legal text (XD03): until every page sets `draft = false`, `npm run build:prod` fails. Gate C "legal pages live" stays open. Use `build:prod` for the production deploy.
- Schedule the `deletions` job daily in `0030_cron_parity.sql` (P11); until then run it by hand.
- QA-S16-07 and the Admin queue (P09); Artist order, payout and review targets for notifications (P07).
