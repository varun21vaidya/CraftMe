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
