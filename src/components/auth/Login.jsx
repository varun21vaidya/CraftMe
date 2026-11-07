import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signInWithGoogle } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { errorText } from '../../lib/format';

export function Login() {
  const { currentUser } = useAuth();
  const from = useLocation().state?.from || '/';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (currentUser) return <Navigate to={from} replace />;

  const go = async () => {
    setBusy(true);
    const res = await signInWithGoogle();
    setBusy(false);
    if (!res.ok) setError(errorText(res.error));
  };

  return (
    <main className="wrap page" style={{ maxWidth: 420 }}>
      <div className="panel stack">
        <h1>Welcome to CraftMe</h1>
        <p className="muted">Original art and prints from independent Indian Artists.</p>
        <button className="btn btn-primary btn-lg btn-block" onClick={go} disabled={busy}>
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>
    </main>
  );
}
