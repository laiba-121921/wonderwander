import { BOSS_ART } from './bossArt';
import { StickFigure, type Expression, type Pose } from './StickFigure';

export interface BossFigureProps {
  bossId: string;
  colour: string;
  size?: number;
  expression?: Expression; // the fight screen overrides it from the turn meta
  pose?: Pose;
  label?: string;
}

export function BossFigure({ bossId, colour, size = 140, expression, pose, label }: BossFigureProps) {
  const art = BOSS_ART[bossId] ?? { pose: 'stand', expression: 'neutral', props: [] };
  let seed = 0;
  for (const ch of bossId) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  return (
    <StickFigure
      pose={pose ?? art.pose}
      expression={expression ?? art.expression}
      props={art.props}
      head={art.head}
      body={art.body}
      colour={colour}
      size={size * (art.scale ?? 1)}
      seed={seed}
      label={label}
    />
  );
}
