import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DomainFile, TextRef } from '../../src/content/types';
import { readSources, type ManifestEntry } from '../fetch-texts';
import type { Report } from './report';

// Attaches bundled texts and verified links (content/texts/sources) to each unit's reading.
export function attachTexts(domains: DomainFile[], report: Report, root = process.cwd()): void {
  const manifestPath = join(root, 'content', 'texts', 'MANIFEST.json');
  const manifest: ManifestEntry[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  const units = new Map(domains.flatMap((d) => d.units.map((u) => [u.id, u] as const)));

  const findRef = (unit: string, labelIncludes: string, where: string): TextRef | null => {
    const u = units.get(unit);
    if (!u) {
      report.error(where, `unknown unit ${unit}`);
      return null;
    }
    const hits = u.reading.texts.filter((t) => t.label.includes(labelIncludes));
    if (hits.length !== 1) {
      report.error(where, `"${labelIncludes}" matches ${hits.length} readings in ${unit}`);
      return null;
    }
    return hits[0]!;
  };

  for (const file of readSources()) {
    for (const spec of file.bundled) {
      const entry = manifest.find((m) => m.id === spec.id);
      if (!entry || !existsSync(join(root, 'content', 'texts', `${spec.id}.md`))) {
        report.error(`texts:${spec.id}`, 'bundled text not generated; run npm run texts');
        continue;
      }
      for (const f of spec.for) {
        const ref = findRef(f.unit, f.labelIncludes, `texts:${spec.id}`);
        if (ref) (ref.bundled ??= []).push({ id: spec.id, title: spec.title });
      }
    }
    for (const link of file.links) {
      const ref = findRef(link.unit, link.labelIncludes, `links:${link.unit}`);
      if (ref) (ref.links ??= []).push({ title: link.title, url: link.url });
    }
    for (const u of file.unavailable ?? []) {
      const ref = findRef(u.unit, u.labelIncludes, `unavailable:${u.unit}`);
      if (ref) (ref.unavailable ??= []).push(u.work);
    }
  }
  const paid = domains.flatMap((d) => d.units.flatMap((u) => u.reading.texts.flatMap((t) => (t.unavailable ?? []).map((w) => `${u.id}: ${w}`))));
  report.notes.push(`works with no free legitimate copy (paid only): ${paid.length}`);
  for (const p of paid) report.notes.push(`paid only: ${p}`);

  const all = domains.flatMap((d) => d.units.flatMap((u) => u.reading.texts.map((t) => ({ unit: u.id, t }))));
  const bare = all.filter(({ t }) => !t.bundled?.length && !t.links?.length);
  report.notes.push(
    `readings: ${all.length} references, ${all.filter(({ t }) => t.bundled?.length).length} with bundled text, ${all.filter(({ t }) => t.links?.length).length} with links, ${bare.length} citation only (library or purchase)`,
  );
  for (const { unit, t } of bare) report.notes.push(`citation only: ${unit}: ${t.label.slice(0, 90)}`);
}
