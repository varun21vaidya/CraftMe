import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { signOutUser } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { CartConflictDialog } from '../cart/CartConflictDialog';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';

const Logo = () => (
  <Link className="logo" to="/">
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
    </svg>
    CraftMe
  </Link>
);

export function Layout() {
  const { currentUser, isArtist } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]); // close after picking a link

  const links = (
    <>
      <Link to="/browse">Browse</Link>
      {isArtist && <Link to="/dashboard/new">Add artwork</Link>}
      {isArtist && <Link to="/dashboard/works">My works</Link>}
      {isArtist && <Link to="/dashboard/orders">Orders to ship</Link>}
      {isArtist && <Link to="/dashboard/profile">My profile</Link>}
    </>
  );

  return (
    <>
      <header className="site-header">
        <div className="wrap bar">
          <Logo />
          <nav className="nav" aria-label="Main">{links}</nav>
          <div className="hactions">
            {currentUser ? (
              <>
                <Link className="iconbtn" to="/cart" aria-label={`Cart, ${count} items`}>
                  <Icon name="cart" size={20} />
                  {count > 0 && <span className="count">{count}</span>}
                </Link>
                <NotificationBell />
                <Link className="btn btn-ghost btn-sm" to="/orders">My orders</Link>
                <button className="iconbtn" aria-label="Log out" onClick={signOutUser}><Icon name="logout" size={20} /></button>
              </>
            ) : (
              <Link className="btn btn-primary btn-sm" to="/login">Log in</Link>
            )}
            <button className="iconbtn burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <Icon name={open ? 'x' : 'menu'} size={22} />
            </button>
          </div>
        </div>
        {open && (
          <div className="mobile-menu">
            <div className="wrap">
              <nav className="nav" aria-label="Menu">
                {links}
                {currentUser && <Link to="/orders">My orders</Link>}
              </nav>
            </div>
          </div>
        )}
      </header>
      <Outlet />
      <CartConflictDialog />
      <footer className="site-footer">
        <div className="wrap">
          <div className="legal"><span>© 2026 CraftMe · Prices in ₹, shipping within India included</span>
            <a href="/privacy">Privacy</a></div>
        </div>
      </footer>
    </>
  );
}
