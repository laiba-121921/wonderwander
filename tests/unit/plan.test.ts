import { describe, expect, it } from 'vitest';
import type { DomainFile } from '../../src/content/types';
import type { ItemRow } from '../../src/domain/lifecycle';
import { currentUnitOfTrack, hrefFor, isWeekend, retriesOpen, revisionsDue, trackPick, weekendActs, weekendTrack } from '../../src/domain/plan';
import { emptyProgress, unitItemIds, type Progress } from '../../src/domain/progress';
import { layoutTrack, MAP_WIDTH, wind } from '../../src/features/map/layout';
import { HAS_CONTENT, readContent } from '../content';

const DOMAINS = ['logic', 'epistemology', 'metaphysics', 'mind', 'religion', 'religious-epistemology', 'political'];
const files: DomainFile[] = HAS_CONTENT ? DOMAINS.map((d) => readContent<DomainFile>(`content/json/${d}.json`, { domain: {} as DomainFile['domain'], units: [] })) : [];
const unit = (id: string) => files.flatMap((f) => f.units).find((u) => u.id === id)!;

function passedUnits(ids: string[]): Progress {
  const p = emptyProgress();
  for (const id of ids) {
    const u = unit(id);
    for (const item of unitItemIds(u)) p.items[item] = 'passed';
    for (const c of u.cards) p.cardPassDays[c.id] = 2;
  }
  return p;
}

const row = (item_id: string, extra: Partial<ItemRow> = {}): ItemRow => ({ item_id, unit_id: item_id.split(':')[0]!, status: 'available', locked_until: null, revision_done_at: null, fail_count: 0, last_attempt_id: null, last_feedback: null, ...extra });
const now = new Date('2026-10-19T08:00:00Z'); // a Monday, 13:00 in Karachi

describe.skipIf(!HAS_CONTENT)('daily plan (BUILD_PLAN 14.1)', () => {
  it('the tracks open once Logic 1 is passed', () => {
    expect(currentUnitOfTrack(files, 'A', emptyProgress())).toBeNull();
    expect(currentUnitOfTrack(files, 'logic', emptyProgress())?.id).toBe('logic-1');
    const p = passedUnits(['logic-1']);
    expect(currentUnitOfTrack(files, 'A', p)?.id).toBe('epistemology-1');
    expect(currentUnitOfTrack(files, 'B', p)?.id).toBe('religion-1');
    expect(currentUnitOfTrack(files, 'C', p)?.id).toBe('political-1');
  });

  it('a track pick prefers a due revision, then reading comprehension, then a recall drill', () => {
    const p = passedUnits(['logic-1']);
    expect(trackPick(files, 'A', p, {}, now)?.itemId).toBe('epistemology-1:comp:C1');
    const comp = Object.fromEntries(unit('epistemology-1').reading.comprehension.map((d) => [d.id, row(d.id, { status: 'passed' })]));
    expect(trackPick(files, 'A', p, comp, now)?.itemId).toBe(unit('epistemology-1').drills[0]!.id);
    const failed = { ...comp, 'epistemology-1:drill:E1-04': row('epistemology-1:drill:E1-04', { status: 'locked', locked_until: '2026-10-19T19:00:00Z', fail_count: 1 }) };
    expect(trackPick(files, 'A', p, failed, now)).toMatchObject({ itemId: 'epistemology-1:drill:E1-04', href: '/revise/epistemology-1%3Adrill%3AE1-04' });
    expect(trackPick(files, 'B', p, failed, now)?.itemId).toBe('religion-1:comp:C1'); // another track's revision stays there
    expect(trackPick(files, 'A', emptyProgress(), {}, now)).toBeNull();
  });

  it('revisions are due until revised, and the retry opens after midnight once revised', () => {
    const locked = row('logic-1:drill:L1-04', { status: 'locked', locked_until: '2026-10-19T19:00:00Z', fail_count: 1 });
    expect(revisionsDue({ a: locked }, now)).toHaveLength(1);
    const revised = { ...locked, revision_done_at: '2026-10-19T09:00:00Z' };
    expect(revisionsDue({ a: revised }, now)).toHaveLength(0);
    expect(retriesOpen({ a: revised }, now)).toHaveLength(0);
    expect(retriesOpen({ a: revised }, new Date('2026-10-19T19:30:00Z'))).toEqual([{ itemId: 'logic-1:drill:L1-04', href: '/drill/logic-1%3Adrill%3AL1-04', label: 'Try again' }]);
  });

  it('links every kind of item to its screen', () => {
    expect(hrefFor('logic-1:comp:C2')).toBe('/drill/logic-1%3Acomp%3AC2');
    expect(hrefFor('logic-1:object')).toBe('/doing/logic-1%3Aobject');
    expect(hrefFor('logic:final-boss')).toBe('/boss/logic%3Afinal-boss');
    expect(hrefFor('mind:ladder:abstract')).toBe('/write/mind%3Aladder%3Aabstract');
    expect(hrefFor('logic-1:card:3')).toBe('/cards');
  });
});

