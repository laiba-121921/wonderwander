import { sanitiseDeep } from '../../../supabase/functions/llm/fill';
import { getGeminiKey } from '../../lib/geminiKey';
import { supabase } from '../../lib/supabase';

export type LlmMode = 'grade' | 'audit' | 'variant' | 'variant_check' | 'author_reply' | 'boss_turn' | 'judge' | 'referee' | 'transcribe';
export type LlmError = 'busy' | 'cap' | 'blocked' | 'unparseable' | 'denied' | 'nokey' | 'rate' | 'offline' | 'forbidden' | 'failed';

export type LlmResult<T> = { ok: true; data: T } | { ok: false; error: LlmError; detail?: string };

// Calls the llm edge function with this person's Gemini key (PHASE_15_PLUS 4.3). The function returns { result },
// where result may itself be { error }.
// `second` asks for the independent second run of grade, judge or referee (temperature 0.3, PHASE_15_PLUS 1).
export async function callLlm<T>(mode: LlmMode, payload: Record<string, string>, opts: { second?: boolean; audio?: { mime: string; data: string } } = {}): Promise<LlmResult<T>> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: 'offline' };
  try {
    const key = await getGeminiKey();
    const { data, error } = await supabase.functions.invoke('llm', {
      body: { mode, payload, ...(opts.second ? { second: true } : {}), ...(opts.audio ? { audio: opts.audio } : {}) },
      ...(key ? { headers: { 'x-gemini-key': key } } : {}),
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { ok: false, error: status === 403 ? 'forbidden' : 'failed' };
    }
    const body = data as { result?: unknown; error?: string };
    if (body.error === 'cap' || body.error === 'nokey' || body.error === 'rate' || body.error === 'denied') return { ok: false, error: body.error };
    const result = body.result as { error?: string; detail?: string } | undefined;
    if (!result) return { ok: false, error: 'failed' };
    if (typeof result === 'object' && 'error' in result && result.error) {
      const e = result.error;
      const known = ['busy', 'blocked', 'unparseable', 'denied'] as const;
      return { ok: false, error: (known as readonly string[]).includes(e) ? (e as LlmError) : 'failed', detail: result.detail };
    }
    // the function already removes dashes; the client does it again before anything is shown (BUILD_PLAN 8.5)
    return { ok: true, data: sanitiseDeep(result) as T };
  } catch {
    return { ok: false, error: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'failed' };
  }
}

// Onboarding and Settings: does Google accept this key? Sends the candidate key, not the stored one.
export async function checkGeminiKey(key: string): Promise<'ok' | 'denied' | 'busy' | 'offline'> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  try {
    const { data, error } = await supabase.functions.invoke('llm', { body: { mode: 'check_key' }, headers: { 'x-gemini-key': key.trim() } });
    if (error) return 'busy';
    const body = data as { error?: string; result?: { key?: 'ok' | 'denied' | 'busy' } };
    if (body.error === 'denied') return 'denied';
    return body.result?.key ?? 'busy';
  } catch {
    return 'busy';
  }
}

// Errors the student fixes in Settings, so the message comes with a link there.
export const KEY_ERRORS: LlmError[] = ['denied', 'nokey'];

// What the student sees for each failure (BUILD_PLAN 8.3, 19.8, 20).
export const LLM_MESSAGE: Record<LlmError, string> = {
  busy: 'Gemini is napping. Your answer is saved; try again in a minute.',
  cap: "Today's checking allowance is used up. Your answer is saved; try again tomorrow.",
  blocked: 'Gemini would not read this one. Your answer is saved and nothing is locked; try again later, or reword it.',
  unparseable: 'The check came back garbled. Your answer is saved and nothing is locked; try again in a minute.',
  denied: 'Google refused the Gemini key, so nothing was checked. Your answer is saved. Check the key in Settings, or its project in Google AI Studio.',
  nokey: 'There is no Gemini key on this phone yet, so nothing was checked. Your answer is saved. Add your key in Settings.',
  rate: 'That is a lot of checking in one hour. Your answer is saved; try again in a few minutes.',
  offline: "You're offline. Your answer is saved and will be checked when you're back.",
  forbidden: 'You seem to be signed out. Sign in again; your answer is saved.',
  failed: 'The checker did not answer. Your answer is saved; try again in a minute.',
};
