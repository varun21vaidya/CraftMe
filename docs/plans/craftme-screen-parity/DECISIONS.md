# CraftMe screen parity: decision log

Interview held 2026-11-13 before the implementation plan. This file is a log, not the plan. No application code was changed.

## 1. Evidence baseline

| Item | Finding |
| --- | --- |
| Git | `HEAD` is `0815969` ("Add marketplace search, saved carts, and collection tools"). No tracked file is modified. Untracked: `docs/SCREEN_COVERAGE_AUDIT.md`, `docs/SCREEN_SCENARIO_INVENTORY.md`, `.agents/`, `.claude/`, `skills-lock.json`. |
| Screen and state count | Recounted from `docs/screens/data.js`: **36 screens, 74 registered states** (screens with more than one state: S02 3, S03 4, S04 2, S05 2, S06 2, S07 2, S08 3, S09 3, S10 4, S12 2, S13 4, S14 2, S15 2, S17 2, S18 4, S21 3, S22 2, S23 2, S24 2, S25 2, S26 2, S27 5, S32 2). The baseline matches. All 36 registered HTML files exist and no unregistered page exists. |
| Hosted reference | The hosted `index` renders from `data.js`, and the hosted `data.js` is identical to the checked-in copy once CR line endings are ignored. **Verified 2026-11-13:** all 36 screen pages plus `index.html`, `data.js`, `styles.css`, `ui.js` and `art.js` were fetched from the hosted artifact and compared with `docs/screens/` (CR line endings ignored). All 40 files match. The only difference is the `<html><head>…` skeleton the platform wraps around `index.html`. The hosted `assets/` folder, images and `share.jpg` (44 of 84 files) were not compared. |
| Routes in the app | `src/App.jsx` has 17 routes. `/` and `/browse` both render Browse. There is no `/notifications`, `/profile`, `/become-artist`, `/legal/*`, `/dashboard` (overview), `/dashboard/artworks`, `/dashboard/instagram`, `/dashboard/payouts`, `/dashboard/settings`, `/admin/*` or `/orders/:id/damage|review`. |
| Reference interactions | 82 `data-demo` / `data-toast` elements in the reference HTML are demo-only. The inventory also lists dialogs and tab panels outside the 74 states. Toasts and fixture values are evidence of intent, not requirements. |

### Mismatches and conflicts found in source

1. `PROJECT_BLUEPRINT.md` A2/A3 list email/password auth, while `docs/INSTAGRAM_PLAN.md:113` says Google is the only login. Resolved as D01.
2. The Blueprint caps the Instagram Showcase at 9 posts or reels (IG5). The code caps reels at 12 total and 6 highlighted (`ReelsManager.jsx:9-10`). Resolved as D09.
3. The reference damage form requires 800 characters and at least 2 photos. The app allows 500 characters and up to 5 optional photos (`OrderPage.jsx:32-34`), and `report_damage` checks neither the photo count nor the file rules (`0003_logic.sql:192-214`). Resolved as D08.
4. A full refund sets the order stage to `refunded` (`0003_logic.sql:306`), and `submit_review` requires `received` (`0003_logic.sql:230-243`), while S13 shows Review in the refunded variant. Resolved as D06.
5. `WishlistPage.jsx:75-83` adds only the first work when another artist's cart is active. Resolved as D07.
6. The reference shows 'Pay now' for Amount Owed. No code lets an artist pay an owed balance. Resolved as D10.
7. No email sender exists in the app or `supabase/functions`, yet S11, S14, S24 and S28 promise email. Resolved as D04.
8. The Blueprint is still written for Firebase (callables, Firebase Auth OTP). The code is on Supabase. The Blueprint's file and function names are not authoritative.
9. ADR-0001 (superseded) says a 30-minute hold. The code holds for 15 minutes (`0003_logic.sql:53`), matching S34.
10. S22 lists a Delete action on any artwork, while S23 and Blueprint B10 allow deletion only if the work was never sold. Treat B10 as the rule.
11. In S30 the Restrict control has an empty dialog target. Use the S33 `rs` dialog as the interaction definition.

## 2. Approved decisions

Each entry was answered by the user in this interview. "Evidence" is what I verified in the repo. "Dependency" is something outside the code.

### D01. Authentication is Google-only
- **Answer:** Keep Google as the only login. S05 (wrong password), S06 and S07 stay deferred, and Blueprint A2/A3 are superseded. Policy acceptance is recorded on first Google sign-in.
- **Screens:** S05, S06, S07, S16, S19.
- **Evidence:** `docs/INSTAGRAM_PLAN.md:113`, `src/App.jsx` (only `/login`), Blueprint A2/A3.
- **Dependency:** Google OAuth settings in Supabase, and Google brand verification (per the Instagram plan).

