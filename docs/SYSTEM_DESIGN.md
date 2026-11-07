# CraftMe: System Design (Boundaries and Contracts)

Version 2.1 · 2026-11-08 · Pre-flight audit folded in: 4-folder layout, Onboarding Fee flow, artist-open flag, Buyer write column, Commission base, stored allowed actions. Architecture of structure, state and separation. Implementation detail (algorithms, function internals, costs, operations) lives in [SYSTEM_DESIGN_DETAILED.md](SYSTEM_DESIGN_DETAILED.md). Product scope is in [../PROJECT_BLUEPRINT.md](../PROJECT_BLUEPRINT.md); terms in [../GLOSSARY.md](../GLOSSARY.md); decisions in [adr/](adr/).

**Scope of this document:** (1) data model layout and structural boundaries, (2) state management and API/data-flow boundaries, (3) separation of concerns, with the HTML UI layer fully decoupled from backend application logic. It contains maps, tables and interface definitions only: no implementation code.

**Contents:** 1 Principles · 2 Layers and boundaries · 3 Data model · 4 Write authority and invariants · 5 State management · 6 API and data-flow boundaries · 7 Separation of concerns · 8 Cross-cutting boundaries · 9 Traceability · 10 Assumptions and open questions.

---

## 1. Principles

| # | Principle | Consequence |
|---|---|---|
| P1 | **The UI is a pure projection.** It renders view models and emits intents. It holds no business rule, no price, no stage logic, no service credentials. | The 36 HTML screens can be redesigned, or replaced by another client, without touching the backend. |
| P2 | **One writer per fact.** Every field has exactly one component allowed to change it. | No two layers can disagree about money, stock or stage. |
| P3 | **Commands change state; queries read it.** Commands go through the application boundary. Queries read published read models. | The UI never "computes" the system's state; it asks for it. |
| P4 | **Dependencies point inward.** UI → `src/api` → commands → domain. The domain knows no framework, database or vendor. | One seam on each side: only `src/api/` imports Firebase in the client; only `functions/src/domain/` holds rules. |
| P5 | **The server is the only authority for money and stage.** Client checks are hints. | Validation exists twice by design: advisory in the UI, authoritative in the domain. |
| P6 | **Only what tests must fake is behind a port.** Payments, Messaging and Clock are ports. Firestore, Storage and Instagram are called directly, each from one module. | Test money, email and timers with fakes; no interface without a second implementation. |
| P7 | **State has a single source of truth and a stated lifetime.** | Section 5 names the owner, scope and invalidation of every kind of state. |

---

## 2. Layers and boundaries

### 2.1 Layer map
Four folders, one seam each. For one developer on Firebase, separate ViewModel-builder, cache, intent-bus and application layers would be code nobody needs yet; their jobs are folded in as noted.
```
┌────────────────────────────────────────────────────────────────────────────┐
│ UI      src/app, src/features/*, src/components                            │
│         React components: props in (ViewModel), callbacks out (Intent)     │
│         one hook per screen builds its ViewModel from src/api hooks        │
├──────────────── SEAM: only src/api imports firebase/* (ESLint rule) ───────┤
│ API     src/api   firebase.js · gateway.js (call, hooks, direct writes)    │
│         react-firebase-hooks + Firestore local cache = the query cache     │
├════════════════════════════ NETWORK / TRUST BOUNDARY ═══════════════════════┤
│ COMMANDS functions/src/commands/*  ·  webhook.js  ·  sweep.js              │
│         command() wrapper: auth, role, schema, idempotency, envelope       │
│         each command loads, applies domain rules, saves in a transaction   │
├──────────────────────────────── DOMAIN BOUNDARY ───────────────────────────┤
│ DOMAIN  functions/src/domain/*   order stages, money, allowed actions      │
│         pure: no I/O, no clock, no vendor types                            │
└────────────────────────────────────────────────────────────────────────────┘
 Ports (functions/src/ports.js): Payments (Razorpay) · Messaging (SendGrid) · Clock
```
The L1–L7 names used in older notes map as: L1+L2 → UI, L3 → API, L4+L5 → COMMANDS, L6 → DOMAIN, L7 → ports and direct Firestore/Storage/Instagram calls inside commands.

### 2.2 System context
```
 Buyer / Artist / Admin ──(any HTML client)──►  CraftMe
                                                 │   ▲
              Payments provider ◄─── PaymentsPort│   │ webhooks (signed)
              Instagram         ◄─── instagram.js│   │
              Email provider    ◄─── MessagingPort
              Object storage    ◄─── src/api upload + Storage rules
```
CraftMe depends on four external systems, each only through its port. External systems never receive internal identifiers they do not need, and never reach the domain except through a verified inbound boundary (webhooks).

