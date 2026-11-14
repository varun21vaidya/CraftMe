import { Link, NavLink, Outlet } from 'react-router-dom';
import { signOutUser, useOnboarding, useToShipCount } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { initials } from '../../lib/artist';
import { Menu } from '../ui/Menu';
import { Icon } from './Icon';
import { NotificationBell } from './NotificationBell';

const REASON = { owed_60_days: 'An amount owed to CraftMe has been unpaid for 60 days.' };

/** The frame of every /dashboard page: header, sidebar (a scrolling row under 900 px) and the shop-paused alert for a restricted Artist. */
export function ArtistShell() {
  const { currentUser, profile } = useAuth();
  const [toShip] = useToShipCount(currentUser.uid);
  const [priv] = useOnboarding(currentUser.uid);
  const reasons = priv?.restrictionReasons || [];
  const reason = reasons[reasons.length - 1];

  const links = [
    ['/dashboard', 'Overview', 'eye', true], ['/dashboard/artworks', 'Artworks', 'package'], ['/dashboard/orders', 'Orders', 'truck'],
    ['/dashboard/payouts', 'Payouts', 'receipt'], ['/dashboard/instagram', 'Instagram', 'play'], ['/dashboard/settings', 'Settings', 'info'],
  ];
  return (
    <>
      <header className="site-header">
        <div className="wrap bar">
          <Link className="logo" to="/dashboard">
            <img src="/brand/craftme-icon.svg" width="32" height="32" alt="" />
            <span className="logo-word">CraftMe</span><span className="badge accent" style={{ marginLeft: 8 }}>Artist</span>
          </Link>
          <Link className="btn btn-ghost btn-sm" to={`/artist/${currentUser.uid}`}>View my shop</Link>
          <div className="hactions">
            <NotificationBell />
            <Menu label="Account menu" align="right" items={[
              { to: '/', label: 'Back to CraftMe' }, { to: '/profile', label: 'Profile' }, 'divider', { onSelect: signOutUser, label: 'Log out', icon: 'logout' },
            ]} button={<span className="avatar sm" aria-hidden="true">{initials(currentUser.displayName || currentUser.email)}</span>} />
          </div>
        </div>
      </header>
      <div className="shell">
        <nav className="side" aria-label="Artist dashboard">
          <div className="grp">My shop</div>
          {links.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon name={icon} size={18} />{label}
              {label === 'Orders' && toShip > 0 && <span className="badge accent" aria-label={`${toShip} to ship`}>{toShip}</span>}
            </NavLink>
          ))}
          <div className="foot">
            <Link to="/">Back to CraftMe</Link>
            <a href="#logout" onClick={(e) => { e.preventDefault(); signOutUser(); }}>Log out</a>
          </div>
        </nav>
        <div className="content">
          {profile?.restricted && (
            <div className="alert warn" role="alert">
              <Icon name="alert" />
              <div><strong>Your shop is paused.</strong>Buyers can’t see your pieces and you can’t take new orders. Please still post your open orders.
                {reason && <><br /><span className="small muted">{REASON[reason] || reason}</span></>}</div>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </>
  );
}

/** A dashboard page a later package builds. */
export function DashboardStandIn({ title }) {
  return (
    <div className="empty"><h1>{title}</h1><p>This page isn’t built yet.</p></div>
  );
}
