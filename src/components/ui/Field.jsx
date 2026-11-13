import { Children, cloneElement, isValidElement } from 'react';
import { Icon } from '../common/Icon';

/**
 * A labelled form field. The single child control gets its id, aria-describedby (hint, error, counter), aria-invalid and
 * aria-required. `counter` = { value, max } draws "12/120".
 */
export function Field({ id, label, hint, error, required = false, optional = false, counter, className = '', children }) {
  const parts = [hint && `${id}-hint`, error && `${id}-err`, counter && `${id}-count`].filter(Boolean);
  const control = Children.only(children);
  const wired = (el) => cloneElement(el, {
    id, 'aria-describedby': parts.join(' ') || undefined, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined,
  });
  // an input-group wraps the control: wire the input inside it
  const body = isValidElement(control) && control.props.className?.includes('input-group')
    ? cloneElement(control, {}, Children.map(control.props.children, (c) => (isValidElement(c) && c.type === 'input' ? wired(c) : c)))
    : wired(control);
  return (
    <div className={`field${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>{label} {required && <span className="req" aria-hidden="true">*</span>}{optional && <span className="opt">optional</span>}</label>
      {body}
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {hint && error && <span className="sr" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="error-msg" id={`${id}-err`}><Icon name="alert" size={14} />{error}</span>}
      {counter && <span className="counter" id={`${id}-count`}>{counter.value.length}/{counter.max}</span>}
    </div>
  );
}