### 2.3 Bounded contexts
| Context | Owns | Depends on |
|---|---|---|
| **Identity** | Account, roles, Artist Verification, Artist standing (open / Restricted) | none |
| **Catalog** | Artwork, Listing, Category, media, Instagram Showcase links, Reports and Takedown | Identity (artist id, standing) |
| **Ordering** | Cart (client-only), Order, Order Line, Checkout Hold, stock reservation | Catalog (price, stock), Identity |
| **Fulfilment** | Shipping address, shipment, Received, deadlines | Ordering |
| **Money** | Payments, Refunds, Commission, Payable, Payout, Amount Owed | Ordering, Identity, PaymentsPort |
| **Trust** | Damage Reports, Reviews, ratings | Ordering, Fulfilment |
| **Connections** | Instagram connection, tokens, media picks | Identity, `instagram.js` |
| **Notification** | In-app notifications, emails | all (consumes domain events) |
| **Administration** | Settings, queues, Payout runs, role changes | all (through commands only) |

Context rule: a context reads another's data only through its published read model or by receiving its domain event. It never writes another context's data.

---

## 3. Data model

### 3.1 Entity map
```
 Account 1───0..1 ArtistProfile 1───0..1 ArtistPrivate (Verification, payout details)
    │                   │
    │                   ├───0..1 InstagramConnection ─── (secret token, never exposed)
    │                   │
    │                   └───* Artwork 1───* Listing ◄──────────────┐ referenced by snapshot
    │                                                              │
    ├───* Order *───1 ArtistProfile            Order 1───* OrderLine (frozen copy of Listing at payment)
    │      │ 1───1 ShippingAddress (private)     │ 1───* Refund (per OrderLine)
    │      │ 1───0..1 DamageReport                │ 0..1 PayoutLine ───* Payout *───1 ArtistProfile
    │      └ 1───0..1 Review ──► ArtistProfile    │
    │                                              └ 1───* Payment attempt (provider ids)
    └───* Notification            AmountOwed (per Artist) ◄── Refund after Payout
 Settings (singleton)   Report ──► Artwork | ArtistProfile      ProcessedEvent (system)
```

### 3.2 Entity catalogue (conceptual fields; types omitted on purpose)
| Entity | Identity | Core attributes | Visibility | Lifecycle |
|---|---|---|---|---|
| **Account** | account id | display name, photo, bio, roles | public (name, photo, bio), private (email, phone) | created at first sign-in; deletable on request |
| **ArtistProfile** | = account id | rating average and count, Showcase links (≤9), standing | public | exists once the Artist role is granted |
| **ArtistPrivate** | = account id | legal name, PAN, payout method, phone verified, verified-at, fee-paid-at, Amount Owed, restriction reasons | owner + Admin only | created by Verification; edits re-open the check |
| **InstagramConnection** | = account id | connected flag, handle, token expiry; **token held in a separate secret record** | handle public; token system only | create on connect; delete on disconnect or deletion request |
| **Artwork** | artwork id | owner, title, description, Category, photos (≤5), video or reel link, status, has-sales flag, views, from-price, availability, artist-open flag | public when published and artist-open | draft → published → removed; deletable only if never sold |
| **Listing** | listing id | owner, parent Artwork, kind (Original or Print), size, medium, price, stock, held, status, artist-open flag | public when live or sold and artist-open | draft → live → sold or ended |
| **Order** | order id (+ short code) | Buyer, Artist, list of Order Lines, total, stage, deadlines, payment references, gateway fee, Commission rate at payment, payable flag, payout reference, Buyer actions, Artist actions, hold expiry | Buyer and Artist and Admin | see 3.4 |
| **Request** | caller + request id | stored result envelope | system | write-once; pruned after retention |
| **OrderLine** | line id (inside Order) | listing reference, title and kind snapshot, unit price, quantity, refunded quantity | as Order | immutable except refunded quantity |
| **ShippingAddress** | = order id | name, phone, address, city, state, PIN | Buyer, Admin; Artist only once Paid | immutable |
| **DamageReport** | report id | Order, lines, photos, note, status, decision | Buyer, Artist of the Order, Admin | open → decided |
| **Refund** | refund id | Order, lines with amounts, reason, provider refund id, after-payout flag | Buyer, Artist of the Order, Admin | append-only |
| **Review** | = order id | Artist, Buyer, rating, comment, status | public when approved | pending → approved or rejected |
| **Payout** | payout id | Artist, run date, included Orders, gross, refunds, Commission, gateway fees, amount-owed deducted, net, method, reference, status | Artist (own), Admin | draft → sent; sent is final |
| **Notification** | notification id | recipient, type, data, read flag | recipient | append; read flag flips once |
| **Report** | report id | target, reason, reporter, status | Admin | open → resolved |
| **Settings** | singleton | Commission rate, Onboarding Fee, feature switches | switches public; rest Admin | edited by Admin |
| **ProcessedEvent** | external event id | handled-at | system | write-once; pruned after retention |

