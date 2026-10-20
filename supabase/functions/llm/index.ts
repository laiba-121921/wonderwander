import { createClient } from '@supabase/supabase-js';
import { sanitiseDeep, type Mode } from './fill.ts';
import { transcribe } from './audio.ts';
import { CALLS_PER_HOUR, chooseKey } from './access.ts';
import { callModel, checkKey } from './gemini.ts';
import { buildPrompt, chooseTier, MODE_CONFIG, MODES, SECOND_RUN, tiersFrom, usedByTier } from './modes.ts';
import { RESPONSE_SCHEMA, ZOD } from './schemas.ts';

// One function, many modes (BUILD_PLAN 8). Each person sends their own Gemini key in x-gemini-key (PHASE_15_PLUS 4.3);
// it is used for that request only and never stored or logged. The instance owner may rely on the server's secret.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gemini-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const karachiDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // Supabase verifies the JWT before this runs; any signed-in user of the instance may call.
  const auth = req.headers.get('Authorization') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await db.auth.getUser(auth.replace(/^Bearer /i, ''));
  if (!who.user) return json({ error: 'forbidden' }, 403);
  const owner = (Deno.env.get('OWNER_EMAIL') ?? '').trim().toLowerCase();
  const chosen = chooseKey({ headerKey: req.headers.get('x-gemini-key'), isOwner: Boolean(owner) && who.user.email?.toLowerCase() === owner, secret: Deno.env.get('GEMINI_API_KEY') });
  if ('error' in chosen) return json({ error: chosen.error }, chosen.error === 'not_configured' ? 500 : 200);

  let input: { mode?: string; payload?: Record<string, string>; second?: boolean; audio?: { mime: string; data: string } };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const mode = input.mode as Mode;
  if (!MODES.includes(mode) && input.mode !== 'transcribe' && input.mode !== 'check_key') return json({ error: 'bad_mode' }, 400);

  // Rate limit per user (PHASE_15_PLUS 4.4), protecting the instance's shared function quota.
  const { data: thisHour, error: rateError } = await db.rpc('bump_llm_rate');
  if (rateError) console.error(`llm rate: ${rateError.message}`);
  if (typeof thisHour === 'number' && thisHour > CALLS_PER_HOUR) return json({ error: 'rate' });

  // Quota guard (BUILD_PLAN 8.4): each model's calls today, Karachi time, against its own free-tier cap.
  const today = karachiDate();
  const tiers = tiersFrom((k) => Deno.env.get(k));
  if (input.mode === 'check_key') return json({ result: { key: await checkKey({ apiKey: chosen.key, model: tiers.light.model }) } });
  const { data: usage } = await db.from('llm_usage').select('mode,calls').eq('usage_date', today);
  const used = usedByTier(usage ?? []);
  const tier = input.mode === 'transcribe' ? (used.light < tiers.light.cap ? 'light' : null) : chooseTier(input.mode as Mode, used, tiers);
  if (!tier) return json({ error: 'cap', used, tiers });
  const apiKeyOrNull = chosen.key;

  // PHASE_15_PLUS 2.2: speech to text, counted against the light model's daily cap like any other call
  if (input.mode === 'transcribe') {
    if (!input.audio?.data || !input.audio.mime) return json({ error: 'bad_request' }, 400);
    const r = await transcribe(input.audio, { apiKey: apiKeyOrNull, model: tiers.light.model });
    if (!r.ok) console.error(`llm transcribe on ${tiers.light.model}: ${r.error} ${r.detail ?? ''}`);
    const key = 'transcribe@light';
    const prior = (usage ?? []).find((u: { mode: string }) => u.mode === key)?.calls ?? 0;
    await db.from('llm_usage').upsert({ usage_date: today, mode: key, calls: prior + 1 }, { onConflict: 'user_id,usage_date,mode' });
    return json({ result: r.ok ? { text: sanitiseDeep(r.text.trim()) } : { error: r.error === 'failed' ? 'unparseable' : r.error, detail: r.detail }, model: tiers.light.model, tier: 'light' });
  }

  // The independent second run (tie-break, second judge, second referee) uses the same prompt at temperature 0.3.
  const cfg = { ...MODE_CONFIG[mode], ...(input.second && SECOND_RUN.includes(mode) ? { temperature: 0.3 } : {}) };
  const prompt = buildPrompt(mode, input.payload ?? {});
  const schema = cfg.json ? RESPONSE_SCHEMA[mode as keyof typeof RESPONSE_SCHEMA] : undefined;
  const model = tiers[tier].model;
  const apiKey = apiKeyOrNull;

  let calls = 0;
  let result: unknown = { error: 'unparseable' };
  // A JSON reply that fails validation is retried once with the same input (BUILD_PLAN 8.3).
  for (let attempt = 0; attempt < (cfg.json ? 2 : 1); attempt++) {
    calls++;
    const r = await callModel({ prompt, schema, temperature: cfg.temperature, maxTokens: cfg.maxTokens }, { apiKey, model });
    if (!r.ok) {
      result = { error: r.error === 'failed' ? 'unparseable' : r.error, detail: r.detail };
      console.error(`llm ${mode} on ${model}: ${r.error} ${r.detail ?? ''}`);
      if (r.error !== 'failed') break;
      continue;
    }
    if (!cfg.json) {
      result = { text: r.text.trim() };
      break;
    }
    try {
      const parsed = ZOD[mode as keyof typeof ZOD].safeParse(JSON.parse(r.text));
      if (parsed.success) {
        result = parsed.data;
        break;
      }
    } catch {
      // not JSON: retry
    }
  }

  const key = `${mode}@${tier}`;
  const prior = (usage ?? []).find((r: { mode: string }) => r.mode === key)?.calls ?? 0;
  await db.from('llm_usage').upsert({ usage_date: today, mode: key, calls: prior + calls }, { onConflict: 'user_id,usage_date,mode' });

  return json({ result: sanitiseDeep(result), model, tier, used: { ...used, [tier]: used[tier] + calls } });
});
