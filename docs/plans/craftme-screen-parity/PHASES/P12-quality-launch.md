# P12 UI kit sweep, accessibility, regression of kept features, launch checklist

**Goal.** Prove the whole product against COVERAGE.md: both themes at three widths, keyboard and screen-reader behaviour, the kept extras, the timed rules, and the records needed for the release gates. This package fixes what the sweep finds; it adds no feature.

**Coverage.** S36 (all rows), X.01 to X.04, SYS.01, and every VERIFY row not yet closed by its own package.

**Depends on.** All earlier packages.

## Paths

Existing, to modify (only as the sweep requires):

- `src/ui/styles.css`, any page or component with a finding
- `supabase/README.md` (final secrets and setup list), `PROJECT_BLUEPRINT.md` (status column for the rows this plan closed), `docs/SCREEN_COVERAGE_AUDIT.md` (status column)

PROPOSED, to create:

- `docs/plans/craftme-screen-parity/QA/RESULTS.md` (one line per QA script: date, commit, environment, pass or fail, note)
- `docs/LAUNCH_CHECKLIST.md` (Gate B and Gate C from the plan README, with a name and date against each line)
- `e2e/a11y.spec.js` (keyboard paths and landmark checks), `e2e/visual.spec.js` (screenshots of every route in both themes at 375, 768, 1280)
- `e2e/extras.spec.js` (wishlist, collections, search, branding), `e2e/sweep.spec.js`

## Existing symbols to reuse

| Symbol | File |
| --- | --- |
| `sweep()` | `supabase/migrations/0003_logic.sql` |
| `SavedProvider`, `useSaved`, `SaveButton`, `CollectionMenu`, `NewCollectionForm`, `WishlistPage` | `src/contexts/SavedContext.jsx`, `src/components/`, `src/pages/WishlistPage.jsx` |
| `wishlist_guard` | `supabase/migrations/0015_wishlist.sql` |
| Reference screenshots | `docs/screens/shots/light`, `docs/screens/shots/dark` (comparison aid only, not a pixel target) |

## Proposed interfaces

None. This package adds no function, command, hook or table. Its only new code is test files and the two record documents listed above. Any fix it makes uses the interfaces of the package that owns the screen.

## Migration and rollout

No migration. Fixes ship as ordinary web deploys; a fix that needs a schema change goes back to the owning package's migration number sequence as a new file after `0030`.

## The sweep

### 1. Screen matrix

For each of the 34 in-scope screens (S06 and S07 are deferred) and each registered state, open the route with the fixture named in its QA script, in light and dark, at 375 × 812, 768 × 1024 and 1280 × 800. `e2e/visual.spec.js` saves the screenshots. A person compares them with the reference file. Record in `RESULTS.md`.

Pass conditions at every size: no sideways page scroll; tables scroll inside `.table-wrap` or stack as cards; dialogs fit with their buttons reachable; sticky panels do not cover content; text does not overflow its box with a 100-character title, a 30-character unbroken word, a ₹10,00,00,000 amount, and a 60-character name; touch targets are at least 40 px.

### 2. Theme (S36.i.01, SH.09)

Every colour comes from the tokens in `src/ui/styles.css`. Text and its background meet 4.5:1 (3:1 for large text and for the edges of inputs and buttons) in both themes; check the badge, alert, chip, disabled and placeholder colours in particular. The chosen theme survives navigation and reload. Emails ignore the theme.

### 3. Keyboard and assistive technology (S36.i.09)

- Every action is reachable and usable with the keyboard alone, in a sensible order. Focus is always visible.
- Dialogs: focus moves in, stays in, Escape closes (except the terms gate and while saving), focus returns to the opener.
- Menus and tabs follow the arrow-key rules in P00.
- Each page has one `h1`, landmarks (`header`, `nav`, `main`, `footer`), and a document title naming the screen.
- Form errors are announced: the summary takes focus, each field has `aria-invalid` and a described-by message.
- Loading regions have `aria-busy`; results that arrive later are announced with `role="status"`; failures with `role="alert"`.
- Icons-only buttons have labels. Images have alt text; decorative ones have empty alt.
- With `prefers-reduced-motion: reduce`, nothing animates beyond a fade.

### 4. Kept extras (KD01 to KD12)

Run QA-X-01 to QA-X-06 and QA-SH-08. Confirm the heart, collections and Saved for later work from the new header, account menu, artwork page and artist page, and that the cart journal still replays after a reload.

### 5. Timed rules (SYS.01)

On the local stack, move the clocks by editing rows (see the helpers in [QA/README.md](../QA/README.md)) and run `select public.sweep()`. Check each rule once: expired hold releases stock; reminder two days before the deadline, once; overdue flag at the deadline; auto-receive at 14 days (`received_at >= auto_receive_at`) and a Buyer notice; payable after the damage window with no open report; restriction at 60 days owed and its lift on payment.

### 6. Copy audit

- No reference fixture text shipped: search the source for the mock's names and numbers ("Meera", "Ananya", "CM-20418", "₹499", "86 Artworks").
- No draft legal text (`node scripts/check-legal.mjs`).
- Glossary words used as defined: Buyer, Artist, Artwork, Listing, Order, Paid, Shipped, Received, Overdue, Refund, Payout, Amount Owed, Restricted.
- Every `reason` the server can raise has a line in `reasonText` (`src/lib/format.js`). A unit test lists the reasons found in the migrations and the Edge Function and fails on a missing one.

### 7. Records

- `RESULTS.md` complete for Gate A.
- `docs/LAUNCH_CHECKLIST.md` created with Gate B and Gate C lines, each naming its QA script or its external dependency (XD01 to XD11).
- `supabase/README.md` lists every secret and dashboard setting added by P00 to P11.
- `PROJECT_BLUEPRINT.md` and `docs/SCREEN_COVERAGE_AUDIT.md` status columns updated to match.

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
npm run build:prod
```
```bash
npx playwright test
```

`npm run build:prod` fails until the legal text is supplied (XD03). Use `npm run build` for Gate A and record the legal check as the one open item.

## Completion gate

- [ ] QA-S36-01 to 06, QA-X-01 to 06, QA-SYS-01 pass.
- [ ] `RESULTS.md` has a passing line for every script named in COVERAGE.md, except those marked Gate B or Gate C.
- [ ] Gate A in the plan README is fully ticked. Gates B and C are copied into `docs/LAUNCH_CHECKLIST.md` with their owners.
