import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkRequest } from './logic.ts';

// PHASE_15_PLUS 4.1. Public sign-ups stay off in Supabase Auth; this function is the only way in. With
// {"code", "check": true} it says whether a code is good; with {"code", "email", "password"} it uses the code up and
// makes a confirmed account, which the app then signs in to.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const input = checkRequest(await req.json().catch(() => null));
  if (!input.ok) return json({ error: input.error });

  const { data: status, error } = await admin.rpc('claim_invite', { p_code: input.code, p_claim: Boolean(input.email) });
  if (error) return json({ error: 'failed' });
  if (status !== 'ok') return json({ error: status });
  if (!input.email) return json({ ok: true });

  const made = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true });
  if (made.error) {
    await admin.rpc('release_invite', { p_code: input.code });
    const exists = /already|registered|exists/i.test(made.error.message);
    const weak = /password/i.test(made.error.message);
    if (!exists && !weak) console.error(`invite: account not made: ${made.error.message}`);
    return json({ error: exists ? 'exists' : weak ? 'weak' : 'failed' });
  }
  return json({ ok: true });
});
