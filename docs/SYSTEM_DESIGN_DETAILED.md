# CraftMe: System Design

Version 1.1 · 2026-11-08 · Covers architecture, high-level design (HLD) and low-level design (LLD). Aligned with [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) v2.1: 4-folder layout, `confirmPayment`, `artistOpen`, stored allowed actions, Commission on price after Refunds with the full gateway fee to the Artist, no `purchases` collection.

This document turns [PROJECT_BLUEPRINT.md](../PROJECT_BLUEPRINT.md) (the product and the plan), [GLOSSARY.md](../GLOSSARY.md) (the words) and [docs/adr/](adr/) (the decisions) into a buildable design. Capitalised words (Order, Listing, Payout…) are glossary terms. Nothing here has been built or load-tested; numbers are estimates and every external-service fact is marked in section 12.

**Contents:** 1 Requirements · 2 Architecture · 3 HLD · 4 LLD: data · 5 LLD: money and state · 6 LLD: server functions · 7 LLD: client · 8 Security · 9 Scale and cost · 10 Reliability and operations · 11 Trade-offs · 12 Assumptions and open questions.

---

## 1. Requirements

### 1.1 Functional (from the blueprint's launch core)
| Area | The system must |
|---|---|
| Catalog | Let Artists publish Artworks with Listings (Original or Print), up to 5 photos, a video or Instagram reel; let anyone browse, filter and search by title prefix |
| Buying | Hold a one-Artist Cart, check price and stock on the server, take payment, create an Order, record shipping |
| Fulfilment | Move an Order Paid → Shipped → Received, with deadlines (ship in 7 days, auto-Received after 14) |
| Trust | Damage Reports (3 days), per-Order-Line Refunds, Reviews of Artists (30 days, Admin-approved), Reports and Takedown |
| Money | Collect payments, pay Artists on the 1st and 15th (price − Refunds − Commission − gateway fee), track Amount Owed, Restrict |
| Instagram | Connect Business/Creator accounts, pick posts, store links only, refresh tokens |
| Comms | In-app notifications; emails for order confirmation, new Order, Payout sent |
| Admin | Queues, Refunds, Payout runs, Artist Verification, Takedown, settings |

### 1.2 Non-functional
| Quality | Target (demo, then launch) |
|---|---|
| Correctness of money | No Order paid twice, no stock oversold, no Payout recorded twice; every rupee traceable to an Order |
| Availability | Browsing 99.5% (managed services, no SLA owned by us); money paths degrade safely (see 10.2) |
| Latency | Browse page p95 under 1.5 s on a mid phone over 4G; callable functions p95 under 800 ms (cold start excepted) |
| Security | Rules enforce all access; no client can write money, stage, role or fee fields |
| Privacy | Shipping address visible only to that Artist once Paid; PAN, bank/UPI and Instagram tokens never reach other users |
| Cost | Inside Firebase Blaze free quotas at demo volume; under about ₹6,000 a month at launch volume (see 9.3) |
| Operability | One person can run it: alerts for webhook, sweep and Payout drift |

### 1.3 Constraints
- One developer, 6 to 8 weeks to a demo in test mode; Firebase and Razorpay already chosen; India only, INR only.
- CraftMe collects Buyers' money (ADR 0004), which is a regulatory risk handled outside this document (go-live phase).
- Physical goods: stock is real, so overselling costs money and trust.

### 1.4 Load estimate (assumptions, to revisit)
| Quantity | Demo | Launch year 1 |
|---|---|---|
| Artists | 10 | 200 |
| Artworks | 100 | 5,000 |
| Registered Accounts | 50 | 20,000 |
| Orders / month | 30 | 1,500 |
| Peak browse requests | 2 rps | 40 rps (a campaign day: 150 rps) |
| Sweep rows touched / run | under 20 | under 300 |

At these volumes the design is limited by correctness and cost, not throughput. Section 9 shows where it would first strain.

---

## 2. Architecture

### 2.1 Style
A serverless, event-driven system on Firebase/Google Cloud with a thin React single-page app:
- **Browser reads Firestore directly** for public catalog data, protected by security rules.
- **Every action that touches money, stock, stage, role or fees goes through a server function** (callable or HTTPS). Rules deny client writes to those fields.
- **Time-based rules run in one idempotent scheduled sweep** instead of per-Order timers.
- **External systems are reached only from functions**: Razorpay, Instagram, SendGrid.

### 2.2 System context
```
                         ┌─────────────────────────────────────────┐
  Buyer ───────┐         │               CraftMe                   │        ┌───────────┐
  Artist ──────┼──HTTPS──►  React SPA  ◄──► Firebase backend       ◄───────►  Razorpay  │ payments, refunds,
  Admin ───────┘         │  (Hosting)     (Auth, Firestore,        │        └───────────┘ webhooks
                         │                 Storage, Functions,     │        ┌───────────┐
                         │                 Scheduler, App Check)   ◄───────►  Instagram │ OAuth, media list
                         │                                         │        └───────────┘ (Graph API)
                         │                                         │        ┌───────────┐
                         │                                         ├───────►  SendGrid  │ emails
                         └─────────────────────────────────────────┘        └───────────┘
                                   │  logs / errors
                                   ▼
                          Cloud Logging · Sentry · Budget alerts
```
Instagram embeds are loaded by the Buyer's browser straight from Instagram; CraftMe stores only links.

