# Product page fixes: photo carousel, reel playback, notifications — plan

Four problems reported from the live site. All four are front-end changes (no database change).

| # | Problem | Cause found in the code |
|---|---|---|
| 1 | Photos are stacked one under another | `ArtworkPage.jsx` maps every photo to its own full-width `.mat` block |
| 2 | A photo can be taller than the screen, so buyers scroll to see it whole | `LazyLoadImage width="100%"` with no height limit |
| 3 | The reel shows no play button and does not play | See "Reel" below |
| 4 | A clicked notification stays; the page does not change | `NotificationBell.jsx` only calls `markRead`; the list refreshes every 20 s, the menu stays open, nothing opens the order |

## Decisions (from the questions)
- **Reels:** one reel per product, as the **last slide** of the carousel.
- **Notifications:** click opens the order, marks it read, closes the list; read notifications leave the bell; a "Mark all as read" button clears the rest.
- **Photo fit:** show the whole photo, never cropped, inside a frame no taller than about 65% of the screen.

## 1 and 2. Carousel (new `src/components/Gallery.jsx`)

Used by `ArtworkPage`. It receives `photos` and an optional `reel`, and replaces the stacked photos.

Layout:
- **Frame:** `height: min(65dvh, 640px)`, `object-fit: contain`, the existing `.mat` look behind it. The whole photo is visible, with a strip of mat at the sides for tall or wide photos. No scrolling needed to see a photo whole, on a phone or a laptop.
- **Slides:** a horizontal `scroll-snap` track. Phones swipe natively, with no JavaScript needed for the swipe.
- **Desktop:** previous and next arrow buttons over the frame, and a thumbnail strip underneath (Amazon style). Clicking a thumbnail jumps to that slide.
- **Phone:** dots and a "2 / 5" counter. No thumbnails (too small).
- **Keyboard:** Left and Right arrows move between slides when the gallery has focus. Arrow buttons are real `<button>`s with labels ("Previous photo", "Next photo").
- **Accessibility:** wrapper `role="region"` with `aria-roledescription="carousel"`; each slide `aria-roledescription="slide"` and `aria-label="2 of 5"`; the active thumbnail has `aria-current`. Respects reduced motion (no smooth scroll).
- **Performance:** only the first slide loads at once; the next slide is pre-loaded when the current one shows. Every image gets a fixed frame, so the page does not jump while loading.
- The right-hand panel (price, Add to Cart) keeps its sticky position on desktop. On a phone the gallery is on top, then the details, as now.

Pure helper (unit-tested in `src/lib/gallery.js`): `step(index, delta, count)` — clamps at the ends (no wrap, so the arrows disable at the first and last slide) and `slideFromScroll(scrollLeft, width)`.

Edge cases:
| Case | Expected |
|---|---|
| 1 photo, no reel | No arrows, dots, counter or thumbnails |
| 5 photos plus a reel | 6 slides; the reel is last |
| 0 photos, with a reel | The reel is the only slide |
| 0 photos, no reel | A plain placeholder frame with the title; no empty box |
| A photo fails to load | That slide shows the placeholder; the others still work |
| Very tall or very wide photo | Fully visible, centred, not cropped |
| Phone rotated | Frame height recalculates (it uses `dvh`); stays on the same slide |
| Window resized to a different width | Same slide stays selected |
| Slide changed by swipe | Dots, counter and thumbnail follow the scroll position |
| Back to the page after another page | Starts at slide 1 |
| A different product opened from the same component | Index resets to 0 (key the gallery by artwork id) |
| Right-to-left languages | Not supported yet; the site is English only |

## 3. Reel not playing

What I found, on the live site:
- The reel itself is fine. Opening its embed address on its own shows the video with a play button.
- Inside our page the frame is **blank**: no play button. The browser console shows three failed (HTTP 400) requests from the frame. Our site sends no header that blocks it. So Instagram's embed is failing in a third-party frame (known for blocked third-party cookies, privacy browsers, and in-app browsers) and we show nothing in its place.
- `ReelCard` also shows only a text button, "Watch this reel on Instagram", and puts the frame at a fixed 520 px height inside a narrow box.