### D02. Seller onboarding is built in full
- **Answer:** Build S18 end to end: details, phone check, onboarding fee, done. The seller entry becomes live on S01 and S16. This replaces the earlier deferral.
- **Screens:** S18, S01, S16, S28, S33, S34.
- **Evidence:** `supabase/functions/api/index.ts:189-207` (verification, fee and role checks), `0001_init.sql:205` (`onboarding_fee_paise`).
- **Dependency:** D03 (OTP), Razorpay (fee), an Admin-set fee amount.

### D03. Phone OTP goes over WhatsApp
- **Answer:** Use the Supabase Send SMS Hook with the Meta Cloud API (WhatsApp) for OTPs. Copy on S18 changes from "SMS code" to a WhatsApp code. The user's stated rationale: no DLT registration needed, about ₹0.115 plus GST per OTP at Meta's direct rate.
- **Verified 2026-11-13 (Supabase docs):** the Send SMS Hook exists to use "alternate messaging channels such as WhatsApp", and Supabase's built-in WhatsApp channel works only with Twilio and Twilio Verify, so the hook with custom code is the correct route. A logged-in user can attach a phone with `updateUser({ phone })` and confirm it with `verifyOtp` type `phone_change`, so a Google-created account can add a verified phone (this resolves A9).
- **Still unverified:** the "no DLT" claim (a web search found nothing on it) and the per-OTP price. Vendor blogs put India's domestic authentication rate near $0.0014 (about ₹0.12), which is consistent with the user's figure, but India's authentication-international rate is higher, and GST and any provider markup add to it. Check Meta's current rate card before quoting a cost. Authentication templates also need Meta approval before sending.
- **Screens:** S18 (step 2), S28 (changed payout details may need re-verification).
- **Evidence:** No SMS or WhatsApp provider exists in the repo. `phone_verified` is read at `index.ts:206`. The memory note of 2026-11-09 says phone verification was not ported.
- **Dependency:** Meta Business account (user says it is ready), a WhatsApp Business number, Meta approval of an authentication template, Supabase Phone Auth enabled with the hook.

### D04. Three launch emails through Resend
- **Answer:** Send three emails: buyer payment receipt, artist new order, artist payout sent. Send them from an outbox written after authoritative payment or recorded transfer, once per recipient and event, with retry that never rolls back a payment. Copy on S11, S14, S24 and S28 may promise only these three.
- **Screens:** S35, S11, S14, S24, S28.
- **Evidence:** No sender in `supabase/functions` or `src`. Blueprint line 68 and F4 to F6 name the three emails.
- **Dependency:** Resend account and a verified sender domain.

### D05. Overdue orders: Admin decides, usually a refund
- **Answer:** Keep the existing rule. A Paid order unshipped after 7 days is flagged Overdue and goes to the Admin queue. Admin can extend by two days once or refund. Buyer copy says it is reviewed and usually refunded in full. There is no automatic refund.
- **Screens:** S13, S24, S25, S30, S19.
- **Evidence:** `0003_logic.sql:445` (the sweep sets `overdue = true`), Blueprint D12, R2, line 506.

### D06. Review eligibility after a refund
- **Answer:** Keep the current rule. A review is allowed while the order is Received, within 30 days, including after a partial refund. A fully refunded order cannot be reviewed. S13's refunded variant shows Review only for a partial refund.
- **Screens:** S13, S15, S04.
- **Evidence:** `0003_logic.sql:230-243` (requires `received`), `0003_logic.sql:306` (only a full refund sets `refunded`), ADR-0003.

### D07. Cart switch and bulk add
- **Answer:** "Add all by artist" with another artist's cart active shows the switch dialog once, naming the outgoing artist and saying the cart is saved. On confirm it saves the outgoing cart and adds every eligible work in the group. It reports skipped works (sold, already in the cart, or a version must be chosen). Cancel changes nothing. "Buy now" uses the same dialog, then goes to checkout. Repeated clicks and reload replays are idempotent. Saved-for-later replaces the reference's "discard the cart".
- **Screens:** S03, S08, Wishlist and Saved pages.
- **Evidence:** `WishlistPage.jsx:75-83`, ADR-0002, `0017_saved_cart.sql`, `CartConflictDialog.jsx`.

### D08. Damage report limits follow the reference
- **Answer:** Description required, up to 800 characters. 2 to 6 photos (JPEG or PNG, up to 5 MB each). The buyer selects affected lines and a damage type. One report per order. Limits are enforced in the UI, in SQL (count, length, path prefix) and in the storage bucket. Add a durable submitted view.
- **Screens:** S14, S13, S30.
- **Evidence:** `0003_logic.sql:192-214`, `OrderPage.jsx:32-34`, reference `damage-report.html`.
- **Dependency:** A migration and a storage-policy change. The plan must also say how orphaned photos are cleaned up after a failed submit.

