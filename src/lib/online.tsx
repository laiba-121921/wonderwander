import { useEffect, useRef, useState } from 'react';

// BUILD_PLAN 20: an answer saved while offline is checked as soon as the phone is back online.
export function useRetryWhenOnline(waiting: boolean, retry: () => void) {
  const latest = useRef(retry);
  useEffect(() => {
    latest.current = retry;
  });
  useEffect(() => {
    if (!waiting) return;
    const go = () => latest.current();
    window.addEventListener('online', go, { once: true });
    return () => window.removeEventListener('online', go);
  }, [waiting]);
}

// Mounted inside an offline retry box: retries once the connection returns.
export function RetryWhenOnline({ onRetry }: { onRetry: () => void }) {
  useRetryWhenOnline(true, onRetry);
  return null;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
