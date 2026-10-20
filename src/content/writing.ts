import { LADDER_STEPS, ladderId } from '../domain/progress';
import { loadArchitecture, loadDomain, loadPaper } from './load';
import type { DomainFile } from './types';

// Every writing item: the four ladder steps of each domain, and in the Paper Module the literature synthesis and
// the final paper (BUILD_PLAN 16, Testing Architecture section 7, Paper Module sections 4 and 8).
export type WritingKind = 'ladder' | 'referee' | 'synthesis' | 'final_paper';
export type LadderStep = (typeof LADDER_STEPS)[number]['step'];

export interface WritingItem {
  id: string;
  kind: WritingKind;
  step: string; // writing_submission.step
  ladderStep?: LadderStep;
  domainId: string | null;
  unitId: string; // item_state.unit_id: the domain, or "paper"
  title: string;
  words: { target: number; min?: number; max?: number } | null;
  prompt: string; // verbatim; steps 2 and 3 keep their {argument} and {n} slots
  rubric: string[];
  reject: string[];
  backTo: string;
  file?: DomainFile;
  previous: string[]; // items that must be passed or in review first
}

export const SYNTHESIS_ID = 'paper:literature-map:synthesis';
export const FINAL_PAPER_ID = 'paper:final-paper';

export const isWritingId = (id: string) => /:ladder:(abstract|reconstruction|objection_reply|referee)$/.test(id) || id === SYNTHESIS_ID || id === FINAL_PAPER_ID;

const TARGET: Record<LadderStep, number | null> = { abstract: 150, reconstruction: 400, objection_reply: 800, referee: null };

export async function findWriting(id: string): Promise<WritingItem> {
  const arch = await loadArchitecture();
  const referee = arch.ladder.find((l) => l.step === 4)!;
  if (id === SYNTHESIS_ID || id === FINAL_PAPER_ID) {
    const paper = await loadPaper();
    if (id === SYNTHESIS_ID) {
      return {
        id,
        kind: 'synthesis',
        step: 'synthesis',
        domainId: null,
        unitId: 'paper',
        title: 'Literature synthesis',
        words: { target: 300 },
        prompt: paper.literatureMap.synthesis,
        rubric: paper.literatureMap.synthesisKey?.required ?? [],
        reject: [],
        backTo: '/paper',
        previous: paper.literatureMap.keys.map((_, i) => `${paper.literatureMap.id}:${i + 1}`),
      };
    }
    return {
      id,
      kind: 'final_paper',
      step: 'final_paper',
      domainId: null,
      unitId: 'paper',
      title: 'The final paper',
      words: { target: 5000, min: 3000, max: 5000 },
      prompt: paper.finalPaper,
      rubric: referee.rubric,
      reject: [],
      backTo: '/paper',
      previous: [SYNTHESIS_ID, ...paper.thesisSets.flatMap((s) => [s.reconstruct.id, s.object.id, s.reply.id])],
    };
  }
  const m = id.match(/^(.+):ladder:(abstract|reconstruction|objection_reply|referee)$/);
  if (!m) throw new Error(`No writing item ${id}`);
  const [, domainId, step] = m as unknown as [string, string, LadderStep];
  const file = await loadDomain(domainId);
  const index = LADDER_STEPS.findIndex((s) => s.step === step);
  const def = arch.ladder[index]!;
  const isReferee = step === 'referee';
  return {
    id,
    kind: isReferee ? 'referee' : 'ladder',
    step: isReferee ? 'draft' : step,
    ladderStep: step,
    domainId,
    unitId: domainId,
    title: def.title,
    words: TARGET[step] ? { target: TARGET[step]! } : null,
    prompt: def.prompt ?? def.body,
    rubric: def.rubric,
    reject: def.reject,
    backTo: `/library/${domainId}`,
    file,
    previous: LADDER_STEPS.slice(0, index).map((s) => ladderId(domainId, s.step)),
  };
}
