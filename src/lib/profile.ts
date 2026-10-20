import { useEffect, useState } from 'react';
import { DEFAULT_TZ } from '../domain/dates';
import { readPref, writePref } from './prefs';
import { supabase } from './supabase';

export interface Profile {
  display_name: string;
  weekend_day: number; // 0 Sunday ... 6 Saturday
  push_threshold: number;
  push_hour: number;
  timezone: string;
  track_rotation_start: string | null;
}

// No name until the profile arrives, so nobody is greeted by someone else's name.
export const DEFAULT_PROFILE: Profile = { display_name: '', weekend_day: 0, push_threshold: 12, push_hour: 20, timezone: 'Asia/Karachi', track_rotation_start: null };

// The signed-in person's timezone, from the device copy of their profile: locks run to their midnight, not anyone
// else's. Before any profile has loaded, the plan's default.
export function currentTimezone(): string {
  return readPref<Partial<Profile>>('profile', {}).timezone || DEFAULT_TZ;
}

// The one profile row, with a device copy so the greeting and plan render before the network answers.
export function useProfile(): { profile: Profile; save: (patch: Partial<Profile>) => Promise<boolean> } {
  const [profile, setProfile] = useState<Profile>(() => ({ ...DEFAULT_PROFILE, ...readPref<Partial<Profile>>('profile', {}) }));
  useEffect(() => {
    let live = true;
    supabase
      .from('profile')
      .select('display_name,weekend_day,push_threshold,push_hour,timezone,track_rotation_start')
      .maybeSingle()
      .then(({ data }) => {
        if (!live || !data) return;
        const p = { ...DEFAULT_PROFILE, ...(data as Partial<Profile>) };
        writePref('profile', p);
        setProfile(p);
      });
    return () => {
      live = false;
    };
  }, []);

  const save = async (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    writePref('profile', next);
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from('profile').update(patch).eq('user_id', s.session?.user.id ?? '');
    return !error;
  };
  return { profile, save };
}
