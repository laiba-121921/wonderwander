export type DomainId =
  | 'logic'
  | 'epistemology'
  | 'metaphysics'
  | 'mind'
  | 'religion'
  | 'religious-epistemology'
  | 'political';
export type TrackId = 'logic' | 'A' | 'B' | 'C';
export type Markdown = string;

export interface Domain {
  id: DomainId;
  track: TrackId;
  order: number;
  title: string;
  unitIds: string[];
  finalBoss: BossPlaybook;
  writingLadder: { thesisSuggestions: string[] };
  intro?: Markdown;
  outro?: Markdown; // "What this track has given you", from the end of the last unit
  appendixIntro?: Markdown;
}

export interface DomainFile {
  domain: Domain;
  units: Unit[];
}

export interface Unit {
  id: string;
  domain: DomainId;
  number: number;
  title: string;
  lesson: LessonSection[];
  whyCares?: Markdown;
  workedExamples: Markdown;
  drills: Drill[];
  cards: Card[];
  mistakes: Markdown;
  reading: Reading;
  doing: DoingSet;
  miniBoss: BossPlaybook;
  prerequisites: string[];
  softPrerequisites: string[];
}

export interface LessonSection {
  id: string;
  number: string;
  heading: string;
  markdown: Markdown;
}

export type Drill = TapDrill | KeyedDrill;

interface DrillBase {
  id: string; // stable item id, e.g. religion-7:drill:R7-03
  sourceId: string; // id exactly as written in the source, e.g. R7-03
  prompt: string;
  revisionSectionIds: string[];
}

export interface TapDrill extends DrillBase {
  kind: 'tap';
  options: { id: string; text: string }[];
  correct: string[];
  keyNote?: string;
}

export interface KeyedDrill extends DrillBase {
  kind: 'keyed';
  key: AnswerKey;
  structureNote?: string;
  variants?: false; // symbolic drills retry on the original (owner decision 2026-10-19)
  tapTagged?: boolean; // marked TAP in the source but has no options to tap, so graded against the key
  alwaysQueue?: boolean; // the source said it was graded only in the weekly review (superseded, PHASE_15_PLUS 1.2)
  appealable?: boolean; // a verdict that can always be appealed (owner decision 2026-10-19, PC6)
}

export interface AnswerKey {
  required: string[];
  accept: string[];
  reject: string[];
  notes?: string;
  version: number;
}

export interface Card {
  id: string;
  number: number;
  front: string;
  back: string;
  key: AnswerKey;
}

export interface Reading {
  texts: TextRef[];
  guide: string[];
  comprehension: Drill[];
}

export interface TextRef {
  role: 'primary' | 'second' | 'companion' | 'optional';
  label: string; // verbatim from the appendix
  bundled?: { id: string; title: string }[]; // public-domain texts in content/texts
  links?: { title: string; url: string }[]; // verified free and legitimate copies
  unavailable?: string[]; // works named here with no free legitimate copy (paid only)
}

export interface DoingSet {
  reconstruct: { id: string; passage: string; identifyingPhrase?: string; key: AnswerKey };
  object: { id: string; loadBearing: string; alreadyAnswered: string; onTrackExamples?: string };
  reply: { id: string };
  authorPlaybook: AuthorPlaybook;
}

export interface AuthorPlaybook {
  author: string;
  position: string;
  replies: string;
  forbidden: string;
}

export interface BossPlaybook {
  id: string;
  name: string;
  persona: string;
  position: string;
  openingMove: string;
  standardObjections: string;
  escalation: string;
  concessionRule: string;
  forbidden?: string;
  exit: string;
  exitTurns: number;
  rubricExtra: string[];
  roleReversal?: string;
  alwaysEscalate: boolean;
  art?: { pose: string; accessory: string };
}

export interface Prompts {
  grader: string;
  auditor: string;
  authorReply: string;
  boss: string;
  judge: string;
  variant: string;
  variantCheck: string;
  referee: string;
}

export interface LadderStep {
  step: number;
  title: string;
  prompt?: string;
  rubric: string[];
  reject: string[];
  body: Markdown;
}

export interface Architecture {
  prompts: Prompts;
  playbookTemplate: string;
  bossBaseRubric: string[];
  escalatedMessage: string;
  doing: {
    reconstructPrompt: string;
    reconstructKeyFormat: Markdown;
    objectPrompt: string;
    objectRubric: string[];
    objectReject: string[];
    replyPrompt: string;
    replyRubric: string[];
    replyReject: string[];
  };
  ladder: LadderStep[];
  passConditions: Markdown;
}

export interface PaperThesisSet {
  thesis: 'A' | 'B' | 'C';
  title: string;
  reconstruct: { id: string; task: string; key: AnswerKey };
  object: { id: string; task: string; rubric: string; onTrackExamples?: string; alreadyAnswered: string };
  reply: { id: string; authorPlaybook: AuthorPlaybook; rubric: string };
}

export interface PaperModule {
  intro: Markdown;
  theses: { id: 'A' | 'B' | 'C'; text: Markdown }[];
  sources: Markdown;
  readingGuide: string[];
  comprehension: Drill[];
  whyTheseMatter: Markdown;
  literatureMap: {
    id: string;
    intro: Markdown;
    questions: string[];
    keysIntro: Markdown;
    keys: { label: string; text: string }[];
    synthesis: Markdown;
    synthesisKey?: AnswerKey; // owner decision 2026-10-19: the three elements the synthesis question names
  };
  thesisSets: PaperThesisSet[];
  selectionGate: Markdown;
  ladderTheses: { label: string; text: string }[];
  finalPaper: Markdown;
}
