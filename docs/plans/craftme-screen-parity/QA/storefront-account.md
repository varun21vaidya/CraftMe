# QA scripts: shell, storefront, account, legal, kept extras

Format, fixtures and defaults are in [README.md](README.md).

## Shell

### QA-SH-01 Public header for each kind of visitor
Covers: SH.01, X.07 · Type: e2e (`e2e/shell.spec.js`) · Role: G, B1, A1, AD1 · Route: `/browse` · View: all
Do: 1. Open as G. 2. Repeat as B1, A1, AD1.
See: G: logo, Browse, Categories, search, "Log in". B1: also Cart with count, Wish list with count, bell, account menu. A1: no artist links in the header itself. Under 900 px the links move into the burger menu and search becomes a toggle. No sideways scroll at 375 px.
Data: none.

### QA-SH-02 Account menu entries and keyboard use
Covers: SH.02 · Type: e2e (`e2e/shell.spec.js`) · Role: B1, A1, AD1 · Route: `/`
Do: 1. Tab to the account button, press Enter. 2. Press Down twice, then Escape. 3. Open again and choose "Log out".
See: B1: My orders, Wish list, Profile, Notifications, Become an Artist, theme toggle, Log out. A1: "Artist dashboard" in place of Become an Artist. AD1: also "Admin". Arrow keys move between items; Escape closes and focus returns to the button. After Log out the header shows "Log in".
Data: session ended.

### QA-SH-03 Burger menu and mobile search
Covers: SH.03, KD10 · Type: e2e (`e2e/shell.spec.js`) · Role: A1 · Route: `/browse` · View: 375 × 812, both themes
Do: 1. Tap the burger. 2. Press Escape. 3. Open it, tap "Artist dashboard". 4. Tap Search, type `kolam`, press Enter.
See: Menu opens with `aria-expanded="true"`, closes on Escape with focus back on the burger, closes after navigation. Search opens a field, Enter goes to `/browse?q=kolam`, focus returns to the Search button.
Data: none.

### QA-SH-04 Footer links
Covers: SH.05, S01.i.08 · Type: e2e (`e2e/shell.spec.js`) · Role: G · Route: `/`
Do: Click every footer link in turn.
See: Shop links open `/browse?group=…` with that group selected. Help links open `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/shipping`, `/legal/contact`, `/legal/deletion`. "Artist agreement" opens `/legal/artist`. "Sell your art" is present only while `acceptArtists` is on. No link returns the 404 page.
Data: none.

### QA-SH-05 Artist and Admin shells
Covers: SH.06, SH.07 · Type: e2e (`e2e/artist-works.spec.js`, `e2e/admin-access.spec.js`) · Role: A1, AD1 · Route: `/dashboard`, `/admin` · View: all
Do: 1. As A1 open `/dashboard` and click each sidebar link. 2. As AD1 open `/admin` and click each sidebar link. 3. Repeat at 375 px.
See: Artist sidebar: Overview, Artworks, Orders with the badge "2" (the To ship count: O2 and O3), Payouts, Instagram, Settings; the current link has `aria-current="page"`; "View my shop" opens `/artist/<A1>`. Admin sidebar: Overview, Queues with a total badge, Orders, Payout run, Artists, Settings. At 375 px each sidebar is one scrolling row.
Data: none.

### QA-SH-06 Guards: hidden link and direct URL agree
Covers: SH.08 · Type: e2e (`e2e/admin-access.spec.js`) · Role: G, B1, A1
Do: 1. As G open `/orders`, `/dashboard`, `/admin`. 2. As B1 open `/dashboard/artworks` and `/admin/queues`. 3. As A1 open `/admin`.
See: G lands on `/login` each time. B1 and A1 land on `/` with the toast "You don't have access to that page." No dashboard or admin content flashes first.
Data: In step 2 the browser makes no successful request for artist or admin data; a direct call to `admin_queue_counts` as B1 returns `forbidden`.

### QA-SH-07 Old paths redirect
Covers: SH.11 · Type: e2e (`e2e/shell.spec.js`) · Role: A1
Do: Open `/dashboard/works`, `/dashboard/new`, `/dashboard/profile`, `/privacy?x=1`, `/instagram-deletion?code=abc`.
See: They end at `/dashboard/artworks`, `/dashboard/artworks/new`, `/dashboard/settings`, `/legal/privacy?x=1`, and the deletion status page (unchanged URL). Back does not loop.
Data: none.

### QA-SH-08 A crashed screen and a stale deploy
Covers: SH.15, KD10 · Type: e2e (`e2e/shell.spec.js`) · Role: B1 · Route: `/orders`
Setup: The test makes the orders chunk request fail with a "Failed to fetch dynamically imported module" error.
Do: 1. Open `/orders`. 2. After the automatic reload, make the page component throw a plain error instead. 3. Press "Try again".
See: Step 1: one automatic reload, not a loop. Step 2: "Something went wrong on this page" with the short error text; the header still works. Step 3: the page renders.
Data: `sessionStorage['craftme-reload']` holds a time.

## S01 Home

