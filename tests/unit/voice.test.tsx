import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geminiMime, INLINE_LIMIT, looksLooped, transcribe, TRANSCRIBE_PROMPT } from '../../supabase/functions/llm/audio';
import { TextArea } from '../../src/ui/TextArea';
import { joinText } from '../../src/ui/Voice';

const invoke = vi.fn();
vi.mock('../../src/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

// A stand-in for Chrome's webkitSpeechRecognition.
class FakeRecognition {
  static last: FakeRecognition | null = null;
  static all: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
    FakeRecognition.all.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
  }
  abort() {}
  emit(text: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
  }
  // the whole result list, as Chrome passes it on every event
  emitAll(list: [string, boolean][]) {
    this.onresult?.({ resultIndex: 0, results: list.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })) });
  }
}

// A stand-in for MediaRecorder and the microphone.
class FakeRecorder {
  static last: FakeRecorder | null = null;
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    FakeRecorder.last = this;
  }
  static isTypeSupported = () => true;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['sound'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

function Field() {
  const [v, setV] = useState('First words.');
  return <TextArea label="Your answer" value={v} onChange={setV} />;
}

const w = window as unknown as Record<string, unknown>;
beforeEach(() => {
  FakeRecognition.all = [];
  invoke.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) } });
  w.MediaRecorder = FakeRecorder;
});
afterEach(() => {
  delete w.webkitSpeechRecognition;
  delete w.MediaRecorder;
  vi.useRealTimers();
});

describe('live dictation (PHASE_15_PLUS 2.1)', () => {
  it('starts on a tap in en-PK, shows interim text greyed, appends final text, stops on a second tap', () => {
    w.webkitSpeechRecognition = FakeRecognition;
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate (hold to record)' }));
    const rec = FakeRecognition.last!;
    expect(rec.started).toBe(true);
    expect(rec).toMatchObject({ lang: 'en-PK', continuous: true, interimResults: true });
    expect(screen.getByText('Listening. Tap the mic to stop.')).toBeTruthy();

    act(() => rec.emit('the premise is', false));
    expect(screen.getByText('the premise is').className).toContain('text-ink-soft');
    act(() => rec.emit('the premise is false', true));
    expect((screen.getByLabelText('Your answer') as HTMLTextAreaElement).value).toBe('First words. the premise is false');

    fireEvent.click(screen.getByRole('button', { name: 'Stop dictating' }));
    expect(rec.started).toBe(false);
    expect(screen.getByRole('button', { name: 'Dictate (hold to record)' })).toBeTruthy();
  });

  it('never doubles words when the browser repeats or re-extends its results, as Chrome on Android does', () => {
    w.webkitSpeechRecognition = FakeRecognition;
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate (hold to record)' }));
    const rec = FakeRecognition.last!;
    const field = () => (screen.getByLabelText('Your answer') as HTMLTextAreaElement).value;
    act(() => rec.emitAll([['hello', true]]));
    act(() => rec.emitAll([['hello', true], ['hello', true]]));
    act(() => rec.emitAll([['hello', true], ['hello', true], ['hello how', true]]));
    act(() => rec.emitAll([['hello', true], ['hello', true], ['hello how', true], ['hello how are you', true], ['are you doing', false]]));
    expect(field()).toBe('First words. hello how are you');
    expect(screen.getByText('doing').className).toContain('text-ink-soft');
    act(() => rec.emitAll([['hello', true], ['hello', true], ['hello how', true], ['hello how are you', true], ['are you doing', true]]));
    expect(field()).toBe('First words. hello how are you doing');
    // a separate segment, as desktop Chrome sends one, follows with a space
    act(() => rec.emitAll([['hello how are you doing', true], ['I am fine', true]]));
    expect(field()).toBe('First words. hello how are you doing I am fine');
  });

  it('falls back to en-GB when the browser has no en-PK', () => {
    w.webkitSpeechRecognition = FakeRecognition;
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Dictate (hold to record)' }));
    act(() => FakeRecognition.last!.onerror?.({ error: 'language-not-supported' }));
    expect(FakeRecognition.all.map((r) => r.lang)).toEqual(['en-PK', 'en-GB']);
    expect(FakeRecognition.last!.started).toBe(true);
  });

  it('without the Web Speech API a tap records instead, and the transcript lands in the field', async () => {
    invoke.mockResolvedValue({ data: { result: { text: 'spoken words' } }, error: null });
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));
    expect(await screen.findByText('Recording. Tap the mic to stop.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByDisplayValue('First words. spoken words');
    expect(invoke).toHaveBeenCalledWith('llm', { body: expect.objectContaining({ mode: 'transcribe', audio: expect.objectContaining({ mime: 'audio/webm' }) }) });
  });
});

