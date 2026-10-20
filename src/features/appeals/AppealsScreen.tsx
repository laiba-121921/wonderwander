import { useCallback, useEffect, useState } from 'react';
import { Doodle } from '../../art/Doodle';
import { localDate } from '../../domain/dates';
import { buildPack, hasAmendment, parseRulings, type Ruling } from '../../engines/review/pack';
import { applyRulings, packItems, pendingQueue, type ApplyReport, type QueueRow } from '../../engines/review/store';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextArea } from '../../ui/TextArea';

type Stage = { kind: 'idle' } | { kind: 'paste' } | { kind: 'preview'; rulings: Ruling[] } | { kind: 'applying' } | { kind: 'done'; report: ApplyReport };

// PHASE_15_PLUS 1.3: appeals are optional. Export the appealed verdicts as one pack for any capable model or person,
// then paste the rulings back. Nothing in the app waits for them.
export default function AppealsScreen() {
  const [queue, setQueue] = useState<QueueRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [parts, setParts] = useState<string[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [pasted, setPasted] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const reload = useCallback(() => {
    pendingQueue().then(
      (q) => {
        setQueue(q);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(reload, [reload]);

  // built as soon as the queue loads, so the copy runs inside the tap (clipboards need that)
  useEffect(() => {
    if (!queue?.length) return;
    let live = true;
    packItems(queue).then((items) => live && setParts(buildPack(items, localDate(new Date()))));
    return () => {
      live = false;
    };
  }, [queue]);

  const copy = async (i: number) => {
    if (!parts) return;
    try {
      await navigator.clipboard.writeText(parts[i]!);
      setCopied(i);
    } catch {
      setCopied(-1);
    }
  };

  const download = (i: number) => {
    if (!parts) return;
    const url = URL.createObjectURL(new Blob([parts[i]!], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wonderwander-appeals-${localDate(new Date())}${parts.length > 1 ? `-part-${i + 1}` : ''}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const header = (
    <header className="mt-1 mb-4 flex items-center justify-between">
      <h1 className="text-[28px] font-bold">Appeals</h1>
      <Doodle name="owl" size={40} />
    </header>
  );
  if (failed || !queue)
    return (
      <div>
        <BackLink to="/me" label="Me" />
        {header}
        <p className={failed ? '' : 'text-ink-soft'}>{failed ? 'The appeals could not load. Check your connection and open this screen again.' : 'Opening...'}</p>
      </div>
    );
  const label = (r: Ruling) => queue.find((q) => q.id === r.queue_id)?.item_id;

  return (
    <div>
      <BackLink to="/me" label="Me" />
      {header}
      <p className="mb-3 text-title">{queue.length ? `${queue.length} appealed` : 'No appeals. The owl is asleep.'}</p>
      <p className="mb-4 text-small">Appeal a fail you think was wrong, copy the pack into any assistant you trust and ask it to rule, then paste its answer back here. The rulings update the verdicts and, where they say so, the keys.</p>
      {queue.length > 20 && (
        <p className="mb-4 rounded-card border-2 border-coral bg-coral-tint p-3 text-small">More than twenty appeals usually means one key or unit is wrong. Look for it first.</p>
      )}

      {stage.kind === 'idle' && (
        <div className="flex flex-col gap-3">
          {queue.length > 0 && !parts && <p className="text-small text-ink-soft">Building the pack...</p>}
          {parts?.map((_, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <Button onClick={() => copy(i)}>{parts.length > 1 ? `Copy part ${i + 1}` : 'Copy appeal pack'}</Button>
              <Button variant="secondary" onClick={() => download(i)}>
                Save as .txt
              </Button>
            </div>
          ))}
          {copied !== null && (
            <p role="status" className="text-small">
              {copied < 0 ? 'Copying is blocked here; save the .txt instead.' : `Copied${parts && parts.length > 1 ? ` part ${copied + 1}` : ''}. Paste it into your assistant.`}
            </p>
          )}
          <Button block variant="secondary" onClick={() => setStage({ kind: 'paste' })}>
            Paste rulings
          </Button>
        </div>
      )}

      {stage.kind === 'paste' && (
        <div>
          <TextArea label="The ruling" value={pasted} onChange={setPasted} hint="Paste the whole reply; the json block at the end is what counts." />
          {parseError && (
            <p role="alert" className="mt-3 rounded-card border-2 border-coral bg-coral-tint p-3">
              {parseError}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              disabled={!pasted.trim()}
              onClick={() => {
                const r = parseRulings(pasted);
                if (!r.ok) return setParseError(r.error);
                setParseError(null);
                setStage({ kind: 'preview', rulings: r.rulings });
              }}
            >
              Preview
            </Button>
            <Button variant="secondary" onClick={() => setStage({ kind: 'idle' })}>
              Back
            </Button>
          </div>
        </div>
      )}

      {stage.kind === 'preview' && (
        <div>
          <ol className="flex flex-col gap-3">
            {stage.rulings.map((r) => (
              <li key={r.queue_id}>
                <Card seed={r.verdict === 'PASS' ? 31 : 32}>
                  <p className="text-small font-bold">
                    {label(r) ?? `Unknown item ${r.queue_id}, will be skipped`}: {r.verdict}
                  </p>
                  <p className="calm mt-1 text-[16px]">{r.reason}</p>
                  {hasAmendment(r) && (
                    <p className="mt-2 text-caption">
                      Key change:
                      {r.key_amendment!.accept_add.length ? ` accept ${r.key_amendment!.accept_add.length} more;` : ''}
                      {r.key_amendment!.reject_add.length ? ` reject ${r.key_amendment!.reject_add.length} more;` : ''}
                      {r.key_amendment!.required_edit ? ' REQUIRED rewritten.' : ''}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              onClick={async () => {
                const rulings = stage.rulings;
                setStage({ kind: 'applying' });
                const report = await applyRulings(rulings, queue);
                setStage({ kind: 'done', report });
                setPasted('');
                setParts(null);
                reload();
              }}
            >
              Apply rulings
            </Button>
            <Button variant="secondary" onClick={() => setStage({ kind: 'paste' })}>
              Back
            </Button>
          </div>
        </div>
      )}

      {stage.kind === 'applying' && <p className="text-ink-soft">Applying...</p>}
      {stage.kind === 'done' && (
        <div role="status" className="rounded-card border-2 border-mint bg-mint/40 p-4">
          <p className="font-bold">
            {stage.report.applied.length} ruling
            {stage.report.applied.length === 1 ? '' : 's'} applied: {stage.report.applied.filter((a) => a.verdict === 'PASS').length} passed,{' '}
            {stage.report.applied.filter((a) => a.verdict === 'FAIL').length} failed.
          </p>
          {stage.report.amended.length > 0 && <p className="mt-2 text-small">Keys updated: {stage.report.amended.join(', ')}.</p>}
          {stage.report.unknown.length > 0 && <p className="mt-2 text-small">Skipped, not in the queue: {stage.report.unknown.join(', ')}.</p>}
          <Button className="mt-4" variant="secondary" onClick={() => setStage({ kind: 'idle' })}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
