// Unsaved drawing work kept across a login / SSO round trip (which reloads
// the page). Stored per user and drawing; never holds a token. Offered back
// only to the same user, and cleared on save or when the user discards it.

const KEY = 'ne2.drawingRecovery.v1';
const MAX_ENTRIES = 3;

const read = (storage) => {
  try {
    const list = JSON.parse(storage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
};

const write = (storage, list) => {
  try {
    if (list.length) storage.setItem(KEY, JSON.stringify(list));
    else storage.removeItem(KEY);
    return true;
  } catch { return false; }
};

// drawingKey: the drawing id, or `new:<siteId>` for one not created yet.
export function saveRecovery({ userId, drawingKey, siteId, version, entry }, storage = globalThis.localStorage) {
  if (userId === null || userId === undefined || !storage) return false;
  const others = read(storage).filter(r => !(r.userId === userId && r.drawingKey === drawingKey));
  const record = { userId, drawingKey: String(drawingKey), siteId: String(siteId), version: version ?? null, savedAt: new Date().toISOString(), entry };
  return write(storage, [record, ...others].slice(0, MAX_ENTRIES));
}

export function readRecovery({ userId, drawingKey }, storage = globalThis.localStorage) {
  if (userId === null || userId === undefined || !storage) return null;
  return read(storage).find(r => r.userId === userId && r.drawingKey === String(drawingKey)) || null;
}

export function clearRecovery({ userId, drawingKey }, storage = globalThis.localStorage) {
  if (!storage) return;
  write(storage, read(storage).filter(r => !(r.userId === userId && r.drawingKey === String(drawingKey))));
}
