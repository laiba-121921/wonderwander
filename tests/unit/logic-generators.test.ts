import { describe, expect, it } from 'vitest';
import { buildPulse, GENERATORS, PULSE_SIZE } from '../../src/engines/logic';

// Generators whose content has loaded (the fallacy finder needs Logic 7 from the content pack), asked when a test
// runs: the content loads before the tests, after this file is imported.
const ready = () => GENERATORS.filter((g) => g.available?.() ?? true);
import { counterexamples, equivalent, parse } from '../../src/engines/logic/formula';
import { checkStep, type Rule } from '../../src/engines/logic/proof';
import type { ChoiceItem, LogicItem } from '../../src/engines/logic/types';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);
const DASH = /[\u2013\u2014\u2e3a\u2e3b]/;

function texts(item: LogicItem): string[] {
  const t = [item.prompt, item.explanation];
  if (item.type === 'choice') t.push(item.stimulus ?? '', ...(item.keyLines ?? []), ...item.options.map((o) => o.text), ...(item.proof ?? []).map((l) => `${l.formula} ${l.justification ?? ''}`));
  if (item.type === 'connective') t.push(...item.tokens.map((x) => x.text));
  if (item.type === 'table') t.push(item.formula);
  return t;
}

describe('every generator', () => {
  for (const g of GENERATORS) {
    it(`${g.id}: valid, reproducible, dash free, over 300 seeds`, () => {
      if (!ready().includes(g)) return; // its content is not here
      for (const seed of SEEDS) {
        const item = g.make(seed);
        expect(item.generator).toBe(g.id);
        expect(JSON.stringify(g.make(seed))).toBe(JSON.stringify(item)); // same seed, same item
        for (const t of texts(item)) expect(t, `${g.id} ${seed}`).not.toMatch(DASH);
        if (item.type === 'choice') {
          expect(item.options.length).toBeGreaterThanOrEqual(2);
          expect(new Set(item.options.map((o) => o.text)).size, `${g.id} ${seed} duplicate options`).toBe(item.options.length);
          expect(item.correct.length).toBeGreaterThanOrEqual(1);
          for (const c of item.correct) expect(item.options.some((o) => o.id === c)).toBe(true);
          if (g.id !== 'validity-table') expect(item.correct).toHaveLength(1);
        }
        if (item.type === 'table') expect(item.answer).toHaveLength(item.rows.length);
        if (item.type === 'connective') expect(item.tokens[item.correct]!.connective).toBe(true);
      }
    });
  }
});

const choice = (id: string, seed: number) => GENERATORS.find((g) => g.id === id)!.make(seed) as ChoiceItem;
const textOf = (item: ChoiceItem, id: string) => item.options.find((o) => o.id === id)!.text;

describe('exactly one right answer', () => {
  it('translator: only the right option is equivalent to the answer', () => {
    for (const seed of SEEDS) {
      const item = choice('translator', seed);
      const right = parse(textOf(item, item.correct[0]!));
      const others = item.options.filter((o) => o.id !== item.correct[0]).map((o) => parse(o.text));
      for (const o of others) expect(equivalent(o, right)).toBe(false);
    }
  });

  it('validity by table: the right options are exactly the counterexample rows', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const item = choice('validity-table', seed);
      const [prem, concl] = item.stimulus!.split('  \u2234  ');
      const bad = counterexamples(prem!.split(';  ').map(parse), parse(concl!));
      expect(item.correct.length).toBe(bad.length || 1);
    }
  });

  it('rule namer: the answer passes the rule engine and every distractor fails', () => {
    for (const seed of SEEDS) {
      const item = choice('rule-namer', seed);
      const gap = item.proof!.find((l) => l.justification === null)!;
      const formulas = item.proof!.map((l) => parse(l.formula));
      const passes = (text: string) => {
        const [rule, ...cites] = text.split(', ');
        return checkStep(rule as Rule, cites.map((c) => formulas[Number(c) - 1]!), formulas[gap.n - 1]!);
      };
      for (const o of item.options) expect(passes(o.text), `${seed} ${o.text}`).toBe(item.correct.includes(o.id));
    }
  });

  it('next line: the answer is legal and every distractor is illegal', () => {
    for (const seed of SEEDS) {
      const item = choice('next-line', seed);
      const formulas = item.proof!.map((l) => parse(l.formula));
      for (const o of item.options) {
        const [f, j] = o.text.split(/\s{4}/);
        const [rule, ...cites] = j!.split(', ');
        const legal = checkStep(rule as Rule, cites.map((c) => formulas[Number(c) - 1]!), parse(f!));
        expect(legal, `${seed} ${o.text}`).toBe(item.correct.includes(o.id));
      }
      expect(item.options.length).toBe(4);
    }
  });
});

describe('logic pulse', () => {
  it('has six items, only from unlocked generators', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const pulse = buildPulse(1, {}, seed);
      expect(pulse).toHaveLength(PULSE_SIZE);
      for (const item of pulse) expect(['form-spotter', 'argument-or-explanation']).toContain(item.generator);
    }
    const all = new Set(SEEDS.slice(0, 50).flatMap((s) => buildPulse(8, {}, s).map((i) => i.generator)));
    expect(all.size).toBe(ready().length);
  });

  it('leans toward generators answered wrongly of late', () => {
    const count = (wrong: Record<string, number>) =>
      SEEDS.slice(0, 60)
        .flatMap((s) => buildPulse(8, wrong, s))
        .filter((i) => i.generator === 'modal-scope').length;
    expect(count({ 'modal-scope': 3 })).toBeGreaterThan(count({}) * 2);
  });
});
