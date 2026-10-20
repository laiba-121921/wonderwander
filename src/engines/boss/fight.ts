import type { BossPlaybook } from '../../content/types';
import type { Expression } from '../../art/StickFigure';

// Boss fights (BUILD_PLAN 10.1, Testing Architecture section 5). Pure, so the level policy and exit rules are unit tested.

export interface Turn {
  role: 'boss' | 'student';
  text: string;
  level?: number;
  matched?: number | null;
  conceded?: string | null;
  phase?: Phase;
  at: string;
}

export type Phase = 'normal' | 'reversal';

export const studentTurns = (t: Turn[]) => t.filter((x) => x.role === 'student').length;

// Deterministic, on the device: level 1 for the first two student turns, level 2 for the next two, level 3 after.
export function levelFor(studentTurn: number): 1 | 2 | 3 {
  return studentTurn <= 2 ? 1 : studentTurn <= 4 ? 2 : 3;
}

// A role reversal boss's exit gives the total turns with the normal and reversed phases in brackets; the first of
// the bracketed numbers is the normal phase.
export function normalTurns(boss: BossPlaybook): number {
  if (!boss.roleReversal) return boss.exitTurns;
  const m = boss.exit.match(/\((\d+)\s+plus\s+(\d+)\s+reversed\)/);
  return m ? Number(m[1]) : boss.exitTurns;
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

// A concession ends the fight early only when the playbook's EXIT says so (the Logic final boss: "six errors are conceded").
export function earlyExitConcessions(exit: string): number | null {
  const m = exit.match(/earlier if (\w+) errors? (?:is|are) conceded/i);
  if (!m) return null;
  const w = m[1]!.toLowerCase();
  return WORDS[w] ?? (Number(w) || null);
}

export function concessions(t: Turn[]): string[] {
  return [...new Set(t.filter((x) => x.role === 'boss' && x.conceded).map((x) => x.conceded!.trim().toLowerCase()))];
}

export function fightOver(boss: BossPlaybook, t: Turn[]): boolean {
  if (studentTurns(t) >= boss.exitTurns) return true;
  const early = earlyExitConcessions(boss.exit);
  return early !== null && concessions(t).length >= early;
}

// The switch to the reversed side comes once the normal turns are done (BUILD_PLAN 10.1).
export const reversalDue = (boss: BossPlaybook, t: Turn[], phase: Phase) => Boolean(boss.roleReversal) && phase === 'normal' && studentTurns(t) >= normalTurns(boss) && !fightOver(boss, t);

// The playbook in the template's own labels. A playbook with no FORBIDDEN MOVES of its own uses the template's standard line.
export function playbookText(boss: BossPlaybook, template: string, phase: Phase = 'normal'): string {
  const standardForbidden = template.match(/^FORBIDDEN MOVES: (.*)$/m)?.[1] ?? '';
  const lines = [
    `BOSS: ${boss.name}, ${boss.persona}`,
    `POSITION: ${boss.position}`,
    `OPENING MOVE: ${boss.openingMove}`,
    `STANDARD OBJECTIONS TO EXPECT: ${boss.standardObjections}`,
    `ESCALATION LADDER: ${boss.escalation}`,
    `CONCESSION RULE: ${boss.concessionRule}`,
    `FORBIDDEN MOVES: ${boss.forbidden ?? standardForbidden}`,
    `EXIT: ${boss.exit}`,
  ];
  if (boss.roleReversal) lines.push(`ROLE REVERSAL: ${boss.roleReversal}`);
  if (phase === 'reversal') lines.push('ROLE REVERSAL IS NOW IN FORCE.');
  return lines.join('\n');
}

export function transcriptText(t: Turn[]): string {
  return t.map((x) => `${x.role === 'boss' ? 'BOSS' : 'STUDENT'}${x.phase === 'reversal' ? ' (reversed)' : ''}: ${x.text}`).join('\n');
}

// The standard boss rubric with the boss's own items added (Testing Architecture section 5).
export function rubricItems(boss: BossPlaybook, base: string[]): string[] {
  return [...base, ...boss.rubricExtra];
}

export const rubricText = (items: string[]) => items.map((r, i) => `${i + 1}. ${r}`).join('\n');

// The boss figure's face follows the turn meta: a matched objection makes it think, a rising level makes it stern,
// a concession makes it concede.
export function expressionFor(last: Turn | undefined, previousLevel: number | undefined): Expression | undefined {
  if (!last || last.role !== 'boss') return undefined;
  if (last.conceded) return 'conceding';
  if (last.level && previousLevel && last.level > previousLevel) return 'stern';
  if (last.matched) return 'curious';
  return undefined;
}

export const opening = (boss: BossPlaybook, at: Date): Turn => ({ role: 'boss', text: boss.openingMove.replace(/^"(.*)"$/s, '$1'), level: 1, at: at.toISOString() });
