# CraftMe (Artist Marketplace): Restart Plan, summary

**The full plan is [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md)** (version 3.0). This page is the short version; if they disagree, the blueprint wins. Terms are defined in [GLOSSARY.md](GLOSSARY.md); decisions are recorded in [docs/adr/](docs/adr/).

Updated 2026-11-07.

## Where the project stands
- A scaffold of about 1,500 lines in 48 source files. It **cannot build or run today.** Nothing has been run; every finding comes from reading the code.
- Git holds only the 18 starter files. All real work, the env files and the plan files are **untracked**. Nothing sensitive has been committed.
- Main problems: syntax errors and missing imports in many files, a Stripe payment flow that trusts the browser, and Firestore rules that let any user make themselves admin.

## Decision: rebuild, port the good parts
Rebuild on Vite + React 19 + MUI 7 + Firebase. Keep the form checks, the cart logic, the route guards and the review status flow.

## The model (decided 2026-11-07)
- **Money:** Buyers pay **CraftMe** through Razorpay. Listings are held for 15 minutes during checkout. Artists are paid **by hand on the 1st and 15th**, once an Order is Received and its 3-day damage window has passed. CraftMe keeps a **Commission** (rate set later) and a one-time **Onboarding Fee**. A Payout is price − Refunds − Commission − Razorpay fee.
- **Selling:** an Artwork has Listings (one Original and/or Prints). One Artist per Cart. The Artist ships; the price includes shipping; India only.
- **Trust:** Refunds per Order Line, decided by the Admin; Damage Reports within 3 days; Reviews rate the Artist and are approved by the Admin. Artists who owe money for 60 days, or misbehave, are Restricted.
- **Instagram:** Artists with Business or Creator accounts connect Instagram and pick posts for an Instagram Showcase (up to 9) and reels for Artworks. Only links are stored. Anyone can paste links.
- **Goal:** a full demo in **test mode** first. Going live (register a business, lawyer, Razorpay marketplace approval, Meta App Review) is a separate final phase.

## Phases (about 27.5 days to the demo; plan 6–8 weeks)
| # | Phase | Days |
|---|---|---|
| 0 | Reset and tooling (commit the work first; Razorpay test keys; Meta app in development mode) | 0.5 |
| 1 | Foundation: config, auth, routing, layout | 2 |
| 2 | Security rules and data model, with tests | 2 |
| 3 | Artists (Verification, Onboarding Fee) and catalog | 5 |
| 4 | Cart, Razorpay checkout, Orders, the sweep | 5 |
| 5 | Instagram Connect, Showcase, reels | 3 |
| 6 | Damage Reports, Refunds, Reviews, notifications, email | 3.5 |
| 7 | Payouts and admin | 3 |
| 8 | Quality and demo launch | 3 |
| 9 | Go-live, when ready (plus outside waiting time) | 2 |

Do rules before features. Do payment verification and the Checkout Hold before anything that depends on Orders.

## Where to look in the blueprint
- Part 1: vision, model and scope.
- Part 2: how the project should have started.
- Part 3: file-by-file state.
- Part 4: all 124 features with status.
- Part 5: architecture, data model, rules and timers.
- Part 6: detailed phases.
- Part 8: tests.
- Part 10: demo and go-live checklists.
- Part 11: risks.
- Part 12: roadmap.
- Part 13: decisions.
- Part 14: limits.
