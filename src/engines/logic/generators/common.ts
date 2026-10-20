import { shuffle, type Rng } from '../rng';
import type { Choice } from '../types';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const IDS = 'abcdefghij';

// Shuffles the right answer in among the distractors; returns options with ids a, b, c...
export function choices(rng: Rng, correct: string, distractors: string[]): { options: Choice[]; correct: string[] } {
  const all = shuffle(rng, [correct, ...distractors]);
  const options = all.map((text, i) => ({ id: IDS[i]!, text }));
  return { options, correct: [options.find((o) => o.text === correct)!.id] };
}
