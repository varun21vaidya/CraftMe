const STEPS = ['Paid', 'Shipped', 'Received'];

/** Paid, Shipped, Received. A refunded Order keeps the steps it reached and has no current step. */
export function StageTracker({ order }) {
  const reached = order.receivedAt ? 3 : order.shippedAt ? 2 : order.paidAt ? 1 : 0;
  const current = order.stage === 'refunded' ? -1 : reached;
  return (
    <ol className="stepper" aria-label="Order stages">
      {STEPS.map((s, i) => {
        const state = i < reached ? 'done' : i === current ? 'now' : '';
        return (
          <li key={s} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            {state === 'done' && <span className="sr">done </span>}{s}
          </li>
        );
      })}
    </ol>
  );
}
