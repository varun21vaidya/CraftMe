import { useEffect, useState } from 'react';

/** Milliseconds left until expiresAt (epoch ms), ticking once a second; the timer stops on unmount. */
export function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => Math.max(0, (expiresAt || 0) - Date.now()));
  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setLeft(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}
