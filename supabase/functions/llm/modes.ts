import { fill, type Mode, type SlotValues, withSuffix } from './fill.ts';
import { PROMPTS } from './prompts/index.ts';

// BUILD_PLAN 8.1 and 8.3: which prompt, temperature and output budget each mode uses.
export const MODE_CONFIG: Record<Mode, { prompt: keyof typeof PROMPTS; temperature: number; maxTokens: number; json: boolean }> = {
  grade: { prompt: 'grader', temperature: 0, maxTokens: 1024, json: true },
  audit: { prompt: 'auditor', temperature: 0, maxTokens: 1024, json: true },
  variant: { prompt: 'variant', temperature: 0.5, maxTokens: 400, json: false },
  variant_check: { prompt: 'variantCheck', temperature: 0, maxTokens: 300, json: true },
  author_reply: { prompt: 'authorReply', temperature: 0.4, maxTokens: 400, json: false },
  boss_turn: { prompt: 'boss', temperature: 0.7, maxTokens: 300, json: true },
  judge: { prompt: 'judge', temperature: 0, maxTokens: 1024, json: true },
  referee: { prompt: 'referee', temperature: 0, maxTokens: 2048, json: true },
};

export const MODES = Object.keys(MODE_CONFIG) as Mode[];

// Modes with an independent second run at temperature 0.3 (PHASE_15_PLUS 1.1 and 1.2).
export const SECOND_RUN: Mode[] = ['grade', 'judge', 'referee'];

// Free-tier budget (owner's AI Studio limits, 2026-10-19): 3.8 Flash allows 20 requests a day, 3.5 Flash-Lite 500.
// High-volume checking runs on Flash-Lite; the few calls that need the stronger model (boss, judge, author, referee) on Flash.
export type Tier = 'light' | 'heavy';
export const TIER: Record<Mode, Tier> = {
  grade: 'light',
  audit: 'light',
  variant: 'light',
  variant_check: 'light',
  author_reply: 'heavy',
  boss_turn: 'heavy',
  judge: 'heavy',
  referee: 'heavy',
};

export interface Tiers {
  light: { model: string; cap: number };
  heavy: { model: string; cap: number };
}

export function tiersFrom(env: (k: string) => string | undefined): Tiers {
  return {
    light: { model: env('GEMINI_MODEL_LIGHT') ?? 'gemini-3.5-flash-lite', cap: Number(env('LLM_CAP_LIGHT') ?? 450) },
    heavy: { model: env('GEMINI_MODEL_HEAVY') ?? 'gemini-3.8-flash', cap: Number(env('LLM_CAP_HEAVY') ?? 18) },
  };
}

// Usage rows are stored as "<mode>@<tier>", so each model's daily count can be summed.
export function usedByTier(rows: { mode: string; calls: number }[]): Record<Tier, number> {
  const out: Record<Tier, number> = { light: 0, heavy: 0 };
  for (const r of rows) {
    const tier = r.mode.split('@')[1] as Tier | undefined;
    if (tier === 'light' || tier === 'heavy') out[tier] += r.calls;
  }
  return out;
}

// The tier a call runs on: its own if there is room; a heavy call falls back to light; null when nothing is left today.
export function chooseTier(mode: Mode, used: Record<Tier, number>, tiers: Tiers): Tier | null {
  const want = TIER[mode];
  if (used[want] < tiers[want].cap) return want;
  if (want === 'heavy' && used.light < tiers.light.cap) return 'light';
  return null;
}

// The variant check prompt has no slots, so its inputs follow it as labelled fields.
export function buildPrompt(mode: Mode, slots: SlotValues & { variant?: string; structure_note?: string }): string {
  const template = PROMPTS[MODE_CONFIG[mode].prompt];
  const base =
    mode === 'variant_check'
      ? `${template}\n\nVARIANT: ${slots.variant ?? ''}\nSTRUCTURE NOTE: ${slots.structure_note ?? ''}`
      : fill(template, mode === 'variant' ? { ...slots, 'authored note on what must be preserved': slots.structure_note } : slots);
  return withSuffix(base, mode);
}
