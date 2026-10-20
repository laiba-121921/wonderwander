import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BossFigure } from '../../art/BossFigure';
import { loadBossText, useLoad } from '../../content/load';
import { findBoss, type BossRef } from '../../content/lookup';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import { finalBossAvailable } from '../../domain/progress';
import {
  expressionFor,
  fightOver,
  levelFor,
  opening,
  playbookText,
  reversalDue,
  rubricItems,
  rubricText,
  studentTurns,
  transcriptText,
  type Turn,
} from '../../engines/boss/fight';
import { judgeFight, latestSession, saveSession, startSession, type JudgeOutput, type Session } from '../../engines/boss/session';
import { clearDraft, loadDraft, saveDraft } from '../../engines/grading/drafts';
import { callLlm, type LlmError } from '../../engines/grading/llm';
import { LlmErrorText } from '../../ui/LlmErrorText';
import { loadRow } from '../../engines/grading/pipeline';
import { readPref } from '../../lib/prefs';
import { useProgress } from '../../lib/progress';
import { speak, stopSpeaking } from '../../lib/voice';
import { supabase } from '../../lib/supabase';
import { currentTimezone } from '../../lib/profile';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { NamePlate } from '../../ui/NamePlate';
import { TextArea } from '../../ui/TextArea';
import { GradingWait } from '../drill/GradingWait';
import { ResultPanel } from '../drill/ResultPanel';
import { RetryBox } from '../doing/useGradeFlow';

interface BossTurnOut {
  reply: string;
  matched_objection: number | null;
  conceded: string | null;
}

type Verdict = { decision: 'PASS' | 'FAIL'; judge: JudgeOutput | null; second: JudgeOutput | null; attemptId: string | null };

function lockTime(row: ItemRow): string {
  return new Date(row.locked_until!).toLocaleString('en-GB', { timeZone: currentTimezone(), weekday: 'long', hour: '2-digit', minute: '2-digit' });
}

// BUILD_PLAN 10.1: the boss fight, saved after every turn, then the judge and the auditor.
export default function BossScreen() {
  const itemId = decodeURIComponent(useParams().itemId ?? '');
  const content = useLoad(() => Promise.all([findBoss(itemId), loadBossText()]), [itemId]);
  const [state, setState] = useState<{ itemId: string; row?: ItemRow; session: Session | null } | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadRow(itemId), latestSession(itemId)]).then(([row, session]) => live && setState({ itemId, row, session }));
    return () => {
      live = false;
    };
  }, [itemId]);

  if (content.error) return <p>That boss does not exist.</p>;
  if (!content.data || state?.itemId !== itemId) return <p className="text-ink-soft">Opening...</p>;
  const [ref, text] = content.data;
  return <Fight key={itemId} bossRef={ref} template={text.playbookTemplate} base={text.bossBaseRubric} initialRow={state.row} initialSession={state.session} />;
}

interface FightProps {
  bossRef: BossRef;
  template: string;
  base: string[];
  initialRow: ItemRow | undefined;
  initialSession: Session | null;
}

