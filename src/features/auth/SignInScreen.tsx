import { useState, type FormEvent } from 'react';
import { StickFigure } from '../../art/StickFigure';
import { useInstanceName } from '../../lib/instance';
import { supabase, supabaseConfigured } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { InviteScreen } from './InviteScreen';

export function signInMessage(error: { message: string; status?: number } | null, online: boolean): string | null {
  if (!error) return null;
  if (!online) return "You're offline. Signing in needs the internet once; after that the app remembers you.";
  if (error.status === 400 || /invalid login/i.test(error.message)) return 'That email and password do not match. Check them and try again.';
  if (error.status === 429) return 'Too many tries in a row. Wait a minute, then try again.';
  return 'Signing in did not work just now. Try again in a moment.';
}

const field = 'block w-full rounded-input border-2 border-ink bg-paper-raised px-3 py-3 text-body text-ink';

// Sign in. Accounts are made only through an invite code (PHASE_15_PLUS 4.1); public sign-ups stay off.
export default function SignInScreen() {
  const [inviting, setInviting] = useState(false);
  const instanceName = useInstanceName();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setMessage(signInMessage(error, navigator.onLine));
    setBusy(false);
  }

  if (inviting) return <InviteScreen onBack={() => setInviting(false)} />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-end gap-3">
        <StickFigure pose="cheer" expression="delighted" props={[{ key: 'lantern' }]} size={110} seed={9} />
        <div className="pb-3">
          <h1 className="text-heading">{instanceName}</h1>
          <p className="text-small text-ink-soft">Wander the library. Practise in order.</p>
        </div>
      </div>

      {!supabaseConfigured && (
        <p className="mb-4 rounded-input border-2 border-coral bg-coral-tint p-3 text-small" role="alert">
          This build has no Supabase settings, so signing in cannot work. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-small font-semibold">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} required />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-small font-semibold">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
            required
          />
        </div>
        {message && (
          <p className="text-small" role="alert">
            {message}
          </p>
        )}
        <Button type="submit" block disabled={busy || !email || !password}>
          {busy ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <button type="button" onClick={() => setInviting(true)} className="mt-4 min-h-12 self-start font-semibold underline decoration-2 underline-offset-4">
        I have an invitation
      </button>
    </div>
  );
}
