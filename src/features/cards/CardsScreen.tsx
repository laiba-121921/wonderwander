import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doodle } from '../../art/Doodle';
import { DOMAINS, loadDomain } from '../../content/load';
import type { Card as ContentCard } from '../../content/types';
import { unitsById, unitUnlocked } from '../../domain/progress';
import { effectiveKey, type KeyOverride } from '../../engines/grading/keys';
import { type LlmError } from '../../engines/grading/llm';
import { LlmErrorText } from '../../ui/LlmErrorText';
import { gradeAnswer, type GradeOutcome, type GraderOutput } from '../../engines/grading/pipeline';
import { loadDraft, saveDraft } from '../../engines/grading/drafts';
import { ensureCardStates, loadCardStates, saveCardReview } from '../../engines/srs/cardStore';
import { DAILY_CARD_CAP, todaysCards, type CardState } from '../../engines/srs/cards';
import { fetchProgress } from '../../lib/progress';
import { RetryWhenOnline } from '../../lib/online';
import { supabase } from '../../lib/supabase';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextArea } from '../../ui/TextArea';
import { GradingWait } from '../drill/GradingWait';
import { ResultPanel, SoftRetryPanel } from '../drill/ResultPanel';

interface Due {
  state: CardState;
  card: ContentCard;
  unitId: string;
}

// Loads every unlocked unit's cards, creates any missing card states, and returns today's due list.
export async function loadDue(): Promise<{ core: Due[]; extra: Due[] }> {
  const files = await Promise.all(DOMAINS.map((d) => loadDomain(d.id)));
  const units = unitsById(files);
  const progress = await fetchProgress();
  const open = [...units.values()].filter((u) => unitUnlocked(u, progress, units));
  const cards = new Map(open.flatMap((u) => u.cards.map((c) => [c.id, { card: c, unitId: u.id }] as const)));
  const states = await ensureCardStates([...cards.values()].map((c) => c.card), await loadCardStates());
  const { core, extra } = todaysCards(
    states.filter((s) => cards.has(s.cardId)),
    new Date(),
  );
  const withCard = (s: CardState): Due => ({ state: s, ...cards.get(s.cardId)! });
  return { core: core.map(withCard), extra: extra.map(withCard) };
}

const draftFor = (d?: Due) => (d ? (loadDraft(d.card.id)?.text ?? '') : '');

export default function CardsScreen() {
  const [queue, setQueue] = useState<Due[] | null>(null);
  const [extra, setExtra] = useState<Due[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<'answer' | 'grading' | 'result' | 'retry'>('answer');
  const [soft, setSoft] = useState<GraderOutput | null>(null);
  const [outcome, setOutcome] = useState<Extract<GradeOutcome, { kind: 'decided' }> | null>(null);
  const [retryError, setRetryError] = useState<LlmError>('failed');
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    loadDue().then(
      ({ core, extra }) => {
        setQueue(core);
        setExtra(extra);
        setAnswer(draftFor(core[0]));
      },
      (e: Error) => setFailed(e.message),
    );
  }, []);

  const current = queue?.[index];

  if (failed) return <p>Cards could not load. {failed}</p>;
  if (!queue) return <p className="text-ink-soft">Gathering your cards...</p>;

  if (!current) {
    return (
      <div className="text-center">
        <div className="mt-6 flex justify-center">
          <Doodle name={queue.length ? 'star' : 'owl'} size={64} />
        </div>
        <h1 className="mt-3 text-heading">{queue.length ? 'Cards done' : 'No cards due'}</h1>
        <p className="mt-2">{queue.length ? `That was your ${Math.min(queue.length, DAILY_CARD_CAP)} for today.` : 'Nothing waiting. Come back tomorrow.'}</p>
        {extra.length > 0 && (
          <Button
            block
            variant="secondary"
            className="mt-6"
            onClick={() => {
              setQueue((q) => [...(q ?? []), ...extra]);
              setExtra([]);
            }}
          >
            Keep going: {extra.length} more due
          </Button>
        )}
        <Link to="/" className="mt-4 block min-h-12 py-3">
          Back to today
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setPhase('grading');
    try {
      const overrides = await supabase.from('key_override').select('item_id,version,accept_add,reject_add,required_edit').eq('item_id', current.card.id);
      const out = await gradeAnswer({
        itemId: current.card.id,
        unitId: current.unitId,
        itemClass: 'card',
        exerciseText: current.card.front,
        variantId: null,
        key: effectiveKey(current.card.key, (overrides.data as KeyOverride[]) ?? []),
        answer,
        source: 'typed',
        lifecycle: false,
      });
      if (out.kind === 'retry') {
        setRetryError(out.error);
        return setPhase('retry');
      }
      if (out.kind === 'soft') {
        setSoft(out.grader);
        return setPhase('answer');
      }
      setSoft(null);
      await saveCardReview(current.state, out.decision.decision, out.grader?.confidence, out.attemptId);
      setOutcome(out);
      setPhase('result');
    } catch {
      setRetryError(navigator.onLine ? 'failed' : 'offline');
      setPhase('retry');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <BackLink to="/" label="Today" />
        <span className="text-small text-ink-soft tabular-nums">
          {index + 1} of {queue.length}
        </span>
      </div>
      <Card className="mb-4">
        <p className="mb-1 text-caption font-bold">Card</p>
        <p className="calm">{current.card.front}</p>
      </Card>
      {phase === 'answer' && (
        <>
          {soft && <SoftRetryPanel missing={soft.missing_or_wrong} feedback={soft.feedback} />}
          <TextArea
            label="Your answer"
            value={answer}
            onChange={(v) => {
              setAnswer(v);
              saveDraft(current.card.id, v);
            }}
          />
          <Button block className="mt-4" disabled={!answer.trim()} onClick={submit}>
            Check
          </Button>
        </>
      )}
      {phase === 'grading' && <GradingWait />}
      {phase === 'retry' && (
        <div role="alert" className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4">
          <LlmErrorText error={retryError} />
          {retryError === 'offline' && <RetryWhenOnline onRetry={() => void submit()} />}
          <Button className="mt-4" onClick={submit}>
            Try again
          </Button>
        </div>
      )}
      {phase === 'result' && outcome && (
        <>
          <Card className="mb-2" fill={outcome.decision.decision === 'PASS' ? 'var(--mint)' : 'var(--paper-raised)'}>
            <p className="mb-1 text-caption font-bold">The back of the card</p>
            <p className="calm">{current.card.back}</p>
          </Card>
          <ResultPanel
            decision={outcome.decision.decision === 'PASS' ? 'PASS' : 'FAIL'}
            appealOf={{ attemptId: outcome.attemptId, itemId: current.card.id }}
            feedback={outcome.grader?.feedback}
            missing={outcome.grader?.missing_or_wrong}
            onNext={() => {
              setAnswer(draftFor(queue[index + 1]));
              setIndex((i) => i + 1);
              setPhase('answer');
              setOutcome(null);
            }}
            nextLabel="Next card"
          />
        </>
      )}
    </div>
  );
}
