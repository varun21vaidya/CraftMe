import { useSyncExternalStore } from 'react';
import { currentTheme, subscribeTheme, toggleTheme } from '../../lib/theme';

/** Footer button. Its label names the theme you would switch to. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme);
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={toggleTheme}>
      {theme === 'dark' ? 'Light theme' : 'Dark theme'}
    </button>
  );
}
