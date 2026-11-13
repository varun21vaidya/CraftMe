# CraftMe: Full Project Blueprint

Version 3.0 · 2026-11-07 · This is the single plan. `PLAN.md` is a short summary that points here. Capitalised domain words (Artwork, Listing, Order, Payout, Commission…) are defined in [GLOSSARY.md](GLOSSARY.md). Key decisions have records in [docs/adr/](docs/adr/).

**What changed in 3.0:**
- **Payments:** CraftMe collects every payment through its own Razorpay account. It pays Artists by hand on the 1st and 15th, after the damage window, and keeps a Commission plus a one-time Onboarding Fee ([ADR 0004](docs/adr/0004-craftme-collects-and-pays-artists.md)). This replaces the UPI-direct model of v2.0 ([ADR 0001](docs/adr/0001-buyers-pay-artists-by-upi.md), superseded).
- **Instagram** joins v1: Connected Instagram, an Instagram Showcase, and reel links on Artworks.
- **Goal:** a complete demo in test mode first. Going live is a separate final phase, after a business is registered.

**How to read the status marks**

| Mark | Meaning |
|---|---|
| ✅ Done | The code is present and reads correct on its own. **Nothing has been run**, so "done" means "no defect found by reading". A file that fails to parse is never marked done. |
| 🟡 Partial | Code exists but is broken, unrouted, missing pieces, or built for an old model. |
| ⬜ Not started | Intended, no code. |
| 🔵 Later | Intended for after launch. |

---

## Part 1. The overall aspect

### 1.1 What CraftMe is
An online marketplace in India where independent Artists sell physical original artwork and prints. Buyers pay CraftMe at checkout; the Artist ships the parcel; CraftMe pays the Artist their share after the damage window. Artists can connect Instagram to show their posts and reels.

### 1.2 Who it is for
| Persona | Needs | What CraftMe gives them |
|---|---|---|
| **Buyer** | Find art, trust the seller, pay safely, get help if something goes wrong | Browse and search, Artist profiles with Reviews and Instagram Showcase, Razorpay checkout, Order stages, Damage Reports, Refunds from CraftMe |
| **Artist** | Show work where Buyers can buy it, get paid reliably, low effort | Artworks with Listings, video or Instagram reel, Connected Instagram, Order inbox, Payout statements twice a month |
| **Admin** (the operator, currently the developer) | Keep the shop honest, pay Artists correctly, earn the Commission | Queues for Damage Reports, Overdue Orders, Reviews and Reports; Refunds; Payout runs; Artist Verification checks; Restriction; Takedown |

### 1.3 Value proposition
- Buyers: original art with CraftMe standing behind every Order (payment protection, Refunds).
- Artists: a shop built from their existing Instagram work, payment handled for them, and no monthly bills.
- Operator: income from every sale (Commission) and each new Artist (Onboarding Fee), with no fees to chase.

### 1.4 Business model (decided, see ADR 0004)
- **Onboarding Fee:** one-time and non-refundable, paid by an Artist to join. The amount is a setting.
- **Commission:** a percentage of each Order kept by CraftMe. The rate is a setting, to be chosen before go-live.
- **Payout:** for each Payable Order, the price, minus Refunds, minus Commission, minus Razorpay's fee. An Order is Payable once it is Received and 3 days have passed with no open Damage Report. The Admin sends Payouts by UPI or bank transfer on the **1st and 15th** and records each reference. RazorpayX automated payouts are a later option.
- **Late Refunds:** a Refund made after the Artist was paid becomes an **Amount Owed**, taken from their next Payouts. If it is still unsettled after 60 days, the Artist is **Restricted**.
- **Razorpay's fee is never returned on refunds**, so checkout holds stock for 15 minutes (the Checkout Hold) to avoid paying-then-refunding.

