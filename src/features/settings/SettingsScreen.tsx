import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readPref, writePref } from '../../lib/prefs';
import { useProfile, type Profile } from '../../lib/profile';
import { speak, speechOutputSupported } from '../../lib/voice';
import { download, exportData } from '../../lib/exportData';
import { currentSubscription, pushSupport, sendTestReminder, turnOffReminders, turnOnReminders } from '../../lib/push';
import { supabase } from '../../lib/supabase';
import { allTimezones } from '../../lib/timezones';
import { DeleteAccountSection, GeminiKeySection, InvitationsSection, PrivacySection, useIsOwner } from './HostedSections';
import { Button } from '../../ui/Button';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SettingsScreen() {
  const { profile, save } = useProfile();
  const owner = useIsOwner();
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const done = (ok: boolean) => setSaved(ok ? 'Saved.' : 'That did not save. Check your connection and try again.');

  return (
    <div>
      <h1 className="mb-6 text-[28px] font-bold">Me</h1>

      <section className="mb-8 flex flex-col gap-5">
        <div>
          <label htmlFor="display-name" className="mb-1.5 block text-small font-semibold">
            Display name
          </label>
          <div className="flex gap-3">
            <input
              id="display-name"
              value={name ?? profile.display_name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-12 min-w-0 flex-1 rounded-input border-2 border-ink bg-paper-raised px-3 text-body"
            />
            <Button variant="secondary" disabled={!name?.trim() || name.trim() === profile.display_name} onClick={async () => done(await save({ display_name: name!.trim() }))}>
              Save
            </Button>
          </div>
        </div>
        <div>
          <label htmlFor="weekend-day" className="mb-1.5 block text-small font-semibold">
            Weekend ritual day
          </label>
          <select
            id="weekend-day"
            value={profile.weekend_day}
            onChange={async (e) => done(await save({ weekend_day: Number(e.target.value) }))}
            className="block min-h-12 w-full rounded-input border-2 border-ink bg-paper-raised px-3 text-body"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-caption text-ink-soft">On this day Today becomes the weekend ritual. The track rotates A, B, C each week.</p>
        </div>
        <div>
          <label htmlFor="timezone" className="mb-1.5 block text-small font-semibold">
            Timezone
          </label>
          <select
            id="timezone"
            value={profile.timezone}
            onChange={async (e) => done(await save({ timezone: e.target.value }))}
            className="block min-h-12 w-full rounded-input border-2 border-ink bg-paper-raised px-3 text-body"
          >
            {allTimezones(profile.timezone).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        {saved && (
          <p role="status" className="text-small">
            {saved}
          </p>
        )}
      </section>

      <GeminiKeySection owner={owner} />

      <Reminders profile={profile} save={async (p) => done(await save(p))} />

      <BossVoice />

      <section className="mb-8">
        <h2 className="mb-2 text-title">Appeals</h2>
        <p className="mb-3 text-small">Think a fail was wrong? Appeal it from the result, then get a second opinion here.</p>
        <Link to="/me/appeals" className="inline-flex min-h-12 items-center font-semibold">
          Open appeals
        </Link>
      </section>

      <DataExport />

      {owner && <InvitationsSection />}

      <PrivacySection />

      <DeleteAccountSection owner={owner} />

      {owner && <p className="text-small text-ink-soft">The free Supabase project pauses after about a week without use; daily practice keeps it awake. If it ever pauses, restore it from the Supabase dashboard and nothing is lost.</p>}
      <p className="mt-6 flex gap-6">
        <Link to="/me/about" className="inline-flex min-h-12 items-center font-semibold">
          About, licences and versions
        </Link>
      </p>
      <p className="mt-2">
        <Link to="/gallery">Design gallery</Link>
      </p>
      <div className="mt-10">
        <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

// BUILD_PLAN 18: one reminder a day at the chosen hour, only when more cards are due than the threshold.
function Reminders({ profile, save }: { profile: Profile; save: (p: Partial<Profile>) => Promise<void> }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const support = pushSupport();
  useEffect(() => {
    currentSubscription().then(
      (s) => setOn(Boolean(s)),
      () => setOn(false),
    );
  }, []);

  const NOTE = {
    denied: 'Notifications are blocked for this site. Allow them in Chrome site settings, then try again.',
    no_worker: 'Install the app from Chrome first (Add to Home screen), then turn reminders on there.',
    failed: 'That did not work. Check your connection and try again.',
  } as const;

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-title">Card reminders</h2>
      {support === 'unsupported' ? (
        <p className="text-small">This browser cannot show reminders. Chrome on Android can.</p>
      ) : (
        <>
          <p className="mb-3 text-small">
            One reminder at {hourLabel(profile.push_hour)} when more than {profile.push_threshold} cards are due. Nothing else ever sends a notification.
          </p>
          {on ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await sendTestReminder();
                  setNote(r ? (r.sent ? 'Test reminder sent. It should arrive in a few seconds.' : 'No device is subscribed yet.') : NOTE.failed);
                  setBusy(false);
                }}
              >
                Send a test
              </Button>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={async () => {
                  await turnOffReminders();
                  setOn(false);
                  setNote('Reminders are off on this phone.');
                }}
              >
                Turn off
              </Button>
            </div>
          ) : (
            <Button
              disabled={busy || on === null || support === 'denied'}
              onClick={async () => {
                setBusy(true);
                const r = await turnOnReminders();
                if (r === 'on') {
                  setOn(true);
                  setNote('Reminders are on.');
                } else setNote(NOTE[r]);
                setBusy(false);
              }}
            >
              Turn on card reminders
            </Button>
          )}
          {support === 'denied' && <p className="mt-2 text-small">{NOTE.denied}</p>}
          {note && (
            <p role="status" className="mt-3 text-small">
              {note}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="push-hour" className="mb-1.5 block text-small font-semibold">
                Time
              </label>
              <select id="push-hour" value={profile.push_hour} onChange={(e) => save({ push_hour: Number(e.target.value) })} className="block min-h-12 w-full rounded-input border-2 border-ink bg-paper-raised px-3 text-body">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="push-threshold" className="mb-1.5 block text-small font-semibold">
                When more than
              </label>
              <select
                id="push-threshold"
                value={profile.push_threshold}
                onChange={(e) => save({ push_threshold: Number(e.target.value) })}
                className="block min-h-12 w-full rounded-input border-2 border-ink bg-paper-raised px-3 text-body"
              >
                {[4, 6, 8, 10, 12, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} cards
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// BUILD_PLAN 24: a monthly backup, since the free plan keeps no point-in-time copy.
function DataExport() {
  const [state, setState] = useState<string | null>(null);
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-title">Your data</h2>
      <p className="mb-3 text-small">Everything you have answered, as one file. Once a month is a good habit.</p>
      <Button
        variant="secondary"
        onClick={async () => {
          setState('Gathering...');
          try {
            const out = await exportData();
            download(out.name, out.json);
            setState(`Saved ${out.name}: ${Object.values(out.counts).reduce((a, b) => a + b, 0)} rows.`);
          } catch {
            setState('That did not work. Check your connection and try again.');
          }
        }}
      >
        Download my data
      </Button>
      {state && (
        <p role="status" className="mt-2 text-small">
          {state}
        </p>
      )}
    </section>
  );
}

// PHASE_15_PLUS 2.4: never on by default.
function BossVoice() {
  const [on, setOn] = useState(() => readPref<boolean>('boss.speak', false));
  if (!speechOutputSupported()) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-title">Boss voices</h2>
      <label className="flex min-h-12 items-center justify-between gap-3 text-body">
        Read boss replies aloud
        <input
          type="checkbox"
          className="h-6 w-6 accent-[var(--grape)]"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            writePref('boss.speak', e.target.checked);
            if (e.target.checked) speak('The judge will now rule.');
          }}
        />
      </label>
      <p className="text-small text-ink-soft">Uses this phone's own voices, offline and free.</p>
    </section>
  );
}
