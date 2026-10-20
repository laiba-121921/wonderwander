import type { LessonSection } from '../../src/content/types';
import { paragraphs } from './markdown';

const STOP = new Set(
  'about above after again against because been before being below between both could does doing down during each from further have having here into itself just more most must only other over same should some such than that their them then there these they this those through under until very what when where which while whom will with would your state give name explain define answer argument premise premises conclusion objection reply true false example following does name'.split(
    ' ',
  ),
);

export function terms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => w.replace(/(ies)$/, 'y').replace(/(?<!s)s$/, '')),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

// BUILD_PLAN 5.3: key terms of the drill against section headings (weighted) and opening paragraphs.
export function mapRevision(drillText: string, lesson: LessonSection[]): { ids: string[]; confident: boolean; best: number } {
  const drill = terms(drillText);
  const scored = lesson.map((s) => {
    const opening = paragraphs(s.markdown).slice(0, 2).join(' ');
    return { id: s.id, score: 3 * overlap(drill, terms(s.heading)) + overlap(drill, terms(opening)) };
  });
  const best = Math.max(0, ...scored.map((s) => s.score));
  if (best < 3) return { ids: lesson.map((s) => s.id), confident: false, best };
  const cut = Math.max(3, Math.ceil(best * 0.6));
  return { ids: scored.filter((s) => s.score >= cut).map((s) => s.id), confident: true, best };
}
