import { CLAUSES, PAIRS } from '../banks';
import { and, atom, atoms, bin, counterexamples, equivalent, iff, imp, not, or, parse, print, rows, truthColumn, type BinOp, type Formula } from '../formula';
import { makeRng, pick, shuffle, type Rng } from '../rng';
import type { ChoiceItem, ConnectiveItem, TableItem } from '../types';
import { cap, choices } from './common';

// Distractors must be wrong and must differ from each other, so exactly one option is right.
function distinctWrong(rng: Rng, answer: Formula, pool: Formula[], n: number): Formula[] {
  const out: Formula[] = [];
  for (const f of shuffle(rng, pool)) {
    if (equivalent(f, answer) || out.some((o) => equivalent(o, f))) continue;
    out.push(f);
    if (out.length === n) break;
  }
  return out;
}

// Logic Unit 3: translate "only if", "unless", "neither nor", "not both" and friends.
export function translator(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const pattern = pick(rng, ['only if', 'if', 'unless', 'iff', 'neither', 'not both'] as const);
  let sentence: string;
  let key: string[];
  let P: Formula;
  let Q: Formula;
  if (pattern === 'neither' || pattern === 'not both') {
    const x = pick(rng, PAIRS);
    P = atom(x.pl);
    Q = atom(x.ql);
    sentence = pattern === 'neither' ? `${x.subject} is neither ${x.p} nor ${x.q}.` : `${x.subject} is not both ${x.p} and ${x.q}.`;
    key = [`${x.pl}: ${x.subject.toLowerCase().startsWith('the') ? x.subject.toLowerCase() : x.subject} is ${x.p}`, `${x.ql}: ${x.subject.toLowerCase().startsWith('the') ? x.subject.toLowerCase() : x.subject} is ${x.q}`];
  } else {
    const c = pick(rng, CLAUSES);
    P = atom(c.pl);
    Q = atom(c.ql);
    key = [`${c.pl}: ${c.p}`, `${c.ql}: ${c.q}`];
    sentence = {
      'only if': `${cap(c.p)} only if ${c.q}.`,
      if: `${cap(c.p)} if ${c.q}.`,
      unless: `${cap(c.p)} unless ${c.q}.`,
      iff: `${cap(c.p)} if and only if ${c.q}.`,
    }[pattern];
  }
  const answer = {
    'only if': imp(P, Q),
    if: imp(Q, P),
    unless: imp(not(Q), P),
    iff: iff(P, Q),
    neither: and(not(P), not(Q)),
    'not both': not(and(P, Q)),
  }[pattern];
  const pool = [imp(P, Q), imp(Q, P), iff(P, Q), and(P, Q), or(P, Q), imp(P, not(Q)), and(not(P), not(Q)), not(and(P, Q)), and(P, not(Q)), imp(not(P), not(Q)), or(not(P), Q)];
  const explanation = {
    'only if': '"Only if" introduces the consequent: "P only if Q" is P → Q.',
    if: '"P if Q" puts the condition after "if": Q → P.',
    unless: '"P unless Q" is ¬Q → P, or equivalently P ∨ Q.',
    iff: '"If and only if" is the biconditional, both directions at once.',
    neither: '"Neither P nor Q" is ¬P ∧ ¬Q: both are false.',
    'not both': '"Not both P and Q" is ¬(P ∧ Q): at least one is false.',
  }[pattern];
  return {
    generator: 'translator',
    seed,
    type: 'choice',
    prompt: 'Choose the correct symbolisation.',
    stimulus: sentence,
    keyLines: key,
    ...choices(
      rng,
      print(answer),
      distinctWrong(rng, answer, pool, 3).map((f) => print(f)),
    ),
    explanation,
  };
}

const OPS: BinOp[] = ['and', 'or', 'imp', 'iff'];

export function randomFormula(rng: Rng, names: string[], depth: number): Formula {
  if (depth <= 0) {
    const a = atom(pick(rng, names));
    return rng() < 0.25 ? not(a) : a;
  }
  if (rng() < 0.2) return not(randomFormula(rng, names, depth - 1));
  return bin(pick(rng, OPS), randomFormula(rng, names, depth - 1), randomFormula(rng, names, depth - 1 - (rng() < 0.5 ? 1 : 0)));
}

