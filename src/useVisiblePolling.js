import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 25_000;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchApi(path) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body;
}

export function useVisiblePolling(loader) {
  const loaderRef = useRef(loader);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  loaderRef.current = loader;

  useEffect(() => {
    let interval;
    let active = true;
    let inFlight = false;

    const poll = async () => {
      if (!active || document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        const nextData = await loaderRef.current();
        if (!active) return;
        setData(nextData);
        setError('');
        setUpdatedAt(Date.now());
      } catch (pollError) {
        if (active) {
          setError(pollError instanceof Error ? pollError.message : 'Request failed');
        }
      } finally {
        inFlight = false;
      }
    };

    const updateInterval = () => {
      window.clearInterval(interval);
      interval = undefined;
      if (document.visibilityState === 'visible') {
        interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
        void poll();
      }
    };

    document.addEventListener('visibilitychange', updateInterval);
    updateInterval();
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', updateInterval);
    };
  }, []);

  return { data, error, updatedAt };
}

export function useVisibleClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let interval;
    const updateClock = () => {
      window.clearInterval(interval);
      interval = undefined;
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        interval = window.setInterval(() => setNow(Date.now()), 1000);
      }
    };
    document.addEventListener('visibilitychange', updateClock);
    updateClock();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', updateClock);
    };
  }, []);
  return now;
}

export function formatUpdatedAgo(updatedAt, now) {
  if (updatedAt === null) return 'Not updated yet';
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  return `Updated ${seconds}s ago`;
}
