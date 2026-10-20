import type { DomainId, TrackId } from '../../src/content/types';

export interface DomainSpec {
  id: DomainId;
  track: TrackId;
  order: number; // position within its track
  unitCount: number;
  unitFiles: string[]; // Logic has one file per unit; every other domain has one file
  appendixFile: string;
  paperLadderLabel?: string; // label in the Paper Module's "Writing ladders that feed the paper" list
  finalBossLabel: string; // heading prefix in 27-final-bosses.md
}

// Supersedes the final boss sections at the end of each appendix (owner decision 2026-10-19).
export const FINAL_BOSSES_FILE = '27-final-bosses.md';

// BUILD_PLAN.md sections 1 and 5.5, filenames from content/SOURCES.md.
export const DOMAINS: DomainSpec[] = [
  {
    id: 'logic',
    track: 'logic',
    order: 1,
    unitCount: 8,
    unitFiles: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `0${n}-logic-unit-${n}.md`),
    appendixFile: '20-appendix-logic.md',
    finalBossLabel: 'Logic',
    paperLadderLabel: 'Logic',
  },
  { id: 'epistemology', track: 'A', order: 1, unitCount: 5, unitFiles: ['10-epistemology.md'], appendixFile: '21-appendix-epistemology.md', paperLadderLabel: 'Epistemology', finalBossLabel: 'Epistemology' },
  { id: 'metaphysics', track: 'A', order: 2, unitCount: 7, unitFiles: ['11-metaphysics.md'], appendixFile: '22-appendix-metaphysics.md', paperLadderLabel: 'Metaphysics', finalBossLabel: 'Metaphysics' },
  { id: 'mind', track: 'A', order: 3, unitCount: 8, unitFiles: ['12-mind.md'], appendixFile: '23-appendix-mind.md', paperLadderLabel: 'Philosophy of Mind', finalBossLabel: 'Philosophy of Mind' },
  { id: 'religion', track: 'B', order: 1, unitCount: 9, unitFiles: ['13-religion.md'], appendixFile: '24-appendix-religion.md', paperLadderLabel: 'Philosophy of Religion', finalBossLabel: 'Philosophy of Religion' },
  {
    id: 'religious-epistemology',
    track: 'B',
    order: 2,
    unitCount: 6,
    unitFiles: ['14-religious-epistemology.md'],
    appendixFile: '25-appendix-religious-epistemology.md',
    paperLadderLabel: 'Religious Epistemology',
    finalBossLabel: 'Religious Epistemology',
  },
  { id: 'political', track: 'C', order: 1, unitCount: 13, unitFiles: ['15-political.md'], appendixFile: '26-appendix-political.md', finalBossLabel: 'Political Philosophy' },
];

const unitIds = (d: DomainSpec) => Array.from({ length: d.unitCount }, (_, i) => `${d.id}-${i + 1}`);

// BUILD_PLAN.md section 13.1.
export function hardPrerequisites(domain: DomainSpec, n: number): string[] {
  if (n > 1) return [`${domain.id}-${n - 1}`];
  if (domain.id === 'logic') return [];
  const previous = DOMAINS.find((d) => d.track === domain.track && d.order === domain.order - 1);
  return previous ? unitIds(previous) : ['logic-1'];
}

// From the "How Track C runs" paragraph in 15-political.md. Logic 1 is already a hard prerequisite.
export const SOFT_PREREQUISITES: Record<string, string[]> = {
  'political-1': ['logic-5', 'logic-7'],
  'political-8': ['epistemology-1'],
  'political-9': ['metaphysics-7'],
  'political-13': ['religion-5', 'religion-9'],
};
