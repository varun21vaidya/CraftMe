import { useRef } from 'react';

/**
 * tabs: [{ id, label, count? }]. Left/Right move, Home/End jump; only the selected tab is in the tab order.
 * The caller keeps the value (in the URL with ?tab= when it should survive a reload). controls: id of the tabpanel.
 */
export function Tabs({ label, tabs, value, onChange, controls }) {
  const list = useRef(null);
  const move = (e) => {
    const at = tabs.findIndex((t) => t.id === value);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    onChange(next.id);
    list.current.querySelector(`[data-tab="${next.id}"]`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={list} onKeyDown={move}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" className="tab" data-tab={t.id} id={`tab-${t.id}`}
          aria-selected={t.id === value} aria-controls={controls} tabIndex={t.id === value ? 0 : -1} onClick={() => onChange(t.id)}>
          {t.label}{t.count !== undefined && <span className={`badge${t.tone ? ` ${t.tone}` : ''}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
