import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { INSTAGRAM_CHANNEL, instagramMessage } from '../lib/instagram';

// Meta's login popup ends here. Tell the profile tab, then close. If this isn't a closable popup
// (popup blocked, or the browser cut the link to the opener), go to the profile page instead.
export default function InstagramReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const result = params.get('instagram');
  const reason = params.get('reason');

  useEffect(() => {
    try {
      const ch = new BroadcastChannel(INSTAGRAM_CHANNEL);
      ch.postMessage({ result, reason });
      ch.close();
    } catch { /* very old browser: the profile page shows the result after the redirect below */ }
    window.close();
    const fallback = setTimeout(() => {
      const q = new URLSearchParams({ instagram: result || 'error', ...(reason ? { reason } : {}) });
      navigate(`/dashboard/profile?${q}`, { replace: true });
    }, 1500);
    return () => clearTimeout(fallback);
  }, [navigate, reason, result]);

  return (
    <main className="wrap page" style={{ maxWidth: 560 }}>
      <p className="alert info" role="status">{instagramMessage(result, reason) || 'Finishing…'}</p>
      <p className="small muted">You can close this window. <Link to="/dashboard/profile">Back to your profile</Link></p>
    </main>
  );
}