### 2.3 Containers
```
┌──────────────────────────── Browser ─────────────────────────────┐
│ React 19 SPA (Vite build) ─ React Router 7 ─ MUI 7              │
│  features/: auth catalog cart orders damage reviews instagram    │
│            payouts notifications admin artist                    │
│  src/api: the only code that imports the Firebase Web SDK        │
│           (Auth, Firestore, Storage, callables) + Checkout script│
└───────┬───────────────┬──────────────────────┬───────────────────┘
        │ Firestore SDK │ callable (HTTPS)     │ upload
        ▼               ▼                      ▼
┌──────────────┐  ┌────────────────────────────────────┐  ┌────────────┐
│  Firestore   │◄─┤  Cloud Functions v2 (Node 22)      │  │  Storage   │
│  (rules)     │  │  callables · HTTPS · triggers ·    ├─►│ (rules)    │
│              │  │  scheduled                         │  └────────────┘
└──────▲───────┘  └──┬──────────┬─────────┬────────────┘
       │             │          │         │ Secret Manager (keys, secrets)
       │ triggers    ▼          ▼         ▼
       └──────── Razorpay   Instagram   SendGrid
```

### 2.4 Technology choices
| Concern | Choice | Why in one line |
|---|---|---|
| Frontend | React 19, Vite, React Router 7, MUI 7, Formik + Yup | Already in use; Vite replaces deprecated CRA |
| Auth | Firebase Auth (Google, email, phone OTP) + custom claims | Managed; claims are visible to rules |
| Database | Firestore (native mode) | Serverless, real-time listeners, rules as the access layer |
| Files | Cloud Storage for Firebase | Rules, signed download URLs |
| Server code | Cloud Functions v2 (CommonJS, Node 22) | Callables carry the caller's identity; scheduler built in |
| Scheduling | Cloud Scheduler → scheduled function | One 5-minute sweep plus 3 cron jobs |
| Payments | Razorpay on CraftMe's account | ADR 0004 |
| Email | SendGrid (template exists) | Three templates at launch |
| Secrets | Secret Manager via `defineSecret` | Never in env files or the repo |
| Bot defence | App Check (reCAPTCHA Enterprise) | Blocks scripted callers |
| Monitoring | Cloud Logging + Sentry + budget alerts | Cheap, enough for one operator |
| Tests | Vitest, Testing Library, rules-unit-testing, emulators, Playwright | See blueprint Part 8 |

### 2.5 Deployment topology
| Environment | Firebase project | Razorpay | Instagram app | Data |
|---|---|---|---|---|
| Local | emulators (Auth 9099, Firestore 8080, Functions 5001, Storage 9199) | test keys | development mode | seed script |
| Staging / demo | `craftme-3851a` (or a clean project) | test keys | development mode, testers only | seeded |
| Production | new project at go-live | live keys | live after App Review | real |

Region: `asia-south1` (Mumbai) for Firestore, Storage and Functions, to keep latency low for Indian users and data in India.

Deployment unit order: rules and indexes → functions → hosting. Rules and functions deploy together from CI so they never disagree about a field.

---

## 3. High-level design

### 3.1 Responsibility split
| Concern | Client (direct, via rules) | Server function only |
|---|---|---|
| Read public Artworks, Listings, Artist profiles, approved Reviews | yes | |
| Read own Orders, notifications, fee and Payout statements | yes | |
| Edit own Artwork content, draft Listing fields, profile | yes (field-limited by rules) | |
| Create Order, change stock/held, set price used for payment | | yes |
| Order stage changes, Refunds, Payouts, Amount Owed, Restricted | | yes |
| Roles and claims | | yes |
| Review create (checks the Order), approve | | yes |
| Instagram token storage and media listing | | yes |

### 3.2 Key flows

**A. Browse (read path)**
```
SPA ──Firestore query (status=='published', orderBy createdAt, limit 24, startAfter)──► Firestore
SPA ──image URLs──► Storage (public read for published photos)
SPA ──lazy-loads Instagram embeds on scroll──► Instagram (browser to Instagram directly)
```
No function is involved. Caching: browser cache for images (long max-age, hashed file names); Firestore SDK offline cache for repeat visits.

**B. Place an Order and pay**
```
Buyer          SPA                 placeOrder fn            Firestore          Razorpay
  │ Pay ─────► │ callable ────────► validate cart (1 Artist,  │                   │
  │            │                    live price, stock)        │                   │
  │            │                    txn: held += qty, create ─► Order(stage=hold, │
  │            │                    Order + private/shipping   │   holdUntil=+15m)│
  │            │                    create Razorpay order ────────────────────────►│
  │            │ ◄── {orderId, razorpayOrderId, keyId, amount}                    │
  │ pays in ──►│ Razorpay Checkout (pop-up) ─────────────────────────────────────►│
  │            │ ◄── {payment_id, order_id, signature}                            │
  │            │ callable confirmPayment ► HMAC check ► txn: hold→paid, stock−=qty│
  │            │                    held−=qty, rewrite buyer/artistActions, notify│
  │ ◄ Paid ────│ (also) Razorpay webhook ──► razorpayWebhook fn ► same transition │
```
The browser callback gives a fast "Paid" screen; the webhook is the safety net if the tab closes. Both call the same idempotent `markPaid(orderId, paymentId)`.

**C. Ship, receive, review**
```
Artist ► markShipped (callable) ► stage shipped, tracking saved, notify Buyer
Buyer  ► confirmReceived (callable) ─┐
sweep  ► Shipped + 14d ──────────────┴► stage received, damageWindowEnds=+3d, reviewBy=+30d
Buyer  ► submitReview (callable, Order must be received, inside reviewBy) ► review pending
Admin  ► decideReview ► approved ► recompute Artist rating
```

**D. Damage Report and Refund**
```
Buyer ► reportDamage (callable, ≤3d after received) ► damageReport open, Order.payable=false
Admin ► decideDamage ► upheld? ► issueRefund(lines) ► Razorpay refund API ► refund doc
                                   │ Order paid out already? ► Amount Owed += refunded share
```

