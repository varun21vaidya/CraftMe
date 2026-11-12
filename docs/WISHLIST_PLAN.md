# Wish list and collections — plan

Goal: a signed-in buyer can save products with a heart, group saved products into named collections (e.g. "Gifts for Mom", "Diwali"), and later add them to the Cart.

This needs **a database change (a new migration) and coding changes**. Nothing here is built yet.

## What already constrains the design

| Fact | Effect on the wish list |
|---|---|
| A Cart holds one Artist's work only (`cart.artistId`; the "Start a new Cart?" dialog) | "Add all to Cart" cannot mix Artists. Saved items are grouped by Artist, with an "Add to Cart" per group |
| A work can have several versions (Original, Print, Ready-made) with different prices | We save the **work**, not one version. From the wish list, "Add to Cart" only works directly when exactly one version is on sale; otherwise it opens the product page to choose |
| Works of a restricted Artist, taken-down works and sold-out works disappear or change state | A saved work can become unavailable. It must stay in the list, marked, never crash |
| Artists cannot add their own work to a Cart | They also cannot save their own work |
| `ArtCard` is now an `<article>` with separate links | A heart button fits there without nesting links |

## Decisions (defaults I recommend — say if you want any changed)
1. **Signed-in only.** A signed-out visitor who presses the heart is sent to log in and comes back to the same page (the same pattern as Add to Cart).
2. **One saved list ("Wish list") plus collections.** Saving a work puts it in the Wish list. A work can then be added to any number of collections. Removing it from the Wish list removes it from all collections.
3. **Private.** Only the owner sees their lists. No sharing links in this version.
4. **Limits:** 500 saved works, 20 collections, 100 works per collection, collection names 1–60 characters, unique per person (case-insensitive).
5. **Deleting a collection** never deletes the saved works, only the group.

## Database (migration `0015_wishlist.sql`)

```
saved_works(user_id, artwork_id, created_at)            primary key (user_id, artwork_id)
collections(id, user_id, name, created_at)               unique (user_id, lower(name))
collection_works(collection_id, user_id, artwork_id, created_at)
                                                         primary key (collection_id, artwork_id)
                                                         foreign key (user_id, artwork_id) -> saved_works  on delete cascade
```
- The composite foreign key means a work can only be in a collection if it is saved, and un-saving removes it from every collection automatically.
- **Row security:** every table readable and writable only where `user_id = auth.uid()`. `collection_works.user_id` must match the owning collection's `user_id` (checked with a trigger).
- **Grants:** `authenticated` only; nothing for `anon`; `service_role` gets all (as in migration 0013).
- **Limits** enforced by triggers (not only in the page), the same way the reel limits are.
- **Own work:** a trigger refuses saving a work whose `artist_id = auth.uid()`.
- **Artwork must be visible:** the insert policy checks the artwork is readable by the user (published and its Artist is open), so a hidden work cannot be saved by guessing its id.
- Saved works whose artwork later becomes unreadable keep their row; the page shows "No longer available" with a Remove button.

## Pages and components
- `src/api/gateway.js`: `useSaved(uid)`, `useCollections(uid)`, `saveWork`, `unsaveWork`, `createCollection`, `renameCollection`, `deleteCollection`, `addToCollection`, `removeFromCollection`. All use the existing `safe` and `must` pattern.
- `src/contexts/SavedContext.jsx`: one list of saved ids for the whole app, so every heart knows its state without one request per card. Updates are **optimistic** (the heart fills at once and goes back if the save fails).
- `src/components/SaveButton.jsx`: the heart (a real button with `aria-pressed` and a label "Save to wish list" / "Remove from wish list"). Used on `ArtCard` (corner of the photo), the product page, and the Artist page cards.
- Product page: heart next to the title, plus "Add to collection…" (a small menu listing collections with ticks, and "New collection").
- `/wishlist`: header with the count; tabs **All saved** and one tab per collection; works grouped by Artist, each group with "Add to Cart" (see rules below).
- `/wishlist/:collectionId`: a collection's works, with Rename and Delete.
- Menu and header: a **Saved** link (heart icon with a count) for signed-in users, including the phone menu.

## Add to Cart from the wish list (rules)
| Situation | What happens |
|---|---|
| Work has exactly one version on sale and stock left | Added straight to the Cart |
| Work has several versions on sale | Opens the product page to choose |
| Sold out / taken down / Artist restricted | Button replaced by "Not available"; item stays, with Remove |
| Cart already holds another Artist's work | The existing "Start a new Cart?" dialog appears |
| "Add all from <Artist>" | Adds each eligible work with quantity 1; skips the unavailable ones and says how many were skipped |
| Price changed since it was saved | Shows today's price (we never store a price) |

## Edge cases
| Case | Expected |
|---|---|
| Press the heart twice quickly | One request; ends in the last state pressed |
| Save fails (offline) | Heart reverts, short message |
| Save the same work in two browser tabs | No duplicate (primary key) |
| 501st saved work | Clear message: "Your wish list is full (500)" |
| Collection name empty, 61 characters, or already used (any capitalisation) | Rejected with a clear message |
| Add the same work to a collection twice | No duplicate, no error |
| Delete a collection with works in it | Asks to confirm; works stay in the Wish list |
| Un-save a work that is in collections | Leaves them all |
| Artist deletes or restricts their account | Saved row stays; shows "No longer available" |
| Work removed by an admin | Same as above |
| Signed out, presses heart | Goes to login, returns, and saves it |
| Buyer is also an Artist, views own work | No heart |
| Brand-new user | Friendly empty state with a "Browse art" button |
| 500 saved works | The list loads in pages of 24 ("Show more"), not all at once |
| Two people share a device | Lists follow the account, not the browser |

## Tests
- **Schema** (the PGlite suite): owner-only read and write; another user sees nothing; signed-out sees nothing; duplicate saves rejected; the 501st save, 21st collection and 101st collection item rejected; duplicate collection name (different case) rejected; un-saving removes the work from its collections; cannot save your own work; cannot save a hidden or removed work; cannot put someone else's saved work in your collection.
- **Unit:** the grouping-by-Artist helper (groups, order, unavailable items, empty list) and the "can add straight to Cart" rule.
- **Browser (live):** signed out, the heart sends to login; the pages render at 390 px and 1440 px. I cannot sign in for you, so you will need to save a work, make a collection and add it to a Cart once to confirm.
- `npm run lint`, `npm test`, `npm run test:schema`, `npm run build` before merging.

## Order of work
1. Migration and schema tests.
2. Gateway functions, context, heart button on cards and product page.
3. `/wishlist` page, collections, menu links.
4. Add-to-Cart rules, empty and unavailable states.
5. Tests, deploy, live check.

## Out of scope (named, not built)
- Sharing a collection with a link or making it public.
- Price-drop and back-in-stock alerts.
- A wish list for signed-out visitors (saved in the browser and merged on login).
- Sorting and notes on saved works.
- Saving a specific version (size or kind) instead of the whole work.
