import './bootstrap.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRemainingMs, formatTimeLeft } from '../../shared/roundTimer.js';

test('computeRemainingMs: handles not_started and missing values', () => {
  assert.equal(computeRemainingMs(null), null);
  assert.equal(computeRemainingMs(undefined), null);
  assert.equal(computeRemainingMs({ status: 'not_started' }), null);
  assert.equal(computeRemainingMs({ status: 'running' }), null);
  assert.equal(computeRemainingMs({ status: 'running', remainingMs: 5000 }), 5000);
});

test('computeRemainingMs: returns 0 when round status is ended', () => {
  assert.equal(computeRemainingMs({ status: 'ended', deadline: new Date(Date.now() + 60000) }), 0);
  assert.equal(computeRemainingMs({ status: 'ended' }), 0);
});

test('computeRemainingMs: computes remaining time correctly when paused', () => {
  const pausedAt = new Date('2026-10-21T10:00:00Z');
  const deadline = new Date('2026-10-21T10:15:00Z'); // 15 mins left = 900,000 ms
  const round = {
    status: 'paused',
    pausedAt,
    deadline,
  };
  assert.equal(computeRemainingMs(round), 900000);

  // Fallback to remainingMs if pausedAt missing
  assert.equal(computeRemainingMs({ status: 'paused', remainingMs: 45000 }), 45000);
});

test('computeRemainingMs: running round accounts for deadline and server clock skew', () => {
  const now = Date.now();
  const deadline = new Date(now + 60000); // 60s from now
  const round = {
    status: 'running',
    deadline,
  };

  // Zero offset
  const res0 = computeRemainingMs(round, 0);
  assert.ok(res0 >= 59800 && res0 <= 60100, `Expected ~60000 ms, got ${res0}`);

  // Server is 10 seconds ahead of client (+10000ms offset)
  // Estimated server time is now + 10s, so remaining time until deadline is ~50s
  const resAhead = computeRemainingMs(round, 10000);
  assert.ok(resAhead >= 49800 && resAhead <= 50100, `Expected ~50000 ms, got ${resAhead}`);

  // Server is 10 seconds behind client (-10000ms offset)
  // Estimated server time is now - 10s, so remaining time until deadline is ~70s
  const resBehind = computeRemainingMs(round, -10000);
  assert.ok(resBehind >= 69800 && resBehind <= 70100, `Expected ~70000 ms, got ${resBehind}`);

  // Past deadline returns 0
  const pastRound = {
    status: 'running',
    deadline: new Date(now - 5000),
  };
  assert.equal(computeRemainingMs(pastRound, 0), 0);
});

test('formatTimeLeft: formats MM:SS string correctly', () => {
  assert.equal(formatTimeLeft(null), '—:—');
  assert.equal(formatTimeLeft(undefined), '—:—');
  assert.equal(formatTimeLeft(0), '00:00');
  assert.equal(formatTimeLeft(59000), '00:59');
  assert.equal(formatTimeLeft(60000), '01:00');
  assert.equal(formatTimeLeft(65000), '01:05');
  assert.equal(formatTimeLeft(600000), '10:00');
  assert.equal(formatTimeLeft(2700000), '45:00');
});
