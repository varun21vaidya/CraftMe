import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { refreshClaims as fetchFreshClaims, useMyProfile, watchAuth } from '../api/gateway';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ currentUser: null, loading: true });
  // the signed-in person's profile row (terms acceptance lives on it); undefined until loaded
  const [profile, profileLoading, profileError, reloadProfile] = useMyProfile(state.currentUser?.uid);

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
    profile: state.currentUser ? profile ?? undefined : undefined,
    profileLoading: Boolean(state.currentUser) && profileLoading,
    profileError: state.currentUser ? profileError : undefined,
    reloadProfile,
    refreshClaims,
  }), [state, profile, profileLoading, profileError, reloadProfile, refreshClaims]);

  return <AuthContext.Provider value={value}>{state.loading ? null : children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
