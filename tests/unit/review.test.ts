import { describe, expect, it, vi } from 'vitest';

// no network in unit tests: every query resolves to no rows (no key amendments yet)
vi.mock('../../src/lib/supabase', () => {
  const empty = (): unknown => new Proxy(() => undefined, { get: (_, k) => (k === 'then' ? (resolve: (v: unknown) => void) => resolve({ data: [], error: null }) : () => empty()) });
  return { supabase: { from: () => empty() } };
});
import { keyForItem } from '../../src/engines/review/store';
import { buildPack, extractJson, hasAmendment, INSTRUCTIONS, PART_LIMIT, parseRulings, SECOND_REFEREE, type PackItem } from '../../src/engines/review/pack';
import { HAS_CONTENT } from '../content';

const item = (n: number, answer = 'An answer.'): PackItem => ({
  queue_id: `q${n}`,
  item_id: `logic-1:drill:L1-0${n % 10}`,
  item_class: 'recall',
  reason: '4: off-key content',
  exercise: 'Exercise.',
  key: { required: ['a'], accept: [], reject: [] },
  student_answer: answer,
  grader: { verdict: 'PASS' },
  auditor: null,
});

describe.skipIf(!HAS_CONTENT)('appeal pack (PHASE_15_PLUS 1.3)', () => {
  it('uses model-agnostic wording (PHASE_15_PLUS 1.3)', () => {
    expect(INSTRUCTIONS).not.toMatch(/Claude|weekly review/i);
    expect(INSTRUCTIONS).toContain('rule PASS or FAIL with one sentence of reason');
    expect(INSTRUCTIONS).toContain('{"rulings":[{"queue_id":"...","verdict":"PASS or FAIL"');
  });

  it('heads the pack with the date and the count, then the items as JSON', () => {
    const [pack] = buildPack([item(1), item(2)], '2026-10-19');
    expect(pack!.startsWith('wonderwander appeal pack, 2026-10-19, 2 items.\n\nInstructions: you are ruling on appealed')).toBe(true);
    const json = JSON.parse(pack!.slice(pack!.indexOf('Items:\n') + 7));
    expect(json.map((i: PackItem) => i.queue_id)).toEqual(['q1', 'q2']);
    expect(pack).not.toContain(SECOND_REFEREE);
  });

  it('asks for a second referee only when the final paper is in the pack', () => {
    const [pack] = buildPack([{ ...item(1), item_id: 'paper:final-paper', item_class: 'paper', draft: 'The paper.' }], '2026-10-19');
    expect(pack).toContain(SECOND_REFEREE);
  });

  it('splits into numbered parts under 60,000 characters, keeping every item once', () => {
    const big = Array.from({ length: 12 }, (_, i) => item(i, 'x'.repeat(9000)));
    const parts = buildPack(big, '2026-10-19');
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((p, i) => {
      expect(p.length).toBeLessThanOrEqual(PART_LIMIT);
      expect(p).toContain(`, 12 items, part ${i + 1} of ${parts.length}.`);
    });
    const ids = parts.flatMap((p) => JSON.parse(p.slice(p.indexOf('Items:\n') + 7)).map((x: PackItem) => x.queue_id));
    expect(ids).toEqual(big.map((b) => b.queue_id));
  });
});

describe('reading the rulings back (BUILD_PLAN 15.2)', () => {
  const block = '{"rulings":[{"queue_id":"q1","verdict":"PASS","reason":"Right in other words.","key_amendment":{"accept_add":["the same claim as a conditional"],"reject_add":[],"required_edit":null}},{"queue_id":"q2","verdict":"FAIL","reason":"Attacks the conclusion."}]}';

  it('takes the last fenced json block from a whole reply', () => {
    const reply = `Item q1. The key's intent is...\n\n\`\`\`json\n{"rulings":[]}\n\`\`\`\n\nCorrected:\n\n\`\`\`json\n${block}\n\`\`\`\nThanks.`;
    expect(extractJson(reply)).toBe(block);
    const r = parseRulings(reply);
    expect(r.ok && r.rulings.map((x) => x.verdict)).toEqual(['PASS', 'FAIL']);
  });

  it('accepts bare JSON and fills missing amendment fields', () => {
    const r = parseRulings(`Here you are: ${block}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(hasAmendment(r.rulings[0]!)).toBe(true);
    expect(hasAmendment(r.rulings[1]!)).toBe(false);
    const partial = parseRulings('{"rulings":[{"queue_id":"q1","verdict":"PASS","reason":"ok","key_amendment":{"accept_add":["x"]}}]}');
    expect(partial.ok && partial.rulings[0]!.key_amendment).toEqual({ accept_add: ['x'], reject_add: [], required_edit: null });
  });

  it('explains what is wrong instead of failing silently', () => {
    expect(parseRulings('no json here')).toMatchObject({ ok: false, error: expect.stringContaining('No JSON found') });
    expect(parseRulings('```json\n{"rulings": [oops]}\n```')).toMatchObject({ ok: false, error: expect.stringContaining('not valid JSON') });
    expect(parseRulings('{"rulings":[{"queue_id":"q1","verdict":"MAYBE","reason":"x"}]}')).toMatchObject({ ok: false, error: expect.stringContaining('rulings.0.verdict') });
  });
});

describe.skipIf(!HAS_CONTENT)('the key shown to the reviewer is the authored key for every kind of item', () => {
  it('finds drill, card, doing, boss and writing keys', async () => {
    expect((await keyForItem('logic-1:drill:L1-04')).required.length).toBeGreaterThan(0);
    expect((await keyForItem('logic-1:card:1')).required.length).toBeGreaterThan(0);
    expect((await keyForItem('logic-1:reconstruct')).required[0]).toMatch(/^1\. If God were able/);
    expect((await keyForItem('logic-1:object')).notes).toContain('ALREADY-ANSWERED');
    expect((await keyForItem('logic-1:boss')).required).toHaveLength(8);
    expect((await keyForItem('logic:ladder:abstract')).required).toHaveLength(5);
    expect((await keyForItem('paper:A:object')).required[0]).toMatch(/^Targets a named premise/);
    expect((await keyForItem('logic-1:comp:C1')).required.length).toBeGreaterThan(0);
  });
});
