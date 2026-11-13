import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../../api/gateway';
import { FIELD_TEXT } from '../../lib/format';
import { Icon } from '../common/Icon';
import { RateInput } from '../ui/RateInput';

const MAX = 500;
const CHIPS = ['Packed well.', 'As described.', 'Fast shipping.', 'Good communication.'];
const REASON_VIEW = { window_closed: 'closed', already_exists: 'reviewed', wrong_stage: 'stage', not_found: 'notfound' };
const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Adds the chip's sentence to the end of the text, or takes it out again. */
const addSentence = (text, s) => (text.trim() ? `${text.trimEnd()} ${s}` : s);
const dropSentence = (text, s) => text.replace(new RegExp(`\\s?${escape(s)}`), '').trim();

/**
 * The Review form for one received Order. onDone gets { status: 'sent' } or, when the server says the form no longer applies,
 * { status: 'closed' | 'reviewed' | 'stage' | 'notfound' } so the page can show that view.
 */
export function ReviewForm({ order, artist, onDone, onOpen }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  useEffect(() => onOpen?.(), []); // eslint-disable-line react-hooks/exhaustive-deps -- once, when the form first shows

  const send = async (e) => {
    e.preventDefault();
    if (sending.current) return;
    const next = {};
    if (!rating) next.rating = FIELD_TEXT.rating;
    if (!text.trim()) next.comment = FIELD_TEXT.comment;
    setErrors(next);
    if (Object.keys(next).length) return;
    sending.current = true;
    setBusy(true);
    setNotice('');
    const res = await call('submitReview', { orderId: order.id, rating, comment: text.trim() });
    sending.current = false;
    setBusy(false);
    if (res.ok) return onDone({ status: 'sent' });
    const err = res.error;
    const view = err.code === 'forbidden' ? 'notfound' : err.code === 'conflict' ? REASON_VIEW[err.reason] : null;
    if (view) return onDone({ status: view });
    if (err.code === 'invalid' && err.fields?.length) setErrors(Object.fromEntries(err.fields.map((f) => [f, FIELD_TEXT[f]])));
    else setNotice('We couldn’t send your Review. Try again.');
    return undefined;
  };

  return (
    <form className="stack lg" onSubmit={send} noValidate>
      <section className="panel stack">
        <div className={`field${errors.rating ? ' has-error' : ''}`}>
          <span className="label" id="rate-l">Your rating <span className="req" aria-hidden="true">*</span></span>
          <RateInput value={rating} onChange={(n) => { setRating(n); setErrors((x) => ({ ...x, rating: undefined })); }} labelledBy="rate-l" disabled={busy} />
          <span className="small muted" id="rate-v" aria-live="polite">{rating ? `${rating} of 5` : ''}</span>
          {errors.rating && <span className="error-msg"><Icon name="alert" size={14} />{errors.rating}</span>}
        </div>
        <div className={`field${errors.comment ? ' has-error' : ''}`}>
          <label htmlFor="rc">Your Review <span className="req" aria-hidden="true">*</span></label>
          <textarea className="textarea" id="rc" maxLength={MAX} style={{ minHeight: 150 }} value={text} disabled={busy} aria-required="true"
            aria-invalid={errors.comment ? true : undefined} aria-describedby="rc-h rc-c"
            placeholder="Was it as described? How was the packing? Did the Artist keep you updated?"
            onChange={(e) => { setText(e.target.value); setErrors((x) => ({ ...x, comment: undefined })); }} />
          <div className="row between"><span className="hint" id="rc-h">Don’t include your address, phone number or links.</span><span className="counter" id="rc-c">{text.length} / {MAX}</span></div>
          {errors.comment && <span className="error-msg"><Icon name="alert" size={14} />{errors.comment}</span>}
        </div>
        <div className="stack sm"><span className="label" id="chips-l">Good things to mention</span>
          <div className="chips" role="group" aria-labelledby="chips-l">
            {CHIPS.map((s) => {
              const pressed = text.includes(s);
              const full = !pressed && addSentence(text, s).length > MAX;
              return (
                <button key={s} type="button" className="chip" aria-pressed={pressed} disabled={busy || full}
                  onClick={() => setText(pressed ? dropSentence(text, s) : addSentence(text, s))}>{s.slice(0, -1)}</button>
              );
            })}
          </div>
          <span className="hint">Picks are added to the end of your Review.</span></div>
      </section>
      <div className="alert info"><Icon name="info" /><div>Your Review appears on {artist}’s profile after CraftMe approves it. You can’t edit it once sent.</div></div>
      {notice && <div className="alert err" role="alert"><Icon name="alert" /><div>{notice}</div></div>}
      <div className="row end">
        <Link className="btn btn-ghost" to="/orders">Cancel</Link>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send Review'}</button>
      </div>
    </form>
  );
}
