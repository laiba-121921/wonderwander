import type { AnswerKey, Unit } from '../../content/types';

// The doing drills (Testing Architecture section 4). Everything here is pure, so it is unit tested.

export interface Premise {
  text: string;
  hidden: boolean;
}

export interface Reconstruction {
  premises: Premise[];
  conclusion: string;
}

export const emptyReconstruction = (): Reconstruction => ({ premises: [{ text: '', hidden: false }, { text: '', hidden: false }], conclusion: '' });

// Standard form as the keys write it: "1. ...", "2. (hidden) ...", "C. ...". Blank premises are dropped and the rest renumbered.
export function serialise(r: Reconstruction): string {
  const lines = r.premises
    .map((p) => ({ ...p, text: p.text.trim() }))
    .filter((p) => p.text)
    .map((p, i) => `${i + 1}. ${p.hidden ? '(hidden) ' : ''}${p.text}`);
  if (r.conclusion.trim()) lines.push(`C. ${r.conclusion.trim()}`);
  return lines.join('\n');
}

export function parse(text: string): Reconstruction {
  const premises: Premise[] = [];
  let conclusion = '';
  for (const line of text.split('\n')) {
    const c = line.match(/^\s*C\.\s*(.*)$/);
    if (c) {
      conclusion = c[1]!.trim();
      continue;
    }
    const p = line.match(/^\s*\d+\.\s*(\(hidden\)\s*)?(.*)$/i);
    if (p) premises.push({ text: p[2]!.trim(), hidden: Boolean(p[1]) });
  }
  return { premises: premises.length ? premises : emptyReconstruction().premises, conclusion };
}

export const isComplete = (r: Reconstruction) => r.premises.some((p) => p.text.trim()) && r.conclusion.trim() !== '';

// The numbered premises of a standard form (the key's REQUIRED lines or a serialised reconstruction).
export function numberedPremises(lines: string[]): { n: string; text: string }[] {
  return lines.flatMap((l) => {
    const m = l.match(/^\s*(\d+)\.\s*(.*)$/);
    return m ? [{ n: m[1]!, text: m[2]!.trim() }] : [];
  });
}

export interface Target {
  n: string; // what fills {n} in the Object prompt
  text: string; // the premise as the key states it
}

// The premises the Object drill may target: the load-bearing ones the appendix names. Most name them by number;
// a few name them in words, and then each named clause is a target in its own right.
export function objectTargets(loadBearing: string, keyRequired: string[]): Target[] {
  const premises = numberedPremises(keyRequired);
  const byNumber = new Map(premises.map((p) => [p.n, p.text]));
  const seen = new Set<string>();
  const numbered: Target[] = [];
  for (const m of loadBearing.matchAll(/\b(\d+)\b/g)) {
    const n = m[1]!;
    if (byNumber.has(n) && !seen.has(n)) {
      seen.add(n);
      numbered.push({ n, text: byNumber.get(n)! });
    }
  }
  if (numbered.length) return numbered;
  return loadBearing
    .replace(/\.\s*$/, '')
    .split(/,?\s+and\s+(?=the |that )/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ n: `"${s}"`, text: s }));
}

// Authored slots in the student prompts ({author}, {n}, {author_reply}); nothing else is touched.
export const fillSlot = (template: string, slot: string, value: string) => template.split(`{${slot}}`).join(value);

export interface DoingText {
  reconstructPrompt: string;
  objectPrompt: string;
  objectRubric: string[];
  objectReject: string[];
  replyPrompt: string;
  replyRubric: string[];
  replyReject: string[];
}

export function reconstructExercise(unit: Unit, t: DoingText, excerpt: string | null): string {
  const lines = [fillSlot(t.reconstructPrompt, 'author', unit.doing.authorPlaybook.author), '', `PASSAGE: ${unit.doing.reconstruct.passage}`];
  if (excerpt) lines.push('', `PASSAGE TEXT: ${excerpt}`);
  return lines.join('\n');
}

export function objectExercise(t: DoingText, argument: string, target: Target): string {
  return [fillSlot(t.objectPrompt, 'n', target.n), '', 'ARGUMENT:', argument, '', `PREMISE ${target.n}: ${target.text}`].join('\n');
}

// The Object rubric is generic; the unit supplies the load-bearing premises and the ALREADY-ANSWERED list as notes.
export function objectKey(unit: Unit, t: DoingText): AnswerKey {
  const o = unit.doing.object;
  const notes = [`LOAD-BEARING PREMISES: ${o.loadBearing}`, `ALREADY-ANSWERED: ${o.alreadyAnswered}`];
  if (o.onTrackExamples) notes.push(`ON-TRACK EXAMPLES: ${o.onTrackExamples}`);
  return { required: t.objectRubric, accept: [], reject: t.objectReject, notes: notes.join('\n'), version: 1 };
}

// The prompt puts its own full stop after the slot, so the reply's final one is dropped.
export const replyPromptText = (t: DoingText, authorReply: string) => fillSlot(t.replyPrompt, 'author_reply', authorReply.trim().replace(/\.+$/, ''));

export function replyExercise(t: DoingText, objection: string, authorReply: string): string {
  return [replyPromptText(t, authorReply), '', `YOUR OBJECTION: ${objection}`].join('\n');
}

export const replyKey = (t: DoingText): AnswerKey => ({ required: t.replyRubric, accept: [], reject: t.replyReject, version: 1 });

// The AUTHOR PLAYBOOK slot of the author-reply prompt, in the appendix's own labels.
export function playbookBlock(unit: Unit): string {
  const p = unit.doing.authorPlaybook;
  return [`AUTHOR: ${p.author}`, `POSITION: ${p.position}`, `REPLIES: ${p.replies}`, `FORBIDDEN: ${p.forbidden}`].join('\n');
}

// Object is soft limited to about two to four sentences.
export function sentenceCount(text: string): number {
  return (text.trim().match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).filter((s) => /\w/.test(s)).length;
}

// The paragraph of a bundled text that holds the identifying phrase, matched on its first six words.
export function excerptAround(markdown: string, phrase: string): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const words = norm(phrase).split(' ').slice(0, 6).join(' ');
  if (!words) return null;
  return markdown.split(/\n\s*\n/).find((para) => norm(para).includes(words))?.trim() ?? null;
}
