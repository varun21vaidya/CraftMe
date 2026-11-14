import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { signOutUser } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useSaved } from '../../contexts/SavedContext';
import { initials } from '../../lib/artist';
import { GROUPS } from '../../lib/categories';
import { currentTheme, subscribeTheme, toggleTheme } from '../../lib/theme';
import { DeletionStatus } from '../account/DeletionStatus';
import { CartConflictDialog } from '../cart/CartConflictDialog';
import { Menu } from '../ui/Menu';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';
import MarketplaceSearch from './MarketplaceSearch';

const Logo = () => (
  <Link className="logo" to="/">
    <img src="/brand/craftme-icon.svg" width="32" height="32" alt="" />
    <span className="logo-word">CraftMe</span>
  </Link>
);

const HELP = [['terms', 'Terms'], ['privacy', 'Privacy'], ['refunds', 'Refunds'], ['shipping', 'Shipping'], ['contact', 'Contact'], ['artist', 'Artist agreement'], ['deletion', 'Delete my data']];
const groupLink = (name) => `/browse?group=${encodeURIComponent(name)}`;

export function Layout() {
  const { currentUser, isArtist } = useAuth();
  const { count } = useCart();
  const { count: saved } = useSaved();
  const theme = useSyncExternalStore(subscribeTheme, currentTheme);
  const [open, setOpen] = useState(false);
  const burger = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]); // close after picking a link

  const groups = Object.keys(GROUPS).map((name) => ({ to: groupLink(name), label: name }));
  const account = [
    { to: '/orders', label: 'My orders' },
    { to: '/wishlist', label: 'Wish list' },
    { to: '/profile', label: 'Profile' },
    { to: '/notifications', label: 'Notifications' },
    ...(isArtist ? [{ to: '/dashboard/orders', label: 'Artist dashboard' }] : []),
    'divider',
    { onSelect: toggleTheme, label: theme === 'dark' ? 'Light theme' : 'Dark theme' },
    { onSelect: signOutUser, label: 'Log out', icon: 'logout' },
  ];

  return (
    <>
      <header className="site-header">
        <div className="wrap bar">
          <Logo />
          <nav className="nav" aria-label="Main">
            <Link to="/browse">Browse</Link>
            <Menu label="Categories" button="Categories" items={groups} align="left" />
          </nav>
          <MarketplaceSearch />
          <div className="hactions">
            {currentUser ? (
              <>
                <Link className="iconbtn" to="/cart" aria-label={`Cart, ${count} items`}>
                  <Icon name="cart" size={20} />
                  {count > 0 && <span className="count">{count}</span>}
                </Link>
                <Link className="iconbtn" to="/wishlist" aria-label={`Wish list, ${saved} saved`}>
                  <Icon name="heart" size={20} />
                  {saved > 0 && <span className="count">{saved}</span>}
                </Link>
                <NotificationBell />
                <Menu label="Account menu" items={account}
                  button={<span className="avatar sm" aria-hidden="true">{initials(currentUser.displayName || currentUser.email)}</span>} />
              </>
            ) : (
              <Link className="btn btn-primary btn-sm" to="/login">Log in</Link>
            )}
            <button ref={burger} className="iconbtn burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              <Icon name={open ? 'x' : 'menu'} size={22} />
            </button>
          </div>
        </div>
        {open && (
          <div className="mobile-menu" onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); burger.current?.focus(); } }}>
            <div className="wrap">
              <nav className="nav" aria-label="Menu">
                <Link to="/browse">Browse</Link>
                {groups.map((g) => <Link key={g.to} to={g.to}>{g.label}</Link>)}
                {currentUser && <Link to="/wishlist">Wish list{saved > 0 ? ` (${saved})` : ''}</Link>}
                {currentUser && <Link to="/orders">My orders</Link>}
                {currentUser && <Link to="/profile">Profile</Link>}
                {currentUser && <Link to="/notifications">Notifications</Link>}
                {isArtist && <Link to="/dashboard/orders">Artist dashboard</Link>}
              </nav>
            </div>
          </div>
        )}
      </header>
      {currentUser && <DeletionStatus />}
      <Outlet />
      <CartConflictDialog />
      <footer className="site-footer">
        <div className="wrap">
          <div className="cols">
            <div><Logo /><p className="small muted" style={{ marginTop: 10 }}>Original art and handmade work from Indian artists.</p></div>
            <div><h4>Shop</h4><ul>{groups.map((g) => <li key={g.to}><Link to={g.to}>{g.label}</Link></li>)}</ul></div>
            <div><h4>Help</h4><ul>{HELP.map(([slug, label]) => <li key={slug}><Link to={`/legal/${slug}`}>{label}</Link></li>)}</ul></div>
          </div>
          <div className="legal"><span>© 2026 CraftMe · Prices in ₹, shipping within India included</span><ThemeToggle /></div>
        </div>
      </footer>
    </>
  );
}
