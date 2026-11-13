# CraftMe screen parity: implementation plan

Written 2026-11-13 from the interview log ([DECISIONS.md](DECISIONS.md)), the 36 reference screens in `docs/screens/`, and a fresh read of the code. No application code was changed to write this plan.

| File | What it holds |
| --- | --- |
| [DECISIONS.md](DECISIONS.md) | Interview decisions D01–D16, assumptions, approved deviations (KD01–KD12), plan proposals PD01–PD29, all answered (section 9), external dependencies (XD01–XD11) |
| [COVERAGE.md](COVERAGE.md) | One stable ID per screen, state, dialog, tab panel and edge case, with evidence, disposition, package and QA script |
| [PHASES/](PHASES/) | 13 work packages, P00–P12 |
| [QA/](QA/README.md) | Fixtures, harness and the scenario scripts |
| [AUDIT.md](AUDIT.md) | Simplification audit: counts, changelog, open product questions |

## 1. Git baseline

| Item | Value |
| --- | --- |
| Repository root | `artist-marketplace/` (the parent folder `CraftMe/` is not a repository) |
| Branch | `supabase-migration` |
| HEAD | `0815969cfd173e3c8a17287a6ce5ae49b7ae62d4`, "Add marketplace search, saved carts, and collection tools", 2026-11-13 03:30 +0530 |
| Modified, not committed | `PROJECT_BLUEPRINT.md` (A2, A3, A10, A11, A14, IG5, IG9 rows) and `docs/adr/0004-craftme-collects-and-pays-artists.md` (the "Amendments" section). Both are the document updates the decision log asked for. The decision log's line "No tracked file is modified" was true when it was written and is now out of date. |
| Untracked | `docs/SCREEN_COVERAGE_AUDIT.md`, `docs/SCREEN_SCENARIO_INVENTORY.md`, `docs/plans/`, `.agents/`, `.claude/`, `skills-lock.json` |
| Tests at baseline | `npm test` (vitest: `src/**/*.test.js`, `supabase/functions/**/*.test.js`), `npm run test:schema` (PGlite, `supabase/schema.test.mjs`). Not run while writing this plan. |

**First step of P00:** commit the two modified documents and the untracked docs, so every package starts from a clean tree.

## 2. Scope

In scope: all 36 screens and 74 registered states in `docs/screens/data.js`, their dialogs and tab panels, and the edge cases listed in `docs/SCREEN_SCENARIO_INVENTORY.md`, as changed by D01–D16.

Out of scope by decision:

- S06 Sign up, S07 Reset password and the email half of S05 (D01, Google-only).
- Reference review tools: the screen index, state bar, Labels mode, previous and next links, the "Design preview" strip (`docs/screens/ui.js`).
- Demo toasts, sample totals, sample names and dates (A6).
- Live provider checks. They are launch gates, section 6.

Kept although absent from the reference: wishlist and collections, global search with artist results, Saved for later, the pot branding, 21 categories and ready-made products, the reel carousel, the Meta popup flow, stale-deploy recovery. See DECISIONS.md section 5.

## 3. Source precedence

When two sources disagree, the higher one wins.

1. `DECISIONS.md` D01–D16 and accepted assumptions A1–A8.
2. ADRs in `docs/adr/` (0004 as amended), then `GLOSSARY.md`.
3. Running code: `supabase/migrations/*.sql`, `supabase/functions/api/*.ts`, `src/api/gateway.js`. This is the truth for what exists today (A10).
4. Reference markup in `docs/screens/*.html`: layout, labels, controls and states.
5. `docs/SCREEN_SCENARIO_INVENTORY.md` and `docs/SCREEN_COVERAGE_AUDIT.md`: acceptance cases.
6. `PROJECT_BLUEPRINT.md`, `docs/SYSTEM_DESIGN*.md`, feature plans: intent only. Their Firebase file and function names are not authoritative.

Reference text is a guide to wording, not final copy. Legal text (S19) must be supplied or approved by the user (D14). Numbers in the reference are fixtures unless a decision or the code confirms them.

## 4. Architecture rules every package follows

