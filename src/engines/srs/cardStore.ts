import { TypeConvert } from 'ts-fsrs';
import type { Card as ContentCard } from '../../content/types';
import { currentTimezone } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { newCardState, ratingFor, review, type CardState, type Confidence, type Decision } from './cards';

type Row = { card_id: string; fsrs: unknown; due: string; pass_days: string[] };

const fromRow = (r: Row): CardState => ({ cardId: r.card_id, fsrs: TypeConvert.card(r.fsrs as never), due: new Date(r.due), passDays: r.pass_days });
const toRow = (s: CardState) => ({ card_id: s.cardId, fsrs: JSON.parse(JSON.stringify(s.fsrs)), due: s.due.toISOString(), pass_days: s.passDays });

export async function loadCardStates(): Promise<CardState[]> {
  const { data, error } = await supabase.from('card_state').select('card_id,fsrs,due,pass_days');
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

// BUILD_PLAN 12: every card of an unlocked unit enters the deck, due immediately. Existing rows are left alone.
export async function ensureCardStates(cards: ContentCard[], existing: CardState[], now = new Date()): Promise<CardState[]> {
  const have = new Set(existing.map((s) => s.cardId));
  const fresh = cards.filter((c) => !have.has(c.id)).map((c) => newCardState(c.id, now));
  if (fresh.length) {
    const { error } = await supabase.from('card_state').upsert(fresh.map(toRow), { onConflict: 'user_id,card_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  return [...existing, ...fresh];
}

// Applies a graded card decision: FSRS rating, the next-midnight clamp after Again, distinct pass days.
export async function saveCardReview(state: CardState, decision: Decision, confidence: Confidence | undefined, attemptId: string): Promise<CardState> {
  const rating = ratingFor(decision, confidence);
  if (rating === null) return state; // queued: unscheduled until ruled
  const next = review(state, decision, confidence, new Date(), currentTimezone());
  const up = await supabase.from('card_state').upsert(toRow(next));
  if (up.error) throw up.error;
  await supabase.from('card_review').insert({ card_id: state.cardId, attempt_id: attemptId, rating });
  return next;
}
