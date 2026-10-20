import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadDomain, useLoad } from '../../content/load';
import type { DomainFile } from '../../content/types';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import { LADDER_STEPS, ladderId, ladderUnlocked } from '../../domain/progress';
import { useProgress } from '../../lib/progress';
import { supabase } from '../../lib/supabase';
import { StatusBadge } from '../../ui/StatusBadge';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Prose } from '../../ui/Prose';
import { RoughFrame } from '../../ui/RoughFrame';

export default function DomainScreen() {
  const { domainId = '' } = useParams();
  const { data, error } = useLoad(() => loadDomain(domainId), [domainId]);
  const [showIntro, setShowIntro] = useState(false);

  if (error) return <p>That part of the library does not exist.</p>;
  if (!data) return <p className="text-ink-soft">Opening...</p>;
  const { domain, units } = data;

  return (
    <div>
      <BackLink to="/library" label="Library" />
      <h1 className="mt-1 mb-5 text-heading">{domain.title}</h1>

      <div className="flex flex-col gap-3">
        {units.map((u) => (
          <Link key={u.id} to={`/library/${domain.id}/${u.number}`} className="relative block min-h-12 px-4 py-3 text-ink no-underline">
            <RoughFrame radius={18} fill="var(--paper-raised)" seed={u.number * 3} />
            <span className="relative flex gap-3">
              <span className="w-7 shrink-0 text-title font-bold" style={{ color: 'var(--ink-soft)' }}>
                {u.number}
              </span>
              <span className="text-body font-semibold">{u.title}</span>
            </span>
          </Link>
        ))}
      </div>

      <Link to={`/boss/${encodeURIComponent(domain.finalBoss.id)}`} className="relative mt-6 block min-h-12 px-4 py-3 text-ink no-underline">
        <RoughFrame radius={18} fill="var(--paper-raised)" seed={97} sticker />
        <span className="relative block">
          <span className="block text-caption font-bold">Final boss</span>
          <span className="text-body font-semibold">{domain.finalBoss.name}</span>
        </span>
      </Link>

      <LadderList file={data} />

      {(domain.intro || domain.outro) && (
        <div className="mt-8">
          <Button variant="secondary" onClick={() => setShowIntro((v) => !v)}>
            {showIntro ? 'Hide the track notes' : 'Read the track notes'}
          </Button>
          {showIntro && (
            <div className="mt-5">
              {domain.intro && <Prose markdown={domain.intro} />}
              {domain.outro && <Prose markdown={domain.outro} className="mt-6" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STEP_TITLE: Record<string, string> = { abstract: 'Abstract', reconstruction: 'Reconstruction section', objection_reply: 'Objection and reply', referee: 'Referee round' };

// The writing ladder opens once four units of the domain are passed (BUILD_PLAN 13.1).
function LadderList({ file }: { file: DomainFile }) {
  const { progress } = useProgress();
  const [rows, setRows] = useState<Record<string, ItemRow>>({});
  useEffect(() => {
    supabase
      .from('item_state')
      .select('*')
      .eq('unit_id', file.domain.id)
      .then(({ data }) => setRows(Object.fromEntries(((data as ItemRow[]) ?? []).map((r) => [r.item_id, r]))));
  }, [file.domain.id]);
  const open = ladderUnlocked(file, progress);
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-title">Writing ladder</h2>
      {!open && <p className="mb-2 text-small text-ink-soft">Opens when four units of {file.domain.title} are passed.</p>}
      <ol>
        {LADDER_STEPS.map((s, i) => {
          const id = ladderId(file.domain.id, s.step);
          const st = effectiveStatus(rows[id], new Date());
          const badge =
            st === 'passed' ? <StatusBadge status="passed" /> : st === 'pending_review' ? <StatusBadge status="queued" /> : st === 'available' ? <StatusBadge status="available" /> : <StatusBadge status="failed" />;
          const label = (
            <span className="text-body">
              <span className="mr-2 text-ink-soft tabular-nums">{i + 1}.</span>
              {STEP_TITLE[s.step]}
            </span>
          );
          return (
            <li key={id}>
              {open ? (
                <Link to={`/write/${encodeURIComponent(id)}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-ink no-underline">
                  {label}
                  {badge}
                </Link>
              ) : (
                <span className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-ink-soft">
                  {label}
                  <StatusBadge status="locked" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
