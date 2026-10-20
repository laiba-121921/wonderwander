import { describe, expect, it } from 'vitest';
import { extract, stripGutenberg, toMarkdown } from '../../scripts/fetch-texts';

const BOOK = [
  'The Project Gutenberg eBook of Things',
  '*** START OF THE PROJECT GUTENBERG EBOOK THINGS ***',
  'CONTENTS',
  'PART I',
  'PART II',
  '',
  'PART I',
  '',
  'First paragraph is wrapped',
  'across two lines.',
  '',
  'PART II',
  '',
  'Second -- with a dash and _emphasis_.',
  '*** END OF THE PROJECT GUTENBERG EBOOK THINGS ***',
  'licence text',
].join('\r\n');

describe('Gutenberg bundling', () => {
  it('strips the header and footer', () => {
    const body = stripGutenberg(BOOK);
    expect(body).not.toMatch(/PROJECT GUTENBERG|licence/);
    expect(body).toContain('First paragraph');
  });

  it('extracts between markers, skipping the contents list by occurrence', () => {
    const { text, errors } = extract(stripGutenberg(BOOK), [{ start: { text: 'PART I', occurrence: 2 }, end: { text: 'PART II' } }]);
    expect(errors).toEqual([]);
    expect(text).toContain('First paragraph');
    expect(text).not.toContain('Second');
  });

  it('reports a missing marker instead of guessing', () => {
    expect(extract('a\nb', [{ start: { text: 'PART IX' } }]).errors).toHaveLength(1);
  });

  it('treats two-em dashes as dashes, tildes as emphasis, and drops margin numbers', () => {
    const { markdown } = toMarkdown('I think \u2e3a therefore ~I am~\n164\nso it goes.');
    expect(markdown.trim()).toBe('I think, therefore *I am* so it goes.');
  });

  it('does not double punctuation when a dash follows a semicolon', () => {
    expect(toMarkdown('it stands for;--which is all.').markdown.trim()).toBe('it stands for; which is all.');
    expect(toMarkdown('_Infinite_--_nothing._--Our soul').markdown.trim()).toBe('*Infinite*, *nothing.* Our soul');
  });

  it('keeps a lone fragment number as a bold label', () => {
    expect(toMarkdown('233\n\nLet us now speak').markdown).toBe('**233**\n\nLet us now speak\n');
  });

  it('rejoins wrapped lines, marks headings, converts emphasis and replaces dashes', () => {
    const { markdown, dashReplacements } = toMarkdown(stripGutenberg(BOOK).split('\n').slice(4).join('\n'));
    expect(markdown).toContain('### PART I');
    expect(markdown).toContain('First paragraph is wrapped across two lines.');
    expect(markdown).toContain('Second, with a dash and *emphasis*.');
    expect(dashReplacements).toBe(1);
    expect(markdown).not.toMatch(/[\u2013\u2014]|--/);
  });
});
