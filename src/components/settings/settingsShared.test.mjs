import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinatesPayload, coordinatesProblem } from './settingsShared.js';

test('coordinates payload follows the form baseline', () => {
  assert.equal(coordinatesPayload('16.2, 102.8', '16.2, 102.8'), undefined); // unchanged: omit
  assert.equal(coordinatesPayload('16.2, 102.8', ''), null); // cleared: JSON null
  assert.equal(coordinatesPayload('16.2, 102.8', '   '), null);
  assert.equal(coordinatesPayload('', ''), undefined); // create without coords
  assert.equal(coordinatesPayload('', '0, 0'), '0, 0'); // zero is a value
  assert.equal(coordinatesPayload('16.2, 102.8', '17, 103'), '17, 103');
  assert.equal(JSON.stringify({ coordinates: coordinatesPayload('1, 1', '') }), '{"coordinates":null}');
});

test('coordinates validation', () => {
  assert.equal(coordinatesProblem(''), '');
  assert.equal(coordinatesProblem('0, 0'), '');
  assert.equal(coordinatesProblem('-90, 180'), '');
  assert.match(coordinatesProblem('91, 100'), /ละติจูด/);
  assert.match(coordinatesProblem('10, -181'), /ลองจิจูด/);
  assert.match(coordinatesProblem('abc'), /รูปแบบ/);
  assert.match(coordinatesProblem('null'), /รูปแบบ/);
});
