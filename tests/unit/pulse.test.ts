import { describe, expect, it } from 'vitest';
import { updateWrong } from '../../src/features/today/PulseScreen';
import { greeting } from '../../src/features/today/TodayScreen';

describe('pulse weighting', () => {
  it('raises a generator after a wrong answer, up to three, and eases it after a right one', () => {
    let w = {};
    for (let i = 0; i < 5; i++) w = updateWrong(w, 'truth-table', false);
    expect(w).toEqual({ 'truth-table': 3 });
    expect(updateWrong(w, 'truth-table', true)).toEqual({ 'truth-table': 2 });
    expect(updateWrong({}, 'translator', true)).toEqual({ translator: 0 });
  });
});

describe('greeting (BUILD_PLAN 19.8)', () => {
  it('says morning before noon and evening after', () => {
    expect(greeting(7, 'Laiba')).toBe('Morning, Laiba');
    expect(greeting(15, 'Laiba')).toBe('Evening, Laiba');
    expect(greeting(7)).toBe('Morning'); // before the profile loads, no one else's name
  });
});
