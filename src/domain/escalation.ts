// PHASE_15_PLUS 1.1: the decision table that replaced the weekly queue (BUILD_PLAN 9.2 is superseded).
export type ItemClass =
  | 'tap'
  | 'recall'
  | 'card'
  | 'comprehension'
  | 'reconstruct'
  | 'object'
  | 'reply'
  | 'mini_boss'
  | 'final_boss'
  | 'ladder'
  | 'referee'
  | 'paper';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Verdict = 'PASS' | 'FAIL' | 'ABSTAIN';

export interface GraderView {
  verdict: Verdict;
  confidence: Confidence;
  off_key?: string;
}

export interface AuditorView {
  agreement: 'AGREE' | 'DISAGREE';
  confidence: Confidence;
  my_verdict?: Verdict;
  error_checks?: Record<'a' | 'b' | 'c' | 'd' | 'e', boolean>;
}

// PASS and FAIL are final; RETRY is the soft retry (not locked, answer again); a missing call leaves no verdict.
export type DecisionKind = 'PASS' | 'FAIL' | 'RETRY';

export interface Decision {
  decision: DecisionKind;
  reasons: string[];
  appealable: boolean;
}

// Arguing items and bosses can always be appealed; everything else only when a tie-break settled it.
const ALWAYS_APPEALABLE = new Set<ItemClass>(['object', 'reply', 'mini_boss', 'final_boss', 'referee', 'paper']);
export const alwaysAppealable = (c: ItemClass) => ALWAYS_APPEALABLE.has(c);

// The grader reports "" or "none" when there is no off-key content. Off-key content no longer escalates by itself.
export function hasOffKey(offKey: string | undefined): boolean {
  const t = (offKey ?? '').trim().replace(/[.\s]+$/, '').toLowerCase();
  return t !== '' && !['none', 'n/a', 'na', 'no', 'nothing', 'no off-key content', 'no off key content'].includes(t);
}

export function decide(itemClass: ItemClass, grader: GraderView, auditor: AuditorView): Decision {
  const appealable = alwaysAppealable(itemClass);
  if (grader.verdict === 'ABSTAIN') return { decision: 'RETRY', reasons: ['the grader abstained'], appealable };
  if (auditor.agreement === 'DISAGREE') return { decision: 'RETRY', reasons: ['the auditor disagreed'], appealable };
  if (grader.verdict === 'PASS') return { decision: 'PASS', reasons: [], appealable };
  if (grader.confidence === 'LOW' || auditor.confidence === 'LOW') return { decision: 'RETRY', reasons: ['low confidence on a fail'], appealable };
  return { decision: 'FAIL', reasons: [], appealable };
}

// After the soft retry, an unresolved result goes to a third grading at temperature 0.3; the majority of the grader,
// the auditor's own verdict and the tie-break decides, with ABSTAIN counted as FAIL. The result is final and appealable.
export function tieBreak(grader: GraderView, auditor: AuditorView, third: GraderView): Decision {
  const auditVerdict: Verdict = auditor.my_verdict ?? (auditor.agreement === 'AGREE' ? grader.verdict : grader.verdict === 'PASS' ? 'FAIL' : 'PASS');
  const passes = [grader.verdict, auditVerdict, third.verdict].filter((v) => v === 'PASS').length;
  return { decision: passes >= 2 ? 'PASS' : 'FAIL', reasons: [`tie-break: ${passes} of 3 passed`], appealable: true };
}

// The second run of a soft retry: a clear result stands; anything still unresolved needs the tie-break.
export const needsTieBreak = (d: Decision) => d.decision === 'RETRY';
