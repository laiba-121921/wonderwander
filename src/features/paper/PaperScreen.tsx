import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DOMAINS, hasPaperModule, loadDomain, loadPaper, useLoad } from '../../content/load';
import { FINAL_PAPER_ID, SYNTHESIS_ID } from '../../content/writing';
import { effectiveStatus, type Effective, type ItemRow } from '../../domain/lifecycle';
import { paperUnlocked, unitsById } from '../../domain/progress';
import { useProgress } from '../../lib/progress';
import { supabase } from '../../lib/supabase';
import { BackLink } from '../../ui/BackLink';
import { Prose } from '../../ui/Prose';
import { StatusBadge, type Status } from '../../ui/StatusBadge';

const BADGE: Record<Effective, { status: Status; label: string }> = {
  available: { status: 'available', label: 'Ready' },
  passed: { status: 'passed', label: 'Passed' },
  pending_review: { status: 'queued', label: 'Waiting' },
  locked: { status: 'failed', label: 'Back tomorrow' },
  revision_required: { status: 'failed', label: 'Revise first' },
};

function Row({ to, label, row, open }: { to: string; label: string; row?: ItemRow; open: boolean }) {
  const b = BADGE[effectiveStatus(row, new Date())];
  const inner = (
    <>
      <span className="text-body">{label}</span>
      {open ? <StatusBadge status={b.status} label={b.label} /> : <StatusBadge status="locked" />}
    </>
  );
  return (
    <li>
      {open ? (
        <Link to={to} className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-ink no-underline">
          {inner}
        </Link>
      ) : (
        <span className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-ink-soft">{inner}</span>
      )}
    </li>
  );
}

// The Paper Module (BUILD_PLAN 10, 13.1): readable at any time; its practice opens when Religion 7 and
// Religious Epistemology 6 are passed.
export default function PaperScreen() {
  // the module exists only for whoever can read the pack's owner-only files (PHASE_15_PLUS 3.3)
  const content = useLoad(() => Promise.all([loadPaper(), Promise.all(DOMAINS.map((d) => loadDomain(d.id)))]), []);
  const { progress } = useProgress();
  const [rows, setRows] = useState<Record<string, ItemRow>>({});
  const [show, setShow] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('item_state')
      .select('*')
      .eq('unit_id', 'paper')
      .then(({ data }) => setRows(Object.fromEntries(((data as ItemRow[]) ?? []).map((r) => [r.item_id, r]))));
  }, []);

  if (content.error || !hasPaperModule()) return <p>That part of the library does not exist.</p>;
  if (!content.data) return <p className="text-ink-soft">Opening...</p>;
  const [paper, files] = content.data;
  const open = paperUnlocked(progress, unitsById(files));
  const section = (key: string, title: string, md: string) => (
    <div className="border-b border-ink/10">
      <button type="button" className="flex min-h-12 w-full items-center justify-between py-2.5 text-left text-body font-semibold" aria-expanded={show === key} onClick={() => setShow(show === key ? null : key)}>
        {title}
        <span aria-hidden="true">{show === key ? '-' : '+'}</span>
      </button>
      {show === key && <Prose markdown={md} className="pb-5" />}
    </div>
  );

  return (
    <div>
      <BackLink to="/library" label="Library" />
      <h1 className="mt-1 mb-2 text-heading">Paper Module</h1>
      <p className="mb-4 text-small text-ink-soft">Where this module mentions a weekly review, read: appeal.</p>
      {!open && <p className="mb-5 rounded-card border-2 border-lilac bg-lilac/30 p-3 text-small">Practice opens when Religion 7 and Religious Epistemology 6 are passed. Everything here can be read now.</p>}

      <section className="mb-8">
        {section('intro', 'About this module', paper.intro)}
        {section('theses', 'The three theses', paper.theses.map((t) => t.text).join('\n\n'))}
        {section('sources', 'Sources', paper.sources)}
        {section('guide', 'Reading guide', paper.readingGuide.map((q, i) => `${i + 1}. ${q}`).join('\n'))}
        {section('why', 'Why these texts matter', paper.whyTheseMatter)}
      </section>

      <h2 className="mb-2 text-title">Comprehension</h2>
      <ol className="mb-8">
        {paper.comprehension.map((d) => (
          <Row key={d.id} to={`/drill/${encodeURIComponent(d.id)}`} label={d.sourceId} row={rows[d.id]} open={open} />
        ))}
      </ol>

      <h2 className="mb-1 text-title">Literature map</h2>
      <p className="mb-2 text-small text-ink-soft">Four questions for each abstract, then a 300 word synthesis.</p>
      <ol className="mb-8">
        {paper.literatureMap.keys.map((k, i) => {
          const id = `${paper.literatureMap.id}:${i + 1}`;
          return <Row key={id} to={`/drill/${encodeURIComponent(id)}`} label={k.label} row={rows[id]} open={open} />;
        })}
        <Row to={`/write/${encodeURIComponent(SYNTHESIS_ID)}`} label="Synthesis" row={rows[SYNTHESIS_ID]} open={open} />
      </ol>

      {paper.thesisSets.map((s) => (
        <section key={s.thesis} className="mb-8">
          <h2 className="mb-2 text-title">
            Thesis {s.thesis}: {s.title}
          </h2>
          <ol>
            <Row to={`/doing/${encodeURIComponent(s.reconstruct.id)}`} label="Reconstruct" row={rows[s.reconstruct.id]} open={open} />
            <Row to={`/doing/${encodeURIComponent(s.object.id)}`} label="Object" row={rows[s.object.id]} open={open} />
            <Row to={`/doing/${encodeURIComponent(s.reply.id)}`} label="Reply" row={rows[s.reply.id]} open={open} />
          </ol>
        </section>
      ))}

      <section className="mb-8">
        {section('gate', 'The selection gate', paper.selectionGate)}
        {section('ladders', 'How each domain ladder feeds the paper', paper.ladderTheses.map((t) => `**${t.label}:** ${t.text}`).join('\n\n'))}
      </section>

      <h2 className="mb-2 text-title">The paper</h2>
      <ol>
        <Row to={`/write/${encodeURIComponent(FINAL_PAPER_ID)}`} label="The final paper (3000 to 5000 words)" row={rows[FINAL_PAPER_ID]} open={open} />
      </ol>
    </div>
  );
}
