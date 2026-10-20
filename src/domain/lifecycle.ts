import { nextLocalMidnight } from './dates';
import type { ItemStatus } from './progress';

// BUILD_PLAN 9.3. The stored row, as in the item_state table.
export interface ItemRow {
  item_id: string;
  unit_id: string | null;
  status: ItemStatus;
  locked_until: string | null;
  revision_done_at: string | null;
  fail_count: number;
  last_attempt_id: string | null;
  last_feedback: string | null;
}

export const freshRow = (itemId: string, unitId: string | null): ItemRow => ({
  item_id: itemId,
  unit_id: unitId,
  status: 'available',
  locked_until: null,
  revision_done_at: null,
  fail_count: 0,
  last_attempt_id: null,
  last_feedback: null,
});

// PASS passes; a soft retry leaves the item open to answer again; FAIL locks only this item until the next local midnight.
export function applyDecision(prev: ItemRow, decision: 'PASS' | 'FAIL' | 'RETRY', now: Date, tz: string, attemptId: string | null, feedback: string | null): ItemRow {
  const base = { ...prev, last_attempt_id: attemptId };
  if (decision === 'PASS') return { ...base, status: 'passed', locked_until: null };
  if (decision === 'RETRY') return { ...base, status: prev.status === 'locked' ? 'available' : prev.status };
  return {
    ...base,
    status: 'locked',
    locked_until: nextLocalMidnight(now, tz).toISOString(),
    revision_done_at: null,
    fail_count: prev.fail_count + 1,
    last_feedback: feedback,
  };
}

// The stored status says "locked" until a new attempt; what that means depends on the clock and on revision.
export type Effective = 'available' | 'passed' | 'pending_review' | 'locked' | 'revision_required';

export function effectiveStatus(row: ItemRow | undefined, now: Date): Effective {
  if (!row) return 'available';
  if (row.status !== 'locked') return row.status === 'revision_required' ? 'revision_required' : (row.status as Effective);
  const lockOver = row.locked_until !== null && now.getTime() >= new Date(row.locked_until).getTime();
  if (!lockOver) return 'locked';
  return row.revision_done_at ? 'available' : 'revision_required';
}

// Revision may be done before midnight; the retry still waits for midnight.
export function markRevised(row: ItemRow, now: Date): ItemRow {
  return { ...row, revision_done_at: now.toISOString() };
}

export const canAttempt = (row: ItemRow | undefined, now: Date) => effectiveStatus(row, now) === 'available';

// A ruling on an appeal (PHASE_15_PLUS 1.3): FAIL locks from the import time.
export function applyRuling(prev: ItemRow, ruling: 'PASS' | 'FAIL', reason: string, now: Date, tz: string): ItemRow {
  return applyDecision(prev, ruling, now, tz, prev.last_attempt_id, reason);
}
