import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StickFigure } from '../art/StickFigure';
import { dictationSupported, MAX_RECORD_SECONDS, recordingSupported, startDictation, startRecording, tick, transcribeAudio, TRANSCRIBE_MESSAGE, type Recording } from '../lib/voice';

type Mode = 'idle' | 'listening' | 'recording' | 'transcribing';

const HOLD_MS = 400;
const CANCEL_DISTANCE = 70;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// New words follow the old with one space, or straight after any space or line break the student left.
export const joinText = (current: string, add: string) => (!add ? current : !current.trim() ? add : /\s$/.test(current) ? `${current}${add}` : `${current} ${add}`);

// PHASE_15_PLUS 2.1 and 2.2: tap the mic to dictate live; hold it to record, release to stop, slide away to cancel.
// Without the Web Speech API a tap starts and stops a recording instead.
export function useVoice({ value, onChange, colour = 'var(--amber)' }: { value: string; onChange: (v: string) => void; colour?: string }): { button: ReactNode; status: ReactNode; interim: string } {
  const [mode, setMode] = useState<Mode>('idle');
  const [interim, setInterim] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [held, setHeld] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(value);
  const dictation = useRef<{ stop: () => void } | null>(null);
  const recording = useRef<Recording | null>(null);
  const hold = useRef<number | null>(null);
  const start = useRef<[number, number] | null>(null);
  const longPressed = useRef(false);
  const cancelRef = useRef(false);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  useEffect(
    () => () => {
      dictation.current?.stop();
      recording.current?.cancel();
    },
    [],
  );

  const append = (text: string) => {
    const next = joinText(latest.current, text);
    latest.current = next;
    onChange(next);
  };

  const beginDictation = () => {
    setError(null);
    tick();
    setMode('listening');
    dictation.current = startDictation({
      onInterim: setInterim,
      onFinal: append,
      onEnd: () => {
        dictation.current = null;
        setInterim('');
        setMode('idle');
      },
      onError: (code) => setError(code === 'not-allowed' ? 'The microphone is blocked for this site. Allow it in Chrome site settings.' : 'Dictation stopped. Tap the mic to start again.'),
    });
  };

  const stopDictation = () => {
    tick();
    dictation.current?.stop();
  };

  const beginRecording = async (byHold: boolean) => {
    setError(null);
    try {
      recording.current = await startRecording({
        onLevel: (l) => setLevels((v) => [...v.slice(-31), l]),
        onTick: setSeconds,
        onLimit: () => void finishRecording(),
      });
    } catch {
      setError('The microphone is blocked or busy. Allow it in Chrome site settings.');
      return;
    }
    tick();
    setHeld(byHold);
    setSeconds(0);
    setLevels([]);
    setMode('recording');
  };

  const finishRecording = async () => {
    const r = recording.current;
    recording.current = null;
    if (!r) return;
    tick();
    if (cancelRef.current) {
      r.cancel();
      cancelRef.current = false;
      setCancelArmed(false);
      setMode('idle');
      return;
    }
    setMode('transcribing');
    const blob = await r.stop();
    const out = await transcribeAudio(blob);
    setMode('idle');
    if (out.ok) append(out.text);
    else setError(TRANSCRIBE_MESSAGE[out.error]);
  };

  const onTap = () => {
    if (mode === 'transcribing') return;
    if (mode === 'listening') return stopDictation();
    if (mode === 'recording') return void finishRecording();
    if (dictationSupported()) return beginDictation();
    if (recordingSupported()) return void beginRecording(false);
    setError('This browser has no microphone input. Chrome on Android has.');
  };

  const button = (
    <button
      type="button"
      aria-label={mode === 'listening' ? 'Stop dictating' : mode === 'recording' ? 'Stop recording' : dictationSupported() ? 'Dictate (hold to record)' : 'Record'}
      aria-pressed={mode === 'listening' || mode === 'recording'}
      disabled={mode === 'transcribing'}
      onPointerDown={(e) => {
        if (mode !== 'idle' || !recordingSupported()) return;
        longPressed.current = false;
        start.current = [e.clientX, e.clientY];
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        hold.current = window.setTimeout(() => {
          longPressed.current = true;
          void beginRecording(true);
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        if (!held || mode !== 'recording' || !start.current) return;
        const far = Math.hypot(e.clientX - start.current[0], e.clientY - start.current[1]) > CANCEL_DISTANCE;
        cancelRef.current = far;
        setCancelArmed(far);
      }}
      onPointerUp={() => {
        if (hold.current) window.clearTimeout(hold.current);
        hold.current = null;
        if (longPressed.current && held) void finishRecording();
      }}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onTap();
      }}
      className="relative inline-flex h-12 w-12 shrink-0 touch-none items-center justify-center rounded-full border-2 border-ink bg-paper-raised"
      style={mode === 'listening' || mode === 'recording' ? { background: colour } : undefined}
    >
      {(mode === 'listening' || mode === 'recording') && (
        <span aria-hidden="true" className="absolute inset-0 rounded-full motion-safe:animate-ping" style={{ boxShadow: `0 0 0 4px ${colour}`, opacity: 0.5 }} />
      )}
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );

  let status: ReactNode = null;
  if (mode === 'listening')
    status = (
      <div className="mt-2 flex items-center gap-3 text-small" role="status">
        <StickFigure pose="listen" expression="curious" size={48} seed={5} colour={colour} />
        <span>Listening. Tap the mic to stop.</span>
      </div>
    );
  else if (mode === 'recording')
    status = (
      <div className="mt-2 rounded-input border-2 p-2.5 text-small" style={{ borderColor: cancelArmed ? 'var(--coral)' : colour }} role="status" aria-live="polite">
        <div className="flex h-8 items-end gap-0.5" aria-hidden="true">
          {levels.map((l, i) => (
            <span key={i} className="w-1.5 rounded-sm bg-ink/70" style={{ height: `${Math.max(8, Math.min(100, l * 160))}%` }} />
          ))}
        </div>
        <p className="mt-1.5 flex justify-between gap-2">
          <span>{cancelArmed ? 'Release to cancel.' : held ? 'Release to stop. Slide away to cancel.' : 'Recording. Tap the mic to stop.'}</span>
          <span className="tabular-nums">
            {clock(seconds)} of {clock(MAX_RECORD_SECONDS)}
          </span>
        </p>
      </div>
    );
  else if (mode === 'transcribing')
    status = (
      <p className="mt-2 text-small text-ink-soft" role="status">
        Writing it down...
      </p>
    );
  else if (error)
    status = (
      <p className="mt-2 text-small" role="alert">
        {error}
      </p>
    );

  return { button, status, interim };
}
