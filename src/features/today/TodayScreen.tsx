import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doodle } from '../../art/Doodle';
import { DOMAINS, loadDomain } from '../../content/load';
import type { DomainFile } from '../../content/types';
import { localDate, localHour } from '../../domain/dates';
import type { ItemRow } from '../../domain/lifecycle';
import { isWeekend, TRACK_ORDER, trackPick, weekendActs, weekendTrack, type Act, type TrackLetter } from '../../domain/plan';
import { overallMastery, type Progress } from '../../domain/progress';
import { readPref, writePref } from '../../lib/prefs';
import { useProfile } from '../../lib/profile';
import { fetchProgress } from '../../lib/progress';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { RoughFrame } from '../../ui/RoughFrame';
import { loadDue } from '../cards/CardsScreen';

// BUILD_PLAN 19.8: "Morning, Laiba" / "Evening, Laiba" by local time; just "Morning" until the name has loaded.
export function greeting(hour: number, name = ''): string {
  const part = hour < 12 ? 'Morning' : 'Evening';
  return name.trim() ? `${part}, ${name.trim()}` : part;
}

function TodayCard({ to, colour, seed, title, aside, note }: { to: string; colour: string; seed: number; title: string; aside: string; note: string }) {
  return (
    <Link to={to} className="relative mb-4 block px-4 py-4 text-ink no-underline">
      <RoughFrame radius={18} fill={colour} seed={seed} sticker />
      <span className="relative flex items-baseline justify-between">
        <span className="text-body font-bold">{title}</span>
        <span className="text-small">{aside}</span>
      </span>
      <span className="relative mt-1 block text-small">{note}</span>
    </Link>
  );
}

interface Data {
  files: DomainFile[];
  progress: Progress;
  rows: Record<string, ItemRow>;
}

async function loadToday(): Promise<Data> {
  const [files, progress, items] = await Promise.all([
    Promise.all(DOMAINS.map((d) => loadDomain(d.id))),
    fetchProgress(),
    supabase.from('item_state').select('*'),
  ]);
  return { files, progress, rows: Object.fromEntries(((items.data as ItemRow[]) ?? []).map((r) => [r.item_id, r])) };
}

// The soft "That's your 15 minutes" note (BUILD_PLAN 14.1); there is no streak and no penalty.
function useFifteen(today: string) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const key = `today.start.${today}`;
    const start = readPref<number | null>(key, null) ?? Date.now();
    writePref(key, start);
    const check = () => setOver(Date.now() - start >= 15 * 60 * 1000);
    check();
    const t = window.setInterval(check, 30000);
    return () => window.clearInterval(t);
  }, [today]);
  return over;
}

