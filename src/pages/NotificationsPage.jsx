import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { markAllRead, markRead, NOTIFICATIONS_PAGE, useNotificationsPage } from '../api/gateway';
import { Icon } from '../components/common/Icon';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationList } from '../contexts/NotificationsContext';
import { formatAgo } from '../lib/format';
import { notificationTarget, notificationText } from '../lib/notifications';

const FILTERS = ['all', 'unread', 'orders', 'reviews'];
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function Row({ n, me, onOpen }) {
  const text = notificationText(n.type, n.data);
  const to = notificationTarget(n.type, n.data, me);
  const body = (
    <>
      <span className="nic" aria-hidden="true"><Icon name={text.icon} size={18} /></span>
      <span className="grow">
        <span className="nt">{text.title}</span>
        {text.detail && <span className="small muted">{text.detail}</span>}
      </span>
      {!n.read && <span className="badge accent">New</span>}
      <time dateTime={new Date(n.createdAt).toISOString()}>{formatAgo(n.createdAt)}</time>
    </>
  );
  const cls = `notif-row${n.read ? '' : ' unread'}`;
  return to
    ? <Link className={cls} to={to} onClick={(e) => { e.preventDefault(); onOpen(n, to); }}>{body}</Link>
    : <div className={cls} onClick={() => onOpen(n, null)} role="presentation">{body}</div>;
}

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const { reload: reloadBell } = useNotificationList();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.includes(params.get('filter')) ? params.get('filter') : 'all';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const [data, loading, error, reload] = useNotificationsPage(currentUser.uid, { filter, page });
  const [marking, setMarking] = useState(false);

  const go = (next) => setParams((p) => {
    const q = new URLSearchParams(p);
    Object.entries(next).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    return q;
  });
  const open = async (n, to) => {
    if (!n.read) { await markRead(n.id); reloadBell(); } // a failed mark never stops the reader getting there
    if (to) navigate(to); else reload();
  };
  const markAll = async () => {
    setMarking(true);
    const res = await markAllRead(currentUser.uid);
    setMarking(false);
    if (!res.ok) { toast('We couldn’t mark them all as read. Try again.', { kind: 'err' }); return; }
    reload();
    reloadBell();
  };

  const pages = data ? Math.max(1, Math.ceil(data.count / NOTIFICATIONS_PAGE)) : 1;
  const today = (data?.rows || []).filter((n) => sameDay(n.createdAt, Date.now()));
  const earlier = (data?.rows || []).filter((n) => !sameDay(n.createdAt, Date.now()));
  const chips = [['all', 'All'], ['unread', data ? `Unread ${data.unread}` : 'Unread'], ['orders', 'Orders'], ['reviews', 'Reviews']];
  const group = (title, rows) => rows.length > 0 && (
    <section className="panel flush" aria-label={title}>
      <h2 className="panel-head" style={{ fontSize: '1rem' }}>{title}</h2>
      {rows.map((n) => <Row key={n.id} n={n} me={currentUser.uid} onOpen={open} />)}
    </section>
  );

  return (
    <main className="wrap mid page">
      <div className="page-head">
        <div><h1>Notifications</h1><p>Order updates, Review decisions and refunds.</p></div>
        {data?.unread > 0 && <button type="button" className="btn btn-secondary" disabled={marking} onClick={markAll}>Mark all as read</button>}
      </div>
      <div className="chips" role="group" aria-label="Filter notifications">
        {chips.map(([id, label]) => (
          <button key={id} type="button" className="chip" aria-pressed={filter === id} onClick={() => go({ filter: id === 'all' ? null : id, page: null })}>{label}</button>
        ))}
      </div>
      <div className="stack">
        {loading && !data && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 68 }} aria-busy="true" />)}
        {error && !data && (
          <div className="alert err" role="alert"><Icon name="alert" /><div>We couldn&apos;t load your notifications.{' '}
            <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div></div>
        )}
        {data && data.count === 0 && filter === 'all' && (
          <div className="empty"><div className="ic-wrap"><Icon name="bell" size={26} /></div><h3>You&apos;re all caught up.</h3>
            <p>Order updates, Review decisions and refunds appear here.</p><Link className="btn btn-primary" to="/browse">Browse art</Link></div>
        )}
        {data && data.count === 0 && filter !== 'all' && <div className="empty"><h3>Nothing here.</h3></div>}
        {group('Today', today)}
        {group('Earlier', earlier)}
      </div>
      <Pagination page={page} pages={pages} onPage={(n) => go({ page: n > 1 ? String(n) : null })} />
    </main>
  );
}
