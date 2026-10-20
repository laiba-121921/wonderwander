import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { checkPublicKey, checkUrl, envFile, NODE_MAJOR, nodeOk, remainingSteps } from './setup-logic';

// PHASE_15_PLUS 5: `npm run setup` for a new instance. Checks the tools, writes .env.local from two public values, and
// prints the steps that need an account or a dashboard. It never asks for a secret.

const rl = createInterface({ input: process.stdin, terminal: false });
const lines = rl[Symbol.asyncIterator]();
const say = (s = '') => console.log(s);

// One answer per line, typed or pasted all at once. Input that ends early stops the script without writing anything.
async function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const next = await lines.next();
  if (next.done) {
    say('\nInput ended before setup finished; nothing was written.');
    process.exit(1);
  }
  return next.value;
}

say('wonderwander setup\n');
let ready = true;
if (nodeOk(process.version)) say(`ok   Node ${process.version}`);
else {
  say(`no   Node ${process.version}: Node ${NODE_MAJOR} or newer is needed (nodejs.org).`);
  ready = false;
}
const cli = spawnSync('supabase --version', { encoding: 'utf8', shell: true });
if (cli.status === 0) say(`ok   Supabase CLI ${cli.stdout.trim().split('\n')[0]}`);
else {
  say('no   Supabase CLI: install it (supabase.com/docs/guides/cli), then run this again.');
  ready = false;
}
if (!ready) process.exit(1);

let write = true;
if (existsSync('.env.local')) {
  const answer = (await ask('\n.env.local already exists. Replace it? (y/N) ')).trim().toLowerCase();
  write = answer === 'y' || answer === 'yes';
}

let ref = '<project ref>';
if (write) {
  say('\nFrom your Supabase project: Project Settings, API.');
  let url: ReturnType<typeof checkUrl>;
  for (;;) {
    url = checkUrl(await ask('Project URL: '));
    if (url.ok) break;
    say(`     ${url.why}`);
  }
  let key: ReturnType<typeof checkPublicKey>;
  for (;;) {
    key = checkPublicKey(await ask('Publishable key: '));
    if (key.ok) break;
    say(`     ${key.why}`);
  }
  writeFileSync('.env.local', envFile(url.url, key.key));
  ref = url.ref;
  say('\nok   .env.local written (it is in .gitignore).');
} else {
  say('Kept the existing .env.local.');
}
rl.close();

say('\nStill to do, in order (docs/SELF_HOST.md explains each):');
remainingSteps(ref).forEach((step, i) => say(`${String(i + 1).padStart(2)}. ${step}`));
say('\nThen npm run dev runs it on this computer.');
