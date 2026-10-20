import { MODAL, PREDICATES, RELATIONS } from '../banks';
import { availableFallacies } from '../fallacies';
import { makeRng, pick, sample, shuffle } from '../rng';
import type { ChoiceItem } from '../types';
import { cap, choices } from './common';

// Monadic formulas of the shape [¬] Qx (Fx op [¬]Gx), enough for the four standard forms and their usual mistakes.
export interface Shape {
  outerNot: boolean;
  q: 'all' | 'some';
  op: 'imp' | 'and';
  negG: boolean;
}

export function printShape(s: Shape, F: string, G: string): string {
  const q = s.q === 'all' ? '∀x' : '∃x';
  const inner = `${F}x ${s.op === 'imp' ? '→' : '∧'} ${s.negG ? '¬' : ''}${G}x`;
  return `${s.outerNot ? '¬' : ''}${q} (${inner})`;
}

// Truth of a shape in a world, where a world is the set of kinds of thing present: [is F, is G] pairs.
function truth(s: Shape, world: [boolean, boolean][]): boolean {
  const holds = ([f, g]: [boolean, boolean]) => {
    const G = s.negG ? !g : g;
    return s.op === 'imp' ? !f || G : f && G;
  };
  const v = s.q === 'all' ? world.every(holds) : world.some(holds);
  return s.outerNot ? !v : v;
}

const KINDS: [boolean, boolean][] = [
  [true, true],
  [true, false],
  [false, true],
  [false, false],
];
// every non-empty combination of kinds: with two predicates this decides equivalence
const WORLDS = Array.from({ length: 15 }, (_, m) => KINDS.filter((_, k) => ((m + 1) >> k) & 1));

export const sameMeaning = (a: Shape, b: Shape) => WORLDS.every((w) => truth(a, w) === truth(b, w));

const ALL_SHAPES: Shape[] = [false, true].flatMap((outerNot) =>
  (['all', 'some'] as const).flatMap((q) => (['imp', 'and'] as const).flatMap((op) => [false, true].map((negG) => ({ outerNot, q, op, negG })))),
);

const FORMS = [
  { english: (p: string, a: string) => `All ${p} are ${a}.`, shape: { outerNot: false, q: 'all', op: 'imp', negG: false } as Shape },
  { english: (p: string, a: string) => `Some ${p} are ${a}.`, shape: { outerNot: false, q: 'some', op: 'and', negG: false } as Shape },
  { english: (p: string, a: string) => `No ${p} are ${a}.`, shape: { outerNot: false, q: 'all', op: 'imp', negG: true } as Shape },
  { english: (p: string, a: string) => `Some ${p} are not ${a}.`, shape: { outerNot: false, q: 'some', op: 'and', negG: true } as Shape },
];

// Logic Unit 6: English to predicate logic, four options.
export function quantifierTranslator(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const p = pick(rng, PREDICATES);
  const form = pick(rng, FORMS);
  const wrong: Shape[] = [];
  for (const s of shuffle(rng, ALL_SHAPES)) {
    if (sameMeaning(s, form.shape) || wrong.some((w) => sameMeaning(w, s))) continue;
    wrong.push(s);
    if (wrong.length === 3) break;
  }
  return {
    generator: 'quantifier-translator',
    seed,
    type: 'choice',
    prompt: 'Choose the correct translation.',
    stimulus: form.english(p.plural, p.adj),
    keyLines: [`${p.fl}x: x is a ${p.noun}`, `${p.gl}x: x is ${p.adj}`],
    ...choices(
      rng,
      printShape(form.shape, p.fl, p.gl),
      wrong.map((s) => printShape(s, p.fl, p.gl)),
    ),
    explanation: 'Universals use →, existentials use ∧. "No" is a universal with a negated consequent.',
  };
}

// Logic Unit 6: is the inference legitimate, or a quantifier shift?
export function quantifierShift(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const r = pick(rng, RELATIONS);
  const shift = rng() < 0.5;
  const stimulus = shift ? `${r.every}, so ${r.one}.` : `${cap(r.one)}, so ${r.every.charAt(0).toLowerCase()}${r.every.slice(1)}.`;
  const right = shift ? 'Quantifier shift: the conclusion does not follow' : 'Legitimate: the conclusion follows';
  return {
    generator: 'quantifier-shift',
    seed,
    type: 'choice',
    prompt: 'Is this inference legitimate, or a quantifier shift?',
    stimulus,
    ...choices(rng, right, [shift ? 'Legitimate: the conclusion follows' : 'Quantifier shift: the conclusion does not follow']),
    explanation: shift
      ? `From "every ${r.xs} has some ${r.ys}" (∀x∃y) it does not follow that one ${r.ys} serves them all (∃y∀x).`
      : `If one ${r.ys} serves every ${r.xs} (∃y∀x), then certainly every ${r.xs} has some ${r.ys} (∀x∃y).`,
  };
}

// Logic Unit 7: name the fallacy and choose the correct diagnosis.
export function fallacyFinder(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  const pool = availableFallacies();
  const f = pick(rng, pool);
  const others = sample(
    rng,
    pool.filter((x) => x.name !== f.name),
    3,
  );
  const opt = (x: (typeof pool)[number]) => `${x.name}: ${x.diagnosis}`;
  return {
    generator: 'fallacy-finder',
    seed,
    type: 'choice',
    prompt: 'Name the fallacy and its diagnosis.',
    stimulus: pick(rng, f.examples),
    ...choices(rng, opt(f), others.map(opt)),
    explanation: `${f.name}. ${f.diagnosis}`,
  };
}

// Logic Unit 8: does the box govern the whole conditional, or only the consequent?
export function modalScope(seed: number): ChoiceItem {
  const rng = makeRng(seed);
  if (rng() < 0.6) {
    const m = pick(rng, MODAL);
    const wide = `□(${m.p} → ${m.q})`;
    const narrow = `${m.p} → □${m.q}`;
    return {
      generator: 'modal-scope',
      seed,
      type: 'choice',
      prompt: 'Which formula says this?',
      stimulus: m.sentence,
      keyLines: m.key,
      ...choices(rng, m.wide ? wide : narrow, [m.wide ? narrow : wide]),
      explanation: m.wide ? 'The necessity governs the whole conditional: the connection is necessary.' : 'The necessity governs only the consequent: given the antecedent, the consequent could not have been otherwise.',
    };
  }
  const fallacy = rng() < 0.5;
  const stimulus = fallacy ? '□(P → Q). P. So □Q.' : '□(P → Q). □P. So □Q.';
  const right = fallacy ? 'Invalid: only Q follows, not □Q (the modal scope fallacy)' : 'Valid';
  return {
    generator: 'modal-scope',
    seed,
    type: 'choice',
    prompt: 'Is this inference valid?',
    stimulus,
    ...choices(rng, right, [fallacy ? 'Valid' : 'Invalid: only Q follows, not □Q (the modal scope fallacy)']),
    explanation: fallacy ? '□(P → Q) and P yield Q, not □Q. To get □Q you would need □P as well.' : '□(P → Q) and □P give □Q by K.',
  };
}
