import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPublicKey, checkUrl, envFile, nodeOk, remainingSteps } from '../../scripts/setup-logic';
import { attribution } from '../../src/features/settings/AboutScreen';
import { currentTimezone } from '../../src/lib/profile';

// Fake keys are put together at runtime, so the repository's secret scan never sees a key-shaped string.
const fake = (kind: string) => ['sb', kind, 'abcdefghijklmnop'].join('_');
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.c2ln`;

describe('npm run setup (PHASE_15_PLUS 5)', () => {
  it('needs Node 24 or newer', () => {
    expect(nodeOk('v24.22.0')).toBe(true);
    expect(nodeOk('v25.1.0')).toBe(true);
    expect(nodeOk('v21.7.3')).toBe(false);
  });

  it('takes the project URL as Supabase shows it', () => {
    expect(checkUrl(' https://abcdefghijklmnopqrst.supabase.co/ ')).toEqual({ ok: true, url: 'https://abcdefghijklmnopqrst.supabase.co', ref: 'abcdefghijklmnopqrst' });
    expect(checkUrl('abcdefghijklmnopqrst.supabase.co').ok).toBe(false);
    expect(checkUrl('https://example.com').ok).toBe(false);
  });

  it('takes only a public key, never a secret one', () => {
    expect(checkPublicKey(fake('publishable')).ok).toBe(true);
    expect(checkPublicKey(jwt('anon')).ok).toBe(true);
    expect(checkPublicKey(fake('secret'))).toMatchObject({ ok: false, why: expect.stringContaining('secret key') });
    expect(checkPublicKey(jwt('service_role'))).toMatchObject({ ok: false, why: expect.stringContaining('service role') });
    expect(checkPublicKey('hello').ok).toBe(false);
  });

  it('writes the two variables the app reads, and the file stays out of git', () => {
    expect(envFile('https://x.supabase.co', 'sb_publishable_k')).toContain('VITE_SUPABASE_URL=https://x.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_k\n');
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/\.env/);
  });

  it('lists the remaining steps in the guide order, ending at sign-in', () => {
    const steps = remainingSteps('abcdefghijklmnopqrst');
    expect(steps[0]).toContain('supabase link --project-ref abcdefghijklmnopqrst');
    expect(steps.findIndex((s) => s.includes('db push'))).toBeLessThan(steps.findIndex((s) => s.includes('functions deploy')));
    expect(steps.at(-1)).toContain('sign in');
    const guide = readFileSync('docs/SELF_HOST.md', 'utf8');
    for (const word of ['supabase db push', 'supabase functions deploy', 'OWNER_EMAIL', 'npm run upload-pack', 'functions/v1/setup']) expect(guide).toContain(word);
  });

  it('marks the verify_jwt setting of every function in the CLI config', () => {
    const config = readFileSync('supabase/config.toml', 'utf8');
    for (const [fn, on] of [['llm', true], ['delete-account', true], ['push', false], ['invite', false], ['setup', false]] as const) {
      expect(config).toContain(`[functions.${fn}]\nverify_jwt = ${on}\n`);
    }
  });
});

describe("each person's own clock", () => {
  it("locks run to the signed-in person's timezone, from their profile on the device", () => {
    localStorage.setItem('ww.profile', JSON.stringify({ timezone: 'Europe/London' }));
    expect(currentTimezone()).toBe('Europe/London');
    localStorage.removeItem('ww.profile');
    expect(currentTimezone()).toBe('Asia/Karachi');
  });
});

describe('attribution (PHASE_15_PLUS 6)', () => {
  it('uses the planned sentence, with the curriculum author taken from the pack', () => {
    expect(attribution('Laiba', '2026')).toBe('Curriculum written by Laiba, 2026. App designed and built by Laiba.');
    expect(attribution('A Self Hoster', '2027')).toBe('Curriculum written by A Self Hoster, 2027. App designed and built by Laiba.');
  });

  it('ships the MIT licence for the code', () => {
    const licence = readFileSync('LICENSE', 'utf8');
    expect(licence.startsWith('MIT License\n\nCopyright (c) 2026 Laiba\n')).toBe(true);
    expect(JSON.parse(readFileSync('package.json', 'utf8'))).toMatchObject({ license: 'MIT', author: 'Laiba' });
  });
});
