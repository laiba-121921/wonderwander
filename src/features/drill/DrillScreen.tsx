import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { findDrill, type DrillRef } from '../../content/lookup';
import type { TapDrill } from '../../content/types';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import { makeRng, shuffle } from '../../engines/logic/rng';
import { loadDraft, saveDraft } from '../../engines/grading/drafts';
import { effectiveKey, type KeyOverride } from '../../engines/grading/keys';
import { type LlmError } from '../../engines/grading/llm';
import { LlmErrorText } from '../../ui/LlmErrorText';
import { gradeAnswer, loadRow, recordTap, type GradeInput, type GradeOutcome, type GraderOutput } from '../../engines/grading/pipeline';
import { exerciseFor, markVariantUsed, type Exercise } from '../../engines/grading/variants';
import { RetryWhenOnline } from '../../lib/online';
import { supabase } from '../../lib/supabase';
import { currentTimezone } from '../../lib/profile';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Prose } from '../../ui/Prose';
import { TapOption } from '../../ui/TapOption';
import { TextArea } from '../../ui/TextArea';
import { GradingWait } from './GradingWait';
import { ResultPanel, SoftRetryPanel } from './ResultPanel';

type Phase = { kind: 'loading' } | { kind: 'answer'; soft?: GraderOutput } | { kind: 'grading' } | { kind: 'result'; outcome: Extract<GradeOutcome, { kind: 'decided' }> } | { kind: 'retry'; error: LlmError };

function lockTime(row: ItemRow): string {
  return new Date(row.locked_until!).toLocaleString('en-GB', { timeZone: currentTimezone(), weekday: 'long', hour: '2-digit', minute: '2-digit' });
}

