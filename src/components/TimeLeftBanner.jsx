import { useState, useEffect, useRef } from 'react';

/**
 * Computes remaining milliseconds from round state and server time offset.
 */
export function computeRemainingMs(round, serverOffsetMs = 0) {
  if (!round || round.status === 'not_started' || (!round.deadline && round.remainingMs == null)) {
    return null;
  }
  if (round.status === 'ended') {
    return 0;
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

export default function TimeLeftBanner({ round, serverNow, onEnded }) {
  const [, setTick] = useState(0);
  const serverOffsetRef = useRef(0);

  useEffect(() => {
    if (serverNow) {
      serverOffsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, [serverNow]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = computeRemainingMs(round, serverOffsetRef.current);
  const formattedTime = formatTimeLeft(remainingMs);
  const isEnded = round?.status === 'ended' || (remainingMs !== null && remainingMs <= 0);
  const isPaused = round?.status === 'paused';

  useEffect(() => {
    if (isEnded && onEnded) {
      onEnded();
    }
  }, [isEnded, onEnded]);

  let label = 'TIME REMAINING';
  if (isPaused) {
    label = 'ROUND PAUSED';
  } else if (isEnded) {
    label = 'ROUND ENDED';
  }

  return (
    <div
      className={`cc-time-left-banner ${isEnded ? 'is-ended' : ''} ${isPaused ? 'is-paused' : ''}`}
      role="timer"
      aria-live="polite"
    >
      <span className="cc-time-left-banner__label">{label}</span>
      <span className="cc-time-left-banner__time">{formattedTime}</span>
    </div>
  );
}

