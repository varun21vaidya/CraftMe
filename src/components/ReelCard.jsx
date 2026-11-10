import { useState } from 'react';
import { reelCode, reelEmbedUrl } from '../lib/reels';

/** An Artist's reel. Nothing loads from Instagram until the visitor taps Watch. */
export default function ReelCard({ reel }) {
  const [open, setOpen] = useState(false);
  const code = reelCode(reel.url);
  if (!code) return null; // the database rejects other links; never render one

  return (
    <figure className="panel stack sm" style={{ margin: 0 }}>
      {reel.cover && !open && <img src={reel.cover} alt="" loading="lazy" style={{ maxWidth: '100%', borderRadius: 8 }} />}
      {open
        ? <iframe src={reelEmbedUrl(code)} title="Instagram reel" width="100%" height="520" loading="lazy"
            allow="encrypted-media; autoplay" style={{ border: 0, maxWidth: '100%' }} />
        : <button type="button" className="btn btn-secondary btn-block" onClick={() => setOpen(true)}>Watch this reel on Instagram</button>}
      <figcaption className="small faint">
        {reel.verified ? 'Verified on Instagram' : 'Added by the Artist'} · <a href={reel.url} target="_blank" rel="noopener noreferrer nofollow">Open on Instagram</a>
      </figcaption>
    </figure>
  );
}