### 3.3 Data classification and placement
| Class | Examples | Stored | Exposed to clients |
|---|---|---|---|
| **Public** | published Artworks, live Listings, Artist profile, approved Reviews | public-readable collection | read model |
| **Participant-private** | Orders, Notifications, Payout statements | owner-scoped collection | read model, owner only |
| **Restricted-private** | shipping address, PAN, payout details | separate record per entity, narrower access | owner (+ Admin); Artist sees address only when allowed |
| **Secret** | provider tokens, API keys, webhook secret | secret store or functions-only record | never |
| **System** | idempotency records, heartbeat, counters | system records | never |

Rule: a record holds data of **one** class. A field of a stricter class is moved to its own record rather than hidden inside a public one.

### 3.4 State machines (conceptual)
| Entity | States | Who may cause each transition |
|---|---|---|
| **Order** | hold → paid → shipped → received; side exits: hold_expired, refunded (all lines refunded) | hold: Ordering command; paid: Payments confirmation; shipped: Artist command; received: Buyer command or timer; hold_expired: timer; refunded: Money command |
| **Listing** | draft → live → sold, ended (and back to live) | Artist (draft, live, ended); system (sold, back from hold) |
| **Artwork** | draft → published → removed | Artist (draft, published); Admin (removed) |
| **Review** | pending → approved or rejected | Buyer creates pending; Admin decides |
| **Payout** | draft → sent | System builds draft; Admin records sent |
| **Artist standing** | open ↔ restricted | system rule (60-day owed) or Admin with a reason. The change sets the artist-open flag on the Artist's Artworks and Listings; Listing status is never touched, so lifting restores exactly what was live. |
| **Damage Report** | open → upheld or rejected | Buyer opens; Admin decides |

Every transition table has one owner in the domain layer. No other layer encodes stage rules.

### 3.5 Keys and references
- All identifiers are opaque strings. Orders also carry a short human code for the Buyer; the code is display-only and never used as a key.
- References are by identifier. History that must not change (what was bought, at what price) is **copied** into the Order Line at payment, never referenced live.
- One Review per Order (the Review's identity is the Order's). Entitlement to review is read from the Order itself: Received, the caller is its Buyer, inside the window, no Review yet.
- Money is whole minor units (paise). Rates are basis points. Times are UTC instants; business calendars (Payout days, deadlines) are evaluated in India Standard Time.

### 3.6 Denormalisation rules
Allowed, to serve read models: Artist name and photo on an Artwork card; "from price" and availability on an Artwork (so Browse is one query, never one per card); the artist-open flag on Artworks and Listings (written only by the standing change); Buyer and Artist allowed actions on an Order (written by every command and sweep rule that changes the Order); creator list on an Order; rating summary on an Artist. Every denormalised value has **one** source and **one** updater (a domain event consumer). A denormalised copy is never the source for a decision.

---

## 4. Write authority and invariants

### 4.1 Write-authority matrix
`W` = may write. `R` = may read. Blank = no access. "Client" means any UI/application code outside the backend.

| Data | Client (direct write) | Buyer commands | Artist commands | Money services | Admin commands | Timers | Provider webhooks |
|---|---|---|---|---|---|---|---|
| Account display fields | W (own) | | | | | | |
| Roles and standing | R | | | W (role on fee paid) | W | W (standing) | |
| ArtistPrivate | R (own) | | W (submit) | W (owed, fee paid) | W (verify) | | W (fee paid) |
| Artwork and draft Listing content | W (own, field-limited) | | | | | | |
| Artist-open flag | R | | | | W (restrict, lift) | W (restrict) | |
| Listing stock, held, sold | R | W (hold, via place) | | W (commit) | | W (release) | |
| Order and Order Line | R | W (place, receive) | W (ship) | W (pay, refund) | W (refund) | W (expire, receive) | W (paid) |
| Shipping address | R (allowed) | W (place) | | | | | |
| Damage Report | R (own) | W (open) | | | W (decide) | | |
| Review | R (approved) | W (submit) | | | W (decide) | | |
| Notification read flag | W (own) | | | | | | |
| Payout and Amount Owed | R (own) | | | W | W (record) | W (build) | |
| Settings | R (switches) | | | | W | | |
| Provider tokens | | | W (connect, via function) | | | W (refresh) | W (deauthorise) |

Reading the matrix: **no client column has write access to any money, stage, stock, role or secret field.** Those columns are enforced in two places: the access rules at the data store (defence) and the command layer (the only code that can satisfy them).