- **One seam.** Pages call `src/api/gateway.js` only. New reads are `use*` hooks built on the existing private `useQuery`. New database commands go in the `RPC` table and are called with `call(name, input)`. Commands that need Razorpay, Resend, Meta or the auth admin API go in `supabase/functions/api/index.ts` `commands`.
- **Server decides.** Money, stage, stock, role and eligibility change only inside Postgres functions (one transaction each) or the Edge Function. The UI's `buyerActions` / `artistActions` (`allowedActions` in `gateway.js`) only choose which buttons to draw.
- **Errors are codes.** Functions raise `public.fail(code, reason, extra)`. Wording lives in `src/lib/format.js` (`reasonText`, `codeText`, `errorText`). Every new reason gets a line there.
- **Idempotency.** Edge commands replay by `requestId` (`claim` in `index.ts`). A page that may retry passes the same `requestId`. Webhooks de-duplicate on `processed_events`. New money commands keep both.
- **Grants are explicit.** Every new table: RLS on, `revoke all`, then narrow grants, plus `grant all ... to service_role` (see `0013_service_role_grants.sql` for why). Every new or re-created function: `revoke execute ... from public, anon, authenticated`, then grant only to the roles that may call it. Postgres lets everyone execute a new function by default, and `0003_logic.sql` revoked only the functions that existed when it ran.
- **Migrations are additive and numbered at build time.** The file names `0019`–`0030` below are labels in the planned order. Because the tracks can be built in any order, a migration takes the next free number when its package is built, and the package document's name is updated then; Supabase applies files in name order, so a lower number must never be added after a higher one has been applied. A function gains an argument only as a defaulted trailing one (drop and create in one file), so callers by name keep working; where a `jsonb` argument already exists, new optional keys go inside it and the signature does not change (P01). `audit_log` and `artist_obligations` are needed by two tracks: each migration that needs one uses `create table if not exists` / `create or replace`. Each new file is added to the `migrations` array in `supabase/schema.test.mjs`, except files that need `pg_cron` or `pg_net`.
- **Secrets from the environment.** Never in code or `VITE_*` (D15). A provider without its secrets answers `unavailable` with a `*_not_configured` reason and the UI shows a clear "not set up yet" state.
- **Path labels.** In each package, "PROPOSED" paths do not exist yet. A path under "Existing, to modify" that carries a tag such as "(P04)" is created by that earlier package; every untagged path there exists at commit `0815969` (checked by script when this plan was written).
- **Styles exist.** `src/ui/styles.css` already contains every class in `docs/screens/styles.css` (checked by comparing class names). New components reuse those classes. Add CSS only for something the reference lacks.

## 5. Phase order and dependency graph

```
P00 foundations ──┬─> P01 cart, checkout, order pages ──> P02 damage and review
                  ├─> P03 storefront
                  ├─> P04 account, notifications, legal ──> P05 seller onboarding
                  ├─> P06 artist catalogue ──> P07 artist orders, payouts ──> P08 Instagram
                  └─> P09 admin queues, artists ──> P10 admin orders, payout run, settings   (P10 also needs P07)
Five tracks can run side by side after P00. Start P04's legal pages early: they gate Razorpay activation.
P01 + P07 + P10 ──> P11 emails
everything ──> P12 UI kit, accessibility, regression, launch checklist
```

| Package | Screens | Migration | Depends on |
| --- | --- | --- | --- |
| [P00](PHASES/P00-foundations.md) | Shell, S20, S36 primitives | none | — |
| [P01](PHASES/P01-cart-checkout-orders.md) | S08, S09, S10, S11, S12, S13 | `0019_checkout.sql` | P00 |
| [P02](PHASES/P02-damage-review.md) | S14, S15 | `0020_damage_review.sql` | P01 |
| [P03](PHASES/P03-storefront.md) | S01, S02, S03, S04 | `0021_storefront.sql` | P00 |
| [P04](PHASES/P04-account-legal.md) | S05, S16, S17, S19 | `0022_account.sql` | P00. Only its saved-address panel waits for P01's `saved_addresses`. Login, notifications and the legal pages (which Razorpay activation waits on, D14) do not. |
| [P05](PHASES/P05-seller-onboarding.md) | S18 | `0023_onboarding.sql` | P04 |
| [P06](PHASES/P06-artist-catalogue.md) | S21 (frame), S22, S23 | `0024_artist_catalogue.sql` | P00 |
| [P07](PHASES/P07-artist-orders-payouts.md) | S21, S24, S25, S26, S28 | `0025_artist_money.sql` | P06. The gift note on the pack list appears once P01's column exists. |
| [P08](PHASES/P08-instagram.md) | S27, S04 Showcase | `0026_showcase.sql` | P06 |
| [P09](PHASES/P09-admin-queues-artists.md) | S29, S30, S33 | `0027_admin_queues.sql` | P00. The damage dialog shows type and reference code once P02's columns exist. |
| [P10](PHASES/P10-admin-money-settings.md) | S31, S32, S34 | `0028_admin_money.sql` | P09, P07 |
| [P11](PHASES/P11-emails.md) | S35 | `0029_email_outbox.sql`, `0030_cron_parity.sql` | P01, P07, P10 |
| [P12](PHASES/P12-quality-launch.md) | S36, all | none | all |

### Plan status per package

"Plan" is the state of the package document. "Build" is the state of the code. Update the Build column as each completion gate passes.

