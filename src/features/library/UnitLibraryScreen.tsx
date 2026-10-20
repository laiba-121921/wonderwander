import { Link, useNavigate, useParams } from 'react-router-dom';
import { DOMAINS, loadDomain, useLoad } from '../../content/load';
import { useEffect, useState } from 'react';
import type { ItemRow } from '../../domain/lifecycle';
import { unitMastery, unitsById, unitUnlocked, unmetSoftPrerequisites, type Progress } from '../../domain/progress';
import { supabase } from '../../lib/supabase';
import { MasteryChecklist } from '../map/Mastery';
import { useProgress } from '../../lib/progress';
import type { TextRef, Unit } from '../../content/types';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Prose } from '../../ui/Prose';

const ROLE: Record<TextRef['role'], string> = {
  primary: 'Primary text',
  second: 'Second text',
  companion: 'Companion',
  optional: 'Optional',
};

export function lessonParts(unit: Unit): { id: string; title: string }[] {
  return [
    ...unit.lesson.map((s) => ({ id: s.id, title: `${s.number} ${s.heading}` })),
    ...(unit.whyCares ? [{ id: `${unit.id}:why`, title: 'Why philosophy cares' }] : []),
    { id: `${unit.id}:worked`, title: 'Worked examples' },
    { id: `${unit.id}:mistakes`, title: 'Common mistakes' },
  ];
}

function TextCard({ text, phrase, index }: { text: TextRef; phrase?: string; index: number }) {
  const navigate = useNavigate();
  // the appendix's own label ("Primary", "Technique", "Philosophy (serves as technique too)") is shown verbatim
  const label = text.label.match(/^\*\*([^*]+?):?\*\*:?\s*/);
  return (
    <Card seed={60 + index} className="mb-4">
      <p className="mb-2 text-caption font-bold">{label ? label[1] : ROLE[text.role]}</p>
      <Prose markdown={label ? text.label.slice(label[0].length) : text.label} className="text-[16px]" />
      <div className="mt-3 flex flex-col gap-2.5">
        {text.bundled?.map((b) => (
          <Button key={b.id} block onClick={() => navigate(`/read/${b.id}${phrase ? `?find=${encodeURIComponent(phrase)}` : ''}`)}>
            Read {b.title} here
          </Button>
        ))}
        {text.links?.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center rounded-button border-2 border-ink bg-paper-raised px-4 py-2 text-small font-semibold text-ink no-underline"
          >
            Open {l.title}
          </a>
        ))}
        {text.unavailable?.map((w) => (
          <p key={w} className="text-caption text-ink-soft">
            Not free online: {w}. Borrow it from a library or buy it.
          </p>
        ))}
        {!text.bundled?.length && !text.links?.length && !text.unavailable?.length && (
          <p className="text-caption text-ink-soft">No free copy online. Borrow it from a library or buy it.</p>
        )}
      </div>
    </Card>
  );
}

// BUILD_PLAN 13.3: the exact percentage and the component checklist, on tap.
function UnitMastery({ unit, progress }: { unit: Unit; progress: Progress }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, ItemRow>>({});
  useEffect(() => {
    supabase
      .from('item_state')
      .select('*')
      .eq('unit_id', unit.id)
      .then(({ data }) => setRows(Object.fromEntries(((data as ItemRow[]) ?? []).map((r) => [r.item_id, r]))));
  }, [unit.id]);
  return (
    <div className="mb-4">
      <button type="button" className="min-h-12 text-body font-bold" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Mastery {Math.round(unitMastery(unit, progress))}%
      </button>
      {open && <MasteryChecklist unit={unit} progress={progress} rows={rows} />}
    </div>
  );
}

// Practice is gated in prerequisite order (BUILD_PLAN 13.1); reading never is.
function PractiseEntry({ unitId }: { unitId: string }) {
  const navigate = useNavigate();
  const all = useLoad(() => Promise.all(DOMAINS.map((d) => loadDomain(d.id))), []);
  const { progress } = useProgress();
  if (!all.data) return null;
  const units = unitsById(all.data);
  const unit = units.get(unitId)!;
  const open = unitUnlocked(unit, progress, units);
  const soft = unmetSoftPrerequisites(unit, progress, units);
  return (
    <div className="mb-8">
      <UnitMastery unit={unit} progress={progress} />
      {open ? (
        <Button block onClick={() => navigate(`/practice/${unitId}`)}>
          Practise this unit
        </Button>
      ) : (
        <p className="text-small text-ink-soft">Practice opens when you pass {unit.prerequisites.map((p) => p.replace(/-(\d+)$/, ' $1')).join(', ')}. You can read everything now.</p>
      )}
      {soft.length > 0 && <p className="mt-2 text-caption text-ink-soft">Helpful first, not required: {soft.map((p) => p.replace(/-(\d+)$/, ' $1')).join(', ')}.</p>}
    </div>
  );
}

export default function UnitLibraryScreen() {
  const { domainId = '', n = '' } = useParams();
  const { data, error } = useLoad(() => loadDomain(domainId), [domainId]);
  if (error) return <p>That part of the library does not exist.</p>;
  if (!data) return <p className="text-ink-soft">Opening...</p>;
  const unit = data.units.find((u) => String(u.number) === n);
  if (!unit) return <p>That unit does not exist.</p>;

  return (
    <div>
      <BackLink to={`/library/${domainId}`} label={data.domain.title} />
      <p className="mt-1 text-small text-ink-soft">Unit {unit.number}</p>
      <h1 className="mb-6 text-heading">{unit.title}</h1>

      <PractiseEntry unitId={unit.id} />

      <section className="mb-8">
        <h2 className="mb-3 text-title">Lesson</h2>
        <ol className="flex flex-col gap-1">
          {lessonParts(unit).map((p) => (
            <li key={p.id}>
              <Link to={`/lesson/${unit.id}?s=${encodeURIComponent(p.id)}`} className="block min-h-12 py-2.5 text-body">
                {p.title}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-title">Reading</h2>
        {unit.reading.texts.map((t, i) => (
          <TextCard key={i} text={t} index={i} phrase={unit.doing.reconstruct.identifyingPhrase} />
        ))}
        {unit.reading.guide.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-body font-bold">Read with these questions</h3>
            <Prose markdown={unit.reading.guide.map((q, i) => `${i + 1}. ${q}`).join('\n')} />
          </div>
        )}
        {unit.doing.reconstruct.passage && (
          <div className="mt-6">
            <h3 className="mb-2 text-body font-bold">The passage you will reconstruct</h3>
            <Prose markdown={unit.doing.reconstruct.passage} />
          </div>
        )}
      </section>
    </div>
  );
}
