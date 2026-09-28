import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser history stand-in: entries + position, like the real one
// (pushState drops Forward entries, go() moves without changing the list).
const entries = [{ state: null, url: '/' }];
let pos = 0;
globalThis.window = {
  history: {
    get state() { return entries[pos].state; },
    get length() { return entries.length; },
    pushState(state, _t, url) { entries.splice(pos + 1); entries.push({ state, url }); pos += 1; },
    replaceState(state, _t, url) { entries[pos] = { state, url: url ?? entries[pos].url }; },
    go(n) { pos += n; }
  }
};
const guard = await import('./navigationGuard.js');

test('decision for each popstate case', () => {
  assert.deepEqual(guard.popstateDecision({ guarded: false, here: 3, landed: 1 }), { type: 'follow' });
  assert.deepEqual(guard.popstateDecision({ guarded: true, here: 3, landed: 3 }), { type: 'ignore' });
  assert.deepEqual(guard.popstateDecision({ guarded: true, here: 3, landed: null }), { type: 'fallback' });
  assert.deepEqual(guard.popstateDecision({ guarded: true, here: 3, landed: 1 }), { type: 'restore-and-ask', delta: -2 });
  assert.deepEqual(guard.popstateDecision({ guarded: true, here: 1, landed: 2 }), { type: 'restore-and-ask', delta: 1 });
});

test('indexed history keeps Back and Forward intact through a cancelled leave', () => {
  guard.initHistoryIndex();
  guard.pushHistory({}, '/a');
  guard.pushHistory({}, '/form');
  guard.pushHistory({}, '/next');
  window.history.go(-1); guard.syncHistoryIndex(window.history.state); // user returns to the form
  const lengthBefore = window.history.length;
  // User presses Back twice from the dirty form (/form -> /)
  window.history.go(-2);
  const decision = guard.popstateDecision({ guarded: true, here: guard.currentHistoryIndex(), landed: guard.entryIndex(window.history.state) });
  assert.equal(decision.type, 'restore-and-ask');
  window.history.go(-decision.delta); // restore
  assert.equal(entries[pos].url, '/form');
  assert.equal(window.history.length, lengthBefore);
  // The restore's own popstate is ignored
  assert.equal(guard.popstateDecision({ guarded: true, here: guard.currentHistoryIndex(), landed: guard.entryIndex(window.history.state) }).type, 'ignore');
  // Forward entry still there
  assert.equal(entries[pos + 1].url, '/next');
  // "Leave" repeats the move to where the user was going
  window.history.go(decision.delta);
  assert.equal(entries[pos].url, '/');
});

test('guard registration and messages', () => {
  const release = guard.setNavigationGuard(() => true, { message: 'm' });
  assert.equal(guard.shouldConfirmLeave('navigate'), true);
  assert.equal(guard.navigationGuardMessage(), 'm');
  release();
  assert.equal(guard.shouldConfirmLeave('navigate'), false);
  const other = guard.setNavigationGuard(() => { throw new Error('x'); });
  assert.equal(guard.shouldConfirmLeave('popstate'), false);
  other();
});
