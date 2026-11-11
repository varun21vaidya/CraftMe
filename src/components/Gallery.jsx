import { useEffect, useRef, useState } from 'react';
import { slideFromScroll, step } from '../lib/gallery';
import { Icon } from './common/Icon';
import ReelCard from './ReelCard';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A work's photos (and its reel, last) as one swipeable carousel. The whole photo is always visible
 * (the frame is at most about 65% of the screen high), never cropped. One slide shows no controls.
 */
export default function Gallery({ photos = [], title, reel }) {
  const slides = [...photos.map((src) => ({ type: 'photo', src })), ...(reel ? [{ type: 'reel', reel }] : [])];
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [bad, setBad] = useState({});
  const track = useRef(null);
  const at = useRef(0);
  at.current = index;

  const goTo = (i) => {
    const el = track.current;
    if (!el) return;
    const to = step(i, 0, count);
    setIndex(to);
    el.scrollTo({ left: to * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const onScroll = (e) => setIndex(slideFromScroll(e.currentTarget.scrollLeft, e.currentTarget.clientWidth));
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(step(index, -1, count)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(step(index, 1, count)); }
  };

  // keep the same slide in view when the window or phone is resized or rotated
  useEffect(() => {
    const keep = () => { const el = track.current; if (el) el.scrollTo({ left: at.current * el.clientWidth, behavior: 'auto' }); };
    window.addEventListener('resize', keep);
    return () => window.removeEventListener('resize', keep);
  }, []);
  // load the next photo before it is needed
  useEffect(() => {
    const next = slides[index + 1];
    if (next?.type === 'photo') new Image().src = next.src;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slides is rebuilt every render; index says when it matters
  }, [index]);

  if (count === 0) {
    return <div className="gal-track gal-empty"><span className="muted">{title}</span></div>;
  }

  const thumb = (s, i) => (s.type === 'photo' ? (bad[i] ? null : <img src={s.src} alt="" loading="lazy" />) : <Icon name="play" size={22} />);

  return (
    <div className="gal" role="region" aria-roledescription="carousel" aria-label={`${title}, photos`} tabIndex={0} onKeyDown={onKey}>
      <div className="gal-frame">
        <div className="gal-track" ref={track} onScroll={onScroll}>
          {slides.map((s, i) => (
            <div className={`gal-slide${s.type === 'reel' ? ' reel-slide' : ''}`} key={s.type === 'photo' ? `${s.src}-${i}` : 'reel'} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              {s.type === 'reel'
                ? <ReelCard reel={s.reel} fill active={index === i} />
                : bad[i]
                  ? <span className="muted">Photo unavailable</span>
                  : <img src={s.src} alt={`${title}, photo ${i + 1}`} loading={i < 2 ? 'eager' : 'lazy'} onError={() => setBad((b) => ({ ...b, [i]: true }))} />}
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" className="gal-nav prev" aria-label="Previous photo" disabled={index === 0} onClick={() => goTo(step(index, -1, count))}>
              <Icon name="chevron-left" size={22} />
            </button>
            <button type="button" className="gal-nav next" aria-label="Next photo" disabled={index === count - 1} onClick={() => goTo(step(index, 1, count))}>
              <Icon name="chevron-right" size={22} />
            </button>
            <span className="gal-count" aria-hidden="true">{index + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <>
          <div className="gal-dots" aria-hidden="true">{slides.map((_, i) => <span key={i} className={i === index ? 'on' : ''} />)}</div>
          <div className="gal-thumbs">
            {slides.map((s, i) => (
              <button type="button" key={i} className="gal-thumb" aria-label={s.type === 'reel' ? 'Show the reel' : `Show photo ${i + 1}`}
                aria-current={i === index} onClick={() => goTo(i)}>{thumb(s, i)}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
