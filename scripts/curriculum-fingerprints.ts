import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode, fingerprints, GUARANTEED_WORDS } from './curriculum-guard';

// Writes scripts/curriculum-fingerprints.txt from the private curriculum (content/raw), for scripts/check-curriculum.ts.
// Run after the curriculum changes:  npx tsx scripts/curriculum-fingerprints.ts
// The Testing Architecture is left out: its Gemini prompts are part of the public server function by design.

const RAW = join('content', 'raw');
if (!existsSync(RAW)) {
  console.log('No content/raw here, so there is nothing to fingerprint.');
  process.exit(0);
}
const sources = readdirSync(RAW).filter((f) => f.endsWith('.md') && !f.startsWith('00-') && !f.startsWith('99-'));
const all = new Set<string>();
for (const f of sources) for (const h of fingerprints(readFileSync(join(RAW, f), 'utf8'))) all.add(h);
writeFileSync(join('scripts', 'curriculum-fingerprints.txt'), encode(all));
console.log(`${all.size} fingerprints from ${sources.length} files; any copied run of ${GUARANTEED_WORDS} words or more is caught.`);
