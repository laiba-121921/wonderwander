// The only file that knows about Gemini (BUILD_PLAN 8.6). If the provider changes, only this file changes.

export interface ModelCall {
  prompt: string;
  schema?: object; // present for JSON modes
  temperature: number;
  maxTokens: number;
  media?: { inline_data: { mime_type: string; data: string } } | { file_data: { mime_type: string; file_uri: string } }; // audio to transcribe
}

export type ModelResult = { ok: true; text: string } | { ok: false; error: 'busy' | 'blocked' | 'denied' | 'failed'; detail?: string };

const CATEGORIES = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'];

export function requestBody(c: ModelCall): object {
  return {
    contents: [{ role: 'user', parts: [...(c.media ? [c.media] : []), { text: c.prompt }] }],
    generationConfig: {
      temperature: c.temperature,
      maxOutputTokens: c.maxTokens,
      ...(c.schema ? { responseMimeType: 'application/json', responseSchema: c.schema } : {}),
    },
    // The curriculum discusses evil, war, torture and religion: least restrictive thresholds (BUILD_PLAN 8.3).
    safetySettings: CATEGORIES.map((category) => ({ category, threshold: 'OFF' })),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isKeyRejection = (body: unknown) => /API_KEY_INVALID|API key not valid|API_KEY_SERVICE_BLOCKED/.test(JSON.stringify(body ?? {}));

// Onboarding (PHASE_15_PLUS 4.2): asks Google about one model with the key. No generation, so no quota is used.
export async function checkKey(opts: { apiKey: string; model: string; fetchImpl?: typeof fetch }): Promise<'ok' | 'denied' | 'busy'> {
  try {
    const res = await (opts.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}`, { headers: { 'x-goog-api-key': opts.apiKey } });
    if (res.ok) return 'ok';
    const body = await res.json().catch(() => null);
    return res.status === 401 || res.status === 403 || isKeyRejection(body) ? 'denied' : 'busy';
  } catch {
    return 'busy';
  }
}

export async function callModel(c: ModelCall, opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; backoff?: number[] }): Promise<ModelResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`;
  const waits = opts.backoff ?? [2000, 6000];
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey }, body: JSON.stringify(requestBody(c)) });
    } catch (e) {
      if (attempt < waits.length) {
        await sleep(waits[attempt]!);
        continue;
      }
      return { ok: false, error: 'busy', detail: String(e) };
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < waits.length) {
        await sleep(waits[attempt]!);
        continue;
      }
      return { ok: false, error: 'busy', detail: `HTTP ${res.status}` };
    }
    const body = await res.json().catch(() => null);
    // a refused key or project is a configuration problem, never a grading result (an unknown key comes back as 400)
    if (res.status === 401 || res.status === 403 || isKeyRejection(body)) return { ok: false, error: 'denied', detail: `HTTP ${res.status} ${JSON.stringify(body ?? {}).slice(0, 300)}` };
    if (!res.ok) {
      const msg = JSON.stringify(body ?? {});
      return { ok: false, error: /safety|blocked|prohibited/i.test(msg) ? 'blocked' : 'failed', detail: `HTTP ${res.status} ${msg.slice(0, 300)}` };
    }
    if (body?.promptFeedback?.blockReason) return { ok: false, error: 'blocked', detail: body.promptFeedback.blockReason };
    const cand = body?.candidates?.[0];
    if (!cand || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(cand.finishReason)) return { ok: false, error: 'blocked', detail: cand?.finishReason };
    const text = (cand.content?.parts ?? []).map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : (p.text ?? ''))).join('');
    if (!text) return { ok: false, error: 'failed', detail: `empty (${cand.finishReason})` };
    return { ok: true, text };
  }
}
