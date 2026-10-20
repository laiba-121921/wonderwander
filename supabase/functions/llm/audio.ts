import { callModel, type ModelResult } from './gemini.ts';

// PHASE_15_PLUS 2.2 and 2.3: speech to text with Gemini. The instruction is the plan's own wording.
export const TRANSCRIBE_PROMPT = 'Transcribe this speech exactly. Output only the words spoken, with sentence punctuation. Do not summarise. Do not use dashes.';

// A request may carry at most 20 MB in all, and base64 grows the audio by a third: above this the Files API is used.
export const INLINE_LIMIT = 14 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/opus', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/flac'];

// Browsers label the same formats in several ways; Gemini wants its own names.
export function geminiMime(mime: string): string {
  const base = mime.split(';')[0]!.trim().toLowerCase();
  return ({ 'audio/x-wav': 'audio/wav', 'audio/mp4': 'audio/m4a', 'audio/x-m4a': 'audio/m4a', 'audio/mpeg': 'audio/mp3' } as Record<string, string>)[base] ?? base;
}

const API = 'https://generativelanguage.googleapis.com';

function decode(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Gemini's resumable upload: start, then send the bytes and finalise; wait until the file is ACTIVE.
async function upload(bytes: Uint8Array<ArrayBuffer>, mime: string, apiKey: string, doFetch: typeof fetch): Promise<{ name: string; uri: string } | null> {
  const start = await doFetch(`${API}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: 'answer' } }),
  });
  const url = start.headers.get('x-goog-upload-url');
  if (!start.ok || !url) return null;
  const done = await doFetch(url, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: bytes });
  const info = (await done.json().catch(() => null)) as { file?: { name: string; uri: string; state?: string } } | null;
  if (!done.ok || !info?.file) return null;
  let state = info.file.state;
  for (let i = 0; i < 20 && state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = (await (await doFetch(`${API}/v1beta/${info.file.name}`, { headers: { 'x-goog-api-key': apiKey } })).json().catch(() => null)) as { state?: string } | null;
    state = poll?.state;
  }
  return state === 'FAILED' ? null : { name: info.file.name, uri: info.file.uri };
}

const guard = (r: ModelResult): ModelResult => (r.ok && looksLooped(r.text) ? { ok: false, error: 'failed', detail: 'repetition loop' } : r);

export async function transcribe(audio: { mime: string; data: string }, opts: { apiKey: string; model: string; fetchImpl?: typeof fetch }): Promise<ModelResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const mime = geminiMime(audio.mime);
  const bytes = decode(audio.data);
  if (bytes.length > MAX_AUDIO_BYTES) return { ok: false, error: 'failed', detail: 'audio over 25 MB' };
  const call = { prompt: TRANSCRIBE_PROMPT, temperature: 0, maxTokens: 8192 };
  if (bytes.length <= INLINE_LIMIT) return guard(await callModel({ ...call, media: { inline_data: { mime_type: mime, data: audio.data } } }, opts));

  const file = await upload(bytes, mime, opts.apiKey, doFetch);
  if (!file) return { ok: false, error: 'busy', detail: 'upload failed' };
  try {
    return guard(await callModel({ ...call, media: { file_data: { mime_type: mime, file_uri: file.uri } } }, opts));
  } finally {
    // the audio is never kept: delete it from Google as soon as the text is back
    await doFetch(`${API}/v1beta/${file.name}`, { method: 'DELETE', headers: { 'x-goog-api-key': opts.apiKey } }).catch(() => undefined);
  }
}

// A model can fall into repeating a phrase until its output runs out; real answers do not repeat a twelve word run
// eight times. Such a transcript is refused rather than shown.
export function looksLooped(text: string, run = 12, times = 8): boolean {
  const w = text.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Map<string, number>();
  for (let i = 0; i + run <= w.length; i += 1) {
    const k = w.slice(i, i + run).join(' ');
    const n = (seen.get(k) ?? 0) + 1;
    if (n >= times) return true;
    seen.set(k, n);
  }
  return false;
}
