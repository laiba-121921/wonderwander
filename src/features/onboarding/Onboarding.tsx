import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { StickFigure } from '../../art/StickFigure';
import { checkGeminiKey } from '../../engines/grading/llm';
import { looksLikeKey, setGeminiKey } from '../../lib/geminiKey';
import { readPref, writePref } from '../../lib/prefs';
import { DEFAULT_PROFILE } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { allTimezones, detectedTimezone } from '../../lib/timezones';
import { Button } from '../../ui/Button';
import { ensureProfile } from '../auth/useSession';

const field = 'block w-full rounded-input border-2 border-ink bg-paper-raised px-3 py-3 text-body text-ink';
export const AI_STUDIO_KEYS = 'https://aistudio.google.com/apikey';

export const KEY_CHECK_MESSAGE = {
  shape: 'That does not look like a Gemini key. Copy the whole key from Google AI Studio.',
  denied: 'Google did not accept that key. Copy it again from Google AI Studio, or make a new one there.',
  busy: 'Google did not answer just now. Try again in a moment.',
  offline: "You're offline. Checking the key needs the internet.",
} as const;

// Checks a key with Google, then keeps it on this phone. Returns a message on failure.
export async function acceptKey(key: string): Promise<string | null> {
  if (!looksLikeKey(key)) return KEY_CHECK_MESSAGE.shape;
  const r = await checkGeminiKey(key);
  if (r !== 'ok') return KEY_CHECK_MESSAGE[r];
  await setGeminiKey(key);
  return null;
}

// PHASE_15_PLUS 4.2: a new account's first run (name, timezone, Gemini key) before anything else. Accounts that have
// finished it, or that existed before it, go straight in. The answer is remembered per account on the device.
export function OnboardingGate({ userId, children }: { userId: string; children: ReactNode }) {
  const pref = `onboarded.${userId}`;
  const [state, setState] = useState<'checking' | 'needed' | 'done'>(() => (readPref(pref, false) ? 'done' : 'checking'));

  useEffect(() => {
    if (state !== 'checking') return;
    let live = true;
    (async () => {
      await ensureProfile();
      const { data, error } = await supabase.from('profile').select('onboarded').maybeSingle();
      if (!live) return;
      // offline or unreadable: never lock an existing user out
      if (error || !data) return setState(error ? 'done' : 'needed');
      if ((data as { onboarded?: boolean }).onboarded === false) return setState('needed');
      writePref(pref, true);
      setState('done');
    })();
    return () => {
      live = false;
    };
  }, [state, pref]);

  if (state === 'done') return <>{children}</>;
  if (state === 'checking') return null;
  return (
    <Onboarding
      onDone={() => {
        writePref(pref, true);
        setState('done');
      }}
    />
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function finish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const problem = await acceptKey(key);
    if (problem) {
      setMessage(problem);
      setBusy(false);
      return;
    }
    const profile = { display_name: name.trim(), timezone, onboarded: true };
    const { error } = await supabase.from('profile').upsert(profile, { onConflict: 'user_id' });
    if (error) {
      setMessage('Your key is saved, but your details did not save. Check your connection and try again.');
      setBusy(false);
      return;
    }
    writePref('profile', { ...DEFAULT_PROFILE, display_name: profile.display_name, timezone });
    onDone();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-end gap-3">
        <StickFigure pose={step === 3 ? 'think' : 'cheer'} expression="delighted" size={96} seed={4} />
        <p className="pb-3 text-small text-ink-soft">Step {step} of 3</p>
      </div>

      {step === 1 && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(2);
          }}
        >
          <h1 className="text-heading">What should the app call you?</h1>
          <div>
            <label htmlFor="onboard-name" className="mb-1.5 block text-small font-semibold">
              Your name
            </label>
            <input id="onboard-name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} className={field} maxLength={40} />
          </div>
          <Button type="submit" block disabled={!name.trim()}>
            Next
          </Button>
        </form>
      )}

      {step === 2 && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(3);
          }}
        >
          <h1 className="text-heading">Your timezone</h1>
          <div>
            <label htmlFor="onboard-timezone" className="mb-1.5 block text-small font-semibold">
              Timezone
            </label>
            <select id="onboard-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={`${field} min-h-12`}>
              {allTimezones(timezone).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-caption text-ink-soft">Days, locks and reminders follow this clock. It was read from your phone.</p>
          </div>
          <Button type="submit" block>
            Next
          </Button>
          <BackButton onClick={() => setStep(1)} />
        </form>
      )}

      {step === 3 && (
        <form className="flex flex-col gap-4" onSubmit={finish} noValidate>
          <h1 className="text-heading">Your Gemini key</h1>
          <p className="text-body">wonderwander checks your answers with Google's Gemini, using your own free key. Without one, nothing can be checked, so practice cannot start.</p>
          <a href={AI_STUDIO_KEYS} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center font-semibold">
            Get a free key in Google AI Studio
          </a>
          <div>
            <label htmlFor="onboard-key" className="mb-1.5 block text-small font-semibold">
              Gemini API key
            </label>
            <input id="onboard-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} className={field} />
            <p className="mt-1.5 text-caption text-ink-soft">It stays on this phone, encrypted, and is never saved on the server.</p>
          </div>
          {message && (
            <p role="alert" className="text-small">
              {message}
            </p>
          )}
          <Button type="submit" block disabled={busy || !key.trim()}>
            {busy ? 'Checking with Google...' : 'Check and finish'}
          </Button>
          <BackButton onClick={() => setStep(2)} />
        </form>
      )}
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-12 self-start font-semibold underline decoration-2 underline-offset-4">
      Back
    </button>
  );
}
