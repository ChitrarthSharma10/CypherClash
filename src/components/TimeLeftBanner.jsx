import { useState, useEffect, useRef } from 'react';
import { computeRemainingMs, formatTimeLeft } from '../../shared/roundTimer.js';

export { computeRemainingMs, formatTimeLeft };

/**
 * Hook to manage round timer with clock skew, running/paused/ended transitions,
 * and critical time alert under 60 seconds.
 */
export function useRoundTimer(round, serverNow) {
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
  const isCritical = remainingMs !== null && remainingMs > 0 && remainingMs < 60000;

  return {
    remainingMs,
    formattedTime,
    isEnded,
    isPaused,
    isCritical,
    serverOffsetMs: serverOffsetRef.current,
  };
}

export default function TimeLeftBanner({ round, serverNow, onEnded, className = '' }) {
  const { remainingMs, formattedTime, isEnded, isPaused, isCritical } = useRoundTimer(round, serverNow);

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
      className={`cc-time-left-banner ${isEnded ? 'is-ended' : ''} ${isPaused ? 'is-paused' : ''} ${isCritical ? 'is-critical' : ''} ${className}`.trim()}
      role="timer"
      aria-live="polite"
    >
      <span className="cc-time-left-banner__label">{label}</span>
      <span className="cc-time-left-banner__time">{formattedTime}</span>
    </div>
  );
}
