import type { KeyedDrill } from '../../content/types';
import { supabase } from '../../lib/supabase';
import { callLlm } from './llm';

export interface Exercise {
  text: string;
  variantId: string | null;
  note?: string; // why the original wording is used
}

// BUILD_PLAN 9.3: a retry of a keyed recall or comprehension drill uses a fresh variant; the key is reused unchanged.
// variant, then variant_check; regenerate up to twice; if still failing, reuse the original and record why.
export async function exerciseFor(drill: KeyedDrill, failCount: number): Promise<Exercise> {
  if (failCount === 0) return { text: drill.prompt, variantId: null };
  if (drill.variants === false) return { text: drill.prompt, variantId: null, note: 'symbolic drill: retried on the original' };
  if (!drill.structureNote) return { text: drill.prompt, variantId: null, note: 'no structure note' };

  const unused = await supabase.from('variant').select('id,text').eq('item_id', drill.id).eq('structure_ok', true).is('used_at', null).limit(1);
  if (unused.data?.length) return { text: unused.data[0]!.text, variantId: unused.data[0]!.id };

  for (let attempt = 0; attempt < 3; attempt++) {
    const v = await callLlm<{ text: string }>('variant', { exercise_text: drill.prompt, structure_note: drill.structureNote });
    if (!v.ok) return { text: drill.prompt, variantId: null, note: `variant unavailable (${v.error})` };
    const check = await callLlm<{ ok: boolean; reason: string }>('variant_check', { variant: v.data.text, structure_note: drill.structureNote });
    const ok = check.ok && check.data.ok;
    const row = await supabase.from('variant').insert({ item_id: drill.id, text: v.data.text, structure_ok: ok }).select('id').single();
    if (ok) return { text: v.data.text, variantId: row.data?.id ?? null };
  }
  return { text: drill.prompt, variantId: null, note: 'three variants failed the structure check' };
}

export async function markVariantUsed(variantId: string | null): Promise<void> {
  if (variantId) await supabase.from('variant').update({ used_at: new Date().toISOString() }).eq('id', variantId);
}
