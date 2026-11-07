import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/** Signed-in users only; remembers where to return after logging in. */
export function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  const here = useLocation();
  return currentUser ? children : <Navigate to="/login" replace state={{ from: here.pathname }} />;
}

/** One place for role checks on the client. These only hide screens: the backend and the rules decide for real. */
export function RoleRoute({ role, children }) {
  const { currentUser, isArtist, isAdmin } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  const allowed = role === 'admin' ? isAdmin : isArtist;
  return allowed ? children : <Navigate to="/" replace />;
}
