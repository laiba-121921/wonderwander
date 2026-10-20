import type { PropSpec } from './props';
import type { BodyStyle, Expression, HeadStyle, Pose } from './StickFigure';

export interface BossArt {
  pose: Pose;
  expression: Expression;
  props: PropSpec[];
  head?: HeadStyle;
  body?: BodyStyle;
  scale?: number;
  note?: string; // what was left out of the BOSS line and why, for owner review
}

const p = (key: PropSpec['key'], label?: string, colour?: string): PropSpec => ({ key, ...(label ? { label } : {}), ...(colour ? { colour } : {}) });

// Derived from each playbook's BOSS line (BUILD_PLAN 19.6). Final bosses follow the ART line in 27-final-bosses.md.
// Listed with reasons in the boss art table kept with the planning documents.
export const BOSS_ART: Record<string, BossArt> = {
  'logic-1:boss': { pose: 'arms-crossed', expression: 'stern', props: [] },
  'logic-2:boss': { pose: 'point', expression: 'smug', props: [] },
  'logic-3:boss': { pose: 'point', expression: 'smug', props: [p('sign', 'Q so P')], note: 'Sign added to show "writes conditionals backwards"; no prop is named.' },
  'logic-4:boss': { pose: 'think', expression: 'curious', props: [], note: 'The hand to the stomach is approximated by the think pose.' },
  'logic-5:boss': { pose: 'shrug', expression: 'stern', props: [] },
  'logic-6:boss': { pose: 'point', expression: 'smug', props: [p('sign', '\u2203\u2200')], note: 'Sign shows quantifiers moved to the front; no prop is named.' },
  'logic-7:boss': { pose: 'point', expression: 'stern', props: [p('fallacy-list')] },
  'logic-8:boss': { pose: 'stand', expression: 'neutral', props: [p('box', 'necessarily')] },
  'logic:final-boss': { pose: 'point', expression: 'smug', props: [p('toga')] },

  'epistemology-1:boss': { pose: 'point', expression: 'smug', props: [p('coin')] },
  'epistemology-2:boss': { pose: 'stand', expression: 'curious', props: [p('tape')] },
  'epistemology-3:boss': { pose: 'stand', expression: 'smug', props: [p('jar')] },
  'epistemology-4:boss': { pose: 'shrug', expression: 'curious', props: [] },
  'epistemology-5:boss': { pose: 'stand', expression: 'smug', props: [], head: 'blindfold' },
  'epistemology:final-boss': { pose: 'think', expression: 'neutral', props: [p('horns'), p('mirror')] },

  'metaphysics-1:boss': { pose: 'point', expression: 'delighted', props: [p('sign', 'the round square')] },
  'metaphysics-2:boss': { pose: 'point', expression: 'curious', props: [] },
  'metaphysics-3:boss': { pose: 'stand', expression: 'delighted', props: [p('hammer'), p('plank')] },
  'metaphysics-4:boss': { pose: 'stand', expression: 'neutral', props: [], head: 'clock' },
  'metaphysics-5:boss': { pose: 'stand', expression: 'smug', props: [p('chart')] },
  'metaphysics-6:boss': { pose: 'stand', expression: 'neutral', props: [], head: 'big-eyes' },
  'metaphysics-7:boss': { pose: 'sleep', expression: 'sleepy', props: [] },
  'metaphysics:final-boss': { pose: 'stand', expression: 'stern', props: [p('scroll', 'must be')] },

  'mind-1:boss': { pose: 'shrug', expression: 'curious', props: [], body: 'dotted' },
  'mind-2:boss': { pose: 'stand', expression: 'curious', props: [p('crown'), p('letter')] },
  'mind-3:boss': { pose: 'stand', expression: 'smug', props: [p('brain')], note: 'The label gun is left out to keep the hand readable.' },
  'mind-4:boss': { pose: 'stand', expression: 'neutral', props: [], head: 'code', body: 'code' },
  'mind-5:boss': { pose: 'stand', expression: 'delighted', props: [p('labcoat'), p('scan')] },
  'mind-6:boss': { pose: 'stand', expression: 'neutral', props: [], head: 'blank-eyes' },
  'mind-7:boss': { pose: 'point', expression: 'smug', props: [p('cape', undefined, 'var(--grape)')] },
  'mind-8:boss': { pose: 'point', expression: 'delighted', props: [p('booth')] },
  'mind:final-boss': { pose: 'think', expression: 'curious', props: [p('tomato')] },

  'religion-1:boss': { pose: 'point', expression: 'stern', props: [p('boulder')] },
  'religion-2:boss': { pose: 'stand', expression: 'stern', props: [p('robe', undefined, 'var(--ink-soft)')], note: 'Plain robe only; no religious symbols.' },
  'religion-3:boss': { pose: 'point', expression: 'curious', props: [p('pocket-watch')] },
  'religion-4:boss': { pose: 'shrug', expression: 'delighted', props: [p('palm')] },
  'religion-5:boss': { pose: 'point', expression: 'stern', props: [] },
  'religion-6:boss': { pose: 'stand', expression: 'curious', props: [] },
  'religion-7:boss': { pose: 'stand', expression: 'conceding', props: [p('lantern')] },
  'religion-8:boss': { pose: 'point', expression: 'neutral', props: [], head: 'big-eyes' },
  'religion-9:boss': {
    pose: 'read',
    expression: 'curious',
    props: [p('book', 'Incoherence')],
    note: 'Respect rule: a historical religious figure gets only the neutral named prop (the book). The turban is left out pending owner decision.',
  },
  'religion:final-boss': { pose: 'stand', expression: 'neutral', props: [p('period-dress'), p('telescope')] },

  'religious-epistemology-1:boss': { pose: 'point', expression: 'stern', props: [p('wig')] },
  'religious-epistemology-2:boss': { pose: 'stand', expression: 'delighted', props: [p('hat', undefined, '#f39a4a')] },
  'religious-epistemology-3:boss': { pose: 'stand', expression: 'delighted', props: [p('glow')], head: 'closed-eyes' },
  'religious-epistemology-4:boss': { pose: 'shrug', expression: 'smug', props: [p('roulette')] },
  'religious-epistemology-5:boss': { pose: 'stand', expression: 'curious', props: [p('scan'), p('map')] },
  'religious-epistemology-6:boss': {
    pose: 'read',
    expression: 'stern',
    props: [p('gown'), p('book', 'Institutes')],
    note: 'Respect rule: the gown is plain, with no religious symbols.',
  },
  'religious-epistemology:final-boss': { pose: 'stand', expression: 'neutral', props: [p('book', undefined, 'var(--lilac)')] },

  'political-1:boss': { pose: 'think', expression: 'smug', props: [p('ring')] },
  'political-2:boss': {
    pose: 'stand',
    expression: 'stern',
    props: [p('crown'), p('sword')],
    scale: 1.25,
    note: 'Drawn larger. The crozier is left out under the respect rule, and the body of many small figures is simplified.',
  },
  'political-3:boss': { pose: 'stand', expression: 'stern', props: [], body: 'stone' },
  'political-4:boss': { pose: 'stand', expression: 'stern', props: [p('scroll')] },
  'political-5:boss': { pose: 'stand', expression: 'neutral', props: [p('abacus')] },
  'political-6:boss': { pose: 'point', expression: 'delighted', props: [p('ticket')] },
  'political-7:boss': { pose: 'read', expression: 'stern', props: [p('cap', undefined, 'var(--coral)'), p('book', 'Manifesto')] },
  'political-8:boss': { pose: 'point', expression: 'smug', props: [p('exam')] },
  'political-9:boss': { pose: 'stand', expression: 'sleepy', props: [p('desk'), p('stamp')] },
  'political-10:boss': { pose: 'arms-crossed', expression: 'smug', props: [p('lion-mask'), p('fox-tail')] },
  'political-11:boss': { pose: 'cheer', expression: 'delighted', props: [p('threads', 'family,mosque,town,flag')], note: 'The four ties are drawn as labelled tags, so no building or flag is drawn.' },
  'political-12:boss': { pose: 'point', expression: 'stern', props: [p('helmet'), p('trireme')] },
  'political-13:boss': { pose: 'stand', expression: 'neutral', props: [p('ballot-box'), p('book')] },
  'political:final-boss': { pose: 'arms-crossed', expression: 'smug', props: [p('shadows'), p('toga')] },
};
