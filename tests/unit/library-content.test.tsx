import { existsSync, readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DomainFile } from '../../src/content/types';
import { Prose } from '../../src/ui/Prose';
import { DOMAINS } from '../../scripts/content/structure';
import { HAS_CONTENT, readContent } from '../content';

const domains: DomainFile[] = HAS_CONTENT ? DOMAINS.map((d) => readContent<DomainFile>(`content/json/${d.id}.json`, { domain: {} as DomainFile['domain'], units: [] })) : [];
const manifest = readContent<{ id: string; title: string }[]>('content/texts/MANIFEST.json', []);

describe.skipIf(!HAS_CONTENT)('library content', () => {
  it('renders every lesson of all 56 units', () => {
    let units = 0;
    for (const { units: list } of domains) {
      for (const u of list) {
        units++;
        const md = [...u.lesson.map((s) => s.markdown), u.whyCares ?? '', u.workedExamples, u.mistakes].join('\n\n');
        const { container, unmount } = render(<Prose markdown={md} />);
        expect(container.textContent!.length, u.id).toBeGreaterThan(500);
        unmount();
      }
    }
    expect(units).toBe(56);
  }, 30000); // renders every lesson, slow under parallel load

  it('has a file and a manifest entry for every bundled reading a unit points to', () => {
    const ids = new Set(domains.flatMap((d) => d.units.flatMap((u) => u.reading.texts.flatMap((t) => t.bundled?.map((b) => b.id) ?? []))));
    expect(ids.size).toBeGreaterThan(30);
    for (const id of ids) {
      expect(existsSync(`content/texts/${id}.md`), id).toBe(true);
      expect(manifest.some((m) => m.id === id), id).toBe(true);
    }
  });

  it('renders every bundled text, dash free', () => {
    for (const m of manifest) {
      const md = readFileSync(`content/texts/${m.id}.md`, 'utf8');
      expect(md, m.id).not.toMatch(/[\u2013\u2014\u2e3a\u2e3b]/);
      const { container, unmount } = render(<Prose markdown={md} />);
      expect(container.textContent!.length, m.id).toBeGreaterThan(1500);
      unmount();
    }
  }, 30000);

  it('gives every reading reference a bundled text or a link', () => {
    for (const d of domains) for (const u of d.units) for (const t of u.reading.texts) expect(Boolean(t.bundled?.length || t.links?.length), `${u.id}: ${t.label.slice(0, 50)}`).toBe(true);
  });
});
