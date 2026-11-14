import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { call, deleteReel, endListing, removeUploads, reopenListing, saveArtwork, saveReel, upload, useOnboarding, useReels, useWork } from '../api/gateway';
import { Icon } from '../components/common/Icon';
import { ListingDialog } from '../components/dashboard/ListingDialog';
import { PhotoManager } from '../components/dashboard/PhotoManager';
import { PublishPanel } from '../components/dashboard/PublishPanel';
import { VideoPicker } from '../components/dashboard/VideoPicker';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Dialog } from '../components/ui/Dialog';
import { Field } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { GROUPS } from '../lib/categories';
import { errorText, formatINR } from '../lib/format';
import { reelCode } from '../lib/reels';
import { KIND_SHORT, listingLine, PROBLEM_TEXT, publishProblems, STATUS_BADGE, storagePath, validateDetails, workStatus } from '../lib/works';
import NotFound from './NotFound';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED = [['back', 'On the back'], ['front', 'On the front'], ['unsigned', 'Unsigned']];
const FIELD_ID = { title: 'ed-title', photos: 'ed-photos', listings: 'ed-listings' };
const clock = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** S23: one editor for a new work and an existing one. Files upload when the form is saved; the row is written next; dropped files go last. */
function EditorForm({ work, reload }) {
  const { currentUser, profile } = useAuth();
  const uid = currentUser.uid;
  const toast = useToast();
  const navigate = useNavigate();
  const here = useLocation();
  const [reels] = useReels(uid, { mine: true });
  const [onboarding] = useOnboarding(uid);
  const listings = work?.listings || [];
  const restricted = Boolean(profile?.restricted);

  const initial = useMemo(() => ({
    v: { title: work?.title || '', description: work?.description || '', category: work?.category || '', year: work?.year ? String(work.year) : '', medium: work?.medium || '', signed: work?.signed || '' },
    mode: work?.reelId ? 'reel' : work?.video ? 'upload' : 'none',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps -- the form starts from the work it was opened with
  const [v, setV] = useState(initial.v);
  const [photos, setPhotos] = useState((work?.photos || []).map((u) => ({ id: u, url: u })));
  const [mode, setMode] = useState(initial.mode);
  const [reelId, setReelId] = useState(work?.reelId || null);
  const [link, setLink] = useState({ value: '', state: '' });
  const [videoFile, setVideoFile] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [errors, setErrors] = useState({});
  const [problems, setProblems] = useState(here.state?.problems || []);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  const [savedAt, setSavedAt] = useState(here.state?.savedAt || null);
  const [dialog, setDialog] = useState(null); // { listing } | 'delete'
  const [rowBusy, setRowBusy] = useState(null);
  const summary = useRef(null);
  const created = useRef(null); // the id of a draft made by this page before it moved to its own address

  const snapshot = () => JSON.stringify([v, photos.map((p) => p.id), mode, reelId, link.value, Boolean(videoFile)]);
  const [base, setBase] = useState(snapshot);
  const dirty = snapshot() !== base;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { if (problems.length) summary.current?.focus(); }, [problems]);
  useEffect(() => () => photos.forEach((p) => p.file && URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  const status = work ? workStatus(work) : 'draft';
  const hasOpenOriginal = listings.some((l) => l.kind === 'original' && l.status !== 'ended');
  const hasSales = Boolean(work?.hasSales) || listings.some((l) => l.status === 'sold');
  const checks = { details: Boolean(v.title.trim() && v.description.trim()), photos: photos.length > 0, listings: listings.some((l) => l.status === 'draft' || l.status === 'live') };

  /** Writes everything. Returns { ok, id } or { ok: false }; on a failed row the files of this attempt are removed and the form keeps its values. */
  const persist = async () => {
    const found = validateDetails(v);
    setErrors(found);
    if (Object.keys(found).length) { document.getElementById(`ed-${Object.keys(found)[0]}`)?.focus(); return { ok: false }; }
    if (!v.title.trim() || !v.category) { setProblem('Add a title and category to save a draft.'); return { ok: false }; }
    if (mode === 'upload' && videoError) return { ok: false };
    setProblem('');

    const made = []; // paths uploaded by this attempt
    const cleanup = () => { removeUploads('artworks', made.filter((p) => p.startsWith('artworks/'))); removeUploads('videos', made.filter((p) => p.startsWith('videos/'))); };
    const urls = [];
    for (const p of photos) {
      if (!p.file) { urls.push(p.url); continue; }
      const up = await upload('artworks', p.file, uid);
      if (!up.ok) { cleanup(); setProblem(errorText(up.error)); return { ok: false }; }
      made.push(up.path); urls.push(up.url);
    }
    let videoUrl = mode === 'upload' ? work?.video || null : null;
    if (mode === 'upload' && videoFile) {
      const up = await upload('videos', videoFile, uid);
      if (!up.ok) { cleanup(); setProblem(errorText(up.error)); return { ok: false }; }
      made.push(up.path); videoUrl = up.url;
    }
    let reel = mode === 'reel' ? reelId : null;
    let createdReel = null;
    if (mode === 'reel' && link.value.trim()) {
      if (!reelCode(link.value)) { cleanup(); setLink((l) => ({ ...l, state: 'bad' })); return { ok: false }; }
      const r = await saveReel(uid, { url: link.value.trim(), highlighted: false, ownerConfirmed: true });
      if (!r.ok) { cleanup(); setProblem(errorText(r.error)); return { ok: false }; }
      reel = r.id; createdReel = r.id;
    }

    const saved = await saveArtwork(uid, work?.id ?? created.current, {
      title: v.title.trim(), description: v.description.trim(), category: v.category, year: v.year ? Number(v.year) : null,
      medium: v.medium.trim(), signed: v.signed || null, photos: urls, video: videoUrl, reelId: reel,
    });
    if (!saved.ok) {
      cleanup();
      if (createdReel) deleteReel(createdReel);
      setProblem('We couldn’t save. Try again.');
      return { ok: false };
    }
    // files this save dropped (removed photos, a replaced or cleared video) go last
    const gone = (work?.photos || []).filter((u) => !urls.includes(u)).map((u) => storagePath(u, 'artworks')).filter(Boolean);
    if (gone.length) removeUploads('artworks', gone);
    const oldVideo = storagePath(work?.video, 'videos');
    if (oldVideo && oldVideo !== storagePath(videoUrl, 'videos')) removeUploads('videos', [oldVideo]);

    photos.forEach((p) => p.file && URL.revokeObjectURL(p.url));
    const next = urls.map((u) => ({ id: u, url: u }));
    setPhotos(next); setVideoFile(null); setReelId(reel); setLink({ value: '', state: '' }); setSavedAt(Date.now());
    if (!work) created.current = saved.id;
    setBase(JSON.stringify([v, next.map((p) => p.id), mode, reel, '', false]));
    return { ok: true, id: saved.id };
  };

  const afterSave = (id, extra = {}) => {
    if (work) reload();
    else navigate(`/dashboard/artworks/${id}`, { replace: true, state: { savedAt: Date.now(), ...extra } });
  };

  const saveDraft = async () => {
    setBusy('draft'); setProblems([]);
    const res = await persist();
    setBusy('');
    if (res.ok) { toast('Draft saved'); afterSave(res.id); }
  };

  const publish = async () => {
    setBusy('publish'); setProblems([]);
    const res = await persist();
    if (!res.ok) { setBusy(''); return; }
    const gaps = publishProblems({ title: v.title, photos }, listings);
    if (gaps.length) { setBusy(''); setProblems(gaps); afterSave(res.id, { problems: gaps }); return; }
    const out = await call('publishArtwork', { artworkId: res.id });
    setBusy('');
    if (!out.ok) {
      if (out.error?.fields?.length) setProblems(out.error.fields.filter((f) => FIELD_ID[f]));
      else setProblem(errorText(out.error));
      return;
    }
    toast(work?.status === 'published' ? 'Changes saved' : 'Artwork published');
    afterSave(res.id);
  };

  /** A Listing needs a work to hang on: save the details as a draft first when it is new. */
  const ensureDraft = async () => {
    if (work) return work.id;
    if (created.current) return created.current;
    const res = await persist();
    return res.ok ? res.id : null;
  };

  const rowAction = async (l, fn, text, failText) => {
    setRowBusy(l.id);
    const res = await fn(l.id);
    setRowBusy(null);
    if (!res.ok) { toast(failText?.(res.error) || errorText(res.error), { kind: 'err' }); return; }
    toast(text); reload();
  };

  const remove = async () => {
    setBusy('delete');
    const res = await call('deleteArtwork', { artworkId: work.id });
    setBusy('');
    setDialog(null);
    if (!res.ok) { toast(errorText(res.error), { kind: 'err' }); return; }
    removeUploads('artworks', (res.data.photos || []).map((u) => storagePath(u, 'artworks')).filter(Boolean));
    if (res.data.video) removeUploads('videos', [storagePath(res.data.video, 'videos')].filter(Boolean));
    setBase(snapshot());
    toast('Artwork deleted');
    navigate('/dashboard/artworks', { replace: true });
  };

  const checkLink = () => setLink((l) => ({ ...l, state: reelCode(l.value) ? 'ok' : 'bad' }));
  const missing = (f) => problems.includes(f) && PROBLEM_TEXT[f];

  return (
    <div className="stack lg">
      <Breadcrumbs items={[{ to: '/dashboard/artworks', label: 'My Artworks' }, { label: v.title.trim() || 'New Artwork' }]} />
      <div className="page-head">
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1>{work ? 'Edit Artwork' : 'Add Artwork'}</h1>
          <span className={`badge ${STATUS_BADGE[status][1]}`}>{STATUS_BADGE[status][0]}</span>
          {savedAt && <span className="small muted" role="status">Saved {clock(savedAt)}</span>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {work
            ? <a className="btn btn-secondary" href={`/artwork/${work.id}?preview=1`} target="_blank" rel="noreferrer">Preview</a>
            : <button type="button" className="btn btn-secondary" disabled>Preview</button>}
          <button type="button" className="btn btn-secondary" onClick={saveDraft} disabled={Boolean(busy) || restricted}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="alert err" role="alert" tabIndex={-1} ref={summary}>
          <Icon name="alert" />
          <div><strong>{problems.length} {problems.length === 1 ? 'thing stops' : 'things stop'} you publishing</strong>
            <ul className="list small">{problems.map((f) => <li key={f}><a href={`#${FIELD_ID[f]}`} onClick={(e) => { e.preventDefault(); document.getElementById(FIELD_ID[f])?.focus(); }}>{{ title: 'Title', photos: 'Photos', listings: 'Listings' }[f]}</a></li>)}</ul></div>
        </div>
      )}
      {problem && <div className="alert err" role="alert"><Icon name="alert" /><div>{problem}</div></div>}

      <div className="split">
        <fieldset className="stack lg" disabled={restricted} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="panel stack" aria-labelledby="ed-details-h">
            <h3 id="ed-details-h">Details</h3>
            <Field id="ed-title" label="Title" required counter={{ value: v.title, max: 100 }} error={errors.title || (problems.includes('title') && PROBLEM_TEXT.title) || undefined}>
              <input className="input" value={v.title} maxLength={100} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field id="ed-category" label="Category" required>
                <select className="select" value={v.category} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">Choose…</option>
                  {Object.entries(GROUPS).map(([g, cats]) => <optgroup key={g} label={g}>{cats.map((c) => <option key={c}>{c}</option>)}</optgroup>)}
                </select>
              </Field>
              <Field id="ed-year" label="Year made" required error={errors.year}>
                <input className="input" inputMode="numeric" maxLength={4} value={v.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field id="ed-medium" label="Medium" required hint="Like ‘Acrylic on canvas’ or ‘Cast brass’." error={errors.medium}>
                <input className="input" value={v.medium} maxLength={100} onChange={(e) => set({ medium: e.target.value })} />
              </Field>
              <Field id="ed-signed" label="Signed">
                <select className="select" value={v.signed} onChange={(e) => set({ signed: e.target.value })}>
                  <option value="">Choose…</option>
                  {SIGNED.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </Field>
            </div>
            <Field id="ed-description" label="Description" required counter={{ value: v.description, max: 1000 }} error={errors.description}>
              <textarea className="textarea" rows={5} value={v.description} maxLength={1000} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </section>

          <section className="panel stack" aria-labelledby="ed-photos-h">
            <h3 id="ed-photos-h" className="sr">Photos</h3>
            <PhotoManager photos={photos} onChange={setPhotos} error={missing('photos')} />
          </section>

          <section className="panel stack" aria-labelledby="ed-video-h">
            <h3 id="ed-video-h" className="sr">Video</h3>
            <VideoPicker mode={mode} onMode={(m) => { setMode(m); setVideoError(''); }} link={link} onLink={(value) => setLink({ value, state: '' })} onCheck={checkLink}
              reels={reels} reelId={reelId} onReelId={(id) => { setReelId(id); setLink({ value: '', state: '' }); }}
              videoUrl={work?.video} videoFile={videoFile} videoError={videoError} onVideoFile={(f, bad) => { setVideoFile(bad ? null : f); setVideoError(bad); }} />
          </section>

          <section className="panel stack" aria-labelledby="ed-listings-h" id="ed-listings" tabIndex={-1}>
            <div className="row between" style={{ alignItems: 'center' }}>
              <div><h3 id="ed-listings-h">Listings <span className="req" aria-hidden="true">*</span></h3><p className="small muted">What Buyers can actually buy. Prices include shipping within India.</p></div>
              <button type="button" className="btn btn-secondary" onClick={() => setDialog({ listing: null })}><Icon name="plus" size={16} />Add Listing</button>
            </div>
            {listings.length === 0
              ? <p className="muted">No Listings yet.</p>
              : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>Type</th><th>Details</th><th className="r">Price</th><th className="r">Stock</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
                  <tbody>{listings.map((l) => (
                    <tr key={l.id} data-listing={l.id}>
                      <td>{KIND_SHORT[l.kind] || l.kind}</td>
                      <td>{[l.size, l.medium].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="r">{formatINR(l.price)}</td>
                      <td className="r">{l.kind === 'original' ? '1' : listingLine(l)[2].replace(' in stock', '')}</td>
                      <td><span className={`badge ${l.status === 'live' ? 'ok' : l.status === 'sold' ? 'info' : ''}`}>{{ live: 'Live', sold: 'Sold', ended: 'Ended', draft: 'Draft' }[l.status]}</span></td>
                      <td>{l.status === 'sold' ? <span className="small muted">Read-only</span> : (
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ listing: l })}>Edit</button>
                          {l.status === 'ended'
                            ? <button type="button" className="btn btn-secondary btn-sm" disabled={rowBusy === l.id} onClick={() => rowAction(l, reopenListing, 'Listing reopened', (e) => (e.reason === 'out_of_stock' ? 'Nothing left to sell. Add stock to the Listing first.' : undefined))}>Reopen</button>
                            : <button type="button" className="btn btn-ghost btn-sm" disabled={rowBusy === l.id} onClick={() => rowAction(l, endListing, 'Listing ended')}>End</button>}
                        </div>
                      )}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            {missing('listings') && <span className="error-msg"><Icon name="alert" size={14} />{PROBLEM_TEXT.listings}</span>}
          </section>

          {work && (
            <section className="panel stack" aria-labelledby="ed-danger-h">
              <h3 id="ed-danger-h">Danger zone</h3>
              {hasSales
                ? <p className="muted">This Artwork has sales, so it can’t be deleted. End its Listings instead.</p>
                : <div><button type="button" className="btn btn-secondary" onClick={() => setDialog('delete')}>Delete Artwork</button></div>}
            </section>
          )}
        </fieldset>

        <aside className="stack sticky">
          <PublishPanel checks={checks} published={work?.status === 'published'} verified={Boolean(onboarding?.verifiedAt) || Boolean(onboarding === undefined)} busy={busy} disabled={restricted} onPublish={publish} onSaveDraft={saveDraft} />
        </aside>
      </div>

      <ListingDialog open={dialog !== null && dialog !== 'delete'} onClose={() => setDialog(null)} uid={uid} listing={dialog?.listing || null} hasOriginal={hasOpenOriginal} published={work?.status === 'published'}
        ensureDraft={ensureDraft} onSaved={() => { toast('Listing saved'); if (!work && created.current) afterSave(created.current); else reload(); }} />
      <Dialog open={dialog === 'delete'} alert title="Delete this Artwork?" busy={busy === 'delete'} onClose={() => setDialog(null)}
        footer={<><button className="btn btn-secondary" onClick={() => setDialog(null)}>Keep it</button><button className="btn btn-primary" onClick={remove} disabled={busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Delete Artwork'}</button></>}>
        <p>This can’t be undone. Its photos and Listings are removed. It has never sold, so no Orders are affected.</p>
      </Dialog>
    </div>
  );
}

export default function ArtworkEditor() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const valid = !id || UUID.test(id);
  const [work, loading, error, reload] = useWork(id && valid ? id : null);
  if (!valid) return <NotFound />;
  if (id && loading) return <div className="skeleton" style={{ height: 240 }} aria-busy="true" />;
  if (id && error) return <div className="alert err" role="alert">We couldn’t load this Artwork.<br /><button className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div>;
  if (id && (!work || work.artistId !== currentUser.uid)) return <NotFound />;
  return <EditorForm key={work?.id || 'new'} work={work || null} reload={reload} />;
}
