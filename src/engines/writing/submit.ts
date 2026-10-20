import type { WritingItem } from '../../content/writing';
import type { Unit } from '../../content/types';
import { fillSlot, playbookBlock, type Target } from '../doing/standardForm';
import { effectiveKey, keyBlock, type KeyOverride } from '../grading/keys';
import { callLlm, type LlmError } from '../grading/llm';
import { gradeAnswer, record, type GradeInput, type GradeOutcome, type GraderOutput } from '../grading/pipeline';
import { supabase } from '../../lib/supabase';
import type { ItemRow } from '../../domain/lifecycle';
import { reconcile, REFEREE_PASS, type Reconciled, type RefereeOutput } from './text';
import { countWords } from '../../ui/TextArea';

// The unit a reconstruction or objection section is about (ladder steps 2 and 3 fill {argument} and {n} from it).
export interface Focus {
  unit: Unit;
  domainTitle: string;
  target: Target | null;
}

export const argumentName = (f: Focus) => `${f.unit.doing.authorPlaybook.author}'s argument from ${f.domainTitle} Unit ${f.unit.number}, ${f.unit.title}`;

export function writingPrompt(w: WritingItem, focus: Focus | null): string {
  let p = w.prompt;
  if (focus) p = fillSlot(p, 'argument', argumentName(focus));
  if (focus?.target) p = fillSlot(p, 'n', focus.target.n);
  return p;
}

// Steps 1 to 3 are graded on their REQUIRED and REJECT items (BUILD_PLAN 16.3); the unit's key and playbook are notes.
export function ladderKey(w: WritingItem, focus: Focus | null) {
  const notes: string[] = [];
  if (focus && w.ladderStep === 'reconstruction') notes.push(`THE UNIT'S KEY:\n${keyBlock(focus.unit.doing.reconstruct.key)}`);
  if (focus && w.ladderStep === 'objection_reply') {
    if (focus.target) notes.push(`PREMISE ${focus.target.n}: ${focus.target.text}`);
    notes.push(`AUTHOR PLAYBOOK:\n${playbookBlock(focus.unit)}`);
  }
  return { required: w.rubric, accept: [], reject: w.reject, ...(notes.length ? { notes: notes.join('\n') } : {}), version: 1 };
}

export interface Upload {
  file: File;
  kind: 'docx' | 'pdf';
}

const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' } as const;

// The original file goes to the private drafts bucket at <user_id>/<submission_id>.<ext>; the extracted text is graded.
async function storeFile(submissionId: string, up: Upload): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return null;
  const path = `${uid}/${submissionId}.${up.kind}`;
  const { error } = await supabase.storage.from('drafts').upload(path, up.file, { contentType: MIME[up.kind], upsert: true });
  return error ? null : path;
}

export async function latestVersion(w: WritingItem): Promise<number> {
  const q = supabase.from('writing_submission').select('version,attempt_id,step').eq('step', w.step);
  const { data } = w.domainId ? await q.eq('domain_id', w.domainId) : await q.is('domain_id', null);
  return Math.max(0, ...((data as { version: number; attempt_id: string | null }[] | null) ?? []).filter((r) => r.attempt_id).map((r) => r.version));
}

async function saveSubmission(w: WritingItem, text: string, up: Upload | null, attemptId: string, version: number, step = w.step) {
  const id = crypto.randomUUID();
  const file_path = up ? await storeFile(id, up) : null;
  await supabase.from('writing_submission').insert({
    id,
    domain_id: w.domainId,
    step,
    title: w.title,
    text,
    word_count: countWords(text),
    source: up ? 'upload' : 'typed',
    file_path,
    attempt_id: attemptId,
    version,
  });
}

export type WritingOutcome =
  | { kind: 'graded'; outcome: Extract<GradeOutcome, { kind: 'decided' }> }
  | { kind: 'soft'; grader: GraderOutput }
  | { kind: 'refereed'; report: Reconciled; attemptId: string; row: ItemRow; version: number; pass: boolean }
  | { kind: 'retry'; error: LlmError };