### D09. Instagram: posts and reels, 9 slots, disconnect keeps pasted links
- **Answer:** The Showcase holds up to 9 mixed posts and reels. This replaces the 12 total and 6 highlighted caps, and current highlights are migrated. Disconnect deletes the token and all API-imported picks, from the public profile and from stored provider data. Links the artist pasted themselves are kept. Copy on S27 and S19 states this.
- **Screens:** S27, S04, S19.
- **Evidence:** `supabase/functions/api/instagram.ts:96-101` (disconnect today keeps reels as plain links), `ReelsManager.jsx:9-10`, Blueprint IG5 and IG9.
- **Dependency:** Meta app configuration that permits reading posts as well as reels. Live status of the Meta integration is unverified.

### D10. Amount Owed is paid through Razorpay
- **Answer:** The artist pays the exact outstanding balance through Razorpay. No partial payment. One pending attempt at a time. Settlement is recorded only from verified provider confirmation or webhook, idempotently. CraftMe absorbs the gateway fee on this payment. A successful payment clears the Amount Owed and lifts an owed-based Restriction, with an audit entry.
- **Excess or duplicate payment (D10a):** **No cash refund**, by the user's instruction. The excess is stored as an artist credit, netted against the next payout or future owed amount, and shown in S26 and the statement.
- **Screens:** S21, S26, S28, S33, S30.
- **Evidence:** No owed-payment code exists. Blueprint line 42 (owed taken from payouts, 60-day restriction).
- **Dependency:** Razorpay live account. **ADR-0004 follow-up:** the new money-in flow from artists amends its "no fees to chase" consequence, so record it in the ADR.

### D11. Account deletion is self-serve
- **Answer:** Typing DELETE creates a deletion request and signs the user out. The system anonymizes the profile, saved address, photo and Instagram data once there are no open orders, open reports or unsettled payouts. Otherwise it waits and tells the user why. Orders and reviews are kept with anonymized names. Admin can see pending requests. S19 offers "Everything" or "Only my Instagram data", and the Instagram path reuses the existing deletion flow. The 30-day promise depends on the sweep running.
- **Screens:** S16, S19.
- **Evidence:** Only Instagram deletion exists today (`instagram.ts`, `/instagram-deletion`). Blueprint A14 marks deletion as later.

