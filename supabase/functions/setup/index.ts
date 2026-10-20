import { createClient } from 'npm:@supabase/supabase-js@2';

// PHASE_15_PLUS 3.2 and 5: the one-time step for a new instance, safe to call again. It points the hourly card job at
// this instance's own push function, and records the user named by the OWNER_EMAIL secret as the owner once that user
// exists. An owner already recorded is never changed.
Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error: pushError } = await admin.rpc('set_push_url', { url: `${url}/functions/v1/push` });
  const push = pushError ? 'failed' : 'set';

  const { data: existing } = await admin.from('owner').select('user_id').maybeSingle();
  if (existing) return Response.json({ owner: 'set', push });
  const email = (Deno.env.get('OWNER_EMAIL') ?? '').trim().toLowerCase();
  if (!email) return Response.json({ owner: 'missing', push, reason: 'set the OWNER_EMAIL secret' }, { status: 400 });
  for (let page = 1; page < 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    const user = data?.users.find((u) => u.email?.toLowerCase() === email);
    if (user) {
      const { error } = await admin.from('owner').insert({ user_id: user.id });
      return Response.json({ owner: error ? 'failed' : 'set', push }, { status: error ? 500 : 200 });
    }
    if (!data || data.users.length < 100) break;
  }
  return Response.json({ owner: 'missing', push, reason: 'create the owner user first' }, { status: 404 });
});
