import { useEffect, useRef, useState } from 'react';
import { rejectionText, validateFiles } from '../../lib/uploads';
import { Icon } from '../common/Icon';

const MB = 1024 * 1024;

/**
 * Photo picker with previews. `files` is the list of items { id, file, url, status, error? } and onChange gets the next list;
 * the page owns the upload itself (src/lib/uploads.js). A wrong type, an oversize file or one past maxFiles is refused with a line
 * naming it; the accepted files of the same batch are kept. onRetry(item) draws "Try again" on a failed photo.
 */
export function Dropzone({ files, onChange, accept = 'image/jpeg,image/png', maxFiles = 6, maxBytes = 5 * MB, disabled = false, onRetry, hint, describedBy }) {
  const [refused, setRefused] = useState([]);
  const [over, setOver] = useState(false);
  const latest = useRef(files);
  latest.current = files;
  useEffect(() => () => latest.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const add = (list) => {
    const { ok, rejected } = validateFiles([...list], { accept, maxBytes, maxFiles, have: files.length });
    setRefused(rejected.map((r) => rejectionText(r, { maxBytes, maxFiles })));
    if (ok.length) onChange([...files, ...ok.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'queued' }))]);
  };
  const remove = (item) => {
    URL.revokeObjectURL(item.url);
    setRefused([]);
    onChange(files.filter((f) => f.id !== item.id));
  };
  const size = Math.round(maxBytes / MB);

  return (
    <>
      <label className={`dropzone${over ? ' over' : ''}${disabled ? ' off' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) add(e.dataTransfer.files); }}>
        <Icon name="upload" size={26} />
        <strong>Drop photos here or choose files</strong>
        <span className="small">{hint || `Up to ${maxFiles} · JPEG or PNG · ${size} MB each`}</span>
        <input type="file" multiple accept={accept} disabled={disabled} aria-label="Choose photos" aria-describedby={describedBy}
          onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </label>
      {refused.length > 0 && <div role="alert" className="stack sm">{refused.map((t) => <span key={t} className="error-msg"><Icon name="alert" size={14} />{t}</span>)}</div>}
      {files.length > 0 && (
        <div className="dz-previews" role="list" aria-label="Chosen photos">
          {files.map((f, i) => (
            <div key={f.id} role="listitem" className={`thumb${f.status === 'failed' ? ' bad' : ''}`}>
              <img src={f.url} alt={`Photo ${i + 1}: ${f.file.name}`} />
              {!disabled && <button type="button" className="x" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(f)}><Icon name="x" size={14} /></button>}
              {f.status === 'uploading' && <span className="st">Uploading…</span>}
              {f.status === 'done' && <span className="st"><Icon name="check" size={12} />Uploaded</span>}
              {f.status === 'failed' && <span className="st">Didn’t upload{onRetry && <button type="button" onClick={() => onRetry(f)}>Try again</button>}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