### QA-S01-01 Landing page renders and its buttons work
Covers: S01, S01.st.default, S01.i.01, i.03, i.04 · Type: e2e (`e2e/home.spec.js`) · Role: G · Route: `/` · View: all
Do: 1. Open `/`. 2. Click "Browse art" in the hero. 3. Go back, click "Browse Originals".
See: One `h1` "Original art from Indian artists"; sections in order: categories, Original or print, three steps, questions, closing band. Step 2 opens `/browse`. Step 3 opens `/browse?kind=original` with the Originals chip active. With reduced motion on, nothing moves on scroll.
Data: none.

### QA-S01-02 Category rows and section anchors
Covers: S01.i.02, S01.i.07 · Type: e2e (`e2e/home.spec.js`) · Role: G · Route: `/`
Do: 1. Click "Browse" on the "Handmade Crafts" row. 2. Go back, open `/#how`, then `/#questions`.
See: Step 1: `/browse?group=Handmade Crafts`, that group's checkboxes ticked. Step 2: each heading is fully visible below the sticky header, not hidden under it.
Data: none.

### QA-S01-03 Seller entry follows the switch; missing images; FAQ wording
Covers: S01.i.05, i.06, i.09 · Type: e2e (`e2e/home.spec.js`) · Role: G · Route: `/`
Setup: Run twice: `acceptArtists` true, then false. In the second run also block all image requests.
See: True: "Sell your art" and "Start selling" open `/become-artist`. False: both absent, no gap in the layout. With images blocked the page keeps its layout and every link works. The FAQ says: posted within 7 days; a Paid Order can't be cancelled by the Buyer; one artist per Cart; India only; only Received Orders can review and CraftMe approves every Review.
Data: none.

## S02 Browse

### QA-S02-01 Combine filters
Covers: S02, S02.st.default, S02.i.02, i.03, i.04, i.06, i.11, KD05 · Type: e2e (`e2e/browse.spec.js`) and schema · Role: G · Route: `/browse`
Do: 1. Tick the group "Art". 2. Tick Type "Prints". 3. Type `riso` in "Title, Artist or medium". 4. Choose Artist "Tanvi Rao".
See: After each step the count line and the grid change together; step 3 finds W8 by title; a search for `acrylic` finds works by medium; a search for `meera` finds A1's works. Chips: Art, Prints, "riso", Tanvi Rao.
Data: The schema test asserts `browse_catalogue` with the same keys returns W8 only, and never a draft (W4), an ended work (W5) or a restricted Artist's work (W7).

### QA-S02-02 Sorting and numbered pages with ties
Covers: S02.i.01, S02.i.09 · Type: schema and e2e (`e2e/browse.spec.js`) · Role: G · Route: `/browse`
Do: 1. Sort "Price: low to high" and walk pages 1 to the last. 2. Sort "Newest first" and walk again. 3. Sort "Highest rated Artist".
See: Each page shows 24 works except the last. Page numbers match `ceil(total / 24)`.
Data: Collecting the ids of all pages gives every visible work exactly once in each sort, although six works share a timestamp and four share a price. Rated sort puts A1's works first.

### QA-S02-03 Price range, hide sold, chips, URL restore
Covers: S02.i.05, i.07, i.08, i.10 · Type: e2e (`e2e/browse.spec.js`) · Role: G · Route: `/browse`
Do: 1. Enter Min `10000`, Max `2000`. 2. Tick "Hide Sold Originals". 3. Reload. 4. Remove the price chip. 5. Press Back. 6. Press "Clear all".
See: Step 1: results are ₹2,000 to ₹10,000 and the fields show the swapped values. Step 2: W3 disappears, W2 stays (its Print is live). Step 3: same filters, same results. Step 4: price filter gone, page 1. Step 5: the price filter is back. Step 6: no chips, the filter count reads 0, URL is `/browse`.
Data: none.

### QA-S02-04 No results
Covers: S02.st.empty · Type: e2e (`e2e/browse.spec.js`) · Role: G · Route: `/browse?q=zzzzzz`
Do: 1. Read the page. 2. Press "Clear all filters".
See: "Nothing matches those filters" with both recovery buttons; the count line reads "No Artworks match your filters." After step 2 the full grid.
Data: none.

### QA-S02-05 Loading and failure are not "empty"
Covers: S02.st.loading, S02.i.12 · Type: e2e (`e2e/browse.spec.js`) · Role: G · Route: `/browse`
Setup: Delay the catalogue request 2 seconds; in a second run make it fail; in a third, delay the first request 3 seconds and the second 0.
Do: Third run: type `a`, then quickly `kolam`.
See: Delay: twelve skeleton tiles, `aria-busy="true"`, "Searching…". Failure: alert "We couldn't load the catalogue." with "Try again", which works once the block is lifted; the empty text never appears. Third run: the final grid is for `kolam` even though the `a` answer arrived last.
Data: none.

### QA-S02-06 Narrow layout and header search results
Covers: S02.i.13, X.05, KD02 · Type: e2e (`e2e/browse.spec.js`) · Role: G · View: 375 × 812 and 1280 × 800
Do: 1. Open `/browse` at 375 px. 2. Open the Filters summary. 3. At 1280 px search `meera` from the header, then press the "Artists" chip.
See: Step 1: filters closed, summary "Filters". Step 2: the panel opens above the results. Step 3: "Results for “meera”", Artworks view, then the Artists view listing Meera Iyer linking to her profile.
Data: none.

## S03 Artwork

