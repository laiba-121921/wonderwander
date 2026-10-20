// Seeded randomness so a generated item can be reproduced, and a retry gets a new seed (BUILD_PLAN 11).
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  if (list.length === 0) throw new Error('pick from empty list');
  return list[Math.floor(rng() * list.length)]!;
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function sample<T>(rng: Rng, list: readonly T[], n: number): T[] {
  return shuffle(rng, list).slice(0, n);
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
