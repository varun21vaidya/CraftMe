// The choice lives in localStorage['cm-theme']; with none stored the system setting is followed (styles.css does that).
const KEY = 'cm-theme';
const listeners = new Set();

const stored = () => { try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
const system = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** What the page shows right now. */
export const currentTheme = () => stored() || system();

/** Call before the first paint (top of index.jsx). */
export function initTheme() {
  const t = stored();
  if (t) document.documentElement.dataset.theme = t;
}

export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked: the choice lasts until reload */ }
  listeners.forEach((fn) => fn());
}

export const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

/** For useSyncExternalStore. */
export const subscribeTheme = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
