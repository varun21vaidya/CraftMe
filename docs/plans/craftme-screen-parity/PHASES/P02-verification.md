# P02 verification record

Branch `craftme/p02-damage-review`, cut from `craftme/p01-cart-checkout-orders` (P01 is the prerequisite; see [P01-verification.md](P01-verification.md)).
Environment: local stack, `seed_qa.sql`, `api` function served with `PROVIDER_MODE=fake`, Playwright 1.65 on Microsoft Edge (`PW_CHANNEL=msedge`).

## Repository checks

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` | pass, 84 tests (8 new in `uploads.test.js`) |
| `npm run test:schema` | pass, 186 checks (165 before); `0004_storage` now joins the tested list via a storage stand-in |
| `npm run build` | pass |
| `npx playwright test e2e/damage.spec.js e2e/review.spec.js` (desktop light) | pass, 18 tests |
| QA-S14-01 and QA-S15-01 on all six views | pass |
| `e2e/orders.spec.js` (desktop light) | pass after one P01 assertion was updated (QA-S12-02 looked for the old inline "How was it?" heading) |
| Edge Function type check | **not run**: Deno not installed. The `cron` route ran on the local edge runtime (403 without the secret, 400 unknown job, 200 with it) |
| `git grep DamageForm src` | nothing |
| Bucket setting after applying 0020 (local) | `select allowed_mime_types from storage.buckets where id='damage'` = `{image/jpeg,image/png}`. **Not yet checked on the hosted project** (0020 is not applied there) |

## Scenarios

| ID | Result | Evidence |
| --- | --- | --- |
| QA-S13-09 | passed | `damage.spec.js`: link gone within 5 s of the cut-off; Send in the earlier tab shows the "time ended" view; no row; Review link gone after `review_by` passes |
| QA-S14-01 | passed | `damage.spec.js`, all six views |
| QA-S14-02 | passed | `damage.spec.js` (summary and inline, 800 cap, one message left) + schema (1 and 7 photos, 801 characters, no line, duplicate line, other order's line) |
| QA-S14-03 | passed | `uploads.test.js` + `damage.spec.js` (3 named refusals, 4 of 5 accepted, "up to 6", a removal frees a slot, nothing uploaded before Send) |
| QA-S14-04 | passed | runs A, B, C and the cleanup job in `damage.spec.js` (retry sends one upload; retry after a failed call sends none; Cancel leaves zero objects; 25-hour orphan removed, referenced and young files kept, wrong secret 403) |
| QA-S14-05 | passed | `damage.spec.js` (reload, second context, Admin reject shows "Not upheld" and the note; row, `open_report`, not payable) |
| QA-S14-06 | passed | `damage.spec.js` (O10 shows the submitted view; second call `already_exists`; two simultaneous calls give one row). The two-tab race was run at API level, not through two pages |
| QA-S14-07 | passed | `damage.spec.js` |
| QA-S14-08 | passed | `damage.spec.js` + schema |
| QA-S15-01 | passed | `review.spec.js`, all six views |
| QA-S15-02 | passed | `review.spec.js` + schema (rating 0 and 6, empty, 501 refused by the unchanged function) |
| QA-S15-03 | passed | `review.spec.js` |
| QA-S15-04 | passed | `review.spec.js` (needed a seeded Review for O7, added to `seed_qa.sql`) |
| QA-S15-05 | passed | `review.spec.js` |
| QA-S15-06 | **partly passed** | Badges "Waiting for approval", "Not published", "Published" and the average (only approved counts) pass. Not met: the rejection **reason** (`decide_review` has no note column; the page says only that CraftMe didn't publish it), the `review_rejected` / `review_approved` notifications (P04 step 3), and the review showing on A1's profile (the public Artist page shows no reviews until P03) |

## Changes against the plan (recorded, not product decisions)

- **`Dropzone` and `RateInput` did not exist**; P00 deferred them to this package. Both are new, with a star `Icon` fill and `upload`/`eye` icons.
- **An open form is not closed by the poll.** The plan says the gate is re-checked every 4 s, but QA-S13-09 and QA-S15-03 press Send on a form that stayed open after the cut-off. Once the form is shown, the page keeps it (the buyer's text and photos stay) and the server's answer on Send switches the view. The gate still applies on load and reload.
- `damage_reports` is one-to-one with the order, so PostgREST returns an object, not a list; `toOrder` normalises it to a list (this also fixes the order timeline for orders with a report).
- `report_damage` now returns the report's own id as `reportId` (it returned the order id) and `code`.
- "Contact CraftMe" links to `/legal/contact`, which P04 builds; it is a dead link until then.
- The per-photo and the form "Try again" both run the same send; "Send report" also works as the retry.

## Changed paths

`supabase/migrations/0020_damage_review.sql` (new), `supabase/schema.test.mjs`, `supabase/seed_qa.sql`, `supabase/functions/api/index.ts`;
`src/api/gateway.js`, `src/lib/{uploads,uploads.test}.js` (new), `src/lib/format.js`, `src/App.jsx`, `src/ui/styles.css`,
`src/components/ui/{Dropzone,RateInput}.jsx` (new), `src/components/common/Icon.jsx`, `src/components/reviews/ReviewForm.jsx`,
`src/pages/{DamageReportPage,ReviewPage}.jsx` (new), `src/pages/OrderPage.jsx`;
`e2e/{damage,review}.spec.js` (new), `e2e/orders.spec.js`.

## Migration order

`0020_damage_review.sql` only. Rollout: schema test, apply 0020, deploy the Edge Function, deploy the web app, the last two close together
(between the migration and the web deploy the old inline form fails with `invalid` for fewer than 2 photos).

## Remaining work

- Apply 0020 to the hosted project and check the bucket setting there; schedule `cleanup` (P11, migration 0030; callable by hand meanwhile).
- QA-S15-06: rejection reason (P09 admin decision with a note), review notifications (P04), review on the Artist profile (P03).
- `/legal/contact` (P04). Deno type check of the Edge Function.
