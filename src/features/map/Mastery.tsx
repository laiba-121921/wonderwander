import type { Unit } from '../../content/types';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import type { Progress } from '../../domain/progress';

const WORD: Record<string, string> = { passed: 'passed', pending_review: 'waiting', locked: 'back tomorrow', revision_required: 'revise first', available: 'not yet' };

// The unit's components from BUILD_PLAN 13.2 with their states, for the map sheet and the unit hub.
export function MasteryChecklist({ unit, progress, rows }: { unit: Unit; progress: Progress; rows: Record<string, ItemRow | undefined> }) {
  const now = new Date();
  const count = (ids: string[]) => ids.filter((id) => progress.items[id] === 'passed').length;
  const cards = unit.cards.filter((c) => (progress.cardPassDays[c.id] ?? 0) >= 2).length;
  const one = (id: string) => WORD[effectiveStatus(rows[id], now)];
  const lines: [string, string][] = [
    ['Drills', `${count(unit.drills.map((d) => d.id))} of ${unit.drills.length}`],
    ['Cards', `${cards} of ${unit.cards.length} on two days`],
    ['Reading comprehension', `${count(unit.reading.comprehension.map((d) => d.id))} of ${unit.reading.comprehension.length}`],
    ['Reconstruct', one(unit.doing.reconstruct.id)!],
    ['Object', one(unit.doing.object.id)!],
    ['Reply', one(unit.doing.reply.id)!],
    [`Boss: ${unit.miniBoss.name}`, one(unit.miniBoss.id)!],
  ];
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-small">
      {lines.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd className="text-right font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
