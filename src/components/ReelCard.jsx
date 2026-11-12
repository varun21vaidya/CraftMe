import { useEffect, useRef, useState } from 'react';
import { reelCode, reelEmbedUrl } from '../lib/reels';
import { Icon } from './common/Icon';

// Instagram's player is laid out for at least 326px wide and about 760px high (header, video, footer).
// It is drawn at that size and scaled down to fit the frame, so it never needs a scrollbar and never needs a wide screen.
const EMBED_W = 326;
const EMBED_H = 760;
const SLOW_MS = 6000;

/**
 * An Artist's reel: the cover with a Play button. Nothing loads from Instagram until Play is pressed, and
 * "Open on Instagram" is always there, because the embed can stay blank in browsers that block third-party frames.
 * fill = fills its parent (a carousel slide); active = false removes the player (the slide scrolled away).
 */
export default function ReelCard({ reel, fill = false, active = true }) {
  const [open, setOpen] = useState(false);
  const [slow, setSlow] = useState(false);
  const frame = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const code = reelCode(reel.url);

  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => {
    setSlow(false);
    if (!open) return undefined;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = frame.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (!window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!code) return null; // the database rejects other links; never render one

  const scale = Math.min(box.w / EMBED_W, box.h / EMBED_H, 1.5) || 1;
  const player = { width: EMBED_W, height: EMBED_H, left: '50%', top: Math.max((box.h - EMBED_H * scale) / 2, 0), transform: `translateX(-50%) scale(${scale})`, transformOrigin: 'top center' };

  return (
    <figure className={`reel${fill ? ' fill' : ' panel'}`}>
      {reel.title && !fill && <strong>{reel.title}</strong>}
      <div className="reel-frame" ref={frame}>
        {open ? (
          <iframe src={reelEmbedUrl(code)} title={reel.title || 'Instagram reel'} style={player} allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <>
            {reel.cover && <img src={reel.cover} alt="" loading="lazy" />}
            <button type="button" className="reel-play" aria-label={`Play reel${reel.title ? `: ${reel.title}` : ''}`} onClick={() => setOpen(true)}>
              <Icon name="play" size={30} />
            </button>
            {!reel.cover && <span className="reel-label">Reel</span>}
          </>
        )}
      </div>
      <figcaption className="reel-bar small faint">
        <span>{slow ? 'Trouble playing? Open it on Instagram.' : reel.verified ? 'Verified on Instagram' : 'Added by the Artist'}</span>
        <a className="btn btn-secondary btn-sm" href={reel.url} target="_blank" rel="noopener noreferrer nofollow">Open on Instagram</a>
      </figcaption>
    </figure>
  );
}
