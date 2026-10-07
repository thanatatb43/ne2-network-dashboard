// Undo/redo for the drawing editor plus the saved baseline. An entry is
// { meta, doc } -- what a save sends. Pan, zoom, selection and an
// in-progress drag never go in here: a gesture is committed once, at its end.
import { sameJson } from './officeDrawingDocument.js';

export const HISTORY_LIMIT = 100;

export const createHistory = (entry) => ({ past: [], present: entry, future: [] });

export function commit(history, entry) {
  if (entry === history.present || sameJson(entry, history.present)) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: entry, future: [] };
}

export function undo(history) {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] };
}

export function redo(history) {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}

export const canUndo = (h) => h.past.length > 0;
export const canRedo = (h) => h.future.length > 0;

// The saved baseline is what the server holds for `version`. Dirty = the
// present entry differs from it, whatever path (edits, undo) led there.
export const isDirty = (history, baseline) => !sameJson(history.present, baseline.entry);

// A save sent `snapshot` (the entry at the time Save was pressed) and the
// server accepted it as `version`. Later edits stay in the draft and stay
// dirty; only the baseline moves.
export const acceptSaved = (snapshot, version) => ({ entry: snapshot, version });
