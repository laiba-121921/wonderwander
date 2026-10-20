import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isPushHour, reminder, sameSecret, shouldSend } from '../../supabase/functions/push/logic';

describe('card reminders (BUILD_PLAN 18)', () => {
  it('uses the planned title and body, and opens the Cards screen', () => {
    expect(reminder(14)).toEqual({ title: 'Your cards are piling up', body: '14 cards are ready. Ten minutes clears most of them.', url: '#/cards' });
    // the wording is the build plan's, kept with the private planning documents
    const planFile = 'content/planning/BUILD_PLAN.md';
    if (!existsSync(planFile)) return;
    const plan = readFileSync(planFile, 'utf8');
    expect(plan).toContain('title "Your cards are piling up", body "<n> cards are ready. Ten minutes clears most of them."');
  });

  it('sends only above the threshold, except the owner test', () => {
    expect(shouldSend(12, 12, false)).toBe(false);
    expect(shouldSend(13, 12, false)).toBe(true);
    expect(shouldSend(0, 12, true)).toBe(true);
  });

  it('reminds each person in their own local push hour', () => {
    const now = new Date('2026-10-20T15:30:00Z'); // 20:30 in Karachi, 16:30 in London
    expect(isPushHour(now, 20, 'Asia/Karachi')).toBe(true);
    expect(isPushHour(now, 16, 'Europe/London')).toBe(true);
    expect(isPushHour(now, 20, 'Europe/London')).toBe(false);
    expect(isPushHour(now, 15, 'Not/AZone')).toBe(true); // falls back to UTC
  });

  it('compares the daily job secret exactly', () => {
    expect(sameSecret('abc123', 'abc123')).toBe(true);
    expect(sameSecret('abc123', 'abc124')).toBe(false);
    expect(sameSecret('abc', 'abc123')).toBe(false);
    expect(sameSecret(null, 'abc')).toBe(false);
    expect(sameSecret('', '')).toBe(false);
  });

  it('the schedule converts the local push hour to UTC in the migration', () => {
    const sql = readFileSync('supabase/migrations/20261019152312_card_push.sql', 'utf8');
    expect(sql).toContain("at time zone new.timezone) at time zone 'UTC'");
    expect(sql).toContain("revoke all on function public.push_secret(text) from public, anon, authenticated;");
    expect(sql).not.toMatch(/create_secret\('[0-9a-f]{32,}'/); // the job secret is generated in the database, never written here
  });
});
