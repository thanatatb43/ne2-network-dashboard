// One active "unsaved changes" guard at a time. A form registers a function
// that returns true while it holds unsaved edits; App asks before any in-app
// navigation or browser Back leaves the page.
//
// handlesPopstate: the form manages browser Back itself (e.g. a form opened
// inside a page with its own history marker), so App should not intercept Back.
let current = null;

export function setNavigationGuard(isDirty, { handlesPopstate = false } = {}) {
  const entry = { isDirty, handlesPopstate };
  current = entry;
  return () => { if (current === entry) current = null; };
}

export function shouldConfirmLeave(kind) {
  if (!current) return false;
  if (kind === 'popstate' && current.handlesPopstate) return false;
  try { return Boolean(current.isDirty()); } catch { return false; }
}

export function clearNavigationGuard() {
  current = null;
}
