import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBrowse, useSwitches } from '../api/gateway';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { GROUPS } from '../lib/categories';
import { RULES } from '../lib/rules';

const GROUP_LINES = {
  'Art': 'Paintings, drawings, digital art, photography and prints.',
  'Handmade Crafts': 'Crochet, textiles, wood, metal, pottery and sculpture.',
  'Jewellery & Accessories': 'Jewellery, bag charms and keychains.',
  'Festive & Home Decor': 'Rangoli, wall hangings, diyas and gifts.',
  'DIY Kits': 'Everything to make a piece yourself.',
};
const STEPS = [
  ['Pay for your Order', 'Pay securely by card, UPI or netbanking.'],
  ['Get it from the artist', `The artist posts it within ${RULES.shipDays} days. Shipping within India is included.`],
  ['Confirm it arrived', 'Tap Received when it is in your hands, then review the artist.'],
];
const FAQ = [
  ['Who posts my Order?', `The artist who made it, within ${RULES.shipDays} days of payment.`],
  ['Can I cancel an Order?', 'Not once it is Paid. Write to CraftMe and we will ask the artist.'],
  ['Can I buy from two artists at once?', 'Each Order is one parcel from one artist, so a Cart holds one artist’s work.'],
  ['Do you ship outside India?', 'No. CraftMe ships within India only.'],
  ['Are the Reviews real?', 'Only Buyers whose Order was Received can review an artist, and CraftMe approves every Review.'],
];

/** The landing page. A tinted block stands in for any image that doesn't load, so the layout never breaks. */
export default function Home() {
  const [data] = useBrowse({ q: '', sort: 'new', page: 0 });
  const [switches] = useSwitches();
  const { hash } = useLocation();
  // the browser can't scroll to a section that React hasn't drawn yet, so do it once it has
  useEffect(() => { if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(); }, [hash]);
  const [group, setGroup] = useState(Object.keys(GROUPS)[0]);
  const sell = switches?.acceptArtists === true;
  const items = data?.items || [];
  const featured = items.find((a) => a.available) || items[0];
  const forGroup = (g) => items.find((a) => GROUPS[g].includes(a.category)) || featured;
  const shown = forGroup(group);
  const pic = (art, ratio) => (art?.photos?.[0]
    ? <LazyLoadImage src={art.photos[0]} alt={art.title} width="100%" style={{ aspectRatio: ratio, objectFit: 'cover' }} />
    : <div className="tint" style={{ aspectRatio: ratio }} aria-hidden="true" />);

  return (
    <main className="home">
      <section className="home-hero wrap" aria-labelledby="hero-h">
        <div className="stack lg">
          <h1 id="hero-h">Original art from Indian artists</h1>
          <p className="lead">Paintings, prints, sculpture and crafts, each posted by the artist who made it. Shipping within India is included.</p>
          <div className="row">
            <Link className="btn btn-primary btn-lg" to="/browse">Browse art</Link>
            {sell && <Link className="btn btn-secondary btn-lg" to="/become-artist">Sell your art</Link>}
          </div>
        </div>
        <div className="home-hero-img mat">{pic(featured, '4 / 3')}</div>
      </section>

      <section className="home-section wrap" id="range" aria-labelledby="range-h">
        <h2 id="range-h">Art in {Object.keys(GROUPS).length} categories</h2>
        <div className="home-range">
          <ul className="home-rows">
            {Object.keys(GROUPS).map((g) => (
              <li key={g} tabIndex={0} onMouseEnter={() => setGroup(g)} onFocus={() => setGroup(g)}>
                <div><strong>{g}</strong><p className="muted">{GROUP_LINES[g]}</p></div>
                <Link to={`/browse?group=${encodeURIComponent(g)}`} aria-label={`Browse ${g}`}>Browse</Link>
              </li>
            ))}
          </ul>
          <div className="home-range-img mat">{pic(shown, '1 / 1')}</div>
        </div>
      </section>

      <section className="home-section wrap" id="buy" aria-labelledby="buy-h">
        <div className="split">
          <div className="stack">
            <h2 id="buy-h">Buy the Original, or a print of it</h2>
            <p className="muted">An Artwork can come as an Original, a print run, or both. An Original is one of a kind, and it stays on the wall marked Sold once it goes.</p>
            <Link className="link" to="/browse?kind=original">Browse Originals</Link>
          </div>
          <div className="mat">{pic(items.find((a) => a.kinds?.includes('original')) || featured, '4 / 3')}</div>
        </div>
      </section>

      <section className="home-section wrap" id="how" aria-labelledby="how-h">
        <h2 id="how-h">Buying in 3 steps</h2>
        <ol className="home-steps">
          {STEPS.map(([title, text], i) => <li key={title} className="panel stack sm"><span className="step-num">{i + 1}</span><h3>{title}</h3><p className="muted">{text}</p></li>)}
        </ol>
      </section>

      <section className="home-section wrap" id="questions" aria-labelledby="questions-h">
        <div className="split">
          <div className="stack"><h2 id="questions-h">Questions about buying</h2><Link className="link" to="/legal/refunds">Read the refund policy</Link></div>
          <div className="stack">{FAQ.map(([q, a]) => <div key={q}><h3>{q}</h3><p className="muted">{a}</p></div>)}</div>
        </div>
      </section>

      {sell && (
        <section className="home-section wrap" id="artists" aria-labelledby="artists-h">
          <div className="panel stack">
            <h2 id="artists-h">Sell your art on CraftMe</h2>
            <p className="muted">Set your own prices, get paid twice a month, and show your reels from Instagram.</p>
            <div><Link className="btn btn-primary" to="/become-artist">Start selling</Link></div>
          </div>
        </section>
      )}

      <section className="home-band">
        <div className="wrap row between">
          <h2>Find something made by hand.</h2>
          <Link className="btn btn-primary btn-lg" to="/browse">Browse art</Link>
        </div>
      </section>
    </main>
  );
}
