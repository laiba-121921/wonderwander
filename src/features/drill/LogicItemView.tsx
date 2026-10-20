import { useState } from 'react';
import { checkChoice, checkConnective, checkTable, type ChoiceItem, type ConnectiveItem, type LogicItem, type TableItem } from '../../engines/logic';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { RoughFrame } from '../../ui/RoughFrame';

export interface ItemViewProps {
  item: LogicItem;
  onChecked: (correct: boolean) => void;
}

function Result({ correct, explanation }: { correct: boolean; explanation: string }) {
  return (
    <div role="status" className={`mt-5 rounded-card border-2 p-4 ${correct ? 'border-mint bg-mint/40' : 'border-coral bg-coral-tint'}`}>
      <p className="font-bold">{correct ? 'Nailed it.' : 'Not quite. Here is why.'}</p>
      <p className="calm mt-1 text-[16px]">{explanation}</p>
    </div>
  );
}

function Stimulus({ item }: { item: ChoiceItem }) {
  return (
    <>
      {item.stimulus && (
        <Card className="mb-3">
          <p className="calm whitespace-pre-line">{item.stimulus}</p>
        </Card>
      )}
      {item.keyLines && <p className="mb-3 text-small text-ink-soft">{item.keyLines.join('.  ')}.</p>}
      {item.proof && (
        <div className="mb-4 overflow-x-auto">
          <table className="calm w-full text-[16px]">
            <tbody>
              {item.proof.map((l) => (
                <tr key={l.n} className="border-b border-ink/15">
                  <td className="py-1.5 pr-3 tabular-nums">{l.n}</td>
                  <td className="py-1.5 pr-3">{l.formula}</td>
                  <td className="py-1.5 text-ink-soft">{l.justification ?? <span className="rounded bg-butter px-2">?</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ChoiceView({ item, onChecked }: { item: ChoiceItem; onChecked: (c: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState<boolean | null>(null);
  const check = () => {
    const ok = checkChoice(item, picked!);
    setDone(ok);
    onChecked(ok);
  };
  return (
    <div>
      <Stimulus item={item} />
      <div className="flex flex-col gap-3" role="group" aria-label="Options">
        {item.options.map((o, i) => {
          const isRight = item.correct.includes(o.id);
          const state = done === null ? (picked === o.id ? 'picked' : 'idle') : isRight ? 'right' : picked === o.id ? 'wrong' : 'idle';
          const fill = { idle: 'var(--paper-raised)', picked: 'var(--butter)', right: 'var(--mint)', wrong: 'var(--coral-tint)' }[state];
          return (
            <button
              key={o.id}
              type="button"
              disabled={done !== null}
              aria-pressed={picked === o.id}
              onClick={() => setPicked(o.id)}
              className={`relative block min-h-12 w-full px-4 py-3 text-left text-body ${state === 'right' && picked === o.id ? 'wiggle' : ''}`}
            >
              <RoughFrame radius={18} fill={fill} seed={30 + i} strokeWidth={state === 'idle' ? 2 : 2.5} sticker />
              <span className="calm relative block text-[17px]">{o.text}</span>
            </button>
          );
        })}
      </div>
      {done === null ? (
        <Button block className="mt-5" disabled={!picked} onClick={check}>
          Check
        </Button>
      ) : (
        <Result correct={done} explanation={item.explanation} />
      )}
    </div>
  );
}

function TableView({ item, onChecked }: { item: TableItem; onChecked: (c: boolean) => void }) {
  const [answers, setAnswers] = useState<(boolean | null)[]>(item.rows.map(() => null));
  const [done, setDone] = useState<boolean | null>(null);
  const set = (i: number, v: boolean) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)));
  return (
    <div>
      <table className="w-full border-collapse text-center text-body">
        <thead>
          <tr>
            {item.atoms.map((a) => (
              <th key={a} className="border-b-2 border-ink pb-1 font-bold">
                {a}
              </th>
            ))}
            <th className="border-b-2 border-ink pb-1 font-bold">{item.formula}</th>
          </tr>
        </thead>
        <tbody>
          {item.rows.map((row, i) => (
            <tr key={i} className="border-b border-ink/15">
              {item.atoms.map((a) => (
                <td key={a} className="py-1.5">
                  {row[a] ? 'T' : 'F'}
                </td>
              ))}
              <td className="py-1">
                <div className="inline-flex gap-2">
                  {[true, false].map((v) => {
                    const chosen = answers[i] === v;
                    const wrong = done !== null && chosen && item.answer[i] !== v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        disabled={done !== null}
                        aria-pressed={chosen}
                        aria-label={`Row ${i + 1}: ${v ? 'true' : 'false'}`}
                        onClick={() => set(i, v)}
                        className={`min-h-12 min-w-12 rounded-button border-2 font-bold ${wrong ? 'border-coral bg-coral-tint' : chosen ? 'border-ink bg-butter' : 'border-ink/30 bg-paper-raised'}`}
                      >
                        {v ? 'T' : 'F'}
                      </button>
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {done === null ? (
        <Button
          block
          className="mt-5"
          disabled={answers.some((a) => a === null)}
          onClick={() => {
            const ok = checkTable(item, answers);
            setDone(ok);
            onChecked(ok);
          }}
        >
          Check
        </Button>
      ) : (
        <Result correct={done} explanation={`${item.explanation} The column is ${item.answer.map((v) => (v ? 'T' : 'F')).join(', ')}.`} />
      )}
    </div>
  );
}

function ConnectiveView({ item, onChecked }: { item: ConnectiveItem; onChecked: (c: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div>
      <Card className="mb-3">
        <p className="calm flex flex-wrap items-center gap-x-0.5 text-[22px]">
          {item.tokens.map((t, i) =>
            t.connective ? (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => {
                  setPicked(i);
                  onChecked(checkConnective(item, i));
                }}
                aria-label={`Connective ${t.text}, position ${i + 1}`}
                className={`min-h-12 min-w-11 rounded-button border-2 ${
                  picked === null ? 'border-ink/30 bg-butter/50' : i === item.correct ? 'border-ink bg-mint' : i === picked ? 'border-coral bg-coral-tint' : 'border-transparent'
                }`}
              >
                {t.text}
              </button>
            ) : (
              <span key={i}>{t.text}</span>
            ),
          )}
        </p>
      </Card>
      {picked !== null && <Result correct={picked === item.correct} explanation={item.explanation} />}
    </div>
  );
}

export function LogicItemView({ item, onChecked }: ItemViewProps) {
  return (
    <div>
      <h2 className="mb-3 text-title">{item.prompt}</h2>
      {item.type === 'choice' && <ChoiceView item={item} onChecked={onChecked} />}
      {item.type === 'table' && <TableView item={item} onChecked={onChecked} />}
      {item.type === 'connective' && <ConnectiveView item={item} onChecked={onChecked} />}
    </div>
  );
}
