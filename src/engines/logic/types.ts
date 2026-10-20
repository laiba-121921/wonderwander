import type { Assignment } from './formula';

export type GeneratorId =
  | 'form-spotter'
  | 'argument-or-explanation'
  | 'strength-judge'
  | 'translator'
  | 'main-connective'
  | 'truth-table'
  | 'validity-table'
  | 'rule-namer'
  | 'next-line'
  | 'quantifier-translator'
  | 'quantifier-shift'
  | 'fallacy-finder'
  | 'modal-scope';

export interface Choice {
  id: string;
  text: string;
}

export interface ProofLine {
  n: number;
  formula: string;
  justification: string | null; // null is the gap the student fills
}

interface Base {
  generator: GeneratorId;
  seed: number;
  prompt: string;
  explanation: string; // shown after checking, whatever the answer
}

export interface ChoiceItem extends Base {
  type: 'choice';
  stimulus?: string; // the passage, sentence or argument being judged
  keyLines?: string[]; // "P: you pass" style keys
  proof?: ProofLine[];
  options: Choice[];
  correct: string[]; // any one of these is right
}

export interface TableItem extends Base {
  type: 'table';
  formula: string;
  atoms: string[];
  rows: Assignment[];
  answer: boolean[];
}

export interface ConnectiveItem extends Base {
  type: 'connective';
  tokens: { text: string; connective: boolean }[];
  correct: number; // index into tokens
}

export type LogicItem = ChoiceItem | TableItem | ConnectiveItem;

export interface Generator {
  id: GeneratorId;
  title: string;
  logicUnit: number; // unlocks with this Logic unit (BUILD_PLAN 11)
  make: (seed: number) => LogicItem;
  available?: () => boolean; // false when the content it needs did not load
}

export function checkChoice(item: ChoiceItem, chosen: string): boolean {
  return item.correct.includes(chosen);
}

export function checkTable(item: TableItem, answers: (boolean | null)[]): boolean {
  return item.answer.every((v, i) => answers[i] === v);
}

export function checkConnective(item: ConnectiveItem, index: number): boolean {
  return item.correct === index;
}
