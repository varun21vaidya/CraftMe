import { useState } from 'react';
import { Icon } from '../common/Icon';
import { rejectionText, validateFiles } from '../../lib/uploads';

const MAX = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png';

/**
 * The work's photos in order: saved ones (url) and new ones (file, shown from an object URL; uploaded when the form is saved).
 * photos: [{ id, url, file? }]. The first is the cover. Every control is a real button, so the order can be changed by keyboard.
 */
export function PhotoManager({ photos, onChange, disabled = false, error }) {
  const [refused, setRefused] = useState([]);
  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (p) => { if (p.file) URL.revokeObjectURL(p.url); setRefused([]); onChange(photos.filter((x) => x.id !== p.id)); };
  const add = (list) => {
    const { ok, rejected } = validateFiles([...list], { accept: ACCEPT, maxBytes: MAX_BYTES, maxFiles: MAX, have: photos.length });
    setRefused(rejected.map((r) => rejectionText(r, { maxBytes: MAX_BYTES, maxFiles: MAX })));
    if (ok.length) onChange([...photos, ...ok.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  };

  return (
    <div className="field" id="ed-photos" tabIndex={-1}>
      <span className="label" id="ed-photos-l">Photos <span className="req" aria-hidden="true">*</span></span>
      <p className="small muted" id="ed-photos-count">{photos.length} of {MAX} added. The first photo is the cover.</p>
      {photos.length > 0 && (
        <ul className="photo-grid" aria-labelledby="ed-photos-l">
          {photos.map((p, i) => (
            <li key={p.id}>
              <img src={p.url} alt={`Photo ${i + 1}`} width="120" height="120" style={{ objectFit: 'cover', borderRadius: 8 }} />
              {i === 0 && <span className="badge accent">Cover</span>}
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="iconbtn" aria-label={`Move photo ${i + 1} earlier`} disabled={disabled || i === 0} onClick={() => move(i, -1)}><Icon name="chevron-left" size={16} /></button>
                <button type="button" className="iconbtn" aria-label={`Move photo ${i + 1} later`} disabled={disabled || i === photos.length - 1} onClick={() => move(i, 1)}><Icon name="chevron-right" size={16} /></button>
                <button type="button" className="iconbtn" aria-label={`Remove photo ${i + 1}`} disabled={disabled} onClick={() => remove(p)}><Icon name="trash" size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {photos.length < MAX && (
        <label className={`dropzone${disabled ? ' off' : ''}`}>
          <Icon name="upload" size={26} />
          <strong>Drop photos here or choose files</strong>
          <span className="small">Up to {MAX} · JPEG or PNG · 5 MB each</span>
          <input type="file" multiple accept={ACCEPT} disabled={disabled} aria-label="Choose photos" aria-describedby="ed-photos-count"
            onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </label>
      )}
      {refused.length > 0 && <ul className="list small" role="alert">{refused.map((r) => <li key={r} className="error-msg">{r}</li>)}</ul>}
      {error && <span className="error-msg"><Icon name="alert" size={14} />{error}</span>}
    </div>
  );
}