describe('hold to record (PHASE_15_PLUS 2.2)', () => {
  it('records while held, stops on release and transcribes', async () => {
    w.webkitSpeechRecognition = FakeRecognition;
    invoke.mockResolvedValue({ data: { result: { text: 'a long answer' } }, error: null });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Field />);
    const mic = screen.getByRole('button', { name: 'Dictate (hold to record)' });
    fireEvent.pointerDown(mic, { clientX: 10, clientY: 10, pointerId: 1 });
    await act(async () => void vi.advanceTimersByTime(450));
    expect(await screen.findByText('Release to stop. Slide away to cancel.')).toBeTruthy();
    fireEvent.pointerUp(mic, { pointerId: 1 });
    fireEvent.click(mic);
    await screen.findByDisplayValue('First words. a long answer');
    expect(FakeRecognition.all).toHaveLength(0); // a hold never starts dictation
  });

  it('sliding away cancels: nothing is transcribed', async () => {
    w.webkitSpeechRecognition = FakeRecognition;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Field />);
    const mic = screen.getByRole('button', { name: 'Dictate (hold to record)' });
    fireEvent.pointerDown(mic, { clientX: 10, clientY: 10, pointerId: 1 });
    await act(async () => void vi.advanceTimersByTime(450));
    await screen.findByText('Release to stop. Slide away to cancel.');
    fireEvent.pointerMove(mic, { clientX: 150, clientY: 10, pointerId: 1 });
    expect(screen.getByText('Release to cancel.')).toBeTruthy();
    fireEvent.pointerUp(mic, { pointerId: 1 });
    fireEvent.click(mic);
    await act(async () => void vi.advanceTimersByTime(50));
    expect(invoke).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Your answer') as HTMLTextAreaElement).value).toBe('First words.');
  });
});

describe('transcription on the server (PHASE_15_PLUS 2.2 and 2.3)', () => {
  const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'The words spoken.' }] }, finishReason: 'STOP' }] }));

  it('sends small audio inline with the plan instruction', async () => {
    const calls: { url: string; body: string }[] = [];
    const r = await transcribe({ mime: 'audio/webm;codecs=opus', data: btoa('sound') }, { apiKey: 'k', model: 'm', fetchImpl: async (url, init) => (calls.push({ url: String(url), body: String(init?.body) }), ok()) });
    expect(r).toEqual({ ok: true, text: 'The words spoken.' });
    const body = JSON.parse(calls[0]!.body);
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'audio/webm', data: btoa('sound') } });
    expect(body.contents[0].parts[1].text).toBe(TRANSCRIBE_PROMPT);
  });

  it('sends large audio through the Files API, then deletes the file', async () => {
    const big = btoa('x'.repeat(INLINE_LIMIT + 10));
    const seen: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen.push(`${init?.method ?? 'GET'} ${url.replace('https://generativelanguage.googleapis.com', '')}`);
      if (url.endsWith('/upload/v1beta/files')) return new Response('{}', { headers: { 'x-goog-upload-url': 'https://upload.example/u1' } });
      if (url === 'https://upload.example/u1') return new Response(JSON.stringify({ file: { name: 'files/abc', uri: 'https://gen/files/abc', state: 'ACTIVE' } }));
      if (url.includes(':generateContent')) {
        expect(JSON.parse(String(init?.body)).contents[0].parts[0]).toEqual({ file_data: { mime_type: 'audio/m4a', file_uri: 'https://gen/files/abc' } });
        return ok();
      }
      return new Response('{}');
    }) as typeof fetch;
    const r = await transcribe({ mime: 'audio/mp4', data: big }, { apiKey: 'k', model: 'm', fetchImpl });
    expect(r.ok).toBe(true);
    expect(seen).toEqual(['POST /upload/v1beta/files', 'POST https://upload.example/u1', 'POST /v1beta/models/m:generateContent', 'DELETE /v1beta/files/abc']);
  });

  it('refuses audio over 25 MB and a looped transcript', async () => {
    expect(await transcribe({ mime: 'audio/wav', data: btoa('x'.repeat(25 * 1024 * 1024 + 1)) }, { apiKey: 'k', model: 'm', fetchImpl: async () => ok() })).toMatchObject({ ok: false });
    const loop = Array(10).fill('premise two says that a series of causes cannot go on forever so').join(' ');
    expect(looksLooped(loop)).toBe(true);
    expect(looksLooped('An ordinary answer that says a thing once and then stops, as people do.')).toBe(false);
    const looped = await transcribe({ mime: 'audio/webm', data: btoa('s') }, { apiKey: 'k', model: 'm', fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: loop }] }, finishReason: 'MAX_TOKENS' }] })) });
    expect(looped).toMatchObject({ ok: false, detail: 'repetition loop' });
  });

  it('names formats the way Gemini expects, and joins text with one space', () => {
    expect(geminiMime('audio/x-wav')).toBe('audio/wav');
    expect(geminiMime('audio/mpeg')).toBe('audio/mp3');
    expect(geminiMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(joinText('One.', 'Two.')).toBe('One. Two.');
    expect(joinText('', 'Two.')).toBe('Two.');
    expect(joinText('One.\n', 'Two.')).toBe('One.\nTwo.');
  });
});

describe('merging recognition results', () => {
  it('keeps separate segments, drops repeats and extends at the overlap', async () => {
    const { mergeResults, wordsAfter } = await import('../../src/lib/voice');
    expect(mergeResults(['the premise', 'is false'])).toBe('the premise is false');
    expect(mergeResults(['hello', 'hello', 'hello', 'hello how', 'hello how are', 'hello how are you'])).toBe('hello how are you');
    expect(mergeResults(['so the first', 'the first premise fails'])).toBe('so the first premise fails');
    expect(mergeResults(['Hello,', 'hello how'])).toBe('hello how'.replace('hello', 'Hello,'));
    expect(mergeResults(['', '  '])).toBe('');
    expect(wordsAfter('hello how are you', 'are you doing')).toBe('doing');
    expect(wordsAfter('', 'just started')).toBe('just started');
  });
});