### QA-S03-01 Available artwork, full page
Covers: S03, S03.st.default, S03.i.01, i.03, i.07, i.08 · Type: e2e (`e2e/artwork.spec.js`) · Role: G · Route: `/artwork/<W1>` · View: all
See: Breadcrumbs Home, Browse, Paintings, title. Two listing cards: "Original · Only 1 available · ₹42,000" and "Print · 50 in stock · ₹2,500". Three trust lines naming 7 days, the hold and 3 days. Wall label rows that have values, and the item code with a copy button (toast "Copied …"). At 375 px the purchase panel follows the gallery.
Data: `artworks.views` for W1 rises by one on the first visit of a session and not on a reload.

### QA-S03-02 Sold original, and everything sold
Covers: S03.st.sold, S03.i.14 · Type: e2e (`e2e/artwork.spec.js`) · Role: B1 · Route: `/artwork/<W2>`, `/artwork/<W3>`
See: W2: the Original card is disabled and reads "Sold"; the Print is selected; the note "This Original has found a home. Prints of this Artwork are still available."; Add to Cart works. W3: a "Sold" tag on the photo and one disabled "Sold" button; no quantity control.
Data: none.

### QA-S03-03 The Artist views their own work
Covers: S03.st.own, S03.i.12 · Type: e2e (`e2e/artwork.spec.js`) and schema · Role: A1 · Route: `/artwork/<W1>`
See: The notice "This is your Artwork…" with "Edit in dashboard" to `/dashboard/artworks/<W1>`. No Add to Cart, Buy now, heart or Report.
Data: The schema test calls `place_order` with buyer and artist both A1 and expects `own_listing`; a direct insert of such an order violates the check constraint.

### QA-S03-04 Quantity and Add to Cart
Covers: S03.i.04, S03.i.05 · Type: e2e (`e2e/artwork.spec.js`) · Role: B1 · Route: `/artwork/<W2>`
Setup: B1's Cart is empty.
Do: 1. Select the Print. 2. Press plus until it stops. 3. Set the quantity to 2 and press "Add to Cart". 4. Select W1's Original on `/artwork/<W1>`.
See: Step 2 stops at 10 with the hint "That's all there is." (a listing with stock 5 stops at 5). Step 3: toast "Added to your Cart", the page stays, the button reads "In your Cart" with "View Cart", the header count is 2, the total line showed ₹4,400. Step 4: no quantity control, "Originals are always 1".
Data: `localStorage['cm-cart:<B1>']` has the listing with `qty: 2` and `seen: 220000`.

### QA-S03-05 Cart switch dialog saves the outgoing Cart
Covers: S03.st.cart-clash, S03.dlg.newcart, KD03 · Type: e2e (`e2e/cart.spec.js`) · Role: B1 · Route: `/artwork/<W6>`
Setup: B1's Cart holds W2 Print ×2 (Artist A1).
Do: 1. Press "Add to Cart". 2. Press Escape. 3. Press "Add to Cart" again, then "Keep my Cart". 4. Again, then "Switch Cart".
See: Step 1: dialog "Start a new Cart?" naming Meera Iyer and saying the Cart moves to Saved for later. Steps 2 and 3: dialog closes, Cart unchanged, focus back on the button. Step 4: button reads "Switching…", then the Cart holds W6 only.
Data: After step 4 `saved_cart_items` has W2 Print with `qty 2` for B1; one row in `saved_cart_operations`; nothing was written in steps 2 and 3.

### QA-S03-06 Buy now
Covers: S03.i.06, D07 · Type: e2e (`e2e/cart.spec.js`) · Role: B1 · Route: `/artwork/<W6>`
Setup: Run A with an empty Cart; run B with W2 Print in the Cart.
Do: Press "Buy now"; in run B confirm "Switch Cart"; in a run C press "Keep my Cart".
See: A: `/checkout` with W6. B: the dialog first, then `/checkout` with W6 only. C: stays on the artwork page, Cart unchanged.
Data: As QA-S03-05 for run B. Pressing "Buy now" twice quickly creates one cart line of quantity 1.

### QA-S03-07 Report an Artwork
Covers: S03.dlg.report, S03.i.15 · Type: e2e (`e2e/artwork.spec.js`) and schema · Role: G, B1 · Route: `/artwork/<W6>`
Do: 1. As G press "Report this Artwork". 2. As B1 open the dialog, press "Send report" with nothing chosen. 3. Choose "It looks copied or stolen from another Artist", type 501 characters, then cut to 500, send. 4. Open the dialog and send the same reason again.
See: Step 1: sent to `/login`, and back to the artwork after signing in. Step 2: "Choose what's wrong." Step 3: the counter stops at 500; toast "Report sent. Thank you."; the dialog closes. Step 4: "You've already reported this. We're looking at it."
Data: One `reports` row: `target_type 'artwork'`, `reason 'copied'`, `details` of 500 characters, `reporter_id` B1, status `open`. The schema test also refuses an unknown reason, a missing target and a report on one's own work.

### QA-S03-08 Reel in the gallery with its fallback
Covers: S03.i.02, KD06 · Type: e2e (`e2e/artwork.spec.js`) · Role: G · Route: `/artwork/<W1>` · View: 375 × 812 and 1280 × 800
Setup: Block requests to `instagram.com`.
Do: 1. Move to the reel slide with the gallery arrows and with the keyboard. 2. Press Play.
See: Before Play no request goes to Instagram. After Play, with Instagram blocked, the "Open on Instagram" link is offered. The slide scales to fit at both widths.
Data: none.

