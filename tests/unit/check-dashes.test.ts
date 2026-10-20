import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDashes, scan } from '../../scripts/check-dashes';

const EM = '\u2014';
const EN = '\u2013';

describe('findDashes', () => {
  it('passes clean text, hyphens and logic symbols', () => {
    expect(findDashes('well-known, P \u2192 Q, \u00acP', 'a.md')).toEqual([]);
  });

  it('reports em and en dashes with line numbers', () => {
    const hits = findDashes(`ok\nbad ${EM} here\npages 1${EN}3`, 'a.md');
    expect(hits.map((h) => h.line)).toEqual([2, 3]);
  });
});

describe('scan', () => {
  it('skips content/raw and node_modules but checks everything else', () => {
    const root = mkdtempSync(join(tmpdir(), 'dashes-'));
    mkdirSync(join(root, 'content', 'raw'), { recursive: true });
    mkdirSync(join(root, 'node_modules'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'content', 'raw', 'x.md'), `raw ${EM}`);
    writeFileSync(join(root, 'node_modules', 'x.js'), `dep ${EM}`);
    writeFileSync(join(root, 'src', 'ok.ts'), 'const a = 1;');
    expect(scan(root)).toEqual([]);

    writeFileSync(join(root, 'src', 'bad.tsx'), `const t = 'a ${EN} b';`);
    expect(scan(root).map((h) => h.file)).toEqual([join('src', 'bad.tsx')]);
  });

  it('flags a dash in a file name', () => {
    const root = mkdtempSync(join(tmpdir(), 'dashes-'));
    writeFileSync(join(root, `a ${EM} b.md`), 'clean');
    expect(scan(root)).toHaveLength(1);
  });
});
