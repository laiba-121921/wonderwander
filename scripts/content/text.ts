import type { AnswerKey } from '../../src/content/types';
import type { Report } from './report';

const EM = '\u2014';
const EN = '\u2013';

// Replaces em and en dashes and logs each replacement. Returns text unchanged otherwise.
export function replaceDashes(text: string, where: string, report: Report): string {
  if (!text.includes(EM) && !text.includes(EN)) return text;
  return text.replace(/(\S?)\s*([\u2013\u2014\u2e3a\u2e3b])\s*(\S?)/g, (match, before: string, _dash: string, after: string) => {
    const between = /\d/.test(before) && /\d/.test(after);
    const replacement = `${before}${between ? ' to ' : ', '}${after}`;
    report.dash(where, match, replacement);
    return replacement;
  }).replace(EM, ', ').replace(EN, ', ');
}

// Removes the byline that Claude Docs exports under the title ("Oct 13, 2026 \u00b7 @Ali").
export function stripByline(text: string): string {
  return text.replace(/^[A-Z][a-z]{2} \d{1,2}, \d{4} \u00b7 @\S+\s*$/m, '').trim();
}

// Markdown escapes such as \_ are export artefacts; plain text fields drop the backslash.
export function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, '$1');
}

export function plain(text: string): string {
  return unescapeMarkdown(text.replace(/\s*\n\s*/g, ' ').trim());
}

// Splits on `sep` at the top level only, never inside parentheses, brackets or double quotes.
export function splitTopLevel(text: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let buf = '';
  for (const ch of text) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === '(' || ch === '[')) depth++;
    else if (!inQuote && (ch === ')' || ch === ']')) depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0 && !inQuote) {
      parts.push(buf);
      buf = '';
    } else buf += ch;
  }
  parts.push(buf);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const NUMBERED = /(^|\s)((?:\d{1,2})|C)\.\s+/g;

// Splits "1. a 2. b C. c" style text into its numbered elements when the numbering is a clean 1, 2, 3 run.
export function splitNumbered(text: string): string[] | null {
  const marks: { index: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  NUMBERED.lastIndex = 0;
  while ((m = NUMBERED.exec(text))) {
    const label = m[2]!;
    const expected = marks.length + 1;
    const lastIsC = marks.at(-1)?.label === 'C';
    if (lastIsC) break;
    if (label === String(expected) || (label === 'C' && marks.length > 0)) {
      marks.push({ index: m.index + m[1]!.length, label });
    }
  }
  if (marks.length < 2) return null;
  const head = text.slice(0, marks[0]!.index).trim();
  const parts = marks.map((mk, i) => text.slice(mk.index, marks[i + 1]?.index ?? text.length).trim());
  return head ? [head, ...parts] : parts;
}

// Splits on top-level semicolons only when every piece is a real clause (two words or more).
export function splitClauses(text: string): string[] {
  const pieces = splitTopLevel(text, ';');
  if (pieces.length < 2) return [text.trim()];
  if (pieces.some((p) => p.split(/\s+/).length < 2)) return [text.trim()];
  return pieces;
}

// Turns a single "Key:" text into REQUIRED elements, following BUILD_PLAN 5.3.
export function splitKey(text: string): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    const flat = plain(para);
    const numbered = splitNumbered(flat);
    if (numbered) {
      out.push(...numbered);
      continue;
    }
    const segments = flat.split(/\s(?=(?:Reply|Objection|Response):\s)/);
    for (const seg of segments) out.push(...splitClauses(seg));
  }
  return out.filter(Boolean);
}

export function listItems(text: string): string[] {
  return splitTopLevel(plain(text), ';').map((s) => s.replace(/\.$/, '').trim()).filter(Boolean);
}

export function emptyKey(): AnswerKey {
  return { required: [], accept: [], reject: [], version: 1 };
}