| Package | Plan | Checked sections | Build |
| --- | --- | --- | --- |
| [P00](PHASES/P00-foundations.md) | Complete | paths, symbols, interfaces, routes, steps, component behaviour, cases, commands, gate | Not started. Ready to build: PD01 and PD02 are approved. |
| [P01](PHASES/P01-cart-checkout-orders.md) | Complete | all nine | Not started |
| [P02](PHASES/P02-damage-review.md) | Complete | all nine | Not started |
| [P03](PHASES/P03-storefront.md) | Complete | all nine | Not started |
| [P04](PHASES/P04-account-legal.md) | Complete | all nine | Not started |
| [P05](PHASES/P05-seller-onboarding.md) | Complete | all nine | Not started |
| [P06](PHASES/P06-artist-catalogue.md) | Complete | all nine | Not started |
| [P07](PHASES/P07-artist-orders-payouts.md) | Complete (interfaces section added in the second pass) | all nine | Not started |
| [P08](PHASES/P08-instagram.md) | Complete (interfaces section added in the second pass) | all nine | Not started |
| [P09](PHASES/P09-admin-queues-artists.md) | Complete (interfaces section added in the second pass) | all nine | Not started |
| [P10](PHASES/P10-admin-money-settings.md) | Complete (interfaces section added in the second pass) | all nine | Not started |
| [P11](PHASES/P11-emails.md) | Complete (interfaces section added in the second pass) | all nine | Not started |
| [P12](PHASES/P12-quality-launch.md) | Complete | no interfaces and no migration by design | Not started |

The nine sections are: paths to create, modify and test; existing symbols to reuse; proposed interfaces; migration and rollout; steps; UI specification; mutation or rule cases; verification commands; completion gate.

This follows the audit's five-step handoff order: buyer flow (P01, P02), public and account screens (P03–P05), artist views (P06–P08), admin (P09, P10), email and theme coverage (P11, P12). D02 moves seller onboarding from deferred into P05.

**Rollout order for every package with a migration:** (1) `npm run test:schema` green with the new file, (2) apply the migration to the Supabase project, (3) deploy the Edge Function if it changed, (4) deploy the web app. The migrations are written so the old web app keeps working after step 2 (new columns are nullable or defaulted, old function signatures stay until the next package removes them).

## 6. Release gates

A package is done when its own completion gate passes. The product is releasable when all three gates below pass.

### Gate A: build complete (developer, no live providers)

- [ ] `npm run lint`, `npm test`, `npm run test:schema`, `npm run build` all pass.
- [ ] `npm run test:e2e` passes against the local stack with `PROVIDER_MODE=fake` (PD01, PD02).
- [ ] Every COVERAGE row with disposition BUILD, WIRE, EXTEND or VERIFY has a passing QA script recorded in [QA/RESULTS.md](QA/README.md#recording-results) (proposed file, created in P12).
- [ ] Both themes at 375, 768 and 1280 px pass QA-S36-01 to QA-S36-06.

### Gate B: provider sandbox (developer plus test credentials, D15)

- [ ] Razorpay test keys: QA-S10-01 to QA-S10-08, QA-S18-05, QA-S26-04, QA-S31-03.
- [ ] Resend test key and a sandbox recipient: QA-S35-01 to QA-S35-05.
- [ ] Meta WhatsApp test number: QA-S18-03.
- [ ] Meta app in development mode with a test Instagram creator account: QA-S27-01 to QA-S27-08.

### Gate C: production launch (user, D16)

- [ ] The five legal pages are live with approved wording and reachable signed out (D14).
- [ ] Razorpay account activated. Written confirmation that CraftMe may hold Buyers' money until payout (D12, ADR-0004).
- [ ] Live Razorpay keys and webhook secret set. One real ₹1-scale order paid, refunded, and reconciled in the Razorpay dashboard.
- [ ] WhatsApp authentication template approved. "No DLT" claim and per-OTP price confirmed (D03).
- [ ] Resend sender domain verified. One of each launch email received at a real inbox.
- [ ] Google OAuth brand verification done. Meta app live, App Review passed.
- [ ] Commission and onboarding fee set to real values in S34. Demo banner off.
- [ ] `PROVIDER_MODE` unset in production. The Edge Function refuses `fake` when `APP_ENV=production` (QA-SYS-02).

If Razorpay or Meta refuses the model (D16 risk), P01, P05, P07 and P10 need rework. Nothing in this plan removes that risk.

## 7. Gaps this plan leaves open

Listed again at the end of [COVERAGE.md](COVERAGE.md#reconciliation).

1. Legal wording for S19 is not written. The user must supply it (D14).
2. Every plan proposal (PD01–PD29) has been answered by the user; DECISIONS.md section 9 records each answer. Two changed the plan: readable profile links (PD22) and the Admin override for owed Restrictions (PD26).
3. PIN-code serviceability and city or state autofill (S09) are deferred: no data source exists (PD04).
4. Short profile links are planned (PD22, P03, P07): `/artist/<slug>` redirects to the permanent `/artist/<id>`, and the Artist can change the slug. Open point: a changed slug's old link stops working (no history kept).
5. A GST tax invoice is not built. The Receipt is a printable order summary (PD08).
6. Hosted `assets/` images were not diffed against the repository (decision log open item).
7. No test was run while writing this plan, so "exists but unverified" rows stay unverified until their QA script runs.
