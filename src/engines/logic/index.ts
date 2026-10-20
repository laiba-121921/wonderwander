import { argumentOrExplanation, formSpotter, strengthJudge } from './generators/arguments';
import { fallacyFinder, modalScope, quantifierShift, quantifierTranslator } from './generators/predicate';
import { nextLine, ruleNamer } from './generators/proofs';
import { mainConnective, translator, truthTable, validityTable } from './generators/symbols';
import { fallacyFinderReady } from './fallacies';
import { makeRng, pick } from './rng';
import type { Generator, GeneratorId, LogicItem } from './types';

// BUILD_PLAN 11: each generator unlocks with its Logic unit.
export const GENERATORS: Generator[] = [
  { id: 'form-spotter', title: 'Form spotter', logicUnit: 1, make: formSpotter },
  { id: 'argument-or-explanation', title: 'Argument or explanation', logicUnit: 1, make: argumentOrExplanation },
  { id: 'strength-judge', title: 'Strength judge', logicUnit: 2, make: strengthJudge },
  { id: 'translator', title: 'Translator', logicUnit: 3, make: translator },
  { id: 'main-connective', title: 'Main connective', logicUnit: 3, make: mainConnective },
  { id: 'truth-table', title: 'Truth table', logicUnit: 4, make: truthTable },
  { id: 'validity-table', title: 'Validity by table', logicUnit: 4, make: validityTable },
  { id: 'rule-namer', title: 'Rule namer', logicUnit: 5, make: ruleNamer },
  { id: 'next-line', title: 'Next line', logicUnit: 5, make: nextLine },
  { id: 'quantifier-translator', title: 'Quantifier translator', logicUnit: 6, make: quantifierTranslator },
  { id: 'quantifier-shift', title: 'Quantifier shift spotter', logicUnit: 6, make: quantifierShift },
  { id: 'fallacy-finder', title: 'Fallacy finder', logicUnit: 7, make: fallacyFinder, available: fallacyFinderReady },
  { id: 'modal-scope', title: 'Modal scope', logicUnit: 8, make: modalScope },
];

export const generator = (id: GeneratorId) => GENERATORS.find((g) => g.id === id)!;

export const PULSE_SIZE = 6;

// The daily logic pulse (BUILD_PLAN 11): six items from generators of passed Logic units and the current one,
// weighted toward generators answered wrongly of late. Pulse results never lock anything.
export function buildPulse(highestLogicUnit: number, recentWrong: Partial<Record<GeneratorId, number>>, seed: number): LogicItem[] {
  const rng = makeRng(seed);
  const open = GENERATORS.filter((g) => g.logicUnit <= Math.max(1, highestLogicUnit) && (g.available?.() ?? true));
  const weighted = open.flatMap((g) => Array.from({ length: 1 + Math.min(3, recentWrong[g.id] ?? 0) * 2 }, () => g));
  const items: LogicItem[] = [];
  let last: GeneratorId | null = null;
  for (let i = 0; items.length < PULSE_SIZE && i < 100; i++) {
    const g = pick(rng, weighted);
    if (g.id === last && open.length > 1) continue; // avoid two of the same in a row
    items.push(g.make(Math.floor(rng() * 2 ** 31)));
    last = g.id;
  }
  return items;
}

export * from './types';
