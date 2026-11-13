# P09 Admin shell, overview, queues and artists

**Goal.** Give the Admin a role-gated area: the shell (SH.07), the overview (S29), the five queues with their decisions (S30), the artist list with Restrict and Lift (S33), and the list of pending deletion requests (S16.i.10). Read screens come first, then the decisions, as the audit's handoff order asks.

**Coverage.** SH.07, all of S29, S30 (S30.i.07 is finished in P10), S33, S16.i.10.

**Depends on.** P00 only. The damage dialog shows the report's type and code once P02's columns exist. `audit_log` is created with `create table if not exists` (the same statement is in P07's migration). **Decisions used (all answered 2026-11-13, see DECISIONS.md section 9):** PD10, PD15, PD16, PD26.

## Paths

Existing, to modify:

- `src/App.jsx` (admin routes, `adminOnly`), `src/api/gateway.js` (`RPC.decideDamage`, `decideReview`, `markVerified`, `restrictArtist`), `src/lib/format.js`, `src/lib/notifications.js`
- `supabase/functions/api/index.ts` (`issueRefund`, new `decideDamage`)
- `supabase/schema.test.mjs`

PROPOSED, to create:

- `supabase/migrations/0027_admin_queues.sql`
- `src/components/common/AdminShell.jsx`
- `src/pages/admin/AdminOverview.jsx`, `AdminQueues.jsx`, `AdminArtists.jsx`
- `src/components/admin/DamageDialog.jsx`, `OverdueRefundDialog.jsx`, `ReviewRejectDialog.jsx`, `ReviewEditDialog.jsx`, `TakedownDialog.jsx`, `VerificationDialog.jsx`, `RestrictDialog.jsx`, `LiftDialog.jsx`, `QueueTable.jsx`
- `e2e/admin-queues.spec.js`, `e2e/admin-artists.spec.js`, `e2e/admin-access.spec.js`

## Existing symbols to reuse

| Symbol | File | Note |
| --- | --- | --- |
| `is_admin()` | `0001_init.sql` | Every new function checks it |
| `decide_damage`, `decide_review`, `mark_verified`, `restrict_artist`, `_set_standing`, `reserve_refund`, `confirm_refund`, `mark_refund_unknown`, `sweep` | `0003_logic.sql` | Re-created where stated |
| `commands.issueRefund`, `requireRole`, `rpc` | `supabase/functions/api/index.ts` | The provider half of a refund is shared with the new damage command |
| `RoleRoute` (`role="admin"`), `useAuth().isAdmin` | `Guards.jsx`, `AuthContext.jsx` | |
| Policy `craftme_read_damage` | `0004_storage.sql` | Admins read damage photos through signed URLs |
| `Tabs`, `Dialog`, `Pagination`, `StatTile`, `Chart`, `Stars`, `EmptyState`, `useToast` | P00 | |
| `GROUPS` | `src/lib/categories.js` | Orders-by-category chart groups |

## Migration `0027_admin_queues.sql`

Every function below is security definer, starts with `if not public.is_admin() then perform public.fail('forbidden')`, and writes an `audit_log` row (actor, action, target, note).

1. **Overdue (D05).** `alter table public.orders add column ship_extended boolean not null default false;` `extend_ship_deadline(p_order uuid)`: stage must be `paid`; already extended fails `conflict` `already_extended`; adds 2 days to `ship_by`, clears `overdue` and `reminded`, sets `ship_extended`; notifies the Artist and the Buyer (`ship_extended`).
2. **Damage.** Re-create `decide_damage` (same signature): the note is now required (1 to 500), for both decisions. New `uphold_damage(p_order uuid, p_note text, p_admin uuid) returns jsonb` (service role, called by the Edge command): in one transaction marks the report `upheld` with the note and reserves a refund for the full remaining quantity of every line in the report's `line_ids` (the same rules as `reserve_refund`, reason "Damage Report upheld"). Returns `{refundId, amount, paymentId}`. A report that is not `open` fails `already_decided`.
3. **Reviews.** `alter table public.reviews add column reject_reason text check (reject_reason in ('personal_details','abusive','off_topic')), add column original_comment text;` Replace `decide_review`: drop `(uuid, text)`, create `decide_review(p_order uuid, p_decision text, p_reason text default null, p_edited text default null)`. Rejecting needs a reason. Approving with `p_edited` (1 to 500) stores the old text in `original_comment` and publishes the edited text (PD10). Column grants: `revoke select on public.reviews from authenticated;` then `grant select (order_id, artist_id, buyer_id, rating, comment, buyer_name, status, created_at, decided_at, reject_reason) on public.reviews to authenticated;` so the original text is never readable by a client.
4. **Reports and takedown.** `alter table public.reports add column resolution text check (resolution in ('dismissed','taken_down','restricted')), add column note text not null default '', add column resolved_at timestamptz, add column resolved_by uuid;` `alter table public.artworks add column takedown_reason text;` `resolve_report(p_report uuid, p_action text, p_note text)`: `dismiss` closes it; `takedown` (artwork targets only, note required) sets the artwork `removed`, its listings `ended`, stores the reason, notifies the Artist (`artwork_taken_down`); `restricted` records that the Admin restricted the Artist through `restrict_artist`. Every open report on the same target is closed with the same resolution.
5. **Verification.** `alter table public.artist_private add column changes_requested text, add column changes_requested_at timestamptz;` `request_verification_changes(p_artist uuid, p_note text)`: note required; notifies the Artist (`verification_changes`). A trigger clears both columns when the Artist changes `legal_name`, `pan` or `payout_method`. Re-create `mark_verified` (same signature) to refuse an Artist with no submitted details and to write the audit row.
6. **Restriction.** `alter table public.artist_private add column owed_override_since timestamptz;` Re-create `restrict_artist` (same signature): a note is required for lifting as well; restricting an already restricted Artist appends the reason; lifting an unrestricted Artist changes nothing. Lifting a Restriction whose reasons include `owed_60_days` while money is still owed is **allowed** (PD26, answered: Admin override): it sets `owed_override_since = owed_since`, which marks this debt as overridden. Re-create `sweep` (same signature) so the 60-day rule skips an Artist whose `owed_override_since` equals their current `owed_since`. `owed_since` is cleared when the balance reaches zero and set afresh by the next debt, so a **new** debt gets its own 60-day clock and can restrict again; more money added to the same unpaid debt does not.
7. **Reads.** The existing policies already let an Admin select every row of `orders`, `order_lines`, `order_shipping`, `damage_reports`, `refunds`, `reviews`, `reports`, `artist_private`, `payouts` (each `..._read` policy in `0001_init.sql` ends with `or public.is_admin()`), and `deletion_requests` (P04). So the five queue tabs and the deletion list are plain gateway selects with embeds, exactly like the existing buyer and artist hooks. No queue read function is created. Only three reads need SQL, because they aggregate:
   - `admin_overview(p_days integer)`: for the period and the equal period before it: orders paid, amount paid, refunds, commission (`commission_of` on price after refunds at each order's rate), the net payable now; 8 weekly points of paid and commission; orders per category; the next payout date; Artists whose Amount Owed is 45 days old or more (name, amount, day number). Periods are whole days in Asia/Kolkata. `p_days` is 7, 30, 90 or 365.
   - `admin_queue_counts()`: count and oldest age for damage (open), overdue (`overdue` and `paid`), reviews (pending), reports (open), verification (details submitted, fee paid, not verified), plus deletion requests waiting.
   - `admin_artists(p_filter text, p_q text, p_page integer)`: 20 per page with a total and the four filter counts: joined, verified or waiting, orders, rating, overdue orders in the last 30 days, Amount Owed and its age, restricted with the newest reason. No PAN and no payout destination.
   For the damage dialog's "Artist history" the page asks for two counts (`orders` with `shipped_at` not null, `damage_reports` with status `upheld`) with `head: true, count: 'exact'`.
8. Revoke and grant: every function to `authenticated` (the Admin check is inside) except `uphold_damage` (service role only).

Edge Function: `decideDamage` (Admin): `{orderId, decision, note}`. Rejected: calls `decide_damage`. Upheld: `uphold_damage`, then the same provider step as `issueRefund` (refund through Razorpay, `confirm_refund`, or `mark_refund_unknown` on an error). The response says which: `{status: 'upheld', refund: 'issued' | 'unknown', amount}`.

Rollout: schema test, apply `0027`, deploy the Edge Function, deploy the web app. Grant yourself the Admin claim once with the existing `setRole` path or the Supabase dashboard (A3).

## Proposed interfaces

```js
// src/api/gateway.js: database commands
// RPC.decideDamage is removed from the RPC table: 'decideDamage' becomes an Edge command, because upholding may refund
RPC.decideReview  = (i) => ['decide_review', { p_order: i.reviewId, p_decision: i.decision, p_reason: i.reason ?? null, p_edited: i.edited ?? null }];
RPC.markVerified  = (i) => ['mark_verified', { p_artist: i.uid }];                                                   // unchanged
RPC.requestVerificationChanges = (i) => ['request_verification_changes', { p_artist: i.uid, p_note: i.note }];
RPC.restrictArtist = (i) => ['restrict_artist', { p_artist: i.artistId, p_restricted: i.restricted, p_reason: i.reason ?? '' }];   // unchanged; the reason is now required both ways
RPC.extendShipDeadline = (i) => ['extend_ship_deadline', { p_order: i.orderId }];
RPC.resolveReport = (i) => ['resolve_report', { p_report: i.reportId, p_action: i.action, p_note: i.note ?? '' }];

// reads (Admin only; each wraps one read function)
export const useAdminOverview = (days) => …                 // admin_overview
export const useAdminQueueCounts = () => …                  // admin_queue_counts; polls 30 s (shell badge)
export const useAdminQueue = (tab) => …                     // 'dmg' | 'over' | 'rev' | 'rep' | 'ver' -> a direct select (RLS admits Admins), oldest first:
//   dmg: damage_reports(*, order:orders(code, total, shipped_at, received_at, order_lines(*), buyer:profiles!buyer_id(display_name), artist:profiles!artist_id(display_name))) where status = 'open'
//   over: orders(..., buyer:..., artist:...) where stage = 'paid' and overdue
//   rev: reviews(*, order:orders(code), artist:profiles!artist_id(display_name)) where status = 'pending'
//   rep: reports where status = 'open', then one profiles or artworks lookup for the target names
//   ver: artist_private(*, profile:profiles(display_name, city)) where verified_at is null and onboarding_paid_at is not null
export const useAdminArtists = ({ filter, q, page }) => …   // admin_artists -> { total, counts, items }
export const useAdminDeletionRequests = () => …             // direct select on deletion_requests where status in ('pending','waiting')
export const signedDamagePhoto = (path) => …                // 'damage' bucket, 1-hour signed URL (policy craftme_read_damage)
```

```ts
// supabase/functions/api/index.ts
decideDamage  { orderId, decision: 'upheld' | 'rejected', note }
              -> { status: 'rejected' } | { status: 'upheld', refund: 'issued' | 'unknown', amount }
              | conflict "already_decided" | invalid { fields: ['note' | 'decision'] } | unavailable "payments_not_configured" (uphold only)
async function sendRefund(refundId: string, paymentId: string, amount: number): Promise<'issued' | 'unknown'>   // the provider half, shared with issueRefund
```

```sql
-- 0027_admin_queues.sql
extend_ship_deadline(p_order uuid) returns jsonb
decide_damage(p_order uuid, p_decision text, p_note text default '') returns jsonb            -- same signature; the note is now required
uphold_damage(p_order uuid, p_note text, p_admin uuid) returns jsonb                          -- service_role: { refundId, amount, paymentId }
decide_review(p_order uuid, p_decision text, p_reason text default null, p_edited text default null) returns jsonb
resolve_report(p_report uuid, p_action text, p_note text) returns jsonb                       -- p_action: dismiss | takedown | restricted
request_verification_changes(p_artist uuid, p_note text) returns jsonb
mark_verified(p_artist uuid) returns jsonb                                                    -- same signature
restrict_artist(p_artist uuid, p_restricted boolean, p_reason text default '') returns jsonb  -- same signature
admin_overview(p_days integer) returns jsonb
admin_queue_counts() returns jsonb
admin_artists(p_filter text, p_q text, p_page integer) returns jsonb
```

`src/App.jsx` uses `adminOnly` (added in P00: `(el) => <RoleRoute role="admin">{el}</RoleRoute>`) for the routes `/admin`, `/admin/queues`, `/admin/artists` under `AdminShell`.

New `reason` values: `already_extended`, `already_decided`, `refund_unknown`. New notification types: `ship_extended`, `artwork_taken_down`, `verification_changes`.

## UI specification

### Admin shell (SH.07)

Layout route for `/admin/*`, guarded by `adminOnly`. Header: logo with the label "Admin", "View site", bell, account menu. Dark sidebar, group "Operate": Overview, Queues (badge: total waiting), Orders, Payout run (badge: next run date), Artists, Settings; foot links "Back to CraftMe", "Log out". Orders, Payout run and Settings links appear with P10. Under 900 px the sidebar becomes a scrolling row. A signed-in non-admin who opens any `/admin` URL is sent to `/` with the toast "You don't have access to that page."; the read functions refuse them independently.

### S29 Overview, `/admin`

- Date, "Overview", "The shop at a glance, and what needs a decision." Period select (Last 30 days default, 7, 90, This year), kept in `?days=`.
- Four tiles: Orders; Paid by Buyers; Commission earned ("At {rate}%" from settings); Owed to Artists, payable now ("For the {date} run"). Each period tile shows the change against the previous period; when the previous period is zero it shows "No earlier data" instead of a percentage.
- "Paid by Buyers and Commission" line chart (8 weeks). "Orders by Category" bar chart over the five groups.
- "Recent Orders" table with "All Orders" (after P10).
- "Needs a decision": five rows (Damage Reports, Overdue Orders, Reviews to approve, Reports, Artist verification), each with "Oldest {age}" and a count, linking to its tab; a sixth row "Deletion requests waiting" when any.
- "Watch list": "Payout run in {n} days. {date}. The draft list builds automatically that morning." and one line per Artist near 60 days owed ("{name}, ₹{amount}, day {n}. Restricted automatically on day 60.").
- Empty shop: tiles at zero, charts replaced by "No orders in this period.", queue rows at 0 with "Nothing waiting". Loading: skeleton. Error: alert with "Try again".

### S30 Queues, `/admin/queues`

`Tabs` with counts, the tab kept in the URL hash-free form `?tab=dmg|over|rev|rep|ver`. Each tab is a table (cards under 760 px), oldest first. Each tab has its own loading skeleton, error alert with "Try again", and empty state ("No Damage Reports waiting.", and so on). After any decision the row leaves the list, the tab count drops, and a toast confirms.

**Damage Reports.** Lead: "The Artist's Payout for each Order is on hold until you decide." Columns: Report (code), Order, Buyer, Artist, Claim (type and photo count), Opened, At stake, "Review".
`S30.dlg.dmg`: title "Damage Report {code}", sub-line, the Buyer's photos (signed URLs, each opens full size in a new tab; a photo that fails to load shows "Photo unavailable"), the Buyer's text, Items claimed with amounts, "Shipped {date} · received {date} · reported {date} (inside the 3-day window)", Artist history. Decision radios: "Uphold: refund {items} (₹{amount})" and "Reject: no Refund, Payout released" (neither pre-selected). "Note to both people\*" (500). "Cancel" and "Record decision" ("Recording…").

| Result | What the Admin sees |
| --- | --- |
| Rejected | Toast "Decision recorded. Buyer and Artist notified." |
| Upheld, refund issued | Toast "Upheld. ₹{amount} refunded through Razorpay." |
| Upheld, provider answer unknown | The dialog stays open with a warning: "The decision is recorded. Razorpay didn't confirm the refund. Check it under Orders, Refunds to check." (P10). Never a second refund attempt from here. |
| `already_decided` | "Someone already decided this report." and the list reloads |
| Payments not configured, uphold chosen | "Refunds aren't set up on this site yet. You can still reject." Nothing is recorded. |

**Overdue.** Lead: "Paid more than 7 days ago and not Shipped. Usually the answer is a full Refund." Columns: Order, Artist, Buyer, Paid, Overdue by, Paid by Buyer, actions. "Extend 2 days" acts at once (toast "Deadline extended by 2 days."); an order extended before shows a disabled "Extended". "Refund" opens `S30.dlg.refund` (alert dialog): "Refund this Order? Refund ₹{total} in full through Razorpay. The Buyer is notified, and the Artist's Payout for this Order is cancelled." and "Razorpay doesn't return its fee on refunds, so CraftMe absorbs ₹{fee}." (the order's real `gateway_fee`). "Cancel", "Refund ₹{total}" ("Refunding…"). It calls `issueRefund` with every remaining line and the reason "Overdue, not shipped". Unknown provider answer: the same warning as above.

**Reviews.** Lead: "Reviews appear on the Artist's profile only after you approve them." Each card: stars, Artist, "by {buyer} · Order {code}", age, the text, a warning line when the text contains digits that look like a phone number, an email address or a link. Buttons "Reject" (`S30.dlg.rrej`: "Reason (the Buyer sees this)" select: Contains personal details; Abusive or unlawful; Not about the Artist or Order; "Cancel", "Reject Review"), "Approve", and "Approve edited" (dialog with the text in an editable box, 500, "The Buyer is told their Review was edited to remove personal details.", "Cancel", "Approve edited"; PD10).

**Reports.** Columns: Target (Artwork or Artist, linked), Reason, Details from reporter, Reported, actions. "Dismiss" (small confirm, optional note). For an Artwork: "Take down" (`S30.dlg.down`, alert dialog: "Take down {title}? The Artwork and its Listings leave the shop. The Artist is told the reason.", "Reason\*", "Cancel", "Take down"). For an Artist: "Restrict…" opens the S33 Restrict dialog for that Artist (the mock's empty target, mismatch 11) and on success closes the report as `restricted`.

**Verification.** Lead: "Check before the Artist's first Payout. Details are visible only to you and the Artist." Columns: Artist and city, Submitted, Legal name, PAN, Payout to, Phone, Fee, "Check". `S30.dlg.ver`: the values, two checkboxes ("Name on PAN matches the payout account holder", "PAN format is valid"), "Request changes" (opens a required note; toast "Changes requested from the Artist") and "Mark verified" (enabled when both boxes are ticked; toast "Artist verified. Payouts enabled.").

**Deletion requests** (below the tabs, shown only when any wait): user, scope, since, what blocks it. Read-only.

### S33 Artists, `/admin/artists`

- Header: "Artists", "Verification, money owed and Restrictions."
- Filter chips with counts, in `?filter=`: All, Needs verification, Owes money, Restricted. "Search Artists" by name (applies 300 ms after typing). `Pagination`, 20 per page.
- Columns: Artist (initials, name, city), Joined, Verification (Verified, Waiting), Orders, Rating, Overdue (30 d), Amount Owed ("₹3,200 · day 52" or a dash), Shop (Open, or Restricted with the newest reason under it), and "Restrict…", "Lift…", or "Verify" (to the verification tab).
- `S33.dlg.rs` (alert dialog): "Restrict {name}", the box "What Restricted does: Listings leave the shop and no new Orders can be placed. {name} must still ship {n} Paid Orders and make any Refunds.", "Common reason" select (Repeated Overdue Orders; Upheld Reports about the work; Amount Owed unsettled; Other) that fills the text box below, "Reason shown to the Artist\*" (300), "Cancel", "Restrict Artist". Toast "{name} is now Restricted".
- `S33.dlg.lift`: "Lift Restriction? {name}'s Listings return to the shop right away.", "Note\*", "Cancel", "Lift Restriction". When the Restriction is for money owed, the dialog adds a warning: "{name} still owes ₹{amount}. Lifting now overrides the 60-day rule for this debt. It will apply again only if a new amount becomes owed." The Admin can still confirm (PD26).
- Empty filter: "No Artists here." Loading and error as elsewhere.

## Mutation cases

| Mutation | Wrong role | Stale data | Repeat | Partial failure | Retry | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| `decideDamage` | Not Admin: `forbidden` (Edge and SQL) | Decided by another Admin: `already_decided` | Same `requestId` replays; a new click after success finds it decided | Decision and reservation saved, provider failed: refund `unknown`, resolved in P10; the decision is never rolled back | Not from this dialog | Row gone; refund visible in P10 |
| `extend_ship_deadline` | `forbidden` | Shipped meanwhile: `wrong_stage`; extended already: `already_extended` | Second click refused | None | Safe | — |
| Overdue refund (`issueRefund`) | `forbidden` | Shipped or refunded meanwhile: `wrong_stage` or `exceeds_paid` | `reserve_refund` refuses lines already refunded | Provider unknown: kept as `unknown` | Not automatic | — |
| `decide_review` | `forbidden` | Decided elsewhere: `already_decided` | Same | None | Safe | — |
| `resolve_report` | `forbidden` | Target already removed: closes the report | Closed report: `already_decided` | None | Safe | — |
| `mark_verified`, `request_verification_changes` | `forbidden` | Artist edited details meanwhile: the dialog reloads the values before saving and warns "These details changed while you were looking." | Idempotent | None | Safe | — |
| `restrict_artist` | `forbidden` | Already in that state: no change | Idempotent | None (one transaction flips the profile, artworks and listings) | Safe | — |

## Steps

1. Migration and schema checks: every function refuses a non-admin; extension works once; `uphold_damage` reserves exactly the reported lines and is refused twice; the note rules; a rejected review needs a reason and never moves the average; an edited approval hides the original from `authenticated`; takedown hides the work and closes sibling reports; request-changes clears on resubmission; an Admin can lift an owed restriction while money is owed, the sweep then leaves that Artist alone for the same debt, and a new debt (after the balance reached zero) restricts again at 60 days; an Admin's direct selects return the fixture rows for each tab and a Buyer's return none; the three aggregate functions match sums computed directly; every decision writes one audit row.
2. Edge `decideDamage`; refactor the provider half of `issueRefund` into one function used by both.
3. `gateway.js`: `RPC` entries for the new functions and hooks for the read functions.
4. `AdminShell.jsx`, routes `/admin`, `/admin/queues`, `/admin/artists`.
5. The three pages and the dialogs.
6. `notifications.js` and `format.js`: new types and reasons (`already_extended`, `already_decided`, `refund_unknown`).

## Verification commands

```bash
npm run test:schema
```
```bash
npm test
```
```bash
npx playwright test e2e/admin-access.spec.js e2e/admin-queues.spec.js e2e/admin-artists.spec.js
```

## Completion gate

- [ ] QA-SH-05 (admin part), QA-S29-01 to 03, QA-S30-01 to 10, QA-S33-01 to 04, QA-S16-07 pass.
- [ ] With a Buyer session, every `admin_*` function call returns `forbidden` and every queue select returns zero rows (QA-S29-03 checks the network responses, not only the redirect).
- [ ] The audit log has one row for each decision made during the QA run.
