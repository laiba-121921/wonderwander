import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Key-shaped strings that must never be committed (BUILD_PLAN 25). Public values come from build variables only.
export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Supabase publishable key (use the build variable)', re: /sb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: 'JWT (anon or service role key)', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'GitHub token', re: /gh[opsu]_[A-Za-z0-9]{36}/ },
];

export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // tracked and staged files only, so the gitignored .env.local is never read
  const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.startsWith('node_modules/') && !f.endsWith('package-lock.json') && !/\.(png|jpg|woff2?|ico)$/.test(f));
  let bad = 0;
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const name of findSecrets(text)) {
      console.error(`${f}: looks like a ${name}`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.log('No key-shaped strings found.');
}