### 4.2 Domain invariants (each has one owning rule in L6)
1. An Order contains Lines from exactly one Artist.
2. A Listing's reservable quantity is stock minus held and never below zero.
3. An Original's stock is always 0 or 1.
4. An Order is Paid only after the provider confirms an amount equal to the Order total.
5. An Order Line's refunded quantity never exceeds its quantity; total refunds never exceed the amount paid.
6. An Order is paid out at most once.
7. A Review exists only for a Received Order, once, inside its window.
8. Commission = floor(rate_bp × (price − Refunds) / 10000). Payout net = price − Refunds − Commission − the full gateway fee − owed deducted, in whole paise, and the statement reconciles to the paisa. Example: ₹1,000, ₹400 Refund, 1000 bp, ₹30 fee → Commission 6000 paise, net 51000 paise.
9. A Restricted Artist cannot publish and their Artworks and Listings are hidden from public reads (artist-open flag off); open Orders still complete.
10. A Buyer cannot buy their own Listing.

---

## 5. State management

### 5.1 State taxonomy
| Kind | Definition | Source of truth | Owner in the client | Lifetime | Examples |
|---|---|---|---|---|---|
| **Server state** | facts the backend owns | backend stores | cache in L2, read through L3 | refreshed by subscription or refetch | Artworks, Orders, notifications |
| **Session state** | who the user is | identity provider | session store in L2 | until sign-out | account, roles, token claims |
| **Client-owned state** | facts only the client knows | the client | cart store in L2 | persisted locally, revalidated on use | Cart contents, remembered theme |
| **Form state** | an unsent edit | the form | local to the screen | until submit or leave | address, Review text |
| **View state** | how things look right now | the UI | local to the component | until re-render | open dialog, selected tab, current photo |
| **Derived state** | computed from the above | none | pure functions in L2 | recomputed | counts, totals shown, timers |
| **Navigation state** | which screen and which sub-state | the URL | router in L2 | per visit | screen id, state key (empty, error, paid…) |

**Rules**
1. Server state is never copied into view state; the view holds a reference to the cached model.
2. Derived money values shown in the UI are labelled **preview**; the authoritative figure always comes from the backend.
3. Two sources for one fact is a defect. Example: the Order's stage is read from the Order, never inferred from timeline events.
4. View state and form state die with the screen; nothing sensitive is persisted locally. The Cart is the only persisted client-owned data, and it holds identifiers and quantities, not prices.

### 5.2 State ownership map
```
  Identity provider ──► AuthContext ───────────────┐
                                                   ├──► one hook per screen ──► components
  Read models (backend) ──► src/api hooks ────────┤   (react-firebase-hooks +
                                                   │    Firestore local cache)
                                                   │
  Local storage ──► CartStore (ids + quantities) ──┘
  Router (URL) ──► NavigationState
  Screen-local ──► FormState, ViewState
```
Only the screen hook combines sources. Components receive one ViewModel as props and do not read a store directly. One subscription per data set: the notifications listener lives once in the shell (limit 20), never one per component.

### 5.3 Freshness and invalidation
| Data | Strategy | Why |
|---|---|---|
| Catalog browse | fetch per page, cache briefly, stale-while-revalidate | read-heavy, tolerates seconds of lag |
| Artwork detail and Listings | one live listener on its Listings while the page is open | stock changes |
| Own Orders, notifications | live subscription (notifications: latest 20) | status changes asynchronously |
| Cart | local ids and quantities; **re-validated by `placeOrder`**, which returns `conflict` with the changed lines in one round trip | prices and stock are not trusted locally; no separate client re-fetch |
| Session claims | read from the cached token; force-refreshed only after `becomeArtist` or `setRole` | roles gate screens |

### 5.4 Update policy (optimistic vs confirmed)
| Action | Policy |
|---|---|
| Mark notification read, toggle a UI preference | optimistic with rollback |
| Edit own profile and draft content | confirmed (wait for the backend), show saving state |
| Any command that moves money, stock or stage | **confirmed only**, never optimistic; the UI shows "processing" until the Order's stage reflects it |

### 5.5 Screen state model
Every screen exposes a **status** and, where relevant, a **state key** in its view model, so the UI can render each state without logic:

| Status | Meaning | UI renders |
|---|---|---|
| `loading` | first load in flight | skeleton |
| `ready` | data present | content |
| `empty` | query succeeded, no rows | empty state with the next action |
| `error` | query or command failed | message built from the error contract (6.5) |
| `forbidden` | role or standing blocks the screen | explanation and a way forward |
| `stale` | showing cached data while refreshing | content with a quiet indicator |

The state keys used in the design reference (for example paid, shipped, received, refunded, owed, restricted, expired, sold) are values of fields in the view model, not UI-only toggles. The UI maps `status` and state keys to presentation and never derives them.

---

## 6. API and data-flow boundaries

