import type { AnswerKey, Card, Drill } from '../../src/content/types';
import { tableRows } from './markdown';
import type { Report } from './report';
import { emptyKey, listItems, plain, splitKey } from './text';

export interface RawDrill {
  sourceId: string;
  tags: string[]; // e.g. ['TAP'] or ['LLM', 'review-queue']
  prompt: string;
  keyRegion: string; // everything from **Key:** onwards
}

const BOLD_MARKER = /^\*\*([A-Z]{1,3}\d*-?\d+)(?: \(([^)]*)\))?\.\*\*\s*/;

// Bold style: "**R7-01.** prompt **Key:** answer" or "**C1 (TAP).** ...", one paragraph group per drill.
export function boldDrills(region: string): RawDrill[] {
  const lines = region.split('\n');
  const blocks: string[][] = [];
  for (const line of lines) {
    if (BOLD_MARKER.test(line)) blocks.push([line]);
    else if (blocks.length) blocks[blocks.length - 1]!.push(line);
  }
  return blocks.map((b) => {
    const text = b.join('\n').trim();
    const m = text.match(BOLD_MARKER)!;
    return splitPromptKey(m[1]!, m[2], text.slice(m[0].length));
  });
}

// Heading style (Logic 1 to 3): "### Drill L1-01 (TAP): question" then the body.
export function headingDrills(sections: { heading: string; body: string }[]): RawDrill[] {
  const out: RawDrill[] = [];
  for (const s of sections) {
    const m = s.heading.match(/^Drill ([A-Z]+\d+-\d+)(?: \(([^)]*)\))?:?\s*(.*)$/);
    if (!m) continue;
    const question = m[3]!.trim();
    out.push(splitPromptKey(m[1]!, m[2], question ? `${question}\n\n${s.body}` : s.body));
  }
  return out;
}

function splitPromptKey(sourceId: string, tagText: string | undefined, text: string): RawDrill {
  const idx = text.search(/\*\*Key[:.]\*\*/);
  const tags = (tagText ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  return {
    sourceId,
    tags,
    prompt: (idx >= 0 ? text.slice(0, idx) : text).trim(),
    keyRegion: idx >= 0 ? text.slice(idx).trim() : '',
  };
}

const LABEL = /\*\*([A-Z][A-Za-z ,()'-]{0,70}?)[:.]\*\*/g;

// Splits a key region into the Key text and any labelled extras (Accept, Reject, Tests, ...).
export function keyParts(keyRegion: string): { key: string; labels: { label: string; text: string }[] } {
  const marks: { label: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  LABEL.lastIndex = 0;
  while ((m = LABEL.exec(keyRegion))) marks.push({ label: m[1]!, start: m.index, end: m.index + m[0].length });
  const parts = marks.map((mk, i) => ({ label: mk.label, text: keyRegion.slice(mk.end, marks[i + 1]?.start ?? keyRegion.length).trim() }));
  const keyPart = parts.find((p) => p.label === 'Key');
  return { key: keyPart?.text ?? '', labels: parts.filter((p) => p !== keyPart) };
}

export function answerKeyFromRegion(keyRegion: string, where: string, report: Report): AnswerKey {
  const { key, labels } = keyParts(keyRegion);
  const answer = emptyKey();
  answer.required = splitKey(key);
  const notes: string[] = [];
  for (const { label, text } of labels) {
    if (/^Accept$/i.test(label)) answer.accept.push(...listItems(text));
    else if (/^Reject$/i.test(label)) answer.reject.push(...listItems(text));
    else notes.push(`${label}: ${plain(text)}`);
  }
  if (notes.length) answer.notes = notes.join('\n');
  if (answer.required.length === 0) report.error(where, 'key has no REQUIRED element');
  return answer;
}

const OPTION = /\(([a-h])\)\s*/g;

// Finds an "(a) ... (b) ..." run in the prompt. Returns null unless the letters run a, b, c in order.
export function tapOptions(prompt: string): { stem: string; options: { id: string; text: string }[] } | null {
  const marks: { id: string; index: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  OPTION.lastIndex = 0;
  while ((m = OPTION.exec(prompt))) {
    const expected = String.fromCharCode(97 + marks.length);
    if (m[1] === expected) marks.push({ id: m[1]!, index: m.index, end: m.index + m[0].length });
  }
  if (marks.length < 2) return null;
  const options = marks.map((mk, i) => ({
    id: mk.id,
    text: plain(prompt.slice(mk.end, marks[i + 1]?.index ?? prompt.length)),
  }));
  const stem = prompt.slice(0, marks[0]!.index).replace(/Options:\s*$/i, '').trim();
  return { stem, options };
}

export function tapKey(keyRegion: string): { correct: string[]; note?: string } | null {
  const { key, labels } = keyParts(keyRegion);
  const m = key.match(/^((?:\([a-h]\)(?:\s*(?:,|and|&)\s*)?)+)\.?\s*([\s\S]*)$/);
  if (!m) return null;
  const correct = [...m[1]!.matchAll(/\(([a-h])\)/g)].map((x) => x[1]!);
  const rest = [m[2]!.trim(), ...labels.map((l) => `${l.label}: ${l.text}`)].filter(Boolean).map(plain);
  return { correct, note: rest.length ? rest.join('\n') : undefined };
}

export function buildDrill(raw: RawDrill, itemId: string, report: Report): Drill {
  const isTap = raw.tags.some((t) => t.toUpperCase() === 'TAP');
  const alwaysQueue = raw.tags.some((t) => /review/i.test(t));
  if (isTap) {
    const opts = tapOptions(raw.prompt);
    const key = tapKey(raw.keyRegion);
    if (opts && key) {
      const ids = new Set(opts.options.map((o) => o.id));
      if (key.correct.some((c) => !ids.has(c))) report.error(itemId, `TAP key ${key.correct.join(',')} names an option that does not exist`);
      return {
        id: itemId,
        sourceId: raw.sourceId,
        kind: 'tap',
        prompt: opts.stem,
        options: opts.options,
        correct: key.correct,
        keyNote: key.note,
        revisionSectionIds: [],
      };
    }
    if (opts && !key) report.warn(itemId, 'TAP drill has options but its key is not an option letter; graded as keyed');
    report.tapWithoutOptions.push(itemId);
  }
  if (!raw.keyRegion) report.error(itemId, 'drill has no **Key:**');
  return {
    id: itemId,
    sourceId: raw.sourceId,
    kind: 'keyed',
    prompt: raw.prompt,
    key: answerKeyFromRegion(raw.keyRegion, itemId, report),
    ...(isTap ? { tapTagged: true } : {}),
    ...(alwaysQueue ? { alwaysQueue: true } : {}),
    revisionSectionIds: [],
  };
}

export function parseCards(region: string, unitId: string, report: Report): Card[] {
  const cards: Card[] = [];
  for (const { cells } of tableRows(region)) {
    if (cells.length < 3 || !/^\d+$/.test(cells[0]!)) continue;
    const number = Number(cells[0]);
    const front = plain(cells[1]!);
    const back = plain(cells[2]!);
    const key = emptyKey();
    key.required = splitKey(back);
    cards.push({ id: `${unitId}:card:${number}`, number, front, back, key });
  }
  const numbers = cards.map((c) => c.number);
  if (new Set(numbers).size !== numbers.length) report.error(unitId, `duplicate card numbers: ${numbers.join(',')}`);
  return cards;
}
