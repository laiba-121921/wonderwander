// Slot filling and transport suffixes (BUILD_PLAN 8.2). Pure, so the app's tests can import it too.

// Only these placeholders are replaced; the prompts also contain JSON examples with braces, which stay untouched.
export const SLOTS = [
  'exercise_text',
  'key_block',
  'student_answer',
  'grader_json',
  'author',
  'n',
  'playbook',
  'standard_form',
  'objection',
  'transcript',
  'level',
  'rubric',
  'draft',
  'authored note on what must be preserved',
] as const;

export type SlotValues = Partial<Record<(typeof SLOTS)[number], string>>;

export function fill(template: string, values: SlotValues): string {
  let out = template;
  for (const slot of SLOTS) {
    const v = values[slot];
    if (v !== undefined) out = out.split(`{${slot}}`).join(v);
  }
  return out;
}

export function missingSlots(text: string): string[] {
  return SLOTS.filter((s) => text.includes(`{${s}}`));
}

const HEAD = 'TRANSPORT INSTRUCTIONS (format only):';
const NO_DASHES = 'Never use em dashes or en dashes.';

// The only additions allowed to a prompt, each visibly separate from the authored text.
export const SUFFIX = {
  grade: [NO_DASHES],
  audit: [NO_DASHES],
  judge: [NO_DASHES],
  variant: ['Return only the text, with no preamble.', NO_DASHES],
  variant_check: ['Return only JSON: {"ok": boolean, "reason": string}. ok is true when the VARIANT preserves the STRUCTURE NOTE.', NO_DASHES],
  author_reply: ['Return only the text, with no preamble.', NO_DASHES],
  boss_turn: [
    'Return only JSON: {"reply": string under 80 words, "matched_objection": number or null, "conceded": string or null}. matched_objection is the 1-based index of the STANDARD OBJECTION the student\'s last message matched. conceded names the premise you conceded under the CONCESSION RULE, else null.',
    NO_DASHES,
  ],
  referee: [
    'Return only JSON: {"checklist": {"R1": {"result": "PASS" or "FAIL", "quote": string, "reason": string}, ... "R10": {...}}, "report": string, "confidence": "HIGH" or "MEDIUM" or "LOW"}.',
    NO_DASHES,
  ],
} as const;

export type Mode = keyof typeof SUFFIX;

export function withSuffix(prompt: string, mode: Mode): string {
  return `${prompt}\n\n${HEAD}\n${SUFFIX[mode].join('\n')}`;
}

// BUILD_PLAN 8.5: U+2014 becomes ", "; U+2013 becomes " to " between numbers, else ", ". Two-em and three-em dashes too.
export function noDashes(text: string): string {
  return text
    .replace(/(\d)\s*\u2013\s*(\d)/g, '$1 to $2')
    .replace(/\s*[\u2013\u2014\u2e3a\u2e3b]\s*/g, ', ')
    .replace(/,\s*([,.;:!?])/g, '$1');
}

export function sanitiseDeep<T>(value: T): T {
  if (typeof value === 'string') return noDashes(value) as T;
  if (Array.isArray(value)) return value.map(sanitiseDeep) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitiseDeep(v)])) as T;
  return value;
}
