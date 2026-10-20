import { and, atom, imp, not, or, print, type Formula } from '../formula';
import { checkStep, INFERENCE_RULES, RULE_NAMES, type Rule } from '../proof';
import { makeRng, pick, sample, shuffle, type Rng } from '../rng';
import type { ChoiceItem, ProofLine } from '../types';
import { choices } from './common';

interface Line {
  f: Formula;
  rule: Rule | 'Premise';
  cites: number[];
}

const just = (l: Line) => (l.rule === 'Premise' ? 'Premise' : `${l.rule}, ${l.cites.join(', ')}`);
const toProof = (lines: Line[], hide = -1): ProofLine[] => lines.map((l, i) => ({ n: i + 1, formula: print(l.f), justification: i === hide ? null : just(l) }));

type Ref = { derived: boolean; i: number };

// A short legal proof: one inference from premises, then a second inference that uses its result.
// Premises and steps are collected separately and numbered once at the end, premises first.
function buildProof(rng: Rng): Line[] {
  const [A, B, C, D] = sample(rng, ['P', 'Q', 'R', 'S'], 4).map((n) => (rng() < 0.2 ? not(atom(n)) : atom(n))) as Formula[];
  const premises: Formula[] = [];
  const steps: { f: Formula; rule: Rule; refs: Ref[] }[] = [];
  const prem = (f: Formula): Ref => ({ derived: false, i: premises.push(f) - 1 });
  const step = (f: Formula, rule: Rule, refs: Ref[]): Ref => ({ derived: true, i: steps.push({ f, rule, refs }) - 1 });

  const first = pick(rng, ['MP', 'MT', 'DS', 'Simp', 'HS'] as const);
  let x: Ref;
  if (first === 'MP') x = step(B!, 'MP', [prem(imp(A!, B!)), prem(A!)]);
  else if (first === 'MT') x = step(not(A!), 'MT', [prem(imp(A!, B!)), prem(not(B!))]);
  else if (first === 'DS') x = step(B!, 'DS', [prem(or(A!, B!)), prem(not(A!))]);
  else if (first === 'Simp') x = step(A!, 'Simp', [prem(and(A!, B!))]);
  else x = step(imp(A!, C!), 'HS', [prem(imp(A!, B!)), prem(imp(B!, C!))]);
  const X = steps[x.i]!.f;

  const second = pick(rng, ['MP', 'Conj', 'Add'] as const);
  if (second === 'MP') step(D!, 'MP', [prem(imp(X, D!)), x]);
  else if (second === 'Conj') step(and(X, D!), 'Conj', [x, prem(D!)]);
  else step(or(X, D!), 'Add', [x]);

  const num = (r: Ref) => (r.derived ? premises.length + r.i + 1 : r.i + 1);
  return [
    ...premises.map((f) => ({ f, rule: 'Premise' as const, cites: [] })),
    ...steps.map((s) => ({ f: s.f, rule: s.rule, cites: s.refs.map(num).sort((a, b) => a - b) })),
  ];
}

const cited = (lines: Line[], cites: number[]) => cites.map((c) => lines[c - 1]!.f);

// Logic Unit 5: one line has lost its justification; name the rule and the lines.
export function ruleNamer(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const lines = buildProof(rng);
  const derived = lines.map((_, i) => i).filter((i) => lines[i]!.rule !== 'Premise');
  const hide = pick(rng, derived);
  const target = lines[hide]!;
  const right = just(target);
  const earlier = Array.from({ length: hide }, (_, i) => i + 1);
  const pool: string[] = [];
  for (const rule of INFERENCE_RULES) {
    for (const a of earlier) {
      for (const cites of [[a], ...earlier.filter((b) => b > a).map((b) => [a, b])]) {
        const text = `${rule}, ${cites.join(', ')}`;
        if (text !== right && !checkStep(rule, cited(lines, cites), target.f)) pool.push(text);
      }
    }
  }
  // prefer near misses: the right rule with wrong lines, or the right lines with a wrong rule
  const near = pool.filter((t) => t.startsWith(`${target.rule},`) || t.endsWith(target.cites.join(', ')));
  const distractors = [...sample(rng, near, 2), ...sample(rng, pool.filter((t) => !near.includes(t)), 3)].slice(0, 3);
  return {
    generator: 'rule-namer',
    seed,
    type: 'choice',
    prompt: `Which rule and lines justify line ${hide + 1}?`,
    proof: toProof(lines, hide),
    ...choices(rng, right, distractors),
    explanation: `${RULE_NAMES[target.rule as Rule]} applied to line${target.cites.length > 1 ? 's' : ''} ${target.cites.join(' and ')}.`,
  };
}

// Logic Unit 5: which of four lines may legally come next?
export function nextLine(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const lines = buildProof(rng);
  const last = lines[lines.length - 1]!;
  const shown = lines.slice(0, -1);
  const right = `${print(last.f)}    ${just(last)}`;
  const avail = Array.from({ length: shown.length }, (_, i) => i + 1);
  const candidates: string[] = [];
  const tryAdd = (f: Formula, rule: Rule, cites: number[]) => {
    const text = `${print(f)}    ${rule}, ${cites.join(', ')}`;
    if (text !== right && !candidates.includes(text) && !checkStep(rule, cited(shown, cites), f)) candidates.push(text);
  };
  // tempting but illegal moves built from the available lines
  for (const i of avail) {
    const f = shown[i - 1]!.f;
    if (f.kind === 'bin' && f.op === 'imp') {
      for (const j of avail) {
        if (j === i) continue;
        tryAdd(f.a, 'MP', [Math.min(i, j), Math.max(i, j)]); // affirming the consequent in disguise
        tryAdd(not(f.b), 'MT', [Math.min(i, j), Math.max(i, j)]);
      }
    }
    if (f.kind === 'bin' && f.op === 'or') tryAdd(not(f.b), 'DS', [i]);
    tryAdd(not(f), 'DN', [i]);
  }
  tryAdd(not(last.f), last.rule as Rule, last.cites);
  tryAdd(last.f, pick(rng, INFERENCE_RULES.filter((r) => r !== last.rule)), last.cites);
  return {
    generator: 'next-line',
    seed,
    type: 'choice',
    prompt: 'Which line could legally come next?',
    proof: toProof(shown),
    ...choices(rng, right, shuffle(rng, candidates).slice(0, 3)),
    explanation: `${print(last.f)} follows by ${RULE_NAMES[last.rule as Rule]} from line${last.cites.length > 1 ? 's' : ''} ${last.cites.join(' and ')}. Each of the others misapplies a rule.`,
  };
}
