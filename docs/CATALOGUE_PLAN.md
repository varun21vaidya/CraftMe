# CraftMe catalogue plan

## Decisions (settled)

- Sell finished handmade items **and** DIY kits.
- Five groups with sub-categories. Sub-categories use the **new-style names** below; old names are renamed.
- New listing kind `product` (label "Ready-made") for stocked items that are not prints.
- 21 new demo items, spread over the 5 existing demo artists. Titles have **no "(demo)" tag**. The database flag `demo = true` stays, so one query can remove them all.
- Photos: the owner makes them with another app and puts all of them in **one folder**, then confirms. Only then are they committed and the new catalogue switched on. The 15 old demo items, their photos and the credits files are deleted in the same step.
- The crochet cushion photo came from Google, so it is **not used**. A new picture is generated for item 6.
- Left out for now: technique filter, price bands, garment sizes, small-batch label, fabric by the metre, a Textiles and Apparel group, a demo-item banner or checkout block.

## 1. What the reference sites show

| Site | What it sells | Idea kept |
|---|---|---|
| dazzlecraftsupplies.in | DIY kits, bead and charm kits, rangoli, Rs 150 to 555, many in stock | Kits as multi-stock listings with a "what is in the kit" description |
| fizdi.com | Paintings by size and medium, handmade or printed | One listing per size; size and medium on every card |
| itokri.com, okhai.org | Textiles, kurtas, cushion covers, home decor | Craft names in titles; cushion and runner as home items |
| artzolo.com, mojarto.com | Original art, prints, folk art | Size in inches; a clear Art group |

CraftMe already has the model: `original` (stock 1) and `print` (many), each with a size and medium. What is missing is the category list and one more kind.

## 2. Categories (22 in 5 groups)

The group is not stored. The sub-category is stored, and the group comes from a map in `src/lib/categories.js`.

| Group | Sub-categories (old name in brackets) |
|---|---|
| Art | Paintings (Painting), Drawings (Drawing), Digital Art (Digital), Photography, Art Prints (Print) |
| Handmade Crafts | Crochet & Knitting, Textiles & Embroidery (Textile), Wood Crafts (Woodwork), Metal Crafts (Metalwork), Pottery & Ceramics, Sculptures (Sculpture) |
| Jewellery & Accessories | Handmade Jewellery, Bag & Phone Charms, Keychains |
| Festive & Home Decor | Ready Rangoli, Wall Hangings, Diyas & Candles, Gifts & Hampers (Gifts) |
| DIY Kits | Bead & Charm Kits, Jewellery Making Kits, Crochet & Embroidery Kits |

## 3. Code changes

1. **Migration `0006_catalogue.sql`**, in one transaction: drop `artworks_category_check`; rewrite existing rows to the new names; add the new check with the 22 names; replace `listings_kind_check` to allow `product`. The stock-of-1 rule stays for `original` only.
2. **`src/lib/categories.js`**: export `GROUPS` (group to sub-categories) and `CATEGORIES` (the flat list, derived from it).
3. **Browse**: a row of group chips; picking one shows that group's sub-category chips. Picking only a group filters with `in(category, [...])`. The change is in `Browse.jsx` and `useArtworks` in `gateway.js`.
4. **Labels**: `kindLabel` in `ArtworkPage.jsx` gets `product: 'Ready-made'`.
5. **`supabase/schema.test.mjs`**: a `product` listing accepts stock above 1; an `original` above 1 is still refused; an old category name is refused.

## 3a. Photo rules (for the other app)

- JPG, 1200 x 1200 px (square), under 300 KB.
- Plain warm off-white or light wood background, soft daylight, one item or one set centred, no text, no watermark, no hands.
- Name each file exactly as in the table. Put all 21 in one folder.
- Kits: show the contents laid out and the finished piece in the same picture.

## 4. The 21 items

Prices in rupees. Stock 1 is a one-off. Artists are assigned when the seed is written.