### D12. Live readiness (replaces assumption A7)
- **Answer:** The target is a live-ready final build, not a test-mode demo. The user states that the Meta Business account exists, and that the **business and Razorpay live are already approved**.
- **Screens:** all money, email and Instagram screens.
- **Evidence:** user statement only. A read-only Razorpay MCP check on 2026-11-13 returned zero payments and zero settlements, so it neither confirms nor contradicts live approval (the connected key's mode is not shown by those calls). **This conflicts with the memory note of 2026-11-07** (no registered business) and I have not verified it. ADR-0004 also requires Razorpay's written marketplace approval before CraftMe holds buyers' money. It is not confirmed that the live approval covers that.
- **Dashboard screenshots (user-supplied, 2026-11-13):** the Razorpay dashboard shows an empty Settlements page, a "Submit details for verification" dialog still open (website link and login-required questions unanswered, Submit disabled), a welcome banner and an "87 Free* Days" promo. This points to **account activation not yet completed**, which contradicts "Razorpay live already approved". Treat D12's Razorpay claim as **unconfirmed** until the dashboard shows an activated account. Razorpay's dialog says the website must show Terms and Conditions, Privacy Policy, Shipping Policy, Contact Us and Cancellation and Refunds pages. The app has only Privacy today, so S19's legal pages (D01/A1) gate activation, and a Shipping Policy and Contact page are not in the reference's five legal tabs (the Refunds tab may cover cancellation).
- **Dependency:** Razorpay account activation (submit the verification details), live keys and webhook secrets, Meta live mode, WhatsApp template approval, Resend domain, Google OAuth brand verification.

### D13. Payout timing stays at 1st and 15th batches
- **Answer:** Artists are paid after the 3-day damage window, in the next 1st or 15th run recorded by the user. No per-order or daily payouts. The user's phrase "pay immediately after the return window" was clarified to mean this existing rule.
- **Screens:** S32, S34, S26, S21, S35, S19.
- **Evidence:** ADR-0004, Blueprint line 41, `0003_logic.sql:452` (`payable` set once the window ends).
- **Dependency:** This does not remove the holding-money question in D12. CraftMe holds funds from payment until payout, and Razorpay's written confirmation that this is allowed is still open.

### D14. Razorpay's required legal pages are a website requirement
- **Answer:** The website must publish these five pages, reachable without login, before Razorpay activation is submitted: Terms and Conditions, Privacy Policy, Shipping Policy, Contact Us, Cancellation and Refunds. The user asked for them to be added as a requirement to complete on the website.
- **Screens:** S19 (adds Shipping Policy and Contact Us beyond the reference's terms, privacy, refunds, artist agreement and deletion tabs; the Cancellation and Refunds tab covers cancellation), S01 and the shared footer (links), S13 (paid orders cannot be cancelled, so the copy must match), S11.
- **Evidence:** Razorpay's "Submit details for verification" dialog (user screenshot, 2026-11-13). The app has only `/privacy` and `/instagram-deletion` today (`src/App.jsx:59-60`).
- **Dependency:** The user supplies or approves the final policy wording. The reference text is labelled draft and must not ship as is. The public URL goes into Razorpay's website-link field.

### D15. External tokens and accounts are added after development
- **Answer:** The user will add the credentials after development is complete: Razorpay keys and webhook secret, Meta and WhatsApp tokens, the Resend key and sender domain, Google OAuth settings. The Meta Business account, Resend domain and Google brand verification are therefore not checked now. Development proceeds without them.
- **Screens:** all that depend on a provider: S10, S11, S18 (OTP and fee), S26, S27, S32, S35.
- **Consequence for the plan:** read every credential from environment or Supabase secrets, never from code. Each provider-backed feature must fail safely and show a clear "not configured" state until its tokens exist, and must be testable with provider test or fake modes. Tests and the "done" check for these features cannot include live provider behavior until the tokens are added, so each needs a separate live verification step at the end.
- **Dependency:** user supplies the tokens, and completes Razorpay activation (D12) and the legal pages (D14), at the end.

### D16. Razorpay activation and WhatsApp template checks happen after development
- **Answer:** The user will do these after development is complete, as a final-stage checklist: (1) submit Razorpay activation (D12), publish the five legal pages (D14) and get Razorpay's written confirmation that CraftMe may hold Buyers' money until payout (ADR-0004); (2) confirm the WhatsApp "no DLT" claim and per-OTP price, and get Meta's approval of the authentication template (D03).
- **Screens:** S10, S11, S18, S19, S26, S32.
- **Consequence for the plan:** these are launch gates, not development tasks. Features are built against test or fake provider modes (D15), and the plan ends with a launch checklist that holds each gate. The legal pages themselves (D14) are still built during development, since the site must show them before activation.
- **Risk to record:** if Razorpay or Meta refuse or change terms (for example the hold-then-pay model), payment, payout or onboarding design may need rework after the build.

## 3. Assumptions accepted by the user

The user accepted A1 to A6 and A8 as written. They are not decisions with evidence of their own.

- **A1.** Routes follow the reference paths (`/dashboard/artworks`, `/legal/*`, `/dashboard/instagram`, `/notifications`, `/profile`, `/become-artist`, `/admin/*`, `/orders/:id/damage`, `/orders/:id/review`). Today's `/dashboard/works`, `/dashboard/profile`, `/privacy` and `/instagram-deletion` redirect. `/instagram/return` stays.
- **A2.** S01 becomes a real landing page at `/`. Browse stays at `/browse`. The seller CTA is live (see D02).
- **A3.** Admin stays a JWT `app_metadata` claim granted by the user (`is_admin()` in `0001_init.sql:10`). S34's add and remove admin writes that claim and cannot remove the last admin.
- **A4.** Buyers get one saved address, readable only by its owner and prefilled at checkout. Orders keep their own address snapshot.
- **A5.** Shop rules shown read-only in S34 come from code and settings. The 15-minute hold is verified in code. The 7-day ship, 14-day auto-receive, 3-day damage window, 30-day review window, 1st and 15th payouts and 60-day owed restriction come from the Blueprint and need a check against the settings table.
- **A6.** Demo toasts, sample totals and fixture names are never requirements. Money values come from the ledger.
- **A8.** Reference sub-features not discussed in the interview are in scope as drawn: Browse filters and sort, S28 close shop (blocked with open orders or unsettled payouts, fee not returned), the S17 full notifications archive, S20 and S36. "Hide sold originals" treats a work with a live print as still available.

### Assumptions of mine, not yet confirmed

- **A9.** (Checked against the Supabase docs: phone attach via `updateUser` and the Send SMS Hook for WhatsApp are both supported. Delivery through the Meta Cloud API still needs a working proof.)
- **A10.** The retired Firebase pieces in the Blueprint are ignored. Gateway, SQL and Edge Function code is the source of truth.

## 4. Open items for the plan

- Optionally diff the hosted `assets/` folder and images against `docs/screens/assets` and `img`.
- Confirm Razorpay marketplace approval covers holding buyers' money (D12), and record it in ADR-0004.
- Update ADR-0004 for D10 and the Blueprint for D01, D02 and D09.
- Verify each live dependency (D03, D04, D09, D12) before the feature that needs it is called done.

---

Sections 1 to 4 above are the interview log, unchanged. Sections 5 to 8 were added on 2026-11-13 with the implementation plan ([README.md](README.md)).

## 5. Approved deviations and extra features to keep (KD)

These differ from the reference on purpose. Each was approved in the interview or was already a recorded product choice. The plan must not remove them, and each has a regression script in [QA/](QA/README.md).

| ID | Kept feature or deviation | Evidence in the repo | Why | Regression |
| --- | --- | --- | --- | --- |
| KD01 | Wishlist and collections (heart, Saved page, named collections, collection picker, private saved-work search) | `src/pages/WishlistPage.jsx`, `src/contexts/SavedContext.jsx`, `src/components/SaveButton.jsx`, `CollectionMenu.jsx`, `NewCollectionForm.jsx`, `supabase/migrations/0015_wishlist.sql`, `0018_collection_previews.sql`, `docs/WISHLIST_PLAN.md`, commits `09cce1a`, `0815969` | Buyers keep and organise works for later. The reference has no equivalent. | QA-X-01 to QA-X-04 |
| KD02 | Global search with Artworks and Artists results at `/browse?q=` | `src/components/common/MarketplaceSearch.jsx`, `src/pages/Browse.jsx` (`SearchResults`), `0016_catalogue_search.sql` (`search_catalogue`) | The reference draws a header search box but no result screen. User-requested in `0815969`. | QA-X-05, QA-S02-06 |
| KD03 | Saved for later and the transactional cart switch, in place of the reference's "Replace with this" that discards the cart | `0017_saved_cart.sql` (`switch_saved_cart`), `src/contexts/CartContext.jsx`, `src/components/cart/CartConflictDialog.jsx`, `src/pages/CartPage.jsx` (`SavedCart`), ADR-0002, D07 | The buyer keeps their picks while an Order stays one parcel from one Artist. | QA-S03-05, QA-S08-05 to QA-S08-09 |
| KD04 | Pot logo, favicon, app icons, manifest, theme colour | `public/brand/craftme-icon.svg`, `public/brand/craftme-logo.svg`, `index.html`, `public/manifest.json`, commit `1a4aac3` | Chosen branding. The reference ring mark (`ui.js` `logo()`) is not used. | QA-X-06 |
| KD05 | 21 categories in 5 groups, and the `product` listing kind (ready-made stocked items), in place of the reference's 7 categories and Original or Print only | `src/lib/categories.js` (`GROUPS`), `0006_catalogue.sql`, `KINDS` in `src/components/dashboard/ArtworkUploadForm.jsx`, `docs/CATALOGUE_PLAN.md` | The catalogue sells crafts and kits as well as art. Every reference category control maps to groups and categories; every "Original / Print" control gains "Ready-made". | QA-S02-01, QA-S23-03 |
| KD06 | Reel inside the artwork photo carousel, link fallback when the embed is blocked, named reels | `src/components/Gallery.jsx`, `src/components/ReelCard.jsx`, `src/lib/reels.js`, `0014_reel_title.sql`, `docs/PRODUCT_PAGE_PLAN.md`, commits `fb54209`, `99ca301` | A reel always has a working way to be watched. | QA-S03-08 |
| KD07 | Meta login in a popup with a return page, verified imports, Meta deauthorize and data-deletion callbacks, `/instagram/return` and the deletion status page | `src/components/dashboard/InstagramConnect.jsx`, `src/pages/InstagramReturn.jsx`, `src/pages/InstagramDeletion.jsx`, `supabase/functions/api/instagram.ts`, `docs/INSTAGRAM_PLAN.md` | Required by Meta's Unified Login and platform terms. | QA-S27-02, QA-S27-08, QA-S19-04 |
| KD08 | Supabase Postgres, RLS, Edge Function and the gateway seam, in place of the Blueprint's Firebase design | `supabase/`, `src/api/gateway.js`, A10 | Already built and tested. The Blueprint's file names are ignored. | `npm run test:schema` |
| KD09 | Google is the only login (D01) | `src/components/auth/Login.jsx`, `signInWithGoogle` in `gateway.js` | Interview decision. | QA-S05-01 to QA-S05-03 |
| KD10 | Burger menu for artist links on phones, per-route error boundary with stale-deploy reload, checkout phone passed to Razorpay | `src/components/common/Layout.jsx`, `src/components/common/ErrorBoundary.jsx` (`STALE_PAGE`), `src/pages/CheckoutPage.jsx` (`prefill.contact`), commits `9b9c246`, `304f586`, `99ca301` | Small fixes that must survive the new shells and the new checkout form. | QA-SH-03, QA-SH-06, QA-S10-01 |
| KD11 | Polling reads (4 to 30 seconds) in place of live listeners | `useQuery` in `gateway.js` | Free-tier friendly. New screens use the same hook. | covered by each screen's refresh case |
| KD12 | Open-holds limit of 3 per buyer, and the automatic refund when stock sold during payment | `place_order` (`too_many_holds`), `markPaid` and `refund_oversold` | Server rules with no reference screen. They need visible copy, added in P01. | QA-S09-08, QA-S10-06 |

## 6. Plan proposals that still need the user's yes (PD)

The interview did not cover these. The plan picked the smallest option that works and marked every place that depends on it. Nothing here is approved yet. If a proposal is rejected, only the named package changes.

| ID | Proposal | Reason | Package |
| --- | --- | --- | --- |
| PD01 | Add Playwright (`@playwright/test`, dev only) and a local Supabase stack (`supabase init`, Docker) for end-to-end scripts. Local-only email-and-password sign-in is enabled in `supabase/config.toml` so tests can log in without Google. Production stays Google-only. | The repo has unit and schema tests but nothing that drives the UI. The QA scripts need a runner. | P00 |
| PD02 | `PROVIDER_MODE=fake` in the Edge Function swaps Razorpay, Resend, WhatsApp and Instagram for deterministic fakes. Refused when `APP_ENV=production`. | D15: build and test without tokens. | P00 |
| PD03 | Browse "Type" filter has three values: Originals, Prints, Ready-made (KD05). "Hide sold originals" hides a work only when no listing of it can be bought (A8). | The reference has two kinds, the app has three. | P03 |
| PD04 | PIN code: 6-digit format check only. No "this PIN isn't served" lookup and no city or state autofill. State is a fixed list of Indian states and union territories. | No PIN dataset or courier API exists. Reference `checkout.html` shows both. | P01 |
| PD05 | The reference's "Date posted" field in the ship dialog is not stored. `shipped_at` is the server time of the click. | The 14-day auto-receive clock must not be back-dated by the Artist. | P07 |
| PD06 | Uploaded artwork video: MP4 or WebM up to 50 MB (the current `videos` bucket limit), length up to 3 minutes checked in the browser. The reference says 200 MB. | Bucket limit in `0004_storage.sql`. Raising it is a hosting-plan question. | P06 |
| PD07 | Instagram: the Showcase cap is 9 (D09). Rows not in the Showcase exist only to be linked to an Artwork. A hidden abuse cap of 50 rows per Artist replaces the old 12. | D09 removes the 12 cap but an unbounded table is unsafe. | P08 |
| PD08 | "Receipt" on S13 is a printable order summary page (`window.print`). It is not a GST tax invoice. | A tax invoice needs an accountant's format and the business's registration details. | P01 |
| PD09 | Artwork "Views" (S22): show `artworks.views`, raised by a new `bump_view` function at most once per browser session per artwork. | The column exists but nothing writes it. | P06 |
| PD10 | "Approve edited" (S30 Reviews): the Admin edits the text to remove personal details. The original is kept in a private column, the Buyer is notified. | The reference has the button but no dialog. | P09 |
| PD11 | Review topic chips append their text to the end of the review and count toward the 500 characters. | The reference says "Picks are added to the end of your Review." | P02 |
| PD12 | The Buyer profile "Phone" field is the phone of the saved address (private). No phone column is added to the public `profiles` table. | `profiles` is world-readable (`profiles_read`). | P04 |
| PD13 | "Contact CraftMe" opens a Contact page at `/legal/contact` showing the support email from `VITE_SUPPORT_EMAIL`. No ticket system. | D14 needs a Contact Us page. No support tool exists. | P04 |
| PD14 | Gift note (S08): optional, 120 characters, stored on the order, shown on the Artist's pack list. | Drawn in `cart.html`, in scope by A8. | P01, P07 |
| PD15 | Admin overview numbers and charts come from one read function computed on demand. No analytics tables. | Small data volume at launch. | P09 |
| PD16 | A new `audit_log` table records every Admin decision and every money settlement outside an Order (who, what, target, note, time). | Inventory asks for reason and audit history on restriction, verification, role grants. D10 asks for an audit entry on owed payments. | P07 (table), P09, P10 |
| PD17 | Close shop (S28) is allowed only with no Paid or Shipped orders, no open Damage Report, no Received order still unpaid, and Amount Owed of zero. | A8 says "blocked with open orders or unsettled payouts". This spells it out. | P07 |
| PD18 | Email preferences: "New Order" always on, "Payment sent" can be turned off, "Review approved" shown disabled as "later". | Matches `dash-settings.html`. D04 fixes the set of emails. | P07, P11 |
| PD19 | The "what you'd receive" estimate uses the live commission rate and an assumed gateway cost of 2.36% (2% plus 18% GST on the fee), and always says "estimate". Exact figures appear only after payment, from `orders.gateway_fee`. | The real fee depends on the payment method. The rate is an assumption to confirm against the Razorpay plan. | P06, P07 |
| PD20 | "Highest rated Artist" sort orders by `profiles.rating_avg`, then `rating_count`, then newest. | Reference lists the sort without a tie rule. | P03 |
| PD21 | Policy acceptance (D01): the first time a signed-in person reaches a protected screen without `terms_accepted_at`, a blocking dialog asks them to accept the Terms, Privacy and Refund policy. The version date is stored. | D01 says acceptance is recorded on first Google sign-in. | P04 |
| PD22 | Profile links use `/artist/<id>`. Readable slugs are not built. "Copy profile link" copies the id URL. | No slug column or uniqueness rule exists. | P03 |
| PD23 | Admins are found by email through a new Edge command, and the last Admin cannot be removed (A3). An Admin still cannot remove themselves (`self_demote`, existing). | `setRole` takes a uid today. | P10 |
| PD24 | A person whose deletion request is still pending or waiting can sign in again, see why it is waiting, and cancel it with "Keep my Account". | D11 says the system "tells the user why" it waits, which needs a way back in. Cancelling was not discussed. | P04 |
| PD25 | When an Artist's account is deleted, the payout destination and phone are erased. Legal name and PAN are kept only if the Artist was ever paid, as part of the payout record. | D11 lists profile, address, photo and Instagram data. It does not say what happens to tax identity on past payouts. Needs the lawyer's or accountant's view (XD03). | P04 |
| PD27 | If a second onboarding-fee payment arrives for an Artist whose fee is already recorded, it is refunded automatically through Razorpay. | The fee is non-refundable, but a double charge is not a fee. D10a's "no cash refund, keep as credit" was decided for Amount Owed payments only. | P05 |
| PD28 | Theme: should the app have a light or dark switch (SH.09), or simply follow the device setting? The app's CSS already follows `prefers-color-scheme` with no code. The switch in the reference lives in the reviewer bar (`ui.js` `data-theme-toggle`), which is a review tool (SH.13); the inventory only asks that both palettes work and the theme holds between routes. Following the device meets that with zero new code. The plan still lists `ThemeToggle` until this is answered. | Found by the simplification audit. A product choice, so not decided here. | P00, P12 |
| PD29 | Failed emails: the plan retries automatically six times over about 15 hours and then shows the failure and its error in S34. A manual "Retry failed" button was removed as unneeded. Say if you want it back. | Simplification audit. | P11 |
| PD26 | Lifting a Restriction that came from an unpaid Amount Owed is refused while money is still owed. It lifts by itself when the balance reaches zero (payment, D10, or a payout deduction). | Today a manual lift is undone by the next sweep while the debt remains (`sweep` in `0003_logic.sql`). | P09 |

## 7. Unresolved external dependencies (XD)

None of these can be closed by code. Each blocks Gate B or Gate C in the README, never Gate A.

| ID | Dependency | Owner | Blocks | Status on 2026-11-13 |
| --- | --- | --- | --- | --- |
| XD01 | Razorpay account activation, live keys, webhook secret | User | Gate C: S10, S11, S18 fee, S26 owed payment, S31 refunds | Not activated (dashboard screenshots, D12) |
| XD02 | Razorpay's written confirmation that CraftMe may hold Buyers' money until payout | User, Razorpay | Gate C: the whole payment model (ADR-0004) | Open |
| XD03 | Final legal wording for Terms, Privacy, Shipping, Contact, Cancellation and Refunds, Artist agreement, Deletion | User (lawyer advised) | Gate C: S19, and Razorpay activation | Not written. Reference text is draft. |
| XD04 | Meta Business account, WhatsApp Business number, approved authentication template; "no DLT" and price confirmed | User, Meta | Gate B and C: S18 step 2 | User says the business account exists. Template not submitted. |
| XD05 | Resend account and verified sender domain | User | Gate B and C: S35 | Not checked (D15) |
| XD06 | Google OAuth brand verification | User, Google | Gate C: S05 consent screen | Not checked |
| XD07 | Meta app: permission to read posts as well as reels, App Review, live mode | User, Meta | Gate B and C: S27 connect and picker (pasted links work without it) | Live status unverified (D09) |
| XD08 | Real commission rate and onboarding fee | User | Gate C: S34 | `commission_bps` defaults to 1000, `onboarding_fee_paise` to 0 (`0001_init.sql:204-205`). `payOnboardingFee` refuses a fee of 0 (`fee_not_set`). |
| XD09 | Support email address and public site URL | User | S13, S19 contact, S35 reply-to | `SITE_URL` is `https://craftme-india.vercel.app` in `supabase/README.md`. No support address exists. |
| XD10 | Registered business (memory note of 2026-11-07 says none; D12 says approved) | User | Gate C | Conflicting statements, unverified |
| XD11 | Docker on the developer machine, for the local Supabase stack (PD01) | Developer | Gate A end-to-end scripts | **Closed.** The user confirmed Docker Desktop is running (2026-11-13). |

## 8. Baseline update since the interview

- `PROJECT_BLUEPRINT.md` and `docs/adr/0004-craftme-collects-and-pays-artists.md` now carry the edits listed under "Open items" (A2, A3, A10, A11, A14, IG5, IG9, and the ADR "Amendments" section for D10, D12, D13, D14). They are modified but not committed. Section 1's "No tracked file is modified" describes the tree before those edits.
- Open item "Update ADR-0004 for D10 and the Blueprint for D01, D02 and D09" is therefore done on disk and waits for a commit (P00 step 1).
- Open item "Optionally diff the hosted `assets/`" is still open and is not needed by any package.
- Checked while planning: `src/ui/styles.css` contains every class name used in `docs/screens/styles.css`, so the UI kit's styles already exist in the app. The React components for dialogs, toasts, tabs, steppers and timelines do not (no file under `src/` references a toast or sets `data-theme`).

## 9. Answers given on 2026-11-13 (after the simplification audit)

Asked with the question tool. These four are now approved and no longer wait in section 6.

| ID | Answer | Effect on the plan |
| --- | --- | --- |
| PD01 | **Yes.** Add Playwright and a local Supabase stack. | P00 step 12 and Gate A's automated run are unblocked. Docker Desktop is running on the developer machine (user, 2026-11-13), which closes XD11. |
| PD02 | **Yes.** Fake provider mode, refused in production. | P00 step 10 is unblocked. QA-SYS-02 guards it. |
| PD28 | **Add a switch.** A light or dark toggle, remembered between visits. | `ThemeToggle` stays in P00 as written (SH.09, QA-S36-01). The audit's "follow the device only" option was declined. |
| PD29 | **Add the button.** Admins get "Retry failed" for emails that failed all six automatic tries. | `retry_failed_emails()` and the button are restored in P11; QA-S35-05 step 2 tests it. The audit had removed them. |

### Second round, same day: PD03 to PD27

All 25 were asked with the question tool. 23 were approved as proposed. Two were changed (marked **Changed**) and each needed one follow-up, also answered.

| ID | Answer | Effect on the plan |
| --- | --- | --- |
| PD03 | Approved: three types (Originals, Prints, Ready-made) | None |
| PD04 | Approved: PIN format check only | None. `S09.i.03` stays deferred. |
| PD05 | Approved: shipped time is the click time | None |
| PD06 | Approved: video up to 50 MB and 3 minutes | None |
| PD07 | Approved: hidden cap of 50 links per Artist | None |
| PD08 | Approved: Receipt is a printable summary | None |
| PD09 | Approved: count views once per session | None |
| PD10 | Approved: Admin edits the text, original kept privately | None |
| PD11 | Approved: chips append to the review text | None |
| PD12 | Approved: Buyer phone lives in the saved address | None |
| PD13 | Approved: Contact page with a support email | None |
| PD14 | Approved: keep the gift note | None |
| PD15 | Approved: overview computed on demand | None |
| PD16 | Approved: one `audit_log` table | None |
| PD17 | Approved: close shop only when everything is clear | None |
| PD18 | Approved: email switches as in the mock | None |
| PD19 | Approved: 2.36% assumed payment cost, labelled "estimate" | None. Confirm the rate against the Razorpay plan (XD01). |
| PD20 | Approved: rating, then review count, then newest | None |
| PD21 | Approved: blocking acceptance dialog | None |
| PD22 | **Changed twice. Final answer (user, 2026-11-13):** the Artist's **id is the permanent address**. A short name (slug) such as `craftme.com/artist/meera-iyer` is only an alias that **redirects to `/artist/<id>`**. The Artist **can change the slug**; the id never changes. This replaces the earlier follow-up answer "link stays fixed". | P03 adds a `slug` column, filled by a trigger when the Artist role is granted, a backfill, `set_artist_slug`, and a redirect on `/artist/:key`. P07's settings page lets the Artist change it. All in-app links, emails and notifications keep using the id. QA-S04-01 and QA-S28-03 test it. **Open point, my choice until you say otherwise:** when a slug is changed, the old one stops redirecting at once and can be taken by someone else. Keeping old names redirecting needs a history table. |
| PD23 | Approved: add Admins by email; never remove yourself or the last one | None |
| PD24 | Approved: a waiting deletion can be cancelled | None |
| PD25 | Approved: keep legal name and PAN only if the Artist was ever paid | None. Still to confirm with the accountant (XD03). |
| PD26 | **Changed: an Admin may lift a Restriction for money owed** (override). Follow-up: the 60-day rule restricts that Artist again **only for a new debt**. | P09 adds `owed_override_since`; the lift is allowed with a warning; the sweep skips an overridden debt. The `owed_unsettled` refusal is removed. QA-S33-04 is rewritten for the override. |
| PD27 | Approved: a duplicate onboarding fee is refunded automatically | None |

No PD is waiting any more. Sections 6's wording for PD22 and PD26 is superseded by this table.
