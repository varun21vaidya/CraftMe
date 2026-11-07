# CraftMe Marketplace

An online shop where independent Artists sell physical original artwork and prints to Buyers. CraftMe collects every payment and later pays each Artist their share, keeping a Commission.

## People and roles

**Account**:
A signed-in person. One Account can hold several roles at once.
_Avoid_: User (when the role matters), profile

**Buyer**:
An Account in the act of purchasing. Every Account is a Buyer by default.
_Avoid_: Customer, client, shopper

**Artist**:
An Account with the role that allows it to publish Artworks and sell Listings, and that receives Payouts from CraftMe. An Artist cannot buy their own Listings.
_Avoid_: Seller, creator, vendor, merchant

**Admin**:
An Account with the role that allows it to run the shop for the operator.
_Avoid_: Moderator, staff, superuser

**Connected Instagram**:
An Artist's Instagram Business or Creator account linked to their CraftMe profile, so they can pick their own posts and reels to show. Personal Instagram accounts cannot be connected; their posts can only be added by link.
_Avoid_: Instagram sync, Instagram login, social account

**Instagram Showcase**:
Up to nine Instagram posts or reels an Artist chooses to show on their public profile, picked from their Connected Instagram or added by link. CraftMe shows them as embeds and never stores copies.
_Avoid_: Feed, gallery, portfolio

## Catalog

**Artwork**:
A creative work by one Artist, shown with up to five photos, an optional video (uploaded, up to three minutes, or a linked Instagram reel), and a description. An Artwork is browsed, not bought.
_Avoid_: Product, item, piece

**Category**:
One of seven fixed groups an Artwork belongs to: Painting, Drawing & illustration, Photography, Sculpture, Prints & digital art, Crafts, Other.
_Avoid_: Tag, type, genre

**Listing**:
A sellable offer of an Artwork, either the Original or a Print run, with its own size, price and stock. A Listing is what goes in the cart.
_Avoid_: Variant, SKU, product, offer

**Original**:
A Listing for the single one-of-a-kind physical Artwork. Its stock is always one.
_Avoid_: One-off, unique piece

**Print**:
A Listing for reproductions of an Artwork in one size and medium, with a stock of one or more.
_Avoid_: Copy, reproduction, edition (unless numbered)

**Sold**:
A Listing with no stock left. It stays visible in the shop but cannot be bought.
_Avoid_: Out of stock (for Originals), unavailable, archived

**Ended**:
A Listing the Artist has stopped selling. It leaves the shop and can be reopened. Different from Sold.
_Avoid_: Paused, archived, deleted

**Report**:
A Buyer's flag that a Listing may be fake, stolen or inappropriate, sent to the Admin.
_Avoid_: Flag, complaint

**Takedown**:
The Admin removing a published Listing or Artwork from the shop.
_Avoid_: Ban, delete, moderation

## Buying

**Cart**:
The Listings a Buyer intends to buy, all from one Artist. Prices shown in the Cart are a preview; the live price at checkout is what the Buyer pays.
_Avoid_: Basket, bag

**Order**:
One checkout and one payment by a Buyer to CraftMe, for Listings from a single Artist, sent as one parcel.
_Avoid_: Purchase, transaction, sale (from the Buyer's side), shipment

**Order Line**:
One Listing and its quantity within an Order, priced at the moment of payment. Refunds work per Order Line.
_Avoid_: Item, line item, product

**Checkout Hold**:
The 15 minutes after a Buyer presses Pay, during which the Order's Listings are reserved for them. If payment doesn't finish, the hold ends and the stock returns to the shop.
_Avoid_: Reservation, lock, pending

**Paid**:
The Order stage after the Buyer's payment to CraftMe succeeds and before the Artist ships.

**Shipped**:
The Order stage after the Artist marks the parcel as posted, optionally with a tracking number.

**Received**:
The Order stage after the Buyer confirms the parcel arrived, or 14 days after Shipped if the Buyer doesn't confirm.
_Avoid_: Delivered, completed

**Overdue**:
A Paid Order the Artist has not Shipped within 7 days. The Admin refunds it.
_Avoid_: Late, expired

## Fulfilment

**Shipping** (by the Artist):
The Artist posts the parcel directly to the Buyer. The operator never handles parcels.
_Avoid_: Dispatch, delivery (delivery is the Buyer receiving it)

**Region**:
India only. Listing prices are in rupees and include Shipping within India.
_Avoid_: Market, zone

**Damage Report**:
A Buyer's photo-backed claim, made within 3 days of Received, that the parcel arrived damaged. It holds the Order's Payout until the Admin decides.
_Avoid_: Dispute, return, complaint

**Refund**:
Money CraftMe returns to a Buyer for one or more Order Lines, decided by the Admin. Buyers cannot cancel on their own.
_Avoid_: Cancellation, chargeback, return

## Artist money

**Onboarding Fee**:
A one-time, non-refundable fee an Artist pays CraftMe to join.
_Avoid_: Joining fee, registration fee, deposit

**Artist Verification**:
The details an Artist gives at onboarding so CraftMe can pay them and answer for them: legal name, PAN, payout UPI ID or bank account, and a verified phone number. Seen only by that Artist and the Admin, and checked by the Admin before the first Payout.
_Avoid_: KYC (in product language), registration

**Commission**:
The percentage CraftMe keeps of what the Buyer finally paid for an Order: the price minus any Refunds. The rate is a setting chosen before launch.
_Avoid_: Platform fee, cut, margin, gateway fee

**Payable**:
An Order that is Received, has passed its 3-day Damage Report window without an open Damage Report, and has not yet been paid out.
_Avoid_: Due, eligible, matured

**Payout**:
The money CraftMe sends an Artist for their Payable Orders: the price paid, minus Refunds, minus Commission (charged on the price after Refunds), minus the payment gateway's whole fee, minus any Amount Owed. The Admin sends Payouts by UPI or bank transfer on the 1st and 15th of each month and records each transfer's reference.
_Avoid_: Earnings, settlement, transfer

**Amount Owed**:
Money an Artist owes CraftMe because a Refund was made after their Payout for that Order. It is deducted from their next Payouts.
_Avoid_: Debt, negative balance, clawback

**Restricted**:
The state of an Artist whose Listings are hidden from the shop: automatically when an Amount Owed is unsettled 60 days after it arose, or by the Admin with a written reason (for example repeated Overdue Orders or upheld Reports). They must still ship Paid Orders.
_Avoid_: Suspended, banned, blocked, locked