### QA-S03-09 Reviews preview and related works
Covers: S03.i.09, S03.i.10 · Type: e2e (`e2e/artwork.spec.js`) · Role: G · Route: `/artwork/<W1>`, `/artwork/<W6>`
See: W1: "What Buyers say about Meera" with the three approved reviews, newest first, and "All 3 Reviews" opening `/artist/<A1>?tab=reviews`; "More from Meera Iyer" excludes W1 and hidden works; "More Paintings" excludes W1. W6 (Artist with no approved review): no reviews section at all.
Data: The requests return no `buyer_id`.

## S04 Artist profile

### QA-S04-01 Header, copy link, About
Covers: S04, S04.tab.t-about, S04.i.01, i.02 · Type: e2e (`e2e/artist.spec.js`) · Role: G · Route: `/artist/<A1>` · View: all
Do: 1. Read the header. 2. Press "Copy profile link". 3. Open the About tab.
See: Name, "Verified Artist", "Chennai, Tamil Nadu · On CraftMe since {month year}", rating linking to Reviews, bio. Toast "Copied …/artist/meera-iyer". Opening `/artist/meera-iyer?tab=reviews` lands on `/artist/<A1 id>?tab=reviews` (the address bar shows the id; Back does not bounce). `/artist/no-such-name` shows "We couldn't find this Artist". About: Based in, Joined, Verified sentence, "Within 7 days, India only". For A2 the badge is absent and About says "Checks in progress".
Data: Clipboard holds the slug URL. `profiles.slug` is `meera-iyer` for A1; a second Artist named "Meera Iyer" has `meera-iyer-2`; after A1 changes their display name the slug is unchanged; a Buyer (never an Artist) has no slug. No link rendered anywhere in the app points at a slug URL except the copied short link.

### QA-S04-02 Artworks tab filters
Covers: S04.tab.t-art · Type: e2e (`e2e/artist.spec.js`) · Role: G · Route: `/artist/<A1>`
Do: Press All, Originals, Prints, Ready-made, Sold in turn; reload on "Sold".
See: Originals lists W1; Prints lists W1 and W2; Sold lists W3; "Showing {n} Artworks" matches. The chosen filter and tab survive the reload. W4, W5 never appear.
Data: none.

### QA-S04-03 Public reviews
Covers: S04.tab.t-rev, S04.i.06 · Type: e2e (`e2e/artist.spec.js`) and schema · Role: G · Route: `/artist/<A1>?tab=reviews`
Do: 1. Read the tab. 2. As AD1 reject one pending review and approve another (admin queue), then reload as G.
See: Average, count, five histogram bars that add up to the count, each review with first name, "Received Order", date, stars, text. After step 2 only the approved one is added and the average moves accordingly. An Artist with none shows "No Reviews yet."
Data: `profiles.rating_count` rose by one, not two.

### QA-S04-04 Instagram Showcase tab, with and without content
Covers: S04.st.default, S04.st.no-instagram, S04.tab.t-ig, S27.i.10 · Type: e2e (`e2e/instagram.spec.js`) · Role: G · Route: `/artist/<A1>?tab=showcase`, `/artist/<A2>?tab=showcase`
Setup: A1 has 2 highlighted rows (one reel, one post) and 1 non-highlighted row linked to W1.
See: A1: two tiles in the saved order, tags "Reel" and "Post", "View ↗" links; the artwork-only row is absent; no Instagram request before a tap. A2: "No Instagram posts yet…".
Data: none.

### QA-S04-05 Stats
Covers: S04.i.03 · Type: schema and e2e (`e2e/artist.spec.js`) · Role: G · Route: `/artist/<A1>`
See: Artworks equals A1's public works; Orders shipped equals A1's orders that have `shipped_at`; Average time to ship is the mean of shipped minus paid, shown in days.
Data: `artist_public_stats(A3)` (restricted) returns null and the page shows no stats.

### QA-S04-06 Report an Artist
Covers: S04.dlg.rep · Type: e2e (`e2e/artist.spec.js`) · Role: B1, A1 · Route: `/artist/<A1>`
Do: 1. As B1 press "Report", choose "Impersonation or stolen work", type details, send. 2. As A1 open the same page.
See: Toast "Report sent. Thank you." A1 sees no Report button on their own profile.
Data: One `reports` row with `target_type 'artist'`, `reason 'impersonation'`.

### QA-S04-07 Unknown, restricted, empty and owner views
Covers: S04.i.04, i.05, i.07 · Type: e2e (`e2e/artist.spec.js`) · Role: G, A3
Do: Open `/artist/not-a-uuid`, `/artist/<B1>` (not an Artist), `/artist/<A3>` as G, then as A3; open an Artist with no photo, bio or works.
See: First two: "We couldn't find this Artist". A3 as G: name and "This Artist isn't taking orders right now.", no works, no bio. As A3: the owner bar "Buyers can't see your works right now." The bare Artist shows initials and "No work on sale right now." A blocked network shows "We couldn't load this page" with "Try again".
Data: none.

## S05 Log in

### QA-S05-01 Login page
Covers: S05, S05.st.default, SH.12, S05.i.05 · Type: e2e (`e2e/login.spec.js`) · Role: G · Route: `/login` · View: all
See: One card with "Continue with Google" and the terms sentence with working links; no email or password field; a featured-artwork panel over 900 px only; the normal site header.
Data: none.

