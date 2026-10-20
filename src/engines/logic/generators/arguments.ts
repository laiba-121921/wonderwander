import { ANALOGIES, CAUSES, STATEMENTS, SURVEYS } from '../banks';
import { makeRng, pick, sample, shuffle } from '../rng';
import type { ChoiceItem } from '../types';
import { cap, choices } from './common';

type S = (typeof STATEMENTS)[number];

const FORMS: { name: string; valid: boolean; lines: (p: S, q: S, r: S) => string[] }[] = [
  { name: 'Modus ponens', valid: true, lines: (p, q) => [`If ${p.yes}, then ${q.yes}.`, `${cap(p.yes)}.`, `So ${q.yes}.`] },
  { name: 'Modus tollens', valid: true, lines: (p, q) => [`If ${p.yes}, then ${q.yes}.`, `${cap(q.no)}.`, `So ${p.no}.`] },
  { name: 'Affirming the consequent', valid: false, lines: (p, q) => [`If ${p.yes}, then ${q.yes}.`, `${cap(q.yes)}.`, `So ${p.yes}.`] },
  { name: 'Denying the antecedent', valid: false, lines: (p, q) => [`If ${p.yes}, then ${q.yes}.`, `${cap(p.no)}.`, `So ${q.no}.`] },
  { name: 'Hypothetical syllogism', valid: true, lines: (p, q, r) => [`If ${p.yes}, then ${q.yes}.`, `If ${q.yes}, then ${r.yes}.`, `So if ${p.yes}, then ${r.yes}.`] },
  { name: 'Disjunctive syllogism', valid: true, lines: (p, q) => [`Either ${p.yes} or ${q.yes}.`, `${cap(p.no)}.`, `So ${q.yes}.`] },
];

const label = (name: string, valid: boolean) => `${name}, ${valid ? 'valid' : 'invalid'}`;

// Logic Unit 1: name the form of a short English argument and say whether it is valid.
export function formSpotter(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const [p, q, r] = sample(rng, STATEMENTS, 3) as [S, S, S];
  const form = pick(rng, FORMS);
  const right = label(form.name, form.valid);
  const pool = FORMS.flatMap((f) => [label(f.name, true), label(f.name, false)]).filter((t) => t !== right);
  // always include the same form with the wrong verdict, so the verdict is tested too
  const twin = label(form.name, !form.valid);
  const distractors = [twin, ...sample(rng, pool.filter((t) => t !== twin), 2)];
  return {
    generator: 'form-spotter',
    seed,
    type: 'choice',
    prompt: 'Name the form, and say whether it is valid.',
    stimulus: form.lines(p, q, r).join(' '),
    ...choices(rng, right, distractors),
    explanation: form.valid
      ? `${form.name}. Valid: there is no way for the premises to be true while the conclusion is false.`
      : `${form.name}. Invalid: the premises can be true while the conclusion is false.`,
  };
}

// Logic Unit 1: does the passage argue for something in doubt, or explain something already accepted?
export function argumentOrExplanation(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const c = pick(rng, CAUSES);
  const variant = pick(rng, ['explanation', 'so', 'must'] as const);
  const stimulus =
    variant === 'explanation' ? `${cap(c.effect)} because ${c.cause}.` : variant === 'so' ? `${cap(c.effect)}, so ${c.cause}.` : `It must be that ${c.cause}, because ${c.effect}.`;
  const isArgument = variant !== 'explanation';
  return {
    generator: 'argument-or-explanation',
    seed,
    type: 'choice',
    prompt: 'Argument or explanation?',
    stimulus,
    ...choices(rng, isArgument ? 'Argument' : 'Explanation', [isArgument ? 'Explanation' : 'Argument']),
    explanation: isArgument
      ? `Argument: that ${c.cause} is in doubt, and that ${c.effect} is offered as evidence for it.`
      : `Explanation: that ${c.effect} is treated as already known, and the "because" gives its cause, not evidence for it.`,
  };
}

// Logic Unit 2: which of two inductive arguments is stronger, and why.
export function strengthJudge(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const kind = pick(rng, ['size', 'representative', 'analogy'] as const);
  const strongIsA = rng() < 0.5;
  const reasons = {
    size: 'its sample is larger',
    representative: 'its sample is more representative',
    analogy: 'the similarity it relies on is relevant to the conclusion',
  };
  let a: string;
  let b: string;
  if (kind === 'analogy') {
    const x = pick(rng, ANALOGIES);
    const strong = `${cap(x.target)}, because ${x.relevant}.`;
    const weak = `${cap(x.target)}, because ${x.irrelevant}.`;
    [a, b] = strongIsA ? [strong, weak] : [weak, strong];
  } else {
    const s = pick(rng, SURVEYS);
    const strongSample = kind === 'size' ? s.large : s.fair;
    const weakSample = kind === 'size' ? s.small : s.biased;
    const strong = `In ${strongSample}, most said yes. So ${s.claim}.`;
    const weak = `In ${weakSample}, most said yes. So ${s.claim}.`;
    [a, b] = strongIsA ? [strong, weak] : [weak, strong];
  }
  const right = `${strongIsA ? 'A' : 'B'}, because ${reasons[kind]}`;
  const all = (['A', 'B'] as const).flatMap((w) => Object.values(reasons).map((r) => `${w}, because ${r}`));
  return {
    generator: 'strength-judge',
    seed,
    type: 'choice',
    prompt: 'Which argument is stronger, and why?',
    stimulus: `A: ${a}\n\nB: ${b}`,
    ...choices(rng, right, sample(rng, shuffle(rng, all.filter((t) => t !== right)), 3)),
    explanation: `${strongIsA ? 'A' : 'B'} is stronger: ${reasons[kind]}.`,
  };
}