### 6.1 UI contract (the only thing the UI knows)
| Direction | Name | Content | Rules |
|---|---|---|---|
| Into the UI | **ViewModel** | plain data per screen: display-ready text values, formatted numbers, booleans such as `canShip`, lists, `status`, state keys | immutable; no functions; no vendor objects; localised and formatted by L2 |
| Out of the UI | **Intent** | a named event with a small payload of user input: for example `cart.add`, `checkout.submit`, `order.confirmReceived`, `artwork.publish` | no results returned to the UI; the outcome arrives as a new ViewModel |
| Out of the UI | **Navigation request** | target screen id and parameters | resolved by the router |

The UI may hold: markup, styles, motion, and display-only scripts (tabs, dialogs, carousels, focus). It must not hold: price maths, stage rules, permission checks beyond hiding a control, network calls, vendor SDKs, secrets.

### 6.2 Gateway port (client side)
Abstract interface between L2 and the backend. The application layer sees only this port, never a vendor SDK.

| Operation family | Operations (names) | Returns |
|---|---|---|
| **Queries** | listArtworks, getArtwork, listListings, getArtist, listReviews, getMyOrders, getOrder, getNotifications, getArtistInbox, getPayouts, getAdminQueues | read models |
| **Commands** | see 6.3 | result envelope (6.5) |
| **Subscriptions** | watchOrder, watchNotifications, watchArtistInbox | stream of read models |
| **Direct writes** | saveProfile, saveDraft, markRead: direct store writes, field-limited by access rules (4.1 "Client" column) | write result |
| **Files** | upload(kind, file) → storage path | file reference |
| **Session** | signIn, signOut, currentSession, refreshClaims | session |

Every command goes through one function, `call(name, input)`, which adds the request id and never throws: it always resolves to the envelope (6.5).

### 6.3 Command catalogue (backend application boundary)
All commands: authenticated; carry a caller-supplied **request id** for idempotency; return a result envelope; never return secrets.

| Command | Actor | Input (conceptual) | Preconditions | Effects (events emitted) | Typical failures |
|---|---|---|---|---|---|
| submitVerification | signed-in Account | legal name, PAN, payout method, phone proof | none | ArtistPrivate created or reopened (`VerificationSubmitted`) | invalid data |
| payOnboardingFee | Account with Verification submitted | request id | fee not yet paid | provider charge created for the Settings fee amount; returns the charge reference | already paid |
| becomeArtist | Account | request id | verification and fee present | role granted (`ArtistActivated`) | prerequisites missing |
| placeOrder | Buyer | Artist, lines (listing, quantity), address | one Artist; live price; stock available; Buyer ≠ Artist | total computed on the server from Listings; Order in `hold`, stock reserved (`OrderPlaced`) | sold, mixed Artists, restricted Artist, price changed (with changed lines) |
| confirmPayment | Buyer (callback) | payment proof | Order in hold | Order `paid`, stock committed (`OrderPaid`) | bad proof, amount mismatch |
| markShipped | Artist of the Order | courier, tracking | Order paid | `OrderShipped` | wrong stage |
| confirmReceived | Buyer of the Order | order id | Order shipped | `OrderReceived` | wrong stage |
| reportDamage | Buyer | order, lines, note, photos | received, inside window | `DamageReported` | window closed |
| submitReview | Buyer | order, rating, comment | received, inside window, none yet | `ReviewSubmitted` | closed, duplicate |
| decideDamage, issueRefund | Admin | decision, lines, reason | report or Order exists; amounts within paid | `RefundIssued` | exceeds paid |
| decideReview, takedown, restrictArtist, setRole, markVerified | Admin | target, decision, reason | target exists | respective events | not found |
| buildPayoutRun, recordPayout | Admin / timer | run or payout, reference | verified Artist; not yet paid out | `PayoutRecorded` | already recorded |
| connectInstagram, completeInstagramConnect, listInstagramMedia, saveShowcase, disconnectInstagram | Artist | code or picks | Business or Creator account | `InstagramConnected` / `Disconnected` | personal account |
| report | Buyer | target, reason | target exists | `ReportFiled` | none |

### 6.4 Inbound boundaries and events
**Webhooks (provider → CraftMe):** payment captured (Order), onboarding fee captured (sets fee paid on ArtistPrivate), refund processed, Instagram deauthorise, Instagram data deletion. Each is verified (signature or state) before anything reads its body, deduplicated by external event id, acknowledged quickly, and translated into an internal command.

**Domain events (internal):** produced by the application layer after a state change; consumed by Notification, read-model updaters and analytics.