export default function DrillScreen() {
  const itemId = decodeURIComponent(useParams().itemId ?? '');
  const navigate = useNavigate();
  const [ref, setRef] = useState<DrillRef | null>(null);
  const [row, setRow] = useState<ItemRow | undefined>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [answer, setAnswer] = useState(() => loadDraft(itemId)?.text ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [r, state] = await Promise.all([findDrill(itemId), loadRow(itemId)]);
        if (!live) return;
        setRef(r);
        setRow(state);
        if (r.drill.kind === 'keyed' && effectiveStatus(state, new Date()) === 'available') {
          const ex = await exerciseFor(r.drill, state?.fail_count ?? 0);
          if (live) setExercise(ex);
        } else setExercise({ text: r.drill.prompt, variantId: null });
        if (live) setPhase({ kind: 'answer' });
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [itemId]);

  // A retried TAP drill reshuffles its options (BUILD_PLAN 9.3).
  const options = useMemo(() => (ref?.drill.kind === 'tap' ? shuffle(makeRng((row?.fail_count ?? 0) + 1), (ref.drill as TapDrill).options) : []), [ref, row?.fail_count]);

  if (error) return <p>That drill could not be opened. {error}</p>;
  if (!ref || phase.kind === 'loading' || !exercise) return <GradingWaitOrOpening loading={!ref} />;

  const { drill, comprehension } = ref;
  const back = () => navigate(ref.backTo);
  const status = effectiveStatus(row, new Date());
  const header = (
    <>
      <BackLink to={ref.backTo} label={ref.title} />
      <p className="mt-1 mb-3 text-caption text-ink-soft">
        {comprehension ? 'Reading comprehension' : 'Drill'} {drill.sourceId}
      </p>
    </>
  );

  // A drill opened while locked shows the lock; straight after a failed attempt the result is shown instead.
  if ((status === 'locked' || status === 'revision_required') && phase.kind !== 'result') {
    return (
      <div>
        {header}
        <Card className="mb-4">
          <Prose markdown={drill.prompt} />
        </Card>
        <p className="mb-4">{status === 'locked' ? `Back tomorrow at midnight (${lockTime(row!)}). You can revise now.` : 'Revise this first, then you can try again.'}</p>
        {row?.revision_done_at ? <p className="text-small text-ink-soft">Revised. The retry opens at midnight.</p> : <Button onClick={() => navigate(`/revise/${encodeURIComponent(drill.id)}`)}>Revise now</Button>}
      </div>
    );
  }

  const input = async (): Promise<GradeInput> => {
    const overrides = await supabase.from('key_override').select('item_id,version,accept_add,reject_add,required_edit').eq('item_id', drill.id);
    return {
      itemId: drill.id,
      unitId: ref.unitId,
      itemClass: drill.kind === 'tap' ? 'tap' : comprehension ? 'comprehension' : 'recall',
      exerciseText: exercise.text,
      variantId: exercise.variantId,
      key: drill.kind === 'keyed' ? effectiveKey(drill.key, (overrides.data as KeyOverride[]) ?? []) : { required: [], accept: [], reject: [], version: 1 },
      appealable: drill.kind === 'keyed' && drill.appealable,
      answer: drill.kind === 'tap' ? (picked ?? '') : answer,
      source: drill.kind === 'tap' ? 'tap' : 'typed',
    };
  };

  const submit = async () => {
    setPhase({ kind: 'grading' });
    try {
      const gi = await input();
      if (drill.kind === 'tap') {
        const correct = drill.correct.includes(picked!);
        const { attemptId, row: next } = await recordTap(gi, correct);
        setRow(next);
        setPhase({ kind: 'result', outcome: { kind: 'decided', decision: { decision: correct ? 'PASS' : 'FAIL', reasons: [], appealable: false }, grader: null, auditor: null, attemptId, row: next } });
        return;
      }
      const outcome = await gradeAnswer(gi);
      if (outcome.kind === 'retry') return setPhase({ kind: 'retry', error: outcome.error });
      if (outcome.kind === 'soft') return setPhase({ kind: 'answer', soft: outcome.grader });
      await markVariantUsed(exercise.variantId);
      setRow(outcome.row);
      setPhase({ kind: 'result', outcome });
    } catch {
      setPhase({ kind: 'retry', error: navigator.onLine ? 'failed' : 'offline' });
    }
  };

  return (
    <div>
      {header}
      <Card className="mb-4">
        <Prose markdown={drill.kind === 'tap' ? drill.prompt || 'Choose one.' : exercise.text} />
        {exercise.variantId && <p className="mt-2 text-caption text-ink-soft">A fresh version of this drill.</p>}
      </Card>

      {phase.kind === 'answer' && drill.kind === 'tap' && (
        <>
          <div className="flex flex-col gap-3" role="group" aria-label="Options">
            {options.map((o, i) => (
              <TapOption key={o.id} selected={picked === o.id} onSelect={() => setPicked(o.id)} seed={40 + i}>
                {o.text}
              </TapOption>
            ))}
          </div>
          <Button block className="mt-5" disabled={!picked} onClick={submit}>
            Check
          </Button>
        </>
      )}

      {phase.kind === 'answer' && drill.kind === 'keyed' && (
        <>
          {phase.soft && <SoftRetryPanel missing={phase.soft.missing_or_wrong} feedback={phase.soft.feedback} />}
          <TextArea
            label="Your answer"
            value={answer}
            onChange={(v) => {
              setAnswer(v);
              saveDraft(drill.id, v);
            }}
          />
          <Button block className="mt-4" disabled={!answer.trim()} onClick={submit}>
            {phase.soft ? 'Check my fuller answer' : 'Check my answer'}
          </Button>
        </>
      )}

      {phase.kind === 'grading' && <GradingWait />}

      {phase.kind === 'retry' && (
        <div role="alert" className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4">
          <LlmErrorText error={phase.error} />
          {phase.error === 'offline' && <RetryWhenOnline onRetry={() => void submit()} />}
          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={submit}>Try again</Button>
          </div>
        </div>
      )}

      {phase.kind === 'result' && (
        <>
          {drill.kind === 'keyed' && (
            <p className="calm mb-2 text-[16px] text-ink-soft">
              <span className="font-bold">Your answer: </span>
              {answer}
            </p>
          )}
          <ResultPanel
            decision={phase.outcome.decision.decision === 'PASS' ? 'PASS' : 'FAIL'}
            appealOf={drill.kind === 'keyed' ? { attemptId: phase.outcome.attemptId, itemId: drill.id } : null}
            feedback={phase.outcome.grader?.feedback ?? (drill.kind === 'tap' ? (drill.keyNote ?? null) : null)}
            missing={phase.outcome.grader?.missing_or_wrong ?? null}
            onRevise={() => navigate(`/revise/${encodeURIComponent(drill.id)}`)}
            onNext={back}
          />
        </>
      )}
    </div>
  );
}

function GradingWaitOrOpening({ loading }: { loading: boolean }) {
  return loading ? <p className="text-ink-soft">Opening...</p> : <GradingWait />;
}
