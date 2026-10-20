import { describe, expect, it } from 'vitest';
import { alwaysAppealable, decide, hasOffKey, tieBreak, type AuditorView, type GraderView, type ItemClass } from '../../src/domain/escalation';
import { applyDecision, applyRuling, canAttempt, effectiveStatus, freshRow, markRevised } from '../../src/domain/lifecycle';

const g = (o: Partial<GraderView> = {}): GraderView => ({ verdict: 'PASS', confidence: 'HIGH', off_key: '', ...o });
const a = (o: Partial<AuditorView> = {}): AuditorView => ({ agreement: 'AGREE', confidence: 'HIGH', ...o });

describe('the decision table (PHASE_15_PLUS 1.1)', () => {
  it('PASS with AGREE passes at any confidence', () => {
    for (const c of ['HIGH', 'MEDIUM', 'LOW'] as const) {
      expect(decide('recall', g({ confidence: c }), a()).decision).toBe('PASS');
      expect(decide('recall', g(), a({ confidence: c })).decision).toBe('PASS');
    }
  });

  it('FAIL with AGREE fails at HIGH or MEDIUM on both', () => {
    expect(decide('recall', g({ verdict: 'FAIL' }), a()).decision).toBe('FAIL');
    expect(decide('recall', g({ verdict: 'FAIL', confidence: 'MEDIUM' }), a({ confidence: 'MEDIUM' })).decision).toBe('FAIL');
  });

  it('FAIL with AGREE but LOW on either is a soft retry', () => {
    expect(decide('recall', g({ verdict: 'FAIL', confidence: 'LOW' }), a()).decision).toBe('RETRY');
    expect(decide('recall', g({ verdict: 'FAIL' }), a({ confidence: 'LOW' })).decision).toBe('RETRY');
  });

  it('any DISAGREE is a soft retry, whatever the verdict', () => {
    expect(decide('recall', g(), a({ agreement: 'DISAGREE' })).decision).toBe('RETRY');
    expect(decide('recall', g({ verdict: 'FAIL' }), a({ agreement: 'DISAGREE' })).decision).toBe('RETRY');
  });

  it('ABSTAIN is a soft retry', () => {
    expect(decide('recall', g({ verdict: 'ABSTAIN' }), a()).decision).toBe('RETRY');
  });

  it('off-key content no longer escalates by itself: off-key with PASS passes', () => {
    expect(decide('card', g({ off_key: 'says the sun is a star' }), a()).decision).toBe('PASS');
    expect(decide('card', g({ verdict: 'FAIL', off_key: 'adds a wrong claim' }), a()).decision).toBe('FAIL');
    for (const none of ['', 'none', 'None.', 'N/A', '  ']) expect(hasOffKey(none)).toBe(false);
  });

  it('the ladder is strict in the same way: MEDIUM fails, LOW retries', () => {
    expect(decide('ladder', g({ verdict: 'FAIL', confidence: 'MEDIUM' }), a()).decision).toBe('FAIL');
    expect(decide('ladder', g({ verdict: 'FAIL' }), a({ confidence: 'LOW' })).decision).toBe('RETRY');
  });
});

describe('the tie-break (PHASE_15_PLUS 1.1)', () => {
  it('takes the majority of grader, auditor and tie-break, final and appealable', () => {
    const d = tieBreak(g({ verdict: 'PASS' }), a({ agreement: 'DISAGREE', my_verdict: 'FAIL' }), g({ verdict: 'PASS' }));
    expect(d).toEqual({ decision: 'PASS', reasons: ['tie-break: 2 of 3 passed'], appealable: true });
    expect(tieBreak(g({ verdict: 'PASS' }), a({ agreement: 'DISAGREE', my_verdict: 'FAIL' }), g({ verdict: 'FAIL' })).decision).toBe('FAIL');
  });

  it('counts ABSTAIN as FAIL', () => {
    expect(tieBreak(g({ verdict: 'ABSTAIN' }), a({ my_verdict: 'PASS' }), g({ verdict: 'ABSTAIN' })).decision).toBe('FAIL');
    expect(tieBreak(g({ verdict: 'PASS' }), a({ my_verdict: 'ABSTAIN' }), g({ verdict: 'ABSTAIN' })).decision).toBe('FAIL');
    expect(tieBreak(g({ verdict: 'ABSTAIN' }), a({ my_verdict: 'PASS' }), g({ verdict: 'PASS' })).decision).toBe('PASS');
  });

  it('reads the auditor verdict from its agreement when my_verdict is missing', () => {
    expect(tieBreak(g({ verdict: 'PASS', confidence: 'LOW' }), a({ agreement: 'AGREE' }), g({ verdict: 'FAIL' })).decision).toBe('PASS');
    expect(tieBreak(g({ verdict: 'PASS' }), a({ agreement: 'DISAGREE' }), g({ verdict: 'FAIL' })).decision).toBe('FAIL');
  });
});

