import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signInWithGoogle, useFeaturedArtwork } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { rememberReturn, takeReturn } from '../../lib/returnTo';

/** Google sends a refusal back as ?error=... or #error=...; either means the person did not finish. */
const cameBackWithError = ({ search, hash }) => new URLSearchParams(search).has('error') || new URLSearchParams(hash.replace(/^#/, '')).has('error');

export function Login() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => (cameBackWithError(window.location) ? 'cancelled' : null));
  const [featured] = useFeaturedArtwork(!currentUser);
  const left = useRef(false);

  // Remember where the person was going as soon as they land here, so a sign-in that completes in another way still returns there.
  useEffect(() => { if (!currentUser && from) rememberReturn(from); }, [currentUser, from]);
  // The error stays out of the address bar once it is shown.
  useEffect(() => {
    if (error === 'cancelled' && cameBackWithError(window.location)) navigate('/login', { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  // Signed in (just now, or already): go where they were headed, once.
  useEffect(() => {
    if (!currentUser || left.current) return;
    left.current = true;
    navigate(takeReturn(), { replace: true });
  }, [currentUser, navigate]);

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await signInWithGoogle(from);
    if (!res.ok) { setBusy(false); setError('unreachable'); } // on success the browser is already leaving for Google
  };

  return (
    <main className="wrap page login">
      <div className="login-grid">
        <div className="panel stack login-card">
          <h1>Welcome to CraftMe</h1>
          <p className="muted">Original art and prints from independent Indian Artists.</p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={go} disabled={busy}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {error === 'cancelled' && <p className="error-msg" role="alert">Google sign-in was cancelled. Try again when you&apos;re ready.</p>}
          {error === 'unreachable' && <p className="error-msg" role="alert">We couldn&apos;t reach Google. Try again.</p>}
          <p className="small muted">By continuing you agree to the <Link to="/legal/terms">Terms</Link> and <Link to="/legal/privacy">Privacy policy</Link>.</p>
        </div>
        {featured && (
          <aside className="login-art" aria-label="Featured artwork">
            <Link to={`/artwork/${featured.id}`}>
              <div className="mat"><img src={featured.photos?.[0]} alt={featured.title} /></div>
              <p><strong>{featured.title}</strong>{featured.year ? `, ${featured.year}` : ''}</p>
              <p className="small muted">{featured.artist?.displayName}{featured.artist?.city ? `, ${featured.artist.city}` : ''}</p>
            </Link>
          </aside>
        )}
      </div>
    </main>
  );
}
