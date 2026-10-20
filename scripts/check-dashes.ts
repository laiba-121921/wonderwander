import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DASHES = /[\u2013\u2014\u2e3a\u2e3b]/;

// content/raw holds the owner's exports verbatim; the parser replaces and logs their dashes.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report']);
const SKIP_PATHS = new Set([join('content', 'raw')]);
const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.yml', '.yaml', '.sql', '.txt', '.svg',
]);

export interface DashHit {
  file: string;
  line: number;
  text: string;
}

export function findDashes(text: string, file: string): DashHit[] {
  return text
    .split(/\r?\n/)
    .flatMap((line, i) => (DASHES.test(line) ? [{ file, line: i + 1, text: line.trim() }] : []));
}

export function scan(root: string, dir = root): DashHit[] {
  const hits: DashHit[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name) && !SKIP_PATHS.has(rel)) hits.push(...scan(root, full));
      continue;
    }
    if (DASHES.test(name)) hits.push({ file: rel, line: 0, text: '(dash in file name)' });
    if (TEXT_EXTS.has(extname(name)) && name !== 'package-lock.json') {
      hits.push(...findDashes(readFileSync(full, 'utf8'), rel));
    }
  }
  return hits;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hits = scan(process.cwd());
  for (const h of hits) console.error(`${h.file.split(sep).join('/')}:${h.line}  ${h.text}`);
  if (hits.length > 0) {
    console.error(`\nFound ${hits.length} em or en dash(es). Use a comma, colon, parentheses or "to" instead.`);
    process.exit(1);
  }
  console.log('No em or en dashes found.');
}
