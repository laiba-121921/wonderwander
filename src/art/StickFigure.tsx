import type { ReactNode } from 'react';
import { PROPS, type PropKey, type PropSpec } from './props';

export const POSES = ['stand', 'point', 'arms-crossed', 'think', 'shrug', 'cheer', 'read', 'bow', 'sleep', 'listen'] as const;
export const EXPRESSIONS = ['neutral', 'smug', 'curious', 'stern', 'delighted', 'conceding', 'sleepy'] as const;
export type Pose = (typeof POSES)[number];
export type Expression = (typeof EXPRESSIONS)[number];
export type HeadStyle = 'face' | 'blindfold' | 'clock' | 'big-eyes' | 'blank-eyes' | 'closed-eyes' | 'code';
export type BodyStyle = 'ink' | 'dotted' | 'stone' | 'code';

export type Pt = [number, number];

export interface Skeleton {
  head: Pt;
  tilt: number;
  neck: Pt;
  shoulder: Pt;
  hip: Pt;
  armL: [Pt, Pt];
  armR: [Pt, Pt];
  legL: [Pt, Pt];
  legR: [Pt, Pt];
}

export const HEAD_R = 14; // a 28 px head at the default size
const W = 100;
const H = 140;

const standLegs = { legL: [[44, 106], [39, 128]] as [Pt, Pt], legR: [[56, 106], [61, 128]] as [Pt, Pt] };
const upright = { head: [50, 22] as Pt, tilt: 0, neck: [50, 36] as Pt, shoulder: [50, 46] as Pt, hip: [50, 84] as Pt };
const armDownL: [Pt, Pt] = [[40, 62], [37, 80]];
const armDownR: [Pt, Pt] = [[60, 62], [63, 80]];

export const SKELETONS: Record<Pose, Skeleton> = {
  stand: { ...upright, armL: armDownL, armR: armDownR, ...standLegs },
  point: { ...upright, tilt: -4, armL: armDownL, armR: [[67, 48], [87, 41]], ...standLegs },
  'arms-crossed': { ...upright, armL: [[37, 61], [62, 57]], armR: [[63, 63], [38, 59]], ...standLegs },
  think: { ...upright, tilt: -9, armL: [[39, 65], [57, 66]], armR: [[66, 60], [57, 39]], ...standLegs },
  // PHASE_15_PLUS 2.1: a hand cupped to the ear while dictation listens
  listen: { ...upright, tilt: 8, armL: armDownL, armR: [[69, 50], [66, 26]], ...standLegs },
  shrug: { ...upright, tilt: 7, armL: [[35, 56], [27, 44]], armR: [[65, 56], [73, 44]], ...standLegs },
  cheer: {
    ...upright,
    armL: [[38, 37], [29, 19]],
    armR: [[62, 37], [71, 19]],
    legL: [[42, 106], [33, 128]],
    legR: [[58, 106], [67, 128]],
  },
  read: { ...upright, head: [50, 24], tilt: 6, armL: [[39, 65], [45, 56]], armR: [[61, 65], [55, 56]], ...standLegs },
  bow: {
    head: [68, 43],
    tilt: 30,
    neck: [62, 53],
    shoulder: [59, 58],
    hip: [46, 86],
    armL: [[61, 74], [63, 88]],
    armR: [[65, 72], [70, 86]],
    legL: [[44, 107], [42, 128]],
    legR: [[49, 107], [53, 128]],
  },
  sleep: {
    head: [18, 112],
    tilt: -80,
    neck: [32, 114],
    shoulder: [36, 114],
    hip: [70, 117],
    armL: [[50, 119], [63, 121]],
    armR: [[48, 109], [61, 107]],
    legL: [[84, 116], [97, 118]],
    legR: [[84, 121], [97, 125]],
  },
};

// Small deterministic jitter so limbs wobble slightly, the same way on every render.
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function wobbly(a: Pt, b: Pt, j: number): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return `M ${a[0]} ${a[1]} Q ${mx - (dy / len) * j} ${my + (dx / len) * j} ${b[0]} ${b[1]}`;
}