describe('appealable (PHASE_15_PLUS 1.2 and 1.3)', () => {
  it('arguments, bosses and refereed writing are always appealable; recall only after a tie-break', () => {
    for (const c of ['object', 'reply', 'mini_boss', 'final_boss', 'referee', 'paper'] as ItemClass[]) {
      expect(alwaysAppealable(c)).toBe(true);
      expect(decide(c, g({ verdict: 'FAIL' }), a()).appealable).toBe(true);
    }
    for (const c of ['recall', 'card', 'comprehension', 'reconstruct', 'ladder'] as ItemClass[]) expect(decide(c, g({ verdict: 'FAIL' }), a()).appealable).toBe(false);
  });

  it('final bosses are no longer always queued: a clear verdict stands', () => {
    expect(decide('final_boss', g(), a()).decision).toBe('PASS');
    expect(decide('object', g(), a()).decision).toBe('PASS');
  });
});

describe('item lifecycle (BUILD_PLAN 9.3)', () => {
  const now = new Date('2026-10-19T10:00:00Z');

  it('a FAIL locks only that item until the next Karachi midnight', () => {
    const row = applyDecision(freshRow('logic-1:drill:L1-04', 'logic-1'), 'FAIL', now, 'Asia/Karachi', 'a1', 'missing premise 2');
    expect(row.status).toBe('locked');
    expect(row.locked_until).toBe('2026-10-19T19:00:00.000Z');
    expect(row.fail_count).toBe(1);
    expect(row.last_feedback).toBe('missing premise 2');
    expect(effectiveStatus(row, now)).toBe('locked');
  });

  it('a soft retry leaves the item open and unlocked', () => {
    const row = applyDecision(freshRow('i', 'u'), 'RETRY', now, 'Asia/Karachi', 'a2', null);
    expect(row.status).toBe('available');
    expect(row.last_attempt_id).toBe('a2');
    expect(canAttempt(row, now)).toBe(true);
  });

  it('after midnight the item needs revision, then opens', () => {
    const locked = applyDecision(freshRow('i', 'u'), 'FAIL', now, 'Asia/Karachi', 'a1', null);
    const later = new Date('2026-10-19T19:30:00Z');
    expect(effectiveStatus(locked, later)).toBe('revision_required');
    expect(canAttempt(markRevised(locked, now), later)).toBe(true);
  });

  it('a pass clears the lock', () => {
    const locked = applyDecision(freshRow('i', 'u'), 'FAIL', now, 'Asia/Karachi', 'a1', null);
    const passed = applyDecision(markRevised(locked, now), 'PASS', new Date('2026-10-20T08:00:00Z'), 'Asia/Karachi', 'a2', null);
    expect(passed.status).toBe('passed');
    expect(passed.locked_until).toBeNull();
  });

  it('an appeal ruling FAIL locks from the import time; PASS passes', () => {
    const r = applyRuling(freshRow('i', 'u'), 'FAIL', 'attacks the conclusion', new Date('2026-10-20T20:00:00Z'), 'Asia/Karachi');
    expect(r.locked_until).toBe('2026-10-21T19:00:00.000Z');
    expect(applyRuling(freshRow('i', 'u'), 'PASS', 'fine', now, 'Asia/Karachi').status).toBe('passed');
  });
});
