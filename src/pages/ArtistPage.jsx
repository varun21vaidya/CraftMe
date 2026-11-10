import { Link, useParams } from 'react-router-dom';
import { useArtist, useArtistWorks, useReels } from '../api/gateway';
import ArtCard from '../components/ArtCard';
import ReelCard from '../components/ReelCard';

// The handle is typed in by the Artist and not verified yet, so the page says so.
const instagramUrl = (handle) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;

export default function ArtistPage() {
  const { id } = useParams();
  const [artist, loadingArtist] = useArtist(id);
  const [works, loadingWorks] = useArtistWorks(id);
  const [reels] = useReels(id);

  if (loadingArtist) return <main className="wrap page"><div className="skeleton" style={{ height: 160 }} aria-busy="true" /></main>;
  if (!artist || !artist.roles?.includes('artist')) {
    return <main className="wrap page"><div className="empty"><h3>We couldn’t find this Artist</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div></main>;
  }

  return (
    <main className="wrap page">
      <div className="page-head">
        <div className="stack sm">
          <h1>{artist.displayName}</h1>
          {artist.bio && <p className="muted" style={{ maxWidth: '60ch' }}>{artist.bio}</p>}
          {artist.instagramHandle && (
            <p className="small">
              <a href={instagramUrl(artist.instagramHandle)} target="_blank" rel="noopener noreferrer nofollow">
                Instagram @{artist.instagramHandle}
              </a>
              <span className="faint"> · added by the Artist</span>
            </p>
          )}
        </div>
      </div>
      {reels?.length > 0 && (
        <>
          <h2 style={{ marginBottom: 16 }}>Reels</h2>
          <div className="grid g3" style={{ marginBottom: 32 }}>{reels.map((r) => <ReelCard key={r.id} reel={r} />)}</div>
        </>
      )}
      <h2 style={{ marginBottom: 16 }}>Work by {artist.displayName}</h2>
      {loadingWorks && <div className="grid g3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.1' }} />)}</div>}
      {!loadingWorks && !works?.length && <div className="empty"><h3>No work on sale right now</h3></div>}
      {works?.length > 0 && <div className="grid g3">{works.map((a) => <ArtCard key={a.id} art={a} />)}</div>}
    </main>
  );
}
