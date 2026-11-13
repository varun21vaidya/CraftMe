import { useId } from 'react';
import { Icon } from '../common/Icon';

/** Minus, the number, plus. Going below `min` calls onChange(min - 1) so the caller can remove the line. */
export function QtyStepper({ value, min = 1, max, onChange, label, disabled = false }) {
  const hint = useId();
  const atMax = value >= max;
  return (
    <div className="stack sm">
      <div className="qty" role="group" aria-label={label}>
        <button type="button" aria-label="Decrease quantity" disabled={disabled} onClick={() => onChange(value - 1)}><Icon name="minus" size={16} /></button>
        <input readOnly value={value} aria-label={label} aria-describedby={atMax ? hint : undefined} />
        <button type="button" aria-label="Increase quantity" disabled={disabled || atMax} onClick={() => onChange(Math.min(value + 1, max))}><Icon name="plus" size={16} /></button>
      </div>
      {atMax && value >= min && <span id={hint} className="hint">That&apos;s all there is.</span>}
    </div>
  );
}