| Event | Produced by | Consumers |
|---|---|---|
| OrderPlaced / OrderPaid | Ordering, Money | Notification (Buyer, Artist), analytics, read-model updater |
| OrderShipped / OrderReceived | Fulfilment | Notification, Review window opener, Payable scheduler |
| RefundIssued | Money | Notification, Amount Owed ledger, Payout recalculation |
| ReviewApproved | Trust | Artist rating updater, Notification |
| PayoutRecorded | Money | Notification, Order marking |
| ArtistRestricted / Lifted | Identity | Catalog (set the artist-open flag; Listing status unchanged), Notification |
| OnboardingFeePaid | Money | Notification, BecomeArtist screen |
| ListingChanged | Catalog | Artwork card updater ("from price", availability) |

Event rules: events are facts in the past tense, carry identifiers (not whole entities), are handled idempotently, and a consumer failure never rolls back the producer.

### 6.5 Result and error contract
Every command returns one **envelope**: `ok` (boolean), `data` (command-specific), `error` (absent when ok), `requestId`.

| Error code | Meaning | UI behaviour |
|---|---|---|
| `unauthenticated` | sign in required | route to sign-in, return afterwards |
| `forbidden` | role or ownership missing | show the forbidden state |
| `invalid` (with field list) | input failed validation | mark fields, keep input |
| `conflict` (with reason) | stage, stock, window or duplicate | show the reason text mapped from the reason code |
| `rate_limited` | too many attempts | ask to wait |
| `unavailable` | a provider is down | offer to retry; money commands fail closed |
| `internal` | unexpected | generic message, request id for support |

Reason codes are stable strings (for example `sold`, `window_closed`, `mixed_artists`). The UI maps codes to copy; the backend never sends display text.

### 6.6 Ports (outbound)
Only what tests must fake. Everything else is a direct call from one module.

| Port | Operations (abstract) | Adapter | Fake |
|---|---|---|---|
| **PaymentsPort** | createOrder(amount, receipt) → reference; verifySignature(payload); verifyWebhook(raw body, signature); fetchPayment(id) → amount, fee, status; refund(payment, amount) | Razorpay | in tests |
| **MessagingPort** | send(template, recipient, data, dedupeKey) | SendGrid | in tests |
| **ClockPort** | now | system time | fixed clock |

| Direct (no port) | Module | Why no port |
|---|---|---|
| Firestore | inside each command | one store, covered by emulator tests |
| Storage | `src/api` upload, Storage rules | one store |
| Instagram Graph API | `functions/src/instagram.js` (plain HTTPS) | one vendor, one module |
| Secrets | `defineSecret` in functions | platform feature |

### 6.7 Data-flow maps
**Read path (public):**
```
component ◄─ ViewModel (props) ◄─ screen hook ◄─ src/api hook (react-firebase-hooks + local cache) ◄─ public read model
```
**Command path (money or stage):**
```
HTML UI ─Intent─► Intent handler ─► Gateway.command ──► API surface (auth, validate, idempotency)
                                                              │
                                                         Application use case
                                                              │ loads from Firestore, applies Domain rules
                                                              ├─► saves in one transaction (incl. allowed actions)
                                                              ├─► PaymentsPort / others (outside the transaction)
                                                              └─► publishes Domain events ──► consumers
 result envelope ◄───────────────────────────────────────────┘
 UI shows "processing" ◄─ subscription delivers new read model with the new stage
```
**Inbound webhook:**
```
Provider ─► verify signature ─► dedupe on event id ─► translate to internal command ─► same use case as the UI path ─► 2xx
```
**Time-driven:**
```
Timer (every few minutes) ─► rule list (expire hold, overdue, auto-receive, payable, restrict) ─► same use cases, idempotent
```
The same use case serves UI, webhook and timer: one place for each rule.

### 6.8 Read-model contract (what the client may query)
| Read model | Shape (conceptual) | Access |
|---|---|---|
| ArtworkCard | id, title, artist name and photo, Category, cover image, "from price", availability | public |
| ArtworkDetail | ArtworkCard + photos, media, description, Listings summary | public |
| ArtistPublic | name, photo, bio, rating, Showcase links, Artwork ids | public |
| ReviewPublic | rating, comment, buyer first name, date | public (approved) |
| OrderView | Order summary, lines, stage, deadlines, hold expiry, allowed actions (`canConfirmReceived`, `canReportDamage`, …) stored per role on the Order, timeline | Buyer, Artist, Admin |
| ShippingView | address | Buyer, Admin, Artist when allowed |
| InboxItem | Order summary for an Artist, ship-by, estimated earnings | Artist |
| PayoutStatement | lines, deductions, net, reference | Artist (own), Admin |
| AdminQueueItem | typed queue rows | Admin |
Read models carry **allowed actions** as booleans computed server-side, so the UI never decides whether a button is available. They are computed by one domain function, `allowedActions(order, role, now)`, and written onto the Order by every command and sweep rule that changes it. A window that closes between sweeps (up to 5 minutes) may still show a button; the command re-checks and returns `conflict`.

---

