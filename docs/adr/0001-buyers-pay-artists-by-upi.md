---
status: superseded by ADR-0004
---

# Buyers pay Artists directly by UPI; CraftMe earns by billing Artists

Buyers pay each Artist's own UPI ID at checkout, with no payment gateway between them. The Buyer enters a Payment Reference and the Artist confirms receipt. CraftMe never holds Buyers' money. It earns a non-refundable Onboarding Fee and a monthly Platform Fee (fixed in month one, then 3% of the previous month's Order Lines that have a Payment Reference, minus Refunds), collected through CraftMe's own Razorpay account with optional Autopay. Unpaid fees lead to a 5-day Warning, then Restricted. We chose this so CraftMe handles as little money as possible and Artists carry their own Refunds and gateway costs.

## Considered Options

- **Razorpay Route split payments**: Razorpay enables Route only for businesses above ₹40 lakh domestic turnover (as of November 2026), so a new marketplace can't use it at launch.
- **Each Artist connects their own Razorpay account (Partner OAuth)**: gives verified payment and refund data, but every Artist needs a Razorpay merchant account with KYC. Rejected in favour of the lower barrier of a UPI ID; revisit if under-reporting or Payment Disputes become common.
- **CraftMe collects all money and pays Artists by hand**: risks being treated as an unauthorised payment aggregator under RBI rules, and puts every Refund on the operator.

## Consequences

- CraftMe has only self-reported payment data. The 3% fee counts Orders once the Buyer enters a Payment Reference, so an Artist can't avoid it by not confirming. Deals arranged off the platform can't be detected.
- Stock is held while an Order is Awaiting Payment (30 minutes to pay, 48 hours to confirm). Payment Disputes are judged by the Admin from both sides' proof.
- Refunds are made by the Artist by UPI and recorded by reference; the platform cannot send money itself.
- The legal position (RBI payment aggregator rules, GST on fees) is unconfirmed and must be checked with a lawyer and an accountant before launch.
