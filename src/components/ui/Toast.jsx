import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from '../common/Icon';

const ToastContext = createContext(() => {});
const SHOW_MS = 4000;
const MAX = 3;

/** Mount once inside BrowserRouter. Fire a toast only after the server has answered; it never replaces an inline field error. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const next = useRef(0);
  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((text, { kind = 'ok' } = {}) => {
    const id = ++next.current;
    setItems((list) => [...list, { id, text, kind }].slice(-MAX));
    setTimeout(() => dismiss(id), SHOW_MS);
  }, [dismiss]);
  const render = (t, role) => (
    <div className={`toast${t.kind === 'err' ? ' err' : ''}`} key={t.id} role={role}>
      <span style={{ flex: 1 }}>{t.text}</span>
      <button type="button" className="iconbtn" style={{ width: 28, height: 28, color: 'inherit', pointerEvents: 'auto' }} aria-label="Close notification" onClick={() => dismiss(t.id)}><Icon name="x" size={16} /></button>
    </div>
  );
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts">
        <div aria-live="polite" style={{ display: 'grid', gap: 8 }}>{items.filter((t) => t.kind !== 'err').map((t) => render(t))}</div>
        <div style={{ display: 'grid', gap: 8 }}>{items.filter((t) => t.kind === 'err').map((t) => render(t, 'alert'))}</div>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