### QA-S05-02 Return to the intended page
Covers: S05.i.02, S03.i.11 · Type: e2e (`e2e/login.spec.js`, with the local sign-in standing in for Google) and sandbox (real Google) · Role: G
Do: 1. Open `/orders/<O2>`. 2. Sign in as B1. 3. Sign out, open `/artwork/<W1>`, press the heart, sign in. 4. Craft `sessionStorage['cm-return'] = '//evil.example'` and sign in.
See: Step 2 lands on `/orders/<O2>`. Step 3 lands on `/artwork/<W1>`. Step 4 lands on `/`.
Data: `cm-return` is removed after use.

### QA-S05-03 Google cancelled or unreachable
Covers: S05.i.01 · Type: e2e (simulated return URL) and sandbox · Role: G · Route: `/login`
Do: 1. Open `/login#error=access_denied&error_description=cancelled`. 2. Block the auth endpoint and press the button. Sandbox: press Cancel on Google's consent screen.
See: Step 1: "Google sign-in was cancelled. Try again when you're ready." and the hash is gone. Step 2: "We couldn't reach Google. Try again."; the button is usable again.
Data: No session.

### QA-S05-04 First sign-in: profile and policy acceptance
Covers: S05.i.03, S05.i.06, PD21 · Type: e2e (`e2e/login.spec.js`) and schema · Role: B2 · Route: `/cart`
Do: 1. Sign in as B2 and open `/cart`. 2. Press Escape and click outside. 3. Press "Continue" without ticking. 4. Tick and press "Continue". 5. Sign out and in again.
See: Step 1: the dialog "Before you continue". Step 2: it stays. Step 3: the button is disabled. Step 4: the Cart page. Step 5: no dialog.
Data: `profiles.terms_accepted_at` set and `terms_version` equal to `TERMS_VERSION` for B2 only. The schema test shows a second insert of the same auth user makes no second profile.

## S16 Profile

### QA-S16-01 Profile page and saving
Covers: S16, S16.st.default, S16.i.02, i.04, i.05, i.06 · Type: e2e (`e2e/profile.spec.js`) · Role: B1 · Route: `/profile` · View: all
Do: 1. Read the page. 2. Clear Name and save. 3. Enter "Ananya V", a 201-character bio, save. 4. Cut the bio to 200, save.
See: Email is read-only with the Google sentence; "You sign in with Google…" and no password field; roles show Buyer and "Become an Artist"; shortcuts work. Step 2: "Add your name." Step 3: the counter blocks at 200. Step 4: toast "Profile saved".
Data: `profiles.display_name` and `bio` updated for B1 only.

### QA-S16-02 Photo upload, bad file, partial failure
Covers: S16.i.01, S16.i.09 · Type: e2e (`e2e/profile.spec.js`) · Role: B1 · Route: `/profile`
Do: 1. Choose a 6 MB JPEG. 2. Choose a PDF. 3. Choose a 200 KB PNG and save. 4. Choose another PNG and save while the profile update is made to fail. 5. Press "Remove".
See: Steps 1 and 2: "Use a JPEG or PNG up to 5 MB.", photo unchanged. Step 3: new photo and toast. Step 4: error shown, old photo still displayed. Step 5: initials shown.
Data: After step 4 the `avatars` bucket has no file from that attempt. After step 5 `photo_url` is empty.

### QA-S16-03 Saved address
Covers: S16.dlg.addr, S16.i.03, A4 · Type: e2e (`e2e/profile.spec.js`) · Role: B1 · Route: `/profile`
Do: 1. Press "Edit". 2. Set PIN `40005`, save. 3. Set PIN `400051`, save. 4. Open `/checkout` with something in the Cart. 5. Open `/orders/<O2>`.
See: Step 2: "PIN codes have 6 digits."; dialog stays; focus on the PIN field. Step 3: toast "Address saved". Step 4: the form is prefilled with PIN 400051. Step 5: O2 still shows 400050.
Data: `saved_addresses` row for B1 updated; `order_shipping` for O2 unchanged.

### QA-S16-04 The saved address is private
Covers: S16.i.07 · Type: schema · Role: B2, A1, G
Do: As B2, A1 and anon, select from `saved_addresses`; as B2 try to insert a row with B1's id.
See: —
Data: Zero rows for each; the insert is refused.

### QA-S16-05 Delete account dialog
Covers: S16.dlg.del · Type: e2e (`e2e/profile.spec.js`) · Role: B2 · Route: `/profile`
Setup: B2 has no open orders: set O3 and O10 to belong to another buyer for this run.
Do: 1. Press "Delete my Account". 2. Type `delete`. 3. Press Escape, reopen, type `DELETE`, confirm.
See: Step 2: the confirm button stays disabled. Step 3: signed out, on `/`, toast "Deletion requested".
Data: `deletion_requests` row for B2: scope `everything`, status `pending`, no blockers.

