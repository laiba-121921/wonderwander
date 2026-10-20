import { useState } from 'react';
import { Doodle } from '../../art/Doodle';
import { appeal } from '../../engines/grading/pipeline';
import { Button } from '../../ui/Button';

export interface ResultPanelProps {
  decision: 'PASS' | 'FAIL';
  feedback?: string | null;
  missing?: string | null;
  onRevise?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  appealOf?: { attemptId: string; itemId: string } | null; // a FAIL can be appealed (PHASE_15_PLUS 1.3)
}

// Microcopy from BUILD_PLAN 19.8. Feedback text is shown plainly, never restyled.
export function ResultPanel({ decision, feedback, missing, onRevise, onNext, nextLabel = 'Back to the unit', appealOf }: ResultPanelProps) {
  const [appealed, setAppealed] = useState<'no' | 'yes' | 'failed'>('no');
  const style = decision === 'PASS' ? 'border-mint bg-mint/40' : 'border-coral bg-coral-tint';
  return (
    <div role="status" className={`mt-5 rounded-card border-2 p-4 ${style}`}>
      <div className="flex items-start gap-3">
        {decision === 'FAIL' && <Doodle name="padlock" size={34} />}
        {decision === 'PASS' && <Doodle name="star" size={34} />}
        <p className="font-bold">
          {decision === 'PASS' && 'Nailed it. That premise never saw you coming.'}
          {decision === 'FAIL' && 'Not this time. This one rests until tomorrow. Here is what to revisit.'}
        </p>
      </div>
      {missing && decision === 'FAIL' && (
        <p className="calm mt-3 text-[16px]">
          <span className="font-bold">What was missing: </span>
          {missing}
        </p>
      )}
      {feedback && <p className="calm mt-2 text-[16px]">{feedback}</p>}
      {decision === 'FAIL' && <p className="mt-3 text-small">Back tomorrow at midnight. You can revise now.</p>}
      <div className="mt-4 flex flex-col gap-3">
        {decision === 'FAIL' && onRevise && <Button onClick={onRevise}>Revise now</Button>}
        {onNext && (
          <Button variant="secondary" onClick={onNext}>
            {nextLabel}
          </Button>
        )}
        {decision === 'FAIL' && appealOf && appealed !== 'yes' && (
          <Button variant="quiet" onClick={async () => setAppealed((await appeal(appealOf.attemptId, appealOf.itemId)) ? 'yes' : 'failed')}>
            Appeal this verdict
          </Button>
        )}
        {appealed === 'yes' && <p className="text-small">Appealed. It waits in Me, Appeals, whenever you want a second opinion. Nothing else waits for it.</p>}
        {appealed === 'failed' && <p className="text-small">The appeal did not save. Check your connection and try again.</p>}
      </div>
    </div>
  );
}

// PHASE_15_PLUS 1.1: an unresolved first result is not a fail. The item stays open for one fuller answer.
export function SoftRetryPanel({ missing, feedback }: { missing?: string | null; feedback?: string | null }) {
  return (
    <div role="status" className="mt-5 rounded-card border-2 border-butter bg-butter/40 p-4">
      <div className="flex items-start gap-3">
        <Doodle name="kite" size={34} />
        <p className="font-bold">Nearly. Say it more fully.</p>
      </div>
      {missing && <p className="calm mt-3 text-[16px]">{missing}</p>}
      {feedback && <p className="calm mt-2 text-[16px]">{feedback}</p>}
      <p className="mt-3 text-small">Nothing is locked. Answer again below; your first answer is there to build on.</p>
    </div>
  );
}
