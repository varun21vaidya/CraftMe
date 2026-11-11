import { useEffect, useRef, useState } from 'react';
import { reelCode, reelEmbedUrl } from '../lib/reels';
import { Icon } from './common/Icon';

const MIN_EMBED = 326; // Instagram's embed is blank below this width
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
  const code = reelCode(reel.url);

  useEffect(() => { if (!active) setOpen(false); }, [active]);
  useEffect(() => {
    setSlow(false);
    if (!open) return undefined;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [open]);

  if (!code) return null; // the database rejects other links; never render one

  const play = () => {
    // too narrow for the embed: go straight to Instagram
    if ((frame.current?.clientWidth || 0) < MIN_EMBED) window.open(reel.url, '_blank', 'noopener,noreferrer');
    else setOpen(true);
  };

  return (
    <figure className={`reel${fill ? ' fill' : ' panel'}`}>
      {reel.title && !fill && <strong>{reel.title}</strong>}
      <div className="reel-frame" ref={frame}>
        {open ? (
          <iframe src={reelEmbedUrl(code)} title={reel.title || 'Instagram reel'} allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <>
            {reel.cover && <img src={reel.cover} alt="" loading="lazy" />}
            <button type="button" className="reel-play" aria-label={`Play reel${reel.title ? `: ${reel.title}` : ''}`} onClick={play}>
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
