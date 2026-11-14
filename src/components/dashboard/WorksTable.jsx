import { Link } from 'react-router-dom';
import { formatDate, formatINR } from '../../lib/format';
import { listingLine, STATUS_BADGE, workStatus } from '../../lib/works';

const NO_DELETE = 'Artworks with sales can’t be deleted';

function Lines({ work }) {
  const listings = (work.listings || []).filter((l) => l.status !== 'ended' || workStatus(work) === 'ended');
  if (!listings.length) return <span className="muted">No Listings yet</span>;
  return (
    <ul className="list small" style={{ margin: 0 }}>
      {listings.map((l) => {
        const [label, price, note] = listingLine(l);
        return <li key={l.id}>{label} {formatINR(price)} · {note}</li>;
      })}
    </ul>
  );
}

function Actions({ work, status, busy, onEnd, onReopen, onDelete }) {
  const edit = `/dashboard/artworks/${work.id}`;
  const view = <Link className="btn btn-ghost btn-sm" to={`/artwork/${work.id}`}>View</Link>;
  if (status === 'published') {
    return <>
      <Link className="btn btn-secondary btn-sm" to={edit}>Edit</Link>
      <button className="btn btn-ghost btn-sm" onClick={() => onEnd(work)} disabled={busy}>End</button>{view}
    </>;
  }
  if (status === 'sold') {
    return <>
      {view}<Link className="btn btn-secondary btn-sm" to={edit}>Edit</Link>
      <span className="small muted"><button className="btn btn-ghost btn-sm" disabled title={NO_DELETE}>Delete</button> {NO_DELETE}</span>
    </>;
  }
  if (status === 'ended') {
    return <>
      <Link className="btn btn-secondary btn-sm" to={edit}>Edit</Link>
      <button className="btn btn-primary btn-sm" onClick={() => onReopen(work)} disabled={busy}>Reopen</button>
    </>;
  }
  return <>
    <Link className="btn btn-primary btn-sm" to={edit}>Finish</Link>
    <button className="btn btn-ghost btn-sm" onClick={() => onDelete(work)} disabled={busy}>Delete</button>
  </>;
}

/** The works as a table over 760 px and as cards below it. rows: works with their listings; busyId: the row whose action is running. */
export function WorksTable({ rows, busyId, onEnd, onReopen, onDelete }) {
  const items = rows.map((w) => ({ w, status: workStatus(w) }));
  const meta = (w) => [w.category, w.year].filter(Boolean).join(' · ');
  const thumb = (w) => (w.photos?.[0]
    ? <img className="thumb" src={w.photos[0]} alt="" width="48" height="48" loading="lazy" style={{ objectFit: 'cover', borderRadius: 6 }} />
    : <span className="thumb skeleton" style={{ width: 48, height: 48, display: 'inline-block' }} aria-hidden="true" />);
  const badge = (s) => <span className={`badge ${STATUS_BADGE[s][1]}`}>{STATUS_BADGE[s][0]}</span>;
  return (
    <>
      <div className="table-wrap works-table">
        <table className="table">
          <thead><tr><th>Artwork</th><th>Listings</th><th>Status</th><th className="r">Views</th><th>Updated</th><th><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {items.map(({ w, status }) => (
              <tr key={w.id} data-work={w.id}>
                <td><div className="cell-art">{thumb(w)}<div><strong>{w.title}</strong><div className="small muted">{meta(w)}</div></div></div></td>
                <td><Lines work={w} /></td>
                <td>{badge(status)}</td>
                <td className="r">{w.views ?? 0}</td>
                <td>{w.updatedAt ? formatDate(w.updatedAt) : ''}</td>
                <td><div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Actions work={w} status={status} busy={busyId === w.id} onEnd={onEnd} onReopen={onReopen} onDelete={onDelete} />
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stack works-cards">
        {items.map(({ w, status }) => (
          <article key={w.id} className="panel stack sm" data-work={w.id}>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              {thumb(w)}
              <div style={{ minWidth: 0, flex: 1 }}><strong>{w.title}</strong><div className="small muted">{meta(w)}</div></div>
              {badge(status)}
            </div>
            <Lines work={w} />
            <div className="small muted">{w.views ?? 0} views{w.updatedAt ? ` · Updated ${formatDate(w.updatedAt)}` : ''}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <Actions work={w} status={status} busy={busyId === w.id} onEnd={onEnd} onReopen={onReopen} onDelete={onDelete} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
