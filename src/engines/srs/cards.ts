import { createEmptyCard, fsrs, generatorParameters, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs';
import { localDate, nextLocalMidnight } from '../../domain/dates';

// BUILD_PLAN 12: ts-fsrs defaults with desired retention 0.9.
const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));

export type Decision = 'PASS' | 'FAIL' | 'RETRY';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CardState {
  cardId: string;
  fsrs: FsrsCard;
  due: Date;
  passDays: string[]; // distinct local dates with a PASS
}

export const DAILY_CARD_CAP = 8;

export function newCardState(cardId: string, now: Date): CardState {
  const card = createEmptyCard(now);
  return { cardId, fsrs: card, due: now, passDays: [] };
}

// PASS at HIGH is Good, PASS at MEDIUM is Hard, FAIL is Again; a soft retry leaves the card unscheduled until settled.
export function ratingFor(decision: Decision, confidence?: Confidence): Grade | null {
  if (decision === 'RETRY') return null;
  if (decision === 'FAIL') return Rating.Again;
  return confidence === 'HIGH' ? Rating.Good : Rating.Hard;
}

export function review(state: CardState, decision: Decision, confidence: Confidence | undefined, now: Date, tz?: string): CardState {
  const grade = ratingFor(decision, confidence);
  if (grade === null) return state;
  const { card } = scheduler.next(state.fsrs, now, grade);
  let due = card.due;
  // a failed card is never due again before the next local day
  if (grade === Rating.Again) {
    const midnight = nextLocalMidnight(now, tz);
    if (due < midnight) due = midnight;
  }
  const today = localDate(now, tz);
  const passDays = decision === 'PASS' && !state.passDays.includes(today) ? [...state.passDays, today] : state.passDays;
  return { cardId: state.cardId, fsrs: { ...card, due }, due, passDays };
}

// Counts toward mastery after passes on two distinct local days; half credit for one.
export function cardCredit(passDays: number): number {
  return passDays >= 2 ? 1 : passDays === 1 ? 0.5 : 0;
}

export function dueCards(states: CardState[], now: Date): CardState[] {
  return states.filter((s) => s.due.getTime() <= now.getTime()).sort((a, b) => a.due.getTime() - b.due.getTime());
}

// Today's cards: at most eight in the daily session; the rest are offered as optional.
export function todaysCards(states: CardState[], now: Date): { core: CardState[]; extra: CardState[] } {
  const due = dueCards(states, now);
  return { core: due.slice(0, DAILY_CARD_CAP), extra: due.slice(DAILY_CARD_CAP) };
}
