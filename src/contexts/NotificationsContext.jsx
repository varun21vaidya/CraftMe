import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { markAllRead, markRead, useNotifications } from '../api/gateway';
import { useAuth } from './AuthContext';

const none = async () => {};
const NotificationsContext = createContext({ items: [], unread: 0, markOne: none, markAll: none, reload: () => {} });

/**
 * One listener for the whole app (latest 20), however many components show notifications.
 * Only unread ones are listed. A notification you just read leaves at once (before the server answers) and
 * comes back if the update fails.
 */
export function NotificationsProvider({ children }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [items, , , reload] = useNotifications(uid);
  const [gone, setGone] = useState(() => new Set());

  const hide = useCallback((ids) => setGone((s) => new Set([...s, ...ids])), []);
  const restore = useCallback((ids) => setGone((s) => new Set([...s].filter((id) => !ids.includes(id))))
    , []);

  const list = useMemo(() => (items || []).filter((n) => !n.read && !gone.has(n.id)), [items, gone]);

  const value = useMemo(() => {
    const run = async (ids, send) => {
      if (!ids.length) return;
      hide(ids);
      const res = await send();
      if (!res.ok) restore(ids);
      reload();
    };
    return {
      items: list,
      unread: list.length,
      markOne: (id) => run([id], () => markRead(id)),
      markAll: () => run(list.map((n) => n.id), () => markAllRead(uid)),
      reload,
    };
  }, [list, uid, hide, restore, reload]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotificationList = () => useContext(NotificationsContext);
