import { useEffect } from 'react';

// One active "unsaved changes" guard at a time. A form registers a function
// that returns true while it holds unsaved edits; App asks before any in-app
// navigation or browser Back/Forward leaves the page.
//
// handlesPopstate: the form manages browser Back itself (e.g. a form opened
// inside a page with its own history marker), so App should not intercept Back.
// message: what the leave prompt says, e.g. while a save is still running.
let current = null;

export function setNavigationGuard(isDirty, { handlesPopstate = false, message = '' } = {}) {
  const entry = { isDirty, handlesPopstate, message };
  current = entry;
  return () => { if (current === entry) current = null; };
}

export function shouldConfirmLeave(kind) {
  if (!current) return false;
  if (kind === 'popstate' && current.handlesPopstate) return false;
  try { return Boolean(current.isDirty()); } catch { return false; }
}

export const navigationGuardMessage = () => current?.message || '';

export function clearNavigationGuard() {
  current = null;
}

// Guards the page (in-app navigation, Back/Forward and reload/close) while
// `active` is true.
export function useLeaveGuard(active, { handlesPopstate = false, message = '' } = {}) {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    const release = setNavigationGuard(() => true, { handlesPopstate, message });
    return () => { window.removeEventListener('beforeunload', warn); release(); };
  }, [active, handlesPopstate, message]);
}

// ---------------------------------------------------------------------------
// History entries carry their position so a cancelled Back/Forward can be
// undone by moving the same distance the other way -- pushing a new entry
// instead would wipe the Forward history and duplicate the current page.
// ---------------------------------------------------------------------------
const IDX = '__navIdx';
let currentIndex = 0;

const indexOf = (state) => (state && Number.isInteger(state[IDX]) ? state[IDX] : null);

// Called once on load: adopt the entry's index (kept across reloads) or tag it.
export function initHistoryIndex() {
  const idx = indexOf(window.history.state);
  if (idx === null) window.history.replaceState({ ...(window.history.state || {}), [IDX]: currentIndex }, '');
  else currentIndex = idx;
}

export function pushHistory(state, url) {
  currentIndex += 1;
  window.history.pushState({ ...(state || {}), [IDX]: currentIndex }, '', url);
}

export function replaceHistory(state, url) {
  window.history.replaceState({ ...(state || {}), [IDX]: currentIndex }, '', url);
}

// How far the browser just moved (negative = Back), or null when unknown.
export function historyDelta(state) {
  const idx = indexOf(state);
  return idx === null ? null : idx - currentIndex;
}

export const entryIndex = indexOf;
export const currentHistoryIndex = () => currentIndex;

export function syncHistoryIndex(state) {
  const idx = indexOf(state);
  if (idx !== null) currentIndex = idx;
}
