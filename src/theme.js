// Light/dark theme. The choice is remembered per browser in localStorage;
// index.html applies it before the first paint so pages never flash the
// other theme. Light is the default (the app's original look).
export const THEME_KEY = 'ne2.theme';

export function readTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark-theme', dark);
  document.body?.classList.toggle('dark-theme', dark);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', dark ? 'dark' : 'light');
}

export function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* not remembered */ }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('ne2-theme-change', { detail: theme }));
}
