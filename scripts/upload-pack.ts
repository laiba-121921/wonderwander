import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

// PHASE_15_PLUS 3.1: upload a built pack to the private `content` bucket as packs/<version>/..., then point
// packs/current.json at it. Signs in as the instance owner; the password is asked for here and never stored.
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx tsx scripts/upload-pack.ts [version]
// The URL and publishable key are read from .env.local when not set.

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim();
  } catch {
    return undefined;
  }
}

const TYPES: Record<string, string> = { json: 'application/json', md: 'text/markdown; charset=utf-8' };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}

const version = process.argv[2] ?? readFileSync('.pack/latest', 'utf8').trim();
const dir = join('.pack', version);
const url = env('VITE_SUPABASE_URL');
const key = env('VITE_SUPABASE_ANON_KEY');
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or put them in .env.local).');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = process.env.OWNER_EMAIL ?? (await rl.question('Owner email: '));
const password = process.env.OWNER_PASSWORD ?? (await rl.question('Password (not stored): '));
rl.close();

const db = createClient(url, key, { auth: { persistSession: false } });
const { error: signIn } = await db.auth.signInWithPassword({ email, password });
if (signIn) throw new Error(`Sign-in failed: ${signIn.message}`);

const files = walk(dir);
for (const f of files) {
  const path = relative(dir, f).replace(/\\/g, '/');
  const { error } = await db.storage.from('content').upload(`packs/${version}/${path}`, readFileSync(f), { contentType: TYPES[path.split('.').pop()!] ?? 'application/octet-stream', upsert: true });
  if (error) throw new Error(`${path}: ${error.message}`);
}
const { error } = await db.storage.from('content').upload('packs/current.json', JSON.stringify({ version }), { contentType: 'application/json', upsert: true });
if (error) throw new Error(`current.json: ${error.message}`);
console.log(`uploaded ${files.length} files as packs/${version}/ and pointed packs/current.json at it`);