### QA-S16-06 Deletion waits, then anonymises
Covers: S16.i.08, D11, PD24 · Type: schema and e2e (`e2e/profile.spec.js`) · Role: B1
Do: 1. As B1 (open orders O2, O4) request deletion. 2. Sign in again. 3. Press "Keep my Account". 4. Request again; move O1 to expired, O2, O4, O14 to `received` with closed windows, and O5 past its damage window; run `cron('deletions')`.
See: Step 2: banner "Your Account is set to be deleted. We can't finish yet: you have open Orders." Step 3: banner gone. After step 4 B1 can no longer sign in.
Data: Step 1: status `waiting`, blockers contain `buyer_open_orders`. Step 3: `cancelled`. Step 4: `done`; `profiles.display_name = 'Deleted user'`, photo and bio empty; no `saved_addresses`, `notifications`, `saved_works` rows; `reviews.buyer_name = 'Buyer'`; B1's orders, lines and refunds still exist and A1's payout totals are unchanged; the auth user is gone.

### QA-S16-07 Admin sees waiting deletion requests
Covers: S16.i.10 · Type: e2e (`e2e/admin-queues.spec.js`) · Role: AD1, B2 · Route: `/admin/queues`
Setup: B1 has a `waiting` request.
See: AD1: a "Deletion requests" list with B1, scope, date and "open Orders". B2 selecting `deletion_requests` sees only their own row, never B1's.
Data: none.

## S17 Notifications

### QA-S17-01 List, groups, filters, pages
Covers: S17, S17.st.default, S17.i.01, i.02, i.03 · Type: e2e (`e2e/notifications.spec.js`) · Role: B1 · Route: `/notifications` · View: all
Setup: Add 20 older notifications for B1.
Do: 1. Read the page. 2. Press Unread, Orders, Reviews. 3. Go to page 2. 4. Reload.
See: "Today" and "Earlier" groups; two rows carry "New"; the Unread chip reads "Unread 2" and lists two; Orders and Reviews list only their kinds; page 2 shows the rest; filter and page survive the reload.
Data: none.

### QA-S17-02 Empty states
Covers: S17.st.empty · Type: e2e (`e2e/notifications.spec.js`) · Role: B2 · Route: `/notifications`
See: "You're all caught up" with "Browse art"; no "Mark all as read" button. For B1 with the Reviews filter and no review notices: "Nothing here."
Data: none.

### QA-S17-03 Read state, mark all, the bell, two devices
Covers: SH.04, S17.i.04, S17.i.07 · Type: e2e (`e2e/notifications.spec.js`, two browser contexts) · Role: B1
Do: 1. In context 1 open the bell and press "See all". 2. Click one unread row. 3. Press "Mark all as read". 4. Wait 20 seconds in context 2. 5. Repeat step 3 with the update made to fail.
See: Step 1: `/notifications`. Step 2: navigates to the order; back on the list the row has no "New". Step 3: no "New" badges, bell count gone. Step 4: context 2's bell count is gone too. Step 5: error toast, badges remain.
Data: `notifications.read` true for B1's rows only.

### QA-S17-04 Every producer
Covers: S17.i.05 · Type: schema · Role: service
Do: Drive one order through paid, shipped, auto-received; issue a partial then a full refund; file and decide a Damage Report; approve one review and reject another; record a payout; verify an Artist; restrict and lift.
See: —
Data: Exactly one notification per event for the right person with the types listed in P04; a full refund yields `refund_issued` and no `order_refunded`; auto-receive yields `review_prompt` with `auto: true`.

### QA-S17-05 A notification whose target is gone
Covers: S17.i.06 · Type: unit (`src/lib/notifications.test.js`) and e2e · Role: B1
Do: Unit: call `notificationTarget` for every type with and without ids. E2E: click a notice for an order that was reassigned to another buyer.
See: The order page says "We couldn't find this order" with a link to My orders; no crash.
Data: Unknown types return null and render "Update" with no link.

## S18 Become an Artist

### QA-S18-01 Details step
Covers: S18, S18.st.step1, S18.i.01, i.03, i.11 · Type: e2e (`e2e/become-artist.spec.js`) · Role: B1 · Route: `/become-artist` · View: all
Do: 1. Press "Continue to phone check" on the empty form. 2. Enter legal name "Ananya Verma", PAN `abcde1234f`, City "Mumbai", State "Maharashtra", UPI `ananya@okhdfc`, bio "Small paintings.", pick "Art", tick both boxes, continue.
See: Step 1: a summary alert listing every required field, each field marked. Step 2: the PAN shows as `ABCDE1234F`; the phone step opens. The private-data notice and the "How selling works" aside are present.
Data: `artist_private` row for B1 with the legal name, PAN, UPI method, specialties, both agreement times; `profiles.city`, `state`, `bio` set; `verified_at` null. B1 is not yet an Artist.

### QA-S18-02 Bank details validation
Covers: S18.i.02 · Type: e2e and schema · Role: B1 · Route: `/become-artist?step=1`
Do: Choose "Bank account". Enter holder "Ananya Verma", IFSC `hdfc0001234`, account `1234567`, confirm `12345678`. Fix to account `123456789012` in both.
See: "Account numbers have 9 to 18 digits."; "The two account numbers don't match."; IFSC shows upper-case. After the fix the step saves. The UPI field is not shown while Bank is chosen.
Data: `payout_method` is `{type:'bank', account, ifsc, holder}`. The schema test refuses a bank method with no holder and a bad IFSC.

