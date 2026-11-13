import { Link } from 'react-router-dom';
import MarketplaceSearch from '../components/common/MarketplaceSearch';

export default function NotFound() {
  return (
    <main className="wrap page">
      <div className="empty">
        <h1>This wall is empty.</h1>
        <p>The page you asked for isn’t here. It may have moved, or the link may be mistyped. Search for something, or start again from Home.</p>
        <MarketplaceSearch />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/">Go to Home</Link>
          <Link className="btn btn-secondary" to="/browse">Browse art</Link>
        </div>
      </div>
    </main>
  );
}
