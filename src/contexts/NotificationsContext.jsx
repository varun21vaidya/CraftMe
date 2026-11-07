import { createContext, useContext, useMemo } from 'react';
import { useNotifications } from '../api/gateway';
import { useAuth } from './AuthContext';

const NotificationsContext = createContext({ items: [], unread: 0 });

/** One listener for the whole app (latest 20), however many components show notifications. */
export function NotificationsProvider({ children }) {
  const { currentUser } = useAuth();
  const [items] = useNotifications(currentUser?.uid);
  const value = useMemo(() => {
    const list = items || [];
    return { items: list, unread: list.filter((n) => !n.read).length };
  }, [items]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotificationList = () => useContext(NotificationsContext);