Fix (the page must never depend on the embed working):
1. **Cover with a real Play button.** The reel slide shows the reel's cover picture with a large round ▶ over it. Reels imported through Instagram already have a cover; reels pasted as a link do not, so those show a plain dark frame with the ▶ and "Reel".
2. **Tap ▶:** load the embed inside the same frame (kept to Instagram's allowed width of 326–540 px, centred).
3. **Always-visible fallback:** under the frame, a clear **Open on Instagram** button (opens the reel in a new tab or the Instagram app). If the embed stays blank the buyer still has a working way to watch. After 6 seconds with the embed open, the text "Not loading? Open it on Instagram" appears.
4. **Embed attributes:** `referrerPolicy="strict-origin-when-cross-origin"`, `allowFullScreen`, `allow="autoplay; encrypted-media; picture-in-picture"`, no `loading="lazy"` (it is only created after the tap).
5. **Verify in a normal browser (the user's real one) before calling it fixed.** The built-in test browser here is not a full match for a visitor's browser, so I will report exactly what I could and could not see.

Not doing: hosting copies of the video. Instagram's video links expire and copying artists' videos raises permission questions; this needs a separate decision if wanted.

Also: the artist page lists reels in a grid. On phones this becomes a horizontal swipe row (same scroll-snap) so reels are not a long vertical stack.

Edge cases:
| Case | Expected |
|---|---|
| Reel has a cover | Cover plus ▶ |
| Reel has no cover (pasted link) | Dark frame, ▶, "Reel" label |
| Embed blank | Open on Instagram stays visible; the hint appears after 6 s |
| Reel deleted on Instagram | Embed shows Instagram's own message; the button still opens Instagram |
| Account made private | Same as above |
| Swiping away while playing | The embed is removed when the slide leaves view, so audio stops |
| Two reels on the artist page | Each loads only when its own ▶ is pressed |
| Slide width under 326 px | Skip the embed and show only the Open on Instagram button |

## 4. Notifications

Changes in `NotificationBell.jsx`, `NotificationsContext.jsx` and `gateway.js`:
- **Where a click goes** (the data already carries `orderId`):

  | Type | Goes to |
  |---|---|
  | `order_paid`, `order_shipped`, `order_refunded` (buyer) | `/orders/<orderId>` |
  | `order_new`, `order_received`, `ship_reminder` (artist) | `/dashboard/orders` |
  | `instagram_reconnect` | `/dashboard/profile` |
  | unknown type | closes the list, no navigation |

- **On click:** mark it read, update the list immediately (no waiting for the 20 s refresh), close the list, then navigate.
- **Unread count and list:** the list shows only unread items; the count drops straight away. Read ones are hidden (they stay in the database).
- **Mark all as read** button in the header, shown only when something is unread. One update: `where user_id = me and read = false`.
- **Empty state:** "You're all caught up."
- **Closing:** also closes on Esc, on a click outside, and when the page changes.
- **Refresh when opened:** fetch the latest as the list opens, so it is never up to 20 s old.
- **Failure:** if marking fails (network), the item reappears as unread and the click still navigates.
- **Phone:** the list is a fixed panel under the header; make sure it fits (width `min(360px, 100vw - 32px)`) and scrolls if long.
- **Wording:** the order timestamp stays; times use the viewer's locale as now.
- `NotificationsContext` exposes `markRead(id)`, `markAllRead()`, `reload()`, and keeps a local "already read" set so the UI updates before the server answers.

Edge cases:
| Case | Expected |
|---|---|
| Two clicks on the same item | One request |
| The order was deleted or is not the viewer's | The order page shows its own "not found" |
| Artist clicks `order_new` | Lands on Orders to ship |
| 20+ notifications | The latest 20 unread are shown |
| Signed out | No bell (unchanged) |
| Poll arrives while the update is in flight | The local read set keeps it hidden |

## Order of work
1. Gallery component and helper, plus the product page (fixes 1 and 2).
2. Reel slide and `ReelCard` rewrite (fix 3), and the phone swipe row for the artist page.
3. Notifications (fix 4).
4. Tests, then the browser check at 390 px, 768 px and 1440 px on the live site, then merge and deploy.

## Tests
- **Unit:** `gallery.test.js` (step clamps at both ends, one-item gallery, slide from scroll position). Notification route helper `notificationTarget(type, data, role)` in a pure file, tested for every type above, an unknown type and missing `orderId`.
- **Schema:** the bulk "mark all read" update is allowed for the owner and does not touch someone else's notifications.
- **Browser (signed out, live):** product with several photos, one photo, and a reel; swipe, arrows, thumbnails; the whole photo visible without scrolling at 390 × 800 and 1440 × 900; the reel's ▶ and Open on Instagram button.
- **Browser (signed in):** I cannot sign in for you. You will need to click a notification once to confirm; I will tell you exactly what to look for.
- `npm run lint`, `npm test`, `npm run test:schema`, `npm run build` before merging.

## Out of scope (named, not built)
- Zoom or a full-screen photo viewer.
- Several reels per product (needs a database change).
- Pushing notifications to the phone (a push or WhatsApp message), and a full notification history page.
- Hosting reel videos ourselves.
