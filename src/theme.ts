import { useSyncExternalStore } from 'react';

// Colour theme: 'auto' follows the operating system; the CSS reads data-theme on <html>.
export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'sg.theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let theme = read();

function apply() {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Call once before the first render, so the page never flashes the wrong theme. */
export const initTheme = apply;

export function setTheme(next: Theme) {
  theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  apply();
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => theme,
  );
}
