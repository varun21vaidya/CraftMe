import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../common/Icon';

/**
 * A button that opens a list. items: { to, label, icon } | { onSelect, label, icon } | 'divider'.
 * `button` is text (a labelled button) or an element (an icon button named by `label`).
 * Opens on click, Enter, Space or Down; Up/Down move, Escape closes and returns focus, an outside click closes.
 */
export function Menu({ label, button, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const entries = () => [...root.current.querySelectorAll('[role="menuitem"]')];
  const close = (refocus) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  const text = typeof button === 'string';

  useEffect(() => {
    if (!open) return undefined;
    entries()[0]?.focus();
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const move = (e) => {
    const list = entries();
    const at = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') list[(at + 1) % list.length]?.focus();
    else if (e.key === 'ArrowUp') list[(at - 1 + list.length) % list.length]?.focus();
    else if (e.key === 'Home') list[0]?.focus();
    else if (e.key === 'End') list.at(-1)?.focus();
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') { close(false); return; }
    else return;
    e.preventDefault();
  };

  return (
    <div className="dd" ref={root}>
      <button ref={trigger} type="button" className={text ? 'btn btn-ghost btn-sm' : 'iconbtn'} aria-label={text ? undefined : label}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>
        {button}
      </button>
      {open && (
        <div className={`menu${align === 'left' ? ' left' : ''}`} id={id} role="menu" aria-label={label} onKeyDown={move}>
          {items.map((item, i) => {
            if (item === 'divider') return <hr key={i} role="separator" />;
            const inner = <>{item.icon && <Icon name={item.icon} size={18} />}{item.label}</>;
            return item.to
              ? <Link key={i} role="menuitem" to={item.to} onClick={() => close(false)}>{inner}</Link>
              : <button key={i} type="button" role="menuitem" onClick={() => { close(true); item.onSelect(); }}>{inner}</button>;
          })}
        </div>
      )}
    </div>
  );
}
