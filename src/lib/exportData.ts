import { localDate } from '../domain/dates';
import { supabase } from './supabase';

// BUILD_PLAN 7: "Download my data" exports every table as one JSON file (the free plan has no point-in-time recovery).
export const TABLES = [
  'profile',
  'item_state',
  'attempt',
  'variant',
  'card_state',
  'card_review',
  'review_queue',
  'key_override',
  'boss_session',
  'writing_submission',
  'session_log',
  'llm_usage',
  'push_subscription',
] as const;

const PAGE = 1000;

async function allRows(table: (typeof TABLES)[number]): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function exportData(now = new Date()): Promise<{ name: string; json: string; counts: Record<string, number> }> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await allRows(t);
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  const json = JSON.stringify({ app: 'wonderwander', exported_at: now.toISOString(), tables }, null, 1);
  return { name: `wonderwander-data-${localDate(now)}.json`, json, counts };
}

export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