describe.skipIf(!HAS_CONTENT)('weekend ritual (BUILD_PLAN 14.2)', () => {
  it('is on the profile weekend day in Karachi', () => {
    expect(isWeekend(now, 1)).toBe(true);
    expect(isWeekend(now, 0)).toBe(false);
    expect(isWeekend(new Date('2026-10-18T19:30:00Z'), 1)).toBe(true); // Sunday evening UTC is already Monday in Karachi
  });

  it('rotates A, B, C by week since the start, skipping a track with nothing available', () => {
    const p = passedUnits(['logic-1']);
    expect(weekendTrack(files, p, now, '2026-10-19')).toBe('A');
    expect(weekendTrack(files, p, new Date('2026-10-26T08:00:00Z'), '2026-10-19')).toBe('B');
    expect(weekendTrack(files, p, new Date('2026-11-02T08:00:00Z'), '2026-10-19')).toBe('C');
    expect(weekendTrack(files, p, new Date('2026-11-09T08:00:00Z'), '2026-10-19')).toBe('A');
    expect(weekendTrack(files, emptyProgress(), now, '2026-10-19')).toBeNull();
  });

  it('builds the four acts in order, offering the mini-boss only once the rest of the unit is done', () => {
    const p = passedUnits(['logic-1']);
    const acts = weekendActs(files, p, {}, now, 'A');
    expect(acts.map((a) => a.key)).toEqual(['failures', 'reading', 'doing', 'boss']);
    expect(acts[0]!.next).toBeNull();
    expect(acts[1]!.next?.href).toBe('/library/epistemology/1');
    expect(acts[2]!.next?.itemId).toBe('epistemology-1:reconstruct');
    expect(acts[3]!.next?.label).toBe('Extra practice');

    const u = unit('epistemology-1');
    const rest = Object.fromEntries(
      [...u.drills.map((d) => d.id), ...u.reading.comprehension.map((d) => d.id), u.doing.reconstruct.id, u.doing.object.id, u.doing.reply.id].map((id) => [id, row(id, { status: 'pending_review' })]),
    );
    const later = weekendActs(files, p, rest, now, 'A');
    expect(later[2]!.next).toBeNull();
    expect(later[3]!.next?.itemId).toBe('epistemology-1:boss');
  });
});

describe.skipIf(!HAS_CONTENT)('Wander Map layout (BUILD_PLAN 19.5)', () => {
  it('stacks one region per domain with every unit as a stop and a gate at the far edge', () => {
    const trackB = files.filter((f) => f.domain.track === 'B');
    const l = layoutTrack(trackB);
    expect(l.width).toBe(MAP_WIDTH);
    expect(l.regions.map((r) => r.domainId)).toEqual(['religion', 'religious-epistemology']);
    expect(l.regions.map((r) => r.nodes.length)).toEqual([9, 6]);
    expect(l.regions[1]!.y).toBeGreaterThan(l.regions[0]!.y + l.regions[0]!.height);
    for (const r of l.regions) {
      for (const n of r.nodes) {
        expect(n.y).toBeGreaterThan(r.y);
        expect(n.y).toBeLessThan(r.gate.y);
      }
      expect(r.gate.y).toBeLessThan(r.y + r.height);
    }
    const xs = l.regions[0]!.nodes.map((n) => n.x);
    expect(new Set(xs).size).toBe(2); // the path winds left and right
  });

  it('winds a path through the points', () => {
    expect(wind([])).toBe('');
    expect(wind([[0, 0], [10, 20]])).toBe('M 0 0 C 0 10, 10 10, 10 20');
  });
});
