import { Icon } from '../common/Icon';

const Check = ({ done, children }) => (
  <li className="row" style={{ gap: 8, alignItems: 'center' }}>
    <span className={`badge ${done ? 'ok' : ''}`} aria-hidden="true"><Icon name={done ? 'check' : 'x'} size={12} /></span>
    <span><span className="sr">{done ? 'Done: ' : 'Not yet: '}</span>{children}</span>
  </li>
);

/** The sticky "Ready to publish?" panel. checks: { details, photos, listings } booleans. */
export function PublishPanel({ checks, published, verified, busy, disabled, onPublish, onSaveDraft }) {
  return (
    <section className="panel stack" aria-labelledby="pub-h">
      <h4 id="pub-h">Ready to publish?</h4>
      <ul className="list small">
        <Check done={checks.details}>Title and description</Check>
        <Check done={checks.photos}>At least one photo</Check>
        <Check done={checks.listings}>At least one Listing with a price</Check>
      </ul>
      {!verified && <div className="alert info"><Icon name="info" /><div>We’re checking your details. You can publish now, and you’ll be paid once that’s done.</div></div>}
      <button type="button" className="btn btn-primary btn-lg" onClick={onPublish} disabled={busy || disabled}>
        {busy === 'publish' ? 'Publishing…' : published ? 'Save changes' : 'Publish Artwork'}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onSaveDraft} disabled={busy || disabled}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
      <p className="small muted">Published Artworks go live straight away. CraftMe can take one down if it’s reported.</p>
    </section>
  );
}
