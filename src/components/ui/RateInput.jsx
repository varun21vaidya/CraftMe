import { useId } from 'react';
import { Icon } from '../common/Icon';

/** Five stars as a radio group, so the arrow keys work. value 0 = nothing chosen. */
export function RateInput({ value, onChange, labelledBy, disabled = false }) {
  const name = useId();
  return (
    <div className="rate-input" role="radiogroup" aria-labelledby={labelledBy}>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={value >= n ? 'on' : ''}>
          <input type="radio" className="sr" name={name} value={n} checked={value === n} disabled={disabled}
            aria-label={`${n} star${n > 1 ? 's' : ''}`} onChange={() => onChange(n)} />
          <Icon name="star" size={34} />
        </label>
      ))}
    </div>
  );
}
