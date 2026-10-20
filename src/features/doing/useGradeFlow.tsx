import { useState } from 'react';
import { type LlmError } from '../../engines/grading/llm';
import { LlmErrorText } from '../../ui/LlmErrorText';
import { gradeAnswer, type GradeInput, type GradeOutcome, type GraderOutput } from '../../engines/grading/pipeline';
import { RetryWhenOnline } from '../../lib/online';
import { Button } from '../../ui/Button';
import { GradingWait } from '../drill/GradingWait';
import { SoftRetryPanel } from '../drill/ResultPanel';

export type Decided = Extract<GradeOutcome, { kind: 'decided' }>;
export type FlowPhase = { kind: 'answer'; soft?: GraderOutput } | { kind: 'grading' } | { kind: 'result'; outcome: Decided } | { kind: 'retry'; error: LlmError };

// The same submit, wait, soft retry and try-again steps as a recall drill (BUILD_PLAN 9.4, PHASE_15_PLUS 1.1).
export function useGradeFlow(makeInput: () => Promise<GradeInput>, onDecided?: (o: Decided) => void) {
  const [phase, setPhase] = useState<FlowPhase>({ kind: 'answer' });

  const submit = async () => {
    setPhase({ kind: 'grading' });
    try {
      const outcome = await gradeAnswer(await makeInput());
      if (outcome.kind === 'retry') return setPhase({ kind: 'retry', error: outcome.error });
      if (outcome.kind === 'soft') return setPhase({ kind: 'answer', soft: outcome.grader });
      onDecided?.(outcome);
      setPhase({ kind: 'result', outcome });
    } catch {
      setPhase({ kind: 'retry', error: navigator.onLine ? 'failed' : 'offline' });
    }
  };

  const soft = phase.kind === 'answer' && phase.soft ? <SoftRetryPanel missing={phase.soft.missing_or_wrong} feedback={phase.soft.feedback} /> : null;
  const waiting = phase.kind === 'grading' ? <GradingWait /> : phase.kind === 'retry' ? <RetryBox error={phase.error} onRetry={submit} /> : null;

  return { phase, submit, waiting, soft };
}

export function RetryBox({ error, onRetry }: { error: LlmError; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4">
      <LlmErrorText error={error} />
      {error === 'offline' && <RetryWhenOnline onRetry={onRetry} />}
      <Button className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