### 1.5 Product principles
1. **Server decides money and stages.** Prices, stock, Order stages, Payouts and roles change only through server functions; rules block everything else.
2. **Verified payments only.** An Order is Paid only when Razorpay confirms it (signature checked).
3. **Record every money movement.** Every Refund and Payout has a reference and a reason.
4. **Never copy Instagram content.** Store links and IDs; show official embeds (Meta's terms).
5. **Public by default.** Browsing needs no account.
6. **Demo first.** Everything works end to end in test mode before any real money moves.
7. **Everything testable locally**, with the Firebase emulators.

### 1.6 Scope
**The launch core (v1, built and demoed in test mode):**
- Accounts with additive roles.
- Becoming an Artist: Artist Verification and the Onboarding Fee.
- Artworks with Listings, up to 5 photos, an uploaded video or Instagram reel, and 7 Categories.
- Sold and Ended Listings, Report and Takedown.
- Browse, detail and prefix search.
- A one-Artist Cart, Checkout Hold and Razorpay checkout.
- Order stages Paid → Shipped → Received, and Overdue.
- Shipping address visible only to that Artist.
- Damage Reports and per-line Refunds.
- Payable Orders, Payout runs on the 1st and 15th, Amount Owed and Restricted.
- Reviews of Artists with Admin approval.
- Connected Instagram, Instagram Showcase and pasted links.
- In-app notifications, and three emails: the Buyer's order confirmation, the Artist's new Order, and the Artist's Payout sent.
- Admin queues, security rules with tests, a demo deployment.

**Go-live (separate phase, when ready):**
- Register a business.
- Get a lawyer's and an accountant's advice.
- Get Razorpay's live marketplace approval in writing.
- Pass Meta business verification and App Review.
- Set the real Commission and Onboarding Fee.

**Release 1.1 (🔵):**
- RazorpayX automated payouts.
- Artist approval workflow.
- Thumbnails.
- Admin audit log.
- Moderation API for Reviews.
- Shipped and refund emails.
- Courier tracking.
- Strict CSP.

**Later (🔵):**
- Route split payments, once CraftMe qualifies.
- Multi-Artist carts.
- Messaging, commissions, auctions.
- Shipping rates and tax, multi-currency.
- Mobile app.
- Wishlists and following, recommendations.

### 1.7 Success measures
| Area | Measure |
|---|---|
| Works | In test mode: a Buyer finds a Listing, pays with a Razorpay test method, the Artist ships, the Buyer confirms Received and reviews; on the next 1st or 15th the Order appears in the Payout run with the correct amount |
| Safe | Rules tests prove no one can read another person's Orders, address or Artist Verification, change a role, price, stage, Payout or Restriction |
| Correct money | Payout amounts match price − Refunds − Commission − gateway fee for every Order in the test fixtures; no Order is paid out twice |
| Fair | Two Buyers can never both pay for the same Original |
| Fast | Lighthouse performance 90 or higher on home and Artwork pages; embeds load only when scrolled into view; a JavaScript budget set from the first `vite build` |
| Reliable | CI green; webhook and sweep are idempotent (safe to run twice) |
| Accessible | Lighthouse accessibility 95 or higher; keyboard-only purchase path |
| Cheap | Firebase Blaze free quotas at demo volume; budget alert; video storage watched |

---

## Part 2. How the project should have started

The repository began with `create-react-app`. The files that followed show signs of being written piece by piece without running the whole app: half-finished fragments, duplicate definitions, and code for different layers in the same file. This is the order that avoids that, and it is the order the rebuild follows.

### 2.1 Before any code (1 day)
1. **Write a one-page brief**: problem, users, scope (Part 1). Decide the business model, how money moves, the country and currency up front. This rebuild settled them in a grilling session on 2026-11-07, where the payment model changed three times. That is exactly why it belongs before code.
2. **Check outside constraints early**: payment provider eligibility, legal duties, third-party APIs (Instagram). Two of today's decisions were reshaped by facts found only in that research.
3. **Fix the language** in a glossary (Artwork vs Listing, Order vs Order Line, Paid vs Received, Payable vs Payout).
4. **List user stories** with acceptance criteria (Part 4).
5. **Choose the stack and record why** (Part 5); write ADRs for hard-to-reverse decisions.
6. **Design the data model and access rules on paper.**
7. **Draw the main flows** and mark which steps run in the browser and which on the server.

### 2.2 Day one of code: a walking skeleton (1 day)
1. Repo with `main` branch, `.gitignore` covering all `.env*` before the first `git add`, `README`, license. Commit first, so work is never only on disk.
2. Vite app + one page, deployed to a Firebase **staging** project.
3. Emulator Suite configured; one callable function; one Firestore read; one rule; one test of each.
4. Lint, format, test and build in CI on every push.
5. Secrets via `.env.example` (browser) and Secret Manager (server).

### 2.3 Then build vertical slices
Auth and roles, rules, catalog, Orders and payment, Instagram, trust features, Payouts and admin. Each slice includes UI, service, rules, function, tests and docs, and is merged only when it meets the definition of done (Part 9).

### 2.4 Habits that would have prevented today's state
| Habit | Problem it prevents here |
|---|---|
| Commit small and often, with messages | One commit exists; all real work is untracked |
| Run the app after every change | Syntax errors, missing imports and undefined variables went unnoticed |
| One file, one job | `functions/index.js` holds client code; `ReviewModeration.js` holds three components |
| Write rules and tests with the feature | Rules were pasted in layers and contradict each other |
| Run any code before keeping it, wherever it came from | Duplicate blocks, stray fragments, calls to libraries that aren't installed |
| Keep one source of truth | Two rules files; the admin flag read from two places |
| Agree the domain words first | `customerId` vs `userId`; one price for both originals and prints |
| Install a dependency only when used | Unused TensorFlow, Stripe, DataGrid; frontend libraries in the functions package |

### 2.5 What was actually done (for the record)
| Step | Result |
|---|---|
| CRA scaffold, one commit, 2025-04-01 | Done |
| Firebase config files for project `craftme-3851a` | Written. Not verified: that the project exists. Wrong: the hosting folder |
| Services, contexts, forms, admin and review pages | Written as separate files, never run together; built for a Stripe checkout |
| Routing, theme, store, user service | Empty files |
| Tests | One stale CRA test; one test that cannot run |
| Work saved in git | Only the 18 starter files are committed; all real work and the env files are untracked |

---

## Part 3. Current state, file by file

This describes today's code. Much of it was built for a Stripe model and will be replaced; Part 11 lists what is reused.

| File | Status | Note |
|---|---|---|
| `src/index.js` | ✅ | Standard entry |
| `src/App.js` | 🟡 | Two routes only; imports `Login` as default but it is a named export; imports an empty theme file |
| `src/config/firebase.js` | 🟡 | Missing `connectAuthEmulator` import; `functions` never exported; emulators always on in dev |
| `src/config/routes.js` · `theme.js` · `store/store.js` · `services/user.service.js` | ⬜ | Empty |
| `src/contexts/AuthContext.js` | 🟡 | Works in principle; spreads the Firebase user; claims fetched on every change |
| `src/contexts/CartContext.js` | ✅ | Reducer logic correct; not mounted; no persistence; no one-Artist rule |
| `src/components/auth/Login.js` | 🟡 | Google sign-in; named export; no redirect after sign-in |
| `src/components/common/ProtectedRoute.js` · `AdminRoute.js` | ✅ | Correct guards; reuse |
| `src/components/common/ErrorBoundary.js` | ✅ | Works; not mounted |
| `src/components/common/NotificationBell.js` | 🟡 | No export, no click-to-read; depends on `moment` (not installed in the app) |
| `src/components/dashboard/ArtworkUploadForm.js` | 🟡 | Good validation schema; only the title field rendered; no export |
| `src/components/reviews/ReviewForm.js` | 🟡 | Good validation; missing import and export; reviews an artwork (plan reviews Artists) |
| `src/components/reviews/ReviewList.js` · `ReviewItem.js` | ⬜ | Empty files |
| `src/components/ui/LazyLoadImage.js` | ✅ | Works; the WebP trick appends an invalid query |
| `src/components/checkout/Confirmation.js` | 🟡 | Depends on router state; not routed |
| `src/components/admin/SalesChart.js` | 🟡 | Syntax error; uses an uninstalled library |
| `src/pages/Home/index.js` | 🟡 | Placeholder image doesn't exist |
| `src/pages/Checkout/Checkout.js` · `src/services/payment.service.js` | 🟡 | Stripe card flow, broken; replaced by Razorpay Checkout |
| `src/pages/Admin/ReviewModeration.js` | 🟡 | Does not compile |
| `src/pages/AdminDashboard/index.js` · `UserManager.js` | 🟡 | Wrong import path and admin flag; email/uid mismatch |
| `src/services/artwork.service.js` · `order.service.js` · `review.service.js` · `notification.service.js` · `analytics.service.js` | 🟡 | Missing imports; `limit` shadowing; invalid analytics path; client-side order creation |
| `src/services/admin.service.js` · `email.service.js` · `moderation.service.js` | 🟡 | Call functions that don't exist |
| `src/lib/validation/sanitize.js` | 🟡 | Syntax error in `validatePrice` |
| `src/lib/security/csrf.js` · `src/lib/api/rateLimiter.js` | 🟡 | Give no real protection; remove |
| `src/firestore.rules` · `firestore.rules` | 🟡 | Second never deploys; the deployed one is invalid and allows privilege escalation |
| `functions/index.js` · `src/functions/src/orders/emails.js` | 🟡 | Mixed module styles, missing `admin`, client code inside; second file in the wrong folder |
| `src/sendgrid.html` | ✅ | Usable email template draft |
| `functions/package.json` | 🟡 | Frontend libraries inside; Stripe not needed; `razorpay` belongs here |
| `firebase.json` | 🟡 | Hosting folder wrong; no emulators section |
| `.eslintrc.js` · `.prettierrc` (root) | ⬜ | Empty |
| Tests | 🟡 | `App.test.js` stale; `artwork.service.test.js` cannot run |

---

## Part 4. Full feature inventory

Legend: ✅ done · 🟡 partial · ⬜ not started · 🔵 later.

### 4.1 Accounts and roles
| # | Feature | Status | Work needed |
|---|---|---|---|
| A1 | Google sign-in | 🟡 | Fix export, redirect after sign-in, error messages |
| A2 | ~~Email + password sign-in and sign-up~~ | ⛔ | Superseded: Google is the only login (screen-parity decision D01). S06 stays deferred. |
| A3 | ~~Password reset~~ | ⛔ | Superseded with A2 (D01). S07 stays deferred. |
| A4 | GitHub sign-in | 🟡 | Provider exists; add a button or remove |
| A5 | Sign-out | ⬜ | Header menu |
| A6 | Auth state in context | 🟡 | Clean up; expose `isAdmin`, `isArtist` |
| A7 | Additive roles (Buyer, Artist, Admin) as custom claims | 🟡 | Admin claim exists; add Artist; clients can't change claims |
| A8 | Profile document created on first sign-in | ⬜ | Auth trigger |
| A9 | Profile page (name, photo, bio) | ⬜ | Page; rule limits editable fields |
| A10 | Become an Artist: Artist Verification (legal name, PAN, payout UPI or bank, verified phone) | ⬜ | Built in full (D02). Form, phone OTP over WhatsApp via the Supabase Send SMS Hook and Meta Cloud API (D03; replaces Firebase Auth OTP), private storage |
| A11 | Pay the Onboarding Fee (Razorpay Checkout) to get the Artist role | ⬜ | Edge Function command + webhook (D02) |
| A12 | Protected routes | ✅ | Reuse |
| A13 | Admin-only routes | ✅ | Reuse; one place for the role check |
| A14 | Delete account / export data | ⬜ | Deletion is in scope (D11): self-serve request, auto-anonymize once no open orders, reports or unsettled payouts. Export stays later. |

### 4.2 Artist tools
| # | Feature | Status | Work needed |
|---|---|---|---|
| B1 | Artwork form: title, description, Category | 🟡 | Rebuild around the existing schema |
| B2 | Photo checks (JPEG/PNG, 5 MB) | ✅ | Reuse; same check in Storage rules |
| B3 | Up to 5 photos, first is the cover | 🟡 | Extend single-image upload; generated names; per-Artist folder |
| B4 | Photo preview before upload | ✅ | Revoke object URLs after use |
| B5 | Video: upload (MP4, ≤3 min, ≤200 MB) **or** an Instagram reel link | ⬜ | Upload with Storage rule; reel picker or pasted link |
| B6 | Listings per Artwork: Original (stock 1) or Print (size, medium, stock) | ⬜ | Listing form and list |
| B7 | Listing price in rupees, no limits (₹1 floor in practice) | ⬜ | Stored in paise |
| B8 | Draft and published | 🟡 | Draft exists; publish needs Artist role and not Restricted |
| B9 | End and reopen a Listing | ⬜ | Action |
| B10 | Delete an Artwork only if never sold | ⬜ | Server check |
| B11 | Artist dashboard: Artworks, Listings, Order inbox, Payouts, Amount Owed | ⬜ | Pages |
| B12 | Order inbox: mark Shipped with optional tracking number; see address once Paid | ⬜ | Server functions |
| B13 | Public Artist profile: Reviews, average rating, Instagram Showcase | ⬜ | Page |
| B14 | Server-side upload limits | ⬜ | Replaces the browser-only limiter |
| B15 | Thumbnails | 🔵 | 1.1 |

### 4.3 Instagram
| # | Feature | Status | Work needed |
|---|---|---|---|
| IG1 | Meta developer app (Instagram API with Instagram Login), development mode for the demo | ⬜ | App setup; tester accounts |
| IG2 | Connect Instagram (Business/Creator only): OAuth, exchange for a 60-day token, stored server-side only | ⬜ | Callable + functions-only token store |
| IG3 | Token refresh before 60 days; reconnect prompt if it lapses | ⬜ | Sweep job |
| IG4 | Pick posts and reels from the Artist's own feed | ⬜ | Function lists media; Artist picks |
| IG5 | Instagram Showcase: up to 9 posts/reels on the profile | ⬜ | Confirmed (D09): 9 mixed posts and reels, replacing the app's 12 total / 6 highlighted reel caps. Store permalinks only; render official embeds |
| IG6 | Reel link on an Artwork (picked or pasted) | ⬜ | Same embed component |
| IG7 | Paste-a-link fallback for personal accounts and before Meta approval | ⬜ | Link validation (Instagram post/reel URL) |
| IG8 | Embeds load only when scrolled into view | ⬜ | Lazy embed component |
| IG9 | Disconnect, plus Meta's deauthorise and data-deletion callbacks | ⬜ | HTTPS functions; delete the token and all API-imported picks on disconnect or request. Links the artist pasted themselves are kept (D09) |
| IG10 | Connect button hidden until Meta approves (feature switch) | ⬜ | Setting |

### 4.4 Discovery
| # | Feature | Status | Work needed |
|---|---|---|---|
| C1 | Recent Artworks query | 🟡 | Fix imports and `limit` |
| C2 | Home page | 🟡 | Real content; placeholder image missing |
| C3 | Browse with pagination | ⬜ | `startAfter` paging |
| C4 | Filters: Category, price, Original vs Print | ⬜ | Indexes on Listings |
| C5 | Search by title prefix | ⬜ | Prefix query |
| C6 | Artwork page: photos, video or reel, Listings with Sold state, Artist card, Report | ⬜ | Page |
| C7 | Lazy-loaded images | ✅ | Reuse |
| C8 | View counter | 🟡 | Increment through a function |
| C9 | Sorting (newest, price) | ⬜ | Indexes |
| C10 | Full-text search, recommendations, wishlist, following | 🔵 | — |

### 4.5 Cart, checkout and Orders
| # | Feature | Status | Work needed |
|---|---|---|---|
| D1 | Cart: add, remove, totals | ✅ | Reducer is correct |
| D2 | Quantity for Prints (Originals fixed at 1) | 🟡 | Set-quantity, cap at stock |
| D3 | Cart saved across reloads | ⬜ | localStorage |
| D4 | One Artist per Cart, "start a new Cart?" dialog | ⬜ | Reducer + server check |
| D5 | Live price and stock check; changes shown before paying | ⬜ | Server function |
| D6 | Shipping address (India only, PIN check) | ⬜ | Form |
| D7 | Pay: Checkout Hold (15 min) + Razorpay order created on the server | ⬜ | `placeOrder` transaction |
| D8 | Razorpay Checkout in the browser; signature verified on the server | 🟡 | Stripe flow exists; replace |
| D9 | Payment webhook (backup to the browser callback), idempotent | ⬜ | HTTPS function |
| D10 | Hold expiry returns stock | ⬜ | Sweep |
| D11 | Stages Paid → Shipped → Received (Buyer confirms or auto after 14 days) | ⬜ | Functions + sweep |
| D12 | Ship reminder day 5; Overdue day 7 | ⬜ | Sweep + Admin queue |
| D13 | Order page for the Buyer | 🟡 | `Confirmation.js` as a base; Order ID from the URL |
| D14 | Order history | 🟡 | Rebuild as a page |
| D15 | Shipping address visible only to that Artist, once Paid | ⬜ | Private sub-document + rule |
| D16 | Tax, shipping rates, multi-currency, coupons, multi-Artist carts | 🔵 | — |

### 4.6 Damage Reports and Refunds
| # | Feature | Status | Work needed |
|---|---|---|---|
| R1 | Damage Report within 3 days of Received, with photos | ⬜ | Form, uploads, queue; holds the Payout |
| R2 | Admin decides Damage Reports and Overdue Orders | ⬜ | Queue |
| R3 | Refund per Order Line through Razorpay's refund API | ⬜ | Admin action; records Razorpay refund ID |
| R4 | Refund before Payout reduces that Order's Payout | ⬜ | Payout calculation |
| R5 | Refund after Payout creates an Amount Owed | ⬜ | Ledger entry; deducted from next Payouts |
| R6 | No Buyer self-cancel; policy on the Order page and in the terms | ⬜ | Copy |

### 4.7 Reviews
| # | Feature | Status | Work needed |
|---|---|---|---|
| E1 | Review form: stars + comment (500 chars) | 🟡 | Reuse the schema; target the Artist |
| E2 | One Review per Order, from Received for 30 days | ⬜ | Rule using the Order |
| E3 | Admin approves every Review | 🟡 | Rewrite `ReviewModeration.js` as one queue |
| E4 | Reviews on the Artist profile, paginated | 🟡 | Query exists; list and item components are empty |
| E5 | Average rating on the Artist | ⬜ | Function on approval |
| E6 | Moderation API, Artist replies | 🔵 | — |

### 4.8 Notifications and email
| # | Feature | Status | Work needed |
|---|---|---|---|
| F1 | Notification bell and list | 🟡 | Export, mark read, links |
| F2 | Real-time subscription | 🟡 | Missing imports |
| F3 | In-app events: new Order, ship reminder, Overdue, Received, Damage Report opened or decided, Refund issued, Review approved, Payout sent, Restricted, Instagram reconnect needed | ⬜ | Triggers + sweep |
| F4 | Email: Buyer order confirmation | 🟡 | Three broken drafts; one handler |
| F5 | Email: Artist new Order | ⬜ | Same handler |
| F6 | Email: Artist Payout sent | ⬜ | On Payout recorded |
| F7 | Email template base | ✅ | `sendgrid.html` |
| F8 | Shipped and refund emails, email preferences | 🔵 | 1.1 |

### 4.9 Payouts and Artist money
| # | Feature | Status | Work needed |
|---|---|---|---|
| P1 | Settings: Commission rate, Onboarding Fee | ⬜ | Admin-only settings; amounts chosen before go-live |
| P2 | Payable calculation (Received + 3 days, no open Damage Report) | ⬜ | Sweep marks Orders Payable |
| P3 | Payout run on the 1st and 15th: list per Artist with every Order, Refund, Commission, gateway fee and Amount Owed | ⬜ | Admin page |
| P4 | Record each transfer's reference; Orders marked paid out; never twice | ⬜ | Transaction |
| P5 | Artist Payout statements | ⬜ | Page |
| P6 | Amount Owed tracking and deduction | ⬜ | Ledger |
| P7 | Restricted after 60 days owed, or by the Admin with a reason; lifting | ⬜ | Sweep + Admin action |
| P8 | Admin checks Artist Verification before the first Payout | ⬜ | Queue item |
| P9 | RazorpayX automated payouts | 🔵 | 1.1 |

### 4.10 Admin
| # | Feature | Status | Work needed |
|---|---|---|---|
| G1 | Grant and revoke roles (uid or email) | 🟡 | Rewrite the function |
| G2 | First-admin bootstrap script | ⬜ | Admin SDK script |
| G3 | Queues: Damage Reports, Overdue, Reviews, Reports, Artist Verification | ⬜ | One page with tabs |
| G4 | Takedown of Artworks and Listings | ⬜ | Action |
| G5 | Artists list: verification, Onboarding Fee, Amount Owed, Restriction | 🟡 | `UserManager.js` as a starting point |
| G6 | Dashboard: Orders, sales, Commission earned, Payouts sent | 🟡 | Chart code exists but is broken |
| G7 | Admin audit log | 🔵 | 1.1 |

### 4.11 Security and trust
| # | Feature | Status | Work needed |
|---|---|---|---|
| H1 | Firestore rules | 🟡 | Rewrite (Part 5.5) |
| H2 | Storage rules (photos, video, damage photos) | ⬜ | Write |
| H3 | Rules unit tests | ⬜ | `@firebase/rules-unit-testing` |
| H4 | Input sanitising | 🟡 | Fix the file's syntax error; store plain text |
| H5 | App Check | ⬜ | reCAPTCHA Enterprise |
| H6 | Server-side limits (uploads, open Checkout Holds per Buyer) | ⬜ | Stops one Buyer locking many Originals |
| H7 | Secrets: Razorpay keys and webhook secret, Instagram app secret, email key | ⬜ | Secret Manager |
| H8 | Protect Artist Verification data (PAN, bank) | ⬜ | Functions-only writes, Artist and Admin reads, masked display |
| H9 | Security headers | ⬜ | Basic now; strict CSP in 1.1 (allow Instagram embeds) |
| H10 | Terms, privacy, refund policy, Artist agreement | ⬜ | Pages; reviewed by a lawyer at go-live |
| H11 | Error monitoring | ⬜ | Sentry |
| H12 | CSRF helper, browser rate limiter | 🟡 | Remove |

### 4.12 Platform and quality
| # | Feature | Status | Work needed |
|---|---|---|---|
| I1 | Theme | ⬜ | `theme.js` is empty |
| I2 | Layout, navigation, footer | ⬜ | — |
| I3 | Error boundary | ✅ | Mount at the root |
| I4 | 404, loading and empty states | ⬜ | — |
| I5 | Offline cache | 🟡 | Deprecated API |
| I6 | Mobile-first design | ⬜ | Most Buyers pay on a phone |
| I7 | Accessibility | ⬜ | — |
| I8 | SEO and share previews | ⬜ | Titles, meta, prerender Artwork pages |
| I9 | Tests | 🟡 | Rebuild the suite |
| I10 | CI/CD, staging (demo) and production | ⬜ | — |
| I11 | Documentation, demo seed data | 🟡 | README is the CRA default |

**Totals:** 124 features: 8 done, 29 partial, 79 not started, 8 later. No feature has been proven by running it.

---

## Part 5. Architecture

### 5.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** | CRA is deprecated |
| UI | **React 19**, **React Router 7**, **MUI 7** | Already in use |
| Forms | **Formik + Yup** | Already used |
| Data and auth | **Firebase** (Auth incl. phone OTP, Firestore, Storage, Functions v2, Scheduler, App Check) | Serverless, emulators, scheduled sweep |
| Payments | **Razorpay** on CraftMe's account: Checkout for Orders and the Onboarding Fee, refunds API, webhooks | ADR 0004 |
| Payouts | Manual bank/UPI transfers recorded in CraftMe | No current account needed; RazorpayX later |
| Instagram | **Instagram API with Instagram Login** (Connect, list own media), **official embeds** for display | Only supported way since Basic Display shut down (Dec 2024); embeds need no token since June 2026 |
| Email | **SendGrid** | Template exists |
| Monitoring | **Sentry** | Browser and functions |
| Tests | **Vitest**, **Testing Library**, **rules-unit-testing**, **Playwright** | UI, rules, functions with a fake clock, end-to-end |
| Language | JavaScript; TypeScript later if wanted | Matches existing code |

### 5.2 System diagram
```
 Browser (React SPA on Firebase Hosting)
   │  public reads: Artworks, Listings, Artist profiles (Instagram embeds load lazily)
   │  placeOrder ──────────► Functions: one Artist, live prices, stock → Checkout Hold,
   │                         create Razorpay order → returns order ID
   │  Razorpay Checkout ───► Buyer pays CraftMe ──► confirmPayment (signature) → Paid
   │  Artist: markShipped · Buyer: confirmReceived, reportDamage, review
   │  Artist: connectInstagram (OAuth) → pick posts/reels → store permalinks
   ▼
 Cloud Functions (Node 22, CommonJS)
   ├─ Callables: placeOrder, confirmPayment, markShipped, confirmReceived, reportDamage,
   │             decideDamage, issueRefund, submitVerification, payOnboardingFee,
   │             buildPayoutRun, recordPayout, restrictArtist, setUserRole, takedown,
   │             decideReview, report, connectInstagram, listInstagramMedia, saveShowcase
   ├─ HTTPS: razorpayWebhook (signature checked, idempotent),
   │         instagramDeauthorize, instagramDataDeletion
   ├─ Firestore triggers: Order stage changes → notifications, emails, daily stats
   ├─ Auth trigger: onUserCreated
   └─ Scheduled: sweep every 5 minutes (Part 5.6)
   ▼
 Firestore · Storage · Secret Manager · Razorpay · Instagram Graph API · SendGrid · Sentry
```

### 5.3 Folder structure (target)
```
artist-marketplace/
  src/
    app/             App.jsx, router, providers, theme
    features/
      auth/          Login, SignUp, context
      catalog/       Artwork and Listing services, Browse, ArtworkPage, forms
      cart/          context, CartPage
      orders/        Checkout, OrderPage, OrderHistory, ArtistInbox
      damage/        DamageReport, RefundList
      reviews/       ReviewForm, ReviewList, ReviewItem
      instagram/     ConnectButton, MediaPicker, Showcase, InstagramEmbed
      payouts/       PayoutStatements (Artist), PayoutRun (Admin)
      notifications/ Bell, service
      admin/         Queues, Artists, Dashboard, Settings
      artist/        BecomeArtist, Verification, Dashboard, Profile
    components/      Layout, ErrorBoundary, LazyImage, EmptyState
    api/             firebase.js, gateway.js — the ONLY folder that imports firebase/* (ESLint rule)
    lib/             format.js (formatINR, reasonText), useCountdown.js
  functions/src/
    lib/             envelope.js, command.js (auth, role, schema, idempotency, envelope)
    domain/          order.js (stages, allowedActions), money.js (totals, Commission, Payout) — pure
    commands/        one file per context: orders, payments, artists, damage, reviews, payouts, admin, instagram
    ports.js         Payments (Razorpay), Messaging (SendGrid), Clock — fakes in functions/test/fakes.js
    webhook.js       raw body, HMAC, processedEvents dedupe, then the same command handler
    sweep.js         the rules in 5.6, each idempotent, ≤200 documents per run
    instagram.js     plain HTTPS to graph.instagram.com
    index.js         exports only
  rules/             firestore.rules, storage.rules, tests
  scripts/           bootstrapAdmin.js, seedDemo.js
  docs/adr/          decision records
  GLOSSARY.md
```

### 5.4 Data model
Money is stored in whole paise. All stage and money changes go through functions.

| Collection / path | Fields | Written by |
|---|---|---|
| `users/{uid}` | `displayName`, `photoURL`, `bio`, `roles[]`, `ratingAvg`, `ratingCount`, `instagramUsername`, `showcase[]` (≤9 permalinks), `restricted` (bool, public effect only) | Functions; owner edits name, photo, bio |
| `artistPrivate/{uid}` | `legalName`, `pan`, `payoutMethod` (`upi`: ID, or `bank`: account, IFSC), `phoneVerified`, `verifiedByAdminAt`, `onboardingPaidAt`, `amountOwed`, `restrictedReasons[]`, `instagram` (`connected`, `igUserId`, `tokenExpiresAt`) | Functions only; read by owner and Admin |
| `instagramTokens/{uid}` | `accessToken`, `expiresAt`, `refreshedAt` | Functions only; **no client access** |
| `artworks/{id}` | `artistId`, `title`, `description`, `category`, `photos[]` (≤5), `video` (`{type: 'upload', path}` or `{type: 'instagram', permalink}`), `status` (`draft`/`published`/`removed`), `hasSales`, `views`, `fromPricePaise`, `available`, `artistOpen`, timestamps | Artist (content, publish when allowed); functions (`hasSales`, `views`, `removed`, `fromPricePaise`, `available`, `artistOpen`) |
| `listings/{id}` | `artworkId`, `artistId`, `kind` (`original`/`print`), `size`, `medium`, `price`, `stock`, `held`, `status` (`draft`/`live`/`sold`/`ended`), `artistOpen` | Artist (draft fields, end/reopen); functions (`stock`, `held`, `sold`, `artistOpen`) |
| `orders/{id}` | `buyerId`, `artistId`, `lines[{listingId, artworkId, title, kind, unitPrice, quantity, refundedQuantity}]`, `total`, `stage` (`hold`/`hold_expired`/`paid`/`shipped`/`received`), `holdUntil`, `razorpayOrderId`, `razorpayPaymentId`, `gatewayFee`, `commissionBps` (rate at payment time), `paidAt`, `shipBy`, `shippedAt`, `trackingNumber`, `receivedAt`, `damageWindowEnds`, `payable`, `payoutId`, `refundedTotal`, `reviewBy`, `buyerActions`, `artistActions` (booleans from `allowedActions`, rewritten on every change) | **Functions only** |
| `orders/{id}/private/shipping` | name, phone, address, city, state, PIN | Via `placeOrder`; Buyer reads; Artist reads once Paid |
| `damageReports/{id}` | `orderId`, `photos[]`, `note`, `status`, `decision`, `decidedAt` | Functions only |
| `refunds/{id}` | `orderId`, `artistId`, `lines[]`, `amount`, `reason`, `razorpayRefundId`, `afterPayout`, `createdAt` | Functions only |
| `payouts/{id}` | `artistId`, `runDate`, `orderIds[]`, `gross`, `refunds`, `commission`, `gatewayFees`, `owedDeducted`, `net`, `method`, `reference`, `sentAt`, `status` (`draft`/`sent`) | Functions only (Admin actions) |
| `reviews/{orderId}` | `artistId`, `buyerId`, `buyerName`, `rating`, `comment`, `status`, `createdAt` | Buyer creates (pending) under rules; Admin decides through a function |
| `reports/{id}` | `targetType`, `targetId`, `reporterId`, `reason`, `status` | Buyer creates; Admin resolves |
| `settings/business` | `commissionBps`, `onboardingFee` (paise) | Admin only |
| `settings/public` | `instagramConnectEnabled` | Admin writes; everyone reads |
| `notifications/{id}` | `userId`, `type`, `data`, `read`, `createdAt` | Functions create; owner sets `read` |
| `analytics_daily/{yyyy-mm-dd}` | `orders`, `sales`, `commission`, `refunds`, `payoutsSent` | Functions only |
| `processedEvents/{eventId}` | `at` | Webhook idempotency |
| `requests/{uid_requestId}` | stored result envelope, `at` | Command idempotency (`command()` wrapper) |

Restriction never changes Listing `status`. It flips `artistOpen` on the Artist's Artworks and Listings, so lifting it restores exactly what was live.

### 5.5 Access rules matrix
| Collection | Public | Buyer | Artist | Admin | Functions |
|---|---|---|---|---|---|
| `users` | public fields | own profile fields | own profile fields | read | all |
| `artistPrivate` | no | no | read own | read | write |
| `instagramTokens` | no | no | no | no | all |
| `artworks` | published and `artistOpen` only | — | create/edit own content; publish only with the Artist role and not Restricted | all | all |
| `listings` | live/sold of published Artworks, `artistOpen` only | — | own drafts, end/reopen; never `stock`, `held`, `sold`, `artistOpen` | all | all |
| `orders` | no | read own | read own | read | write |
| `orders/*/private/shipping` | no | read own | read once the Order is `paid`, `shipped` or `received` | read | write |
| `damageReports`, `refunds` | no | read own | read own | read | write |
| `payouts` | no | — | read own | read | write |
| `reviews` | approved only | create one for own `received` Order before `reviewBy` | read own | decide | update |
| `reports` | no | create | — | read | update |
| `settings` | `instagramConnectEnabled` only | — | — | write | read |
| `notifications` | no | read own, set `read` | same | — | create |
| `analytics_*` | no | — | — | read | write |

Every row becomes allowed and denied tests.

### 5.6 Timers (the 5-minute sweep)
One scheduled function, idempotent, applies every rule whose time has passed.

| Rule | When | Effect |
|---|---|---|
| Checkout Hold | `holdUntil` = Pay + 15 min, not Paid | Order → `hold_expired`; stock released |
| Ship reminder | Paid + 5 days | Notify Artist |
| Overdue | Paid + 7 days, not Shipped | Admin queue (usually a Refund) |
| Auto-Received | Shipped + 14 days | Order → `received`; Damage window and Review window open |
| Payable | Received + 3 days, no open Damage Report | `payable = true` |
| Review window | Received + 30 days | Reviews close |
| Payout run | 1st and 15th, 09:00 IST | Draft Payout list built; Admin notified |
| Amount Owed | Unsettled 60 days | Artist Restricted (reason recorded) |
| Instagram token | Expires within 10 days | Refresh; if refresh fails, notify Artist to reconnect |

### 5.7 Routes
| Path | Access | Page |
|---|---|---|
| `/`, `/browse`, `/artwork/:id`, `/artist/:id` | public | Home, browse, Artwork, Artist profile with Showcase |
| `/login`, `/signup`, `/reset` | public | Auth |
| `/cart`, `/checkout` | signed in | Cart, address, pay |
| `/orders`, `/orders/:id` | Buyer | History, Order page (Received, Damage Report, Review) |
| `/profile`, `/become-artist` | signed in | Profile; Artist Verification and Onboarding Fee |
| `/dashboard/*` | Artist | Artworks, Listings, Order inbox, Payouts, Instagram |
| `/admin/*` | Admin | Queues, Payout runs, Artists, Reports, settings, dashboard |
| `/legal/*` | public | Terms, privacy, refund policy, Artist agreement, data deletion |
| `*` | public | 404 |

---

## Part 6. Detailed build plan

Phases 0–8 build the full app and run it as a **demo in test mode**. Phase 9 (go-live) starts only when you decide to take real money. Estimates are for one developer and are judgement.

### Phase 0. Reset and tooling (0.5 day)
- Add all `.env*` (except `.env.example`) to `.gitignore`; commit current work to a `legacy-scaffold` branch; create `main` from the starter commit. Nothing sensitive was ever committed.
- Create a Razorpay account in **test mode** (no business needed for test keys).
- Create a Meta developer app in **development mode** with your own Instagram Business/Creator account as a tester.
- Delete legacy code that is broken, unsafe or unused (all marked in Part 3):
  - both rules files (`firestore.rules` does not compile; written as-is it would let the browser set an Order total, let anyone create Reviews, and let users write their own `roles`); `src/firestore.rules` never deploys;
  - `src/functions/` (decrements stock before payment, wrong package); `src/lib/` (client rate limiter, CSRF helper, broken `sanitize.js`; React already escapes text);
  - `src/services/admin`, `email`, `moderation`, `analytics`, `user`, `payment` services; `SalesChart.js`; `ReviewModeration.js`; empty `routes.js`, `theme.js`, `store/`, `ReviewList.js`, `ReviewItem.js`; `functions/src/moderation/`; CRA test and web-vitals files;
  - `functions/index.js` body (Stripe, two unpaid-Order triggers, UTC day, ES `export` in CommonJS).
- Vite scaffold (rename JSX files to `.jsx`, `REACT_APP_*` → `VITE_*` in code; you rename the keys in your `.env.*` by hand); `firebase.json` hosting to `dist` plus emulators; placeholder image; ESLint, Prettier, EditorConfig, `.env.example`; clean dependencies (Part 7.1).
- **Done when:** dev server and emulators start; lint and build pass; none of the deleted files remain.

### Phase 1. Foundation (2.5 days)
- `src/api/firebase.js`: `initializeFirestore` with `persistentLocalCache` + `persistentMultipleTabManager` (replaces the deprecated `enableIndexedDbPersistence`); export `functions` for `asia-south1`; emulators only when `VITE_EMULATORS === '1'`; drop the GitHub provider.
- `src/api/gateway.js`: `call(name, input)` adds a request id and always resolves to the envelope; read hooks on `react-firebase-hooks`; direct writes `saveProfile`, `saveDraft`, `markRead`; `upload`.
- ESLint `no-restricted-imports`: `firebase/*` and `razorpay` banned outside `src/api/**`.
- `AuthContext` rewrite: plain `{uid, email, displayName, photoURL, claims}`, memoised value, `getIdTokenResult()` without force; `refreshClaims()` forces only after `becomeArtist` or `setRole`. Email and Google sign-in; sign-out; reset; `onUserCreated`.
- `functions/src/lib/envelope.js` and `command.js` (auth, role, Yup schema, idempotency in `requests/`, error mapping); `functions/src/ports.js` with fakes.
- Router per 5.7; guards for Buyer, Artist, Admin.
- Theme, layout, nav, 404; `ErrorBoundary` per route showing fixed copy and the request id, never `error.message`; `lib/format.js`; first `vite build` to set the JavaScript budget.
- **Done when:** sign in and out on emulators; guards redirect correctly; `npx eslint src` shows no restricted imports; tests pass.

### Phase 2. Rules and data model (2 days)
- `firestore.rules` and `storage.rules` written fresh from 5.4, 5.5 and the write-authority matrix in [SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) §4.1; everything not listed is `if false`.
- Indexes: `notifications(userId, createdAt desc)`, `orders(buyerId, createdAt desc)`, `orders(artistId, stage, createdAt desc)`, `artworks(status, artistOpen, createdAt desc)`.
- Rules tests, including:
  - nobody can set their own role (including `users/{self}.roles`), `restricted`, `artistOpen` or `amountOwed`;
  - no client writes to Orders, refunds or payouts, and no client write to `listings/*.stock`;
  - `instagramTokens` and other Artists' Verification data are unreadable;
  - the shipping address is hidden until Paid;
  - Reviews only for one's own Received Order inside its window;
  - Restricted Artists can't publish.
- **Done when:** the rules suite is green in CI.

### Phase 3. Artists and catalog (5 days)
- Become-an-Artist: Artist Verification form with phone OTP; `payOnboardingFee` command → Razorpay Checkout (test mode) → `onboarding.captured` webhook sets `onboardingPaidAt`; `becomeArtist` sets the role once fee and Verification are present.
- Artwork form: reuse the Yup schema from `ArtworkUploadForm.js`; photo preview URL made once per file and revoked on change/unmount; Category, up to 5 photos, video upload (or reel link, wired up in Phase 5); Listing forms; publish, End, reopen; delete only if never sold.
- Browse as one query on `artworks` using `fromPricePaise` and `available` (never a Listings query per card), filters, prefix search; Artwork page with one live listener on its Listings, Sold state and Report; Artist profile.
- Server-side upload limits; demo seed script.
- **Done when:** a test Artist pays the Onboarding Fee, publishes an Artwork with an Original and a Print, and a visitor finds and reports it.

### Phase 4. Cart, checkout and Orders (5 days)
- Cart: reuse the reducer; store `{artistId, items: [{listingId, qty}]}` in `localStorage` (`cm-cart`, try/catch); no prices or total in the Cart; adding from another Artist returns `mixed_artists` and opens the new-Cart dialog.
- `functions/src/domain/order.js` (stages, `next`, `allowedActions`) and `money.js` (`orderTotal`), pure, with tests.
- `placeOrder`: server loads each Listing and computes the total in paise (the client sends only ids and quantities); live price and stock check returning `conflict` with changed lines (drives the price-changed Cart state); Checkout Hold in a transaction; private shipping address; Razorpay order.
- Razorpay Checkout; `confirmPayment` (signature) and `razorpayWebhook` (raw body HMAC, `processedEvents` dedupe, same handler); gateway fee recorded. Every Order change rewrites `buyerActions` and `artistActions`.
- Artist inbox (address once Paid, mark Shipped); Buyer confirms Received; Order page and history. Buttons show only from the stored allowed actions; the hold countdown is `useCountdown(holdUntil)`.
- The sweep for hold expiry, ship reminder, Overdue, auto-Received.
- **Done when:**
  - a test-mode purchase works end to end;
  - two Buyers racing for the last Original end with one Order and one "Sold" message, no charge;
  - a replayed webhook changes nothing;
  - tampering with the request can't change the price.

### Phase 5. Instagram (3 days)
- Connect Instagram: OAuth, server-side exchange for a 60-day token, stored in `instagramTokens`; refresh in the sweep.
- Media picker from the Artist's feed; save the Showcase (≤9) and an Artwork's reel as permalinks only.
- Paste-a-link fallback with URL validation; lazy official-embed component.
- Disconnect; deauthorise and data-deletion callbacks; feature switch to hide Connect until Meta approves.
- **Done when:** your tester account connects, picks posts and a reel, and they show on the profile and Artwork page; disconnecting deletes the token and picks; the paste path works with Connect switched off.

### Phase 6. Damage Reports, Refunds, Reviews, notifications, email (3.5 days)
- Damage Report form with photos and its 3-day window; Admin decisions; Overdue cases.
- Refunds per Order Line through Razorpay's refund API (test mode); Amount Owed when after Payout.
- Reviews of Artists: form, window, Admin approval, list and average.
- Notifications for the events in F3, created only from paid/later events (never on Order creation); one listener in the shell, latest 20; the three launch emails.
- **Done when:** a Damage Report blocks the Payout until decided; a partial refund lowers the Payout by exactly that line; an approved Review updates the average.

### Phase 7. Payouts and admin (3 days)
- `money.js` `payoutLine` and `payoutRun`: Commission = floor(rate_bp × (price − Refunds) / 10000); net = price − Refunds − Commission − full gateway fee − owed deducted. Test: ₹1,000, ₹400 Refund, 1000 bp, ₹30 fee → Commission 6000 paise, net 51000 paise.
- Payable marking in the sweep; Payout run page on the 1st and 15th: amounts per Artist with every line explained.
- Record transfer references; Orders marked paid out in a transaction (never twice); Artist statements; Payout-sent email.
- Amount Owed deduction; Restriction (automatic at 60 days, or by the Admin with a reason) and lifting, both by flipping `artistOpen`; a Listing the Artist ended stays ended after lifting (tested).
- First-admin script; role management; one queue page; Artists list with verification; Takedown; dashboard.
- **Done when:**
  - fixed test data produces the expected Payouts, including refunds before and after Payout;
  - recording a Payout twice is refused;
  - a non-admin can't reach any of it.

### Phase 8. Quality and demo launch (3 days)
- Tests to the targets in Part 8; Playwright paths for Buyer, Artist and Admin.
- App Check, basic security headers (allowing Instagram embeds), Sentry, budget alerts.
- Performance and accessibility passes; SEO tags; draft legal pages, marked "demo"; data-deletion page for Meta.
- CI/CD; deploy the **demo** to the staging project with test keys and seed data; README and runbook.
- **Done when:** anyone can visit the demo, buy with Razorpay test methods, and follow an Order through to a Payout run.

### Phase 9. Go-live (when you're ready; mostly not code)
Outside work, in order:
1. Register a business, on an accountant's advice: sole proprietorship with GST, or a company. Ask about GST on Commission and the Onboarding Fee, and any tax collected at source by marketplaces.
2. A lawyer reviews holding Artists' money for up to four weeks (RBI payment aggregator rules), plus the terms, refund policy and Artist agreement.
3. Razorpay live account as a **marketplace collecting for onboarded sellers**, with written confirmation of the model.
4. Meta business verification and App Review for Advanced Access (screencast of the Connect flow, privacy policy, data-deletion URL).
5. Set the Commission and Onboarding Fee.

Code (about 2 days): switch to live keys and the live webhook in Secret Manager, a production Firebase project, turn on Instagram Connect when approved, remove demo labels and seed data, then one real low-value purchase, refund and Payout.

### Timeline
| Phase | Days | Cumulative |
|---|---|---|
| 0 Reset | 0.5 | 0.5 |
| 1 Foundation | 2.5 | 3 |
| 2 Rules | 2 | 5 |
| 3 Artists and catalog | 5 | 10 |
| 4 Cart, checkout, Orders | 5 | 15 |
| 5 Instagram | 3 | 18 |
| 6 Damage, Refunds, Reviews | 3.5 | 21.5 |
| 7 Payouts and admin | 3 | 24.5 |
| 8 Quality and demo launch | 3 | 27.5 |
| 9 Go-live (code only) | 2 | 29.5 |

About 27.5 working days to a complete demo (5–6 weeks of focused work, one developer). Plan for 6–8 weeks with buffer. Go-live adds about 2 days of code plus waiting time for registration, Razorpay and Meta, which can take weeks and runs outside this schedule. These are judgement estimates.

**If time is short, in this order of risk:** rules (Phase 2); `placeOrder`, the hold and payment verification (Phase 4); Payout calculation (Phase 7).

---

## Part 7. Engineering standards

### 7.1 Dependencies
| Action | Packages |
|---|---|
| Remove from the app | `@stripe/stripe-js`, `@stripe/react-stripe-js`, `razorpay` (server SDK; the browser loads Razorpay Checkout by script tag), `@tensorflow-models/toxicity`, `@mui/x-data-grid`, `@react-google-maps/api`, CRA packages |
| Keep in the app | `react-firebase-hooks` (it is the query cache, with Firestore's local cache; no custom cache layer) |
| Remove from functions | `stripe`, `@mui/lab`, `@sentry/react`, `@sentry/tracing`, `recharts`, `moment`, `@tensorflow-models/toxicity`, `perspective-api-client` |
| Keep in functions | `firebase-admin`, `firebase-functions`, `razorpay`, `@sendgrid/mail`, `date-fns`; add `yup` (command schemas) |
| Add to the app | `vite`, `@vitejs/plugin-react`, `recharts`, `date-fns`, `@sentry/react`, `vitest`, `jsdom`, `@testing-library/react`, `playwright` (no `dompurify`: all text is plain and React escapes it) |
| Instagram | No SDK: plain HTTPS calls to `graph.instagram.com` from functions; Instagram's `embed.js` loaded on pages that show embeds |
| Drop | The CSRF helper and the browser rate limiter |

### 7.2 Code conventions
- One component per file; pages default-export, shared parts named-export.
- Only `src/api/` imports `firebase/*` (ESLint-enforced). Components take props and callbacks, show buttons from stored allowed actions, format money with `formatINR(paise)`, and map error codes with `reasonText`.
- Stage and money rules live only in `functions/src/domain/`; every command uses the `command()` wrapper.
- Money in integer paise; Commission in basis points; formatted only for display (`₹1,23,456`).
- Never trust the browser for price, stock, stage, payment status, Payouts or roles.
- Every time-based rule lives in the sweep and is idempotent.
- Never store Instagram media files or `media_url`s; store permalinks and IDs only.
- Use `GLOSSARY.md` words in code, UI and docs (`buyerId`, never `customerId`).
- Functions use the v2 API in CommonJS; secrets via `defineSecret`.

### 7.3 Git workflow
`main` is always deployable. Short feature branches, small commits, pull requests with CI, squash merge, tagged releases.

### 7.4 Environments
| Env | Firebase project | Razorpay | Instagram app | Purpose |
|---|---|---|---|---|
| Local | emulators | test keys | development mode | Building |
| Staging / demo | separate project | test keys | development mode (testers) | Public demo |
| Production | new project at go-live | live keys | live after App Review | Real shop (Phase 9) |

---

## Part 8. Testing strategy

| Level | Tool | What is covered | Target |
|---|---|---|---|
| Unit | Vitest | Cart reducer and one-Artist rule, `domain/money.js` (Commission on price − Refunds; the 51000-paise case), `domain/order.js` transitions and allowed actions, Instagram URL validation, validators | 90% of `domain/`, `lib/` and reducers |
| Component | Testing Library | Artwork, Listing, Verification, Damage Report and Review forms; guards; embed component; bell | every form and guard |
| Rules | rules-unit-testing | every allowed and denied case in 5.5 | 100% of rules |
| Functions | emulators + fake clock | `placeOrder` race, payment signature check, webhook idempotency, every sweep rule in 5.6, refunds before and after Payout, Payout run and double-record refusal, Instagram token refresh and deletion | every function and timer |
| End-to-end | Playwright | Buyer: browse → Cart → pay (Razorpay test) → Received → Review. Artist: sign up → verify → fee → publish → ship. Admin: Payout run | 3 paths |
| Manual | checklist | Razorpay test payment on a phone, Instagram Connect with the tester account, email rendering, mobile layouts | before each release |

---

## Part 9. Definition of done (every feature)
1. UI, service, rules and function pieces all present.
2. Tests written and passing.
3. Works in the emulators, then on the demo.
4. Loading, empty and error states handled.
5. Keyboard and screen-reader basics checked.
6. No secrets, no stray logs, lint clean.
7. Uses glossary terms; docs updated; pull request reviewed.

---

## Part 10. Launch plan

### 10.1 Demo launch checklist (end of Phase 8)
- [ ] Rules deployed and tests green; no open collections
- [ ] Razorpay test keys and webhook secret in Secret Manager; test webhook verified
- [ ] Instagram app in development mode; Connect works for the tester account; paste path works for everyone
- [ ] Seed data: a few Artists, Artworks, Listings, Orders at every stage, one Payout run
- [ ] First admin created with the script
- [ ] The sweep runs on schedule and its runs are logged
- [ ] App Check on; budget alerts set; Sentry receiving errors
- [ ] Clear "demo, no real payments" banner; draft legal pages
- [ ] Lighthouse thresholds met on home, browse, Artwork and checkout

### 10.2 Go-live checklist (Phase 9)
- [ ] Business registered; accountant's advice on GST and invoices applied
- [ ] Lawyer's sign-off on holding Artists' money, terms, refund policy, Artist agreement
- [ ] Razorpay live marketplace approval in writing; live keys and webhook in Secret Manager
- [ ] Meta business verification and App Review approved; Connect switched on
- [ ] Commission and Onboarding Fee set in `settings/business`
- [ ] Production Firebase project; scheduled Firestore export (backups)
- [ ] Email domain verified (SPF, DKIM)
- [ ] One real purchase, refund and Payout completed end to end

### 10.3 Operating the product
Daily: work the Admin queues. On the 1st and 15th: review the Payout run, send the transfers, record the references. Watch Sentry, function failures, sweep logs, the webhook and costs. A runbook covers: a failed webhook, a failed sweep, a wrong Payout, a chargeback, a Takedown, an expired Instagram token, and restoring from backup.

---

## Part 11. Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Holding Artists' money may need regulatory permission | High (go-live) | Lawyer before Phase 9; ADR 0004 records it; Route when eligible |
| Razorpay refuses or limits a marketplace account | High (go-live) | Describe the model honestly, get approval in writing; Artist Verification shows seller due diligence |
| No registered business | Blocks go-live only | Demo-first plan; registration is Phase 9 step 1 |
| Meta App Review or business verification refused or slow | Medium | Paste-a-link path works without approval; Connect behind a switch |
| Instagram token expires (not refreshed in 60 days) | Low | Sweep refreshes at 10 days left; reconnect notice |
| Manual Payout mistakes (wrong amount or account) | High | Payout run explains every line; Admin checks Verification before first Payout; references recorded; double-record refused |
| Chargebacks or refunds after Payout | Medium | Amount Owed, deducted from later Payouts; Restricted at 60 days |
| Two Buyers pay for one Original | Medium | Checkout Hold in a transaction; tested |
| One Buyer locks many Originals | Low | Limit on open holds per Buyer; 15-minute expiry |
| Razorpay fee lost on refunds | Low | Hold prevents most; Artist bears the fee per ADR 0004 |
| Sensitive Artist data (PAN, bank) leaks | Severe | Functions-only writes, strict rules, masked display, rules tests |
| Sweep misses or double-applies a rule | High | Idempotent design, logged runs, fake-clock tests |
| Video storage costs | Medium | 200 MB cap; reel links encouraged; budget alert |
| The model changes again | Schedule | Glossary and ADRs make changes visible; Phase 2 rules isolate the money logic |

### What to reuse from the old code
- The Yup schemas, adapted to Artworks, Listings and Reviews of Artists.
- The cart reducer, with the one-Artist rule and id-only persistence added.
- The `AdminRoute` and `ProtectedRoute` logic.
- `LazyLoadImage` (drop the WebP query) and `ErrorBoundary` (fixed copy instead of `error.message`).
- The email template.
- The transaction pattern from the sales aggregation.
- The review status flow.

---

## Part 12. Roadmap after v1

| Release | Theme | Features |
|---|---|---|
| 1.1 | Finish v1 | RazorpayX automated payouts, Artist approval workflow, thumbnails, admin audit log, moderation API, shipped and refund emails, courier tracking, strict CSP |
| 1.2 | Growth | Wishlist, follow Artists, share links, auto-import new Instagram posts as draft Artworks, email preferences |
| 1.3 | Money | Route split payments once CraftMe qualifies (turnover above ₹40 lakh), coupons |
| 1.4 | Fulfilment | Shipping rates, tax, returns |
| 1.5 | Engagement | Messaging, Artist replies to Reviews, newsletters |
| 2.0 | Scale | Multi-Artist carts, full-text search, recommendations, multi-currency and languages, mobile app, commissions, auctions |

---

## Part 13. Decisions

### Decided (2026-11-07)
| Decision | Choice |
|---|---|
| How Buyers pay | To CraftMe through Razorpay (ADR 0004; replaces ADR 0001) |
| Checkout | 15-minute Checkout Hold on the Listings |
| What CraftMe earns | Commission per Order (rate set later) + non-refundable Onboarding Fee |
| Payouts | Order Payable at Received + 3 days with no open Damage Report; sent by hand on the 1st and 15th; reference recorded |
| Payout amount | Price − Refunds − Commission − Razorpay fee |
| Late Refunds | Become an Amount Owed, deducted from next Payouts; Restricted after 60 days |
| Restriction | Automatic for Amount Owed, or by the Admin with a reason (repeated Overdue, upheld Reports) |
| Artist Verification | Legal name, PAN, payout UPI or bank, verified phone; Admin checks before first Payout |
| What is sold | Physical Originals and Prints; an Artwork has Listings |
| Cart | One Artist per Cart (ADR 0002) |
| Shipping | Artist ships directly; price includes shipping; India only |
| Order stages | Paid → Shipped (within 7 days, else Overdue) → Received (Buyer, or 14 days) |
| Refunds | Per Order Line, decided and issued by the Admin through Razorpay; no Buyer self-cancel |
| Damage | Report within 3 days of Received; holds the Payout |
| Reviews | Rate the Artist, once per Order, 30-day window, Admin approves each (ADR 0003) |
| Roles | Additive; Artists can't buy their own Listings |
| Artist access | After Verification and Onboarding Fee; publish immediately; Report and Takedown |
| Media | Up to 5 photos; video uploaded (3 min, 200 MB) or an Instagram reel link |
| Instagram | Connected Instagram in v1 (Business/Creator), Artist picks posts, links stored only, Showcase up to 9; paste-a-link for everyone; Connect hidden until Meta approves |
| Prices | No limits (₹1 floor in practice); live price wins at checkout |
| Sold and Ended | Sold Originals stay visible; Artists can End Listings; Artworks with sales can't be deleted |
| Categories | 7 fixed |
| Goal | Demo in test mode first; go-live is Phase 9 |
| Functions | CommonJS |

### Still open
| # | Decision | Needed by | Default |
|---|---|---|---|
| 1 | Commission rate | Phase 9 | Setting; 10% is common |
| 2 | Onboarding Fee amount | Phase 9 | Setting |
| 3 | Business type to register | Phase 9 | Accountant's advice |
| 4 | Legal sign-off on holding funds | Phase 9 | Lawyer |
| 5 | Firebase projects (reuse `craftme-3851a` for staging?) | Phase 0 | Reuse for staging; new project for production |
| 6 | Email provider | Phase 6 | SendGrid |
| 7 | TypeScript | Phase 0 | Later |

---

## Part 14. Limits of this document
- Everything about the current code comes from reading it. Nothing was built, run or tested.
- `.env.development` was not read. Git shows nothing sensitive was ever committed; the env files are untracked.
- These facts come from research of Razorpay, RBI and Meta documentation in November 2026, not from tests:
  - Route needs turnover above ₹40 lakh.
  - Razorpay's marketplace terms (seen only through search snippets) require seller due diligence.
  - RazorpayX needs a current account; fees are about ₹4–9 per payout, and sources conflict.
  - Refunds never return Razorpay's fee.
  - Instagram Basic Display shut down in December 2024. Connect needs Business or Creator accounts, App Review and business verification. Tokens last 60 days.
  - Embeds have needed no token since June 2026, and return no thumbnails.

  Confirm each with Razorpay and Meta before the phase that depends on it.
- The RBI rules on how long a marketplace may hold sellers' money were not settled by the research; that is for a lawyer.
- Not verified: that Firebase project `craftme-3851a` exists, the real bundle size, video storage cost.
- Feature counts and day estimates are judgement.
