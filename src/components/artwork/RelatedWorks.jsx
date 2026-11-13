import { useBrowse } from '../../api/gateway';
import ArtCard from '../ArtCard';

/** Up to four other works for a filter (the same Artist, or the same Category). Hidden when there are none. */
export function RelatedWorks({ title, filter, exclude, hideArtist = false }) {
  const [data] = useBrowse({ sort: 'new', page: 0, ...filter });
  const items = (data?.items || []).filter((a) => a.id !== exclude).slice(0, 4);
  if (!items.length) return null;
  return (
    <section className="stack" aria-label={title}>
      <h2 style={{ fontSize: 22 }}>{title}</h2>
      <div className="grid g4">{items.map((a) => <ArtCard key={a.id} art={a} hideArtist={hideArtist} />)}</div>
    </section>
  );
}