export default function TodayScreen() {
  const now = new Date();
  const { profile } = useProfile();
  const hour = localHour(now, profile.timezone);
  const today = localDate(now, profile.timezone);
  const [due, setDue] = useState<number | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [track, setTrack] = useState<TrackLetter | null>(() => readPref<TrackLetter | null>(`today.track.${today}`, null));
  const [dailyOnWeekend, setDailyOnWeekend] = useState(false);
  const fifteen = useFifteen(today);

  useEffect(() => {
    loadDue().then(
      ({ core }) => setDue(core.length),
      () => setDue(null),
    );
    loadToday().then(setData, () => setData(null));
  }, []);

  const weekend = isWeekend(now, profile.weekend_day, profile.timezone) && !dailyOnWeekend;
  const pick = data && track ? trackPick(data.files, track, data.progress, data.rows, now) : null;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-[28px] font-bold">{weekend ? 'Weekend ritual' : 'Today'}</h1>
        <Doodle name={hour >= 6 && hour < 18 ? 'sun' : 'moon'} size={40} />
      </header>
      <p className="mb-5 text-title">{greeting(hour, profile.display_name)}</p>

      {weekend && data ? (
        <Ritual data={data} today={today} rotationStart={profile.track_rotation_start} tz={profile.timezone} onDaily={() => setDailyOnWeekend(true)} />
      ) : (
        <>
          <TodayCard to="/pulse" colour="var(--sky)" seed={77} title="Logic pulse" aside="6 items" note="About five minutes. Works offline. Nothing locks here." />
          <TodayCard to="/cards" colour="var(--butter)" seed={78} title="Cards due" aside={due === null ? '' : String(due)} note="Up to eight today. Answer from memory, by voice or typing." />
          <div className="relative mb-4 px-4 py-4">
            <RoughFrame radius={18} fill="var(--bubblegum)" seed={79} sticker />
            <div className="relative">
              <p className="text-body font-bold">Pick a track</p>
              <div className="mt-2 flex gap-2" role="group" aria-label="Track for today">
                {TRACK_ORDER.map((t, i) => (
                  <Chip
                    key={t}
                    selected={track === t}
                    seed={90 + i}
                    aria-label={`Track ${t}`}
                    onClick={() => {
                      setTrack(t);
                      writePref(`today.track.${today}`, t);
                    }}
                  >
                    {t}
                  </Chip>
                ))}
              </div>
              {track && data && (
                <p className="mt-3 text-small">
                  {pick ? (
                    <Link to={pick.href} className="font-semibold">
                      {pick.label}
                    </Link>
                  ) : (
                    `Nothing open in Track ${track} yet. Logic 1 opens the tracks.`
                  )}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {data && (
        <div className="mt-6 flex flex-col gap-1 text-small">
          <span>Overall mastery {Math.round(overallMastery(data.files, data.progress))}%</span>
        </div>
      )}
      {fifteen && !weekend && <p className="mt-5 rounded-card border-2 border-mint bg-mint/40 p-3 text-small">That's your 15 minutes. Keep going if you like.</p>}
    </div>
  );
}

type ActState = Record<string, 'done' | 'skipped'>;

// BUILD_PLAN 14.2: a checklist with progress; any act can be skipped with one tap.
function Ritual({ data, today, rotationStart, tz, onDaily }: { data: Data; today: string; rotationStart: string | null; tz: string; onDaily: () => void }) {
  const now = new Date();
  const track = weekendTrack(data.files, data.progress, now, rotationStart, tz);
  const acts = weekendActs(data.files, data.progress, data.rows, now, track);
  const [state, setState] = useState<ActState>(() => readPref<ActState>(`ritual.${today}`, {}));
  const settled = acts.filter((a) => state[a.key] || !a.next).length;

  const mark = async (a: Act, v: 'done' | 'skipped') => {
    const next = { ...state, [a.key]: v };
    setState(next);
    writePref(`ritual.${today}`, next);
    await supabase
      .from('session_log')
      .upsert({ local_date: today, kind: 'weekend', track, items_done: Object.values(next).filter((x) => x === 'done').length }, { onConflict: 'user_id,local_date,kind' });
  };

  return (
    <div>
      <p className="mb-4 text-small">
        {track ? `This weekend: Track ${track}.` : 'No track has anything open yet.'} {settled} of {acts.length} done.
      </p>
      <ol className="flex flex-col gap-4">
        {acts.map((a, i) => {
          const s = state[a.key] ?? (a.next ? null : 'done');
          return (
            <li key={a.key} className="relative px-4 py-3.5">
              <RoughFrame radius={18} fill={s === 'done' ? 'var(--mint)' : s === 'skipped' ? 'var(--paper)' : 'var(--paper-raised)'} seed={110 + i} sticker={!s} />
              <div className="relative">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-body font-bold">
                    {i + 1}. {a.title}
                  </span>
                  <span className="shrink-0 text-caption">about {a.minutes} min</span>
                </p>
                <p className="mt-1 text-small">{s === 'skipped' ? 'Skipped.' : a.note}</p>
                {!s && a.next && (
                  <div className="mt-3 flex gap-3">
                    <Link to={a.next.href} onClick={() => void mark(a, 'done')} className="inline-flex min-h-12 items-center rounded-button border-2 border-ink bg-amber px-4 font-semibold text-ink no-underline">
                      {a.next.label}
                    </Link>
                    <Button variant="quiet" onClick={() => mark(a, 'skipped')}>
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="quiet" className="mt-5" onClick={onDaily}>
        Show the daily plan instead
      </Button>
    </div>
  );
}
