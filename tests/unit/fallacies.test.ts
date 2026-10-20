import { afterEach, describe, expect, it } from 'vitest';
import { generator } from '../../src/engines/logic';
import { FALLACIES } from '../../src/engines/logic/banks';
import { availableFallacies, extractDiagnoses, fallacyFinderReady, setFallacyDiagnoses } from '../../src/engines/logic/fallacies';

// Placeholder lesson text, standing in for Logic 7: the real diagnoses come from the content pack.
const lesson = [
  { markdown: `## Errors of relevance\n\nIntro.\n\n### ${FALLACIES[0]!.name} (a long label)\n\nPlaceholder one. A second sentence.\n\n### Not a bank name\n\nIgnored.` },
  { markdown: `### ${FALLACIES[1]!.name}\n\nPlaceholder two, with a clause. More.\n\n### ${FALLACIES[2]!.name}\n\nPlaceholder three.\n\n### ${FALLACIES[3]!.name}\n\nPlaceholder four "quoted". Example.` },
];

describe('fallacy finder key from the content', () => {
  afterEach(() => setFallacyDiagnoses({}));

  it('takes the first sentence under each heading that begins with a bank name', () => {
    expect(extractDiagnoses(lesson)).toEqual({
      [FALLACIES[0]!.name]: 'Placeholder one.',
      [FALLACIES[1]!.name]: 'Placeholder two, with a clause.',
      [FALLACIES[2]!.name]: 'Placeholder three.',
      [FALLACIES[3]!.name]: 'Placeholder four "quoted".',
    });
  });

  it('is not offered until at least four diagnoses are known, then asks only about those', () => {
    setFallacyDiagnoses({});
    expect(fallacyFinderReady()).toBe(false);
    expect(generator('fallacy-finder').available?.()).toBe(false);
    setFallacyDiagnoses(extractDiagnoses(lesson));
    expect(fallacyFinderReady()).toBe(true);
    expect(availableFallacies()).toHaveLength(4);
    const item = generator('fallacy-finder').make(7);
    expect(item.type).toBe('choice');
    if (item.type === 'choice') expect(item.options.every((o) => /Placeholder/.test(o.text))).toBe(true);
  });

  it('keeps no diagnosis text in the code', () => {
    for (const f of FALLACIES) expect(Object.keys(f)).toEqual(['name', 'examples']);
  });
});
