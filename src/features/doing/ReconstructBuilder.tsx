import { useLayoutEffect, useRef } from 'react';
import { useVoice } from '../../ui/Voice';
import type { Premise, Reconstruction } from '../../engines/doing/standardForm';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';

function Line({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [value]);
  const mic = useVoice({ value, onChange });
  return (
    <>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <label htmlFor={id} className="block text-small font-semibold">
          {label}
        </label>
        {mic.button}
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full resize-none rounded-input border-2 border-ink bg-paper-raised px-3 py-2.5 text-body text-ink"
      />
      {mic.interim && <p className="mt-1 text-body text-ink-soft italic">{mic.interim}</p>}
      {mic.status}
    </>
  );
}

// BUILD_PLAN 10: numbered premise fields, "add premise", a hidden-premise toggle per line, and a conclusion field.
export function ReconstructBuilder({ value, onChange }: { value: Reconstruction; onChange: (r: Reconstruction) => void }) {
  const setPremise = (i: number, p: Partial<Premise>) => onChange({ ...value, premises: value.premises.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div>
      <ol className="flex flex-col gap-5">
        {value.premises.map((p, i) => (
          <li key={i}>
            <Line id={`premise-${i + 1}`} label={`Premise ${i + 1}`} value={p.text} onChange={(text) => setPremise(i, { text })} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <Chip selected={p.hidden} colour="var(--lilac)" seed={70 + i} onClick={() => setPremise(i, { hidden: !p.hidden })} aria-label={`Premise ${i + 1} is hidden`}>
                Hidden premise
              </Chip>
              {value.premises.length > 1 && (
                <Button variant="quiet" className="text-small" onClick={() => onChange({ ...value, premises: value.premises.filter((_, j) => j !== i) })} aria-label={`Remove premise ${i + 1}`}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Button variant="secondary" className="mt-5" onClick={() => onChange({ ...value, premises: [...value.premises, { text: '', hidden: false }] })}>
        Add premise
      </Button>
      <div className="mt-6">
        <Line id="conclusion" label="Conclusion" value={value.conclusion} onChange={(conclusion) => onChange({ ...value, conclusion })} />
      </div>
      <p className="mt-1.5 text-caption text-ink-soft">Tap a mic to dictate, or hold it to record. Mark a premise hidden when the author relies on it without saying it.</p>
    </div>
  );
}
