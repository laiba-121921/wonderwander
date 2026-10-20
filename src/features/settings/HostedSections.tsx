import { useEffect, useState, type FormEvent } from 'react';
import { makeCode } from '../../../supabase/functions/invite/logic';
import { getGeminiKey, maskKey, removeGeminiKey } from '../../lib/geminiKey';
import { useInstanceName } from '../../lib/instance';
import { writePref } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { PrivacyNote } from '../auth/Privacy';
import { acceptKey, AI_STUDIO_KEYS } from '../onboarding/Onboarding';

const field = 'block min-h-12 w-full rounded-input border-2 border-ink bg-paper-raised px-3 text-body';

// The instance owner, asked once per screen visit; anyone else never sees the owner's sections.
export function useIsOwner(): boolean {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.rpc('is_owner').then(({ data }) => live && setOwner(data === true));
    return () => {
      live = false;
    };
  }, []);
  return owner;
}

// PHASE_15_PLUS 4.3: the key on this phone, masked, with Replace and Remove.
export function GeminiKeySection({ owner }: { owner: boolean }) {
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    getGeminiKey().then(setKey, () => setKey(null));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const problem = await acceptKey(draft);
    setBusy(false);
    if (problem) return setMessage(problem);
    setKey(draft.trim());
    setDraft('');
    setEditing(false);
    setMessage('Key saved on this phone.');
  }

  return (
    <section id="gemini-key" className="mb-8 scroll-mt-4">
      <h2 className="mb-2 text-title">Gemini key</h2>
      {key === undefined ? null : key ? (
        <p className="mb-3 text-body">
          On this phone: <span className="font-mono">{maskKey(key)}</span>
        </p>
      ) : (
        <p className="mb-3 text-body">{owner
            ? 'No key on this phone, so your checks use your own key from the Supabase secret GEMINI_API_KEY. It is never used for anyone else: their checks are refused until they add their own.'
            : 'No key on this phone yet, so nothing can be checked.'}</p>
      )}
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3" noValidate>
          <label htmlFor="settings-key" className="block text-small font-semibold">
            New Gemini API key
          </label>
          <input id="settings-key" type="password" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} className={field} />
          <a href={AI_STUDIO_KEYS} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center font-semibold">
            Get a free key in Google AI Studio
          </a>
          <div className="flex gap-3">
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? 'Checking...' : 'Check and save'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {key ? 'Replace' : 'Add a key'}
          </Button>
          {key && (
            <Button
              variant="secondary"
              onClick={async () => {
                await removeGeminiKey();
                setKey(null);
                setMessage('Key removed from this phone.');
              }}
            >
              Remove
            </Button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-small">
          {message}
        </p>
      )}
    </section>
  );
}

interface Invite {
  code: string;
  max_uses: number;
  uses: number;
  expires_at: string;
}

// PHASE_15_PLUS 4.1: the owner's invite codes, and how many accounts the instance has against its cap.
export function InvitationsSection() {
  const [status, setStatus] = useState<{ users: number; cap: number } | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [uses, setUses] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.rpc('instance_status'),
      supabase.from('invite').select('code,max_uses,uses,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ]).then(([{ data: s }, { data: rows }]) => {
      if (!live) return;
      setStatus((s as { users: number; cap: number } | null) ?? null);
      setInvites(((rows as Invite[] | null) ?? []).filter((r) => r.uses < r.max_uses));
    });
    return () => {
      live = false;
    };
  }, [version]);

  async function mint() {
    setMessage(null);
    const { error } = await supabase.from('invite').insert({ code: makeCode(), max_uses: uses });
    if (error) return setMessage('That code did not save. Check your connection and try again.');
    setVersion((v) => v + 1);
  }

  return (
    <section className="mb-8">
      <InstanceName />
      <h2 className="mb-2 text-title">Invitations</h2>
      <p className="mb-3 text-small">
        Only you see this. {status ? `${status.users} of ${status.cap} accounts in use.` : ''} A code lasts 14 days. Send it with the link to this app.
      </p>
      <div className="mb-3 flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="invite-uses" className="mb-1.5 block text-small font-semibold">
            People per code
          </label>
          <select id="invite-uses" value={uses} onChange={(e) => setUses(Number(e.target.value))} className={field}>
            {[1, 2, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void mint()}>Make a code</Button>
      </div>
      {invites.length > 0 && (
        <ul className="flex flex-col gap-2">
          {invites.map((i) => (
            <li key={i.code} className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/10">
              <span className="font-mono text-body tracking-widest select-all">{i.code}</span>
              <span className="text-caption text-ink-soft">
                {i.uses} of {i.max_uses} used, until {new Date(i.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role="alert" className="mt-2 text-small">
          {message}
        </p>
      )}
    </section>
  );
}

export function PrivacySection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-8">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center justify-between text-left text-title">
        Privacy
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <PrivacyNote heading="h3" />}
    </section>
  );
}

// PHASE_15_PLUS 4.4: deletes the account and everything in it. Typing the word guards against a slip of the thumb.
export function DeleteAccountSection({ owner }: { owner: boolean }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error || !(data as { ok?: boolean })?.ok) {
      setBusy(false);
      return setMessage('Nothing was deleted: that did not go through. Check your connection and try again.');
    }
    await removeGeminiKey().catch(() => undefined);
    try {
      localStorage.clear();
    } catch {
      // nothing stored on this phone, or storage blocked
    }
    await supabase.auth.signOut({ scope: 'local' });
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-title">Delete my account</h2>
      {owner ? (
        <p className="text-small">You run this copy of wonderwander, so your account is removed from the Supabase dashboard instead.</p>
      ) : (
        <>
          <p className="mb-3 text-small">This deletes your answers, progress, cards, essays, uploaded drafts and the account itself, at once. It cannot be undone.</p>
          <label htmlFor="delete-confirm" className="mb-1.5 block text-small font-semibold">
            Type delete to confirm
          </label>
          <input id="delete-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className={`${field} mb-3`} />
          <Button variant="secondary" disabled={busy || typed.trim().toLowerCase() !== 'delete'} onClick={() => void remove()}>
            {busy ? 'Deleting...' : 'Delete everything'}
          </Button>
        </>
      )}
      {message && (
        <p role="alert" className="mt-2 text-small">
          {message}
        </p>
      )}
    </section>
  );
}

// PHASE_15_PLUS 5: the name on the sign-in screen, for the owner to change.
function InstanceName() {
  const current = useInstanceName();
  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const value = name ?? current;
  async function save() {
    const next = value.trim();
    const { error } = await supabase.from('app_config').update({ instance_name: next }).eq('one', true);
    if (error) return setMessage('That did not save. Check your connection and try again.');
    writePref('instance_name', next);
    setMessage('Saved. The sign-in screen now shows it.');
  }
  return (
    <div className="mb-6">
      <label htmlFor="instance-name" className="mb-1.5 block text-small font-semibold">
        Name of this app (shown on the sign-in screen)
      </label>
      <div className="flex gap-3">
        <input id="instance-name" value={value} maxLength={40} onChange={(e) => setName(e.target.value)} className={`${field} min-w-0 flex-1`} />
        <Button variant="secondary" disabled={!value.trim() || value.trim() === current} onClick={() => void save()}>
          Rename
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-2 text-small">
          {message}
        </p>
      )}
    </div>
  );
}
