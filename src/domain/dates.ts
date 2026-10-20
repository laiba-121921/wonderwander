import { TZDate } from '@date-fns/tz';
import { addDays, format, startOfDay } from 'date-fns';

export const DEFAULT_TZ = 'Asia/Karachi';

// A failed item locks until the next midnight in the profile's timezone (BUILD_PLAN 9.3).
export function nextLocalMidnight(now: Date, tz = DEFAULT_TZ): Date {
  const next = startOfDay(addDays(new TZDate(now.getTime(), tz), 1));
  return new Date(next.getTime());
}

// The calendar date in the profile's timezone, as YYYY-MM-DD.
export function localDate(now: Date, tz = DEFAULT_TZ): string {
  return format(new TZDate(now.getTime(), tz), 'yyyy-MM-dd');
}

export function localHour(now: Date, tz = DEFAULT_TZ): number {
  return new TZDate(now.getTime(), tz).getHours();
}

export function localWeekday(now: Date, tz = DEFAULT_TZ): number {
  return new TZDate(now.getTime(), tz).getDay(); // 0 Sunday ... 6 Saturday
}

export function isLocked(lockedUntil: string | Date | null | undefined, now: Date): boolean {
  if (!lockedUntil) return false;
  return now.getTime() < new Date(lockedUntil).getTime();
}
