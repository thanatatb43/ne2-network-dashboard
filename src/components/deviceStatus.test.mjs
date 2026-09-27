import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAge, normalizeLiveStatus } from './deviceStatus.js';

test('missing latency fields are not evidence of being online', () => {
  assert.equal(normalizeLiveStatus({ device_id: 1 }).status, 'unknown');
  assert.equal(normalizeLiveStatus({ latency_ms: undefined, latency: undefined }).status, 'unknown');
  assert.equal(normalizeLiveStatus(undefined).status, 'unknown');
});

test('live_status wins over alive and raw status', () => {
  const stale = normalizeLiveStatus({ live_status: 'unknown', alive: null, status: 'down', stale: true, age_seconds: 3600 });
  assert.equal(stale.status, 'unknown');
  assert.equal(stale.lastMeasured, 'offline');
  assert.equal(stale.stale, true);
  assert.equal(stale.ageSeconds, 3600);
  assert.equal(normalizeLiveStatus({ live_status: 'up', status: 'down' }).status, 'online');
  assert.equal(normalizeLiveStatus({ live_status: 'down', alive: true }).status, 'offline');
  assert.equal(normalizeLiveStatus({ live_status: 'up' }).hasLiveContract, true);
});

test('older backends: alive, then raw status', () => {
  assert.equal(normalizeLiveStatus({ alive: true }).status, 'online');
  assert.equal(normalizeLiveStatus({ status: 'UP' }).status, 'online');
  assert.equal(normalizeLiveStatus({ alive: false, status: 'up' }).status, 'offline');
  assert.equal(normalizeLiveStatus({ status: 'down' }).status, 'offline');
  assert.equal(normalizeLiveStatus({ status: 'weird' }).status, 'unknown');
  assert.equal(normalizeLiveStatus({ live_status: 'bogus', status: 'up' }).status, 'online');
});

test('numbers keep zero, missing stays null, time only from the source', () => {
  const s = normalizeLiveStatus({ live_status: 'up', latency_ms: 0, packet_loss: '0', checked_at: '2026-09-27T01:00:00Z' });
  assert.equal(s.latency, 0);
  assert.equal(s.packetLoss, 0);
  assert.equal(s.lastUpdated, '2026-09-27T01:00:00.000Z');
  const m = normalizeLiveStatus({ status: 'up', latency_ms: null, packet_loss: 'x' });
  assert.equal(m.latency, null);
  assert.equal(m.packetLoss, null);
  assert.equal(m.lastUpdated, null);
});

test('age formatting', () => {
  assert.equal(formatAge(30), 'ไม่ถึง 1 นาที');
  assert.equal(formatAge(2700), '45 นาที');
  assert.equal(formatAge(3 * 3600 + 120), '3 ชม. 2 นาที');
  assert.equal(formatAge(null), '');
});
