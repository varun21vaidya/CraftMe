# Simplification audit, 2026-11-13

A second pass over the plan with one question per item: is this the smallest change to what already exists that still meets the approved behaviour? No scenario ID, QA ID, decision, UI or accessibility behaviour, or acceptance outcome was removed. No application code was changed.

## Counts after the audit

| Item | Count |
| --- | --- |
| Screens | 36 |
| Registered states | 74 |
| Additional scenarios (26 dialogs, 19 tab panels, 303 interactions and edge cases, 15 shell, 7 kept extras, 3 system) | 373 |
| Total coverage IDs | 483 |
| Deferred | 10: `SH.13`, `S05.st.error`, `S05.i.04`, `S06`, `S06.st.default`, `S06.st.error`, `S07`, `S07.st.default`, `S07.st.sent`, `S09.i.03` |
| Built differently on purpose, still covered and tested | 8: `SH.12`, `S03.dlg.newcart`, `S05.st.default`, `S14.i.12`, `S16.i.04`, `S19.i.02`, `S26.i.05`, `S36.st.default` |
| In scope with no package or no QA script | 0 |
| QA scripts | 227 |
| Reference items with no coverage row (states, dialogs, tab panels, `data-c` components across the 36 files) | 0 |

The earlier total of "492 rows" counted the nine lines of the reasons table twice. 483 is the number of distinct IDs.

## Changelog

| # | Finding | Evidence | Change | Files |
| --- | --- | --- | --- | --- |
| 1 | The dialog component re-implemented focus trap, Escape, inert background and focus return by hand. | The platform's `<dialog>` with `showModal()` does all four. | `Dialog` is built on native `<dialog>`. Same props, same behaviour, same QA-S36-03. | P00 |
| 2 | P00 built 19 components before anything used them. | Only `CartConflictDialog`, the header and the 404 page are touched in P00. | P00 builds what it uses. Each other component is created by the first package that draws it, at the same path. | P00 |
| 3 | A provider wrapper (`makeRazorpay`, `makeEmail`, `listRefunds`) wrapped a seam that already exists. | `rz()` in `supabase/functions/api/index.ts` is already the single Razorpay call, used at 8 sites. | Fake mode is one branch at the top of `rz()`. Refund listing is one more `rz` call. Email is one `sendDueEmails` function. | P00, P07, P10, P11 |
| 4 | `rules.test.js` asserted constants equal themselves, beside a schema test of the same numbers. | Repeated test. | The schema test imports `src/lib/rules.js` and compares it with the SQL. One test. | P00, QA-S34-02 |
| 5 | Three functions were dropped and re-created to add arguments. | `place_order` already takes `p_address jsonb`; `placeOrder` already updates `orders` directly after an RPC. | `place_order` keeps its signature and reads optional keys from the JSON. `mark_paid` is untouched; the Edge Function stores the payment method. Fully additive migration. | P01 |
| 6 | A `received_by` column and a changed `_set_received` only labelled automatic receipt. | `received_at >= auto_receive_at` says the same thing from existing columns. | Column and function change removed; the label is derived. | P01, P04, P12, QA-S12-02, QA-S13-06, QA-SYS-01 |
| 7 | The payout rule existed in SQL (`payout_calc`) and again in JavaScript (`orderNet`, `estimateNet`) with a cross-check test. | Duplicate money logic. | One SQL computed field `order_net`, selected with the order. Pre-sale estimates use the existing `earnings_estimate`. | P07, QA-S24-01, QA-S25-05 |
| 8 | A server function masked payout details the Artist can already read in full. | `artist_private_read` lets the owner select their row. | `my_payout_details` removed; one `mask()` display helper. Other people still cannot read the row. | P07, COVERAGE S28.i.02, QA-S26-03, QA-S28-01 |
| 9 | `linkKind` in JavaScript mirrored a database trigger. | Rows and picker items already carry `kind` from the server. | Removed. | P08 |
| 10 | Eight Admin read functions duplicated what RLS already allows. | Every `..._read` policy in `0001_init.sql` ends with `or public.is_admin()`. | The five queue tabs, the deletion list, the order dialog and the payout lines are plain gateway selects. Only the three aggregating reads keep a function. | P09, P10, QA-S16-07, QA-S31-06 |
| 11 | Close-shop blockers and account-deletion blockers checked the same four things twice. | Same queries in two functions. | One shared `artist_obligations`. | P04, P07 |
| 12 | Three cron jobs, three routes. | All three are idempotent. | One job, one `/api/cron` route with a `job` parameter. | P02, P04, P11, QA README |
| 13 | A second Edge Function only for the WhatsApp hook. | The existing function already hosts `/webhook` and `/instagram/*`. | The hook is a route, `/api/sms-hook`. | P05 |
| 14 | A manual "Retry failed emails" button on top of six automatic retries. | Not in the reference. | Removed by the audit, then **restored**: the user chose to keep it (PD29). | P11, QA-S35-05 |
| 15 | P04 waited for all of P01, and P09 for P02. | Only one panel in each needs the other package's columns. | Dependencies loosened to that panel. Legal pages, which gate Razorpay activation, can start right after P00. | README, P04, P09 |
| 16 | Migration numbers were fixed to package order although tracks run in parallel. | Supabase applies files in name order. | Numbers are assigned at build time; shared objects use `if not exists` / `or replace`. | README |
| 17 | All packages were blocked on approving Playwright and Docker. | Only Gate A needs the runner. | PD01 gates P00 step 12 and Gate A only. | README, P00 |
| 18 | 66 reference component labels were covered by a row but not cited on it. | Two-way audit script over all 36 files. | Each label is now cited on its existing row. No ID added. | COVERAGE |

## Product decisions raised by the audit (both answered 2026-11-13)

| ID | Question |
| --- | --- |
| PD28 | Answered: **add a switch**. `ThemeToggle` stays in P00. |
| PD29 | Answered: **add the button**. Restored in P11. |

## Checked and left as it is

| Item | Why it stays |
| --- | --- |
| `fee_orders` table (P05) | A payment made on an earlier fee order is lost today. This is money, so the complete fix stays. |
| `cancelHold` (P01) | Without it a Buyer's own stale hold can block their next attempt on an Original. |
| Client plus server address validation | The server check is the trust boundary; the client check is the inline error the reference draws. |
| `owed_payments`, `audit_log`, `email_outbox` | Each is required by D10 or D04. |
| Functions that gain a defaulted trailing argument (`report`, `report_damage`, `submit_verification`, `decide_review`) | No JSON argument exists to extend. Callers by name keep working. |
| `cm-pending-order` key in `localStorage` | Replacing it with a query needs more code than the key. |

## Scenarios still lacking a concrete step

None lack an implementation step or a QA script. Three are concrete only up to an outside party:

- `S19` page text: the pages, routes and build check are specified; the wording is owed by the user (XD03).
- `S18.st.step2` real WhatsApp send (QA-S18-03) and the hook's payload format: specified against Supabase's hook, to be confirmed from its documentation at build time.
- Email idempotency key (`S35.i.01`): once-only is guaranteed in the database; whether Resend also de-duplicates is to be confirmed.

## After the audit

The user answered PD03 to PD27 on 2026-11-13. Two answers added work the audit had not planned: readable profile links, fixed once (PD22), and an Admin override for Restrictions caused by money owed (PD26). Both are in the packages and QA scripts; counts above are unchanged because no ID was added or removed.