function Face({ expression, style }: { expression: Expression; style: HeadStyle }) {
  const ink = { stroke: 'var(--ink)', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const };
  const dot = (x: number, y: number, r = 1.7) => <circle cx={x} cy={y} r={r} fill="var(--ink)" stroke="none" />;
  if (style === 'clock') {
    return (
      <g>
        <circle r={HEAD_R - 1} fill="var(--paper-raised)" stroke="none" />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M 0 -10 L 0 -8" {...ink} transform={`rotate(${a})`} />
        ))}
        <path d="M 0 0 L 0 -7 M 0 0 L 5 2" {...ink} />
      </g>
    );
  }
  if (style === 'code') {
    return (
      <text y="5" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="monospace" fill="var(--ink)">
        {'{;}'}
      </text>
    );
  }
  const mouths: Record<Expression, ReactNode> = {
    neutral: <path d="M -4 6 L 4 6" {...ink} />,
    smug: <path d="M -4 6 Q 1 9 6 4" {...ink} />,
    curious: <circle cx="0" cy="6.5" r="2" {...ink} />,
    stern: <path d="M -4 7 L 4 6" {...ink} />,
    delighted: <path d="M -6 4 Q 0 11 6 4" {...ink} />,
    conceding: <path d="M -4 7 Q -2 5 0 7 Q 2 9 4 7" {...ink} />,
    sleepy: <path d="M -2 7 L 2 7" {...ink} />,
  };
  let eyes: ReactNode;
  if (style === 'blindfold') {
    eyes = <path d="M -14 -3 Q 0 -6 14 -3 L 14 2 Q 0 -1 -14 2 Z" fill="var(--ink)" stroke="none" />;
  } else if (style === 'big-eyes') {
    eyes = (
      <>
        <circle cx="-5.5" cy="-2" r="4.5" fill="var(--paper-raised)" {...{ stroke: 'var(--ink)', strokeWidth: 1.8 }} />
        <circle cx="5.5" cy="-2" r="4.5" fill="var(--paper-raised)" {...{ stroke: 'var(--ink)', strokeWidth: 1.8 }} />
        {dot(-5.5, -2, 1.5)}
        {dot(5.5, -2, 1.5)}
      </>
    );
  } else if (style === 'blank-eyes') {
    eyes = (
      <>
        <circle cx="-5" cy="-2" r="2.6" {...ink} strokeWidth={1.6} />
        <circle cx="5" cy="-2" r="2.6" {...ink} strokeWidth={1.6} />
      </>
    );
  } else if (style === 'closed-eyes' || expression === 'sleepy') {
    eyes = <path d="M -8 -2 Q -5 1 -2 -2 M 2 -2 Q 5 1 8 -2" {...ink} />;
  } else if (expression === 'smug') {
    eyes = <path d="M -8 -2 L -3 -2 M 3 -2 L 8 -2" {...ink} />;
  } else if (expression === 'delighted') {
    eyes = <path d="M -8 -1 Q -5.5 -5 -3 -1 M 3 -1 Q 5.5 -5 8 -1" {...ink} />;
  } else {
    eyes = (
      <>
        {dot(-5, -2)}
        {dot(5, -2)}
      </>
    );
  }
  const brows: Partial<Record<Expression, ReactNode>> = {
    curious: <path d="M -8 -8 Q -5.5 -11 -3 -9 M 3 -7 L 8 -7" {...ink} />,
    stern: <path d="M -8 -8 L -3 -6 M 3 -6 L 8 -8" {...ink} />,
    conceding: <path d="M -8 -6 L -3 -8 M 3 -8 L 8 -6" {...ink} />,
  };
  return (
    <g>
      {style !== 'blindfold' && brows[expression]}
      {eyes}
      {mouths[expression]}
    </g>
  );
}

export interface StickFigureProps {
  pose?: Pose;
  expression?: Expression;
  props?: PropSpec[];
  head?: HeadStyle;
  body?: BodyStyle;
  colour?: string; // accent colour for props, usually the domain colour
  size?: number; // rendered height in px
  seed?: number;
  label?: string;
}

export function StickFigure({
  pose = 'stand',
  expression = 'neutral',
  props = [],
  head = 'face',
  body = 'ink',
  colour = 'var(--amber)',
  size = 140,
  seed = 1,
  label,
}: StickFigureProps) {
  const sk = SKELETONS[pose];
  const r = rng(seed);
  const j = () => (r() - 0.5) * 2.4;
  const line = {
    stroke: body === 'stone' ? 'var(--ink-soft)' : 'var(--ink)',
    strokeWidth: body === 'stone' ? 4 : 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
    strokeDasharray: body === 'dotted' ? '0.5 6' : body === 'code' ? '5 3' : undefined,
  };
  const segs: [Pt, Pt][] = [
    [sk.neck, sk.hip],
    [sk.shoulder, sk.armL[0]],
    [sk.armL[0], sk.armL[1]],
    [sk.shoulder, sk.armR[0]],
    [sk.armR[0], sk.armR[1]],
    [sk.hip, sk.legL[0]],
    [sk.legL[0], sk.legL[1]],
    [sk.hip, sk.legR[0]],
    [sk.legR[0], sk.legR[1]],
  ];
  const ctx = { sk, colour };
  const layer = (where: 'back' | 'body' | 'front') =>
    props.filter((p) => PROPS[p.key as PropKey].layer === where).map((p, i) => <g key={`${p.key}-${i}`}>{PROPS[p.key as PropKey].draw(ctx, p)}</g>);

  return (
    <svg
      width={(size * W) / H}
      height={size}
      viewBox={`-10 -10 ${W + 20} ${H + 12}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      overflow="visible"
    >
      {layer('back')}
      {segs.map(([a, b], i) => (
        <path key={i} d={wobbly(a, b, j())} {...line} />
      ))}
      {layer('body')}
      <g transform={`translate(${sk.head[0]} ${sk.head[1]}) rotate(${sk.tilt})`}>
        <circle
          r={HEAD_R}
          {...line}
          fill={body === 'stone' ? 'var(--paper)' : 'var(--paper-raised)'}
          strokeDasharray={body === 'dotted' ? '0.5 6' : undefined}
        />
        <Face expression={expression} style={head} />
      </g>
      {layer('front')}
      {pose === 'sleep' && (
        <text x="30" y="88" fontSize="13" fontWeight="700" fill="var(--ink-soft)">
          z z
        </text>
      )}
    </svg>
  );
}
