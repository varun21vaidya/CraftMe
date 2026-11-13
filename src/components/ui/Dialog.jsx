import { useEffect, useId, useRef } from 'react';
import { Icon } from '../common/Icon';

/**
 * A modal on the native <dialog>: the browser gives the focus trap, the inert page, Escape and focus return.
 * `alert` makes it an alertdialog (backdrop clicks never close it, the safe first footer button gets focus).
 * `busy` blocks every way out while a request runs.
 */
export function Dialog({ open, onClose, title, alert = false, busy = false, footer, children }) {
  const ref = useRef(null);
  const opener = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return undefined;
    opener.current = document.activeElement;
    d.showModal();
    document.body.style.overflow = 'hidden';
    const field = alert ? null : d.querySelector('.modal-body input, .modal-body select, .modal-body textarea');
    (field || d.querySelector('.modal-foot button:not([disabled])') || d.querySelector('.modal-head button'))?.focus();
    return () => {
      if (d.open) d.close();
      document.body.style.overflow = '';
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, [open, alert]);

  return (
    <dialog ref={ref} className="modal" role={alert ? 'alertdialog' : 'dialog'} aria-labelledby={titleId} aria-busy={busy || undefined}
      onKeyDown={(e) => {
        // showModal() makes the page inert, but Tab past the last control still leaves for the browser's own UI
        if (e.key !== 'Tab') return;
        const all = [...ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter((el) => !el.disabled && el.offsetParent !== null);
        if (!all.length) return;
        const [first, last] = [all[0], all[all.length - 1]];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose?.(); }}
      onClick={(e) => { if (e.target === ref.current && !alert && !busy) onClose?.(); }}>
      {open && (
        <>
          <div className="modal-head">
            <h3 id={titleId}>{title}</h3>
            {!alert && <button type="button" className="iconbtn" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="x" size={20} /></button>}
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
