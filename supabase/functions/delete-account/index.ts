import { createClient } from 'npm:@supabase/supabase-js@2';

// PHASE_15_PLUS 4.4. Deletes everything of the signed-in user: their uploaded drafts, then the account, which removes
// every row they own (each table cascades from auth.users). The instance owner cannot delete themselves here, since
// the instance would be left without one; the owner's account is removed in the Supabase dashboard.
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
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who.user) return json({ error: 'forbidden' }, 403);
  const id = who.user.id;
  const { data: owner } = await admin.from('owner').select('user_id').maybeSingle();
  if (owner?.user_id === id) return json({ error: 'owner' }, 400);

  // drafts live at <user id>/<file>; removed in pages until none are left
  for (;;) {
    const { data: files, error } = await admin.storage.from('drafts').list(id, { limit: 100 });
    if (error) return json({ error: 'failed', step: 'drafts' }, 500);
    if (!files?.length) break;
    const { error: removeError } = await admin.storage.from('drafts').remove(files.map((f) => `${id}/${f.name}`));
    if (removeError) return json({ error: 'failed', step: 'drafts' }, 500);
  }
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return json({ error: 'failed', step: 'account' }, 500);
  return json({ ok: true });
});
