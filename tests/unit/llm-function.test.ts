import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fill, missingSlots, noDashes, sanitiseDeep, SUFFIX } from '../../supabase/functions/llm/fill';
import { callModel, requestBody } from '../../supabase/functions/llm/gemini';
import { buildPrompt, chooseTier, MODE_CONFIG, MODES, TIER, tiersFrom, usedByTier } from '../../supabase/functions/llm/modes';
import { PROMPTS } from '../../supabase/functions/llm/prompts/index';
import { AuditorOut, BossTurnOut, GraderOut } from '../../supabase/functions/llm/schemas';
import { promptFile } from '../../scripts/sync-prompts';
import { HAS_CONTENT, readContent } from '../content';

const extracted = readContent<Record<string, string>>('content/json/prompts.json', {});

describe.skipIf(!HAS_CONTENT)('prompts are verbatim (BUILD_PLAN 8.2)', () => {
  it('every prompt file equals the text extracted from the Testing Architecture', () => {
    expect(Object.keys(PROMPTS).sort()).toEqual(Object.keys(extracted).sort());
    for (const [name, text] of Object.entries(extracted)) {
      expect(PROMPTS[name as keyof typeof PROMPTS], name).toBe(text);
      expect(readFileSync(`supabase/functions/llm/prompts/${name}.ts`, 'utf8'), name).toBe(promptFile(text));
    }
  });

  it('adds only the marked transport suffix, after the authored text', () => {
    for (const mode of MODES) {
      const p = buildPrompt(mode, {});
      const base = PROMPTS[MODE_CONFIG[mode].prompt];
      expect(p.startsWith(mode === 'variant_check' ? base : base.slice(0, 40)), mode).toBe(true);
      expect(p).toContain('TRANSPORT INSTRUCTIONS (format only):');
      expect(p.endsWith(SUFFIX[mode].join('\n'))).toBe(true);
    }
  });
});

describe('slot filling', () => {
  it('fills known slots and leaves the JSON example braces alone', () => {
    const p = buildPrompt('grade', { exercise_text: 'EX', key_block: 'KEY', student_answer: 'ANS' });
    expect(p).toContain('EXERCISE: EX');
    expect(p).toContain('ANSWER KEY: KEY');
    expect(p).toContain('STUDENT ANSWER: ANS');
    expect(p).toContain('{"steps": ["..."]');
    expect(missingSlots(p)).toEqual([]);
  });

  it('fills every slot of every mode when given', () => {
    const all = { exercise_text: 'x', key_block: 'x', student_answer: 'x', grader_json: 'x', author: 'x', n: '2', playbook: 'x', standard_form: 'x', objection: 'x', transcript: 'x', level: '1', rubric: 'x', draft: 'x', structure_note: 'x', variant: 'x' };
    for (const mode of MODES) expect(missingSlots(buildPrompt(mode, all)), mode).toEqual([]);
  });

  it('does not fill a value into an unknown placeholder', () => {
    expect(fill('{exercise_text} and {other}', { exercise_text: 'A' })).toBe('A and {other}');
  });

  it('puts the structure note into the variant prompt and labels the variant check inputs', () => {
    expect(buildPrompt('variant', { exercise_text: 'E', structure_note: 'preserve: MP' })).toContain('STRUCTURE NOTE: preserve: MP');
    const vc = buildPrompt('variant_check', { variant: 'V', structure_note: 'N' });
    expect(vc).toContain('VARIANT: V');
    expect(vc).toContain('STRUCTURE NOTE: N');
  });
});

describe('dash sanitiser (BUILD_PLAN 8.5)', () => {
  it('turns em dashes into commas and en dashes between numbers into "to"', () => {
    expect(noDashes('a \u2014 b')).toBe('a, b');
    expect(noDashes('pages 3\u20135')).toBe('pages 3 to 5');
    expect(noDashes('this\u2013that')).toBe('this, that');
    expect(noDashes('end \u2014.')).toBe('end.');
  });
  it('cleans every string in a nested result', () => {
    expect(sanitiseDeep({ a: ['x \u2014 y'], b: { c: 'p\u2013q' }, n: 3 })).toEqual({ a: ['x, y'], b: { c: 'p, q' }, n: 3 });
  });
});

