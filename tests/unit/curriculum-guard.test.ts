import { describe, expect, it } from 'vitest';
import { fingerprints, GUARANTEED_WORDS, matches, words } from '../../scripts/curriculum-guard';

// Made-up everyday text standing in for a private document.
const privateText = Array.from({ length: 40 }, (_, i) => `On morning number ${i} the baker opened the shutters early, swept the step outside, and counted twelve warm loaves.`).join(' ');
const known = fingerprints(privateText);

describe('curriculum guard (PHASE_15_PLUS 7.4)', () => {
  it('finds any copied run of the guaranteed length, wherever it starts', () => {
    const w = words(privateText);
    for (let start = 0; start + GUARANTEED_WORDS <= w.length; start += 13) {
      const copied = `const note = '${w.slice(start, start + GUARANTEED_WORDS).join(' ')}';`;
      expect(matches(copied, known).length, `from word ${start}`).toBeGreaterThan(0);
    }
  });

  it('ignores unrelated text and formulas', () => {
    expect(matches('The bus timetable changed in spring, so the evening service now leaves the square at a quarter past six.', known)).toEqual([]);
    expect(fingerprints('p q p q r p q p q r p q p q').size).toBe(0);
  });

  it('publishes hashes, never words', () => {
    for (const f of known) expect(f).toMatch(/^[0-9a-f]{12}$/);
  });
});
