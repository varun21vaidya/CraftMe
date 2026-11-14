import { Link, Navigate, useParams } from 'react-router-dom';
import { LEGAL_PAGES } from '../content/legal';
import { formatDate } from '../lib/format';
import NotFound from './NotFound';

/** S19: one shell for the seven legal pages; every tab is its own URL and none needs a login. */
export default function LegalPage() {
  const { page: slug } = useParams();
  if (!slug) return <Navigate to="/legal/terms" replace />;
  const page = LEGAL_PAGES.find((p) => p.slug === slug);
  if (!page) return <NotFound />;
  const { Body } = page;
  return (
    <main className="wrap mid page">
      <nav className="legal-tabs" aria-label="Legal pages">
        {LEGAL_PAGES.map((p) => <Link key={p.slug} to={`/legal/${p.slug}`} aria-current={p.slug === slug ? 'page' : undefined}>{p.tab}</Link>)}
      </nav>
      <article className="legal-body">
        <h1>{page.title}</h1>
        <p className="muted">Last updated {formatDate(Date.parse(page.updated))}</p>
        {import.meta.env.DEV && page.draft && <p className="alert warn" role="note">Draft legal text: replace it before launch (the production build refuses to ship it).</p>}
        <Body />
      </article>
    </main>
  );
}
