import { useEffect, useState, type ReactNode } from 'react';
import { DOMAINS, initContent, loadDomain } from '../../content/load';
import type { DomainFile } from '../../content/types';
import { BossFigure } from '../../art/BossFigure';
import { DOODLES, Doodle } from '../../art/Doodle';
import { EXPRESSIONS, POSES, StickFigure } from '../../art/StickFigure';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chip';
import { NamePlate } from '../../ui/NamePlate';
import { Sheet } from '../../ui/Sheet';
import { StatusBadge, type Status } from '../../ui/StatusBadge';
import { TapOption } from '../../ui/TapOption';
import { GENERATORS } from '../../engines/logic';
import { LogicItemView } from '../drill/LogicItemView';
import { TextArea } from '../../ui/TextArea';

const SWATCHES = ['paper', 'paper-raised', 'ink', 'ink-soft', 'amber', 'bubblegum', 'lilac', 'grape', 'mint', 'sky', 'butter', 'peach', 'pistachio', 'coral'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-title">{title}</h2>
      {children}
    </section>
  );
}

function useDomains() {
  const [domains, setDomains] = useState<DomainFile[]>([]);
  useEffect(() => {
    let live = true;
    initContent()
      .then(() => Promise.all(DOMAINS.map((d) => loadDomain(d.id))))
      .then((all) => {
        if (live) setDomains(all.sort((a, b) => ['logic', 'A', 'B', 'C'].indexOf(a.domain.track) - ['logic', 'A', 'B', 'C'].indexOf(b.domain.track) || a.domain.order - b.domain.order));
      });
    return () => {
      live = false;
    };
  }, []);
  return domains;
}

// Phase 2 component gallery for the owner to check. Reached from Me, not from the tab bar.
export default function GalleryScreen() {
  const [track, setTrack] = useState('A');
  const [answer, setAnswer] = useState('');
  const [essay, setEssay] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const domains = useDomains();

  return (
    <div>
      <header className="mb-8 flex items-center gap-3">
        <h1 className="text-heading">Design gallery</h1>
        <Doodle name="star" size={34} />
      </header>

      <Section title="Colours">
        <div className="grid grid-cols-3 gap-3">
          {SWATCHES.map((s) => (
            <div key={s} className="text-caption">
              <div className="mb-1 h-12 rounded-[10px] border-2 border-ink" style={{ background: `var(--${s})` }} />
              {s}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="text-display font-bold" style={{ fontVariationSettings: "'INFM' 80" }}>
          Evening, Laiba
        </p>
        <p className="text-heading">Heading 28</p>
        <p className="text-title">Title 22</p>
        <p className="text-body">Body 17. Nailed it. That premise never saw you coming.</p>
        <p className="text-small text-ink-soft">Small 15. Nearly. Say it more fully.</p>
        <p className="text-caption text-ink-soft">Caption 13. Tap the mic to dictate, or hold it to record.</p>
        <div className="calm mt-4">
          <p>
            Reading 18 in Literata. A sample paragraph for checking the reading measure: long enough to wrap twice on a phone, plain enough to read at a glance.
          </p>
          <p className="mt-2">{'Symbols: \u2200x (Fx \u2192 Gx), \u2203y \u00acGy \u22a2 \u2203y \u00acFy, and \u25a1P \u2194 \u00ac\u25c7\u00acP, with P \u2227 Q and P \u2228 Q.'}</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-4">
          <Button block>Check my answer</Button>
          <Button variant="secondary" block>
            Appeal this verdict
          </Button>
          <div className="flex items-center justify-between">
            <Button variant="quiet">I've revised</Button>
            <Button disabled>Start the fight</Button>
          </div>
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex gap-3">
          {['A', 'B', 'C'].map((t, i) => (
            <Chip key={t} selected={track === t} onClick={() => setTrack(t)} seed={i + 2}>
              Track {t}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap gap-2">
          {(['passed', 'failed', 'queued', 'locked', 'current', 'available'] as Status[]).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Cards and a TAP drill">
        <Card className="mb-4">
          <p className="text-caption text-ink-soft">Sample unit, drill 3 of 10</p>
          <p className="calm mt-1">A sample question with four options:</p>
        </Card>
        <div className="flex flex-col gap-3">
          {['The first option', 'The second option', 'The third option', 'The fourth option'].map((o, i) => (
            <TapOption key={o} selected={picked === o} onSelect={() => setPicked(o)} seed={30 + i}>
              {o}
            </TapOption>
          ))}
        </div>
      </Section>

      <Section title="Inputs">
        <TextArea label="Your answer" value={answer} onChange={setAnswer} className="mb-6" />
        <TextArea label="Abstract" value={essay} onChange={setEssay} wordTarget={150} reading hint={null} />
      </Section>

      <Section title="Sheet">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Open a sheet
        </Button>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Sample unit">
          <p className="mb-2">Mastery 62%</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusBadge status="passed" label="Drills 8 of 10" />
            <StatusBadge status="queued" label="Object waiting" />
            <StatusBadge status="locked" label="Reply locked" />
          </div>
          <Button block>Open unit</Button>
        </Sheet>
      </Section>

      <Section title="Doodles">
        <div className="grid grid-cols-4 gap-4">
          {DOODLES.map((d) => (
            <div key={d} className="flex flex-col items-center text-caption">
              <Doodle name={d} size={48} />
              {d}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Poses">
        <div className="grid grid-cols-3 gap-y-4">
          {POSES.map((p, i) => (
            <div key={p} className="flex flex-col items-center text-caption">
              <StickFigure pose={p} size={110} seed={i + 1} />
              {p}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Expressions">
        <div className="grid grid-cols-4 gap-y-4">
          {EXPRESSIONS.map((e, i) => (
            <div key={e} className="flex flex-col items-center text-caption">
              <StickFigure expression={e} size={90} seed={i + 4} />
              {e}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Logic exercises">
        <p className="mb-5 text-small text-ink-soft">One of each of the thirteen generators. In the app they unlock with their Logic unit.</p>
        {GENERATORS.filter((g) => g.available?.() ?? true).map((g, i) => (
          <div key={g.id} className="mb-10">
            <p className="mb-2 text-caption font-bold">
              Logic {g.logicUnit}: {g.title}
            </p>
            <LogicItemView item={g.make(1000 + i)} onChecked={() => {}} />
          </div>
        ))}
      </Section>

      {domains.map(({ domain, units }) => (
        <Section key={domain.id} title={`Bosses: ${domain.title}`}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6">
            {[...units.map((u) => u.miniBoss), domain.finalBoss].map((b) => (
              <div key={b.id} className="flex flex-col items-center text-center">
                <div className="flex h-[170px] items-end">
                  <BossFigure bossId={b.id} colour={`var(--${domain.id})`} size={b.alwaysEscalate ? 150 : 120} />
                </div>
                <NamePlate name={b.name} />
                {b.alwaysEscalate && <p className="mt-2 text-caption font-bold">Final boss</p>}
                <p className="mt-1 text-caption text-ink-soft">{b.persona}</p>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
