import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Public by design (BUILD_PLAN 7): the URL and publishable key reach the client only through build variables.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient<Database>(url || 'http://localhost:54321', key || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
