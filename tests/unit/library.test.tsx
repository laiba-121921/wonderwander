import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampFont, readPref, writePref } from '../../src/lib/prefs';
import { findPassage } from '../../src/features/library/ReaderScreen';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('reader preferences', () => {
  it('keeps the font size between 16 and 22', () => {
    expect(clampFont(12)).toBe(16);
    expect(clampFont(19.4)).toBe(19);
    expect(clampFont(40)).toBe(22);
  });

  it('round-trips a value', () => {
    writePref('reader.font', 20);
    expect(readPref('reader.font', 18)).toBe(20);
  });

  it('falls back quietly when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writePref('x', 1)).not.toThrow();
    expect(readPref('x', 7)).toBe(7);
  });
});

describe('jump to the passage', () => {
  it('finds the paragraph by its opening words, ignoring punctuation and case', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Unrelated.</p><p>PHILO: Is he willing to prevent evil, but not able? then is he impotent.</p>';
    expect(findPassage(div, 'Is he willing to prevent evil, but not able?')?.textContent).toMatch(/^PHILO/);
    expect(findPassage(div, 'Nothing like this')).toBeNull();
  });
});
