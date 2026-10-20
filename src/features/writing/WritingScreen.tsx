import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadPaper, useLoad } from '../../content/load';
import { findWriting, type WritingItem } from '../../content/writing';
import type { Unit } from '../../content/types';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import { objectTargets } from '../../engines/doing/standardForm';
import { clearDraft, loadDraft, saveDraft } from '../../engines/grading/drafts';
import { type LlmError } from '../../engines/grading/llm';
import { LlmErrorText } from '../../ui/LlmErrorText';
import { loadRow } from '../../engines/grading/pipeline';
import { extract } from '../../engines/writing/extract';
import { earlierTexts, previousReport, submitWriting, writingPrompt, type Focus, type Upload, type WritingOutcome } from '../../engines/writing/submit';
import type { GraderOutput } from '../../engines/grading/pipeline';
import { assembleDraft, compareReports, looksScanned, MAX_UPLOAD_BYTES, REFEREE_KEYS, SCANNED_MESSAGE, uploadKind, type RefereeOutput } from '../../engines/writing/text';
import { readPref, writePref } from '../../lib/prefs';
import { supabase } from '../../lib/supabase';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { Prose } from '../../ui/Prose';
import { countWords } from '../../ui/TextArea';
import { joinText, useVoice } from '../../ui/Voice';
import { AUDIO_UPLOAD_TYPES, MAX_AUDIO_BYTES, transcribeAudio, TRANSCRIBE_MESSAGE } from '../../lib/voice';
import { GradingWait } from '../drill/GradingWait';
import { ResultPanel, SoftRetryPanel } from '../drill/ResultPanel';

type Phase = { kind: 'compose' } | { kind: 'sending' } | { kind: 'retry'; error: LlmError } | { kind: 'done'; out: Exclude<WritingOutcome, { kind: 'retry' | 'soft' }> };

async function rowsFor(ids: string[]): Promise<Record<string, ItemRow | undefined>> {
  return Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await loadRow(id)] as const)));
}

// BUILD_PLAN 16: one writing step per screen, written here or uploaded, then graded or refereed.
export default function WritingScreen() {
  const itemId = decodeURIComponent(useParams().itemId ?? '');
  const content = useLoad(async () => {
    const w = await findWriting(itemId);
    const [rows, prev] = await Promise.all([rowsFor([w.id, ...w.previous]), previousReport(w)]);
    const ladderThesis = w.ladderStep === 'abstract' ? (await loadPaper()).ladderTheses.find((t) => t.label === w.file?.domain.title.split(' ')[0]) : undefined;
    const earlier = w.kind === 'referee' && w.domainId ? await earlierTexts(w.domainId) : null;
    return { w, rows, prev, ladderThesis, earlier };
  }, [itemId]);

  if (content.error) return <p>That writing step does not exist.</p>;
  if (!content.data) return <p className="text-ink-soft">Opening...</p>;
  return <Writer key={itemId} {...content.data} />;
}

interface WriterProps {
  w: WritingItem;
  rows: Record<string, ItemRow | undefined>;
  prev: { report: RefereeOutput; version: number } | null;
  ladderThesis?: { label: string; text: string };
  earlier: Record<string, string> | null;
}

