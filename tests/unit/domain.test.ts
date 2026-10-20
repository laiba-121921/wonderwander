import { describe, expect, it } from 'vitest';
import type { DomainFile } from '../../src/content/types';
import { isLocked, localDate, nextLocalMidnight } from '../../src/domain/dates';
import {
  domainMastery,
  emptyProgress,
  ladderUnlocked,
  overallMastery,
  paperUnlocked,
  unitItemIds,
  unitMastery,
  unitPassed,
  unitsById,
  unitUnlocked,
  unmetSoftPrerequisites,
  type Progress,
} from '../../src/domain/progress';
import { DAILY_CARD_CAP, cardCredit, newCardState, ratingFor, review, todaysCards } from '../../src/engines/srs/cards';
import { DOMAINS } from '../../scripts/content/structure';
import { HAS_CONTENT, readContent } from '../content';

const files: DomainFile[] = HAS_CONTENT ? DOMAINS.map((d) => readContent<DomainFile>(`content/json/${d.id}.json`, { domain: {} as DomainFile['domain'], units: [] })) : [];
const units = unitsById(files);
const unit = (id: string) => units.get(id)!;

function pass(p: Progress, ...ids: string[]): Progress {
  for (const id of ids) {
    const u = unit(id);
    for (const item of unitItemIds(u)) p.items[item] = 'passed';
    for (const c of u.cards) p.cardPassDays[c.id] = 2;
  }
  return p;
}

describe('lockout dates in Asia/Karachi (UTC+5)', () => {
  it('locks until the next local midnight', () => {
    expect(nextLocalMidnight(new Date('2026-10-19T10:00:00Z')).toISOString()).toBe('2026-10-19T19:00:00.000Z');
  });
  it('crosses midnight correctly', () => {
    expect(nextLocalMidnight(new Date('2026-10-19T18:59:59Z')).toISOString()).toBe('2026-10-19T19:00:00.000Z');
    expect(nextLocalMidnight(new Date('2026-10-19T19:00:00Z')).toISOString()).toBe('2026-10-20T19:00:00.000Z');
  });
  it('handles month and year ends', () => {
    expect(nextLocalMidnight(new Date('2026-02-28T20:00:00Z')).toISOString()).toBe('2026-03-01T19:00:00.000Z');
    expect(nextLocalMidnight(new Date('2026-12-31T18:30:00Z')).toISOString()).toBe('2026-12-31T19:00:00.000Z');
    expect(nextLocalMidnight(new Date('2026-12-31T19:30:00Z')).toISOString()).toBe('2027-01-01T19:00:00.000Z');
  });
  it('gives the local calendar date and lock state', () => {
    expect(localDate(new Date('2026-10-19T19:30:00Z'))).toBe('2026-10-20');
    expect(isLocked('2026-10-19T19:00:00Z', new Date('2026-10-19T18:00:00Z'))).toBe(true);
    expect(isLocked('2026-10-19T19:00:00Z', new Date('2026-10-19T19:00:00Z'))).toBe(false);
    expect(isLocked(null, new Date())).toBe(false);
  });
});

