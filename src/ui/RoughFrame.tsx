import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import rough from 'roughjs';

const generator = rough.generator();

// A rounded rectangle path inset by half the stroke so the outline is not clipped.
export function roundedRectPath(w: number, h: number, r: number, inset = 1): string {
  const x = inset;
  const y = inset;
  const width = w - inset * 2;
  const height = h - inset * 2;
  const rr = Math.max(0, Math.min(r, width / 2, height / 2));
  return [
    `M ${x + rr} ${y}`,
    `L ${x + width - rr} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + rr}`,
    `L ${x + width} ${y + height - rr}`,
    `Q ${x + width} ${y + height} ${x + width - rr} ${y + height}`,
    `L ${x + rr} ${y + height}`,
    `Q ${x} ${y + height} ${x} ${y + height - rr}`,
    `L ${x} ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    'Z',
  ].join(' ');
}

function useSize<T extends Element>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.round(r.width) === s.w && Math.round(r.height) === s.h ? s : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export interface RoughFrameProps {
  radius?: number | 'pill';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  seed?: number;
  dashed?: boolean;
  hatch?: boolean;
  sticker?: boolean;
  roughness?: number;
}

// Draws a hand-drawn outline that fills its positioned parent. Purely decorative.
export function RoughFrame({
  radius = 18,
  fill,
  stroke = 'var(--ink)',
  strokeWidth = 2,
  seed = 7,
  dashed = false,
  hatch = false,
  sticker = false,
  roughness = 1.2,
}: RoughFrameProps) {
  const [ref, { w, h }] = useSize<SVGSVGElement>();
  const paths = useMemo(() => {
    if (!w || !h) return [];
    const r = radius === 'pill' ? Math.min(w, h) / 2 : radius;
    const drawable = generator.path(roundedRectPath(w, h, r, strokeWidth), {
      roughness,
      bowing: 0.8,
      seed,
      stroke,
      strokeWidth,
      fill,
      fillStyle: hatch ? 'hachure' : 'solid',
      hachureGap: 6,
      fillWeight: 1,
      strokeLineDash: dashed ? [7, 6] : undefined,
      disableMultiStroke: dashed,
    });
    return generator.toPaths(drawable);
  }, [w, h, radius, fill, stroke, strokeWidth, seed, dashed, hatch, roughness]);

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      style={sticker ? { filter: 'drop-shadow(3px 3px 0 rgb(47 37 70 / 0.18))' } : undefined}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          style={{
            stroke: p.stroke,
            strokeWidth: p.strokeWidth,
            fill: p.fill ?? 'none',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: dashed && p.stroke !== fill ? '7 6' : undefined,
          }}
        />
      ))}
    </svg>
  );
}
