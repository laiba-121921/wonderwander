import type { DomainFile, Unit } from '../content/types';
import { cardCredit } from '../engines/srs/cards';

export type ItemStatus = 'available' | 'pending_review' | 'passed' | 'locked' | 'revision_required';

// What the device knows about progress: item statuses and, per card, how many distinct days it passed.
export interface Progress {
  items: Record<string, ItemStatus>;
  cardPassDays: Record<string, number>;
}

export const emptyProgress = (): Progress => ({ items: {}, cardPassDays: {} });

const passed = (p: Progress, id: string) => p.items[id] === 'passed';
const fraction = (ids: string[], p: Progress) => (ids.length ? ids.filter((id) => passed(p, id)).length / ids.length : 0);

export const LADDER_STEPS = [
  { step: 'abstract', points: 3 },
  { step: 'reconstruction', points: 4 },
  { step: 'objection_reply', points: 4 },
  { step: 'referee', points: 4 },
] as const;

export const ladderId = (domain: string, step: string) => `${domain}:ladder:${step}`;

// BUILD_PLAN 13.2: everything in the unit passed, cards on two distinct days.
export function unitPassed(unit: Unit, p: Progress): boolean {
  return (
    unit.drills.every((d) => passed(p, d.id)) &&
    unit.cards.every((c) => (p.cardPassDays[c.id] ?? 0) >= 2) &&
    unit.reading.comprehension.every((d) => passed(p, d.id)) &&
    passed(p, unit.doing.reconstruct.id) &&
    passed(p, unit.doing.object.id) &&
    passed(p, unit.doing.reply.id) &&
    passed(p, unit.miniBoss.id)
  );
}

export interface MasteryPart {
  label: string;
  weight: number;
  score: number; // 0 to 1
}

// BUILD_PLAN 13.3. Queued items count as zero until ruled.
export function unitMasteryParts(unit: Unit, p: Progress): MasteryPart[] {
  const cards = unit.cards.length ? unit.cards.reduce((s, c) => s + cardCredit(p.cardPassDays[c.id] ?? 0), 0) / unit.cards.length : 0;
  return [
    { label: 'Drills', weight: 20, score: fraction(unit.drills.map((d) => d.id), p) },
    { label: 'Cards', weight: 15, score: cards },
    { label: 'Reading comprehension', weight: 10, score: fraction(unit.reading.comprehension.map((d) => d.id), p) },
    { label: 'Reconstruct', weight: 15, score: passed(p, unit.doing.reconstruct.id) ? 1 : 0 },
    { label: 'Object', weight: 10, score: passed(p, unit.doing.object.id) ? 1 : 0 },
    { label: 'Reply', weight: 10, score: passed(p, unit.doing.reply.id) ? 1 : 0 },
    { label: 'Mini-boss', weight: 20, score: passed(p, unit.miniBoss.id) ? 1 : 0 },
  ];
}

const total = (parts: MasteryPart[]) => parts.reduce((s, x) => s + x.weight * x.score, 0);

export function unitMastery(unit: Unit, p: Progress): number {
  return total(unitMasteryParts(unit, p));
}

// 70 percent average unit mastery, 15 writing ladder, 15 final boss.
export function domainMastery(file: DomainFile, p: Progress): number {
  const avg = file.units.length ? file.units.reduce((s, u) => s + unitMastery(u, p), 0) / file.units.length : 0;
  const ladder = LADDER_STEPS.reduce((s, l) => s + (passed(p, ladderId(file.domain.id, l.step)) ? l.points : 0), 0);
  const boss = passed(p, file.domain.finalBoss.id) ? 15 : 0;
  return 0.7 * avg + ladder + boss;
}

// Average of domains weighted by their unit count.
export function overallMastery(files: DomainFile[], p: Progress): number {
  const units = files.reduce((s, f) => s + f.units.length, 0);
  return units ? files.reduce((s, f) => s + domainMastery(f, p) * f.units.length, 0) / units : 0;
}

export function unitsById(files: DomainFile[]): Map<string, Unit> {
  return new Map(files.flatMap((f) => f.units.map((u) => [u.id, u] as const)));
}

// BUILD_PLAN 13.1: practice opens when every hard prerequisite unit is passed.
export function unitUnlocked(unit: Unit, p: Progress, units: Map<string, Unit>): boolean {
  return unit.prerequisites.every((id) => {
    const pre = units.get(id);
    return pre ? unitPassed(pre, p) : false;
  });
}

export function unmetSoftPrerequisites(unit: Unit, p: Progress, units: Map<string, Unit>): string[] {
  return unit.softPrerequisites.filter((id) => {
    const pre = units.get(id);
    return !pre || !unitPassed(pre, p);
  });
}

export const passedUnitCount = (file: DomainFile, p: Progress) => file.units.filter((u) => unitPassed(u, p)).length;

export const finalBossAvailable = (file: DomainFile, p: Progress) => file.units.every((u) => unitPassed(u, p));

export const ladderUnlocked = (file: DomainFile, p: Progress) => passedUnitCount(file, p) >= 4;

export function paperUnlocked(p: Progress, units: Map<string, Unit>): boolean {
  return ['religion-7', 'religious-epistemology-6'].every((id) => {
    const u = units.get(id);
    return u ? unitPassed(u, p) : false;
  });
}

// The first unit of a domain that is not yet passed, or null when the domain is complete.
export function currentUnit(file: DomainFile, p: Progress): Unit | null {
  return file.units.find((u) => !unitPassed(u, p)) ?? null;
}

// Every item id of a unit, for marking all of it passed (used by tests and by the weekly review import).
export function unitItemIds(unit: Unit): string[] {
  return [
    ...unit.drills.map((d) => d.id),
    ...unit.reading.comprehension.map((d) => d.id),
    unit.doing.reconstruct.id,
    unit.doing.object.id,
    unit.doing.reply.id,
    unit.miniBoss.id,
  ];
}
