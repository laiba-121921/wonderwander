// PHASE_15_PLUS 7.4: the public repository must hold no curriculum text. The curriculum is private, so it cannot be
// compared directly; instead, fingerprints of it are published: hashes of selected seven word runs (winnowing, as in
// plagiarism checkers). A run of words cannot be recovered from its hash. Every copied passage of at least
// SHINGLE + WINDOW - 1 counted words contains a selected run, so any such passage in a public file is found.
// Runs made mostly of one and two letter tokens (formulas such as "p q p q") are not counted on either side.

export const SHINGLE = 7;
export const WINDOW = 12;
export const GUARANTEED_WORDS = SHINGLE + WINDOW - 1;

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const meaningful = (run: string[]) => run.filter((w) => w.length >= 3).length >= 5;

// 48 bits from two 32 bit FNV-1a hashes with different offsets, as 12 hex characters: accidental matches between
// unrelated text stay negligible across a whole repository.
function fnv(text: string, offset: number): number {
  let h = offset;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
export function hash(text: string): string {
  return fnv(text, 0x811c9dc5).toString(16).padStart(8, '0') + fnv(text, 0x01000193).toString(16).padStart(8, '0').slice(0, 4);
}

// One entry per run position; null where the run is not counted.
export function shingles(text: string): (string | null)[] {
  const w = words(text);
  const out: (string | null)[] = [];
  for (let i = 0; i + SHINGLE <= w.length; i++) {
    const run = w.slice(i, i + SHINGLE);
    out.push(meaningful(run) ? hash(run.join(' ')) : null);
  }
  return out;
}

// The smallest hash in every window of WINDOW consecutive counted runs (the rightmost on a tie).
export function fingerprints(text: string): Set<string> {
  const h = shingles(text).filter((x): x is string => x !== null);
  const picked = new Set<string>();
  if (h.length === 0) return picked;
  if (h.length < WINDOW) {
    picked.add(h.reduce((a, b) => (b <= a ? b : a)));
    return picked;
  }
  for (let i = 0; i + WINDOW <= h.length; i++) {
    let best = i;
    for (let j = i; j < i + WINDOW; j++) if (h[j]! <= h[best]!) best = j;
    picked.add(h[best]!);
  }
  return picked;
}

// The runs of a public file that match a fingerprint, as word positions.
export function matches(text: string, known: Set<string>): number[] {
  return shingles(text).flatMap((h, i) => (h !== null && known.has(h) ? [i] : []));
}

export const encode = (set: Set<string>) => [...set].sort().join('\n') + '\n';
export const decode = (text: string) => new Set(text.split('\n').filter(Boolean));