describe('Gemini call (BUILD_PLAN 8.3)', () => {
  const ok = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }));

  it('sends JSON mode with a schema and the least restrictive safety settings', () => {
    const b = requestBody({ prompt: 'p', schema: { type: 'OBJECT' }, temperature: 0, maxTokens: 1024 }) as {
      generationConfig: Record<string, unknown>;
      safetySettings: { threshold: string }[];
    };
    expect(b.generationConfig.responseMimeType).toBe('application/json');
    expect(b.generationConfig.maxOutputTokens).toBe(1024);
    expect(b.safetySettings.every((s) => s.threshold === 'OFF')).toBe(true);
  });

  it('backs off on 429 then succeeds', async () => {
    const replies = [new Response('', { status: 429 }), ok('hello')];
    const r = await callModel({ prompt: 'p', temperature: 0, maxTokens: 10 }, { apiKey: 'k', model: 'm', backoff: [1, 1], fetchImpl: async () => replies.shift()! });
    expect(r).toEqual({ ok: true, text: 'hello' });
  });

  it('gives up as busy after the backoff', async () => {
    const r = await callModel({ prompt: 'p', temperature: 0, maxTokens: 10 }, { apiKey: 'k', model: 'm', backoff: [1, 1], fetchImpl: async () => new Response('', { status: 503 }) });
    expect(r).toMatchObject({ ok: false, error: 'busy' });
  });

  it('reports a safety block as blocked, never as a fail', async () => {
    const blocked = new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }));
    const r = await callModel({ prompt: 'p', temperature: 0, maxTokens: 10 }, { apiKey: 'k', model: 'm', fetchImpl: async () => blocked });
    expect(r).toMatchObject({ ok: false, error: 'blocked' });
  });

  it('reports a refused key or project as denied, never as a grading result', async () => {
    const denied = new Response(JSON.stringify({ error: { code: 403, message: 'Your project has been denied access. Please contact support.', status: 'PERMISSION_DENIED' } }), { status: 403 });
    const r = await callModel({ prompt: 'p', temperature: 0, maxTokens: 10 }, { apiKey: 'k', model: 'm', fetchImpl: async () => denied });
    expect(r).toMatchObject({ ok: false, error: 'denied' });
  });

  it('skips thought parts', async () => {
    const res = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"x":1}' }] }, finishReason: 'STOP' }] }));
    expect(await callModel({ prompt: 'p', temperature: 0, maxTokens: 10 }, { apiKey: 'k', model: 'm', fetchImpl: async () => res })).toEqual({ ok: true, text: '{"x":1}' });
  });
});

describe('model routing within the free tier', () => {
  const tiers = tiersFrom(() => undefined);

  it('defaults to Flash-Lite for checking and 3.8 Flash for the judgement calls, below the free limits', () => {
    expect(tiers).toEqual({ light: { model: 'gemini-3.5-flash-lite', cap: 450 }, heavy: { model: 'gemini-3.8-flash', cap: 18 } });
    expect(chooseTier('grade', { light: 0, heavy: 0 }, tiers)).toBe('light');
    expect(chooseTier('boss_turn', { light: 0, heavy: 0 }, tiers)).toBe('heavy');
  });

  it('falls back to light when the heavy allowance is spent, and stops when both are', () => {
    expect(chooseTier('judge', { light: 10, heavy: 18 }, tiers)).toBe('light');
    expect(chooseTier('judge', { light: 450, heavy: 18 }, tiers)).toBeNull();
    expect(chooseTier('grade', { light: 450, heavy: 0 }, tiers)).toBeNull(); // light never borrows the scarce heavy calls
  });

  it('sums usage per tier from "<mode>@<tier>" rows', () => {
    expect(usedByTier([{ mode: 'grade@light', calls: 4 }, { mode: 'audit@light', calls: 4 }, { mode: 'judge@heavy', calls: 2 }, { mode: 'grade', calls: 9 }])).toEqual({ light: 8, heavy: 2 });
  });

  it('every mode has a tier', () => {
    for (const m of MODES) expect(['light', 'heavy']).toContain(TIER[m]);
  });
});

describe('output schemas', () => {
  it('accepts well-formed grader, auditor and boss outputs and rejects bad ones', () => {
    expect(GraderOut.safeParse({ steps: ['1'], verdict: 'PASS', confidence: 'HIGH', missing_or_wrong: '', off_key: '', feedback: 'Good.' }).success).toBe(true);
    expect(GraderOut.safeParse({ verdict: 'MAYBE' }).success).toBe(false);
    expect(
      AuditorOut.safeParse({ my_verdict: 'PASS', agreement: 'AGREE', grader_error: 'none', error_checks: { a: false, b: false, c: false, d: false, e: false }, confidence: 'HIGH' }).success,
    ).toBe(true);
    expect(BossTurnOut.safeParse({ reply: 'No.', matched_objection: null, conceded: null }).success).toBe(true);
  });
});