## 7. Separation of concerns

### 7.1 Layer responsibilities
| Folder | Owns | Must not |
|---|---|---|
| **UI** (`src/app`, `src/features/*`, `src/components`) | markup, layout, theming, motion, accessibility, routing, session context, Cart reducer, one hook per screen, formatting (`formatINR`, `reasonText`) | import `firebase/*` or `razorpay`; compute prices or stage; test `order.stage` to show a button; show raw error messages |
| **API** (`src/api`) | Firebase init and local cache, `call()`, read hooks, direct writes, uploads, request ids | contain presentation or business rules |
| **COMMANDS** (`functions/src/commands`, `webhook.js`, `sweep.js`) | auth, role, schema, idempotency and envelope (one `command()` wrapper), transactions, port calls, writing allowed actions and events | contain stage or money rules inline |
| **DOMAIN** (`functions/src/domain`) | stage transitions, money maths, allowed actions, invariants | perform I/O; read the clock; import Firebase or a vendor |

### 7.2 Keeping the HTML UI decoupled (explicit contract)
1. **Data in, events out.** Each screen is a function of one ViewModel and emits Intents. There is no other channel.
2. **No logic in markup.** No stage rules, rate maths, permission rules or validation beyond the hint level (for example "required", "max 100"). Hints are advisory; the backend re-validates.
3. **Copy and formatting are inputs.** Strings with variable parts, currency, dates and plurals arrive formatted in the ViewModel (or from a copy catalogue keyed by reason code). The HTML contains presentation words only.
4. **State is data, not DOM.** Empty, error, loading and every business state arrive as `status` and state keys. The UI never infers a state from data shape.
5. **Selectors are the seam.** The UI binds to a small, stable set of data attributes (screen id, region id, action id). Restyling or replacing markup changes nothing behind it.
6. **Static-first.** Every screen renders correctly from a ViewModel fixture with no backend. This is how the current reference screens work, and it is the test that proves decoupling. The reference screens (`docs/screens`) are ported as markup and CSS tokens only; their `ui.js` and `system.js` are prototype behaviour and are not ported. The hold countdown becomes `useCountdown(holdExpiresAt)` fed by the Order.
7. **Swap test.** Replacing the HTML layer with another client (native app, different framework) requires no change in L3 to L7.

### 7.3 ViewModel catalogue (screen groups → models)
| Screen group (from the design reference) | ViewModel | Key fields |
|---|---|---|
| Home, Browse | `HomeVM`, `BrowseVM` | featured and recent ArtworkCards, category list, filters (selected), page cursor, `status`, `isEmpty` |
| Artwork | `ArtworkVM` | detail, listing options with `available`, `soldLabel`, `selected`, `previewTotal`, `canAddToCart`, `ownArtworkNotice`, `reel` |
| Artist profile | `ArtistVM` | profile, rating summary, Showcase items, tabs availability, reviews page |
| Cart, Checkout | `CartVM`, `CheckoutVM` | lines, changes since added, `previewTotal`, `holdRemaining`, field errors, `canPay` |
| Orders, Order detail | `OrdersVM`, `OrderVM` | stage, timeline, deadlines, allowed actions, shipment, refunds, `canReview`, `canTellUsAboutProblem` |
| Artist dashboard | `ArtistDashVM`, `InboxVM`, `ArtworkEditorVM`, `PayoutsVM`, `InstagramVM`, `SettingsVM` | to-do list, earnings preview, listing rows, payout statements, connection state (`disconnected`, `connected`, `picker`, `lapsed`, `disabled`) |
| Account | `AuthVM`, `ProfileVM`, `BecomeArtistVM`, `NotificationsVM` | form errors, step, unread count |
| Admin | `QueuesVM`, `OrdersAdminVM`, `PayoutRunVM`, `ArtistsAdminVM`, `SettingsAdminVM` | typed queue rows, run totals, blocked rows |
| Shell | `ShellVM` | user label and roles, cart count, unread count, active nav item, feature switches |

### 7.4 Intent catalogue (UI → application)
| Group | Intents |
|---|---|
| Navigation | `nav.go`, `nav.back` |
| Catalog | `browse.filter`, `browse.search`, `browse.page`, `artwork.selectListing`, `artwork.report` |
| Cart and checkout | `cart.add`, `cart.remove`, `cart.setQuantity`, `cart.replace`, `checkout.submit`, `checkout.retryPayment` |
| Orders | `order.confirmReceived`, `order.reportProblem`, `review.submit` |
| Artist | `artwork.save`, `artwork.publish`, `listing.save`, `listing.end`, `order.markShipped`, `instagram.connect`, `instagram.savePicks`, `instagram.addLink`, `verification.submit`, `artist.payFee` |
| Admin | `queue.decide`, `refund.issue`, `payout.record`, `artist.restrict`, `settings.save` |
| Account | `profile.save`, `notification.markRead` |
| Session | `auth.signIn`, `auth.signOut`, `theme.set` |

