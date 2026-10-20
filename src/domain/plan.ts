import type { DomainFile, TrackId, Unit } from '../content/types';
import { localDate, localWeekday } from './dates';
import { effectiveStatus, type Effective, type ItemRow } from './lifecycle';
import { LADDER_STEPS, ladderId, ladderUnlocked, unitPassed, unitsById, unitUnlocked, type Progress } from './progress';

// Sessions (BUILD_PLAN 14). Pure: the Today screen passes in content, progress and item rows.

export type TrackLetter = Exclude<TrackId, 'logic'>;
export const TRACK_ORDER: TrackLetter[] = ['A', 'B', 'C'];

export interface Suggestion {
  itemId?: string;
  href: string;
  label: string;
}

type Rows = Record<string, ItemRow | undefined>;
const status = (rows: Rows, id: string, now: Date): Effective => effectiveStatus(rows[id], now);
const done = (s: Effective) => s === 'passed' || s === 'pending_review';

export function hrefFor(itemId: string): string {
  const id = encodeURIComponent(itemId);
  if (/:(drill|comp):|^paper:literature-map:\d+$/.test(itemId)) return `/drill/${id}`;
  if (/:(reconstruct|object|reply)$/.test(itemId)) return `/doing/${id}`;
  if (/:(boss|final-boss)$/.test(itemId)) return `/boss/${id}`;
  if (/:ladder:|^paper:(final-paper|literature-map:synthesis)$/.test(itemId)) return `/write/${id}`;
  if (/:card:/.test(itemId)) return '/cards';
  return '/';
}

export const domainsOfTrack = (files: DomainFile[], track: TrackId) => files.filter((f) => f.domain.track === track).sort((a, b) => a.domain.order - b.domain.order);

// The track's current unit: the first one, in domain order, that is unlocked and not yet passed.
export function currentUnitOfTrack(files: DomainFile[], track: TrackId, p: Progress): Unit | null {
  const units = unitsById(files);
  for (const f of domainsOfTrack(files, track)) for (const u of f.units) if (!unitPassed(u, p) && unitUnlocked(u, p, units)) return u;
  return null;
}

// A revision is due when an item has failed and has not been revised yet (locked or waiting for revision).
export function revisionsDue(rows: Rows, now: Date, within?: (id: string) => boolean): Suggestion[] {
  return Object.values(rows)
    .filter((r): r is ItemRow => Boolean(r) && (!within || within(r!.item_id)))
    .filter((r) => {
      const s = effectiveStatus(r, now);
      return (s === 'locked' || s === 'revision_required') && !r.revision_done_at;
    })
    .map((r) => ({ itemId: r.item_id, href: `/revise/${encodeURIComponent(r.item_id)}`, label: 'Revise' }));
}

// Retries that are open: failed items whose lock is over and whose revision is done.
export function retriesOpen(rows: Rows, now: Date, within?: (id: string) => boolean): Suggestion[] {
  return Object.values(rows)
    .filter((r): r is ItemRow => Boolean(r) && (!within || within(r!.item_id)))
    .filter((r) => r.status === 'locked' && effectiveStatus(r, now) === 'available')
    .map((r) => ({ itemId: r.item_id, href: hrefFor(r.item_id), label: 'Try again' }));
}

const inUnits = (units: Unit[]) => {
  const ids = new Set(units.map((u) => u.id));
  const domains = new Set(units.map((u) => u.domain));
  return (itemId: string) => ids.has(itemId.split(':')[0]!) || domains.has(itemId.split(':')[0]! as Unit['domain']);
};

// BUILD_PLAN 14.1: the next item in the track, preferring a due revision, then reading comprehension, then a recall drill.
export function trackPick(files: DomainFile[], track: TrackLetter, p: Progress, rows: Rows, now: Date): Suggestion | null {
  const units = domainsOfTrack(files, track).flatMap((f) => f.units);
  const revision = revisionsDue(rows, now, inUnits(units))[0];
  if (revision) return { ...revision, label: 'A revision is due' };
  const unit = currentUnitOfTrack(files, track, p);
  if (!unit) return null;
  const comp = unit.reading.comprehension.find((d) => status(rows, d.id, now) === 'available');
  if (comp) return { itemId: comp.id, href: hrefFor(comp.id), label: `${unit.title}: reading comprehension ${comp.sourceId}` };
  const drill = unit.drills.find((d) => status(rows, d.id, now) === 'available');
  if (drill) return { itemId: drill.id, href: hrefFor(drill.id), label: `${unit.title}: drill ${drill.sourceId}` };
  return { href: `/practice/${unit.id}`, label: `${unit.title}: practice` };
}

