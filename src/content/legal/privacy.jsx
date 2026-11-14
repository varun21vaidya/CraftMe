// Moved from the old Privacy page. It is the project's own working text, not reviewed: draft = true until CraftMe supplies the final policy (XD03).
export const title = 'Privacy policy';
export const tab = 'Privacy';
export const updated = '2026-11-14';
export const draft = true;

export function Body() {
  return (
    <>
      <p>CraftMe is a marketplace where Indian Artists and makers sell art, crafts and kits. This page explains what we collect and why.</p>

      <h2>What we collect</h2>
      <ul>
        <li>When you sign in with Google: your name, email address and profile photo.</li>
        <li>When you order: your delivery address and phone number, and the items you bought.</li>
        <li>If you sell: the profile, Listings and photos you add.</li>
      </ul>

      <h2>Payments</h2>
      <p>Payments are handled by Razorpay. We never see or store your card, UPI or bank details. We keep only the Order amount and a payment reference.</p>

      <h2>Instagram</h2>
      <p>Artists can add links to their Instagram reels and an optional Instagram handle. A reel plays only when you tap it, and then it loads from Instagram, which sets its own cookies and policy. For pasted reels we store only the link, an optional cover picture, and the Artist’s own choices.</p>
      <p>Artists with an Instagram creator or business account can also connect it to CraftMe. If they do, we store their Instagram user ID and username, an access token (encrypted, kept on our servers only), and the link, ID and a copy of the thumbnail of each reel they choose to import. We read only the account’s own profile and media, and only after the Artist approves. We never post, send messages, or read other people’s data, and we never see an Instagram password.</p>
      <p>An Artist can disconnect at any time on their dashboard, or remove CraftMe in Instagram under Settings, then Apps and websites. Disconnecting deletes the access token. Anyone can ask us to delete their Instagram data; when Instagram sends us that request, the imported reels, thumbnails and token are deleted, and the confirmation page is at <a href="/instagram-deletion">/instagram-deletion</a>.</p>

      <h2>How we use it</h2>
      <p>To sign you in, take and ship Orders, show an Artist the delivery details of their own Orders, send Order updates, and prevent fraud. We do not sell your data or use it for advertising.</p>

      <h2>Who sees it</h2>
      <p>The Artist of an item you buy sees your name and delivery address for that Order. Our service providers (Supabase for hosting and sign-in, Razorpay for payments, Vercel for the website) process data on our behalf. Anyone else sees only what you choose to make public, such as an Artist page.</p>

      <h2>Your choices</h2>
      <p>You can delete your Account yourself on your <a href="/profile">profile page</a>, or from <a href="/legal/deletion">Delete my data</a>. Order records may be kept as the law requires.</p>
    </>
  );
}
