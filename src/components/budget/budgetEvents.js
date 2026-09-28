// Tells open pages that an upload replaced the source budget transactions of
// one account + year. Source transaction IDs change on every upload, so any
// picker still holding IDs from that scope must drop them and search again.
// Same tab: a window event; other tabs of the app: a BroadcastChannel. This
// is a courtesy, not a guarantee -- another client can still upload at any
// time, so a stale ID can also surface as an error when linking.
const EVENT = 'budget-source-replaced';
const CHANNEL = 'ne2-budget-source';

export function announceBudgetSourceReplaced(detail) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(detail);
    channel.close();
  } catch { /* BroadcastChannel unavailable: same-tab only */ }
}

export function onBudgetSourceReplaced(callback) {
  const onEvent = (e) => callback(e.detail || {});
  window.addEventListener(EVENT, onEvent);
  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => callback(e.data || {});
  } catch { /* same-tab only */ }
  return () => { window.removeEventListener(EVENT, onEvent); channel?.close(); };
}

// Whether a transaction may belong to the replaced scope. Rows without the
// fields are treated as affected -- keeping a possibly dead ID is worse.
export const inReplacedScope = (row, { cost_center: costCenter, year } = {}) => {
  const rowCc = row?.cost_center ?? row?.account_code;
  const rowYear = row?.year ?? row?.fiscal_year;
  if (rowCc == null || rowYear == null) return true;
  return String(rowCc) === String(costCenter) && String(rowYear) === String(year);
};
