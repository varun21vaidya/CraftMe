# P01 verification record

Branch `craftme/p01-cart-checkout-orders`, cut from `craftme/p00-foundations` (P00 is the prerequisite; see [P00-verification.md](P00-verification.md)).
Environment: local stack (`npx supabase start`, Docker), `supabase/seed_qa.sql`, the `api` function served with `PROVIDER_MODE=fake`,
Playwright 1.65 driving Microsoft Edge (`PW_CHANNEL=msedge`; the bundled Chromium revision is not installed on this machine).

## Repository checks

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm test` (vitest) | pass, 76 tests (cart reducer, address rules, order timeline, provider seam, existing suites) |
| `npm run test:schema` | pass, 165 checks (135 before P01) |
| `npm run build` | pass |
| `npx playwright test e2e/cart.spec.js e2e/checkout.spec.js e2e/orders.spec.js` (desktop light) | pass after the two fixes below; see the scenario table |
| `e2e/provider-modes.spec.js` with the function served in three modes | pass (QA-S09-07, QA-SYS-02) |
| Edge Function type check | **not run**: Deno is not installed. The file parses (Vite's TypeScript transform) and every command used here ran on the local edge runtime |

The first full desktop run (78 tests) had 2 failures, both from the test environment, not the app: the local pg_cron sweep
auto-received fixture O14 mid-run (the seed now unschedules the `craftme-*` jobs locally; tests run the sweep themselves), and
QA-SH-06's "no artist data" check matched Home's `artist:profiles!artist_id(...)` select (now matches `artist_id=eq.` filters only).
Both re-ran green.

All-views run (the "View: all" scripts QA-SH-01, SH-03, S20-01, S08-01, S09-01, S11-01, S12-01, S13-01 and S36-03 on desktop dark,
tablet light and dark, phone light and dark): 65 passed, 5 skipped (width-specific tests), after fixing a 40 px sideways scroll in the
signed-in phone header and the 404 search on narrow screens. Screenshots of Cart, Checkout (held), My orders, an order and the
placed page were reviewed at 1280 light and 375 dark.

## Scenarios

"Desktop" = 1280 × 800 light. "All views" = 1280, 768 and 375 px in both themes.

| ID | Result | Evidence |
| --- | --- | --- |
| QA-S03-05 | passed | `cart.spec.js` — dialog names Meera Iyer; Escape and Keep leave the Cart and write nothing; "Switching…", then W6 only; `saved_cart_items` W2 Print ×2; one operation row |
| QA-S03-06 | passed | `cart.spec.js` runs A, B, C; a double press of Buy now is one line of quantity 1 |
| QA-S08-01 | passed | `cart.spec.js`; the 375 px check is in the all-views run |
| QA-S08-02 | passed | `cart.spec.js` |
| QA-S08-03 | passed | `cart.spec.js` (price review, sold line removed and named, Accept, stored `seen: 240000`; a fully held line is kept and blocks Checkout) |
| QA-S08-04 | passed, fixture adjusted | The script's Cart mixes W2 (A1) and W8 (A4), which one Cart cannot hold. Run with W8 Print and W8 frame (both A4): frame stops at 5, print at 10, "That's all there is.", the frame line leaves at 0; an Original has no stepper. Unit: `cart.test.js` |
| QA-S08-05 | passed | `cart.spec.js` |
| QA-S08-06 | passed, wording differs | Cap and the "quantity limit" message pass. The ended saved line cannot be named or grouped with its Artist: `listings_read` hides ended listings from buyers, so it shows as "Unavailable work · Unavailable" in an "Unavailable works" group with a disabled button and no Restore button |
| QA-S08-07 | passed | `cart.spec.js` (blocked switch, reload replays and fails, Try again succeeds; journal removed; one operation; W2 saved once) |
| QA-S08-08 | passed | `checkout.spec.js` |
| QA-S08-09 | passed | `cart.spec.js` three runs (Keep / Switch with "2 added. 2 skipped…", double click, reload mid-switch) |
| QA-S09-01 | passed | `checkout.spec.js` (prefill, State select, notice, hold timer, read-only fields, fake window, confirming, `?placed=1`; DB: total, gift note, `upi`, commission, ship_by, address2 and landmark, stock and held, Cart empty) |
| QA-S09-02 | passed | `checkout.spec.js` + `address.test.js`; server `invalid` / `fields: ["phone"]` |
| QA-S09-03 | passed | `checkout.spec.js` |
| QA-S09-04 | passed | `checkout.spec.js` |
| QA-S09-05 | passed | `checkout.spec.js` (the page reads `hold_until` from the server while held, so an early end is seen without a reload) |
| QA-S09-06 | passed | `checkout.spec.js` runs (a) and (b); schema: a refused order leaves no hold |
| QA-S09-07 | passed | `provider-modes.spec.js` with the function served without keys: `unavailable` / `payments_not_configured`, no order, no hold; the page alert and a disabled Pay |
| QA-S09-08 | passed | `checkout.spec.js` |
| QA-S09-09 | passed | `schema.test.mjs` (hold: 0 rows for the Artist; paid: 1 for the Artist, 0 for others, 1 for the buyer) |
| QA-S10-01 | waiting for Gate B | needs Razorpay test keys (sandbox) |
| QA-S10-02 | waiting for Gate B | needs Razorpay test keys (sandbox) |
| QA-S10-03 | passed | `checkout.spec.js` (fake window Fail and Close keep the hold; Pay succeeds; one order) |
| QA-S10-04 | passed | `checkout.spec.js` (signed webhook after the tab closed; Cart emptied; listed Paid; `order_new` and `order_paid`; pending key removed) |
| QA-S10-05 | passed | `checkout.spec.js` (same and new requestId, duplicate event id, `order.paid`; stock moved once; one notification) |
| QA-S10-06 | passed | `checkout.spec.js` runs A and B (refunded once, `sold_during_payment`, one `issued` refund for the full total) |
| QA-S10-07 | passed | `checkout.spec.js` (`bad_signature`, `forbidden`, `amount_mismatch`, order stays `hold`; the page wording) |
| QA-S10-08 | passed | `checkout.spec.js` runs A, B, C (one requestId; webhook settles; the 30-second text; never "failed") |
| QA-S11-01 | passed | `orders.spec.js`; all views in the second run |
| QA-S11-02 | passed | `orders.spec.js` |
| QA-S11-03 | passed | `orders.spec.js` |
| QA-S12-01 | passed | `orders.spec.js` (counts 8/1/2/4/1, hold as "Finish paying", hints, tab keys, reload) + `my_order_counts` as B2 |
| QA-S12-02 | passed | `orders.spec.js` |
| QA-S12-03 | passed | `orders.spec.js` (empty as AD1, three skeletons, failing request with Try again) |
| QA-S12-04 | passed | `orders.spec.js` (53 orders, 20 per page, each once, oldest last, disabled ends) |
| QA-S13-01 | passed | `orders.spec.js` (O2 and O3) |
| QA-S13-02 | passed | `orders.spec.js` |
| QA-S13-03 | passed | `orders.spec.js` |
| QA-S13-04 | passed | `orders.spec.js` |
| QA-S13-05 | passed | `orders.spec.js` |
| QA-S13-06 | **partly passed** | Second `confirm_received` fails `wrong_stage`; the sweep receives O14 with `received_at >= auto_receive_at`; the page says "marked Received automatically". The script's `review_prompt` notification with `auto: true` does not exist: the sweep writes none, and plan step 6 forbids changing `_set_received` and `sweep` in P01. Needs an owner (the Review package or P11) |
| QA-S13-07 | passed | `orders.spec.js` (Order summary, not Tax invoice; the PDF of the print view is one page; B2 sees not found) |
| QA-S13-08 | passed | `orders.spec.js` (B2 on `/orders/<O2>`, `/damage`, `/review`, `/receipt`; G to login) + `shell.spec.js` RLS check |
| QA-S13-10 | passed | `orders.spec.js` (`unknown`, `pending`, then `issued` picked up by the 4-second poll) |
| QA-SYS-03 | passed in part | `checkout.spec.js`: concurrent same requestId (one order; the other `in_progress` or a replay), replay byte for byte, missing id `invalid`, a stale pending claim taken over. Not exercised: "a retryable failure frees the id" (needs a provider failure on demand) |

Gate items: "No buyer-facing sentence promises an email": `grep -i email` over the four pages and their components finds only the
Razorpay `prefill.email` field and a code comment.

## Changes against the plan (recorded, not product decisions)

- **Native dialog focus.** `showModal()` makes the page inert, but in Chromium Tab past the last control leaves for the browser UI. `Dialog` wraps Tab and Shift+Tab itself.
- **Order line titles.** `place_order` copied the listing's title into `order_lines.title`; listing titles are version names ("Print"). The 0019 copy now snapshots the artwork title. Orders placed before 0019 keep their old titles.
- **My orders "All".** The plan says the total excludes `hold_expired`; QA-S12-01 says All is the sum of the four tabs and holds appear only as the alert. `my_order_counts.all` excludes `hold` too.
- **`resumeHold`** also returns the held lines and the address it was placed with, so the page can tell whether the hold still matches the Cart.
- **Fake window "Fail"** resolves like a failed attempt inside Razorpay's own window (the handler is never called), so the page stays Held with a short note, as QA-S10-03 expects.
- **`/orders/:id/damage` and `/orders/:id/review`** render the order page with its existing inline forms until P02 replaces them, so the new links are never dead.
- **Saved for later** names a line by artwork and kind ("Kolam at Dawn (Print)") instead of the bare listing title.
- **Local harness.** `0007` skips the hosted-only `rls_auto_enable()` helper so `supabase start` works. `seed_qa.sql` is re-runnable in about a second, unschedules the local cron jobs, and adds orders O1, O3 to O10 and O14, B1's saved address and filler work F01. O11 to O13, O15, payouts and reports belong to later packages.

## Changed paths

`supabase/migrations/0019_checkout.sql` (new), `supabase/migrations/0007_revoke_rls_auto_enable.sql`, `supabase/functions/api/index.ts`,
`supabase/schema.test.mjs`, `supabase/seed_qa.sql`;
`src/api/gateway.js`, `src/api/checkout.js` (unchanged since P00), `src/contexts/cart.js`, `src/contexts/cart.test.js`, `src/contexts/CartContext.jsx`,
`src/components/cart/CartConflictDialog.jsx`, `src/components/cart/FakePayDialog.jsx`, `src/components/checkout/*` (new),
`src/components/orders/*` (new), `src/components/ui/{Tabs,Pagination,Stepper,Timeline,Breadcrumbs,QtyStepper,Field}.jsx` (new), `src/components/ui/Dialog.jsx`,
`src/components/common/Icon.jsx`, `src/lib/{address,orderTimeline}.js` and tests (new), `src/lib/format.js`,
`src/pages/{CartPage,CheckoutPage,OrdersPage,OrderPage,ArtworkPage,WishlistPage}.jsx`, `src/App.jsx`, `src/ui/styles.css`;
`e2e/{cart,checkout,orders,provider-modes}.spec.js` and `e2e/helpers/{api,cart}.js` (new), `e2e/helpers/{ids,seed}.mjs|js`, `e2e/{shell,ui-kit}.spec.js`.

## Migration order

`0019_checkout.sql` only. Rollout: schema test, apply 0019, deploy the Edge Function, deploy the web app (either order for the last two).
0019 replaces `place_order` with the same signature, so the deployed function keeps working between steps.

## Remaining work

- Gate B: QA-S10-01 and QA-S10-02 with Razorpay test keys.
- QA-S13-06 `review_prompt` notification: owner to be chosen.
- QA-SYS-03 "a retryable failure frees the id".
- A Deno type check of `supabase/functions/api` (`deno check`) where Deno is installed.
