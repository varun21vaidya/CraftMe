import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Six one-digit boxes for a code. value is the digits typed so far (a string of up to 6). Typing moves forward, Backspace on an
 * empty box moves back, and a pasted code (or a browser's one-time-code autofill) fills every box. ref.focus() focuses the first box.
 */
export const CodeInput = forwardRef(function CodeInput({ value, onChange, label = '6-digit code', disabled = false, invalid = false }, ref) {
  const boxes = useRef([]);
  // value keeps a blank as a space, so clearing a middle box does not slide the later digits left
  const cells = Array.from({ length: 6 }, (_, i) => (value[i] === ' ' ? '' : value[i] ?? ''));
  const join = (list) => list.map((c) => c || ' ').join('').replace(/ +$/, '');
  useImperativeHandle(ref, () => ({ focus: () => boxes.current[0]?.focus() }));

  const fill = (digits, from = 0) => {
    const next = join(cells.slice(0, from)) + digits;
    onChange(next.slice(0, 6));
    boxes.current[Math.min(from + digits.length, 5)]?.focus();
  };
  const change = (i, e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { onChange(join(cells.map((c, k) => (k === i ? '' : c)))); return; }
    if (digits.length === 1) {
      onChange(join(cells.map((c, k) => (k === i ? digits : c))));
      boxes.current[Math.min(i + 1, 5)]?.focus();
    } else fill(digits, 0); // a whole code arrived in one box
  };
  const key = (i, e) => {
    if (e.key === 'Backspace' && !cells[i] && i > 0) {
      e.preventDefault();
      onChange(join(cells.map((c, k) => (k === i - 1 ? '' : c))));
      boxes.current[i - 1]?.focus();
    }
  };
  const paste = (e) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    e.preventDefault();
    fill(digits, 0);
  };

  return (
    <div className="otp" role="group" aria-label={label}>
      {cells.map((c, i) => (
        <input
          key={i} ref={(el) => { boxes.current[i] = el; }} value={c} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`} aria-invalid={invalid || undefined} disabled={disabled}
          onChange={(e) => change(i, e)} onKeyDown={(e) => key(i, e)} onPaste={paste} onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
});
