import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotificationList } from '../../contexts/NotificationsContext';
import { notificationTarget } from '../../lib/notifications';
import { Icon } from './Icon';

// Wording per notification type; the data only carries ids and numbers.
const TEXT = {
  order_paid: (d) => `Payment received for order ${d.code}`,
  order_new: (d) => `New order ${d.code} to ship`,
  order_shipped: (d) => `Your order ${d.code} is on its way`,
  order_received: (d) => `Order ${d.code} was received`,
  order_refunded: (d) => `Your order ${d.code} was refunded`,
  ship_reminder: () => 'An order is waiting to be shipped',
  instagram_reconnect: () => 'Reconnect Instagram to keep your posts showing',
};

export function NotificationBell() {
  const { items, unread, markOne, markAll, reload } = useNotificationList();
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
    const to = notificationTarget(n.type, n.data);
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
            {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '2px 8px' }} onClick={markAll}>Mark all as read</button>}
          </div>
          {items.length === 0 && <p className="small muted" style={{ padding: '8px 14px 14px' }}>You’re all caught up.</p>}
          {items.map((n) => (
            <button key={n.id} className="item unread" onClick={() => pick(n)}>
              <span>
                <span className="t">{(TEXT[n.type] || (() => 'Update'))(n.data || {})}</span>
                <span className="s">{new Date(n.createdAt).toLocaleString('en-IN')}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