In React an Intent is simply a callback prop; there is no event bus.
Intents carry user input only. They never carry computed money values or stage names.

### 7.5 Where each kind of validation lives
| Kind | Where | Authority |
|---|---|---|
| Required, length, format hints | L1/L2 | advisory |
| Cross-field and per-role input rules | L4 | authoritative |
| Business rules (stock, window, ownership, one-Artist) | L6 via L5 | authoritative |
| Data-store access rules | store | defence in depth |
| Provider confirmation of money | L7 verified by L5 | authoritative |

### 7.6 Enforcement
| Mechanism | Rule it protects |
|---|---|
| One ESLint `no-restricted-imports` rule: `firebase/*` and `razorpay` banned in `src/**` except `src/api/**` | dependency direction (P4) and P1 |
| Domain files import nothing but other domain files (checked in review; small folder) | pure domain |
| Contract tests: every ViewModel validated against its schema; every Intent against its schema | UI contract (6.1) |
| Fixture rendering test: each screen renders from fixtures in every state key | static-first (7.2) |
| Domain tests with a fake clock and fake ports; no emulators | P6 |
| Rules tests asserting the write-authority matrix (section 4.1) | P2 |
| Architecture review checklist on every new field: owner, writer, class, read model | data model integrity |

### 7.7 Forbidden couplings
- Markup that contains a price formula, a stage name test, or a role check.
- A view component that imports a vendor SDK or reads a store.
- A read model that returns display text, or a command that returns a ViewModel.
- A domain object that references a vendor type, a database reference or the clock.
- A second source for any fact in section 4.1.
- A webhook handler that changes data other than by invoking a command.

---

## 8. Cross-cutting boundaries
| Concern | Boundary |
|---|---|
| **Trust zones** | Zone 0 browser (untrusted). Zone 1 API surface (authenticates). Zone 2 application and domain (trusted). Zone 3 stores and secrets (accessed only from Zone 2). Data crosses zones only as validated commands, verified webhooks or read models. |
| **Identity and roles** | Roles are facts of Identity, enforced at L4 and the store; the UI only reflects them. |
| **Configuration** | Business settings (rates, fees, switches) are data owned by Administration; fixed rules (windows, deadlines) are domain constants, not settings. |
| **Observability** | Every command logs request id, actor, outcome. Sensitive fields (PAN, address, tokens, card data) are never logged. Heartbeats exist for timers. |
| **Time** | All rules use ClockPort; schedules are evaluated in India Standard Time. |
| **Failure** | Money commands fail closed. Reads degrade independently. Events and timers are idempotent so any step can be retried. |
| **Privacy** | Each entity has a classification (3.3); deletion removes personal records and keeps Orders and Reviews without names. |

---

## 9. Traceability
| This document | Blueprint | Glossary / ADR | Design reference |
|---|---|---|---|
| Contexts (2.3) | Part 5.4 data model | Glossary sections | Screen groups S01 to S36 |
| Order stages (3.4) | Part 5.6 timers | Order, Paid, Shipped, Received, Overdue | S11, S13, S24, S25 |
| Money (4.2 #8, 6.3) | Part 1.4 business model | Payout, Commission, Amount Owed; ADR 0004 | S26, S32 |
| One Artist per Order (4.2 #1) | Part 1.6 | Cart, Order; ADR 0002 | S08, S09 |
| Reviews (4.2 #7) | Part 4.7 | Review; ADR 0003 | S15, S04 |
| ViewModels (7.3) | Part 4 features | Terms in UI copy | all screens, state bar |
| Instagram boundary (2.3, 6.6) | Part 4.3 | Connected Instagram, Instagram Showcase | S27 |

---

## 10. Assumptions and open questions
**Assumptions:** the backend remains a managed document store with function-style commands (the boundary is vendor-neutral, the first implementation is not); one operator and a small team; India only, INR only; the payment provider accepts the collect-and-pay-later model (unconfirmed, ADR 0004).

| # | Question | Status |
|---|---|---|
| 1 | Shared ViewModel-builder package? | **Resolved:** no; one hook per screen. Revisit only if a second client appears. |
| 2 | Which read models need a backend query function? | **Resolved:** none. All are read from the store; allowed actions are stored on the Order (6.8). |
| 3 | Are the ViewModel and Intent catalogues (7.3, 7.4) the contract the UI is built against? | **Resolved:** yes. |
| 4 | Event delivery: in-process or a durable queue? | **Resolved:** in-process after the transaction commits; consumers are idempotent. Revisit at real load. |
| 5 | Payments provider decision outcome (marketplace approval) | Open; may change PaymentsPort and Payout design. |
