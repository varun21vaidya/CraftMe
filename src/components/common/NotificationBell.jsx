import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationList } from '../../contexts/NotificationsContext';
import { notificationTarget, notificationText } from '../../lib/notifications';
import { Icon } from './Icon';

export function NotificationBell() {
  const { items, unread, markOne, markAll, reload } = useNotificationList();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    reload(); // never show a list that is up to 20 s old
    const outside = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload changes identity every render; run once per open
  }, [open]);

  const pick = (n) => {
    markOne(n.id);
    setOpen(false);
    const to = notificationTarget(n.type, n.data, currentUser?.uid);
    if (to) navigate(to);
  };

  return (
    <div className="dd" ref={box}>
      <button className="iconbtn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="count">{unread}</span>}
      </button>
      {open && (
        <div className="menu notif">
          <div className="mh" style={{ padding: '12px 14px 8px' }}>
            <span>Notifications</span>
            <Link to="/notifications" className="small">See all</Link>
            {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '2px 8px' }} onClick={markAll}>Mark all as read</button>}
          </div>
          {items.length === 0 && <p className="small muted" style={{ padding: '8px 14px 14px' }}>You’re all caught up.</p>}
          {items.map((n) => (
            <button key={n.id} className="item unread" onClick={() => pick(n)}>
              <span>
                <span className="t">{notificationText(n.type, n.data).title}</span>
                <span className="s">{new Date(n.createdAt).toLocaleString('en-IN')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
