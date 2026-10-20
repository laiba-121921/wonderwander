// Pure checks behind `npm run setup` (PHASE_15_PLUS 5), kept apart so the tests can import them.

export const NODE_MAJOR = 24;

export function nodeOk(version: string): boolean {
  return Number(version.replace(/^v/, '').split('.')[0]) >= NODE_MAJOR;
}

// https://<20 letter ref>.supabase.co, as Supabase shows it under Project Settings, API.
export function checkUrl(input: string): { ok: true; url: string; ref: string } | { ok: false; why: string } {
  const url = input.trim().replace(/\/+$/, '');
  const m = url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/);
  return m ? { ok: true, url, ref: m[1]! } : { ok: false, why: 'Expected https://<project ref>.supabase.co, from Project Settings, API.' };
}

// The publishable key (sb_publishable_...) or the older anon key (a JWT). Never the secret or service role key.
export function checkPublicKey(input: string): { ok: true; key: string } | { ok: false; why: string } {
  const key = input.trim();
  if (/^sb_secret_/.test(key)) return { ok: false, why: 'That is a secret key. Use the publishable key: it is the only one that may go in the app.' };
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) return { ok: true, key };
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) {
    try {
      const role = JSON.parse(Buffer.from(key.split('.')[1]!, 'base64url').toString('utf8')).role;
      if (role === 'service_role') return { ok: false, why: 'That is the service role key. Use the anon (publishable) key.' };
      if (role === 'anon') return { ok: true, key };
    } catch {
      // not a readable token
    }
  }
  return { ok: false, why: 'Expected the publishable key (starts with sb_publishable_) from Project Settings, API Keys.' };
}

export function envFile(url: string, key: string): string {
  return `# Written by npm run setup. Public values only: the URL and the publishable key. Never commit this file.\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${key}\n`;
}

// What is left after the script, in order (docs/SELF_HOST.md has the detail).
export function remainingSteps(ref: string): string[] {
  return [
    `supabase login, then supabase link --project-ref ${ref}`,
    'supabase db push (creates every table, policy and job)',
    'supabase functions deploy (all five functions, with the settings in supabase/config.toml)',
    'In the Supabase dashboard: Edge Functions, Secrets: add OWNER_EMAIL (and GEMINI_API_KEY if you want a fallback key for yourself)',
    'In the Supabase dashboard: Authentication, Sign In / Providers: turn off "Allow new users to sign up"',
    'In the Supabase dashboard: Authentication, Users: add your own user with "Auto Confirm User" ticked',
    `Call the setup function once: open https://${ref}.supabase.co/functions/v1/setup and expect {"owner":"set","push":"set"}`,
    'Build and upload a content pack: npm run pack, then npm run upload-pack',
    'On GitHub: Settings, Secrets and variables, Actions, Variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; then Settings, Pages, Source: GitHub Actions',
    'Push to main, open the Pages address and sign in',
  ];
}
