import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../common/Icon';
import { errorText } from '../../lib/format';

/** The fee is recorded and the phone is verified: grant the role. Runs once on arrival (a reload lands here too) and again on "Try again". */
export function FinishStep({ onOpened }) {
  const { refreshClaims } = useAuth();
  const [state, setState] = useState('working'); // working | failed
  const [problem, setProblem] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const started = useRef(false);

  const run = async () => {
    setState('working');
    const res = await call('becomeArtist', { requestId: requestId.current });
    if (!res.ok) { setProblem(errorText(res.error)); setState('failed'); requestId.current = crypto.randomUUID(); return; }
    await refreshClaims(); // the role lives in the token: refresh it before the dashboard checks it
    onOpened();
  };
  useEffect(() => { if (!started.current) { started.current = true; run(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'working') return <div className="panel" role="status"><h3>Opening your shop…</h3></div>;
  return (
    <div className="alert warn" role="alert">
      <Icon name="alert" />
      <div><strong>Your payment is recorded.</strong>We couldn’t open your shop yet.{problem && <><br /><span className="small muted">{problem}</span></>}<br />
        <button className="btn btn-primary btn-sm" onClick={run}>Try again</button></div>
    </div>
  );
}

/** An Artist's welcome, and what an existing Artist sees at /become-artist. */
export function DoneStep({ onboarding }) {
  const checked = Boolean(onboarding?.verifiedAt);
  return (
    <section className="stack center" style={{ justifyItems: 'center', maxWidth: 620, margin: '0 auto' }} role="status">
      <div className="avatar xl" style={{ background: 'var(--ok-soft)', color: 'var(--ok)', borderColor: 'transparent' }}><Icon name="check" size={40} /></div>
      <h1>You’re an Artist on CraftMe</h1>
      <p className="lead">Your shop is ready for its first piece.</p>
      <div className="panel stack" style={{ width: '100%', textAlign: 'left' }}>
        <h4>Your first steps</h4>
        <ul className="list">
          <li><span className="badge ok">Done</span> Open your shop</li>
          <li><span className="badge accent">Next</span><Link to="/dashboard/artworks/new" className="grow">Add your first Artwork</Link><Icon name="chevron-right" size={16} /></li>
          <li><span className="badge">Optional</span><Link to="/dashboard/instagram" className="grow">Connect Instagram</Link><Icon name="chevron-right" size={16} /></li>
          <li>{checked ? <span className="badge ok">Done</span> : <span className="badge warn">Pending</span>}<span className="grow muted">We’re checking your details so you can be paid</span></li>
        </ul>
      </div>
      <Link className="btn btn-primary btn-lg" to="/dashboard/orders">Go to my dashboard</Link>
    </section>
  );
}