export const isWeekend = (now: Date, weekendDay: number, tz?: string) => localWeekday(now, tz) === weekendDay;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Without a stored start the rotation counts from the day the app was built, so it still moves on each week.
export const ROTATION_EPOCH = '2026-10-19';

// The weekend track rotates A, B, C by week since the rotation start, skipping a track with nothing available.
export function weekendTrack(files: DomainFile[], p: Progress, now: Date, rotationStart: string | null, tz?: string): TrackLetter | null {
  const today = localDate(now, tz);
  const weeks = Math.floor(Math.max(0, daysBetween(rotationStart ?? ROTATION_EPOCH, today)) / 7);
  for (let k = 0; k < 3; k++) {
    const t = TRACK_ORDER[(weeks + k) % 3]!;
    if (currentUnitOfTrack(files, t, p)) return t;
  }
  return null;
}

export interface Act {
  key: 'failures' | 'reading' | 'doing' | 'boss';
  title: string;
  minutes: number;
  next: Suggestion | null; // null when there is nothing to do in this act
  note: string;
}

// BUILD_PLAN 14.2: the acts in fixed order; the review queue act went with the queue (PHASE_15_PLUS 1.3).
export function weekendActs(files: DomainFile[], p: Progress, rows: Rows, now: Date, track: TrackLetter | null): Act[] {
  const unit = track ? currentUnitOfTrack(files, track, p) : null;
  const failures = [...revisionsDue(rows, now), ...retriesOpen(rows, now)];

  let doing: Suggestion | null = null;
  let boss: Suggestion | null = null;
  if (unit) {
    const d = unit.doing;
    const nextDoing = [d.reconstruct.id, d.object.id, d.reply.id].find((id) => status(rows, id, now) === 'available');
    if (nextDoing) doing = { itemId: nextDoing, href: hrefFor(nextDoing), label: nextDoing.split(':')[1]!.replace(/^./, (c) => c.toUpperCase()) };
    // the mini-boss once the rest of the unit is passed or in review; otherwise a ladder step; otherwise extra practice
    const rest = [...unit.drills.map((x) => x.id), ...unit.reading.comprehension.map((x) => x.id), d.reconstruct.id, d.object.id, d.reply.id];
    const file = files.find((f) => f.domain.id === unit.domain)!;
    const ladder = ladderUnlocked(file, p) ? LADDER_STEPS.map((s) => ladderId(file.domain.id, s.step)).find((id) => status(rows, id, now) === 'available') : undefined;
    if (rest.every((id) => done(status(rows, id, now))) && status(rows, unit.miniBoss.id, now) === 'available') boss = { itemId: unit.miniBoss.id, href: hrefFor(unit.miniBoss.id), label: unit.miniBoss.name };
    else if (ladder) boss = { itemId: ladder, href: hrefFor(ladder), label: 'A writing ladder step' };
    else boss = { href: `/practice/${unit.id}`, label: 'Extra practice' };
  }

  return [
    { key: 'failures', title: "This week's failures", minutes: 10, next: failures[0] ?? null, note: failures.length ? `${failures.length} to revise or retry.` : 'Nothing failed this week.' },
    { key: 'reading', title: 'Reading', minutes: 20, next: unit ? { href: `/library/${unit.domain}/${unit.number}`, label: unit.title } : null, note: unit ? `The reading for ${unit.title}.` : 'No unit open in this track.' },
    { key: 'doing', title: 'Doing drills', minutes: 20, next: doing, note: doing ? 'Reconstruct, then object, then reply.' : 'All three are done for this unit.' },
    { key: 'boss', title: 'Boss or writing', minutes: 20, next: boss, note: boss?.label ?? 'Nothing open.' },
  ];
}
