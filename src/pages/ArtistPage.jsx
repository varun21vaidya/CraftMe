import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useArtist, useArtistIdBySlug, useArtistStats, useBrowse, useReels } from '../api/gateway';
import { AboutTab } from '../components/artist/AboutTab';
import { ArtistStats } from '../components/artist/ArtistStats';
import { ReviewsTab } from '../components/artist/ReviewsTab';
import ArtCard from '../components/ArtCard';
import { Icon } from '../components/common/Icon';
import ReelCard from '../components/ReelCard';
import ReportDialog from '../components/ReportDialog';
import { CopyButton } from '../components/ui/CopyButton';
import { Pagination } from '../components/ui/Pagination';
import { Stars } from '../components/ui/Stars';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../contexts/AuthContext';
import { initials, isBadId, safePhoto } from '../lib/artist';

const PAGE = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS = ['artworks', 'instagram', 'reviews', 'about'];
const SHOW = { all: 'All', original: 'Originals', print: 'Prints', product: 'Ready-made', sold: 'Sold' };
// The handle is typed in by the Artist and not verified yet, so the page says so.
const instagramUrl = (handle) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;
const month = (ms) => new Date(ms).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const Shell = ({ children }) => <main className="wrap page">{children}</main>;
const NotFound = () => <Shell><div className="empty"><h3>We couldn’t find this Artist</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div></Shell>;

function Photo({ url, name }) {
  const [broken, setBroken] = useState(false);
  const src = safePhoto(url);
  return src && !broken
    ? <img className="avatar xl" src={src} alt="" width="96" height="96" style={{ objectFit: 'cover' }} onError={() => setBroken(true)} referrerPolicy="no-referrer" />
    : <span className="avatar xl" aria-hidden="true">{initials(name)}</span>;
}

/** /artist/<short name>: the address of the profile is the id, so a short name only redirects (keeping ?tab=). */
function BySlug({ slug }) {
  const { search, hash } = useLocation();
  const [id, loading, error, reload] = useArtistIdBySlug(slug);
  if (loading) return <Shell><div className="skeleton" style={{ height: 160 }} aria-busy="true" /></Shell>;
  if (error) return <Shell><div className="empty" role="alert"><h3>We couldn’t load this page.</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></Shell>;
  return id ? <Navigate replace to={`/artist/${id}${search}${hash}`} /> : <NotFound />;
}