**E. Payout run**
```
Scheduler 09:00 IST on 1st and 15th ► buildPayoutRun fn
   for each verified Artist: collect Orders where payable==true && payoutId==null
   compute lines, commission, full gateway fee, owed deduction ► payouts/{id} (draft)
Admin reviews ► sends UPI/bank transfers from bank ► recordPayout (callable, reference per Artist)
   txn per Artist: payout draft→sent, orders.payoutId set, owed cleared ► email "Payout sent"
```

**F. Instagram Connect**
```
Artist ► connectInstagram (callable returns authorize URL, state nonce saved)
Instagram redirects ► SPA route ► completeInstagramConnect (callable: code→short token→60-day token)
   token stored in instagramTokens/{uid} (functions-only) ; user doc gets username only
Artist ► listInstagramMedia (callable) ► picks ≤9 ► saveShowcase (permalinks only)
Daily job ► refresh tokens expiring within 10 days ► if refresh fails, notify reconnect
```

### 3.3 API surface (summary)
Callable functions (Firebase `onCall`, caller identity in context, App Check enforced):

| Function | Caller | Purpose |
|---|---|---|
| `submitVerification`, `payOnboardingFee`, `becomeArtist` | signed in | Artist setup |
| `placeOrder`, `confirmPayment` | Buyer | Checkout |
| `markShipped` | Artist of the Order | Ship |
| `confirmReceived` | Buyer of the Order | Receive |
| `reportDamage` | Buyer | Damage Report |
| `submitReview`, `report` | Buyer | Trust |
| `decideDamage`, `issueRefund`, `decideReview`, `takedown`, `setUserRole`, `restrictArtist`, `buildPayoutRun`(manual), `recordPayout`, `markVerified` | Admin | Operate |
| `connectInstagram`, `completeInstagramConnect`, `listInstagramMedia`, `saveShowcase`, `disconnectInstagram` | Artist | Instagram |

HTTPS endpoints: `razorpayWebhook`, `instagramDeauthorize`, `instagramDataDeletion`.
Triggers: `onUserCreated`, `onOrderWritten` (notifications, emails, daily stats; from `paid` onward), `onListingWritten` (Artwork `fromPricePaise`, `available`), `onReviewWritten` (rating).
Scheduled: `sweep` (every 5 min), `buildPayoutRun` (1st and 15th), `refreshInstagramTokens` (daily).

Full contracts are in section 6.

### 3.4 Storage choices
| Data | Store | Notes |
|---|---|---|
| Entities and ledgers | Firestore | Documents; denormalised for reads |
| Photos, videos, damage photos | Cloud Storage | Per-owner folders; size/type enforced by rules |
| Secrets, API keys, webhook secret | Secret Manager | Read by functions at runtime |
| Instagram tokens | Firestore `instagramTokens` | Functions-only; consider encrypting with Cloud KMS later |
| Search index | none at launch | Title prefix query; Algolia/Typesense when needed |
| Analytics | `analytics_daily` docs | Written by triggers; sharded counters when hot |
| Backups | Firestore PITR + daily export to a Storage bucket | See 10.4 |

---

## 4. Low-level design: data

Money is whole paise (integers). Times in documents are epoch milliseconds (UTC instants, so range queries and the pure domain code need no conversion); the sweep, Payout runs and daily analytics use `Asia/Kolkata` days. Every document has `createdAt`, `updatedAt`.

### 4.1 Collections and key fields
```
users/{uid}                  displayName, photoURL, bio, roles[], ratingAvg, ratingCount,
                             instagramUsername, showcase[<=9 permalinks], restricted(bool)
artistPrivate/{uid}          legalName, pan, payoutMethod{type,upi|account,ifsc}, phoneVerified,
                             verifiedByAdminAt, onboardingPaidAt, amountOwed, restrictedReasons[],
                             instagram{connected, igUserId, tokenExpiresAt}
instagramTokens/{uid}        accessToken, expiresAt, refreshedAt          (no client access)
artworks/{id}                artistId, title, titleLower, description, category, photos[], video,
                             status(draft|published|removed), hasSales, views,
                             fromPricePaise, available, artistOpen          (last three: functions)
listings/{id}                artworkId, artistId, kind, size, medium, price, stock, held,
                             status(draft|live|sold|ended), artistOpen
orders/{id}                  buyerId, artistId, creatorIds[], code, lines[], total, stage,
                             holdUntil, razorpayOrderId, razorpayPaymentId, gatewayFee, commissionBps,
                             paidAt, shipBy, shippedAt, trackingNumber, receivedAt,
                             damageWindowEnds, payable, payoutId, refundedTotal, reviewBy,
                             buyerActions{}, artistActions{}   (from domain allowedActions, rewritten on every change)
orders/{id}/private/shipping name, phone, address, city, state, pin
requests/{uid}_{requestId}   envelope, at                                         (command idempotency)
damageReports/{id}           orderId, lineIds[], photos[], note, status, decision, decidedAt
refunds/{id}                 orderId, artistId, lines[{lineId, qty, amount}], amount, reason,
                             razorpayRefundId, afterPayout, createdAt
payouts/{id}                 artistId, runDate, orderIds[], gross, refunds, commission, gatewayFees,
                             owedDeducted, net, method, reference, sentAt, status(draft|sent)
reviews/{orderId}            artistId, buyerId, rating, comment, status, createdAt
reports/{id}                 targetType, targetId, reporterId, reason, status
settings/business            commissionBps, onboardingFee                          (Admin only)
settings/public              instagramConnectEnabled                               (readable by all; Admin writes)
notifications/{id}           userId, type, data, read, createdAt
analytics_daily/{yyyy-mm-dd} orders, sales, commission, refunds, payoutsSent      (shard when hot)
processedEvents/{eventId}    at                                                    (idempotency)
system/sweepHeartbeat        lastRunAt, lastCounts
```
Changes from the blueprint, made on purpose:
- `titleLower` on Artworks for the case-insensitive prefix search.
- No `purchases` collection: entitlement to review is read from the Order (Received, caller is its Buyer, inside `reviewBy`). The Review document ID is the `orderId`, so one Review per Order falls out of the key.
- `artistOpen` on Artworks and Listings: Restriction flips it and never touches Listing `status`, so lifting restores exactly what was live.
- `fromPricePaise` and `available` on Artworks, so Browse is one query and never a Listings query per card.
- `lineIds` and per-line refund amounts, so a partial Refund is exact.

