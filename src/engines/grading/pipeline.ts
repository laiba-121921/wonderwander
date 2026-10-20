import type { AnswerKey } from '../../content/types';
import { decide, tieBreak, type AuditorView, type Decision, type GraderView, type ItemClass } from '../../domain/escalation';
import { applyDecision, freshRow, type ItemRow } from '../../domain/lifecycle';
import { readPref, writePref } from '../../lib/prefs';
import { currentTimezone } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { clearDraft, saveDraft } from './drafts';
import { keyBlock } from './keys';
import { callLlm, type LlmError } from './llm';

export interface GraderOutput extends GraderView {
  steps: string[];
  missing_or_wrong: string;
  feedback: string;
}
export interface AuditorOutput extends AuditorView {
  my_verdict: 'PASS' | 'FAIL' | 'ABSTAIN';
  grader_error: string;
}

export interface GradeInput {
  itemId: string;
  unitId: string | null;
  itemClass: ItemClass;
  exerciseText: string; // exactly what was shown, variant aware
  variantId: string | null;
  key: AnswerKey;
  answer: string;
  source: 'typed' | 'voice' | 'upload' | 'tap';
  lifecycle?: boolean; // false for cards, which follow FSRS instead of the lock-until-midnight lifecycle
  context?: Record<string, string>; // doing drills: what was shown besides the exercise text
  appealable?: boolean; // the item's verdicts can always be appealed, whatever the class
}

export type GradeOutcome =
  | { kind: 'decided'; decision: Decision; grader: GraderOutput | null; auditor: AuditorOutput | null; attemptId: string; row: ItemRow }
  | { kind: 'soft'; grader: GraderOutput; auditor: AuditorOutput; attemptId: string } // "Nearly. Say it more fully."
  | { kind: 'retry'; error: LlmError }; // nothing written; the draft is kept

export async function loadRow(itemId: string): Promise<ItemRow | undefined> {
  const { data } = await supabase.from('item_state').select('*').eq('item_id', itemId).maybeSingle();
  return (data as ItemRow | null) ?? undefined;
}

// One soft retry per attempt chain: the chain is remembered on the device, so leaving the screen does not reset it.
const chainKey = (itemId: string) => `softretry.${itemId}`;
export const pendingSoftRetry = (itemId: string) => readPref<string | null>(chainKey(itemId), null);
const setSoftRetry = (itemId: string, attemptId: string | null) => writePref(chainKey(itemId), attemptId);

// Writes the attempt and, for a final verdict, the item state (BUILD_PLAN 9.4, PHASE_15_PLUS 1).
export async function record(
  input: GradeInput,
  decision: Decision,
  grader: unknown,
  auditor: unknown,
  confidence: string | null,
  feedback: string | null,
  retryOf: string | null = null,
): Promise<{ attemptId: string; row: ItemRow }> {
  const attempt = await supabase
    .from('attempt')
    .insert({
      item_id: input.itemId,
      item_class: input.itemClass,
      exercise_text: input.exerciseText,
      variant_id: input.variantId,
      answer_text: input.answer,
      source: input.source,
      key_version: input.key.version,
      grader: grader as never,
      auditor: auditor as never,
      decision: decision.decision,
      confidence,
      context: input.context ?? null,
      appealable: decision.appealable,
      retry_of: retryOf,
    })
    .select('id')
    .single();
  if (attempt.error || !attempt.data) throw attempt.error ?? new Error('attempt not written');
  const attemptId = attempt.data.id;

  const prev = (await loadRow(input.itemId)) ?? freshRow(input.itemId, input.unitId);
  const row = applyDecision(prev, decision.decision, new Date(), currentTimezone(), attemptId, feedback);
  if (input.lifecycle !== false) {
    const up = await supabase.from('item_state').upsert({ ...row, updated_at: new Date().toISOString() });
    if (up.error) throw up.error;
  }
  return { attemptId, row };
}

// Busy, offline, the daily cap, a refused key, a blocked or garbled reply: nothing is written and the draft is kept.
export const RETRY: LlmError[] = ['busy', 'cap', 'offline', 'failed', 'denied', 'forbidden', 'blocked', 'unparseable'];

const withAppeal = (d: Decision, input: GradeInput): Decision => (input.appealable ? { ...d, appealable: true } : d);

const feedbackOf = (g: GraderOutput) => [g.feedback, g.missing_or_wrong].filter(Boolean).join(' Missing: ');

// grade, then audit, then the decision table (PHASE_15_PLUS 1.1). The first unresolved result is a soft retry; an
// unresolved second run goes to the tie-break, whose majority is final and appealable.
export async function gradeAnswer(input: GradeInput): Promise<GradeOutcome> {
  saveDraft(input.itemId, input.answer);
  const slots = { exercise_text: input.exerciseText, key_block: keyBlock(input.key), student_answer: input.answer };
  const retryOf = pendingSoftRetry(input.itemId);

  const g = await callLlm<GraderOutput>('grade', slots);
  if (!g.ok) return { kind: 'retry', error: g.error };
  const a = await callLlm<AuditorOutput>('audit', { ...slots, grader_json: JSON.stringify(g.data) });
  if (!a.ok) return { kind: 'retry', error: a.error };

  let decision = withAppeal(decide(input.itemClass, g.data, a.data), input);
  let tie: GraderOutput | null = null;
  if (decision.decision === 'RETRY') {
    if (!retryOf) {
      const { attemptId } = await record(input, decision, g.data, a.data, g.data.confidence, feedbackOf(g.data));
      setSoftRetry(input.itemId, attemptId);
      clearDraft(input.itemId);
      return { kind: 'soft', grader: g.data, auditor: a.data, attemptId };
    }
    const t = await callLlm<GraderOutput>('grade', slots, { second: true });
    if (!t.ok) return { kind: 'retry', error: t.error };
    tie = t.data;
    decision = tieBreak(g.data, a.data, t.data);
  }

  const graderRecord = tie ? { ...g.data, tiebreak: tie } : g.data;
  const { attemptId, row } = await record(input, decision, graderRecord, a.data, g.data.confidence, decision.decision === 'FAIL' ? feedbackOf(tie ?? g.data) : null, retryOf);
  setSoftRetry(input.itemId, null);
  clearDraft(input.itemId);
  return { kind: 'decided', decision, grader: g.data, auditor: a.data, attemptId, row };
}

// A TAP answer is decided on the device; it still writes an attempt and the item state.
export async function recordTap(input: GradeInput, correct: boolean): Promise<{ attemptId: string; row: ItemRow }> {
  return record(input, { decision: correct ? 'PASS' : 'FAIL', reasons: [], appealable: false }, null, null, null, correct ? null : 'Not the right option.');
}

// "Appeal this verdict" (PHASE_15_PLUS 1.3): the attempt joins the appeals list, once. Nothing waits for it.
export async function appeal(attemptId: string, itemId: string): Promise<boolean> {
  const { data } = await supabase.from('review_queue').select('id').eq('attempt_id', attemptId);
  if ((data ?? []).length) return true;
  const { error } = await supabase.from('review_queue').insert({ attempt_id: attemptId, item_id: itemId, reason: 'appeal' });
  return !error;
}
