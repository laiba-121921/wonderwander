import type { ReactNode } from 'react';
import type { Pt, Skeleton } from './StickFigure';

export interface PropSpec {
  key: PropKey;
  label?: string; // text on signs, books, boxes and tags
  colour?: string; // overrides the figure's accent colour
}

interface Ctx {
  sk: Skeleton;
  colour: string;
}

interface PropDef {
  layer: 'back' | 'body' | 'front';
  draw: (ctx: Ctx, spec: PropSpec) => ReactNode;
}

const ink = { stroke: 'var(--ink)', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const hand = (sk: Skeleton, side: 'L' | 'R') => (side === 'L' ? sk.armL[1] : sk.armR[1]);
const top = (sk: Skeleton): Pt => [sk.head[0], sk.head[1] - 14];
const chest = (sk: Skeleton): Pt => [(sk.shoulder[0] + sk.hip[0]) / 2, (sk.shoulder[1] + sk.hip[1]) / 2];

// Half the width of a sign board, sized to its label.
const half = (s: PropSpec) => Math.max(20, (s.label?.length ?? 0) * 2.9 + 6);

function Label({ x, y, text, size = 6.5 }: { x: number; y: number; text: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight="600" fill="var(--ink)" style={{ fontFamily: 'var(--font-ui)' }}>
      {text}
    </text>
  );
}

function robe(sk: Skeleton, fill: string, length = 24, flare = 18): ReactNode {
  const [sx, sy] = sk.shoulder;
  const [hx, hy] = sk.hip;
  return <path d={`M ${sx - 7} ${sy} L ${sx + 7} ${sy} L ${hx + flare} ${hy + length} L ${hx - flare} ${hy + length} Z`} fill={fill} {...ink} />;
}

export const PROPS = {
  toga: {
    layer: 'body',
    draw: ({ sk, colour }, s) => {
      const [sx, sy] = sk.shoulder;
      const [hx, hy] = sk.hip;
      return (
        <path
          d={`M ${sx - 8} ${sy - 2} L ${sx + 6} ${sy} L ${hx + 14} ${hy + 16} L ${hx - 12} ${hy + 18} Z M ${sx - 8} ${sy - 2} L ${hx + 14} ${hy + 16}`}
          fill={s.colour ?? colour}
          fillOpacity={0.85}
          {...ink}
        />
      );
    },
  },
  robe: { layer: 'body', draw: ({ sk, colour }, s) => robe(sk, s.colour ?? colour) },
  gown: { layer: 'body', draw: ({ sk }, s) => robe(sk, s.colour ?? 'var(--ink-soft)', 28, 20) },
  labcoat: {
    layer: 'body',
    draw: ({ sk }) => (
      <>
        {robe(sk, 'var(--paper-raised)', 14, 14)}
        <path d={`M ${sk.shoulder[0] - 6} ${sk.shoulder[1]} L ${sk.shoulder[0]} ${sk.shoulder[1] + 14} L ${sk.shoulder[0] + 6} ${sk.shoulder[1]}`} fill="none" {...ink} />
      </>
    ),
  },
  'period-dress': {
    layer: 'body',
    draw: ({ sk, colour }, s) => (
      <>
        {robe(sk, s.colour ?? colour, 12, 12)}
        <path d={`M ${sk.neck[0] - 5} ${sk.neck[1] + 2} Q ${sk.neck[0]} ${sk.neck[1] + 9} ${sk.neck[0] + 5} ${sk.neck[1] + 2}`} fill="var(--paper-raised)" {...ink} />
      </>
    ),
  },
  cape: {
    layer: 'back',
    draw: ({ sk, colour }, s) => {
      const [sx, sy] = sk.shoulder;
      return <path d={`M ${sx - 9} ${sy - 2} L ${sx + 9} ${sy - 2} L ${sx + 24} ${sk.hip[1] + 30} Q ${sx} ${sk.hip[1] + 36} ${sx - 24} ${sk.hip[1] + 30} Z`} fill={s.colour ?? colour} {...ink} />;
    },
  },
  horns: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = top(sk);
      return <path d={`M ${x - 9} ${y + 3} L ${x - 11} ${y - 7} L ${x - 4} ${y + 1} M ${x + 9} ${y + 3} L ${x + 11} ${y - 7} L ${x + 4} ${y + 1}`} fill="var(--coral)" {...ink} />;
    },
  },
  crown: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = top(sk);
      return <path d={`M ${x - 10} ${y + 3} L ${x - 10} ${y - 8} L ${x - 5} ${y - 2} L ${x} ${y - 10} L ${x + 5} ${y - 2} L ${x + 10} ${y - 8} L ${x + 10} ${y + 3} Z`} fill="var(--amber)" {...ink} />;
    },
  },
  wig: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = sk.head;
      const curls: Pt[] = [[-13, -6], [-8, -12], [0, -14], [8, -12], [13, -6], [-15, 2], [15, 2], [-15, 9], [15, 9]];
      return (
        <>
          {curls.map(([dx, dy], i) => (
            <circle key={i} cx={x + dx} cy={y + dy} r={4.2} fill="var(--paper-raised)" {...ink} strokeWidth={1.5} />
          ))}
        </>
      );
    },
  },
  cap: {
    layer: 'front',
    draw: ({ sk, colour }, s) => {
      const [x, y] = top(sk);
      return <path d={`M ${x - 13} ${y + 6} Q ${x - 12} ${y - 6} ${x} ${y - 6} Q ${x + 12} ${y - 6} ${x + 13} ${y + 6} L ${x + 21} ${y + 7} L ${x - 13} ${y + 6} Z`} fill={s.colour ?? colour} {...ink} />;
    },
  },
  hat: {
    layer: 'front',
    draw: ({ sk, colour }, s) => {
      const [x, y] = top(sk);
      return (
        <>
          <path d={`M ${x - 17} ${y + 4} L ${x + 17} ${y + 4}`} {...ink} strokeWidth={3} />
          <path d={`M ${x - 10} ${y + 4} L ${x - 9} ${y - 12} L ${x + 9} ${y - 12} L ${x + 10} ${y + 4} Z`} fill={s.colour ?? colour} {...ink} />
        </>
      );
    },
  },
  helmet: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = sk.head;
      return (
        <>
          <path d={`M ${x - 15} ${y + 2} Q ${x - 15} ${y - 16} ${x} ${y - 16} Q ${x + 15} ${y - 16} ${x + 15} ${y + 2} L ${x + 9} ${y + 2} L ${x + 9} ${y + 8} L ${x - 15} ${y + 8} Z`} fill="#c98a3e" {...ink} />
          <path d={`M ${x - 6} ${y - 16} Q ${x} ${y - 30} ${x + 14} ${y - 22}`} fill="none" stroke="var(--coral)" strokeWidth={4} strokeLinecap="round" />
        </>
      );
    },
  },
  'lion-mask': {
    layer: 'body',
    draw: ({ sk }) => {
      const [x, y] = sk.head;
      return <circle cx={x} cy={y} r={21} fill="var(--amber)" fillOpacity={0.75} {...ink} strokeDasharray="3 2" />;
    },
  },
  'fox-tail': {
    layer: 'back',
    draw: ({ sk }) => {
      const [x, y] = sk.hip;
      return <path d={`M ${x} ${y} Q ${x - 20} ${y + 8} ${x - 26} ${y - 8} Q ${x - 16} ${y - 2} ${x} ${y} Z`} fill="var(--peach)" {...ink} />;
    },
  },
  glow: {
    layer: 'back',
    draw: ({ sk }) => <circle cx={sk.head[0]} cy={sk.head[1] + 30} r={52} fill="var(--amber)" opacity={0.18} />,
  },
  shadows: {
    layer: 'back',
    draw: () => (
      <g opacity={0.3} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" fill="none">
        {[8, 30, 70, 92].map((x, i) => (
          <g key={i} transform={`translate(${x} ${i % 2 ? 50 : 56}) scale(0.5)`}>
            <circle cx="0" cy="-20" r="11" fill="var(--paper)" />
            <path d="M 0 -9 L 0 30 M 0 0 L -12 18 M 0 0 L 12 18 M 0 30 L -9 55 M 0 30 L 9 55" />
          </g>
        ))}
      </g>
    ),
  },
  lantern: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <circle cx={x} cy={y + 15} r={14} fill="var(--amber)" opacity={0.3} />
          <path d={`M ${x} ${y} L ${x} ${y + 5}`} {...ink} />
          <path d={`M ${x - 5} ${y + 5} L ${x + 5} ${y + 5} L ${x + 6} ${y + 20} L ${x - 6} ${y + 20} Z`} fill="var(--butter)" {...ink} />
          <path d={`M ${x} ${y + 9} Q ${x - 2} ${y + 13} ${x} ${y + 16} Q ${x + 2} ${y + 13} ${x} ${y + 9} Z`} fill="var(--amber)" stroke="none" />
        </>
      );
    },
  },
  mirror: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x} ${y} L ${x + 2} ${y - 8}`} {...ink} strokeWidth={3} />
          <ellipse cx={x + 4} cy={y - 18} rx={8} ry={11} fill="var(--sky)" fillOpacity={0.6} {...ink} />
          <path d={`M ${x + 1} ${y - 24} L ${x + 4} ${y - 19}`} stroke="var(--paper-raised)" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    },
  },
  scroll: {
    layer: 'front',
    draw: ({ sk }, s) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x - 3} ${y - 22} L ${x + 15} ${y - 22} L ${x + 15} ${y + 4} L ${x - 3} ${y + 4} Z`} fill="var(--paper-raised)" {...ink} />
          <path d={`M ${x - 5} ${y - 22} L ${x + 17} ${y - 22} M ${x - 5} ${y + 4} L ${x + 17} ${y + 4}`} {...ink} strokeWidth={3.5} />
          {s.label ? <Label x={x + 6} y={y - 7} text={s.label} size={5} /> : <path d={`M ${x + 1} ${y - 15} L ${x + 11} ${y - 15} M ${x + 1} ${y - 9} L ${x + 11} ${y - 9} M ${x + 1} ${y - 3} L ${x + 8} ${y - 3}`} {...ink} strokeWidth={1.2} />}
        </>
      );
    },
  },
  tomato: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <circle cx={x + 2} cy={y - 5} r={6.5} fill="var(--coral)" {...ink} />
          <path d={`M ${x - 1} ${y - 11} L ${x + 2} ${y - 9} L ${x + 5} ${y - 12}`} fill="none" stroke="#5a9e5a" strokeWidth={2} strokeLinecap="round" />
        </>
      );
    },
  },
  telescope: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = chest(sk);
      return <path d={`M ${x - 26} ${y + 6} L ${x + 14} ${y - 6} L ${x + 15} ${y + 1} L ${x - 25} ${y + 12} Z`} fill="#c98a3e" {...ink} />;
    },
  },
  book: {
    layer: 'front',
    draw: ({ sk, colour }, s) => {
      const [x, y] = hand(sk, 'L');
      return (
        <>
          {/* held below the hand so it never covers the face; the title is too small to letter legibly */}
          <path d={`M ${x - 9} ${y - 3} L ${x + 6} ${y - 3} L ${x + 6} ${y + 15} L ${x - 9} ${y + 15} Z`} fill={s.colour ?? colour} {...ink} />
          <path d={`M ${x - 6} ${y - 3} L ${x - 6} ${y + 15}`} {...ink} strokeWidth={1.3} />
          {s.label && <title>{s.label}</title>}
        </>
      );
    },
  },
  ring: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'L');
      return <circle cx={x} cy={y + 1} r={3.2} fill="none" stroke="var(--amber)" strokeWidth={2.5} />;
    },
  },
  jar: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'L');
      return (
        <>
          <path d={`M ${x - 10} ${y - 18} L ${x + 6} ${y - 18} L ${x + 7} ${y + 4} Q ${x - 2} ${y + 7} ${x - 11} ${y + 4} Z`} fill="var(--sky)" fillOpacity={0.45} {...ink} />
          <path d={`M ${x - 11} ${y - 21} L ${x + 7} ${y - 21}`} {...ink} strokeWidth={3.5} />
        </>
      );
    },
  },
  boulder: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return <path d={`M ${x - 2} ${y + 8} Q ${x - 4} ${y - 14} ${x + 14} ${y - 18} Q ${x + 32} ${y - 16} ${x + 30} ${y + 6} Q ${x + 28} ${y + 50} ${x + 6} ${y + 46} Q ${x - 6} ${y + 30} ${x - 2} ${y + 8} Z`} fill="var(--ink-soft)" fillOpacity={0.35} {...ink} />;
    },
  },
  letter: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return <path d={`M ${x - 2} ${y - 10} L ${x + 14} ${y - 10} L ${x + 14} ${y + 1} L ${x - 2} ${y + 1} Z M ${x - 2} ${y - 10} L ${x + 6} ${y - 4} L ${x + 14} ${y - 10}`} fill="var(--paper-raised)" {...ink} />;
    },
  },
  coin: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <ellipse cx={x + 2} cy={y - 18} rx={5} ry={2.5} fill="var(--amber)" {...ink} />
          <path d={`M ${x - 4} ${y - 9} Q ${x - 6} ${y - 14} ${x - 4} ${y - 19} M ${x + 8} ${y - 9} Q ${x + 10} ${y - 14} ${x + 8} ${y - 19}`} fill="none" {...ink} strokeWidth={1.3} />
        </>
      );
    },
  },
  tape: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <circle cx={x + 3} cy={y - 3} r={7} fill="var(--butter)" {...ink} />
          <circle cx={x + 3} cy={y - 3} r={3} fill="var(--paper)" {...ink} strokeWidth={1.5} />
          <path d={`M ${x + 10} ${y - 3} L ${x + 18} ${y + 6}`} stroke="var(--butter)" strokeWidth={3} />
        </>
      );
    },
  },
  sign: {
    layer: 'front',
    draw: ({ sk }, s) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x} ${y + 6} L ${x} ${y - 30}`} {...ink} strokeWidth={2.5} />
          <path d={`M ${x - half(s)} ${y - 50} L ${x + half(s)} ${y - 50} L ${x + half(s)} ${y - 28} L ${x - half(s)} ${y - 28} Z`} fill="var(--paper-raised)" {...ink} />
          {s.label && <Label x={x} y={y - 36} text={s.label} size={10} />}
        </>
      );
    },
  },
  hammer: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x} ${y + 6} L ${x + 2} ${y - 16}`} stroke="#a0703a" strokeWidth={3.5} strokeLinecap="round" />
          <path d={`M ${x - 6} ${y - 21} L ${x + 10} ${y - 19} L ${x + 10} ${y - 13} L ${x - 6} ${y - 15} Z`} fill="var(--ink-soft)" {...ink} />
        </>
      );
    },
  },
  plank: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'L');
      return <path d={`M ${x - 22} ${y + 2} L ${x + 4} ${y - 4} L ${x + 5} ${y + 1} L ${x - 21} ${y + 7} Z`} fill="#d9a066" {...ink} />;
    },
  },
  chart: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x - 2} ${y - 26} L ${x + 22} ${y - 26} L ${x + 22} ${y - 4} L ${x - 2} ${y - 4} Z`} fill="var(--paper-raised)" {...ink} />
          <path d={`M ${x + 3} ${y - 8} L ${x + 3} ${y - 13} M ${x + 9} ${y - 8} L ${x + 9} ${y - 17} M ${x + 15} ${y - 8} L ${x + 15} ${y - 21}`} stroke="var(--grape)" strokeWidth={3} strokeLinecap="round" />
        </>
      );
    },
  },
  brain: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return <path d={`M ${x - 4} ${y - 4} Q ${x - 7} ${y - 13} ${x + 1} ${y - 14} Q ${x + 5} ${y - 19} ${x + 10} ${y - 14} Q ${x + 17} ${y - 12} ${x + 14} ${y - 4} Q ${x + 12} ${y + 1} ${x + 5} ${y} Q ${x - 2} ${y + 2} ${x - 4} ${y - 4} Z M ${x + 5} ${y - 14} Q ${x + 3} ${y - 8} ${x + 6} ${y - 2}`} fill="var(--bubblegum)" {...ink} />;
    },
  },
  scan: {
    layer: 'front',
    draw: ({ sk }, s) => {
      const [x, y] = hand(sk, s.label === 'left' ? 'L' : 'R');
      return (
        <>
          <path d={`M ${x - 2} ${y - 22} L ${x + 18} ${y - 22} L ${x + 18} ${y - 2} L ${x - 2} ${y - 2} Z`} fill="var(--ink)" fillOpacity={0.85} {...ink} />
          <ellipse cx={x + 8} cy={y - 12} rx={6} ry={5} fill="none" stroke="var(--sky)" strokeWidth={1.5} />
        </>
      );
    },
  },
  map: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'L');
      return (
        <>
          <path d={`M ${x - 20} ${y - 20} L ${x + 2} ${y - 20} L ${x + 2} ${y} L ${x - 20} ${y} Z`} fill="var(--sky)" fillOpacity={0.5} {...ink} />
          <path d={`M ${x - 16} ${y - 15} q 4 -2 6 2 q -3 4 -6 -2 Z M ${x - 7} ${y - 8} q 5 -3 7 1 q -2 5 -7 -1 Z`} fill="var(--pistachio)" stroke="var(--ink)" strokeWidth={1} />
        </>
      );
    },
  },
  booth: {
    layer: 'back',
    draw: () => (
      <>
        <path d="M -8 18 L 18 18 L 18 128 L -8 128 Z" fill="var(--sky)" fillOpacity={0.4} {...ink} />
        <path d="M -2 26 L 12 26 L 12 120 L -2 120 Z" fill="none" {...ink} strokeDasharray="3 3" />
      </>
    ),
  },
  'pocket-watch': {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x} ${y} L ${x + 1} ${y - 7}`} {...ink} strokeWidth={1.2} strokeDasharray="1.5 1.5" />
          <circle cx={x + 1} cy={y - 13} r={6} fill="var(--butter)" {...ink} />
          <path d={`M ${x + 1} ${y - 13} L ${x + 1} ${y - 17} M ${x + 1} ${y - 13} L ${x + 4} ${y - 12}`} {...ink} strokeWidth={1.2} />
        </>
      );
    },
  },
  palm: {
    layer: 'back',
    draw: () => (
      <>
        <path d="M -8 130 Q 50 122 108 130" fill="none" stroke="var(--amber)" strokeWidth={3} strokeLinecap="round" />
        <path d="M 92 128 Q 88 96 96 66" fill="none" stroke="#a0703a" strokeWidth={4} strokeLinecap="round" />
        <path d="M 96 66 Q 80 58 72 70 M 96 66 Q 108 52 116 62 M 96 66 Q 92 50 82 52 M 96 66 Q 112 66 114 78" fill="none" stroke="#5a9e5a" strokeWidth={3.5} strokeLinecap="round" />
      </>
    ),
  },
  roulette: {
    layer: 'back',
    draw: () => (
      <>
        <path d="M 96 128 L 96 100" {...ink} strokeWidth={3} />
        <circle cx="96" cy="84" r="17" fill="var(--paper-raised)" {...ink} />
        {[0, 45, 90, 135].map((a) => (
          <path key={a} d="M 96 67 L 96 101" {...ink} strokeWidth={1.2} transform={`rotate(${a} 96 84)`} />
        ))}
        <circle cx="96" cy="84" r="5" fill="var(--coral)" {...ink} strokeWidth={1.5} />
      </>
    ),
  },
  abacus: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = chest(sk);
      return (
        <>
          <path d={`M ${x - 11} ${y - 12} L ${x + 11} ${y - 12} L ${x + 11} ${y + 8} L ${x - 11} ${y + 8} Z`} fill="var(--paper-raised)" {...ink} />
          {[-6, 0, 6].map((dy) => (
            <g key={dy}>
              <path d={`M ${x - 11} ${y - 2 + dy} L ${x + 11} ${y - 2 + dy}`} {...ink} strokeWidth={1} />
              {[-6, -2, 4].map((dx) => (
                <circle key={dx} cx={x + dx + (dy % 4)} cy={y - 2 + dy} r={1.8} fill="var(--coral)" stroke="none" />
              ))}
            </g>
          ))}
        </>
      );
    },
  },
  ticket: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x - 2} ${y - 12} L ${x + 18} ${y - 12} L ${x + 18} ${y - 8} Q ${x + 15} ${y - 6} ${x + 18} ${y - 4} L ${x + 18} ${y} L ${x - 2} ${y} Z`} fill="var(--butter)" {...ink} />
          <Label x={x + 8} y={y - 4} text="25c" size={5} />
        </>
      );
    },
  },
  exam: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x - 2} ${y - 24} L ${x + 16} ${y - 24} L ${x + 16} ${y} L ${x - 2} ${y} Z`} fill="var(--paper-raised)" {...ink} />
          <path d={`M ${x + 2} ${y - 18} L ${x + 12} ${y - 18} M ${x + 2} ${y - 13} L ${x + 12} ${y - 13} M ${x + 2} ${y - 8} L ${x + 8} ${y - 8}`} {...ink} strokeWidth={1.2} />
          <path d={`M ${x + 8} ${y - 5} L ${x + 10} ${y - 2} L ${x + 15} ${y - 9}`} fill="none" stroke="var(--coral)" strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    },
  },
  desk: {
    layer: 'front',
    draw: () => (
      <>
        <path d="M 10 92 L 92 92 L 92 128 M 10 92 L 10 128" fill="none" {...ink} strokeWidth={3} />
        <path d="M 10 92 L 92 92 L 90 100 L 12 100 Z" fill="#d9a066" {...ink} />
        <path d="M 18 92 L 18 76 L 36 76 L 36 92 M 20 82 L 34 82 M 20 87 L 34 87" fill="var(--paper-raised)" {...ink} strokeWidth={1.5} />
      </>
    ),
  },
  stamp: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return <path d={`M ${x} ${y} L ${x} ${y + 6} M ${x - 6} ${y + 6} L ${x + 6} ${y + 6} L ${x + 6} ${y + 10} L ${x - 6} ${y + 10} Z`} fill="var(--coral)" {...ink} />;
    },
  },
  threads: {
    layer: 'back',
    draw: ({ sk }, s) => {
      const tags = (s.label ?? 'family,mosque,town,flag').split(',');
      const spots: Pt[] = [[-4, 50], [104, 50], [-4, 104], [104, 104]];
      const from = [sk.armL[1], sk.armR[1], sk.legL[0], sk.legR[0]];
      return (
        <>
          {tags.map((t, i) => {
            const [tx, ty] = spots[i]!;
            const [fx, fy] = from[i]!;
            return (
              <g key={t}>
                <path d={`M ${fx} ${fy} Q ${(fx + tx) / 2} ${(fy + ty) / 2 + 8} ${tx} ${ty}`} fill="none" stroke="var(--grape)" strokeWidth={1.3} strokeDasharray="2 2" />
                <rect x={tx - 18} y={ty - 7} width={36} height={14} rx={3} fill="var(--paper-raised)" {...ink} strokeWidth={1.3} />
                <Label x={tx} y={ty + 2.5} text={t} size={7.5} />
              </g>
            );
          })}
        </>
      );
    },
  },
  'ballot-box': {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return (
        <>
          <path d={`M ${x - 6} ${y - 14} L ${x + 14} ${y - 14} L ${x + 14} ${y + 4} L ${x - 6} ${y + 4} Z`} fill="var(--sky)" {...ink} />
          <path d={`M ${x} ${y - 14} L ${x + 8} ${y - 14}`} stroke="var(--ink)" strokeWidth={3} />
        </>
      );
    },
  },
  sword: {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'R');
      return <path d={`M ${x} ${y} L ${x + 6} ${y - 34} M ${x - 5} ${y - 4} L ${x + 6} ${y - 2}`} stroke="var(--ink-soft)" strokeWidth={3} strokeLinecap="round" fill="none" />;
    },
  },
  box: {
    layer: 'front',
    draw: ({ sk }, s) => {
      const [x, y] = hand(sk, 'L');
      return (
        <>
          <path d={`M ${x - 40} ${y - 12} L ${x + 6} ${y - 12} L ${x + 6} ${y + 10} L ${x - 40} ${y + 10} Z`} fill="#d9a066" {...ink} />
          {s.label && <Label x={x - 17} y={y + 2} text={s.label} size={7.5} />}
        </>
      );
    },
  },
  'fallacy-list': {
    layer: 'front',
    draw: ({ sk }) => {
      const [x, y] = hand(sk, 'L');
      return (
        <>
          <path d={`M ${x - 7} ${y - 2} L ${x + 5} ${y - 2} L ${x + 5} ${y + 26} L ${x - 7} ${y + 26} Z`} fill="var(--paper-raised)" {...ink} />
          <path d={`M ${x - 4} ${y + 4} L ${x + 2} ${y + 4} M ${x - 4} ${y + 9} L ${x + 2} ${y + 9} M ${x - 4} ${y + 14} L ${x + 2} ${y + 14} M ${x - 4} ${y + 19} L ${x + 2} ${y + 19}`} {...ink} strokeWidth={1} />
        </>
      );
    },
  },
  trireme: {
    layer: 'back',
    draw: () => (
      <>
        <path d="M -8 128 L 108 128 Q 104 140 92 140 L 6 140 Q -4 140 -8 128 Z" fill="#c98a3e" {...ink} />
        <path d="M -8 128 Q -14 118 -6 112" fill="none" {...ink} strokeWidth={3} />
      </>
    ),
  },
} satisfies Record<string, PropDef>;

export type PropKey = keyof typeof PROPS;
export const PROP_KEYS = Object.keys(PROPS) as PropKey[];
