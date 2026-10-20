import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGeminiKey, KEY_CHANGED } from '../lib/geminiKey';
import { supabase } from '../lib/supabase';

// PHASE_15_PLUS 4.3: anyone but the owner needs their own Gemini key; until one is on this phone every screen says so.
// The owner's key is never used for them, so their checks are refused until they add one.
export function NoKeyBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const [{ data: owner }, key] = await Promise.all([supabase.rpc('is_owner'), getGeminiKey()]);
        if (live) setShow(owner !== true && !key);
      } catch {
        // offline or unreadable: the check refusal itself still explains, so no reminder is better than a wrong one
      }
    };
    void check();
    window.addEventListener(KEY_CHANGED, check);
    return () => {
      live = false;
      window.removeEventListener(KEY_CHANGED, check);
    };
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="flex items-center justify-between gap-3 border-b-2 border-ink/20 bg-butter/50 px-4 text-small">
      No Gemini key on this phone, so answers cannot be checked yet.
      <Link to="/me#gemini-key" className="inline-flex min-h-12 shrink-0 items-center font-semibold">
        Add key
      </Link>
    </p>
  );
}
