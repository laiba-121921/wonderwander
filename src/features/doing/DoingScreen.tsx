import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadDoingText, loadText, useLoad } from '../../content/load';
import { doingKindOf, findDoing, type DoingKind } from '../../content/lookup';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import { playbookOf, type DoingSource } from '../../engines/doing/source';
import {
  emptyReconstruction,
  excerptAround,
  isComplete,
  parse,
  replyExercise,
  replyPromptText,
  sentenceCount,
  serialise,
  type DoingText,
  type Reconstruction,
  type Target,
} from '../../engines/doing/standardForm';
import { loadDraft, saveDraft } from '../../engines/grading/drafts';
import { effectiveKey, type KeyOverride } from '../../engines/grading/keys';
import { callLlm, type LlmError } from '../../engines/grading/llm';
import { LlmErrorText } from '../../ui/LlmErrorText';
import type { GradeInput } from '../../engines/grading/pipeline';
import { supabase } from '../../lib/supabase';
import { currentTimezone } from '../../lib/profile';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { Prose } from '../../ui/Prose';
import { TextArea } from '../../ui/TextArea';
import { ResultPanel } from '../drill/ResultPanel';
import { ReconstructBuilder } from './ReconstructBuilder';
import { useGradeFlow, type Decided } from './useGradeFlow';

const TITLE: Record<DoingKind, string> = { reconstruct: 'Reconstruct', object: 'Object', reply: 'Reply' };
const NEXT: Record<DoingKind, DoingKind | null> = { reconstruct: 'object', object: 'reply', reply: null };

type Rows = Record<string, ItemRow>;

interface ViewProps {
  src: DoingSource;
  text: DoingText;
  rows: Rows;
  onRow: (row: ItemRow) => void;
}

const idOf = (src: DoingSource, kind: DoingKind) => `${src.prefix}:${kind}`;

async function keyOverrides(itemId: string): Promise<KeyOverride[]> {
  const { data } = await supabase.from('key_override').select('item_id,version,accept_add,reject_add,required_edit').eq('item_id', itemId);
  return (data as KeyOverride[]) ?? [];
}

async function attemptById(id: string | null | undefined) {
  if (!id) return null;
  const { data } = await supabase.from('attempt').select('id,answer_text,context').eq('id', id).maybeSingle();
  return data as { id: string; answer_text: string; context: Record<string, string> | null } | null;
}

// Three doing drills, in order: reconstruct, then object, then reply (Testing Architecture section 4). The same
// screens serve a unit's set and the Paper Module's thesis sets.
export default function DoingScreen() {
  const itemId = decodeURIComponent(useParams().itemId ?? '');
  const kind = doingKindOf(itemId);
  const content = useLoad(() => Promise.all([findDoing(itemId), loadDoingText()]), [itemId]);
  const [rows, setRows] = useState<{ itemId: string; rows: Rows } | null>(null);
  const unitId = content.data?.[0].source.unitId;

  useEffect(() => {
    if (!unitId) return;
    let live = true;
    supabase
      .from('item_state')
      .select('*')
      .eq('unit_id', unitId)
      .then(({ data }) => live && setRows({ itemId, rows: Object.fromEntries(((data as ItemRow[]) ?? []).map((r) => [r.item_id, r])) }));
    return () => {
      live = false;
    };
  }, [unitId, itemId]);

  const onRow = useCallback((row: ItemRow) => setRows((r) => r && { ...r, rows: { ...r.rows, [row.item_id]: row } }), []);

  if (!kind || content.error) return <p>That drill does not exist.</p>;
  if (!content.data || rows?.itemId !== itemId) return <p className="text-ink-soft">Opening...</p>;
  const [{ source }, text] = content.data;
  const props = { src: source, text, rows: rows.rows, onRow };

  return (
    <div>
      <BackLink to={source.backTo} label={source.title} />
      <p className="mt-1 mb-3 text-caption text-ink-soft">Doing drill: {TITLE[kind]}</p>
      {kind === 'reconstruct' && <ReconstructView key={itemId} {...props} />}
      {kind === 'object' && <ObjectView key={itemId} {...props} />}
      {kind === 'reply' && <ReplyView key={itemId} {...props} />}
    </div>
  );
}

function lockTime(row: ItemRow): string {
  return new Date(row.locked_until!).toLocaleString('en-GB', { timeZone: currentTimezone(), weekday: 'long', hour: '2-digit', minute: '2-digit' });
}

