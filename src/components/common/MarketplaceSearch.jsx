import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function MarketplaceSearch() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const initial = pathname === '/browse' ? new URLSearchParams(search).get('q') || '' : '';
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);

  function close() {
    setOpen(false);
    if (open) toggle.current?.focus();
  }

  return (
    <div className={`market-search${open ? ' market-search-open' : ''}`}>
      <button ref={toggle} type="button" className="btn btn-secondary btn-sm market-search-toggle"
        aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>Search</button>
      <form key={initial} role="search" onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
        onSubmit={(event) => {
          event.preventDefault();
          const query = new FormData(event.currentTarget).get('q').trim();
          const params = new URLSearchParams(pathname === '/browse' || pathname === '/' ? search : '');
          params.delete('type');
          if (query) params.set('q', query); else params.delete('q');
          navigate(params.size ? `/browse?${params}` : '/browse');
          close();
        }}>
        <input ref={(input) => { if (input && open && document.activeElement === toggle.current) input.focus(); }}
          type="search" name="q" defaultValue={initial} maxLength={100} aria-label="Search artworks and artists"
          placeholder="Search artworks and artists" />
        <button className="btn btn-secondary btn-sm">Search</button>
      </form>
    </div>
  );
}
