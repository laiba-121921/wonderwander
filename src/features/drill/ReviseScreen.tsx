import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadPaper } from '../../content/load';
import { doingKindOf, findBoss, findDoing, findDrill, isBossId, isLadderId, loadUnit } from '../../content/lookup';
import type { LessonSection } from '../../content/types';
import { ladderRevisable } from '../writing/ladderRevisable';
import { markRevised, type ItemRow } from '../../domain/lifecycle';
import { loadRow } from '../../engines/grading/pipeline';
import { supabase } from '../../lib/supabase';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Prose } from '../../ui/Prose';

export const MIN_REVISION_SECONDS = 60;

// What a revision page shows: the lesson sections a drill tests, or for reading and doing drills the reading guide.
interface Revisable {
  prompt: string;
  back: string;
  sections: LessonSection[];
  guide: string[] | null;
  title?: string;
}

async function findRevisable(itemId: string): Promise<Revisable> {
  // a boss's revision material is the judge's written verdict, shown as the feedback (BUILD_PLAN 10.1)
  if (isBossId(itemId)) {
    const { boss } = await findBoss(itemId);
    return { prompt: boss.position, back: `/boss/${encodeURIComponent(itemId)}`, sections: [], guide: null, title: 'The position you argued against' };
  }
  if (isLadderId(itemId)) return ladderRevisable(itemId);
  if (doingKindOf(itemId)) {
    const { source } = await findDoing(itemId);
    const guide = source.unitId === 'paper' ? (await loadPaper()).readingGuide : (await loadUnit(source.unitId)).unit.reading.guide;
    return { prompt: source.reconstruct.passage ?? source.reconstruct.prompt, back: `/doing/${encodeURIComponent(itemId)}`, sections: [], guide };
  }
  const r = await findDrill(itemId);
  return { prompt: r.drill.prompt, back: `/drill/${encodeURIComponent(r.drill.id)}`, sections: r.sections, guide: r.comprehension ? r.guide : null };
}

// BUILD_PLAN 9.3: the drill as attempted, the feedback, the lesson sections it tests. "I've revised" opens after
// the page has been read to the end and at least sixty seconds have passed.
export default function ReviseScreen() {
  const itemId = decodeURIComponent(useParams().itemId ?? '');
  const navigate = useNavigate();
  const [ref, setRef] = useState<Revisable | null>(null);
  const [row, setRow] = useState<ItemRow | undefined>();
  const [attempt, setAttempt] = useState<{ exercise_text: string; answer_text: string } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [r, state] = await Promise.all([findRevisable(itemId), loadRow(itemId)]);
      setRef(r);
      setRow(state);
      if (state?.last_attempt_id) {
        const { data } = await supabase.from('attempt').select('exercise_text,answer_text').eq('id', state.last_attempt_id).maybeSingle();
        setAttempt(data);
      }
    })();
  }, [itemId]);

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const el = end.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setReachedEnd(true));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  if (!ref) return <p className="text-ink-soft">Opening...</p>;
  const { sections } = ref;
  const ready = reachedEnd && seconds >= MIN_REVISION_SECONDS && row;

  return (
    <div>
      <BackLink to={ref.back} label="Back to the drill" />
      <h1 className="mt-1 mb-5 text-heading">Revise</h1>

      <Card className="mb-4">
        <p className="mb-1 text-caption font-bold">{ref.title ?? 'The drill as you saw it'}</p>
        <Prose markdown={ref.title ? ref.prompt : (attempt?.exercise_text ?? ref.prompt)} />
        {attempt?.answer_text && (
          <p className="calm mt-3 text-[16px] whitespace-pre-line text-ink-soft">
            <span className="font-bold">{ref.title ? 'The fight: ' : 'Your answer: '}</span>
            {attempt.answer_text}
          </p>
        )}
      </Card>

      {row?.last_feedback && (
        <div className="mb-6 rounded-card border-2 border-coral bg-coral-tint p-4">
          <p className="mb-1 text-caption font-bold">{ref.title ? "The judge's verdict" : 'Feedback'}</p>
          <p className="calm text-[16px]">{row.last_feedback}</p>
        </div>
      )}

      {(ref.guide || sections.length > 0) && <h2 className="mb-3 text-title">{ref.guide ? 'The reading guide' : 'The lesson sections this drill tests'}</h2>}
      {ref.guide ? (
        <Prose markdown={ref.guide.map((q, i) => `${i + 1}. ${q}`).join('\n')} />
      ) : (
        sections.map((s) => (
          <section key={s.id} className="mb-8">
            <h3 className="mb-2 text-body font-bold">
              {s.number} {s.heading}
            </h3>
            <Prose markdown={s.markdown} />
          </section>
        ))
      )}

      <div ref={end} className="mt-8 pb-4">
        <Button
          block
          disabled={!ready}
          onClick={async () => {
            const next = markRevised(row!, new Date());
            await supabase.from('item_state').update({ revision_done_at: next.revision_done_at, updated_at: new Date().toISOString() }).eq('item_id', next.item_id);
            navigate(ref.back);
          }}
        >
          I've revised
        </Button>
        {!ready && (
          <p className="mt-2 text-center text-caption text-ink-soft">
            {seconds < MIN_REVISION_SECONDS ? `Opens in ${MIN_REVISION_SECONDS - seconds} seconds, once you have read to the end.` : 'Read to the end to open it.'}
          </p>
        )}
      </div>
    </div>
  );
}