// Shown instead of the answer area when the item cannot be attempted now.
function Waiting({ src, kind, row }: { src: DoingSource; kind: DoingKind; row: ItemRow | undefined }) {
  const navigate = useNavigate();
  const status = effectiveStatus(row, new Date());
  const next = NEXT[kind];
  if (status === 'locked' || status === 'revision_required') {
    return (
      <div className="mt-4">
        <p className="mb-4">{status === 'locked' ? `Back tomorrow at midnight (${lockTime(row!)}). You can revise now.` : 'Revise this first, then you can try again on the same passage.'}</p>
        {row?.revision_done_at ? (
          <p className="text-small text-ink-soft">Revised. The retry opens at midnight.</p>
        ) : (
          <Button onClick={() => navigate(`/revise/${encodeURIComponent(idOf(src, kind))}`)}>Revise now</Button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4" role="status">
      <p>{status === 'passed' ? 'Passed.' : 'Waiting for a verdict. You can carry on meanwhile.'}</p>
      {next && (
        <Button className="mt-4" onClick={() => navigate(`/doing/${encodeURIComponent(idOf(src, next))}`)}>
          Next: {TITLE[next]}
        </Button>
      )}
    </div>
  );
}

function Result({ src, kind, outcome, answer }: { src: DoingSource; kind: DoingKind; outcome: Decided; answer: string }) {
  const navigate = useNavigate();
  const next = NEXT[kind];
  const onward = next && outcome.decision.decision !== 'FAIL';
  return (
    <>
      <div className="calm mb-2 text-[16px] text-ink-soft">
        <span className="font-bold">Your answer: </span>
        <span className="whitespace-pre-line">{answer}</span>
      </div>
      <ResultPanel
        decision={outcome.decision.decision === 'PASS' ? 'PASS' : 'FAIL'}
        appealOf={{ attemptId: outcome.attemptId, itemId: idOf(src, kind) }}
        feedback={outcome.grader?.feedback ?? null}
        missing={outcome.grader?.missing_or_wrong ?? null}
        onRevise={() => navigate(`/revise/${encodeURIComponent(idOf(src, kind))}`)}
        onNext={() => navigate(onward ? `/doing/${encodeURIComponent(idOf(src, next))}` : src.backTo)}
        nextLabel={onward ? `Next: ${TITLE[next]}` : src.unitId === 'paper' ? 'Back to the Paper Module' : 'Back to the unit'}
      />
      {kind === 'object' && src.object.onTrack && (
        <details className="mt-4">
          <summary className="min-h-12 cursor-pointer py-2 text-body font-semibold">Objections that would be on track</summary>
          <p className="calm mt-1 text-[16px]">{src.object.onTrack}</p>
        </details>
      )}
    </>
  );
}

function ReconstructView({ src, rows, onRow }: ViewProps) {
  const r = src.reconstruct;
  const id = r.id;
  // the paragraph holding the identifying phrase, from the first bundled text that has it
  const excerpt = useLoad(async () => {
    if (!r.phrase) return null;
    for (const b of r.bundled) {
      const found = excerptAround(await loadText(b.id), r.phrase);
      if (found) return { textId: b.id, title: b.title, para: found };
    }
    return null;
  }, [id]);
  const [recon, setRecon] = useState<Reconstruction>(() => {
    const d = loadDraft(id)?.text;
    return d ? parse(d) : emptyReconstruction();
  });
  const answer = serialise(recon);

  const makeInput = async (): Promise<GradeInput> => ({
    itemId: id,
    unitId: src.unitId,
    itemClass: 'reconstruct',
    exerciseText: r.exercise(excerpt.data?.para ?? null),
    variantId: null,
    key: effectiveKey(r.key, await keyOverrides(id)),
    answer,
    source: 'typed',
  });
  const flow = useGradeFlow(makeInput, (o) => onRow(o.row));
  const status = effectiveStatus(rows[id], new Date());
  const first = r.bundled[0];

  return (
    <>
      <h1 className="mb-4 text-heading">Reconstruct the argument</h1>
      <Card className="mb-4">
        <Prose markdown={r.prompt} />
      </Card>
      {r.passage && (
        <Card seed={21} className="mb-6">
          <p className="mb-1 text-caption font-bold">The passage</p>
          <Prose markdown={r.passage} className="text-[16px]" />
          {excerpt.data && (
            <>
              <blockquote className="calm mt-3 border-l-4 border-amber pl-3 text-[16px]">{excerpt.data.para}</blockquote>
              <Link to={`/read/${excerpt.data.textId}?find=${encodeURIComponent(r.phrase ?? '')}`} className="mt-3 inline-flex min-h-12 items-center text-small font-semibold">
                Open {excerpt.data.title} at this passage
              </Link>
            </>
          )}
          {!excerpt.data && first && (
            <Link to={`/read/${first.id}${r.phrase ? `?find=${encodeURIComponent(r.phrase)}` : ''}`} className="mt-3 inline-flex min-h-12 items-center text-small font-semibold">
              Open {first.title}
            </Link>
          )}
        </Card>
      )}

      {flow.phase.kind === 'answer' && status !== 'available' && <Waiting src={src} kind="reconstruct" row={rows[id]} />}
      {flow.phase.kind === 'answer' && status === 'available' && (
        <>
          {flow.soft}
          <ReconstructBuilder
            value={recon}
            onChange={(v) => {
              setRecon(v);
              saveDraft(id, serialise(v));
            }}
          />
          <Button block className="mt-6" disabled={!isComplete(recon)} onClick={flow.submit}>
            Check my reconstruction
          </Button>
        </>
      )}
      {flow.waiting}
      {flow.phase.kind === 'result' && <Result src={src} kind="reconstruct" outcome={flow.phase.outcome} answer={answer} />}
    </>
  );
}

const premiseLabel = (t: Target) => (/^\d+$/.test(t.n) ? `Premise ${t.n}` : t.text.length > 28 ? `${t.text.slice(0, 26)}...` : t.text);

function ObjectView({ src, rows, onRow }: ViewProps) {
  const id = src.object.id;
  const reconRow = rows[src.reconstruct.id];
  // the student's last passing reconstruction, or the key's standard form if there is none (BUILD_PLAN 10)
  const own = useLoad(() => (reconRow?.status === 'passed' ? attemptById(reconRow.last_attempt_id) : Promise.resolve(null)), [reconRow?.status, reconRow?.last_attempt_id]);
  const targets = src.object.targets;
  const [targetIx, setTargetIx] = useState(0);
  const [answer, setAnswer] = useState(() => loadDraft(id)?.text ?? '');
  const target = targets[targetIx] ?? null;
  const argument = own.data?.answer_text ?? src.standardForm.join('\n');

  const makeInput = async (): Promise<GradeInput> => ({
    itemId: id,
    unitId: src.unitId,
    itemClass: 'object',
    exerciseText: src.object.exercise(argument, target),
    variantId: null,
    key: effectiveKey(src.object.key, await keyOverrides(id)),
    answer,
    source: 'typed',
    context: { n: target?.n ?? '', target: target?.text ?? '', argument },
  });
  const flow = useGradeFlow(makeInput, (o) => onRow(o.row));
  const status = effectiveStatus(rows[id], new Date());

  if (!reconRow) {
    return (
      <>
        <h1 className="mb-4 text-heading">Object to a premise</h1>
        <p className="mb-4">Reconstruct the argument first; the objection is aimed at it.</p>
        <Link to={`/doing/${encodeURIComponent(src.reconstruct.id)}`} className="text-body font-semibold">
          Go to Reconstruct
        </Link>
      </>
    );
  }
  const sentences = sentenceCount(answer);

  return (
    <>
      <h1 className="mb-4 text-heading">Object to a premise</h1>
      <Card seed={21} className="mb-4">
        <p className="mb-1 text-caption font-bold">{own.data ? 'Your reconstruction' : 'The argument in standard form'}</p>
        <p className="calm text-[16px] whitespace-pre-line">{argument}</p>
      </Card>
      {targets.length > 1 && flow.phase.kind === 'answer' && status === 'available' && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Premise to object to">
          {targets.map((t, i) => (
            <Chip key={t.n} selected={i === targetIx} seed={80 + i} onClick={() => setTargetIx(i)}>
              {premiseLabel(t)}
            </Chip>
          ))}
        </div>
      )}
      <Card className="mb-6">
        <Prose markdown={src.object.prompt(target)} />
        {target && /^\d+$/.test(target.n) && (
          <p className="calm mt-3 text-[16px]">
            <span className="font-bold">Premise {target.n}: </span>
            {target.text}
          </p>
        )}
      </Card>

      {flow.phase.kind === 'answer' && status !== 'available' && <Waiting src={src} kind="object" row={rows[id]} />}
      {flow.phase.kind === 'answer' && status === 'available' && (
        <>
          {flow.soft}
          <TextArea
            label="Your objection"
            value={answer}
            onChange={(v) => {
              setAnswer(v);
              saveDraft(id, v);
            }}
            hint={sentences > 4 ? `${sentences} sentences. Two to four is the aim; can you tighten it?` : 'Tap the mic to dictate, or hold it to record. Two to four sentences.'}
          />
          <Button block className="mt-4" disabled={!answer.trim()} onClick={flow.submit}>
            Send my objection
          </Button>
        </>
      )}
      {flow.waiting}
      {flow.phase.kind === 'result' && <Result src={src} kind="object" outcome={flow.phase.outcome} answer={answer} />}
    </>
  );
}

type AuthorState = { kind: 'loading' } | { kind: 'ready'; objection: string; reply: string; objectAttemptId: string } | { kind: 'error'; error: LlmError };

function ReplyView({ src, text, rows, onRow }: ViewProps) {
  const id = src.reply.id;
  const objectRow = rows[src.object.id];
  const objectStatus = effectiveStatus(objectRow, new Date());
  const objectReady = Boolean(objectRow?.last_attempt_id) && (objectStatus === 'pending_review' || objectStatus === 'passed');
  const [author, setAuthor] = useState<AuthorState>({ kind: 'loading' });
  const [answer, setAnswer] = useState(() => loadDraft(id)?.text ?? '');
  const asked = useRef(false);

  // The author's reply is generated once and kept with the objection's attempt, so reopening never asks again.
  const fetchReply = useCallback(async () => {
    setAuthor({ kind: 'loading' });
    const att = await attemptById(objectRow?.last_attempt_id);
    if (!att) return setAuthor({ kind: 'error', error: 'failed' });
    const ctx = att.context ?? {};
    if (ctx.authorReply) return setAuthor({ kind: 'ready', objection: att.answer_text, reply: ctx.authorReply, objectAttemptId: att.id });
    const r = await callLlm<{ text: string }>('author_reply', {
      author: src.author,
      n: ctx.n ?? '',
      playbook: playbookOf(src),
      standard_form: ctx.argument ?? src.standardForm.join('\n'),
      objection: att.answer_text,
    });
    if (!r.ok) return setAuthor({ kind: 'error', error: r.error });
    await supabase
      .from('attempt')
      .update({ context: { ...ctx, authorReply: r.data.text } })
      .eq('id', att.id);
    setAuthor({ kind: 'ready', objection: att.answer_text, reply: r.data.text, objectAttemptId: att.id });
  }, [objectRow?.last_attempt_id, src]);

  useEffect(() => {
    if (!objectReady || asked.current) return;
    asked.current = true;
    void fetchReply();
  }, [objectReady, fetchReply]);

  const makeInput = async (): Promise<GradeInput> => {
    if (author.kind !== 'ready') throw new Error('no author reply');
    return {
      itemId: id,
      unitId: src.unitId,
      itemClass: 'reply',
      exerciseText: replyExercise(text, author.objection, author.reply),
      variantId: null,
      key: effectiveKey(src.reply.key, await keyOverrides(id)),
      answer,
      source: 'typed',
      context: { objectAttemptId: author.objectAttemptId, authorReply: author.reply },
    };
  };
  const flow = useGradeFlow(makeInput, (o) => onRow(o.row));
  const status = effectiveStatus(rows[id], new Date());

  if (!objectReady) {
    return (
      <>
        <h1 className="mb-4 text-heading">Answer the author</h1>
        <p className="mb-4">{objectRow ? 'Your objection needs to pass before the author answers it.' : 'Send an objection first; the author replies to it.'}</p>
        <Link to={`/doing/${encodeURIComponent(src.object.id)}`} className="text-body font-semibold">
          Go to Object
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-heading">Answer the author</h1>
      {author.kind === 'loading' && (
        <p className="text-ink-soft" role="status">
          {src.author} is reading your objection...
        </p>
      )}
      {author.kind === 'error' && (
        <div role="alert" className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4">
          <LlmErrorText error={author.error} />
          <Button className="mt-4" onClick={fetchReply}>
            Try again
          </Button>
        </div>
      )}
      {author.kind === 'ready' && (
        <>
          <Card seed={21} className="mb-4">
            <p className="mb-1 text-caption font-bold">Your objection</p>
            <p className="calm text-[16px]">{author.objection}</p>
          </Card>
          <Card seed={33} className="mb-6">
            <p className="mb-1 text-caption font-bold">{src.author} replies</p>
            <Prose markdown={replyPromptText(text, author.reply)} />
          </Card>
          {flow.phase.kind === 'answer' && status !== 'available' && <Waiting src={src} kind="reply" row={rows[id]} />}
          {flow.phase.kind === 'answer' && status === 'available' && (
            <>
              {flow.soft}
              <TextArea
                label="Your answer to the reply"
                value={answer}
                onChange={(v) => {
                  setAnswer(v);
                  saveDraft(id, v);
                }}
              />
              <Button block className="mt-4" disabled={!answer.trim()} onClick={flow.submit}>
                Send my answer
              </Button>
            </>
          )}
          {flow.waiting}
          {flow.phase.kind === 'result' && <Result src={src} kind="reply" outcome={flow.phase.outcome} answer={answer} />}
        </>
      )}
    </>
  );
}
