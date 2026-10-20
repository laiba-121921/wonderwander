import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// Creates the profile row on first sign-in; later sign-ins leave it untouched (the seed of BUILD_PLAN 4).
export async function ensureProfile(): Promise<void> {
  const { error } = await supabase.from('profile').upsert({}, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) console.error('profile', error.message);
}

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (next && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) void ensureProfile();
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