function Works({ id, name, show, page, onShow, onPage }) {
  const kinds = ['original', 'print', 'product'].includes(show) ? [show] : null;
  const [data, loading, error, reload] = useBrowse({ artist: id, sort: 'new', page, kinds, onlySold: show === 'sold' });
  return (
    <section className="stack lg" aria-label={`Work by ${name}`}>
      <div className="row between">
        <div className="chips" role="group" aria-label="Show">
          {Object.entries(SHOW).map(([v, label]) => <button key={v} type="button" className="chip" aria-pressed={show === v} onClick={() => onShow(v)}>{label}</button>)}
        </div>
        <span className="small muted" role="status">{data ? `Showing ${data.total} ${data.total === 1 ? 'Artwork' : 'Artworks'}` : ''}</span>
      </div>
      {error && <div className="alert err" role="alert">We couldn’t load the works. <button className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div>}
      {loading && <div className="grid g3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.1' }} />)}</div>}
      {data?.total === 0 && <div className="empty"><h3>No work on sale right now.</h3></div>}
      {data?.items.length > 0 && <div className="grid g3">{data.items.map((a) => <ArtCard key={a.id} art={a} hideArtist />)}</div>}
      <Pagination page={page + 1} pages={Math.ceil((data?.total || 0) / PAGE)} label="Artwork pages" onPage={(n) => onPage(n - 1)} />
    </section>
  );
}

function Profile({ id }) {
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [reporting, setReporting] = useState(false);
  const [artist, loadingArtist, error, reload] = useArtist(id);
  const [stats] = useArtistStats(id);
  const [reels] = useReels(id);
  const name = artist?.displayName || 'Artist';
  const tab = TABS.includes(sp.get('tab')) ? sp.get('tab') : 'artworks';
  const show = Object.keys(SHOW).includes(sp.get('show')) ? sp.get('show') : 'all';
  const page = Math.max(0, (parseInt(sp.get('page'), 10) || 1) - 1);
  const put = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === '' ? next.delete(k) : next.set(k, v)));
    setSp(next);
  };

  useEffect(() => {
    if (!artist) return undefined;
    const before = document.title;
    document.title = `${name} · CraftMe`;
    return () => { document.title = before; };
  }, [artist, name]);

  if (loadingArtist) return <Shell><div className="skeleton" style={{ height: 160 }} aria-busy="true" /></Shell>;
  if (error && !isBadId(error)) return <Shell><div className="empty" role="alert"><h3>We couldn’t load this page.</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></Shell>;
  if (!artist || !artist.roles?.includes('artist')) return <NotFound />;

  const mine = currentUser?.uid === id;
  const count = Number(artist.ratingCount) || 0;
  const place = [artist.city, artist.state].filter(Boolean).join(', ');
  const line = [place, `On CraftMe since ${month(artist.createdAt)}`].filter(Boolean).join(' · ');
  const link = `${window.location.origin}/artist/${artist.slug || id}`;
  const report = () => (currentUser ? setReporting(true) : navigate('/login', { state: { from: pathname } }));

  const ownerBar = mine && (
    <div className="alert info" role="note" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <strong>{artist.restricted ? 'Buyers can’t see your works right now.' : 'This is how buyers see your page.'}</strong>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-secondary btn-sm" to="/dashboard/settings">Edit profile</Link>
        {!artist.restricted && <Link className="btn btn-secondary btn-sm" to="/dashboard/artworks">My works</Link>}
      </div>
    </div>
  );
  const head = (
    <section className="panel" aria-label="Profile">
      <div className="row top" style={{ gap: 24, flexWrap: 'wrap' }}>
        <Photo url={artist.photoURL} name={name} />
        <div className="stack sm grow" style={{ minWidth: 260 }}>
          <div className="row"><h1 style={{ overflowWrap: 'anywhere' }}>{name}</h1>{!artist.restricted && artist.verified && <span className="badge ok dot">Verified Artist</span>}</div>
          {!artist.restricted && <p className="muted">{line}</p>}
          {!artist.restricted && count > 0 && (
            <div className="row"><Stars value={artist.ratingAvg} size={18} /><strong>{Number(artist.ratingAvg).toFixed(1)}</strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => put({ tab: 'reviews', page: null })}>{count} {count === 1 ? 'Review' : 'Reviews'}</button></div>
          )}
          {!artist.restricted && artist.bio && <p style={{ maxWidth: '62ch', overflowWrap: 'anywhere' }}>{artist.bio}</p>}
          {!artist.restricted && artist.instagramHandle && (
            <p className="small">
              <a href={instagramUrl(artist.instagramHandle)} target="_blank" rel="noopener noreferrer nofollow">Instagram @{artist.instagramHandle}</a>
              <span className="faint"> · {artist.instagramVerified ? 'verified on Instagram' : 'added by the Artist'}</span>
            </p>
          )}
          {!artist.restricted && (
            <div className="row">
              <CopyButton text={link} label="Copy profile link" />
              {!mine && <button type="button" className="btn btn-ghost btn-sm" onClick={report}><Icon name="alert" size={16} />Report</button>}
            </div>
          )}
        </div>
        {!artist.restricted && <ArtistStats stats={stats} />}
      </div>
    </section>
  );

  if (artist.restricted) {
    return (
      <Shell>
        {ownerBar}
        {head}
        <div className="empty"><h3>This Artist isn’t taking orders right now.</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div>
      </Shell>
    );
  }

  const tabs = [
    { id: 'artworks', label: 'Artworks', count: stats?.artworks }, { id: 'instagram', label: 'Instagram Showcase' },
    { id: 'reviews', label: 'Reviews', count }, { id: 'about', label: 'About' },
  ];
  return (
    <Shell>
      {ownerBar}
      {head}
      <div style={{ marginTop: 24 }}>
        <Tabs label="Profile sections" tabs={tabs} value={tab} controls="profile-panel" onChange={(t) => put({ tab: t === 'artworks' ? null : t, show: null, page: null })} />
        <div id="profile-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ paddingTop: 24 }}>
          {tab === 'artworks' && <Works id={id} name={name} show={show} page={page} onShow={(v) => put({ show: v === 'all' ? null : v, page: null })} onPage={(n) => put({ page: n ? n + 1 : null })} />}
          {tab === 'instagram' && (reels?.length
            ? <div className="reels">{reels.map((r) => <ReelCard key={r.id} reel={r} />)}</div>
            : <div className="empty"><h3>No Instagram posts yet.</h3><p>{name} hasn’t added any posts or reels.</p></div>)}
          {tab === 'reviews' && <ReviewsTab artistId={id} average={artist.ratingAvg} count={count} />}
          {tab === 'about' && <AboutTab artist={artist} />}
        </div>
      </div>
      {!mine && <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="artist" targetId={id} />}
    </Shell>
  );
}

export default function ArtistPage() {
  const { id: key } = useParams();
  return UUID.test(key) ? <Profile key={key} id={key} /> : <BySlug slug={key} />;
}
