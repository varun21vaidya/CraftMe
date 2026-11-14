import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { call, removeUploads, useMyWorks } from '../api/gateway';
import { Icon } from '../components/common/Icon';
import { WorksTable } from '../components/dashboard/WorksTable';
import { Dialog } from '../components/ui/Dialog';
import { Pagination } from '../components/ui/Pagination';
import { Tabs } from '../components/ui/Tabs';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { errorText } from '../lib/format';
import { storagePath, TABS, workStatus } from '../lib/works';

const PER_PAGE = 20;
const LOAD_LIMIT = 500;

/** S22: the Artist's works with status tabs, search, and End, Reopen and Delete. */
export default function MyWorks() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [works, loading, error, reload] = useMyWorks(currentUser.uid);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [ending, setEnding] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const all = useMemo(() => (works || []).map((w) => ({ ...w, _status: workStatus(w) })), [works]);
  const counts = useMemo(() => Object.fromEntries(TABS.map(([id]) => [id, id === 'all' ? all.length : all.filter((w) => w._status === id).length])), [all]);
  const shown = useMemo(() => all.filter((w) => (tab === 'all' || w._status === tab) && w.title.toLowerCase().includes(q.trim().toLowerCase())), [all, tab, q]);
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const rows = shown.slice((Math.min(page, pages) - 1) * PER_PAGE, Math.min(page, pages) * PER_PAGE);

  const go = (next) => setParams((p) => { const n = new URLSearchParams(p); Object.entries(next).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); return n; }, { replace: true });

  const act = async (work, name, done, failText) => {
    setBusyId(work.id);
    const res = await call(name, { artworkId: work.id });
    setBusyId(null);
    if (!res.ok) { toast(failText?.(res.error) || errorText(res.error), { kind: 'err' }); return res; }
    toast(done);
    reload();
    return res;
  };
  const end = async () => { const w = ending; setEnding(null); await act(w, 'endArtwork', 'Listings ended'); };
  const reopen = (w) => act(w, 'reopenArtwork', 'Listings reopened', (e) => (e.reason === 'artist_restricted' ? 'Your shop is paused, so Listings can’t be reopened.' : undefined));
  const remove = async () => {
    const w = deleting;
    setBusyId(w.id);
    const res = await call('deleteArtwork', { artworkId: w.id });
    setBusyId(null);
    setDeleting(null);
    if (!res.ok) { toast(errorText(res.error), { kind: 'err' }); return; }
    removeUploads('artworks', (res.data.photos || []).map((u) => storagePath(u, 'artworks')).filter(Boolean));
    if (res.data.video) removeUploads('videos', [storagePath(res.data.video, 'videos')].filter(Boolean));
    toast('Artwork deleted');
    reload();
  };

  return (
    <div className="stack lg">
      <div className="page-head">
        <div><h1>My Artworks</h1><p>An Artwork is what Buyers browse. Its Listings are what they buy.</p></div>
        <Link className="btn btn-primary" to="/dashboard/artworks/new"><Icon name="plus" size={16} />Add Artwork</Link>
      </div>

      {error && <div className="alert err" role="alert"><Icon name="alert" /><div>We couldn’t load your Artworks.<br /><button className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div></div>}
      {loading && <div className="stack" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}</div>}

      {!loading && !error && all.length === 0 && (
        <div className="empty">
          <h3>Your wall is empty.</h3>
          <p>Add your first Artwork with photos, then create a Listing for the Original, a Print, or both.</p>
          <Link className="btn btn-primary" to="/dashboard/artworks/new">Add your first Artwork</Link>
        </div>
      )}

      {!loading && !error && all.length > 0 && (
        <>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs label="Artwork status" controls="works-panel" value={tab} onChange={(id) => go({ tab: id === 'all' ? '' : id, page: '' })}
              tabs={TABS.map(([id, label]) => ({ id, label, count: counts[id] }))} />
            <input className="input" type="search" placeholder="Search my Artworks" aria-label="Search my Artworks" value={q} style={{ maxWidth: 260 }}
              onChange={(e) => { setQ(e.target.value); go({ page: '' }); }} />
          </div>
          <div id="works-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {rows.length === 0
              ? <div className="empty"><h3>Nothing here.</h3></div>
              : <WorksTable rows={rows} busyId={busyId} onEnd={setEnding} onReopen={reopen} onDelete={setDeleting} />}
          </div>
          <Pagination page={Math.min(page, pages)} pages={pages} onPage={(n) => go({ page: n > 1 ? String(n) : '' })} />
          {works.length >= LOAD_LIMIT && <p className="small muted">Showing your {LOAD_LIMIT} newest Artworks.</p>}
        </>
      )}

      <Dialog open={Boolean(ending)} alert title="End all Listings of this Artwork?" onClose={() => setEnding(null)}
        footer={<><button className="btn btn-secondary" onClick={() => setEnding(null)}>Keep selling</button><button className="btn btn-primary" onClick={end}>End Listings</button></>}>
        <p>Ended Listings leave the shop and can’t be bought. Paid Orders aren’t affected, and you can reopen them any time.</p>
      </Dialog>
      <Dialog open={Boolean(deleting)} alert title="Delete this Artwork?" busy={busyId === deleting?.id} onClose={() => setDeleting(null)}
        footer={<><button className="btn btn-secondary" onClick={() => setDeleting(null)}>Keep it</button><button className="btn btn-primary" onClick={remove}>Delete Artwork</button></>}>
        <p>This can’t be undone. Its photos and Listings are removed. It has never sold, so no Orders are affected.</p>
      </Dialog>
    </div>
  );
}