function Fight({ bossRef, template, base, initialRow, initialSession }: FightProps) {
  const { boss, unit, file, final } = bossRef;
  const navigate = useNavigate();
  const { progress } = useProgress();
  const [row, setRow] = useState(initialRow);
  const [session, setSession] = useState(initialSession);
  const [message, setMessage] = useState(() => loadDraft(boss.id)?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LlmError | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const judging = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const colour = `var(--${file.domain.id})`;
  const back = unit ? `/practice/${unit.id}` : `/library/${file.domain.id}`;
  const status = effectiveStatus(row, new Date());
  const transcript = session?.transcript ?? [];
  const items = useMemo(() => rubricItems(boss, base), [boss, base]);

  const save = async (s: Session) => {
    setSession(s);
    await saveSession(s);
  };

  const judge = useCallback(
    async (s: Session) => {
      if (judging.current) return;
      judging.current = true;
      const out = await judgeFight({
        itemId: boss.id,
        unitId: unit?.id ?? null,
        itemClass: final ? 'final_boss' : 'mini_boss',
        playbook: playbookText(boss, template, s.phase),
        rubric: items,
        rubricText: rubricText(items),
        transcript: transcriptText(s.transcript),
        sessionId: s.id,
      }).catch(() => ({ kind: 'retry' as const, error: (navigator.onLine ? 'failed' : 'offline') as LlmError }));
      judging.current = false;
      if (out.kind === 'retry') return setError(out.error);
      const done = { ...s, status: 'decided' as const, attempt_id: out.attemptId };
      setSession(done);
      await saveSession(done);
      setRow(out.row);
      setVerdict({ decision: out.decision.decision === 'PASS' ? 'PASS' : 'FAIL', judge: out.judge, second: out.second, attemptId: out.attemptId });
    },
    [boss, unit, final, template, items],
  );

  // A fight closed while the judge was ruling resumes the ruling.
  useEffect(() => {
    // the ruling is an external call whose result is stored in state, which is what this effect is for
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.status === 'judging' && !verdict && !error) void judge(session);
  }, [session, verdict, error, judge]);

  // The verdict of a fight decided earlier, read back from its attempt; once a rematch is open the start screen shows instead.
  useEffect(() => {
    if (session?.status !== 'decided' || verdict || !session.attempt_id || status === 'available') return;
    supabase
      .from('attempt')
      .select('decision,grader')
      .eq('id', session.attempt_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const g = (data.grader as unknown as (JudgeOutput & { tiebreak?: JudgeOutput }) | null) ?? null;
        setVerdict({ decision: data.decision === 'PASS' ? 'PASS' : 'FAIL', judge: g, second: g?.tiebreak ?? null, attemptId: session.attempt_id });
      });
  }, [session, verdict, status]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [transcript.length]);

  // "Read boss replies aloud" (PHASE_15_PLUS 2.4): each new boss turn, never on resume
  const spoken = useRef(transcript.length);
  useEffect(() => {
    const last = transcript.at(-1);
    if (transcript.length > spoken.current && last?.role === 'boss' && readPref<boolean>('boss.speak', false)) speak(last.text);
    spoken.current = transcript.length;
  }, [transcript]);
  useEffect(() => () => void stopSpeaking(), []);

  const bossTurn = async (s: Session, level: number): Promise<Turn | null> => {
    const r = await callLlm<BossTurnOut>('boss_turn', { playbook: playbookText(boss, template, s.phase), transcript: transcriptText(s.transcript), level: String(level) });
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    return { role: 'boss', text: r.data.reply, level, matched: r.data.matched_objection, conceded: r.data.conceded, phase: s.phase, at: new Date().toISOString() };
  };

  const send = async () => {
    if (!session || !message.trim()) return;
    setBusy(true);
    setError(null);
    const n = studentTurns(session.transcript) + 1;
    const level = levelFor(n);
    const withStudent: Session = { ...session, level, transcript: [...session.transcript, { role: 'student', text: message.trim(), level, phase: session.phase, at: new Date().toISOString() }] };
    try {
      if (fightOver(boss, withStudent.transcript)) {
        // the last student turn goes straight to the judge
        await save({ ...withStudent, status: 'judging' });
      } else {
        const reply = await bossTurn(withStudent, level);
        if (!reply) return; // nothing saved; the message stays in the box for a retry
        const next: Session = { ...withStudent, transcript: [...withStudent.transcript, reply] };
        await save(fightOver(boss, next.transcript) ? { ...next, status: 'judging' } : next);
      }
      setMessage('');
      clearDraft(boss.id);
    } catch {
      setError(navigator.onLine ? 'failed' : 'offline');
    } finally {
      setBusy(false);
    }
  };

  // Role reversal: the boss changes sides and opens the reversed round.
  const switchSides = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const reversed: Session = { ...session, phase: 'reversal' };
      const reply = await bossTurn(reversed, levelFor(studentTurns(session.transcript) + 1));
      if (reply) await save({ ...reversed, transcript: [...reversed.transcript, reply] });
    } finally {
      setBusy(false);
    }
  };

  const begin = async () => {
    setBusy(true);
    try {
      setVerdict(null);
      setSession(await startSession(boss.id, opening(boss, new Date())));
    } catch {
      setError(navigator.onLine ? 'failed' : 'offline');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <>
      <BackLink to={back} label={unit ? unit.title : file.domain.title} />
      <div className="mt-2 flex items-end gap-3">
        <BossFigure bossId={boss.id} colour={colour} size={final ? 112 : 96} expression={expressionFor(transcript.at(-1), transcript.filter((t) => t.role === 'boss').at(-2)?.level)} />
        <div className="min-w-0 pb-2">
          <NamePlate name={boss.name} />
          <p className="mt-1.5 text-caption text-ink-soft">{boss.persona}</p>
        </div>
      </div>
    </>
  );

  if (final && !finalBossAvailable(file, progress) && !session) {
    return (
      <div>
        {header}
        <p className="mt-6">The final boss waits at the gate until every unit of {file.domain.title} is passed.</p>
      </div>
    );
  }

  const fighting = session?.status === 'active' && !verdict;
  const turnsDone = studentTurns(transcript);
  const nextLevel = levelFor(turnsDone + 1);

  return (
    <div>
      {header}

      {fighting && (
        <div className="sticky top-0 z-20 -mx-4 mt-3 flex items-center justify-between border-b-2 border-ink/10 bg-paper/95 px-4 py-2 backdrop-blur-sm">
          <span className="text-small font-semibold tabular-nums">
            Turn {Math.min(turnsDone + 1, boss.exitTurns)} of {boss.exitTurns}
          </span>
          <span className="flex items-center gap-1.5 text-caption" aria-label={`Escalation level ${nextLevel} of 3`}>
            Escalation
            {[1, 2, 3].map((l) => (
              <span key={l} className={`inline-block h-3.5 w-3.5 rounded-[3px] border-2 border-ink ${l <= nextLevel ? 'bg-coral' : 'bg-paper-raised'}`} />
            ))}
          </span>
        </div>
      )}

      {!session || (session.status === 'decided' && status === 'available') ? (
        <div className="mt-6">
          {row?.fail_count ? (
            <Card className="mb-4">
              <p className="mb-1 text-caption font-bold">Last time the judge said</p>
              <p className="calm text-[16px]">{row.last_feedback}</p>
            </Card>
          ) : null}
          <Card seed={21} className="mb-4">
            <p className="mb-1 text-caption font-bold">The position you will argue against</p>
            <p className="calm text-[16px]">{boss.position}</p>
          </Card>
          <p className="mb-4 text-small text-ink-soft">
            {boss.exitTurns} turns. Attack a premise, give reasons, and handle the replies. The judge rules at the end; a second judge settles a close call.
          </p>
          {status === 'locked' || status === 'revision_required' ? (
            <LockNote row={row!} onRevise={() => navigate(`/revise/${encodeURIComponent(boss.id)}`)} />
          ) : status === 'available' ? (
            <Button block disabled={busy} onClick={begin}>
              Start the fight
            </Button>
          ) : (
            <p className="text-small">{status === 'passed' ? 'Already beaten.' : 'Waiting for a verdict.'}</p>
          )}
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-3" aria-label="Transcript">
          {transcript.map((t, i) => (
            <li key={i} className={t.role === 'boss' ? 'mr-8' : 'ml-8'}>
              <div className={`calm rounded-card border-2 px-3.5 py-2.5 text-[16px] ${t.role === 'boss' ? 'bg-paper-raised' : 'border-ink bg-amber/25'}`} style={t.role === 'boss' ? { borderColor: colour } : undefined}>
                <span className="sr-only">{t.role === 'boss' ? `${boss.name}: ` : 'You: '}</span>
                {t.text}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div ref={bottom} />

      {fighting && session && reversalDue(boss, transcript, session.phase) && (
        <Card className="mt-5">
          <p className="mb-1 font-bold">Switch sides</p>
          <p className="calm text-[16px]">{boss.roleReversal}</p>
          <Button block className="mt-4" disabled={busy} onClick={switchSides}>
            Switch sides
          </Button>
        </Card>
      )}

      {fighting && session && !reversalDue(boss, transcript, session.phase) && (
        <div className="mt-5">
          <TextArea
            label="Your reply"
            value={message}
            onChange={(v) => {
              setMessage(v);
              saveDraft(boss.id, v);
            }}
            disabled={busy}
          />
          <Button block className="mt-3" disabled={busy || !message.trim()} onClick={send}>
            {busy ? `${boss.name} is thinking...` : 'Send'}
          </Button>
        </div>
      )}

      {error && fighting && (
        <div role="alert" className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4">
          <LlmErrorText error={error} />
          <p className="mt-2 text-small">Your reply is still in the box. Send it again when you are ready.</p>
        </div>
      )}

      {session?.status === 'judging' && !verdict && (
        <div className="mt-6">
          <p className="text-center font-bold">The judge will now rule.</p>
          {error ? (
            <RetryBox
              error={error}
              onRetry={() => {
                setError(null);
                void judge(session);
              }}
            />
          ) : (
            <GradingWait />
          )}
        </div>
      )}

      {verdict && (
        <>
          <ResultPanel
            decision={verdict.decision}
            appealOf={verdict.attemptId ? { attemptId: verdict.attemptId, itemId: boss.id } : null}
            feedback={verdict.judge?.written ?? null}
            onRevise={() => navigate(`/revise/${encodeURIComponent(boss.id)}`)}
            onNext={() => navigate(back)}
            nextLabel={unit ? 'Back to the unit' : 'Back to the domain'}
          />
          {verdict.second && (
            <div className="mt-4 rounded-card border-2 border-ink/20 p-3">
              <p className="text-small font-bold">A second judge settled this one.</p>
              <p className="calm mt-1 text-[16px]">{verdict.second.written}</p>
            </div>
          )}
          {verdict.judge?.rubric?.length ? (
            <div className="mt-5">
              <h2 className="mb-2 text-title">The rubric</h2>
              <ol className="flex flex-col gap-2">
                {verdict.judge.rubric.map((r, i) => (
                  <li key={i} className="calm text-[16px]">
                    <span className="font-bold">{r.result === 'PASS' ? 'Passed' : 'Missed'}: </span>
                    {r.item}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function LockNote({ row, onRevise }: { row: ItemRow; onRevise: () => void }) {
  const status = effectiveStatus(row, new Date());
  return (
    <div>
      <p className="mb-4">{status === 'locked' ? `Back tomorrow at midnight (${lockTime(row)}). You can revise now.` : 'Revise first, then you can fight again.'}</p>
      {row.revision_done_at ? (
        <p className="text-small text-ink-soft">Revised. The rematch opens at midnight.</p>
      ) : (
        <Button onClick={onRevise}>Revise now</Button>
      )}
    </div>
  );
}
