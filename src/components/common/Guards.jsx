import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { TermsGate } from '../account/TermsGate';
import { useToast } from '../ui/Toast';

/** Signed-in users only; sends everyone else to /login (which remembers where they were going) and asks for the Terms on the first visit. */
export function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  const here = useLocation();
  if (!currentUser) return <Navigate to="/login" replace state={{ from: here.pathname + here.search }} />;
  return <>{children}<TermsGate /></>;
}

function NoAccess() {
  const toast = useToast();
  const told = useRef(false);
  useEffect(() => {
    if (told.current) return;
    told.current = true;
    toast("You don't have access to that page.", { kind: 'err' });
  }, [toast]);
  return <Navigate to="/" replace />;
}

/** One place for role checks on the client. These only hide screens: the backend and the rules decide for real. */
export function RoleRoute({ role, children }) {
  const { currentUser, isArtist, isAdmin } = useAuth();
  const here = useLocation();
  if (!currentUser) return <Navigate to="/login" replace state={{ from: here.pathname + here.search }} />;
  return (role === 'admin' ? isAdmin : isArtist) ? <>{children}<TermsGate /></> : <NoAccess />;
}
