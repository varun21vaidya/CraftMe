// Draft policy for a demo marketplace. Before real launch: add a contact email and have it reviewed.
export default function Privacy() {
  return (
    <main className="wrap page" style={{ maxWidth: 720 }}>
      <h1>Privacy policy</h1>
      <p>CraftMe is a marketplace where Indian artists and makers sell art, crafts and kits. This page explains what we collect and why.</p>

      <h3>What we collect</h3>
      <ul>
        <li>When you sign in with Google: your name, email address and profile photo.</li>
        <li>When you order: your delivery address and phone number, and the items you bought.</li>
        <li>If you sell: the profile, listings and photos you add.</li>
      </ul>

      <h3>Payments</h3>
      <p>Payments are handled by Razorpay. We never see or store your card, UPI or bank details. We keep only the order amount and a payment reference.</p>

      <h3>Instagram</h3>
      <p>Artists can add links to their Instagram reels and an optional Instagram handle. A reel plays only when you tap it, and then it loads from Instagram, which sets its own cookies and policy. For pasted reels we store only the link, an optional cover picture, and the artist’s own choices.</p>
      <p>Artists with an Instagram creator or business account can also connect it to CraftMe. If they do, we store their Instagram user ID and username, an access token (encrypted, kept on our servers only), and the link, ID and a copy of the thumbnail of each reel they choose to import. We read only the account’s own profile and media, and only after the artist approves. We never post, send messages, or read other people’s data, and we never see an Instagram password.</p>
      <p>An artist can disconnect at any time on their profile page, or remove CraftMe in Instagram under Settings, then Apps and websites. Disconnecting deletes the access token. Anyone can ask us to delete their Instagram data; when Instagram sends us that request, the imported reels, thumbnails and token are deleted, and the confirmation page is at <a href="/instagram-deletion">/instagram-deletion</a>.</p>

      <h3>How we use it</h3>
      <p>To sign you in, take and ship orders, show a seller the delivery details of their own orders, send order updates, and prevent fraud. We do not sell your data or use it for advertising.</p>

      <h3>Who sees it</h3>
      <p>The seller of an item you buy sees your name and delivery address for that order. Our service providers (Supabase for hosting and sign-in, Razorpay for payments, Vercel for the website) process data on our behalf. Anyone else sees only what you choose to make public, such as a seller profile.</p>

      <h3>Your choices</h3>
      <p>You can ask us to correct or delete your account data. Order records may be kept as the law requires.</p>

      <p style={{ opacity: 0.7 }}>Last updated 11 November 2026.</p>
    </main>
  );
}
