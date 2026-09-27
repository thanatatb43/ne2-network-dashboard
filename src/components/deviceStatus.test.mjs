import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLiveStatus } from './deviceStatus.js';

test('missing latency fields are not evidence of being online', () => {
  assert.equal(normalizeLiveStatus({ device_id: 1 }).status, 'unknown');
  assert.equal(normalizeLiveStatus({ latency_ms: undefined, latency: undefined }).status, 'unknown');
  assert.equal(normalizeLiveStatus(undefined).status, 'unknown');
});

test('explicit alive/status decide up or down', () => {
  assert.equal(normalizeLiveStatus({ alive: true }).status, 'online');
  assert.equal(normalizeLiveStatus({ status: 'UP' }).status, 'online');
  assert.equal(normalizeLiveStatus({ alive: false, status: 'up' }).status, 'offline');
  assert.equal(normalizeLiveStatus({ status: 'down' }).status, 'offline');
  assert.equal(normalizeLiveStatus({ status: 'weird' }).status, 'unknown');
});

test('numbers keep zero, missing stays null, time only from the source', () => {
  const s = normalizeLiveStatus({ status: 'up', latency_ms: 0, packet_loss: '0', checked_at: '2026-09-27T01:00:00Z' });
  assert.equal(s.latency, 0);
  assert.equal(s.packetLoss, 0);
  assert.equal(s.lastUpdated, '2026-09-27T01:00:00.000Z');
  const m = normalizeLiveStatus({ status: 'up', latency_ms: null, packet_loss: 'x' });
  assert.equal(m.latency, null);
  assert.equal(m.packetLoss, null);
  assert.equal(m.lastUpdated, null);
});