function tokens(f: Formula, top: boolean, out: { text: string; connective: boolean }[]): number {
  if (f.kind === 'atom') {
    out.push({ text: f.name, connective: false });
    return -1;
  }
  if (f.kind === 'not') {
    const at = out.length;
    out.push({ text: '¬', connective: true });
    tokens(f.a, false, out);
    return at;
  }
  if (!top) out.push({ text: '(', connective: false });
  tokens(f.a, false, out);
  const at = out.length;
  out.push({ text: { and: '∧', or: '∨', imp: '→', iff: '↔' }[f.op], connective: true });
  tokens(f.b, false, out);
  if (!top) out.push({ text: ')', connective: false });
  return at;
}

// Logic Unit 3: tap the main connective of a formula.
export function mainConnective(seed: number): ConnectiveItem {
  const rng = makeRng(seed);
  let f: Formula;
  do f = randomFormula(rng, ['P', 'Q', 'R'], 2);
  while (f.kind === 'atom' || print(f).length < 9);
  const toks: { text: string; connective: boolean }[] = [];
  const correct = tokens(f, true, toks);
  return {
    generator: 'main-connective',
    seed,
    type: 'connective',
    prompt: 'Tap the main connective.',
    tokens: toks,
    correct,
    explanation: `The main connective is the one that governs the whole formula: ${toks[correct]!.text}.`,
  };
}

// Logic Unit 4: fill the final column of a truth table.
export function truthTable(seed: number): TableItem {
  const rng = makeRng(seed);
  const names = rng() < 0.5 ? ['P', 'Q'] : ['P', 'Q', 'R'];
  let f: Formula;
  do f = randomFormula(rng, names, 2);
  while (atoms(f).length !== names.length || f.kind === 'atom');
  return {
    generator: 'truth-table',
    seed,
    type: 'table',
    prompt: `Fill the final column for ${print(f)}.`,
    formula: print(f),
    atoms: names,
    rows: rows(names),
    answer: truthColumn(f, names),
    explanation: 'Work from the inside out: the innermost brackets first, the main connective last.',
  };
}

const FORMS: [string[], string][] = [
  [['P → Q', 'P'], 'Q'],
  [['P → Q', '¬Q'], '¬P'],
  [['P → Q', 'Q → R'], 'P → R'],
  [['P ∨ Q', '¬P'], 'Q'],
  [['P → (Q ∧ R)', 'P'], 'R'],
  [['P → Q', 'Q'], 'P'],
  [['P → Q', '¬P'], '¬Q'],
  [['P ∨ Q', 'P'], '¬Q'],
  [['P → R', 'Q → R'], 'P → Q'],
  [['P → (Q ∨ R)', 'P'], 'Q'],
  [['¬(P ∧ Q)'], '¬P'],
  [['P ↔ Q', '¬P'], '¬Q'],
];

const rowText = (v: Record<string, boolean>) =>
  Object.entries(v)
    .map(([k, b]) => `${k} = ${b ? 'T' : 'F'}`)
    .join(', ');

// Logic Unit 4: find a row where the premises are true and the conclusion false, or declare the form valid.
export function validityTable(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const [prem, concl] = pick(rng, FORMS);
  const premises = prem.map((p) => parse(p));
  const conclusion = parse(concl);
  const names = atoms(...premises, conclusion);
  const bad = counterexamples(premises, conclusion).map(rowText);
  const options = [...rows(names).map(rowText), 'Valid: no such row'].map((text, i) => ({ id: 'abcdefghij'[i]!, text }));
  return {
    generator: 'validity-table',
    seed,
    type: 'choice',
    prompt: 'Pick a row where every premise is true and the conclusion is false, or say the form is valid.',
    stimulus: `${prem.join(';  ')}  ∴  ${concl}`,
    options,
    correct: options.filter((o) => (bad.length ? bad.includes(o.text) : o.text.startsWith('Valid'))).map((o) => o.id),
    explanation: bad.length ? `Invalid. Counterexample: ${bad.join(' or ')}.` : 'Valid: no row makes every premise true and the conclusion false.',
  };
}
