import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { refreshClaims as fetchFreshClaims, watchAuth } from '../api/gateway';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ currentUser: null, loading: true });

  useEffect(() => watchAuth((currentUser) => setState({ currentUser, loading: false })), []);

  // Only after a command that changes roles (becomeArtist, setRole): a normal sign-in reads the cached token.
  const refreshClaims = useCallback(async () => {
    const claims = await fetchFreshClaims();
    setState((s) => ({ ...s, currentUser: s.currentUser && { ...s.currentUser, claims } }));
  }, []);

  const value = useMemo(() => ({
    currentUser: state.currentUser,
    loading: state.loading,
    isArtist: state.currentUser?.claims?.artist === true,
    isAdmin: state.currentUser?.claims?.admin === true,
    refreshClaims,
  }), [state, refreshClaims]);

  return <AuthContext.Provider value={value}>{state.loading ? null : children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
