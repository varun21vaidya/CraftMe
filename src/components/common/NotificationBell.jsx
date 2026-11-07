import { useState } from 'react';
import { markRead } from '../../api/gateway';
import { useNotificationList } from '../../contexts/NotificationsContext';
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
  const { items, unread } = useNotificationList();
  const [open, setOpen] = useState(false);

  return (
    <div className="dd">
      <button className="iconbtn" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="count">{unread}</span>}
      </button>
      {open && (
        <div className="menu notif">
          <div className="mh" style={{ padding: '12px 14px 8px' }}><span>Notifications</span></div>
          {items.length === 0 && <p className="small muted" style={{ padding: '8px 14px 14px' }}>Nothing new.</p>}
          {items.map((n) => (
            <button key={n.id} className={`item${n.read ? '' : ' unread'}`} onClick={() => !n.read && markRead(n.id)}>
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