### QA-S18-03 Real WhatsApp code
Covers: S18.st.step2, D03 · Type: sandbox · Role: a test Google account · Route: `/become-artist`
Setup: Hook configured with the Meta test number and an approved authentication template.
Do: 1. Enter your own phone, press "Send code on WhatsApp". 2. Enter the code received.
See: A WhatsApp message arrives within a minute with a 6-digit code. Step 2 moves to the fee step.
Data: `auth.users.phone_confirmed_at` set; `artist_private.phone_verified` true. Record the Meta message id and the per-message charge in `RESULTS.md` (XD04).

### QA-S18-04 Code entry, wrong, expired, resend, change number
Covers: S18.i.04 · Type: e2e (`e2e/become-artist.spec.js`, local test code) · Role: B1 · Route: `/become-artist`
Setup: QA-S18-01 done. Phone `9000000001` accepts `123456` locally.
Do: 1. Send the code. 2. Type `111111`, verify. 3. Paste `123456` into the first box. 4. Before verifying, press "Change number" and come back. 5. Press "Resend code" twice quickly. 6. Verify with `123456`.
See: Step 1: "We sent a 6-digit code on WhatsApp to +91 9000000001. It works for 10 minutes." and a 60-second resend timer. Step 2: "That code isn't right…", boxes cleared. Step 3: all six boxes fill. Step 5: the second press is refused with "Too many tries…". Step 6: the fee step.
Data: `phone_verified` true only after step 6.

### QA-S18-05 Fee payment
Covers: S18.st.step3, S18.i.05 · Type: e2e (fake provider) and sandbox (Razorpay test keys) · Role: B1 · Route: `/become-artist`
Do: 1. Press the pay button without ticking the box. 2. Tick, press "Open my shop for ₹499", choose Pay in the test window.
See: Step 1: "Tick the box to continue." Step 2: "Confirming your payment…", then the Done view.
Data: `fee_orders` row paid with a payment id; `artist_private.onboarding_paid_at` set, amount 49900; B1's `app_metadata.artist` true and `profiles.roles` contains `artist`.

### QA-S18-06 Done view and role refresh
Covers: S18.st.done, S18.i.08 · Type: e2e · Role: B1 (after QA-S18-05)
Do: 1. Read the Done view. 2. Press "Go to my dashboard" without reloading. 3. Open `/become-artist` again.
See: "You're an Artist on CraftMe" with the four first steps. Step 2 opens the dashboard without a redirect to `/` (claims were refreshed). Step 3 shows the Done view. The account menu now offers "Artist dashboard".
Data: none.

### QA-S18-07 Cancelled, duplicate and late fee payments
Covers: S18.i.06, PD27 · Type: e2e (fake provider) and schema · Role: B1
Do: 1. Open the window and close it. 2. Open it again within 15 minutes. 3. Pay, but make `confirmFeePayment` fail; then send the signed webhook. 4. Send the same webhook again. 5. Pay a second, older fee order for the same person.
See: Step 1: still on the fee step, no message. Step 3: the confirming panel finishes after the webhook. Step 5: if the page is open, "You were charged twice. The second payment is being returned."
Data: Step 2 reuses the same `fee_orders` row. Step 4 changes nothing. Step 5: the second row has `paid_at` and `refunded_at`; the fake provider recorded one refund; `onboarding_payment_id` is still the first.

### QA-S18-08 Resume after reload at each step
Covers: S18.i.07 · Type: unit (`src/lib/onboarding.test.js`) and e2e · Role: B1
Do: Reload after the details step, after the phone step, after paying but before the role is set (make `becomeArtist` fail once).
See: The page reopens at phone, fee, and "Your payment is recorded. We couldn't open your shop yet." with "Try again", which completes.
Data: No second `fee_orders` payment; one role grant.

### QA-S18-09 Closed switch and providers not set up
Covers: S18.i.09, S18.i.10, D15 · Type: e2e · Role: B1 · Route: `/become-artist`
Setup: Three runs: `acceptArtists` false; onboarding fee 0; Razorpay keys removed with fake mode off.
See: Run 1: "CraftMe isn't taking new Artists right now.", and no seller link in the header, footer, Home or profile. Run 2: at the fee step "The fee to open a shop isn't set yet…", no button. Run 3: "Payments aren't set up on this site yet.", button disabled.
Data: `payOnboardingFee` answers `artists_closed`, `fee_not_set`, `payments_not_configured` respectively.

## S19 Legal

### QA-S19-01 Seven pages, deep links, signed out
Covers: S19, S19.st.default, S19.tab.terms, privacy, artist, S19.i.01, i.03 · Type: e2e (`e2e/legal.spec.js`) · Role: G · View: all
Do: Open `/legal`, then each of `/legal/terms`, `privacy`, `refunds`, `shipping`, `contact`, `artist`, `deletion`, then `/legal/nope`, then `/privacy`.
See: `/legal` goes to terms. Each page loads signed out with its title, "Last updated", and the tab row marking it current. `nope` shows the 404 page. `/privacy` redirects. At 375 px the tab row scrolls sideways without moving the page.
Data: none.

### QA-S19-02 Policy numbers and overdue wording
Covers: S19.tab.refunds, S19.i.05, D05 · Type: unit (content test) and e2e · Role: G · Route: `/legal/refunds`
See: 15 minutes, 7 days, 14 days, 3 days, 30 days, 1st and 15th, 60 days appear and equal `RULES`. The overdue sentence says the Order is reviewed and usually refunded in full; it does not promise an automatic refund. The page title is "Cancellation and Refunds".
Data: The unit test renders each page with altered `RULES` and sees the numbers change.

