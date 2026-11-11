import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useArtist, useArtistWorks, useReels } from '../api/gateway';
import ArtCard from '../components/ArtCard';
import ReelCard from '../components/ReelCard';
import { useAuth } from '../contexts/AuthContext';
import { initials, isBadId, ratingText, safePhoto } from '../lib/artist';

const PAGE = 24;
// The handle is typed in by the Artist and not verified yet, so the page says so.
const instagramUrl = (handle) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;

function Photo({ url, name }) {
  const [broken, setBroken] = useState(false);
  const src = safePhoto(url);
  return src && !broken
    ? <img className="avatar xl" src={src} alt="" width="96" height="96" style={{ objectFit: 'cover' }} onError={() => setBroken(true)} referrerPolicy="no-referrer" />
    : <span className="avatar xl" aria-hidden="true">{initials(name)}</span>;
}

export default function ArtistPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [limit, setLimit] = useState(PAGE);
  const [artist, loadingArtist, error, reload] = useArtist(id);
  const [works, loadingWorks] = useArtistWorks(id, limit);
  const [reels] = useReels(id);
  const name = artist?.displayName || 'Artist';

  useEffect(() => {
    if (!artist) return undefined;
    const before = document.title;
    document.title = `${name} · CraftMe`;
    return () => { document.title = before; };
  }, [artist, name]);

  if (loadingArtist) return <main className="wrap page"><div className="skeleton" style={{ height: 160 }} aria-busy="true" /></main>;
  if (error && !isBadId(error)) {
    return (
      <main className="wrap page">
        <div className="empty" role="alert"><h3>We couldn’t load this page</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div>
      </main>
    );
  }
  if (!artist || !artist.roles?.includes('artist')) {
    return <main className="wrap page"><div className="empty"><h3>We couldn’t find this Artist</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div></main>;
  }

  const mine = currentUser?.uid === id;
  const rating = ratingText(artist.ratingAvg, artist.ratingCount);
  const head = (
    <div className="page-head">
      <div className="row" style={{ gap: 16, alignItems: 'center', minWidth: 0 }}>
        <Photo url={artist.photoURL} name={name} />
        <div className="stack sm" style={{ minWidth: 0 }}>
          <h1 style={{ overflowWrap: 'anywhere' }}>{name}</h1>
          {!artist.restricted && rating && <p className="small" aria-label={`Rated ${Number(artist.ratingAvg).toFixed(1)} out of 5 from ${artist.ratingCount} reviews`}>{rating}</p>}
          {!artist.restricted && artist.bio && <p className="muted" style={{ maxWidth: '60ch', overflowWrap: 'anywhere' }}>{artist.bio}</p>}
          {!artist.restricted && artist.instagramHandle && (
            <p className="small">
              <a href={instagramUrl(artist.instagramHandle)} target="_blank" rel="noopener noreferrer nofollow">
                Instagram @{artist.instagramHandle}
              </a>
              <span className="faint"> · {artist.instagramVerified ? 'verified on Instagram' : 'added by the Artist'}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
  const ownerBar = mine && (
    <div className="alert info" role="note" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <strong>{artist.restricted ? 'Buyers can’t see your works right now.' : 'This is how buyers see your page.'}</strong>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-secondary btn-sm" to="/dashboard/profile">Edit profile</Link>
        {!artist.restricted && <Link className="btn btn-secondary btn-sm" to="/dashboard/works">My works</Link>}
      </div>
    </div>
  );

  if (artist.restricted) {
    return (
      <main className="wrap page">
        {ownerBar}
        {head}
        <div className="empty"><h3>This Artist isn’t taking orders right now.</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div>
      </main>
    );
  }

  return (
    <main className="wrap page">
      {ownerBar}
      {head}
      {reels?.length > 0 && (
        <>
          <h2 style={{ marginBottom: 16 }}>Reels</h2>
          <div className="reels" style={{ marginBottom: 32 }}>{reels.map((r) => <ReelCard key={r.id} reel={r} />)}</div>
        </>
      )}
      <h2 style={{ marginBottom: 16 }}>Work by {name}</h2>
      {loadingWorks && <div className="grid g3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.1' }} />)}</div>}
      {!loadingWorks && !works?.length && <div className="empty"><h3>No work on sale right now</h3></div>}
      {works?.length > 0 && <div className="grid g3">{works.map((a) => <ArtCard key={a.id} art={a} hideArtist />)}</div>}
      {works?.length >= limit && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => setLimit((n) => n + PAGE)}>Show more</button>
        </div>
      )}
    </main>
  );
}
