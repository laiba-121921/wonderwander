import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { decode, GUARANTEED_WORDS, matches, words } from './curriculum-guard';

// PHASE_15_PLUS 7.4, part of npm run lint: fails if any public file holds a run of curriculum text. The private
// content checked out at content/ is not public, so it is skipped.

const LIST = 'scripts/curriculum-fingerprints.txt';
if (!existsSync(LIST)) {
  console.log('No curriculum fingerprints yet; nothing to check.');
  process.exit(0);
}
const known = decode(readFileSync(LIST, 'utf8'));
const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('content/') && f !== LIST && !/\.(png|jpe?g|ico|woff2?|pdf|docx|webp)$/i.test(f) && !f.endsWith('package-lock.json') && existsSync(f));

let found = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const hits = matches(text, known);
  if (!hits.length) continue;
  found++;
  // the words themselves are not printed: CI logs of a public repository are public too
  console.log(`${f}: ${hits.length} run(s) of curriculum text, from word ${hits[0]! + 1} of ${words(text).length}`);
}
if (found) {
  console.log(`\n${found} file(s) hold curriculum text. Keep it in the private content repository.`);
  process.exit(1);
}
console.log(`No curriculum text found (${files.length} files; any copied run of ${GUARANTEED_WORDS} words or more would be).`);
