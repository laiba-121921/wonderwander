import { loadBossText } from '../../content/load';
import { doingKindOf, findBoss, findDoing, findDrill, isBossId, loadUnit } from '../../content/lookup';
import { findWriting, isWritingId } from '../../content/writing';
import type { AnswerKey } from '../../content/types';
import { localDate } from '../../domain/dates';
import { applyRuling, freshRow } from '../../domain/lifecycle';
import { currentTimezone } from '../../lib/profile';
import { supabase } from '../../lib/supabase';
import { rubricItems } from '../boss/fight';
import { effectiveKey, type KeyOverride } from '../grading/keys';
import { loadRow } from '../grading/pipeline';
import { loadCardStates } from '../srs/cardStore';
import { review } from '../srs/cards';
import { hasAmendment, type PackItem, type Ruling } from './pack';

export interface QueueRow {
  id: string;
  attempt_id: string;
  item_id: string;
  reason: string;
  created_at: string;
}

interface AttemptRow {
  id: string;
  item_id: string;
  item_class: string;
  exercise_text: string;
  answer_text: string;
  grader: unknown;
  auditor: unknown;
  created_at: string;
}

const isCard = (itemId: string) => /:card:\d+$/.test(itemId);

// The key the item is graded on today: the authored key with the latest weekly amendments (BUILD_PLAN 15.2).
export async function keyForItem(itemId: string): Promise<AnswerKey> {
  let base: AnswerKey;
  if (isCard(itemId)) {
    const { unit } = await loadUnit(itemId.split(':')[0]!);
    base = unit.cards.find((c) => c.id === itemId)!.key;
  } else if (isBossId(itemId)) {
    const [{ boss }, text] = await Promise.all([findBoss(itemId), loadBossText()]);
    base = { required: rubricItems(boss, text.bossBaseRubric), accept: [], reject: [], version: 1 };
  } else if (isWritingId(itemId)) {
    const w = await findWriting(itemId);
    base = { required: w.rubric, accept: [], reject: w.reject, version: 1 };
  } else if (doingKindOf(itemId)) {
    const { source, kind } = await findDoing(itemId);
    base = source[kind].key;
  } else {
    const { drill } = await findDrill(itemId);
    base = drill.kind === 'keyed' ? drill.key : { required: drill.correct.map((c) => drill.options.find((o) => o.id === c)?.text ?? c), accept: [], reject: [], version: 1 };
  }
  const { data } = await supabase.from('key_override').select('item_id,version,accept_add,reject_add,required_edit').eq('item_id', itemId);
  return effectiveKey(base, (data as KeyOverride[]) ?? []);
}

export async function pendingQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabase.from('review_queue').select('id,attempt_id,item_id,reason,created_at').eq('status', 'pending');
  if (error) throw error;
  return ((data as QueueRow[]) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
}

const WRITING = new Set(['ladder', 'referee', 'paper']);

export async function packItems(queue: QueueRow[]): Promise<PackItem[]> {
  if (!queue.length) return [];
  const { data } = await supabase.from('attempt').select('id,item_id,item_class,exercise_text,answer_text,grader,auditor,created_at').in('id', queue.map((q) => q.attempt_id));
  const attempts = new Map(((data as AttemptRow[]) ?? []).map((a) => [a.id, a]));
  return Promise.all(
    queue.map(async (q) => {
      const a = attempts.get(q.attempt_id);
      const key = await keyForItem(q.item_id).catch(() => ({ required: [], accept: [], reject: [] }));
      const item: PackItem = {
        queue_id: q.id,
        item_id: q.item_id,
        item_class: a?.item_class ?? '',
        reason: q.reason,
        exercise: a?.exercise_text ?? '',
        key: { required: key.required, accept: key.accept, reject: key.reject },
        student_answer: a?.answer_text ?? '',
        grader: a?.grader ?? null,
        auditor: a?.auditor ?? null,
      };
      if (a && (a.item_class === 'mini_boss' || a.item_class === 'final_boss')) item.transcript = a.answer_text.split('\n');
      if (a && WRITING.has(a.item_class)) item.draft = a.answer_text;
      return item;
    }),
  );
}

export interface ApplyReport {
  applied: { queueId: string; itemId: string; verdict: 'PASS' | 'FAIL' }[];
  unknown: string[];
  amended: string[];
}

// Each ruling updates the queue row, the item (or the card's schedule) and, with an amendment, the key (BUILD_PLAN 15.2).
export async function applyRulings(rulings: Ruling[], queue: QueueRow[], now = new Date(), tz = currentTimezone()): Promise<ApplyReport> {
  const byId = new Map(queue.map((q) => [q.id, q]));
  const report: ApplyReport = { applied: [], unknown: [], amended: [] };
  const cards = rulings.some((r) => byId.has(r.queue_id) && isCard(byId.get(r.queue_id)!.item_id)) ? await loadCardStates() : [];
  for (const r of rulings) {
    const q = byId.get(r.queue_id);
    if (!q) {
      report.unknown.push(r.queue_id);
      continue;
    }
    const upd = await supabase.from('review_queue').update({ status: 'ruled', ruling: r.verdict, ruling_reason: r.reason, ruled_at: now.toISOString() }).eq('id', q.id);
    if (upd.error) throw upd.error;

    if (isCard(q.item_id)) {
      const state = cards.find((c) => c.cardId === q.item_id);
      if (state) {
        // scheduled from now, but the passing day is the day the card was answered
        const next = review(state, r.verdict, 'HIGH', now, tz);
        const day = localDate(new Date(q.created_at), tz);
        const passDays = r.verdict === 'PASS' ? [...new Set([...state.passDays, day])] : state.passDays;
        await supabase.from('card_state').upsert({ card_id: next.cardId, fsrs: JSON.parse(JSON.stringify(next.fsrs)), due: next.due.toISOString(), pass_days: passDays });
        await supabase.from('card_review').insert({ card_id: next.cardId, attempt_id: q.attempt_id, rating: r.verdict === 'PASS' ? 3 : 1 });
      }
    } else {
      const prev = (await loadRow(q.item_id)) ?? freshRow(q.item_id, q.item_id.split(':')[0]!);
      const next = applyRuling(prev, r.verdict, r.reason, now, tz);
      const up = await supabase.from('item_state').upsert({ ...next, updated_at: now.toISOString() });
      if (up.error) throw up.error;
      // a failed objection takes its reply with it: the next objection gets a new author reply and a new answer
      if (r.verdict === 'FAIL' && q.item_id.endsWith(':object')) {
        const replyId = q.item_id.replace(/:object$/, ':reply');
        const reply = await loadRow(replyId);
        if (reply && reply.status !== 'locked') await supabase.from('item_state').upsert({ ...freshRow(replyId, reply.unit_id), fail_count: reply.fail_count, updated_at: now.toISOString() });
      }
    }

    if (hasAmendment(r)) {
      const { data } = await supabase.from('key_override').select('version').eq('item_id', q.item_id);
      const version = Math.max(1, ...((data as { version: number }[] | null) ?? []).map((d) => d.version)) + 1;
      const a = r.key_amendment!;
      const ins = await supabase.from('key_override').insert({ item_id: q.item_id, version, accept_add: a.accept_add, reject_add: a.reject_add, required_edit: a.required_edit, note: r.reason });
      if (ins.error) throw ins.error;
      report.amended.push(q.item_id);
    }
    report.applied.push({ queueId: q.id, itemId: q.item_id, verdict: r.verdict });
  }
  return report;
}
