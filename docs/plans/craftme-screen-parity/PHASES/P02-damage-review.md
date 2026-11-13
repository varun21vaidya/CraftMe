# P02 Damage Report and Review pages

**Goal.** Move the two inline forms on the order page to their own routes, apply the D08 limits in the UI, in SQL and in storage, add a durable "submitted" view, and add the closed and already-reviewed views for reviews (D06).

**Coverage.** All of S14 and S15, S13.i.13, S13.i.14.

**Depends on.** P01 (order page, `useOrder` shape). **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD11.

## Paths

Existing, to modify:

- `src/pages/OrderPage.jsx` (remove `DamageForm` and the inline `ReviewForm`; keep the action links)
- `src/components/reviews/ReviewForm.jsx`
- `src/api/gateway.js` (`RPC.reportDamage`, `upload`, `allowedActions`)
- `src/lib/format.js`, `src/App.jsx`
- `supabase/schema.test.mjs`
- `supabase/functions/api/index.ts`

PROPOSED, to create:

- `supabase/migrations/0020_damage_review.sql`
- `src/pages/DamageReportPage.jsx`, `src/pages/ReviewPage.jsx`
- `src/lib/uploads.js` (per-file upload state machine), `src/lib/uploads.test.js`
- `e2e/damage.spec.js`, `e2e/review.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `report_damage`, `submit_review`, `decide_damage`, `decide_review` | `0003_logic.sql` | `report_damage` is replaced; the others are untouched here |
| `craftme_upload_damage`, `craftme_read_damage` policies, bucket `damage` | `0004_storage.sql` | Bucket limits tightened |
| `upload`, `call`, `useOrder` | `src/api/gateway.js` | |
| `ReviewForm` | `src/components/reviews/ReviewForm.jsx` | Becomes the body of `ReviewPage` |
| `buyerActions.canReportDamage`, `canReview` | `allowedActions` in `gateway.js` | Unchanged rules |
| `Dropzone`, `Field`, `RateInput`, `Timeline`, `Breadcrumbs`, `Dialog`, `useToast` | P00 | |
| `RULES.damageDays`, `RULES.reviewDays` | `src/lib/rules.js` (P00) | |

## Migration `0020_damage_review.sql`

1. `alter table public.damage_reports add column kind text not null default 'other' check (kind in ('torn','broken','water','wrong_item','other')), add column code text not null default upper(left(replace(gen_random_uuid()::text, '-', ''), 6));` and `add constraint damage_note_len check (char_length(note) <= 800)`, `add constraint damage_photo_count check (cardinality(photos) <= 6)`.
2. Replace `report_damage`: drop `(uuid, uuid[], text, text[])`, create `report_damage(p_order uuid, p_line_ids uuid[], p_note text, p_photos text[], p_kind text default 'other')`. Rules, in order:
   - line ids: at least one, no duplicates, each a `listing_id` of this order, else `invalid` `["lineIds"]`;
   - note: 1 to 800 characters after trimming, else `invalid` `["note"]`;
   - kind in the list, else `invalid` `["kind"]`;
   - photos: 2 to 6, no duplicates, each `damage/<caller id>/…`, each an existing object in bucket `damage` whose `metadata ->> 'mimetype'` is `image/jpeg` or `image/png`, else `invalid` `["photoPaths"]`;
   - then the existing checks unchanged: order found, caller is the buyer, stage `received`, no earlier report, inside the window.
   Returns `{reportId, code}`.
3. Storage: `update storage.buckets set allowed_mime_types = array['image/jpeg','image/png'] where id = 'damage';` (5 MB stays). New policy `craftme_delete_own_damage` on `storage.objects` for delete to `authenticated`: bucket `damage`, first folder is the caller's id, and the path is not in any `damage_reports.photos`.
4. `create function public.damage_orphans(p_older interval default '24 hours') returns setof text` (security definer, service role only): object names in bucket `damage` older than the interval and not referenced by any report.
5. Revoke execute from `public, anon, authenticated` on both functions; grant `report_damage` to `authenticated`; grant both to `service_role`.

The schema test has no `storage` schema today (it skips `0004_storage.sql`). Add a stand-in to `supabase/schema.test.mjs` before the migrations run: schema `storage`, tables `storage.buckets (id, name, public, file_size_limit, allowed_mime_types)` and `storage.objects (id, bucket_id, name, owner, metadata jsonb, created_at)` with RLS on, and `storage.foldername(text) returns text[]` as `string_to_array(name, '/')` without the last element. With that, `0004_storage.sql` joins the tested list as well.

Rollout: schema test, apply `0020`, deploy the Edge Function, deploy the web app. Between the migration and the web deploy the old inline form still works for reports with 2 to 5 photos and fails with `invalid` for fewer; deploy the two close together.

## Proposed interfaces

```js
// gateway.js
RPC.reportDamage = (i) => ['report_damage', { p_order: i.orderId, p_line_ids: i.lineIds, p_note: i.note, p_photos: i.photoPaths, p_kind: i.kind }];
export const removeUploads = (kind, paths) => …        // storage.from(kind).remove([...]); best effort, never throws
export const useMyReview = (orderId) => …              // the buyer's own reviews row: rating, comment, status, created_at

