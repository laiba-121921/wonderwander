import type { ItemClass } from '../../domain/escalation';
import { decide, tieBreak, type Decision } from '../../domain/escalation';
import type { ItemRow } from '../../domain/lifecycle';
import { supabase } from '../../lib/supabase';
import { callLlm, type LlmError } from '../grading/llm';
import { record, type AuditorOutput } from '../grading/pipeline';
import type { Phase, Turn } from './fight';

export interface Session {
  id: string;
  boss_id: string;
  transcript: Turn[];
  level: number;
  phase: Phase;
  status: 'active' | 'judging' | 'decided';
  attempt_id: string | null;
  created_at: string;
}

// The newest fight for this boss, so a closed app resumes it (BUILD_PLAN 10.1).
export async function latestSession(bossId: string): Promise<Session | null> {
  const { data } = await supabase.from('boss_session').select('*').eq('boss_id', bossId);
  const rows = ((data as Session[] | null) ?? []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const s = rows[0];
  // a damaged row never takes the screen down: an unreadable transcript starts the fight afresh
  return s ? { ...s, transcript: Array.isArray(s.transcript) ? s.transcript.filter((t) => t && typeof t.text === 'string') : [] } : null;
}

export async function startSession(bossId: string, first: Turn): Promise<Session> {
  const { data, error } = await supabase
    .from('boss_session')
    .insert({ boss_id: bossId, transcript: [first] as never, level: 1, phase: 'normal', status: 'active', created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('fight not started');
  return data as unknown as Session;
}

// Saved after every turn.
export async function saveSession(s: Session): Promise<void> {
  const { error } = await supabase
    .from('boss_session')
    .update({ transcript: s.transcript as never, level: s.level, phase: s.phase, status: s.status, attempt_id: s.attempt_id })
    .eq('id', s.id);
  if (error) throw error;
}

export interface JudgeOutput {
  checklist: Record<string, string>;
  rubric: { item: string; result: 'PASS' | 'FAIL'; quote: string }[];
  verdict: 'PASS' | 'FAIL' | 'ABSTAIN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  written: string;
}

export interface JudgeInput {
  itemId: string;
  unitId: string | null;
  itemClass: Extract<ItemClass, 'mini_boss' | 'final_boss'>;
  playbook: string;
  rubric: string[];
  rubricText: string;
  transcript: string;
  sessionId: string;
}

export type JudgeOutcome = { kind: 'decided'; decision: Decision; judge: JudgeOutput; second: JudgeOutput | null; attemptId: string; row: ItemRow } | { kind: 'retry'; error: LlmError };

// The judge, then the auditor on the judge (BUILD_PLAN 8.1): the playbook is the EXERCISE, the rubric the KEY and the
// transcript the STUDENT ANSWER. Then the decision table (PHASE_15_PLUS 1.2). A fight cannot be answered again, so an
// unresolved result goes straight to the tie-break: a second judge at temperature 0.3, and the majority decides.
export async function judgeFight(input: JudgeInput): Promise<JudgeOutcome> {
  const slots = { playbook: input.playbook, rubric: input.rubricText, transcript: input.transcript };
  const j = await callLlm<JudgeOutput>('judge', slots);
  if (!j.ok) return { kind: 'retry', error: j.error };
  const a = await callLlm<AuditorOutput>('audit', { exercise_text: input.playbook, key_block: input.rubricText, student_answer: input.transcript, grader_json: JSON.stringify(j.data) });
  if (!a.ok) return { kind: 'retry', error: a.error };

  let decision = decide(input.itemClass, j.data, a.data);
  let second: JudgeOutput | null = null;
  if (decision.decision === 'RETRY') {
    const t = await callLlm<JudgeOutput>('judge', slots, { second: true });
    if (!t.ok) return { kind: 'retry', error: t.error };
    second = t.data;
    decision = tieBreak(j.data, a.data, t.data);
  }
  const written = decision.decision === 'FAIL' && second && second.verdict !== 'PASS' ? second.written : j.data.written;
  const { attemptId, row } = await record(
    {
      itemId: input.itemId,
      unitId: input.unitId,
      itemClass: input.itemClass,
      exerciseText: input.playbook,
      variantId: null,
      key: { required: input.rubric, accept: [], reject: [], version: 1 },
      answer: input.transcript,
      source: 'typed',
      context: { sessionId: input.sessionId },
    },
    decision,
    second ? { ...j.data, tiebreak: second } : j.data,
    a.data,
    j.data.confidence,
    written,
  );
  return { kind: 'decided', decision, judge: j.data, second, attemptId, row };
}