function Writer({ w, rows, prev, ladderThesis, earlier }: WriterProps) {
  const navigate = useNavigate();
  const [row, setRow] = useState(rows[w.id]);
  const [text, setText] = useState(() => loadDraft(w.id)?.text ?? (earlier ? assembleDraft([earlier.abstract, earlier.reconstruction, earlier.objection_reply]) : ''));
  const [upload, setUpload] = useState<Upload | null>(null);
  const [mode, setMode] = useState<'choose' | 'write' | 'preview'>(text ? 'preview' : 'choose');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [heard, setHeard] = useState<string | null>(null); // the name of a transcribed audio upload
  const mic = useVoice({ value: text, onChange: setText });
  const [phase, setPhase] = useState<Phase>({ kind: 'compose' });
  const [soft, setSoft] = useState<GraderOutput | null>(null);

  const units = w.file?.units ?? [];
  const needsFocus = w.ladderStep === 'reconstruction' || w.ladderStep === 'objection_reply';
  const [unitId, setUnitId] = useState(() => readPref<string>(`write.focus.${w.domainId}`, units[0]?.id ?? ''));
  const unit: Unit | undefined = units.find((u) => u.id === unitId);
  const targets = unit ? objectTargets(unit.doing.object.loadBearing, unit.doing.reconstruct.key.required) : [];
  const [targetIx, setTargetIx] = useState(0);
  const focus: Focus | null = needsFocus && unit && w.file ? { unit, domainTitle: w.file.domain.title, target: w.ladderStep === 'objection_reply' ? (targets[targetIx] ?? null) : null } : null;

  // the student's own work survives an app kill: local every 5 seconds, a Supabase draft row every 30 (BUILD_PLAN 16.1)
  const latest = useRef(text);
  const draftRow = useRef<string | null>(null);
  useEffect(() => {
    latest.current = text;
  }, [text]);
  useEffect(() => {
    if (mode !== 'write') return;
    const local = window.setInterval(() => saveDraft(w.id, latest.current), 5000);
    const remote = window.setInterval(async () => {
      if (!latest.current.trim()) return;
      draftRow.current ??= crypto.randomUUID();
      await supabase
        .from('writing_submission')
        .upsert({ id: draftRow.current, domain_id: w.domainId, step: w.step, title: w.title, text: latest.current, word_count: countWords(latest.current), source: 'typed', version: 0 });
    }, 30000);
    return () => {
      window.clearInterval(local);
      window.clearInterval(remote);
      saveDraft(w.id, latest.current);
    };
  }, [mode, w]);

  const status = effectiveStatus(row, new Date());
  const blockedBy = w.previous.filter((id) => !['passed', 'pending_review'].includes(effectiveStatus(rows[id], new Date())));
  const words = countWords(text);
  const isRefereed = w.kind === 'referee' || w.kind === 'final_paper';
  // after a failed referee round the revision goes in once the lock is over; each report is compared with the last
  const canRevise = isRefereed && status === 'available' && Boolean(prev);
  const open = status === 'available';

  const choose = async (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    // a recording from any voice recorder is transcribed, then previewed like any other text (PHASE_15_PLUS 2.3)
    if (file.type.startsWith('audio/') || AUDIO_UPLOAD_TYPES.test(file.name)) {
      if (file.size > MAX_AUDIO_BYTES) return setUploadError('That recording is over 25 MB. Export a shorter one and try again.');
      setReading(true);
      const out = await transcribeAudio(file, file.name);
      setReading(false);
      if (!out.ok) return setUploadError(TRANSCRIBE_MESSAGE[out.error]);
      setUpload(null);
      setHeard(file.name);
      setText(joinText(text, out.text));
      return setMode('preview');
    }
    const kind = uploadKind(file.name, file.type);
    if (!kind) return setUploadError('Choose a Word file (.docx), a PDF, or a recording (m4a, mp3, webm, wav).');
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError('That file is over 10 MB. Export a smaller copy and try again.');
    setReading(true);
    try {
      const extracted = await extract(kind, await file.arrayBuffer());
      if (looksScanned(extracted, file.size)) return setUploadError(SCANNED_MESSAGE);
      if (!extracted.trim()) return setUploadError('No words came out of that file. Check it opens and try again.');
      setUpload({ file, kind });
      setHeard(null);
      setText(extracted);
      setMode('preview');
    } catch {
      setUploadError('That file could not be read. Check it opens on your phone and try again.');
    } finally {
      setReading(false);
    }
  };

  const send = async () => {
    setPhase({ kind: 'sending' });
    try {
      const out = await submitWriting(w, text, upload, focus);
      if (out.kind === 'retry') return setPhase({ kind: 'retry', error: out.error });
      if (out.kind === 'soft') {
        setSoft(out.grader);
        return setPhase({ kind: 'compose' });
      }
      setSoft(null);
      clearDraft(w.id);
      setRow(out.kind === 'graded' ? out.outcome.row : out.row);
      setPhase({ kind: 'done', out });
    } catch {
      setPhase({ kind: 'retry', error: navigator.onLine ? 'failed' : 'offline' });
    }
  };

  if (mode === 'write') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-paper">
        <div className="flex items-center justify-between border-b-2 border-ink/15 px-4 py-2">
          <span className="text-small tabular-nums" aria-live="polite">
            {words}
            {w.words ? ` of ${w.words.min ? `${w.words.min} to ${w.words.max}` : w.words.target} words` : ' words'}
          </span>
          <span className="flex items-center gap-2">
            {mic.button}
            <Button variant="secondary" onClick={() => setMode(text.trim() ? 'preview' : 'choose')}>
              Done
            </Button>
          </span>
        </div>
        {(mic.status || mic.interim) && (
          <div className="mx-auto w-full max-w-[62ch] px-4">
            {mic.status}
            {mic.interim && <p className="mt-1 text-body text-ink-soft italic">{mic.interim}</p>}
          </div>
        )}
        <label htmlFor="editor" className="sr-only">
          {w.title}
        </label>
        <textarea
          id="editor"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="calm mx-auto block w-full max-w-[62ch] flex-1 resize-none bg-transparent px-4 py-4 text-[18px] leading-[1.65] text-ink outline-none"
        />
      </div>
    );
  }

  return (
    <div>
      <BackLink to={w.backTo} label={w.file?.domain.title ?? 'Paper Module'} />
      <h1 className="mt-1 mb-4 text-heading">{w.title}</h1>

      <details className="mb-4" open={!text}>
        <summary className="min-h-12 cursor-pointer py-2 text-body font-semibold">The task and rubric</summary>
        <Card className="mt-2">
          <Prose markdown={writingPrompt(w, focus)} />
          {w.rubric.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-caption font-bold">Rubric</p>
              <ol className="calm list-decimal pl-5 text-[16px]">
                {w.rubric.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </>
          )}
          {w.reject.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-caption font-bold">Fails if</p>
              <ul className="calm list-disc pl-5 text-[16px]">
                {w.reject.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </details>

      {w.ladderStep === 'abstract' && w.file && w.file.domain.writingLadder.thesisSuggestions.length > 0 && (
        <details className="mb-4">
          <summary className="min-h-12 cursor-pointer py-2 text-body font-semibold">Thesis ideas for this domain</summary>
          <ol className="calm mt-2 list-decimal pl-5 text-[16px]">
            {w.file.domain.writingLadder.thesisSuggestions.map((t) => (
              <li key={t}>{t}</li>
            ))}
            {ladderThesis && <li>{ladderThesis.text}</li>}
          </ol>
        </details>
      )}

      {needsFocus && open && blockedBy.length === 0 && phase.kind === 'compose' && (
        <div className="mb-4">
          <label htmlFor="focus" className="mb-1.5 block text-small font-semibold">
            Which argument?
          </label>
          <select
            id="focus"
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              setTargetIx(0);
              writePref(`write.focus.${w.domainId}`, e.target.value);
            }}
            className="block min-h-12 w-full rounded-input border-2 border-ink bg-paper-raised px-3 text-body"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.number}: {u.title} ({u.doing.authorPlaybook.author})
              </option>
            ))}
          </select>
          {w.ladderStep === 'objection_reply' && targets.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Premise to object to">
              {targets.map((t, i) => (
                <Chip key={t.n} selected={i === targetIx} seed={80 + i} onClick={() => setTargetIx(i)}>
                  {/^\d+$/.test(t.n) ? `Premise ${t.n}` : t.text.slice(0, 26)}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {blockedBy.length > 0 && status === 'available' ? (
        <p className="mt-4">{w.kind === 'final_paper' ? 'The final paper opens once the literature map, the synthesis and all three thesis sets are passed.' : 'Finish the earlier steps first; each must be passed.'}</p>
      ) : !open && phase.kind === 'compose' ? (
        <StatusNote w={w} row={row} prev={prev} onRevise={() => navigate(`/revise/${encodeURIComponent(w.id)}`)} />
      ) : (
        phase.kind === 'compose' && (
          <>
            {soft && <SoftRetryPanel missing={soft.missing_or_wrong} feedback={soft.feedback} />}
            {canRevise && prev && (
              <p className="mb-4 rounded-card border-2 border-lilac bg-lilac/30 p-3 text-small">Revise the draft against the last report and send it again. The new report shows what you fixed.</p>
            )}
            {mode === 'choose' && (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => setMode('write')}>Write here</Button>
                <label className="relative inline-flex min-h-12 cursor-pointer items-center justify-center rounded-button border-2 border-ink bg-paper-raised px-4 text-body font-semibold">
                  Upload a file
                  <input type="file" accept=".docx,.pdf,.m4a,.mp3,.webm,.wav,.ogg,.aac,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
                </label>
              </div>
            )}
            {reading && <p className="mt-3 text-small text-ink-soft">Reading the file...</p>}
            {uploadError && (
              <p role="alert" className="mt-3 rounded-card border-2 border-coral bg-coral-tint p-3">
                {uploadError}
              </p>
            )}
            {mode === 'preview' && (
              <>
                <Card seed={21} className="mb-3">
                  <p className="mb-2 text-caption font-bold">
                    {upload ? `From ${upload.file.name}` : heard ? `Transcribed from ${heard}` : 'Your text'}: {words} words{w.words ? ` (aim: ${w.words.min ? `${w.words.min} to ${w.words.max}` : w.words.target})` : ''}
                  </p>
                  <div className="calm max-h-[50vh] overflow-y-auto text-[16px] whitespace-pre-line">{text}</div>
                </Card>
                <div className="flex flex-col gap-3">
                  <Button block disabled={!text.trim()} onClick={send}>
                    {upload ? 'This looks right, send it' : 'Send it'}
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setMode('write')}>
                      Edit here
                    </Button>
                    <label className="relative inline-flex min-h-12 cursor-pointer items-center justify-center rounded-button border-2 border-ink bg-paper-raised px-4 text-body font-semibold">
                      Upload instead
                      <input type="file" accept=".docx,.pdf,.m4a,.mp3,.webm,.wav,.ogg,.aac,audio/*" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}

      {phase.kind === 'sending' && <GradingWait />}
      {phase.kind === 'retry' && (
        <div role="alert" className="mt-4 rounded-card border-2 border-lilac bg-lilac/30 p-4">
          <LlmErrorText error={phase.error} />
          <Button className="mt-4" onClick={send}>
            Try again
          </Button>
        </div>
      )}
      {phase.kind === 'done' && <Done w={w} out={phase.out} prev={prev} onBack={() => navigate(w.backTo)} onRevise={() => navigate(`/revise/${encodeURIComponent(w.id)}`)} />}
    </div>
  );
}

function StatusNote({ w, row, prev, onRevise }: { w: WritingItem; row: ItemRow | undefined; prev: { report: RefereeOutput; version: number } | null; onRevise: () => void }) {
  const status = effectiveStatus(row, new Date());
  if (status === 'locked' || status === 'revision_required') {
    return (
      <div className="mt-2">
        <p className="mb-4">{status === 'locked' ? 'Back tomorrow at midnight. You can revise now.' : 'Revise first, then you can send a new version.'}</p>
        {row?.revision_done_at ? <p className="text-small text-ink-soft">Revised. The retry opens at midnight.</p> : <Button onClick={onRevise}>Revise now</Button>}
      </div>
    );
  }
  return (
    <div className="mt-2">
      <p className="rounded-card border-2 border-lilac bg-lilac/30 p-3">{status === 'passed' ? 'Passed.' : 'Waiting for a verdict.'}</p>
      {prev && (w.kind === 'referee' || w.kind === 'final_paper') && <Report report={prev.report} />}
    </div>
  );
}

function Report({ report, previous }: { report: RefereeOutput & { runs?: [RefereeOutput, RefereeOutput] }; previous?: RefereeOutput }) {
  const cmp = previous ? compareReports(previous, report) : null;
  const runs = report.runs;
  return (
    <div className="mt-5">
      <p className="mb-2 text-small font-semibold">Two referees read it independently; an item passes only if both pass it.</p>
      {runs ? (
        runs.map((r, i) => (
          <Card key={i} seed={33 + i} className="mb-3">
            <p className="mb-1 text-caption font-bold">Referee {i + 1}</p>
            <p className="calm text-[16px]">{r.report}</p>
          </Card>
        ))
      ) : (
        <Card seed={33} className="mb-4">
          <p className="calm text-[16px]">{report.report}</p>
        </Card>
      )}
      {cmp && (
        <p className="mb-3 text-small">
          {cmp.fixed.length ? `Now fixed: ${cmp.fixed.join(', ')}. ` : 'Nothing from the last report is fixed yet. '}
          {cmp.stillFailing.length ? `Still to fix: ${cmp.stillFailing.join(', ')}.` : ''}
        </p>
      )}
      <table className="calm w-full text-[16px]">
        <thead>
          <tr className="text-left text-caption">
            <th className="pb-1 font-bold">Item</th>
            {runs && <th className="pb-1 font-bold">1</th>}
            {runs && <th className="pb-1 font-bold">2</th>}
            <th className="pb-1 font-bold">Result</th>
          </tr>
        </thead>
        <tbody>
          {REFEREE_KEYS.map((k) => {
            const it = report.checklist[k];
            if (!it) return null;
            const mark = (r?: RefereeOutput) => (r?.checklist[k]?.result === 'PASS' ? 'pass' : 'fail');
            return (
              <tr key={k} className="border-t border-ink/10 align-top">
                <td className="py-1.5 pr-2 font-bold">{k}</td>
                {runs && <td className="py-1.5 pr-2">{mark(runs[0])}</td>}
                {runs && <td className="py-1.5 pr-2">{mark(runs[1])}</td>}
                <td className="py-1.5">
                  <span className="font-bold">
                    {it.result === 'PASS' ? 'passed' : 'failed'}
                    {cmp?.fixed.includes(k) ? ' (now fixed)' : ''}:{' '}
                  </span>
                  {it.reason}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Done({ w, out, prev, onBack, onRevise }: { w: WritingItem; out: Exclude<WritingOutcome, { kind: 'retry' | 'soft' }>; prev: { report: RefereeOutput } | null; onBack: () => void; onRevise: () => void }) {
  const back = w.file ? 'Back to the domain' : 'Back to the Paper Module';
  if (out.kind === 'graded') {
    const o = out.outcome;
    return (
      <ResultPanel
        decision={o.decision.decision === 'PASS' ? 'PASS' : 'FAIL'}
        appealOf={{ attemptId: o.attemptId, itemId: w.id }}
        feedback={o.grader?.feedback ?? null}
        missing={o.grader?.missing_or_wrong ?? null}
        onRevise={onRevise}
        onNext={onBack}
        nextLabel={back}
      />
    );
  }
  return (
    <>
      <ResultPanel
        decision={out.pass ? 'PASS' : 'FAIL'}
        appealOf={{ attemptId: out.attemptId, itemId: w.id }}
        feedback={`${out.report.passed} of 10 checklist items passed both referees${w.kind === 'final_paper' ? '; the paper needs all 10.' : '; the round needs 8.'}`}
        onRevise={onRevise}
        onNext={onBack}
        nextLabel={back}
      />
      <Report report={out.report} previous={out.version > 1 ? prev?.report : undefined} />
    </>
  );
}
