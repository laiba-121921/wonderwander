import { createClient } from '@supabase/supabase-js';
import * as webpush from '@negrel/webpush';
import { isPushHour, reminder, sameSecret, shouldSend } from './logic.ts';

// BUILD_PLAN 18. GET returns the public VAPID key; POST from the hourly job (shared secret) sends a reminder to each
// person whose local push hour it is, when their due cards pass the threshold; POST from a signed-in user with
// {"test": true} sends that user one test reminder.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function secret(name: string): Promise<string | null> {
  const { data } = await admin.rpc('push_secret', { secret_name: name });
  return (data as string | null) ?? null;
}

// The key pair is made on first use and kept in Vault; the private half never leaves the server.
let keys: CryptoKeyPair | null = null;
async function vapidKeys(): Promise<CryptoKeyPair> {
  if (keys) return keys;
  let stored = await secret('push_vapid_keys');
  if (!stored) {
    const fresh = await webpush.generateVapidKeys({ extractable: true });
    await admin.rpc('push_store_vapid', { keys: JSON.stringify(await webpush.exportVapidKeys(fresh)) });
    stored = await secret('push_vapid_keys');
  }
  keys = await webpush.importVapidKeys(JSON.parse(stored!), { extractable: false });
  return keys;
}

async function dueCount(userId: string): Promise<number> {
  const { count } = await admin.from('card_state').select('card_id', { count: 'exact', head: true }).eq('user_id', userId).lte('due', new Date().toISOString());
  return count ?? 0;
}

async function notify(userId: string, due: number): Promise<{ sent: number; removed: number }> {
  const server = await webpush.ApplicationServer.new({ contactInformation: `mailto:${Deno.env.get('OWNER_EMAIL') ?? 'owner@example.invalid'}`, vapidKeys: await vapidKeys() });
  const { data: subs } = await admin.from('push_subscription').select('endpoint,keys').eq('user_id', userId);
  let sent = 0;
  let removed = 0;
  for (const s of (subs as { endpoint: string; keys: { auth: string; p256dh: string } }[] | null) ?? []) {
    try {
      await server.subscribe({ endpoint: s.endpoint, keys: s.keys }).pushTextMessage(JSON.stringify(reminder(due)), { ttl: 12 * 3600 });
      sent++;
    } catch (e) {
      // a subscription the push service no longer knows is deleted; anything else is logged and kept
      if (e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404)) {
        await admin.from('push_subscription').delete().eq('endpoint', s.endpoint);
        removed++;
      } else console.error(`push to ${new URL(s.endpoint).host} failed: ${e}`);
    }
  }
  return { sent, removed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return json({ publicKey: await webpush.exportApplicationServerKey(await vapidKeys()) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // the hourly job
  if (sameSecret(req.headers.get('x-cron-secret'), await secret('push_cron_secret'))) {
    const { data: profiles } = await admin.from('profile').select('user_id,push_threshold,push_hour,timezone');
    const now = new Date();
    const results = [];
    for (const p of (profiles as { user_id: string; push_threshold: number; push_hour: number; timezone: string }[] | null) ?? []) {
      if (!isPushHour(now, p.push_hour, p.timezone)) continue;
      const due = await dueCount(p.user_id);
      results.push({ due, threshold: p.push_threshold, ...(shouldSend(due, p.push_threshold, false) ? await notify(p.user_id, due) : { sent: 0, removed: 0 }) });
    }
    return json({ results });
  }

  // a signed-in user's test ping, to their own subscriptions only
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const { data: who } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!who.user) return json({ error: 'forbidden' }, 403);
  const body = await req.json().catch(() => ({}));
  if (!body?.test) return json({ error: 'bad_request' }, 400);
  const due = await dueCount(who.user.id);
  return json({ due, ...(await notify(who.user.id, due)) });
});
