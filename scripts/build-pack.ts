import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PackManifest } from '../src/content/packSchema';
import type { DomainFile } from '../src/content/types';

// PHASE_15_PLUS 3.1: the content pack, built from the parser's output (run `npm run content` first).
//   npx tsx scripts/build-pack.ts            writes .pack/<version>/ and prints the version
// The Paper Module goes under owner-only/, which only the instance owner can read (section 3.2).

const ROOT = process.cwd();
const JSON_DIR = join(ROOT, 'content', 'json');
const TEXTS = join(ROOT, 'content', 'texts');
const OUT = join(ROOT, '.pack');

const read = (p: string) => readFileSync(p, 'utf8');
const files = new Map<string, string>();

const index = JSON.parse(read(join(JSON_DIR, 'index.json'))) as { domains: { id: string }[] };
const domains: unknown[] = [];
for (const { id } of index.domains) {
  const file = JSON.parse(read(join(JSON_DIR, `${id}.json`))) as DomainFile;
  domains.push(file.domain);
  for (const u of file.units) files.set(`units/${u.id}.json`, JSON.stringify(u));
}
files.set('domains.json', JSON.stringify({ domains, order: index.domains }));
files.set('prompts.json', read(join(JSON_DIR, 'prompts.json')));
files.set('architecture.json', read(join(JSON_DIR, 'architecture.json')));
files.set('owner-only/paper-module.json', read(join(JSON_DIR, 'paper.json')));
for (const f of readdirSync(TEXTS).filter((f) => f.endsWith('.md'))) files.set(`texts/${f}`, read(join(TEXTS, f)));
files.set('texts/MANIFEST.json', read(join(TEXTS, 'MANIFEST.json')));

const author = process.env.PACK_AUTHOR ?? 'the curriculum author';
const year = new Date().getUTCFullYear();
files.set(
  'LICENCE.md',
  `# Licence\n\nThe curriculum in this pack is copyright ${author}, ${year}, and is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International licence (CC BY-NC-SA 4.0): https://creativecommons.org/licenses/by-nc-sa/4.0/\n\nThe bundled readings in texts/ are public-domain works from Project Gutenberg; their sources are listed in texts/MANIFEST.json.\n`,
);

// the version names the content: the same files always give the same version
const hash = createHash('sha256');
for (const k of [...files.keys()].sort()) hash.update(k).update('\0').update(files.get(k)!).update('\0');
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const version = `${date}-${hash.digest('hex').slice(0, 8)}`;

const manifest = PackManifest.parse({
  name: 'wonderwander curriculum',
  version,
  author,
  licence: 'CC BY-NC-SA 4.0',
  files: [...files.keys()].filter((f) => !f.startsWith('owner-only/')).sort(),
  ownerOnly: ['paper-module'],
});
files.set('pack.json', JSON.stringify(manifest, null, 1));

const dir = join(OUT, version);
if (existsSync(dir)) rmSync(dir, { recursive: true });
for (const [path, body] of files) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), body);
}
writeFileSync(join(OUT, 'latest'), version);
const bytes = [...files.values()].reduce((s, b) => s + Buffer.byteLength(b), 0);
console.log(`pack ${version}: ${files.size} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, in .pack/${version}`);