describe('spaced repetition (BUILD_PLAN 12)', () => {
  it('maps decisions to FSRS ratings', () => {
    expect(ratingFor('PASS', 'HIGH')).toBe(3);
    expect(ratingFor('PASS', 'MEDIUM')).toBe(2);
    expect(ratingFor('FAIL')).toBe(1);
    expect(ratingFor('RETRY')).toBeNull();
  });

  it('never makes a failed card due before the next local midnight', () => {
    const now = new Date('2026-10-19T10:00:00Z');
    const after = review(newCardState('c', now), 'FAIL', 'HIGH', now);
    expect(after.due.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-19T19:00:00Z').getTime());
  });

  it('leaves a card unscheduled during a soft retry', () => {
    const now = new Date('2026-10-19T10:00:00Z');
    const s = newCardState('c', now);
    expect(review(s, 'RETRY', undefined, now)).toBe(s);
  });

  it('counts distinct local days with a pass', () => {
    let s = newCardState('c', new Date('2026-10-19T05:00:00Z'));
    s = review(s, 'PASS', 'HIGH', new Date('2026-10-19T05:00:00Z'));
    s = review(s, 'PASS', 'HIGH', new Date('2026-10-19T08:00:00Z')); // same Karachi day
    expect(s.passDays).toEqual(['2026-10-19']);
    s = review(s, 'PASS', 'MEDIUM', new Date('2026-10-21T05:00:00Z'));
    expect(s.passDays).toHaveLength(2);
    expect([cardCredit(0), cardCredit(1), cardCredit(2)]).toEqual([0, 0.5, 1]);
  });

  it('caps the daily session at eight cards', () => {
    const now = new Date('2026-10-19T10:00:00Z');
    const states = Array.from({ length: 11 }, (_, i) => newCardState(`c${i}`, new Date(now.getTime() - i * 1000)));
    const { core, extra } = todaysCards(states, now);
    expect(core).toHaveLength(DAILY_CARD_CAP);
    expect(extra).toHaveLength(3);
  });
});

describe.skipIf(!HAS_CONTENT)('gating (BUILD_PLAN 13.1)', () => {
  it('opens Logic 1 only, at the start', () => {
    const p = emptyProgress();
    expect(unitUnlocked(unit('logic-1'), p, units)).toBe(true);
    for (const id of ['logic-2', 'epistemology-1', 'religion-1', 'political-1']) expect(unitUnlocked(unit(id), p, units)).toBe(false);
  });

  it('opens Logic 2 and the first unit of every track once Logic 1 is passed', () => {
    const p = pass(emptyProgress(), 'logic-1');
    expect(unitPassed(unit('logic-1'), p)).toBe(true);
    for (const id of ['logic-2', 'epistemology-1', 'religion-1', 'political-1']) expect(unitUnlocked(unit(id), p, units)).toBe(true);
    expect(unitUnlocked(unit('epistemology-2'), p, units)).toBe(false);
  });

  it('needs cards passed on two distinct days, not just the items', () => {
    const p = pass(emptyProgress(), 'logic-1');
    p.cardPassDays['logic-1:card:5'] = 1;
    expect(unitPassed(unit('logic-1'), p)).toBe(false);
  });

  it('opens the next domain in a track only after every unit of the previous', () => {
    const p = pass(emptyProgress(), 'logic-1', 'epistemology-1', 'epistemology-2', 'epistemology-3', 'epistemology-4');
    expect(unitUnlocked(unit('metaphysics-1'), p, units)).toBe(false);
    pass(p, 'epistemology-5');
    expect(unitUnlocked(unit('metaphysics-1'), p, units)).toBe(true);
  });

  it('opens the writing ladder at four passed units and the paper after Religion 7 and RE 6', () => {
    const epi = files.find((f) => f.domain.id === 'epistemology')!;
    const p = pass(emptyProgress(), 'logic-1', 'epistemology-1', 'epistemology-2', 'epistemology-3');
    expect(ladderUnlocked(epi, p)).toBe(false);
    pass(p, 'epistemology-4');
    expect(ladderUnlocked(epi, p)).toBe(true);
    expect(paperUnlocked(p, units)).toBe(false);
    pass(p, 'religion-7', 'religious-epistemology-6');
    expect(paperUnlocked(p, units)).toBe(true);
  });

  it('reports soft prerequisites without blocking', () => {
    const p = pass(emptyProgress(), 'logic-1');
    expect(unitUnlocked(unit('political-1'), p, units)).toBe(true);
    expect(unmetSoftPrerequisites(unit('political-1'), p, units)).toEqual(['logic-5', 'logic-7']);
  });
});

describe.skipIf(!HAS_CONTENT)('mastery (BUILD_PLAN 13.3)', () => {
  it('weights a unit 20, 15, 10, 15, 10, 10, 20', () => {
    const u = unit('logic-1');
    const p = emptyProgress();
    expect(unitMastery(u, p)).toBe(0);
    for (const d of u.drills.slice(0, 5)) p.items[d.id] = 'passed';
    expect(unitMastery(u, p)).toBeCloseTo(10);
    for (const c of u.cards) p.cardPassDays[c.id] = 1;
    expect(unitMastery(u, p)).toBeCloseTo(17.5);
    p.items[u.miniBoss.id] = 'pending_review'; // queued counts as zero
    expect(unitMastery(u, p)).toBeCloseTo(17.5);
    expect(unitMastery(u, pass(emptyProgress(), 'logic-1'))).toBeCloseTo(100);
  });

  it('combines units, ladder and final boss for a domain, and weights domains by unit count overall', () => {
    const logic = files.find((f) => f.domain.id === 'logic')!;
    const p = pass(emptyProgress(), ...logic.units.map((u) => u.id));
    expect(domainMastery(logic, p)).toBeCloseTo(70);
    for (const s of ['abstract', 'reconstruction', 'objection_reply', 'referee']) p.items[`logic:ladder:${s}`] = 'passed';
    p.items[logic.domain.finalBoss.id] = 'passed';
    expect(domainMastery(logic, p)).toBeCloseTo(100);
    expect(overallMastery(files, p)).toBeCloseTo((100 * 8) / 56);
  });
});
