import { countWords } from '../../ui/TextArea';

// Writing ladder and uploads (BUILD_PLAN 16). Pure, so the heuristics are unit tested.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type UploadKind = 'docx' | 'pdf';

export function uploadKind(name: string, type: string): UploadKind | null {
  if (/\.docx$/i.test(name) || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (/\.pdf$/i.test(name) || type === 'application/pdf') return 'pdf';
  return null;
}

// Under 50 words from a file over 50 KB means the pages are images (BUILD_PLAN 16.2).
export const looksScanned = (text: string, bytes: number) => countWords(text) < 50 && bytes > 50 * 1024;

export const SCANNED_MESSAGE = "This PDF looks like images, so I can't read the words. Export it as a text PDF or a Word file and upload again.";

// Paragraph breaks kept, runs of blank lines collapsed, spaces tidied.
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface PdfLine {
  text: string;
  y: number; // baseline, PDF units, larger is higher on the page
  height: number;
}

// The simple gap heuristic: a line starts a new paragraph when the gap above it is clearly larger than the usual line
// spacing on that page. A hyphen at a line end joins the word.
export function linesToParagraphs(lines: PdfLine[]): string {
  const real = lines.filter((l) => l.text.trim());
  if (!real.length) return '';
  const gaps = real.slice(1).map((l, i) => real[i]!.y - l.y).filter((g) => g > 0);
  const sorted = [...gaps].sort((a, b) => a - b);
  const usual = sorted[Math.floor(sorted.length / 2)] ?? real[0]!.height * 1.2;
  const paras: string[] = [];
  let cur = '';
  real.forEach((l, i) => {
    const gap = i === 0 ? 0 : real[i - 1]!.y - l.y;
    const t = l.text.trim();
    if (i > 0 && (gap > usual * 1.5 || gap < 0)) {
      paras.push(cur);
      cur = t;
    } else if (!cur) cur = t;
    else cur = /[a-z]-$/i.test(cur) ? cur.slice(0, -1) + t : `${cur} ${t}`;
  });
  paras.push(cur);
  return paras.join('\n\n');
}

export interface TextItem {
  str: string;
  y: number;
  height: number;
  eol: boolean;
}

// pdf.js gives text runs; runs on one baseline make a line.
export function itemsToLines(items: TextItem[]): PdfLine[] {
  const lines: PdfLine[] = [];
  let cur: PdfLine | null = null;
  for (const it of items) {
    if (cur && Math.abs(cur.y - it.y) <= Math.max(1, it.height * 0.3)) cur.text += it.str;
    else {
      if (cur) lines.push(cur);
      cur = { text: it.str, y: it.y, height: it.height };
    }
    if (it.eol && cur) {
      lines.push(cur);
      cur = null;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Steps 1 to 3 assembled into the referee draft, in order.
export const assembleDraft = (parts: (string | null | undefined)[]) =>
  parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n\n');

export interface RefereeItem {
  result: 'PASS' | 'FAIL';
  quote: string;
  reason: string;
}

export interface RefereeOutput {
  checklist: Record<string, RefereeItem>;
  report: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const REFEREE_KEYS = Array.from({ length: 10 }, (_, i) => `R${i + 1}`);

// A revision is compared against the previous report's failed items (BUILD_PLAN 16.3).
export function compareReports(previous: RefereeOutput, next: RefereeOutput): { fixed: string[]; stillFailing: string[]; newlyFailing: string[] } {
  const failed = (r: RefereeOutput, k: string) => r.checklist[k]?.result === 'FAIL';
  return {
    fixed: REFEREE_KEYS.filter((k) => failed(previous, k) && !failed(next, k)),
    stillFailing: REFEREE_KEYS.filter((k) => failed(previous, k) && failed(next, k)),
    newlyFailing: REFEREE_KEYS.filter((k) => !failed(previous, k) && failed(next, k)),
  };
}

export const passesAll = (r: RefereeOutput) => REFEREE_KEYS.every((k) => r.checklist[k]?.result === 'PASS');

// PHASE_15_PLUS 1.2: two independent referee runs; a checklist item passes only if both runs pass it.
export interface Reconciled extends RefereeOutput {
  runs: [RefereeOutput, RefereeOutput];
  passed: number;
}

export function reconcile(a: RefereeOutput, b: RefereeOutput): Reconciled {
  const checklist = Object.fromEntries(
    REFEREE_KEYS.map((k) => {
      const x = a.checklist[k];
      const y = b.checklist[k];
      const pass = x?.result === 'PASS' && y?.result === 'PASS';
      const why = pass ? x : x?.result === 'FAIL' ? x : y;
      return [k, { result: pass ? 'PASS' : 'FAIL', quote: why?.quote ?? '', reason: why?.reason ?? '' } as RefereeItem];
    }),
  );
  const passed = REFEREE_KEYS.filter((k) => checklist[k]!.result === 'PASS').length;
  const worse = (c: RefereeOutput['confidence']) => ({ HIGH: 2, MEDIUM: 1, LOW: 0 })[c];
  return { checklist, report: a.report, confidence: worse(a.confidence) <= worse(b.confidence) ? a.confidence : b.confidence, runs: [a, b], passed };
}

// A domain's referee round passes at 8 of 10 reconciled items; the final paper needs all 10.
export const REFEREE_PASS = { referee: 8, final_paper: 10 } as const;
