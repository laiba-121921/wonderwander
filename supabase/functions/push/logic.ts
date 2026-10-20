// Card reminders (BUILD_PLAN 18). Pure, so the app's tests can import it too.

// The only notification wonderwander ever sends.
export function reminder(due: number): { title: string; body: string; url: string } {
  return { title: 'Your cards are piling up', body: `${due} cards are ready. Ten minutes clears most of them.`, url: '#/cards' };
}

// The daily run sends only when the due count exceeds the threshold; the owner's test ping always sends.
export const shouldSend = (due: number, threshold: number, test: boolean) => test || due > threshold;

// The job runs every hour; each person is reminded once a day, in the hour they chose, in their own timezone.
export function isPushHour(now: Date, pushHour: number, timezone: string): boolean {
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(now));
  } catch {
    hour = now.getUTCHours(); // an unknown timezone falls back to UTC rather than never reminding
  }
  return hour === pushHour;
}

// Constant-time comparison for the shared secret the daily job sends.
export function sameSecret(a: string | null, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
