---
status: accepted
---

# CraftMe collects payments and pays Artists after the damage window

Buyers pay CraftMe through its own Razorpay account. CraftMe pays each Artist in a batch on the 1st and 15th for Orders that are Received and past the 3-day Damage Report window, keeping a Commission and deducting Refunds and the gateway fee; Artists also pay a one-time Onboarding Fee. This replaces ADR 0001 (Buyers pay Artists by UPI): self-reported UPI payments made disputes, fee billing, Autopay and Restriction hard to run, while collecting centrally gives verified payment data, Refunds CraftMe can make itself, and a Commission that never has to be chased.

## Considered Options

- **UPI direct to Artists (ADR 0001)**: no money held, but no verified payment data and a monthly fee that had to be collected from Artists.
- **Razorpay Route split payments**: the clean version of this model, but Razorpay enables Route only above ₹40 lakh domestic turnover (as of November 2026). Revisit once CraftMe qualifies.
- **Artists' own Razorpay accounts via Partner OAuth**: verified data, but every Artist needs a merchant account and the Commission still has to be billed.

## Consequences

- CraftMe holds Buyers' money for two to four weeks. Whether that fits RBI payment aggregator rules and Razorpay's marketplace terms must be confirmed by a lawyer and by Razorpay in writing before launch.
- Razorpay's marketplace terms make CraftMe responsible for checking each Artist (identity and bank details) and for what they sell.
- Razorpay keeps its fee on refunds, so avoiding refunds (for example by holding stock during checkout) saves real money.