### 4.2 Indexes (composite)
| Collection | Fields | Used by |
|---|---|---|
| artworks | status, artistOpen, createdAt desc | Browse, home |
| artworks | status, artistOpen, category, createdAt desc | Category filter |
| artworks | status, artistOpen, titleLower asc (range) | Prefix search |
| artworks | artistId, createdAt desc | Artist dashboard, profile |
| listings | artworkId, status | Artwork page |
| listings | status, price | Price filter (see 9.4: join client-side at first) |
| orders | buyerId, createdAt desc | My orders |
| orders | artistId, stage, shipBy | Order inbox |
| orders | stage, holdUntil | Sweep: expire holds |
| orders | stage, shipBy | Sweep: Overdue |
| orders | stage, shippedAt | Sweep: auto-Received |
| orders | payable, payoutId, artistId | Payout run |
| reviews | artistId, status, createdAt desc | Artist profile |
| notifications | userId, createdAt desc | Bell |

### 4.3 Security rules (shape, not full text)
```
function signedIn() { return request.auth != null; }
function isAdmin()  { return signedIn() && request.auth.token.admin == true; }
function isArtist() { return signedIn() && request.auth.token.artist == true; }
function only(keys) { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys); }

match /users/{uid}          allow read: if true (public fields only live here)
                            allow update: if request.auth.uid == uid && only(['displayName','photoURL','bio']);
match /artistPrivate/{uid}  allow read: if request.auth.uid == uid || isAdmin();  write: false
match /instagramTokens/{u}  read, write: false
match /artworks/{id}        read: if (resource.data.status == 'published' && resource.data.artistOpen) || resource.data.artistId == request.auth.uid || isAdmin();
                            create: if isArtist() && notRestricted() && request.resource.data.artistId == request.auth.uid
                                       && request.resource.data.status == 'draft' && validContent();
                            update: if owner && notRestricted() && only(contentFields) && statusChangeAllowed();
match /listings/{id}        read: published artwork's live/sold listings with artistOpen, or owner/admin
                            write: owner draft fields and status live<->ended only; never stock, held, sold, artistOpen
match /orders/{id}          read: buyerId == uid || artistId == uid || uid in creatorIds || isAdmin();  write: false
match /orders/{id}/private/shipping
                            read: buyer, admin, or artist when parent.stage in [paid, shipped, received]
                            (uses get() on the parent: one extra document read per request)
match /reviews/{id}         read: status == 'approved' || owner || isAdmin();  write: false (functions)
match /notifications/{id}   read: userId == uid;  update: only(['read']) by owner
```
Rules must stay under the 10-document-access limit per request; the only `get()` is on shipping. Rules tests assert every allow and deny.

---

## 5. Low-level design: money and state

### 5.1 Order stage machine
```
            placeOrder               confirmPayment / webhook           markShipped
  (none) ───────────────► hold ───────────────────────────► paid ───────────────────► shipped
                            │                                  │                        │
                  sweep: holdUntil passed                      │ sweep: shipBy passed   │ confirmReceived
                            ▼                                  ▼ (flag overdue)         │ or sweep: +14 days
                       hold_expired                          paid [overdue=true]        ▼
                            │ late payment arrives                                  received
                            ▼                                                           │ +3 days, no open Damage Report
                   paid (if stock) or auto-refund                                       ▼
                                                                                  payable=true ──► paid out (payoutId set)
  Any stage after paid ──► Refund per line ──► lines.refundedQuantity++, refundedTotal++ (stage stays; an Order with
  every line refunded is shown as "Refunded")
```
Allowed transitions live in one table in `functions/src/domain/order.js`; every command and sweep rule calls `next(stage, event)` (null means not allowed) and, in the same write, stores `allowedActions(order, role, now)` as `buyerActions` and `artistActions`. Nothing else writes `stage`.

### 5.2 Checkout Hold (stock reservation)
Listing fields: `stock` (total available to sell) and `held` (reserved by open Checkout Holds). A Buyer may reserve only `stock − held`.

```js
// placeOrder (inside one Firestore transaction)
const listings = await Promise.all(lineIds.map(id => tx.get(listingRef(id))));
for each (line, listing):
  assert listing.status == 'live' && listing.artistId == artistId       // one Artist per Order
  assert listing.stock - listing.held >= line.quantity
  tx.update(listingRef, { held: FieldValue.increment(line.quantity) })
const order = { stage: 'hold', holdUntil: now + 15min, lines: snapshotOf(listings, quantities), total, ... }
tx.set(orderRef, order); tx.set(shippingRef, address)
// after commit: create the Razorpay order; if it fails, release: held -= qty, stage 'hold_expired'
```
- **Race:** two Buyers hit the last Original. Firestore transactions retry on contention; the second reads `held = 1` and gets `conflict: sold`. Tested with a concurrent-transaction test on the emulator.
- **Release:** the sweep sets `hold_expired` and decrements `held` in a transaction that re-checks `stage == 'hold'`.
- **Paying after expiry:** webhook arrives for an Order in `hold_expired`. In one transaction: if `stock − held >= qty` for every line, accept (hold→paid, normal path); otherwise create a Razorpay refund and mark the Order `refunded` with reason `sold_during_payment`. This is the only automatic Refund.
- **Why a counter and not a lock document:** one write on the Listing, no cleanup job for locks, and the 15-minute expiry is a plain query on the Order.

