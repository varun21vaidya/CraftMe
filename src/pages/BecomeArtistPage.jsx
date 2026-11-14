import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOnboarding, useSwitches } from '../api/gateway';
import { DetailsStep } from '../components/onboarding/DetailsStep';
import { DoneStep, FinishStep } from '../components/onboarding/DoneStep';
import { FeeStep } from '../components/onboarding/FeeStep';
import { PhoneStep } from '../components/onboarding/PhoneStep';
import { Icon } from '../components/common/Icon';
import { Stepper } from '../components/ui/Stepper';
import { useAuth } from '../contexts/AuthContext';
import { detailsFrom, nextStep } from '../lib/onboarding';

const STEPS = ['Your details', 'Verify phone', 'Open your shop'];
const AT = { step1: 0, step2: 1, step3: 2, finish: 2 };

/** /become-artist: the step shown is the one the server state allows, so a reload or a second device resumes in the right place. */
export default function BecomeArtistPage() {
  const { currentUser, isArtist, profile, profileLoading } = useAuth();
  const [switches, switchesLoading] = useSwitches();
  const [onboarding, loading, error, reload] = useOnboarding(currentUser.uid);
  const [params, setParams] = useSearchParams();
  const [twice, setTwice] = useState(false);

  if (loading || switchesLoading || profileLoading) return <main className="wrap mid page" aria-busy="true"><p className="muted">Loading…</p></main>;
  if (error) {
    return (
      <main className="wrap mid page"><div className="alert err" role="alert"><Icon name="alert" /><div>We couldn’t load your details.<br />
        <button className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div></div></main>
    );
  }
  if (isArtist) return <main className="wrap mid page"><DoneStep onboarding={onboarding} /></main>;

  if (switches?.acceptArtists !== true) {
    return (
      <main className="wrap mid page">
        <div className="stack center" style={{ justifyItems: 'center', textAlign: 'center' }}>
          <h1>Become an Artist</h1>
          <p className="lead">CraftMe isn’t taking new Artists right now.</p>
          <Link className="btn btn-primary" to="/browse">Browse art</Link>
        </div>
      </main>
    );
  }

  const server = nextStep({ isArtist, onboarding });
  const step = params.get('step') === '1' ? 'step1' : server; // ?step=1 goes back to edit the details
  const afterDetails = () => { setParams({}, { replace: true }); reload(); };

  return (
    <main className="wrap mid page">
      <div className="page-head"><div><span className="eyebrow">Sell on CraftMe</span><h1>Become an Artist</h1><p>Three short steps. You can keep buying with the same Account.</p></div></div>
      <Stepper steps={STEPS} current={AT[step]} label="Steps to become an Artist" />
      {twice && <div className="alert warn" role="status"><Icon name="info" /><div>You were charged twice. The second payment is being returned.</div></div>}
      {step === 'step1' && <DetailsStep initial={detailsFrom(profile, onboarding)} onSaved={afterDetails} />}
      {step === 'step2' && <PhoneStep onBack={() => setParams({ step: '1' })} onVerified={reload} />}
      {step === 'step3' && <FeeStep onPaid={reload} onTwice={() => setTwice(true)} />}
      {step === 'finish' && <FinishStep onOpened={reload} />}
    </main>
  );
}
