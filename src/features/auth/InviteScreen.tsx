import { useState, type FormEvent } from 'react';
import type { InviteError } from '../../../supabase/functions/invite/logic';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { PrivacyNote } from './Privacy';

const field = 'block w-full rounded-input border-2 border-ink bg-paper-raised px-3 py-3 text-body text-ink';

export const INVITE_MESSAGE: Record<InviteError | 'offline', string> = {
  invalid: 'That code is not one this app knows. Check it with the person who invited you.',
  expired: 'That code has expired. Ask for a fresh one.',
  used: 'That code has already been used. Ask for a fresh one.',
  full: 'This copy of wonderwander is full for now. Ask the person who invited you.',
  exists: 'There is already an account with that email. Sign in instead.',
  weak: 'Choose a password of at least 8 characters.',
  email: 'That email does not look right.',
  bad_request: 'That did not work just now. Try again in a moment.',
  failed: 'That did not work just now. Try again in a moment.',
  offline: "You're offline. Joining needs the internet once.",
};

async function askInvite(body: object): Promise<InviteError | 'offline' | null> {
  if (!navigator.onLine) return 'offline';
  const { data, error } = await supabase.functions.invoke('invite', { body });
  if (error) return 'failed';
  const r = data as { ok?: boolean; error?: InviteError };
  return r.ok ? null : (r.error ?? 'failed');
}

// PHASE_15_PLUS 4.1: joining with an invite code. Step one checks the code; step two shows the privacy note and makes
// the account, then signs in.
export function InviteScreen({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('');
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function checkCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const err = await askInvite({ code, check: true });
    if (err) setMessage(INVITE_MESSAGE[err]);
    else setChecked(true);
    setBusy(false);
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const err = await askInvite({ code, email: email.trim(), password });
    if (err) {
      setMessage(INVITE_MESSAGE[err]);
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage('Your account is ready, but signing in did not work just now. Go back and sign in.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-heading">Join with an invitation</h1>
      {!checked ? (
        <form onSubmit={checkCode} className="flex flex-col gap-4" noValidate>
          <p className="text-small text-ink-soft">The person who invited you has a ten letter code for you.</p>
          <div>
            <label htmlFor="invite-code" className="mb-1.5 block text-small font-semibold">
              Invite code
            </label>
            <input
              id="invite-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${field} uppercase tracking-widest`}
            />
          </div>
          {message && (
            <p role="alert" className="text-small">
              {message}
            </p>
          )}
          <Button type="submit" block disabled={busy || code.replace(/\W/g, '').length < 10}>
            {busy ? 'Checking...' : 'Continue'}
          </Button>
        </form>
      ) : (
        <form onSubmit={join} className="flex flex-col gap-4" noValidate>
          <p className="text-small text-ink-soft">That code works. Read this, then make your account.</p>
          <PrivacyNote />
          <div>
            <label htmlFor="join-email" className="mb-1.5 block text-small font-semibold">
              Email
            </label>
            <input id="join-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="join-password" className="mb-1.5 block text-small font-semibold">
              Password (at least 8 characters)
            </label>
            <input id="join-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </div>
          {message && (
            <p role="alert" className="text-small">
              {message}
            </p>
          )}
          <Button type="submit" block disabled={busy || !email.trim() || password.length < 8}>
            {busy ? 'Making your account...' : 'Agree and make my account'}
          </Button>
        </form>
      )}
      <button type="button" onClick={onBack} className="mt-4 min-h-12 self-start font-semibold underline decoration-2 underline-offset-4">
        Back to sign in
      </button>
    </div>
  );
}