### QA-S19-03 Deletion request from the legal page
Covers: S19.tab.deletion · Type: e2e (`e2e/legal.spec.js`) · Role: G, B2, A1 · Route: `/legal/deletion`
Do: 1. As G read the form area. 2. As B2 choose "Everything" and press "Request deletion". 3. As A1 (Instagram connected in the fake provider, 2 imports, 1 pasted link) choose "Only my Instagram data", confirm.
See: Step 1: "Log in to request deletion". Step 2: the DELETE dialog of the profile page. Step 3: "Your Instagram data was deleted."
Data: Step 3: no `instagram_accounts` row and no row with `ig_media_id` for A1; the pasted link remains; A1's account is otherwise unchanged and no `deletion_requests` row exists.

### QA-S19-04 Meta deletion status page
Covers: S19.i.04, KD07 · Type: e2e and schema · Role: G · Route: `/instagram-deletion?code=<code>`
Setup: Insert one finished and one unfinished row in `instagram_deletions`.
See: Finished: the date and the code. Unfinished or unknown code: "We couldn't find a finished request for that code…". The page is linked from `/legal/deletion`.
Data: none.

### QA-S19-05 Draft legal text cannot ship
Covers: S19.i.02 · Type: unit (script) · Role: developer
Do: Run `node scripts/check-legal.mjs` with one page marked `draft: true`, then with none.
See: First run exits non-zero and names the page; second exits zero. In development a draft page shows a visible draft notice; a production build never contains the string "Draft".
Data: none.

## S20 Not found

### QA-S20-01 Unknown route
Covers: S20, S20.st.default · Type: e2e (`e2e/shell.spec.js`) · Role: G · Route: `/no/such/page` · View: all
Do: Search `kolam` from the page's search box; go back; press "Go to Home"; go back; press "Browse art".
See: "This wall is empty." and the explanation; the three recoveries work.
Data: none.

### QA-S20-02 Bad ids, missing resources and network errors
Covers: S20.i.01, S20.i.03, S03.i.13 · Type: e2e (`e2e/shell.spec.js`) · Role: B1
Do: Open `/artwork/xyz`, `/artwork/<W4>` (a draft), `/artwork/<W7>` (restricted Artist), `/orders/xyz`, `/artist/xyz`; then open `/artwork/<W1>` with the network blocked.
See: The first five show the matching "We couldn't find this…" view with a way out. The last shows "We couldn't load this page." with "Try again", which works when the network returns.
Data: none.

## Kept extras

### QA-X-01 Heart on cards and pages
Covers: X.01, S03.i.16, S36.i.07, KD01 · Type: e2e (`e2e/extras.spec.js`) · Role: G, B1, A1 · Route: `/browse`, `/artwork/<W6>`
Do: 1. As G press a heart. 2. As B1 press the heart on W6 twice quickly, then once more. 3. As A1 look at W1's card.
See: Step 1: sent to login and back. Step 2: the heart fills at once; the header count rises by one, then falls. Step 3: no heart on one's own work.
Data: `saved_works` has one row after the first press and none at the end.

### QA-X-02 Collections and their limits
Covers: X.02 · Type: e2e (`e2e/extras.spec.js`) and schema · Role: B1 · Route: `/wishlist`
Do: Create "Living room"; add W6 from its page with the collection menu; rename to "Hall"; try the name "hall " again for a second collection; delete the collection.
See: The tab shows "Hall 1"; the duplicate name is refused with "You already have a collection with that name."; deleting keeps W6 in All saved.
Data: The schema test already covers 500 saved works, 20 collections and 100 works per collection.

### QA-X-03 Saved-works search and works that are gone
Covers: X.03 · Type: e2e (`e2e/extras.spec.js`) · Role: B1 · Route: `/wishlist?q=heron`
Setup: B1 saved W6 and W2. Then W2's Artist is restricted.
See: The search shows W6 only and survives reload. Without the query, W2 sits under "No longer available" with "Remove".
Data: none.

### QA-X-04 Collection created but adding the work fails
Covers: X.04 · Type: e2e (`e2e/extras.spec.js`) · Role: B1 · Route: `/artwork/<W6>`
Setup: Make the `collection_works` insert fail once.
Do: In the collection menu choose "New collection", name it "Gifts", create.
See: A message that the collection was created but the work could not be added, with a way to try again; the menu then lists "Gifts" unticked.
Data: `collections` has "Gifts"; `collection_works` has no row for it; a retry adds exactly one.

### QA-X-05 Global search while the catalogue changes
Covers: X.05, KD02 · Type: e2e (`e2e/extras.spec.js`) and schema · Role: G · Route: `/browse?q=a&type=artists`
Do: Open page 1 of artwork results for `a`; publish a new matching work as A1 in another context; press Next, then Previous.
See: No error; pages stay 24 long; the Artists view lists only unrestricted Artists (A3 absent). `%` typed in the box is treated as a plain character.
Data: none.

### QA-X-06 Branding
Covers: X.06, KD04 · Type: e2e (`e2e/shell.spec.js`) · Role: G · Route: `/` · View: both themes
See: The pot icon and "CraftMe" in the header of the public site, the artist shell and the admin shell; the tab icon is `/brand/craftme-icon.svg`; `/manifest.json` loads; the theme colour meta is `#a3472b`. The reference's ring mark appears nowhere.
Data: none.
