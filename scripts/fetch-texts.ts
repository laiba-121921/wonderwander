import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Bundles public-domain readings from Project Gutenberg (BUILD_PLAN 17).
// Specs live in content/texts/sources/<domain>.json; output is content/texts/<id>.md plus MANIFEST.json.

export interface Marker {
  text: string; // a line whose trimmed text starts with this
  occurrence?: number; // 1-based, counted from the previous marker (default 1)
}

export interface SectionSpec {
  start: Marker;
  end?: Marker; // exclusive; omitted means to the end of the book
  heading?: string; // optional heading written above the section
}

export interface BundledSpec {
  id: string;
  title: string;
  author: string;
  translator?: string;
  gutenbergId: number;
  sections: SectionSpec[];
  for: { unit: string; labelIncludes: string }[];
}

export interface LinkSpec {
  unit: string;
  labelIncludes: string;
  url: string;
  title: string;
}

// A work named in a reading that has no free legitimate copy (paid only), shown to the reader as such.
export interface UnavailableSpec {
  unit: string;
  labelIncludes: string;
  work: string;
}

export interface SourcesFile {
  bundled: BundledSpec[];
  links: LinkSpec[];
  unavailable?: UnavailableSpec[];
}

export interface ManifestEntry {
  id: string;
  title: string;
  author: string;
  translator?: string;
  source: string; // provenance URL
  gutenbergId: number;
  words: number;
  dashReplacements: number;
  sha256: string;
  for: { unit: string; labelIncludes: string }[];
}

const ROOT = process.cwd();
const TEXTS = join(ROOT, 'content', 'texts');
const CACHE = join(ROOT, 'node_modules', '.cache', 'gutenberg');

export function gutenbergUrl(id: number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
}

export function stripGutenberg(raw: string): string {
  const text = raw.replace(/\r\n?/g, '\n').replace(/^\ufeff/, '');
  const start = text.search(/^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/im);
  const end = text.search(/^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/im);
  const from = start >= 0 ? text.indexOf('\n', start) + 1 : 0;
  return text.slice(from, end >= 0 ? end : undefined);
}

function findLine(lines: string[], marker: Marker, from: number): number {
  let seen = 0;
  for (let i = from; i < lines.length; i++) {
    if (lines[i]!.trim().startsWith(marker.text)) {
      seen++;
      if (seen === (marker.occurrence ?? 1)) return i;
    }
  }
  return -1;
}

export function extract(body: string, sections: SectionSpec[]): { text: string; errors: string[] } {
  const lines = body.split('\n');
  const parts: string[] = [];
  const errors: string[] = [];
  let cursor = 0;
  for (const s of sections) {
    const a = findLine(lines, s.start, cursor);
    if (a < 0) {
      errors.push(`start marker not found: "${s.start.text}"`);
      continue;
    }
    const b = s.end ? findLine(lines, s.end, a + 1) : lines.length;
    if (b < 0) {
      errors.push(`end marker not found after "${s.start.text}": "${s.end!.text}"`);
      continue;
    }
    parts.push((s.heading ? `## ${s.heading}\n\n` : '') + lines.slice(a, b).join('\n'));
    cursor = b;
  }
  return { text: parts.join('\n\n'), errors };
}

// Gutenberg plain text wraps lines at about 70 characters; rejoin each paragraph and mark short all-caps lines as headings.
export function toMarkdown(text: string): { markdown: string; dashReplacements: number } {
  let dashReplacements = 0;
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('## ')) return p;
      // a paragraph that is only a number is a fragment or section label (Pascal 233); keep it, bold
      if (/^\d{1,4}\.?$/.test(p)) return `**${p}**`;
      // rules and separators made only of hyphen, dash or star characters carry no text
      if (/^[\s\-\u2010\u2011_=*.]+$/.test(p)) return '';
      // inside a paragraph, a line holding only a number is a margin section number from the print edition
      const joined = p
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !/^\d{1,4}$/.test(l))
        .join(' ');
      if (!joined) return '';
      const isHeading = joined.length <= 70 && !/[a-z]/.test(joined) && /[A-Z]/.test(joined);
      return isHeading ? `### ${joined}` : joined;
    })
    .map((p) =>
      p
        .replace(/_([^_\n]+)_/g, '*$1*')
        .replace(/~([^~\n]+)~/g, '*$1*') // some old editions mark emphasis with tildes
        .replace(/~/g, '')
        .replace(/\s*(?:--|[\u2013\u2014\u2e3a\u2e3b])\s*/g, () => {
          dashReplacements++;
          return ', ';
        })
        .replace(/,\s*,/g, ',')
        .replace(/([;:.!?]\*?),\s/g, '$1 ') // "for;--which" becomes "for; which", not "for;, which"
        .replace(/,\s*([.;:!?])/g, '$1')
        .replace(/ {2,}/g, ' '),
    );
  return { markdown: paras.filter(Boolean).join('\n\n') + '\n', dashReplacements };
}

async function download(id: number): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${id}.txt`);
  if (existsSync(path)) return readFileSync(path, 'utf8');
  const res = await fetch(gutenbergUrl(id), { headers: { 'User-Agent': 'wonderwander reading bundler (personal study app)' } });
  if (!res.ok) throw new Error(`Gutenberg #${id}: HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(path, text);
  return text;
}

export function readSources(): SourcesFile[] {
  const dir = join(TEXTS, 'sources');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as SourcesFile);
}

async function main() {
  // --dry: extract and preview only, writing nothing but the download cache (safe to run in parallel)
  const dry = process.argv.includes('--dry');
  const only = process.argv.slice(2).filter((a) => a !== '--dry');
  const specs = readSources()
    .flatMap((s) => s.bundled)
    .filter((b) => only.length === 0 || only.includes(b.id));
  const manifestPath = join(TEXTS, 'MANIFEST.json');
  const manifest: ManifestEntry[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  let failed = 0;
  for (const spec of specs) {
    try {
      const { text, errors } = extract(stripGutenberg(await download(spec.gutenbergId)), spec.sections);
      if (errors.length) throw new Error(errors.join('; '));
      const { markdown, dashReplacements } = toMarkdown(text);
      if (dry) {
        const words = markdown.split(/\s+/).filter(Boolean).length;
        console.log(`\n=== ${spec.id}: ${words} words\n--- START ---\n${markdown.slice(0, 500)}\n--- END ---\n${markdown.slice(-400)}`);
        continue;
      }
      writeFileSync(join(TEXTS, `${spec.id}.md`), markdown);
      const entry: ManifestEntry = {
        id: spec.id,
        title: spec.title,
        author: spec.author,
        ...(spec.translator ? { translator: spec.translator } : {}),
        source: gutenbergUrl(spec.gutenbergId),
        gutenbergId: spec.gutenbergId,
        words: markdown.split(/\s+/).filter(Boolean).length,
        dashReplacements,
        sha256: createHash('sha256').update(markdown).digest('hex'),
        for: spec.for,
      };
      const i = manifest.findIndex((m) => m.id === spec.id);
      if (i >= 0) manifest[i] = entry;
      else manifest.push(entry);
      console.log(`ok   ${spec.id}: ${entry.words} words, ${dashReplacements} dashes replaced`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${spec.id}: ${(e as Error).message}`);
    }
  }
  if (!dry) {
    manifest.sort((a, b) => a.id.localeCompare(b.id));
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