### 5.3 Payment verification (two independent proofs)
1. **Checkout callback** (`confirmPayment`): compute `HMAC_SHA256(razorpayOrderId + "|" + paymentId, keySecret)`; compare with the signature using `crypto.timingSafeEqual`. Never trust amounts from the client; amounts come from the Order document.
2. **Webhook** (`razorpayWebhook`): read the **raw body**; verify `X-Razorpay-Signature` as HMAC-SHA256 of the raw body with the webhook secret. Handle `payment.captured` (and `order.paid`). Dedupe on the event ID in `processedEvents/{eventId}` inside the same transaction as the state change, so a replay changes nothing.
3. **Fetch before trusting:** after either proof, fetch the payment from Razorpay (`payments.fetch`) to read `status`, `amount`, `fee` and `method`, and require `amount == order.total` and `status == 'captured'`. Store `gatewayFee` from this response.

`markPaid(orderId, paymentId)` is one function used by both paths and is a no-op if the Order is already `paid`.

### 5.4 Payout calculation (integer maths)
For an Order with Lines ℓ, line amount `a_ℓ = unitPrice × quantity`, refunded amount `r_ℓ`:
```
net_ℓ       = a_ℓ − r_ℓ
netOrder    = Σ net_ℓ
commission  = floor(netOrder × commissionBps / 10000)                // bps saved on the Order at payment time; floor favours the Artist
payoutOrder = netOrder − commission − gatewayFee                     // full fee to the Artist (ADR 0004); Razorpay does not return it on refunds
```
Fixture: ₹1,000 line, ₹400 refunded, 1000 bp, ₹30 fee → netOrder 60000, commission 6000, payoutOrder 51000 paise. These live in `functions/src/domain/money.js` (`payoutLine`, `payoutRun`), pure and unit-tested.
Per Artist run: `net = Σ payoutOrder − owedDeducted`, where `owedDeducted = min(amountOwed, Σ payoutOrder)`. Rounding differences are carried as a separate `rounding` line on the statement so totals reconcile to the paisa. A unit-test fixture with fixed Orders pins these numbers.

**Refund after Payout:** `amountOwed += r_ℓ − (the Commission no longer due on r_ℓ)` for that Order, written in the same transaction as the Refund record. `restricted` is set by the sweep when `amountOwed > 0` and the oldest owed entry is 60 days old.

**Never twice:** `recordPayout` runs one transaction per Artist: it requires `payout.status == 'draft'`, sets the `payoutId` on each Order that still has `payoutId == null`, and aborts if any Order already has one.

### 5.5 The sweep (every 5 minutes)
One scheduled function; each rule is a bounded, indexed query and a per-document transaction that re-checks the condition (idempotent):

| Rule | Query | Effect |
|---|---|---|
| Hold expiry | `stage=='hold' && holdUntil<=now` | `hold_expired`, release `held` |
| Ship reminder | `stage=='paid' && shipBy-2d<=now && !reminded` | notify Artist |
| Overdue | `stage=='paid' && shipBy<=now && !overdue` | `overdue=true`, Admin queue |
| Auto-Received | `stage=='shipped' && shippedAt+14d<=now` | `received`, set windows |
| Payable | `stage=='received' && damageWindowEnds<=now && !payable && noOpenReport` | `payable=true` |
| Amount Owed | artists with `amountOwed>0` and oldest owed ≤ now−60d | `restricted=true`; `artistOpen=false` on their Artworks and Listings (status untouched) |
| Heartbeat | always | `system/sweepHeartbeat` |

Each rule processes at most 200 documents per run and continues on the next run. The `buildPayoutRun` (cron `0 9 1,15 * *`, `Asia/Kolkata`) and `refreshInstagramTokens` (daily) are separate functions so a slow job cannot delay the sweep.

### 5.6 Reviews and ratings
A Review is created by `submitReview` after checking `order.stage=='received'`, `now<=reviewBy`, `buyerId==uid`, and that no Review with ID `orderId` exists (so duplicates fail on `create`). Approval runs a transaction on `users/{artistId}`: `ratingAvg = (ratingAvg·n + rating)/(n+1)`, `ratingCount++`. A rejection does not touch the average.

---

## 6. Low-level design: server functions