export async function submitWriting(w: WritingItem, text: string, up: Upload | null, focus: Focus | null): Promise<WritingOutcome> {
  const base: Omit<GradeInput, 'itemClass' | 'key'> = {
    itemId: w.id,
    unitId: w.unitId,
    exerciseText: writingPrompt(w, focus),
    variantId: null,
    answer: text,
    source: up ? 'upload' : 'typed',
    ...(focus ? { context: { unitId: focus.unit.id, n: focus.target?.n ?? '' } } : {}),
  };
  const version = (await latestVersion(w)) + 1;

  if (w.kind === 'ladder') {
    const { data: overrides } = await supabase.from('key_override').select('item_id,version,accept_add,reject_add,required_edit').eq('item_id', w.id);
    const outcome = await gradeAnswer({ ...base, itemClass: 'ladder', key: effectiveKey(ladderKey(w, focus), (overrides as KeyOverride[]) ?? []) });
    if (outcome.kind === 'retry') return outcome;
    if (outcome.kind === 'soft') return { kind: 'soft', grader: outcome.grader };
    await saveSubmission(w, text, up, outcome.attemptId, version);
    return { kind: 'graded', outcome };
  }

  const key = { required: w.rubric, accept: [], reject: [], version: 1 };
  if (w.kind === 'synthesis') {
    // graded on the three elements the synthesis question names (owner decision 2026-10-19), always appealable
    const outcome = await gradeAnswer({ ...base, itemClass: 'paper', key });
    if (outcome.kind === 'retry') return outcome;
    if (outcome.kind === 'soft') return { kind: 'soft', grader: outcome.grader };
    await saveSubmission(w, text, up, outcome.attemptId, version);
    return { kind: 'graded', outcome };
  }

  // referee round and final paper: two independent referee runs, reconciled item by item (PHASE_15_PLUS 1.2)
  const [r1, r2] = await Promise.all([callLlm<RefereeOutput>('referee', { draft: text }), callLlm<RefereeOutput>('referee', { draft: text }, { second: true })]);
  if (!r1.ok) return { kind: 'retry', error: r1.error };
  if (!r2.ok) return { kind: 'retry', error: r2.error };
  const report = reconcile(r1.data, r2.data);
  const pass = report.passed >= REFEREE_PASS[w.kind === 'final_paper' ? 'final_paper' : 'referee'];
  const { attemptId, row } = await record(
    { ...base, itemClass: w.kind === 'final_paper' ? 'paper' : 'referee', key },
    { decision: pass ? 'PASS' : 'FAIL', reasons: [`${report.passed} of 10 items passed both referees`], appealable: true },
    report,
    null,
    report.confidence,
    pass ? null : r1.data.report,
  );
  await saveSubmission(w, text, up, attemptId, version, version > 1 && w.kind === 'referee' ? 'revision' : w.step);
  return { kind: 'refereed', report, attemptId, row, version, pass };
}

// The previous referee report, for the revision comparison.
export async function previousReport(w: WritingItem): Promise<{ report: RefereeOutput; version: number } | null> {
  const steps = w.kind === 'referee' ? ['draft', 'revision'] : [w.step];
  const q = supabase.from('writing_submission').select('version,attempt_id,step').in('step', steps);
  const { data } = w.domainId ? await q.eq('domain_id', w.domainId) : await q.is('domain_id', null);
  const rows = ((data as { version: number; attempt_id: string | null }[] | null) ?? []).filter((r) => r.attempt_id).sort((a, b) => b.version - a.version);
  const last = rows[0];
  if (!last) return null;
  const { data: att } = await supabase.from('attempt').select('grader').eq('id', last.attempt_id!).maybeSingle();
  const report = att?.grader as unknown as RefereeOutput | null;
  return report?.checklist ? { report, version: last.version } : null;
}

// The latest submitted text of each earlier ladder step, assembled for the referee round.
export async function earlierTexts(domainId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('writing_submission').select('step,text,version,attempt_id').eq('domain_id', domainId);
  const out: Record<string, { text: string; version: number }> = {};
  for (const r of (data as { step: string; text: string; version: number; attempt_id: string | null }[] | null) ?? []) {
    if (!r.attempt_id) continue;
    if (!out[r.step] || out[r.step]!.version < r.version) out[r.step] = { text: r.text, version: r.version };
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.text]));
}
