import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doodle } from '../../art/Doodle';
import { loadDomain, useLoad } from '../../content/load';
import { currentUnit } from '../../domain/progress';
import { buildPulse, GENERATORS, type GeneratorId } from '../../engines/logic';
import { newSeed } from '../../engines/logic/rng';
import { readPref, writePref } from '../../lib/prefs';
import { useProgress } from '../../lib/progress';
import { BackLink } from '../../ui/BackLink';
import { Button } from '../../ui/Button';
import { LogicItemView } from '../drill/LogicItemView';

type Wrong = Partial<Record<GeneratorId, number>>;

// Recently wrong generators come up more often; each right answer eases one off (BUILD_PLAN 11).
export function updateWrong(wrong: Wrong, id: GeneratorId, correct: boolean): Wrong {
  const n = wrong[id] ?? 0;
  return { ...wrong, [id]: correct ? Math.max(0, n - 1) : Math.min(3, n + 1) };
}

// The daily logic pulse. Runs fully on the device; results never lock anything.
export default function PulseScreen() {
  const logic = useLoad(() => loadDomain('logic'), []);
  const { progress } = useProgress();
  const [seed, setSeed] = useState(newSeed);
  const highest = logic.data ? (currentUnit(logic.data, progress)?.number ?? 8) : 1;
  const items = useMemo(() => buildPulse(highest, readPref<Wrong>('pulse.wrong', {}), seed), [highest, seed]);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);

  const item = items[index];
  const onChecked = (ok: boolean) => {
    setChecked(true);
    if (ok) setRight((r) => r + 1);
    writePref('pulse.wrong', updateWrong(readPref<Wrong>('pulse.wrong', {}), item!.generator, ok));
  };

  if (!item) {
    return (
      <div className="text-center">
        <div className="mt-6 flex justify-center">
          <Doodle name="star" size={64} />
        </div>
        <h1 className="mt-3 text-heading">Pulse done</h1>
        <p className="mt-2 text-body">
          {right} of {items.length} right.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            block
            onClick={() => {
              setSeed(newSeed());
              setIndex(0);
              setRight(0);
              setChecked(false);
            }}
          >
            Another round
          </Button>
          <Link to="/" className="min-h-12 py-3 text-body">
            Back to today
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <BackLink to="/" label="Today" />
        <span className="text-small text-ink-soft tabular-nums">
          {index + 1} of {items.length}
        </span>
      </div>
      <p className="mb-4 text-caption text-ink-soft">{GENERATORS.find((g) => g.id === item.generator)!.title}</p>
      <LogicItemView key={`${seed}-${index}`} item={item} onChecked={onChecked} />
      {checked && (
        <Button
          block
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setIndex((i) => i + 1);
            setChecked(false);
          }}
        >
          {index + 1 < items.length ? 'Next' : 'Finish'}
        </Button>
      )}
    </div>
  );
}