| # | File | Title | Group / category | Kind | Size and medium | Price | Stock | Picture to make |
|---|---|---|---|---|---|---|---|---|
| 1 | rajasthani-women.jpg | Rajasthani Women at the Well | Art / Paintings | original | 36 x 24 in, acrylic on canvas | 9,200 | 1 | Realistic painting of three women in bright Rajasthani dress carrying pots |
| 2 | radha-krishna-flute.jpg | Radha Krishna with Flute | Art / Paintings | original | 24 x 32 in, acrylic on canvas | 15,500 | 1 | Pichwai-style Krishna playing the flute, gold and deep blue |
| 3 | madhubani-fish.jpg | Madhubani Fish Pair | Art / Drawings | original | A3, ink on handmade paper | 3,400 | 1 | Two stylised fish with dense line patterns, red and black |
| 4 | banyan-golden-hour.jpg | Banyan at Golden Hour | Art / Photography | print | 12 x 18 in, fine-art paper | 1,200 | 30 | Old banyan tree in low gold light |
| 5 | peacock-mandala.jpg | Peacock Mandala | Art / Digital Art | print | 18 x 18 in, giclee on canvas | 1,900 | 20 | Circular peacock-feather mandala in teal and gold |
| 6 | crochet-cushion.jpg | Granny-Square Crochet Cushion Cover | Handmade Crafts / Crochet & Knitting | product | 16 x 16 in, cotton yarn | 1,450 | 8 | Cream cushion cover with multicolour crochet flower squares (new picture, not the Google one) |
| 7 | crochet-coasters.jpg | Crochet Flower Coasters, Set of 4 | Handmade Crafts / Crochet & Knitting | product | 4 in each, cotton | 450 | 25 | Four round flower coasters stacked and fanned out |
| 8 | dokra-elephant.jpg | Dokra Brass Elephant | Handmade Crafts / Metal Crafts | product | 6 in tall, cast brass | 2,800 | 5 | Textured dokra elephant on a wooden shelf |
| 9 | blue-pottery-planter.jpg | Blue Pottery Planter | Handmade Crafts / Pottery & Ceramics | product | 5 in, glazed clay | 950 | 12 | White and cobalt-blue glazed pot with a small succulent |
| 10 | kantha-runner.jpg | Kantha Table Runner | Handmade Crafts / Textiles & Embroidery | product | 14 x 60 in, cotton | 1,800 | 6 | Running-stitch kantha runner in indigo and cream |
| 11 | oxidised-jhumkas.jpg | Oxidised Silver Jhumkas | Jewellery & Accessories / Handmade Jewellery | product | Pair, 4 cm | 650 | 15 | Dome jhumkas with small bells on a neutral cloth |
| 12 | pearl-necklace.jpg | Hand-strung Pearl Necklace | Jewellery & Accessories / Handmade Jewellery | product | 18 in, freshwater pearls | 899 | 10 | Single-strand pearl necklace curled on linen |
| 13 | tulip-bag-charm.jpg | Tulip Bouquet Bag Charm | Jewellery & Accessories / Bag & Phone Charms | product | 14 cm, glass beads | 420 | 20 | Finished charm with beaded tulips and a white bow |
| 14 | daisy-keychain.jpg | Beaded Daisy Keychain | Jewellery & Accessories / Keychains | product | 9 cm, glass beads | 199 | 40 | Small daisy keychain with a lobster clasp |
| 15 | rangoli-floral.jpg | Reusable Floral Rangoli | Festive & Home Decor / Ready Rangoli | product | 18 in round, acrylic | 349 | 30 | Round multicolour floral rangoli on a doorstep |
| 16 | rangoli-peacock.jpg | Peacock Ready Rangoli | Festive & Home Decor / Ready Rangoli | product | 24 in, acrylic | 599 | 20 | Peacock-design ready rangoli on a tiled floor |
| 17 | macrame-dreamcatcher.jpg | Macrame Dreamcatcher | Festive & Home Decor / Wall Hangings | product | 12 in ring, cotton cord | 799 | 12 | Cream macrame dreamcatcher with feathers on a wall |
| 18 | terracotta-diyas.jpg | Hand-painted Terracotta Diyas, Set of 6 | Festive & Home Decor / Diyas & Candles | product | 3 in each, clay | 299 | 40 | Six painted diyas lit on a brass plate |
| 19 | kit-tulip-charm.jpg | DIY Tulip Phone Charm Kit | DIY Kits / Bead & Charm Kits | product | Makes 1 charm | 299 | 30 | Tulip beads, leaves, cord and bow laid out beside the finished charm |
| 20 | kit-seed-bead-bracelet.jpg | DIY Seed Bead Bracelet Kit, 5 Colours | DIY Kits / Jewellery Making Kits | product | 5 colours, 50 g each | 450 | 25 | Small jars of seed beads, thread, needle and a finished bracelet |
| 21 | kit-crochet-flower.jpg | Beginner Crochet Flower Kit | DIY Kits / Crochet & Embroidery Kits | product | 3 flowers, cotton yarn | 550 | 15 | Yarn, hook, pattern card and three finished flowers |

No wording is copied from the reference sites.

## 5. Order of work

1. **Now (no live change):** write migration `0006`, `categories.js`, the Browse group chips, the `product` label and the tests. Run `npm run test:schema` and the app tests. Write `supabase/seed_catalogue.sql` with the 21 items. Apply nothing.
2. **You:** make the 21 photos and put them in one folder. Tell me the folder path and say "ready".
3. **Go-live (after your confirmation):** copy the photos to `public/demo/`, commit, apply the migration and seed, delete the 15 old items, their photos and `credits.*`, in one transaction. Check Browse on the preview.
4. **After payment testing:** delete the 10 test postcards.

## 6. Risks

- **No demo marker in titles or on the site.** While Razorpay is in test mode this is harmless. Before live keys are set, delete the demo items with `delete from public.artworks where demo;` or buyers could pay for things that do not exist.
- **Renaming categories** in one migration touches existing rows. The seed and the old rows must use the new names, or the new check rejects them.
- **Generated photos** of products nobody makes: fine for a demo, not for launch.
