import { useEffect, useState } from 'react';
import { readPref, writePref } from './prefs';
import { supabase } from './supabase';

// PHASE_15_PLUS 5: an instance can carry its own name (app_config.instance_name), shown on the sign-in screen and in
// the tab title. Remembered on the device so it shows offline too.
export const DEFAULT_INSTANCE_NAME = 'wonderwander';

export function useInstanceName(): string {
  const [name, setName] = useState(() => readPref<string>('instance_name', DEFAULT_INSTANCE_NAME));
  useEffect(() => {
    let live = true;
    supabase
      .from('app_config')
      .select('instance_name')
      .maybeSingle()
      .then(
        ({ data }) => {
          const next = (data as { instance_name?: string } | null)?.instance_name?.trim();
          if (!live || !next) return;
          writePref('instance_name', next);
          setName(next);
        },
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (typeof document !== 'undefined') document.title = name;
  }, [name]);
  return name;
}
