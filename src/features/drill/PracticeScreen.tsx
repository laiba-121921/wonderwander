import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadUnit } from '../../content/lookup';
import { useLoad } from '../../content/load';
import type { Drill } from '../../content/types';
import { effectiveStatus, type Effective, type ItemRow } from '../../domain/lifecycle';
import { supabase } from '../../lib/supabase';
import { BackLink } from '../../ui/BackLink';
import { StatusBadge, type Status } from '../../ui/StatusBadge';

const BADGE: Record<Effective, { status: Status; label: string }> = {
  available: { status: 'available', label: 'Ready' },
  passed: { status: 'passed', label: 'Passed' },
  pending_review: { status: 'queued', label: 'Waiting' },
  locked: { status: 'failed', label: 'Back tomorrow' },
  revision_required: { status: 'failed', label: 'Revise first' },
};

function DrillRow({ drill, row, index }: { drill: Drill; row?: ItemRow; index: number }) {
  const b = BADGE[effectiveStatus(row, new Date())];
  return (
    <li>
      <Link to={`/drill/${encodeURIComponent(drill.id)}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-ink no-underline">
        <span className="text-body">
          <span className="mr-2 text-ink-soft tabular-nums">{index + 1}.</span>
          {drill.sourceId}
          {drill.kind === 'tap' && <span className="ml-2 text-caption text-ink-soft">tap</span>}
        </span>
        <StatusBadge status={b.status} label={b.label} />
      </Link>
    </li>
  );
}

function DoingRow({ itemId, label, row, index, to = 'doing' }: { itemId: string; label: string; row?: ItemRow; index: number; to?: 'doing' | 'boss' }) {
  const b = BADGE[effectiveStatus(row, new Date())];
  return (
    <li>
      <Link to={`/${to}/${encodeURIComponent(itemId)}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10 py-2.5 text-ink no-underline">
        <span className="text-body">
          <span className="mr-2 text-ink-soft tabular-nums">{index + 1}.</span>
          {label}
        </span>
        <StatusBadge status={b.status} label={b.label} />
      </Link>
    </li>
  );
}

// The unit's practice items in order, ending with its mini-boss.
export default function PracticeScreen() {
  const { unitId = '' } = useParams();
  const content = useLoad(() => loadUnit(unitId), [unitId]);
  const [rows, setRows] = useState<Record<string, ItemRow>>({});

  useEffect(() => {
    supabase
      .from('item_state')
      .select('*')
      .eq('unit_id', unitId)
      .then(({ data }) => setRows(Object.fromEntries(((data as ItemRow[]) ?? []).map((r) => [r.item_id, r]))));
  }, [unitId]);

  if (content.error) return <p>That unit does not exist.</p>;
  if (!content.data) return <p className="text-ink-soft">Opening...</p>;
  const { unit } = content.data;
  return (
    <div>
      <BackLink to={`/library/${unit.domain}/${unit.number}`} label={`Unit ${unit.number}`} />
      <h1 className="mt-1 mb-6 text-heading">Practise: {unit.title}</h1>
      <h2 className="mb-2 text-title">Drills</h2>
      <ol className="mb-8">
        {unit.drills.map((d, i) => (
          <DrillRow key={d.id} drill={d} row={rows[d.id]} index={i} />
        ))}
      </ol>
      <h2 className="mb-2 text-title">Reading comprehension</h2>
      <ol className="mb-8">
        {unit.reading.comprehension.map((d, i) => (
          <DrillRow key={d.id} drill={d} row={rows[d.id]} index={i} />
        ))}
      </ol>
      <h2 className="mb-1 text-title">Doing drills</h2>
      <p className="mb-2 text-small text-ink-soft">On the passage from {unit.doing.authorPlaybook.author}: reconstruct, then object, then reply.</p>
      <ol>
        {[
          { id: unit.doing.reconstruct.id, label: 'Reconstruct' },
          { id: unit.doing.object.id, label: 'Object' },
          { id: unit.doing.reply.id, label: 'Reply' },
        ].map((d, i) => (
          <DoingRow key={d.id} itemId={d.id} label={d.label} row={rows[d.id]} index={i} />
        ))}
      </ol>
      <h2 className="mt-8 mb-2 text-title">Mini-boss</h2>
      <ol>
        <DoingRow itemId={unit.miniBoss.id} label={unit.miniBoss.name} row={rows[unit.miniBoss.id]} index={0} to="boss" />
      </ol>
    </div>
  );
}
