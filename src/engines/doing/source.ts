import type { AnswerKey, AuthorPlaybook, PaperThesisSet, Unit } from '../../content/types';
import { fillSlot, objectExercise, objectKey, objectTargets, reconstructExercise, replyKey, type DoingText, type Target } from './standardForm';

// One shape for every reconstruct, object and reply set: a unit's doing drills, or a Paper Module thesis set.
export interface DoingSource {
  prefix: string; // item ids are `${prefix}:reconstruct` and so on
  unitId: string; // item_state.unit_id ("paper" for the Paper Module)
  title: string;
  backTo: string;
  author: string;
  playbook: AuthorPlaybook;
  standardForm: string[]; // the reconstruct key's REQUIRED lines
  reconstruct: { id: string; prompt: string; passage?: string; phrase?: string; bundled: { id: string; title: string }[]; key: AnswerKey; exercise: (excerpt: string | null) => string };
  // on-track examples go to the grader in the key's notes and are shown to the student only after the attempt
  object: { id: string; targets: Target[]; prompt: (t: Target | null) => string; key: AnswerKey; exercise: (argument: string, t: Target | null) => string; onTrack?: string };
  reply: { id: string; key: AnswerKey };
}

export function unitSource(unit: Unit, text: DoingText): DoingSource {
  const d = unit.doing;
  return {
    prefix: unit.id,
    unitId: unit.id,
    title: unit.title,
    backTo: `/practice/${unit.id}`,
    author: d.authorPlaybook.author,
    playbook: d.authorPlaybook,
    standardForm: d.reconstruct.key.required,
    reconstruct: {
      id: d.reconstruct.id,
      prompt: fillSlot(text.reconstructPrompt, 'author', d.authorPlaybook.author),
      passage: d.reconstruct.passage,
      phrase: d.reconstruct.identifyingPhrase,
      bundled: unit.reading.texts.flatMap((t) => t.bundled ?? []),
      key: d.reconstruct.key,
      exercise: (excerpt) => reconstructExercise(unit, text, excerpt),
    },
    object: {
      id: d.object.id,
      targets: objectTargets(d.object.loadBearing, d.reconstruct.key.required),
      prompt: (t) => fillSlot(text.objectPrompt, 'n', t?.n ?? '{n}'),
      key: objectKey(unit, text),
      exercise: (argument, t) => objectExercise(text, argument, t!),
      ...(d.object.onTrackExamples ? { onTrack: d.object.onTrackExamples } : {}),
    },
    reply: { id: d.reply.id, key: replyKey(text) },
  };
}

// The Paper Module's sets carry their own tasks and rubrics (Paper Module section 5); the student names the premise.
export function paperSource(set: PaperThesisSet): DoingSource {
  const o = set.object;
  const notes = [`ALREADY-ANSWERED: ${o.alreadyAnswered}`];
  if (o.onTrackExamples) notes.push(`ON-TRACK EXAMPLES: ${o.onTrackExamples}`);
  return {
    prefix: `paper:${set.thesis}`,
    unitId: 'paper',
    title: `Thesis ${set.thesis}: ${set.title}`,
    backTo: '/paper',
    author: set.reply.authorPlaybook.author,
    playbook: set.reply.authorPlaybook,
    standardForm: set.reconstruct.key.required,
    reconstruct: { id: set.reconstruct.id, prompt: set.reconstruct.task, bundled: [], key: set.reconstruct.key, exercise: () => set.reconstruct.task },
    object: {
      id: o.id,
      targets: [],
      prompt: () => o.task,
      key: { required: [o.rubric], accept: [], reject: [], notes: notes.join('\n'), version: 1 },
      exercise: (argument) => [o.task, '', 'ARGUMENT:', argument].join('\n'),
      ...(o.onTrackExamples ? { onTrack: o.onTrackExamples } : {}),
    },
    reply: { id: set.reply.id, key: { required: [set.reply.rubric], accept: [], reject: [], version: 1 } },
  };
}

export function playbookOf(src: DoingSource): string {
  const p = src.playbook;
  return [`AUTHOR: ${p.author}`, `POSITION: ${p.position}`, `REPLIES: ${p.replies}`, `FORBIDDEN: ${p.forbidden}`].join('\n');
}
