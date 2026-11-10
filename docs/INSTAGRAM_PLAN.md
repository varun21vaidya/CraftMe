# Instagram for artists: plan

## Goal
Artists keep signing in with Google. They can then link Instagram, show chosen reels on their page, and attach a reel to each product.

## Decisions
- **Google stays the only login.** Instagram is a link on top of an existing account, not a second way in. (Supabase has no Instagram login; a custom one means extra code and a second identity with no email, so it would create duplicate accounts.)
- **Reels first by pasted link.** It needs no Meta approval, so it ships first. The Instagram connection comes second and only makes it easier.

## Phase 1: paste a reel link (no Meta app, about 1 to 2 days)
- **Data:** new table `reels` (id, artist_id, url, code, caption, highlighted, position, created_at). Nullable `reel_id` on `artworks`. RLS: artists manage their own rows; anyone can read rows of open artists.
- **Add a reel:** the dashboard gets a "My reels" section. The artist pastes an `instagram.com/reel/CODE` link. We check the format and store the code. Max 12 reels.
- **Highlight:** a star toggle picks which reels show on the artist page, and the order.
- **Link to a product:** the new-artwork and edit forms get an optional "Reel" dropdown of the artist's reels, or a pasted link.
- **Show it:** the artist page shows highlighted reels. The product page shows its own reel under the photos. Embed with Instagram's own embed frame, loaded only when the visitor taps the thumbnail.
- **Tests:** link-format check, RLS (an artist cannot touch another artist's reels), schema test additions.
- **Limit:** anyone can paste any public reel, so a reel is not proof of ownership. Mark these as "added by the artist". Fixed by Phase 2.

## Phase 2: Connect Instagram (optional, needs Meta approval, about 1 week plus review)
- **What the artist sees:** a "Connect Instagram" button on the dashboard after Google sign-in. They approve, and CraftMe lists their recent reels with thumbnails to pick from.
- **How:** Instagram API with Instagram Login, run in the existing `api` Edge Function (code exchange, token storage, media fetch). The token lives server-side only, in a private table, and is refreshed by pg_cron before the 60-day expiry.
- **Result:** imported reels are marked verified, and the handle is confirmed instead of typed.
- **Needs (you):** a Meta developer app, Instagram Login product, our privacy policy URL, and App Review for the media permission. Until approved, only accounts added as testers can connect.
- **Limit:** Meta only allows creator or business accounts, not personal ones. Those artists keep using Phase 1.

## Phase 3: Instagram as a login (not planned)
Revisit only if artists ask. Needs a custom OAuth flow and a rule for merging with a Google account.

## Risks
- Embeds load third-party scripts: load on tap, mention Instagram in the privacy page.
- Meta can change or limit the API: Phase 1 does not depend on it.
- Reels can be deleted on Instagram: show a "reel unavailable" state, never break the page.

## Order
1. Phase 1 now. 2. Create the Meta app while Phase 1 is built (review takes the longest). 3. Phase 2 once approved.

## Questions for you
1. Phase 1 first, then Phase 2? (recommended)
2. Do you want reels on buyer-facing Browse cards too, or only on the artist and product pages?