### 6.1 Conventions
- **CommonJS, Functions v2.** Layout: `lib/` (`envelope.js`, `command.js`), `domain/` (`order.js`, `money.js`: pure, no I/O), `commands/` (one file per context), `ports.js` (Payments, Messaging, Clock; fakes in `test/fakes.js`), `webhook.js`, `sweep.js`, `instagram.js`, `index.js` (exports only).
- **One wrapper:** every callable is `command(name, {role, schema}, handler)`. The wrapper checks auth, role (or the handler checks ownership), validates `data` with Yup, applies idempotency, and maps errors. Handlers never repeat these steps.
- **Errors:** the wrapper returns one envelope `{ok, data | error:{code, reason, fields}, requestId}` and never throws to the client. Codes: `unauthenticated`, `forbidden`, `invalid`, `conflict` (reason: `sold`, `mixed_artists`, `price_changed`, `window_closed`, `wrong_stage`, `already_exists`…), `rate_limited`, `unavailable`, `internal` (logged, generic text). The UI maps reason codes to copy.
- **Idempotency:** every command takes a client-supplied `requestId`. The wrapper reads `requests/{uid}_{requestId}` in a transaction and returns the stored envelope if present, otherwise it stores the new envelope.
- **Logging:** structured JSON with `orderId`, `uid`, `fn`, `outcome`; never log PAN, addresses, tokens or card data.
- **Secrets:** `defineSecret('RAZORPAY_KEY_SECRET')`, `RAZORPAY_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `INSTAGRAM_APP_SECRET`.

### 6.2 Contracts (selected)
| Function | Input | Output | Main errors |
|---|---|---|---|
All inputs also carry `requestId`; all outputs are the `data` of the envelope.

| Function | Input | Output | Main errors |
|---|---|---|---|
| `placeOrder` | `{artistId, lines:[{listingId, quantity}], address}` (no prices: the server reads each Listing and computes the total) | `{orderId, razorpayOrderId, keyId, amount, holdUntil}` | `conflict: sold \| mixed_artists \| artist_restricted \| price_changed` (with `changedLines`), `invalid: address` |
| `confirmPayment` | `{orderId, razorpayPaymentId, razorpayOrderId, signature}` | `{stage}` | `forbidden`, `conflict: bad_signature \| amount_mismatch` |
| `payOnboardingFee` | `{}` | `{razorpayOrderId, keyId, amount}` (amount from `settings/business`) | `conflict: already_paid \| verification_missing` |
| `markShipped` | `{orderId, courier, trackingNumber}` | `{stage:'shipped'}` | `forbidden`, `conflict: wrong_stage` |
| `confirmReceived` | `{orderId}` | `{stage:'received', reviewBy}` | `conflict: wrong_stage` |
| `reportDamage` | `{orderId, lineIds[], note, photoPaths[]}` | `{reportId}` | `conflict: window_closed \| already_exists` |
| `submitReview` | `{orderId, rating(1..5), comment(<=500)}` | `{reviewId}` | `conflict: wrong_stage \| window_closed \| already_exists` |
| `issueRefund` (admin) | `{orderId, lines:[{lineId, quantity}], reason}` | `{refundId, amount}` | `conflict: exceeds_paid`, Razorpay errors → `unavailable` with retry hint |
| `recordPayout` (admin) | `{payoutId, reference}` | `{status:'sent'}` | `conflict: already_sent \| artist_unverified` |
| `becomeArtist` | `{}` | `{roles}` | `conflict: verification_or_fee_missing` |
| `completeInstagramConnect` | `{code, state}` | `{username}` | `forbidden: bad_state`, `conflict: personal_account` |

### 6.3 Webhook handler (outline)
```js
exports.razorpayWebhook = onRequest({secrets:[WEBHOOK_SECRET]}, async (req, res) => {
  const raw = req.rawBody;                              // Buffer; do not re-serialise JSON
  if (!validSignature(raw, req.get('X-Razorpay-Signature'), WEBHOOK_SECRET.value())) return res.status(400).end();
  const event = JSON.parse(raw);
  const eventId = req.get('X-Razorpay-Event-Id');
  await db.runTransaction(async tx => {
    if ((await tx.get(processed(eventId))).exists) return;       // replay: nothing to do
    await dispatch(event, tx);                                    // payment.captured → markPaid (Order) or markFeePaid (Onboarding Fee, by receipt prefix); refund.processed → mark
    tx.set(processed(eventId), { at: now() });
  });
  res.status(200).end();                                          // non-2xx makes Razorpay retry
});
```
Return non-2xx only for transient failures; a bad Order reference is logged and acknowledged so retries do not pile up.

### 6.4 Notifications and email pipeline
`onOrderWritten` compares `before.stage` and `after.stage` and writes `notifications/*` and sends mail for each transition. Nothing is sent when an Order is created in `hold`; the first Buyer notification is on `paid`. Email sends are guarded by `emailsSent/{orderId}_{type}` created with `create()` first (fails if it exists), so a retried trigger never sends twice. Failed sends are logged and retried by the sweep for 24 hours.

### 6.5 Instagram token handling
- Authorisation `state` is a random nonce stored on `artistPrivate/{uid}` with a 10-minute expiry and compared on return (CSRF).
- Short-lived token is exchanged server-side for a 60-day token; only the long-lived token is stored, in `instagramTokens/{uid}`.
- `refreshInstagramTokens` refreshes tokens with fewer than 10 days left (a token must be at least 24 hours old to refresh); a failure notifies the Artist.
- `disconnectInstagram` and the data-deletion callback delete the token and clear `showcase` and any Artwork reel links.
- Only permalinks and media IDs are stored; `media_url` values are never saved (they expire and Meta forbids rehosting).

---

## 7. Low-level design: client

### 7.1 Structure
```
src/
  app/        providers (Auth, Cart, Notifications, Theme), router, one ErrorBoundary per route
  features/<area>/  components, one screen hook (builds the ViewModel), tests
  components/ Layout, Nav, EmptyState, ErrorBoundary: shared UI
  api/        firebase.js, gateway.js (call, read hooks, saveProfile/saveDraft/markRead, upload)
  lib/        format.js (formatINR(paise), reasonText), useCountdown.js
```
Rule: only `src/api/` imports `firebase/*` or `razorpay`, enforced by one ESLint `no-restricted-imports` rule. Components take props and callbacks, show buttons from the Order's stored actions, and never test `stage`. No `sanitize.js`: all text is plain and React escapes it. The ErrorBoundary shows fixed copy and the request id, never `error.message`.

### 7.2 State
| State | Where | Notes |
|---|---|---|
| Auth user + claims | `AuthContext` | Plain `{uid, email, displayName, photoURL, claims}`, memoised value; `getIdTokenResult()` without force on sign-in; force refresh only after `becomeArtist` or `setUserRole` |
| Cart | `CartContext` (+ `localStorage` key `cm-cart`, try/catch) | `{artistId, items:[{listingId, qty}]}`: no prices, no total; one Artist only; revalidated by `placeOrder` |
| Server data | `react-firebase-hooks` in `src/api` over Firestore's `persistentLocalCache` (multi-tab) | Live listeners for Orders and the open Artwork's Listings; one notifications listener in the shell, latest 20; one-shot paginated query for Browse |
| Forms | Formik + Yup | Same Yup schemas shared with functions where possible (a small `shared/` package) |

### 7.3 Checkout client sequence
1. Call `placeOrder` (with a `requestId`); disable the button. If it returns `conflict: price_changed` or `sold`, show the Cart's changed state from `changedLines` (no separate client read of Listings).
2. Show the Hold timer with `useCountdown(holdUntil)`.
3. Open Razorpay Checkout with the returned `razorpayOrderId`; on success call `confirmPayment`.
4. Subscribe to `orders/{id}`; show "Processing" until `stage == 'paid'` (this also covers the webhook winning the race).
5. If the Hold expires, show the expired state and send the Buyer back to the Cart.

### 7.4 Performance budget and delivery
Route-level code splitting (`React.lazy`) for Admin, Artist dashboard and checkout; images lazy with fixed aspect ratios; Instagram `embed.js` loaded only when an embed scrolls into view; first `vite build` sets the JavaScript budget (start near 350 KB gzipped for the home route). Hosting serves hashed assets with long cache and `index.html` with no-cache. SEO: titles/meta per route and a prerender step for Artwork pages (open item 12).

---

## 8. Security and privacy

### 8.1 Threats and controls
| Threat | Control |
|---|---|
| Client forges price, stock, stage, role | Rules deny those writes; the client sends only listing ids and quantities, and `placeOrder` reads every price from Firestore and computes the total in paise |
| Webhook forgery or replay | HMAC on raw body; event ID dedupe; fetch payment from Razorpay before trusting |
| IDOR (reading another Order or address) | Rules by `buyerId`/`artistId`/`creatorIds`; address document gated by Order stage |
| Privilege escalation | Roles only via claims set by functions; `users.roles` mirror is functions-only |
| Scripted abuse (holds, uploads) | App Check; per-Buyer cap on open holds; per-Artist upload cap enforced in functions |
| XSS | Plain text storage, escaped rendering; no `dangerouslySetInnerHTML`; CSP from 1.1 |
| Secret leakage | Secret Manager; nothing sensitive in repo or browser bundle; `.env*` ignored |
| PAN/bank data exposure | `artistPrivate` readable only by owner and Admin; masked in UI; excluded from logs |
| Instagram token theft | Functions-only collection; no client rule; optional KMS encryption |
| Insider error (Admin mistakes) | Audit log in 1.1; double-record protection on Payouts |

### 8.2 Privacy
Collect the minimum; delete on request (Account deletion function removes profile, address copies and notifications; Orders and Reviews are kept without a name). Data stays in `asia-south1`. A privacy policy and data-deletion URL are required for the Meta app and the go-live review.

---

## 9. Scale and cost

### 9.1 What scales without work
Reads of public catalog data (Firestore handles thousands of reads/second), images (Cloud Storage plus browser cache), Hosting (CDN).

### 9.2 Where it would strain first
| Hot spot | Limit | Mitigation |
|---|---|---|
| One Listing's `held` counter during a drop | About 1 sustained write per second per document | Single-Original Listings are one write per Buyer; for a popular Print with many Buyers, shard `held` into N counters or cap concurrent holds |
| `analytics_daily/{day}` written on every `paid` transition (never on hold creation; day computed in `Asia/Kolkata`) | Same 1 write/second guide | Fine at launch; shard counters or aggregate in the sweep if over ~50 Orders/min |
| Prefix search and price filter | Firestore allows one range per query | Search by `titleLower` range; filter price client-side on the page; move to Algolia/Typesense when needed |
| Sweep over a growing `orders` collection | Queries are indexed and bounded (200/run) | Raise frequency or move per-Order timers to Cloud Tasks |
| Cold starts on callables | 1 to 3 seconds | `minInstances: 1` for `placeOrder` and `confirmPayment` when launch traffic justifies the cost |

### 9.3 Cost model (rough, to confirm in the Google Cloud calculator)
| Item | Demo | Launch year 1 (1,500 Orders/mo, 20,000 Accounts) |
|---|---|---|
| Firestore reads/writes | within free quota | roughly ₹1,000–2,500 / mo (browse reads dominate) |
| Functions invocations (sweep 8,640/mo plus actions) | within free quota | under ₹500 / mo; add ₹500–800 if `minInstances: 1` |
| Storage and egress (photos, damage photos, video) | free | ₹500–1,500 / mo; video is the risk, watch it |
| reCAPTCHA Enterprise | free tier | free tier (under 10,000 assessments/mo) then paid |
| SendGrid | free tier | free to low paid tier |
| Razorpay | per payment, taken from the Artist's share | not CraftMe's infrastructure cost |
Set a budget alert at 50%, 90% and 100%.

### 9.4 Query design notes
- Listings sit in their own collection so a Listing's stock changes never rewrite the Artwork. The Artwork page reads the Artwork plus one live listener on its Listings while open; cards on Browse show "from price" copied onto the Artwork as `fromPricePaise` and `available`, maintained by an `onListingWritten` trigger (their only writer), so Browse needs one query. `artistOpen` is written only by the standing change.
- Pagination is cursor-based (`startAfter` the last document), never offset.

---

## 10. Reliability and operations

### 10.1 Failure modes and responses
| Failure | Effect | Response |
|---|---|---|
| Razorpay down at `placeOrder` | No Razorpay order | Release the hold; show "payments are unavailable, try again" |
| Browser closes after paying | No callback | Webhook marks Paid; the Order page shows Paid on next visit |
| Webhook delayed or lost | Order stays `hold` | Sweep calls `payments.fetch` for Orders in `hold`/`hold_expired` that have a `razorpayOrderId` and reconciles |
| Webhook replayed | Duplicate event | `processedEvents` makes it a no-op |
| Function crashes mid-transaction | Nothing written | Firestore transactions are atomic; retry is safe |
| Function crashes between Firestore and Razorpay | Hold with no Razorpay order | Hold expires via sweep |
| Sweep stops | Holds, deadlines drift | Heartbeat alert after 15 minutes without a run |
| SendGrid failure | Email missing | In-app notification still exists; retry for 24 h |
| Instagram API change or outage | Connect/picker fails | Paste-a-link path and existing embeds keep working |
| Bad deploy of rules | Access wrong | Rules tests in CI; deploy rules with functions; one-command rollback to the previous release |

### 10.2 Degraded modes (what stays up)
Browsing and Artist content keep working if Functions are down (direct reads). Money actions fail closed: no function, no payment, no stage change.

### 10.3 Monitoring and alerts
| Signal | Alert when |
|---|---|
| `system/sweepHeartbeat.lastRunAt` | older than 15 minutes |
| Webhook responses | any 4xx/5xx burst, or no events for a day on a live shop |
| Function error rate | over 2% for 10 minutes |
| Orders stuck in `hold` over 30 minutes with a payment attempt | any |
| Draft Payout total vs sum of Payable Orders | mismatch |
| Budget | 50%, 90%, 100% |
| Sentry | new error type in functions or browser |

### 10.4 Backup and recovery
Enable Firestore point-in-time recovery (7 days) and a daily export to a Storage bucket (30-day retention); enable Storage object versioning for damage photos. Recovery drill once before go-live: restore a day's export to a scratch project and run the reconciliation script (sum of Orders vs payments from Razorpay).

### 10.5 Release process
PR → CI (lint, unit, rules, functions on emulators, build) → merge to `main` → deploy to staging → Playwright smoke → manual promote to production. Feature switches live in `settings/public` (`instagramConnectEnabled`); rates and fees in `settings/business`.

---

## 11. Trade-offs

| Decision | Chosen | Alternative | Why chosen | What would make us switch |
|---|---|---|---|---|
| Backend | Firebase serverless | Postgres + API (Node/Go) | One developer, no servers, real-time reads, rules as access layer | Need for joins/reports at scale, complex search, or vendor limits; then Cloud SQL behind the same function interfaces |
| Reads | Client reads Firestore directly | BFF API for all reads | Less code, faster, cheaper | Rules get too complex or we need per-request logic on reads |
| Code layout | 4 folders (UI, `src/api`, commands, domain); 3 ports (Payments, Messaging, Clock) | 7 layers with ViewModel builders, query cache, intent bus, a port per vendor | One developer; one ESLint rule keeps the UI off Firebase; ports only where tests need fakes | A second client app, or a second vendor for the same job |
| Allowed actions | Stored on the Order by every command and sweep rule | Computed per read by a function | Direct reads stay possible; one domain function decides | A window that must close to the second (the sweep lags up to 5 minutes; commands re-check) |
| Time rules | One 5-minute sweep | Cloud Tasks timer per Order | Simple, idempotent, easy to test with a fake clock | Timer precision needs under a minute, or sweep size exceeds a run |
| Stock | `held` counter on the Listing | Lock documents; optimistic payment then refund | One write, easy expiry | Very hot Listings (shard the counter) |
| Money | Integer paise; manual Payouts | RazorpayX payouts, Route | No current account needed; no turnover requirement | Volume makes manual runs painful (1.1) or Route eligibility (1.3) |
| Payment confirmation | Callback plus webhook plus fetch | Webhook only | Fast UX plus safety | Never worth removing the webhook |
| Search | Title prefix + filters | Algolia/Typesense | Zero extra service | Users search by words, artist names or typos |
| Rendering | SPA with prerender for Artwork pages | Next.js SSR | Keeps one simple Firebase Hosting deploy | SEO needs beyond prerender, or personalisation on public pages |
| Instagram | Official embeds, links only | Download and re-host | Meta terms; no storage | Meta changes embed policy |
| Language | JavaScript | TypeScript | Matches existing code | Team grows; add types to `functions` and shared schemas first |

**Revisit as the system grows:** shard hot counters; move search out; replace the sweep with Cloud Tasks for exact timers; introduce an audit log and Cloud KMS for tokens; split `functions` into several codebases per area; move reporting to BigQuery via the Firestore export; consider Route/RazorpayX when eligible.

---

## 12. Assumptions and open questions

### 12.1 Assumptions this design depends on
1. Razorpay allows a marketplace to collect for onboarded sellers on a standard account (ADR 0004). **Unconfirmed.** If refused, the payment flow and Payout design change (Route or direct-to-seller).
2. UPI/card/netbanking all settle to CraftMe's account within Razorpay's normal schedule; `payments.fetch` returns the `fee` deducted from the Payout.
3. Firestore transactions can express the stock hold at the volumes in 1.4; Razorpay refunds do not return the original gateway fee (from research, not tested).
4. Instagram oEmbed needs no token for single public posts; listing an Artist's own media needs Business/Creator accounts and Meta App Review.
5. Region `asia-south1` offers every product used.

### 12.2 Open questions
| # | Question | Needed by |
|---|---|---|
| 1 | Firebase project: reuse `craftme-3851a` as staging, new project for production? | Phase 0 |
| 2 | Prerender approach for Artwork pages (build-time vs a function) | Phase 8 |
| 3 | Encrypt Instagram tokens with Cloud KMS at launch or later? | Go-live |
| 4 | Is a held counter per Listing enough, or do popular Prints need sharding from day one? | After first beta |
| 5 | Who is the second Admin and how is the Payout run reviewed (four eyes)? | Go-live |

### 12.3 Not verified
Nothing here has been built or run. Razorpay, Meta and Firestore details come from documentation and general knowledge; confirm each in the phase that depends on it (blueprint Part 14). Cost numbers are estimates.
