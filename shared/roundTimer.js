/**
 * Shared round timer utilities.
 * Handles running, paused, ended, not_started states and server clock skew.
 */

export function computeRemainingMs(round, serverOffsetMs = 0) {
  if (!round || round.status === 'not_started') {
    return null;
  }
  if (round.status === 'ended') {
    return 0;
  }
  if (!round.deadline && round.remainingMs == null) {
    return null;
  }
  if (round.status === 'paused') {
    if (round.pausedAt && round.deadline) {
      return Math.max(0, new Date(round.deadline).getTime() - new Date(round.pausedAt).getTime());
    }
    return round.remainingMs ?? 0;
  }
  // status === 'running'
  if (!round.deadline) {
    return round.remainingMs ?? null;
  }
  const deadlineMs = new Date(round.deadline).getTime();
  const estServerNow = Date.now() + serverOffsetMs;
  return Math.max(0, deadlineMs - estServerNow);
}

export function formatTimeLeft(ms) {
  if (ms == null) return '—:—';
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}
