import { useMemo } from 'react';

const COLOURS = ['var(--amber)', 'var(--bubblegum)', 'var(--lilac)', 'var(--mint)', 'var(--sky)', 'var(--butter)', 'var(--peach)'];

function seeded(seed: number) {
  const state = { s: seed };
  return () => (state.s = (state.s * 16807) % 2147483647) / 2147483647;
}

// A burst in the palette colours (BUILD_PLAN 19.7). The caller skips it under prefers-reduced-motion.
export function Confetti({ big = false }: { big?: boolean }) {
  const bits = useMemo(() => {
    const r = seeded(big ? 97 : 41);
    return Array.from({ length: big ? 90 : 48 }, (_, i) => ({ left: r() * 100, delay: r() * 0.6, dur: 1.8 + r() * 1.6, size: 6 + r() * 7, colour: COLOURS[i % COLOURS.length]!, round: r() > 0.5, drift: (r() - 0.5) * 120 }));
  }, [big]);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" role="status" aria-label="Unit passed">
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit absolute -top-4"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.round ? b.size : b.size * 0.5,
            background: b.colour,
            borderRadius: b.round ? '50%' : 2,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            ['--drift' as string]: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
