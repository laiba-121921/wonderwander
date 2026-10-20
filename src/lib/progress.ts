import { useEffect, useState } from 'react';
import { emptyProgress, type ItemStatus, type Progress } from '../domain/progress';
import { readPref, writePref } from './prefs';
import { supabase } from './supabase';

// Progress lives in Supabase; a copy is kept on the device so practice that needs no network (the logic pulse) works offline.
export async function fetchProgress(): Promise<Progress> {
  const [items, cards] = await Promise.all([supabase.from('item_state').select('item_id,status'), supabase.from('card_state').select('card_id,pass_days')]);
  if (items.error) throw items.error;
  if (cards.error) throw cards.error;
  const p = emptyProgress();
  for (const r of items.data ?? []) p.items[r.item_id] = r.status as ItemStatus;
  for (const r of cards.data ?? []) p.cardPassDays[r.card_id] = new Set(r.pass_days).size;
  writePref('progress', p);
  return p;
}

export function cachedProgress(): Progress {
  return readPref<Progress>('progress', emptyProgress());
}

export function useProgress(): { progress: Progress; offline: boolean } {
  const [progress, setProgress] = useState(cachedProgress);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let live = true;
    fetchProgress().then(
      (p) => live && setProgress(p),
      () => live && setOffline(true),
    );
    return () => {
      live = false;
    };
  }, []);
  return { progress, offline };
}