// src/lib/uploads.js
// items: [{ file, status: 'queued'|'uploading'|'done'|'failed', path?, error? }]
export const validateFiles = (files, { accept, maxBytes, maxFiles }) => ({ ok: File[], rejected: [{ name, reason: 'type'|'size'|'count' }] })
export async function uploadAll(items, uploadOne, { parallel = 2, onChange })   // uploads only items that are not 'done'
```

```ts
// index.ts: the single cron route, POST /api/cron?job=cleanup, with header x-cron-secret (same pattern as the retired Instagram refresh job)
// lists damage_orphans() and removes them through the storage API. Scheduled in 0030 (P11); callable by hand before that.
```

## UI specification

### S14 Damage Report, `/orders/:id/damage`

One column up to 760 px wide with a 280 px "What to expect" aside over 900 px.

**Gate before the form** (decided from the order the server returned, re-checked every 4 seconds by the `useOrder` poll):

| Order state | View |
| --- | --- |
| Loading | Skeleton |
| Not found or not the buyer's | "We couldn't find this order" and a link to My orders |
| A report exists (`damage_reports` row) | Submitted view |
| Stage is not `received` | "You can report damage once the Order is Received." and "Back to Order" |
| Past `damageWindowEnds` | "The time to report damage ended on {date}." and "Back to Order" and "Contact CraftMe" |
| Otherwise | Form |

**Form.**

- `Breadcrumbs` My orders, {code}, Report damage. Title "Report damage". Lead: "Tell us what happened and show us. CraftMe decides, usually within 2 working days."
- Window notice: "Please tell us by {damageWindowEnds}."
- "Which items are damaged?" One checkbox row per order line (photo, title, quantity, kind, line total). None is pre-checked. Helper: "Refunds are decided for each item separately."
- "Type of damage": five radios (Torn, creased or crushed; Broken or cracked; Water or moisture damage; Not the item I ordered; Something else), none pre-selected.
- "Describe it" textarea, required, 800, live counter.
- "Photos": `Dropzone`, 2 to 6, JPEG or PNG, 5 MB each. Text: "Add at least 2: the outside of the parcel, and the damage up close." Each chosen file shows a square preview with a remove button and its status. A wrong type, an oversize file or a seventh file is refused with a line naming the file and the reason; accepted files in the same batch are kept.
- "Cancel" (back to the order; removes any uploaded files) and "Send report".

**Validation on submit**, all shown together in a summary alert and inline: "Choose at least one item.", "Choose the type of damage.", "Describe what happened.", "Add at least 2 photos."

**Sending.** The button reads "Uploading photo 2 of 3…" then "Sending…". Fields are disabled. Uploads go two at a time.

| Failure | What the buyer sees | What is kept |
| --- | --- | --- |
| One or more uploads fail | That photo is marked "Didn't upload" with "Try again" on the photo and on the form | Finished uploads are kept and not sent again |
| Report call fails with `unavailable`, `internal` or no network | "We couldn't send your report. Your photos are saved. Try again." | All uploads; the retry calls only `report_damage` |
| `window_closed` | The "time ended" view | Uploaded files are removed |
| `already_exists` | The submitted view of the existing report | Uploaded files are removed |
| `wrong_stage`, `forbidden`, `not_found` | The matching gate view | Uploaded files are removed |
| `invalid` with fields | The same inline messages as client validation | Uploads kept |

Leaving the page with unsent uploads removes them (best effort). Anything left is removed by the cleanup job after 24 hours.

**Submitted view** (`S14.st.submitted`), read from the stored report, so it survives refresh and other devices: `role="status"` header "Report sent", "Reference {code}", "You'll get a notification here when we've decided." (not an email, D04). A `Timeline`: "You sent the report" with its time; "CraftMe reviews your photos"; "Decision", which becomes "Upheld. You're refunded for the damaged items." or "Not upheld" plus the Admin's note once `status` changes. "Back to Order".

### S15 Review, `/orders/:id/review`

One column, 640 px.

| Order state | View |
| --- | --- |
| A review exists | "You reviewed {artist}": stars, text, date, and a badge "Waiting for approval", "Published" or "Not published" |
| Stage `refunded` | "This Order was refunded in full, so it can't be reviewed." (D06) |
| Stage before `received` | "You can review {artist} once the Order is Received." |
| Past `reviewBy` | `S15.st.closed`: "The Review window has closed. Reviews can be written for 30 days after an Order is Received. This one closed on {date}." and "Back to Order" |
| Otherwise | Form |

**Form.** `Breadcrumbs`. Title "Review {artist}". Lead: "Reviews rate the Artist as a seller: the work as described, the packing, how they kept in touch. One Review per Order." Context block: artist, "Order {code} · Received {date} · Window closes in {n} days" (or "today"). `RateInput` labelled "Your rating", required, with "{n} of 5" beside it. Textarea "Your Review", required, 500, counter, hint "Don't include your address, phone number or links." Chips under "Good things to mention": Packed well, As described, Fast shipping, Good communication. A pressed chip appends its words as a sentence at the end; unpressing removes it; a chip that would pass 500 characters is disabled (PD11). Info alert: "Your Review appears on {artist}'s profile after CraftMe approves it. You can't edit it once sent." "Cancel" and "Send Review" ("Sending…" while saving).

Errors: missing rating "Pick a rating."; empty text "Write a few words."; `window_closed` switches to the closed view; `already_exists` switches to the reviewed view; `unavailable` keeps the text and shows "We couldn't send your Review. Try again." On success: go to `/orders` with the toast "Thanks. Your Review will appear once CraftMe approves it."

### Order page actions (S13.i.13, S13.i.14)

- "Something not right?" is drawn while `canReportDamage`. "Review {artist}" is drawn while `canReview`. Both are re-computed on every poll, so a button disappears within 4 seconds of its cut-off. A click after the cut-off lands on the gate view of the target page, never on an error.
- A partly refunded order is still `received`, so Review stays. A fully refunded order shows no Review action.

## Steps

1. Add the storage stand-in to `supabase/schema.test.mjs`, add `0004_storage` and `0020_damage_review` to the list, and add checks: 1 photo refused, 7 refused, a path in another user's folder refused, a path with no object refused, a WebP object refused, an 801-character note refused, a duplicate line id refused, a line of another order refused, a good report stored with kind and code, a second report refused, a report after the window refused, the delete policy allows an unreferenced own file and refuses a referenced one, `damage_orphans` lists only old unreferenced files.
2. Write the migration.
3. `gateway.js`: the three changes above. `uploads.js` with tests for mixed valid and invalid batches and for retrying only failed items.
4. Build `DamageReportPage.jsx` and `ReviewPage.jsx`; register `/orders/:id/damage` and `/orders/:id/review` in `App.jsx` with `signedIn`.
5. `ReviewForm.jsx`: use `RateInput`, the counter, the chips, and take `order` and `onDone` props.
6. `OrderPage.jsx`: remove `DamageForm` and the inline review; keep the two action links.
7. Edge Function: the `cleanup` job of the `/api/cron` route, refusing calls without the secret. (`/api/cron` is one route with a `job` parameter; this package adds its first job.)
8. `format.js`: reasons `already_decided`, and field-level texts for `lineIds`, `kind`, `photoPaths`.

## Mutation cases

| Mutation | Wrong role or owner | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `report_damage` | Not the buyer: `forbidden` | Window passed during upload: `window_closed`; order moved on: `wrong_stage` | Unique `(order_id)` and `already_exists`; button disabled while sending | Uploads done, call failed: uploads kept, retry sends only the call | Safe; the function is all-or-nothing | Submitted view from the stored row; an unsent draft is not kept |
| `submit_review` | Not the buyer: `forbidden` | Window passed: `window_closed` | `already_exists`; primary key `order_id` | None (single statement set) | Safe | Reviewed view from the stored row |
| Photo upload | Path outside the caller's folder is refused by the storage policy | — | A retry uploads a new object name | Orphans removed by the client, then by the job | Per file | Chosen files are lost on refresh; the buyer picks again |

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/damage.spec.js e2e/review.spec.js
```
```bash
npm run lint
```

## Completion gate

- [ ] QA-S14-01 to 08, QA-S15-01 to 06, QA-S13-09 pass.
- [ ] `git grep -n "DamageForm" src` returns nothing.
- [ ] The bucket setting was checked on the Supabase project after applying `0020` (dashboard or `select allowed_mime_types from storage.buckets where id = 'damage'`).
