import { describe, expect, it } from 'vitest';
import { and, atom, counterexamples, equivalent, evaluate, iff, imp, isValid, not, or, parse, print, rows, truthColumn, type Formula } from '../../src/engines/logic/formula';
import { checkStep } from '../../src/engines/logic/proof';
import { makeRng } from '../../src/engines/logic/rng';
import { randomFormula } from '../../src/engines/logic/generators/symbols';

const P = atom('P');
const Q = atom('Q');
const R = atom('R');
const T = (s: string) => s.split(',').map((x) => x.trim() === 'T');

describe('formulas', () => {
  it('parses and prints the curriculum symbols, round trip', () => {
    for (const s of ['P \u2192 Q', '\u00ac(P \u2227 Q)', '(P \u2228 Q) \u2192 R', 'P \u2194 \u00ac\u00acQ', '(P \u2192 Q) \u2227 (Q \u2192 P)']) expect(print(parse(s))).toBe(s);
  });

  it('rejects unbracketed chains as ambiguous', () => {
    expect(() => parse('P \u2227 Q \u2228 R')).toThrow(/ambiguous/);
    expect(() => parse('P \u2192')).toThrow();
  });

  it('gives the five basic tables (Logic Unit 4)', () => {
    const v = (p: boolean, q: boolean) => ({ P: p, Q: q });
    const cases: [boolean, boolean][] = [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ];
    expect(cases.map(([p, q]) => evaluate(and(P, Q), v(p, q)))).toEqual([true, false, false, false]);
    expect(cases.map(([p, q]) => evaluate(or(P, Q), v(p, q)))).toEqual([true, true, true, false]);
    expect(cases.map(([p, q]) => evaluate(imp(P, Q), v(p, q)))).toEqual([true, false, true, true]);
    expect(cases.map(([p, q]) => evaluate(iff(P, Q), v(p, q)))).toEqual([true, false, false, true]);
    expect([true, false].map((p) => evaluate(not(P), { P: p }))).toEqual([false, true]);
  });

  it('uses the standard row order and matches the Logic 4 drill keys', () => {
    expect(rows(['P', 'Q']).map((r) => `${r.P ? 'T' : 'F'}${r.Q ? 'T' : 'F'}`)).toEqual(['TT', 'TF', 'FT', 'FF']);
    expect(truthColumn(parse('P \u2192 Q'))).toEqual(T('T, F, T, T')); // L4-01
    expect(truthColumn(parse('\u00ac(P \u2227 Q)'))).toEqual(T('F, T, T, T')); // L4-02
    expect(truthColumn(parse('(P \u2228 Q) \u2192 R'))).toEqual(T('T, F, T, F, T, F, T, T')); // L4-04
  });

  it('decides equivalence correctly', () => {
    expect(equivalent(not(and(P, Q)), or(not(P), not(Q)))).toBe(true);
    expect(equivalent(imp(P, Q), imp(not(Q), not(P)))).toBe(true);
    expect(equivalent(imp(not(Q), P), or(P, Q))).toBe(true); // "P unless Q"
    expect(equivalent(imp(P, Q), imp(Q, P))).toBe(false);
  });

  it('agrees with brute force on many random pairs of up to three atoms', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 400; i++) {
      const a = randomFormula(rng, ['P', 'Q', 'R'], 2);
      const b = randomFormula(rng, ['P', 'Q', 'R'], 2);
      const brute = rows(['P', 'Q', 'R']).every((v) => evaluate(a, v) === evaluate(b, v));
      expect(equivalent(a, b)).toBe(brute);
    }
  });

  it('finds counterexamples to invalid forms only', () => {
    expect(isValid([imp(P, Q), P], Q)).toBe(true);
    expect(isValid([imp(P, Q), not(Q)], not(P))).toBe(true);
    expect(counterexamples([imp(P, Q), Q], P)).toEqual([{ P: false, Q: true }]); // affirming the consequent
    expect(isValid([imp(P, Q), not(P)], not(Q))).toBe(false); // denying the antecedent
  });
});

describe('proof rules (Logic Unit 5)', () => {
  const ok = (rule: Parameters<typeof checkStep>[0], cited: string[], result: string) => checkStep(rule, cited.map(parse), parse(result));

  it('accepts each inference rule applied correctly, in either citation order', () => {
    expect(ok('MP', ['P \u2192 Q', 'P'], 'Q')).toBe(true);
    expect(ok('MP', ['P', 'P \u2192 Q'], 'Q')).toBe(true);
    expect(ok('MT', ['P \u2192 Q', '\u00acQ'], '\u00acP')).toBe(true);
    expect(ok('HS', ['P \u2192 Q', 'Q \u2192 R'], 'P \u2192 R')).toBe(true);
    expect(ok('DS', ['P \u2228 Q', '\u00acP'], 'Q')).toBe(true);
    expect(ok('Simp', ['P \u2227 Q'], 'Q')).toBe(true);
    expect(ok('Conj', ['P', 'Q'], 'P \u2227 Q')).toBe(true);
    expect(ok('Add', ['P'], 'P \u2228 R')).toBe(true);
    expect(ok('DN', ['\u00ac\u00acP'], 'P')).toBe(true);
  });

  it('rejects the classic invalid moves', () => {
    expect(ok('MP', ['P \u2192 Q', 'Q'], 'P')).toBe(false); // affirming the consequent
    expect(ok('MT', ['P \u2192 Q', '\u00acP'], '\u00acQ')).toBe(false); // denying the antecedent
    expect(ok('DS', ['P \u2228 Q', 'P'], '\u00acQ')).toBe(false); // or is inclusive
    expect(ok('MP', ['(P \u2192 Q) \u2227 R', 'P'], 'Q')).toBe(false); // the conditional must be a whole line
    expect(ok('DS', ['\u00acP \u2228 \u00acQ', 'P'], '\u00acQ')).toBe(false); // needs the DN line first
  });

  it('applies replacement rules inside a line', () => {
    expect(ok('Comm', ['(P \u2228 Q) \u2192 R'], '(Q \u2228 P) \u2192 R')).toBe(true);
    expect(ok('DeM', ['\u00ac(P \u2227 Q)'], '\u00acP \u2228 \u00acQ')).toBe(true);
    expect(ok('Contra', ['P \u2192 Q'], '\u00acQ \u2192 \u00acP')).toBe(true);
    expect(ok('CE', ['P \u2192 Q'], '\u00acP \u2228 Q')).toBe(true);
    expect(ok('BE', ['P \u2194 Q'], '(P \u2192 Q) \u2227 (Q \u2192 P)')).toBe(true);
    expect(ok('DN', ['P \u2192 Q'], 'P \u2192 \u00ac\u00acQ')).toBe(true);
    expect(ok('Comm', ['P \u2192 Q'], 'Q \u2192 P')).toBe(false);
  });

  it('every replacement rule preserves meaning', () => {
    const pairs: [string, string][] = [
      ['\u00ac(P \u2228 Q)', '\u00acP \u2227 \u00acQ'],
      ['P \u2192 Q', '\u00acQ \u2192 \u00acP'],
      ['P \u2192 Q', '\u00acP \u2228 Q'],
      ['P \u2194 Q', '(P \u2192 Q) \u2227 (Q \u2192 P)'],
    ];
    for (const [a, b] of pairs) expect(equivalent(parse(a), parse(b) as Formula)).toBe(true);
    void R;
  });
});
