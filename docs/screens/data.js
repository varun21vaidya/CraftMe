/* CraftMe screens: shared sample data and the screen registry.
   Everything here is invented example content for the design review. */
window.CM_DATA = (function () {
  var CATS = ['Painting', 'Drawing & illustration', 'Photography', 'Sculpture', 'Prints & digital art', 'Crafts', 'Other'];

  var ARTISTS = [
    { id: 1, name: 'Meera Iyer', init: 'MI', city: 'Chennai', field: 'Acrylic painter', rating: 4.9, reviews: 38, ig: 'meera.paints', bio: 'Paints the Coromandel coast in layered acrylics and kolam geometry. Studio on the third floor of an old Mylapore house.' },
    { id: 2, name: 'Arjun Deshmukh', init: 'AD', city: 'Pune', field: 'Photographer', rating: 4.7, reviews: 21, ig: 'arjun.frames', bio: 'Documentary and landscape photographer. Prints on cotton rag paper, signed and numbered.' },
    { id: 3, name: 'Naina Kapoor', init: 'NK', city: 'Jaipur', field: 'Ink illustrator', rating: 4.8, reviews: 16, ig: 'naina.inks', bio: 'Pen and ink studies of trees, birds and old havelis. Every drawing is on handmade Sanganer paper.' },
    { id: 4, name: 'Imran Sheikh', init: 'IS', city: 'Lucknow', field: 'Sculptor', rating: 4.6, reviews: 12, ig: 'imran.casts', bio: 'Casts small brass and terracotta figures using the lost-wax method taught by his grandfather.' },
    { id: 5, name: 'Tanvi Rao', init: 'TR', city: 'Bengaluru', field: 'Risograph printmaker', rating: 4.9, reviews: 44, ig: 'tanvi.riso', bio: 'Runs a two-colour risograph studio. Small editions, soy ink, every sheet hand-fed.' },
    { id: 6, name: 'Sourav Mondal', init: 'SM', city: 'Kolkata', field: 'Textile artist', rating: 4.8, reviews: 19, ig: 'sourav.kantha', bio: 'Contemporary kantha wall hangings stitched with a collective of nine women from Birbhum.' }
  ];

  /* each artwork: listings = [kind, price in rupees, stock, size/medium line] */
  var ARTWORKS = [
    { id: 1, title: 'Monsoon Over Marina', artist: 1, cat: 'Painting', year: 2025, seed: 3, style: 'horizon', ratio: '5/4', medium: 'Acrylic on canvas', listings: [['Original', 42000, 1, '60 × 90 cm'], ['Print', 2500, 50, 'A3 giclee, 300 gsm']], reel: true },
    { id: 2, title: 'Tide Pools, Gokarna', artist: 2, cat: 'Photography', year: 2024, seed: 8, style: 'bloom', ratio: '3/2', medium: 'Archival pigment print', listings: [['Print', 3800, 25, '12 × 18 in, cotton rag']] },
    { id: 3, title: 'Banyan, Ink No. 4', artist: 3, cat: 'Drawing & illustration', year: 2025, seed: 12, style: 'hatch', ratio: '4/5', medium: 'Ink on handmade paper', listings: [['Original', 12500, 1, '38 × 50 cm']] },
    { id: 4, title: 'Brass Heron', artist: 4, cat: 'Sculpture', year: 2025, seed: 5, style: 'orbit', ratio: '1/1', medium: 'Cast brass', listings: [['Original', 28000, 1, '32 cm tall, 2.1 kg']] },
    { id: 5, title: 'Riso Sunrise Series', artist: 5, cat: 'Prints & digital art', year: 2025, seed: 17, style: 'field', ratio: '4/5', medium: 'Two-colour risograph', listings: [['Print', 1800, 40, 'A4, edition of 40']] },
    { id: 6, title: 'Kantha Wall Hanging', artist: 6, cat: 'Crafts', year: 2025, seed: 21, style: 'hatch', ratio: '1/1', medium: 'Cotton thread on recycled sari', listings: [['Original', 9800, 1, '90 × 90 cm']] },
    { id: 7, title: 'Kolam at Dawn', artist: 1, cat: 'Painting', year: 2024, seed: 26, style: 'orbit', ratio: '1/1', medium: 'Acrylic on board', listings: [['Print', 2200, 30, 'A3 giclee'], ['Original', 31000, 1, '70 × 70 cm']] },
    { id: 8, title: 'Old Delhi Rooftops', artist: 2, cat: 'Photography', year: 2023, seed: 31, style: 'horizon', ratio: '3/2', medium: 'Archival pigment print', listings: [['Print', 4200, 20, '16 × 24 in']] },
    { id: 9, title: 'Peacock Study', artist: 3, cat: 'Drawing & illustration', year: 2024, seed: 35, style: 'hatch', ratio: '4/5', medium: 'Ink and gouache', listings: [['Original', 18000, 0, '45 × 60 cm']], sold: true },
    { id: 10, title: 'Terracotta Moon', artist: 4, cat: 'Sculpture', year: 2025, seed: 40, style: 'orbit', ratio: '1/1', medium: 'Fired terracotta', listings: [['Original', 15500, 1, '28 cm diameter']] },
    { id: 11, title: 'Chai Stall, Riso', artist: 5, cat: 'Prints & digital art', year: 2025, seed: 44, style: 'field', ratio: '4/5', medium: 'Two-colour risograph', listings: [['Print', 1500, 60, 'A4']] },
    { id: 12, title: 'Indigo Quilt No. 2', artist: 6, cat: 'Crafts', year: 2025, seed: 48, style: 'bloom', ratio: '5/4', medium: 'Indigo-dyed cotton, kantha stitch', listings: [['Original', 14200, 1, '120 × 100 cm']] }
  ];

  /* Screen registry. states: [key, label]. group + role drive the index page and the prev/next links. */
  function S(id, file, name, route, group, role, desc, states) { return { id: id, file: file, name: name, route: route, group: group, role: role, desc: desc, states: states || [['default', 'Default']] }; }
  var SCREENS = [
    S('S01', 'home.html', 'Home', '/', 'Storefront', 'Public', 'Landing page: hero hang, categories, featured Artworks, how it works, Artist call-out.'),
    S('S02', 'browse.html', 'Browse', '/browse', 'Storefront', 'Public', 'Filters, sorting, Artwork grid, pagination.', [['default', 'Results'], ['loading', 'Loading'], ['empty', 'No results']]),
    S('S03', 'artwork.html', 'Artwork', '/artwork/:id', 'Storefront', 'Public', 'Photos, video or reel, Listings, Artist card, Report.', [['default', 'Available'], ['sold', 'Original sold'], ['own', 'Viewed by its Artist'], ['cart-clash', 'Cart clash dialog']]),
    S('S04', 'artist-profile.html', 'Artist profile', '/artist/:id', 'Storefront', 'Public', 'Bio, rating, Instagram Showcase, Artworks, Reviews.', [['default', 'With Instagram'], ['no-instagram', 'No Instagram']]),
    S('S05', 'login.html', 'Log in', '/login', 'Account', 'Public', 'Google and email sign-in.', [['default', 'Default'], ['error', 'Wrong password']]),
    S('S06', 'signup.html', 'Sign up', '/signup', 'Account', 'Public', 'Create an Account.', [['default', 'Default'], ['error', 'Validation errors']]),
    S('S07', 'reset.html', 'Reset password', '/reset', 'Account', 'Public', 'Request a reset link.', [['default', 'Request'], ['sent', 'Link sent']]),
    S('S08', 'cart.html', 'Cart', '/cart', 'Buying', 'Buyer', 'One-Artist Cart, price check, order summary.', [['default', 'With items'], ['empty', 'Empty'], ['price-changed', 'Price changed']]),
    S('S09', 'checkout.html', 'Checkout', '/checkout', 'Buying', 'Buyer', 'Shipping address, Checkout Hold, pay.', [['default', 'Default'], ['error', 'Address errors'], ['expired', 'Hold expired']]),
    S('S10', 'payment-modal.html', 'Payment', 'Payment window', 'Buying', 'Buyer', 'The secure payment window: card, UPI, success and failure.', [['card', 'Card'], ['upi', 'UPI'], ['success', 'Success'], ['failed', 'Failed']]),
    S('S11', 'order-placed.html', 'Order placed', '/orders/:id?placed', 'Buying', 'Buyer', 'Confirmation after payment.'),
    S('S12', 'orders.html', 'My orders', '/orders', 'Buying', 'Buyer', 'Order history with stages.', [['default', 'Orders'], ['empty', 'None yet']]),
    S('S13', 'order-detail.html', 'Order detail', '/orders/:id', 'Buying', 'Buyer', 'Stage timeline, Artist, address, Received, Damage Report, Review.', [['paid', 'Paid'], ['shipped', 'Shipped'], ['received', 'Received'], ['refunded', 'Refunded']]),
    S('S14', 'damage-report.html', 'Damage Report', '/orders/:id/damage', 'Buying', 'Buyer', 'Report a damaged parcel with photos.', [['default', 'Form'], ['submitted', 'Submitted']]),
    S('S15', 'review.html', 'Write a Review', '/orders/:id/review', 'Buying', 'Buyer', 'Rate the Artist once per Order.', [['default', 'Form'], ['closed', 'Window closed']]),
    S('S16', 'profile.html', 'Profile', '/profile', 'Account', 'Buyer', 'Edit name, photo, bio, saved address.'),
    S('S17', 'notifications.html', 'Notifications', '/notifications', 'Account', 'Buyer', 'All in-app notifications.', [['default', 'List'], ['empty', 'Empty']]),
    S('S18', 'become-artist.html', 'Become an Artist', '/become-artist', 'Account', 'Buyer', 'Artist Verification, phone check, Onboarding Fee.', [['step1', 'Details'], ['step2', 'Phone check'], ['step3', 'Onboarding Fee'], ['done', 'Done']]),
    S('S19', 'legal.html', 'Legal pages', '/legal/*', 'Account', 'Public', 'Terms, privacy, refund policy, Artist agreement, data deletion.'),
    S('S20', 'not-found.html', 'Not found', '*', 'Account', 'Public', '404 page.'),
    S('S21', 'dash-home.html', 'Dashboard overview', '/dashboard', 'Artist dashboard', 'Artist', 'To-do, sales, next Payout, Amount Owed.', [['default', 'Normal'], ['owed', 'Amount Owed'], ['restricted', 'Restricted']]),
    S('S22', 'dash-artworks.html', 'My Artworks', '/dashboard/artworks', 'Artist dashboard', 'Artist', 'Artworks and their Listings.', [['default', 'List'], ['empty', 'None yet']]),
    S('S23', 'dash-artwork-edit.html', 'Artwork editor', '/dashboard/artworks/:id', 'Artist dashboard', 'Artist', 'Details, photos, video or reel, Listings.', [['default', 'Editing'], ['errors', 'Validation errors']]),
    S('S24', 'dash-orders.html', 'Order inbox', '/dashboard/orders', 'Artist dashboard', 'Artist', 'Orders to ship, shipped, received.', [['default', 'Inbox'], ['empty', 'Empty']]),
    S('S25', 'dash-order-detail.html', 'Order (Artist view)', '/dashboard/orders/:id', 'Artist dashboard', 'Artist', 'Address, lines, mark Shipped.', [['paid', 'To ship'], ['shipped', 'Shipped']]),
    S('S26', 'dash-payouts.html', 'Payouts', '/dashboard/payouts', 'Artist dashboard', 'Artist', 'Payout statements, upcoming Payable Orders, Amount Owed.', [['default', 'Normal'], ['owed', 'Amount Owed']]),
    S('S27', 'dash-instagram.html', 'Instagram', '/dashboard/instagram', 'Artist dashboard', 'Artist', 'Connect, pick posts, Showcase, paste links.', [['disconnected', 'Not connected'], ['connected', 'Connected'], ['picker', 'Picking posts'], ['lapsed', 'Token lapsed'], ['disabled', 'Connect off (links only)']]),
    S('S28', 'dash-settings.html', 'Artist settings', '/dashboard/settings', 'Artist dashboard', 'Artist', 'Verification status, payout details, notifications.'),
    S('S29', 'admin-dashboard.html', 'Admin overview', '/admin', 'Admin', 'Admin', 'Orders, sales, Commission, queues at a glance.'),
    S('S30', 'admin-queues.html', 'Queues', '/admin/queues', 'Admin', 'Admin', 'Damage Reports, Overdue, Reviews, Reports, Verification.'),
    S('S31', 'admin-orders.html', 'Orders (Admin)', '/admin/orders', 'Admin', 'Admin', 'All Orders, filters, Refund per Order Line.'),
    S('S32', 'admin-payout-run.html', 'Payout run', '/admin/payouts', 'Admin', 'Admin', 'Draft Payout list for the 1st or 15th; record transfers.', [['default', 'Draft'], ['sent', 'Recorded']]),
    S('S33', 'admin-artists.html', 'Artists (Admin)', '/admin/artists', 'Admin', 'Admin', 'Artist list, Verification, Restriction.'),
    S('S34', 'admin-settings.html', 'Settings (Admin)', '/admin/settings', 'Admin', 'Admin', 'Commission, Onboarding Fee, Instagram switch.'),
    S('S35', 'emails.html', 'Emails', 'Email', 'Admin', 'System', 'The three launch emails.'),
    S('S36', 'components.html', 'UI kit', 'Design system', 'Design system', 'System', 'Every component in every state: buttons, forms, badges, alerts, tables, tabs, dialogs, art cards.')
  ];

  return { CATS: CATS, ARTISTS: ARTISTS, ARTWORKS: ARTWORKS, SCREENS: SCREENS };
})();
