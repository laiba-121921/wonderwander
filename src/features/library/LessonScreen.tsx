import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { loadDomain, useLoad } from '../../content/load';
import { useReaderFont, useScrollMemory } from '../../lib/prefs';
import { BackLink } from '../../ui/BackLink';
import { Prose } from '../../ui/Prose';
import { Sheet } from '../../ui/Sheet';
import { lessonParts } from './UnitLibraryScreen';

const anchor = (id: string) => `part-${id.replace(/[^a-zA-Z0-9]+/g, '-')}`;

// The whole lesson on one calm page, with a sections sheet and remembered position.
export default function LessonScreen() {
  const { unitId = '' } = useParams();
  const [params] = useSearchParams();
  const domainId = unitId.replace(/-\d+$/, '');
  const { data, error } = useLoad(() => loadDomain(domainId), [domainId]);
  const unit = data?.units.find((u) => u.id === unitId);
  const [font] = useReaderFont();
  const [sections, setSections] = useState(false);
  const target = params.get('s');
  const progress = useScrollMemory(`lesson.${unitId}`, Boolean(unit), !target);

  useEffect(() => {
    if (!unit || !target) return;
    requestAnimationFrame(() => document.getElementById(anchor(target))?.scrollIntoView());
  }, [unit, target]);

  if (error) return <p>That lesson does not exist.</p>;
  if (!data) return <p className="text-ink-soft">Opening...</p>;
  if (!unit) return <p>That lesson does not exist.</p>;

  const blocks = [
    ...unit.lesson.map((s) => ({ id: s.id, title: `${s.number} ${s.heading}`, markdown: s.markdown })),
    ...(unit.whyCares ? [{ id: `${unit.id}:why`, title: 'Why philosophy cares', markdown: unit.whyCares }] : []),
    { id: `${unit.id}:worked`, title: 'Worked examples', markdown: unit.workedExamples },
    { id: `${unit.id}:mistakes`, title: 'Common mistakes', markdown: unit.mistakes },
  ];

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b-2 border-ink/15 bg-paper/95 px-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <BackLink to={`/library/${domainId}/${unit.number}`} label={`Unit ${unit.number}`} />
          <button type="button" onClick={() => setSections(true)} className="min-h-12 px-2 text-small font-semibold underline decoration-2 underline-offset-4">
            Sections
          </button>
        </div>
        <div className="h-1 bg-ink/10" aria-hidden="true">
          <div className="h-1 bg-amber" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <h1 className="mb-6 text-heading">{unit.title}</h1>
      {blocks.map((b) => (
        <section key={b.id} id={anchor(b.id)} className="mb-10 scroll-mt-20">
          <h2 className="mb-3 text-title">{b.title}</h2>
          <Prose markdown={b.markdown} fontSize={font} />
        </section>
      ))}

      <Sheet open={sections} onClose={() => setSections(false)} title="Sections">
        <ol className="max-h-[60dvh] overflow-y-auto">
          {lessonParts(unit).map((p) => (
            <li key={p.id}>
              <Link
                to={`/lesson/${unit.id}?s=${encodeURIComponent(p.id)}`}
                replace
                onClick={() => setSections(false)}
                className="block min-h-12 py-2.5 text-body"
              >
                {p.title}
              </Link>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
