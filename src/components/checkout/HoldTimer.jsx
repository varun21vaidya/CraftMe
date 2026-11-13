import { useEffect } from 'react';
import { Icon } from '../common/Icon';
import { formatClock } from '../../lib/format';
import { useCountdown } from '../../lib/useCountdown';

/** "Almost yours, 14:32". deadline is in device time (already corrected by serverNow). Calls onExpire once at zero. */
export function HoldTimer({ deadline, onExpire }) {
  const left = useCountdown(deadline);
  useEffect(() => { if (deadline && left === 0) onExpire?.(); }, [left, deadline, onExpire]);
  if (!left) return null;
  return (
    <div className="panel" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' }}>
      <div className="row between"><span className="row"><Icon name="clock" /><strong>Almost yours</strong></span>
        <span className="countdown" role="timer" aria-label={`${formatClock(left)} left to pay`}>{formatClock(left)}</span></div>
      <p className="small muted" style={{ marginTop: 6 }}>Finish paying in time to keep these pieces.</p>
    </div>
  );
}
