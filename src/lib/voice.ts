import { callLlm, type LlmError } from '../engines/grading/llm';

// PHASE_15_PLUS 2: in-app voice. Live dictation through the Web Speech API, and hold-to-record with Gemini transcription.

interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const dictationSupported = () => recognitionCtor() !== null;
export const recordingSupported = () => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

export const tick = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    // no haptics here
  }
};

const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

// How many words at the end of `a` are the words at the start of `b`.
function overlap(a: string[], b: string[]): number {
  for (let k = Math.min(a.length, b.length); k > 0; k--) {
    let same = true;
    for (let i = 0; i < k && same; i++) same = key(a[a.length - k + i]!) === key(b[i]!);
    if (same) return k;
  }
  return 0;
}

// One transcript from a run of recognition results. Desktop Chrome gives separate segments; Chrome on Android also
// sends the same words again, or a longer version that starts with what came before. A result is joined at its
// overlap with the text so far when it repeats it, extends it, or shares at least two words with its end; otherwise
// it is new speech and follows with a space.
export function mergeResults(parts: string[]): string {
  let acc: string[] = [];
  for (const part of parts) {
    const words = wordsOf(part);
    if (!words.length) continue;
    const k = overlap(acc, words);
    if (k === words.length || k === acc.length || k >= 2) acc = [...acc, ...words.slice(k)];
    else acc = [...acc, ...words];
  }
  return acc.join(' ');
}

// The interim words that are not already in the final text.
export function wordsAfter(finalText: string, interim: string): string {
  const a = wordsOf(finalText);
  const b = wordsOf(interim);
  return b.slice(overlap(a, b)).join(' ');
}

export interface DictationHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void; // everything said so far in this session, final and merged
  onEnd: () => void;
  onError: (code: string) => void;
}

// Pakistani English first, British English if the browser does not offer it (PHASE_15_PLUS 2.1).
export const LANGS = ['en-PK', 'en-GB'];

export function startDictation(h: DictationHandlers, langIndex = 0): { stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    h.onError('unsupported');
    return { stop: () => undefined };
  }
  const rec = new Ctor();
  rec.lang = LANGS[langIndex]!;
  rec.continuous = true;
  rec.interimResults = true;
  let next: { stop: () => void } | null = null;
  let stopped = false;
  let said = '';
  rec.onresult = (e) => {
    // the whole session each time, from every result: Chrome on Android repeats and re-extends results
    const finals: string[] = [];
    const interims: string[] = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]!;
      (r.isFinal ? finals : interims).push(r[0].transcript);
    }
    const now = mergeResults(finals);
    if (now !== said) {
      said = now;
      h.onFinal(now);
    }
    h.onInterim(wordsAfter(now, mergeResults(interims)));
  };
  rec.onerror = (e) => {
    if (e.error === 'language-not-supported' && langIndex + 1 < LANGS.length) {
      next = startDictation(h, langIndex + 1);
      return;
    }
    if (e.error !== 'no-speech' && e.error !== 'aborted') h.onError(e.error);
  };
  rec.onend = () => {
    if (!next && !stopped) h.onEnd();
  };
  rec.start();
  return {
    stop: () => {
      stopped = true;
      if (next) next.stop();
      else {
        rec.stop();
        h.onInterim('');
        h.onEnd();
      }
    },
  };
}

export const MAX_RECORD_SECONDS = 600;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_UPLOAD_TYPES = /\.(m4a|mp3|webm|wav|ogg|aac|opus|flac)$/i;

export interface Recording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

// Hold-to-record (PHASE_15_PLUS 2.2): webm/opus where the browser offers it, with a level for the waveform and a
// stop at ten minutes. The audio stays in memory only.
export async function startRecording(opts: { onLevel?: (level: number) => void; onTick?: (seconds: number) => void; onLimit?: () => void }): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(1000);

  let ctx: AudioContext | null = null;
  let raf = 0;
  try {
    ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      opts.onLevel?.(peak / 128);
      raf = requestAnimationFrame(loop);
    };
    loop();
  } catch {
    // no level meter: the recording still works
  }

  const started = Date.now();
  const timer = window.setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    opts.onTick?.(s);
    if (s >= MAX_RECORD_SECONDS) opts.onLimit?.();
  }, 250);

  const finish = () => {
    window.clearInterval(timer);
    cancelAnimationFrame(raf);
    void ctx?.close().catch(() => undefined);
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          finish();
          resolve(new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }));
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      finish();
      chunks.length = 0;
    },
  };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: LlmError | 'too_big' };

// The audio goes to the llm function's transcribe mode and is never stored (PHASE_15_PLUS 2.2).
export async function transcribeAudio(blob: Blob, name = ''): Promise<TranscribeResult> {
  if (blob.size > MAX_AUDIO_BYTES) return { ok: false, error: 'too_big' };
  const mime = blob.type || (name.match(/\.(\w+)$/)?.[1] ? `audio/${name.match(/\.(\w+)$/)![1]!.toLowerCase()}` : 'audio/webm');
  const r = await callLlm<{ text: string }>('transcribe', {}, { audio: { mime, data: await toBase64(blob) } });
  return r.ok ? { ok: true, text: r.data.text } : { ok: false, error: r.error };
}

export const TRANSCRIBE_MESSAGE: Record<LlmError | 'too_big', string> = {
  too_big: 'That recording is over 25 MB. Record or export a shorter one.',
  busy: 'Gemini is napping. Your recording was not saved; try again in a minute.',
  cap: "Today's allowance is used up, so the recording could not be written down. Dictate or type instead.",
  blocked: 'Gemini would not transcribe that one. Try dictating instead.',
  unparseable: 'The transcript came back garbled. Try again, or dictate instead.',
  denied: 'Google refused the Gemini key, so nothing was transcribed. Check the key in Settings. Dictation and typing still work.',
  nokey: 'There is no Gemini key on this phone, so recordings cannot be written down. Add it in Settings; dictation and typing still work.',
  rate: 'That is a lot of transcribing in one hour. Try again in a few minutes, or dictate instead.',
  offline: "You're offline, so the recording cannot be written down yet. Dictation and typing still work.",
  forbidden: 'You seem to be signed out. Sign in again, then record once more.',
  failed: 'The transcription did not come back. Try again in a minute.',
};

// PHASE_15_PLUS 2.4: boss replies read aloud with the browser's own voices, British English where there is one.
// Off by default; a per-device choice.
export const speechOutputSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string) {
  if (!speechOutputSupported()) return;
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-GB';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export const stopSpeaking = () => speechOutputSupported() && window.speechSynthesis.cancel();
