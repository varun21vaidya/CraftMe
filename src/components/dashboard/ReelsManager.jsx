import { useState } from 'react';
import { deleteReel, saveReel, upload, useReels } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { errorText } from '../../lib/format';
import { reelCode, reelLabel } from '../../lib/reels';
import { InstagramConnect } from './InstagramConnect';

// Limits match the database (migrations/0008_reels.sql); the messages below explain the database's refusal.
const MAX_REELS = 12;
const MAX_HIGHLIGHT = 6;
const REASONS = {
  reel_limit: `You can add up to ${MAX_REELS} reels. Remove one to add another.`,
  highlight_limit: `You can highlight up to ${MAX_HIGHLIGHT} reels. Unhighlight one first.`,
};

export function ReelsManager() {
  const { currentUser } = useAuth();
  const uid = currentUser.uid;
  const [reels, loading, , reload] = useReels(uid, { mine: true });
  const [url, setUrl] = useState('');
  const [owned, setOwned] = useState(false);
  const [cover, setCover] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const explain = (res) => setMsg(REASONS[res.error?.reason] || errorText(res.error));
  const list = reels || [];
  const highlighted = list.filter((r) => r.highlighted).length;

  const add = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!reelCode(url)) return setMsg('Paste a link like instagram.com/reel/…');
    if (!owned) return setMsg('Tick the box to confirm this reel is yours or you have permission to show it.');
    setBusy(true);
    let coverUrl = null;
    if (cover) {
      const up = await upload('artworks', cover, uid);
      if (!up.ok) { setBusy(false); return explain(up); }
      coverUrl = up.url;
    }
    // highest position + 1, so positions stay unique even after a delete (the arrows swap positions)
    const position = list.reduce((m, r) => Math.max(m, r.position + 1), 0);
    const res = await saveReel(uid, { url: url.trim(), ownerConfirmed: true, cover: coverUrl, position, title: title.trim() || null });
    setBusy(false);
    if (!res.ok) return explain(res);
    setUrl(''); setTitle(''); setOwned(false); setCover(null); setMsg('Reel added.');
    return reload();
  };

  const update = async (reel, fields) => {
    setMsg(null);
    const res = await saveReel(uid, fields, reel.id);
    if (!res.ok) explain(res);
    return res.ok;
  };

  const rename = async (reel, value) => {
    const next = value.trim() || null;
    if (next === (reel.title || null)) return;
    await update(reel, { title: next });
    reload();
  };

  const toggleHighlight = async (reel) => {
    await update(reel, { highlighted: !reel.highlighted });
    reload();
  };

  // Swap positions with the neighbour, so the order on the artist page follows the arrows.
  const move = async (index, dir) => {
    const a = list[index];
    const b = list[index + dir];
    if (!b) return;
    if (await update(a, { position: b.position })) await update(b, { position: a.position });
    reload();
  };

  const remove = async (reel) => {
    if (!window.confirm('Remove this reel? It will also be unlinked from any product.')) return;
    const res = await deleteReel(reel.id);
    if (!res.ok) setMsg(errorText(res.error));
    reload();
  };

  return (
    <div className="stack">
      <InstagramConnect onChanged={reload} />
    <section className="panel stack" aria-labelledby="reels-title">
      <div>
        <h2 id="reels-title">Your reels</h2>
        <p className="small muted">
          {list.length} of {MAX_REELS} added · {highlighted} of {MAX_HIGHLIGHT} highlighted. Highlighted reels show on your page, in the order below.
        </p>
      </div>

      {loading && <div className="skeleton" style={{ height: 48 }} aria-busy="true" />}
      {!loading && list.length === 0 && <p className="small muted">No reels yet. Paste a link from Instagram below.</p>}
      {list.map((r, i) => (
        <div key={r.id} className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {r.cover
            ? <img src={r.cover} alt="" width="48" height="64" loading="lazy" style={{ objectFit: 'cover', borderRadius: 6 }} />
            : <span className="skeleton" style={{ width: 48, height: 64, borderRadius: 6, display: 'inline-block' }} aria-hidden="true" />}
          <div className="stack sm" style={{ flex: '1 1 200px', minWidth: 0 }}>
            <input className="input" aria-label="Reel name" placeholder={reelLabel(r)} defaultValue={r.title || ''}
              maxLength={80} onBlur={(e) => rename(r, e.target.value)} />
            <a className="small" href={r.url} target="_blank" rel="noopener noreferrer nofollow" style={{ overflowWrap: 'anywhere' }}>
              Open on Instagram{r.verified ? ' · verified' : ''}
            </a>
          </div>
          <button className={`btn btn-sm ${r.highlighted ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={r.highlighted}
            onClick={() => toggleHighlight(r)}>
            {r.highlighted ? 'Highlighted' : 'Highlight'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
          <button className="btn btn-secondary btn-sm" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down">↓</button>
          <button className="btn btn-secondary btn-sm" onClick={() => remove(r)}>Remove</button>
        </div>
      ))}

      <form className="stack sm" onSubmit={add} noValidate>
        <div className="field">
          <label htmlFor="reel-url">Reel link</label>
          <input id="reel-url" className="input" placeholder="https://www.instagram.com/reel/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="reel-title">Name <span className="opt">optional, helps you tell reels apart</span></label>
          <input id="reel-title" className="input" maxLength={80} placeholder="e.g. Making of the blue vase" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="reel-cover">Cover picture <span className="opt">optional, JPEG or PNG</span></label>
          <input id="reel-cover" type="file" accept="image/jpeg,image/png" onChange={(e) => setCover(e.currentTarget.files[0] || null)} />
          <span className="hint">Shown before the reel plays. Without one, the reel shows as a plain card.</span>
        </div>
        <label className="row small" style={{ gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
          <span>This reel is mine, or I have permission to show it on CraftMe.</span>
        </label>
        {msg && <p className="alert info" role="status">{msg}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy || list.length >= MAX_REELS}>{busy ? 'Adding…' : 'Add reel'}</button>
      </form>
    </section>
    </div>
  );
}
