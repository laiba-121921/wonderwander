import { z } from 'zod';

// Appeals (PHASE_15_PLUS 1.3, formerly the weekly review of BUILD_PLAN 15). Pure: building the pack and reading the rulings back.

export interface PackItem {
  queue_id: string;
  item_id: string;
  item_class: string;
  reason: string;
  exercise: string;
  key: { required: string[]; accept: string[]; reject: string[] };
  student_answer: string;
  grader: unknown;
  auditor: unknown;
  transcript?: string[];
  draft?: string;
}

// The appeal pack (PHASE_15_PLUS 1.3): the Phase 11 format with model-agnostic wording.
export const INSTRUCTIONS =
  "Instructions: you are ruling on appealed grading decisions from wonderwander, a philosophy training app. Each item shows the exercise, the answer key, the student answer and the automatic grader and auditor output. For each item, state the key's intent, judge the student answer on its merits, say whether the grader or auditor erred and how, and rule PASS or FAIL with one sentence of reason. Where an answer was right but off-key, propose additions to ACCEPT; where the key was ambiguous, propose a tightened REQUIRED or new REJECT entries. Do not use em dashes or en dashes. After your discussion, output one fenced json block exactly in this shape:\n" +
  '{"rulings":[{"queue_id":"...","verdict":"PASS or FAIL","reason":"...","key_amendment":{"accept_add":[],"reject_add":[],"required_edit":null}}]}';

// BUILD_PLAN 15.3: the final paper also gets a second, independent referee report.
export const SECOND_REFEREE =
  'For any item whose item_class is "paper" and whose item_id is "paper:final-paper", also act as a second referee: report each of the ten checklist items (R1 to R10) as PASS or FAIL with a quotation, independently of the first report in "grader", then reconcile the two reports in your ruling.';

export const PART_LIMIT = 60000;

// One block of text, or numbered parts when it would pass 60,000 characters.
export function buildPack(items: PackItem[], date: string): string[] {
  const head = (n: number, part?: [number, number]) =>
    `wonderwander appeal pack, ${date}, ${n} items${part ? `, part ${part[0]} of ${part[1]}` : ''}.\n\n${INSTRUCTIONS}${items.some((i) => i.item_id === 'paper:final-paper') ? `\n\n${SECOND_REFEREE}` : ''}\n\nItems:\n`;
  const whole = head(items.length) + JSON.stringify(items, null, 1);
  if (whole.length <= PART_LIMIT) return [whole];

  const groups: PackItem[][] = [];
  let cur: PackItem[] = [];
  let size = 0;
  const budget = PART_LIMIT - head(items.length, [99, 99]).length - 10;
  for (const it of items) {
    const len = JSON.stringify(it, null, 1).length + 2;
    if (cur.length && size + len > budget) {
      groups.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(it);
    size += len;
  }
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => head(items.length, [i + 1, groups.length]) + JSON.stringify(g, null, 1));
}

const Amendment = z.object({
  accept_add: z.array(z.string()).default([]),
  reject_add: z.array(z.string()).default([]),
  required_edit: z.array(z.string()).nullable().default(null),
});

export const Ruling = z.object({
  queue_id: z.string().min(1),
  verdict: z.enum(['PASS', 'FAIL']),
  reason: z.string(),
  key_amendment: Amendment.nullable().optional(),
});
export type Ruling = z.infer<typeof Ruling>;

const Rulings = z.object({ rulings: z.array(Ruling) });

export type ParseResult = { ok: true; rulings: Ruling[] } | { ok: false; error: string };

// The last fenced json block, or else the last bare JSON object in the text (BUILD_PLAN 15.2).
export function extractJson(text: string): string | null {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)];
  if (fences.length) return fences.at(-1)![1]!.trim();
  const start = text.lastIndexOf('{"rulings"');
  const from = start >= 0 ? start : text.indexOf('{');
  if (from < 0) return null;
  const end = text.lastIndexOf('}');
  return end > from ? text.slice(from, end + 1) : null;
}

export function parseRulings(text: string): ParseResult {
  const raw = extractJson(text);
  if (!raw) return { ok: false, error: 'No JSON found. Paste the whole reply, including the fenced json block at the end.' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'The JSON block is not valid JSON. Ask for the block again.' };
  }
  const parsed = Rulings.safeParse(data);
  if (!parsed.success) return { ok: false, error: `The JSON does not have the expected shape: ${parsed.error.issues[0]?.path.join('.') || 'rulings'} is wrong.` };
  return { ok: true, rulings: parsed.data.rulings };
}

export const hasAmendment = (r: Ruling) => Boolean(r.key_amendment && (r.key_amendment.accept_add.length || r.key_amendment.reject_add.length || r.key_amendment.required_edit));
