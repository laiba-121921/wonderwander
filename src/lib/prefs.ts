import { useCallback, useEffect, useRef, useState } from 'react';

// Per-device conveniences only (reader font size, reading position). Storage can be blocked, so every access is guarded.
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`ww.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`ww.${key}`, JSON.stringify(value));
  } catch {
    // storage unavailable: the setting just will not persist
  }
}

export const FONT_MIN = 16;
export const FONT_MAX = 22;
export const FONT_DEFAULT = 18;

export function clampFont(px: number): number {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(px)));
}

export function useReaderFont(): [number, (px: number) => void] {
  const [size, setSize] = useState(() => clampFont(readPref('reader.font', FONT_DEFAULT)));
  const set = useCallback((px: number) => {
    const next = clampFont(px);
    setSize(next);
    writePref('reader.font', next);
  }, []);
  return [size, set];
}

function scrollFraction(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, window.scrollY / max) : 0;
}

// Remembers how far through a page the reader got, and reports progress for the progress bar.
export function useScrollMemory(key: string, ready: boolean, restore = true): number {
  const [progress, setProgress] = useState(0);
  const restored = useRef(false);

  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    if (!restore) return;
    const saved = readPref(`pos.${key}`, 0);
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, saved * max);
      setProgress(saved);
    });
  }, [key, ready, restore]);

  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    const onScroll = () => {
      const f = scrollFraction();
      setProgress(f);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => writePref(`pos.${key}`, f), 250);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
    };
  }, [key, ready]);

  return progress;
}
