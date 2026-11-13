/** Numbered steps; those before `current` are done. current = steps.length marks every step done. */
export function Stepper({ steps, current, label }) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : '';
        return (
          <li key={s} className={state} aria-current={state === 'now' ? 'step' : undefined}>
            {state === 'done' && <span className="sr">done </span>}{s}
          </li>
        );
      })}
    </ol>
  );
}
