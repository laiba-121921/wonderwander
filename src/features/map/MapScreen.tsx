import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import rough from 'roughjs';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { BossFigure } from '../../art/BossFigure';
import { Doodle } from '../../art/Doodle';
import { StickFigure } from '../../art/StickFigure';
import { DOMAINS, loadDomain, TRACKS, useLoad } from '../../content/load';
import type { BossPlaybook, DomainFile, TrackId, Unit } from '../../content/types';
import { effectiveStatus, type ItemRow } from '../../domain/lifecycle';
import { currentUnitOfTrack, domainsOfTrack } from '../../domain/plan';
import { domainMastery, finalBossAvailable, unitMastery, unitPassed, unitsById, unitUnlocked, type Progress } from '../../domain/progress';
import { readPref, writePref } from '../../lib/prefs';
import { fetchProgress } from '../../lib/progress';
import { supabase } from '../../lib/supabase';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Confetti } from './Confetti';
import { layoutTrack, type MapNode } from './layout';
import { MasteryChecklist } from './Mastery';

const gen = rough.generator();

interface Data {
  files: DomainFile[];
  progress: Progress;
  rows: Record<string, ItemRow>;
}

async function loadMap(): Promise<Data> {
  const [files, progress, items] = await Promise.all([Promise.all(DOMAINS.map((d) => loadDomain(d.id))), fetchProgress(), supabase.from('item_state').select('*')]);
  return { files, progress, rows: Object.fromEntries(((items.data as ItemRow[]) ?? []).map((r) => [r.item_id, r])) };
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Selected = { kind: 'unit'; unit: Unit } | { kind: 'boss'; boss: BossPlaybook; status: string } | null;

// BUILD_PLAN 19.5: the Wander Map, one tall trail per track.
export default function MapScreen() {
  const data = useLoad(loadMap, []);
  const [tab, setTab] = useState<TrackId>(() => readPref<TrackId>('map.tab', 'logic'));
  const [selected, setSelected] = useState<Selected>(null);
  const [celebrate, setCelebrate] = useState<{ unitId: string; big: boolean } | null>(null);

  // The signature moment: once per unit, the first time the map sees it passed (BUILD_PLAN 19.7).
  useEffect(() => {
    if (!data.data) return;
    const seen = new Set(readPref<string[]>('map.celebrated', []));
    const { files, progress } = data.data;
    const fresh = files.flatMap((f) => [...f.units.filter((u) => unitPassed(u, progress)).map((u) => u.id), ...(progress.items[f.domain.finalBoss.id] === 'passed' ? [f.domain.finalBoss.id] : [])]).filter((id) => !seen.has(id));
    if (!fresh.length) return;
    writePref('map.celebrated', [...seen, ...fresh]);
    const first = fresh.find((id) => id.endsWith(':final-boss')) ?? fresh[0]!;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCelebrate({ unitId: first.replace(/:final-boss$/, ''), big: first.endsWith(':final-boss') });
    const t = window.setTimeout(() => setCelebrate(null), 4000);
    return () => window.clearTimeout(t);
  }, [data.data]);

  return (
    <div>
      <h1 className="mb-3 text-[28px] font-bold">Map</h1>
      <div role="tablist" aria-label="Tracks" className="mb-4 grid grid-cols-4 gap-1.5">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              writePref('map.tab', t.id);
            }}
            className={`min-h-12 rounded-button border-2 text-small font-semibold ${tab === t.id ? 'border-ink bg-amber' : 'border-ink/30 bg-paper-raised'}`}
          >
            {t.id === 'logic' ? 'Logic' : t.id}
          </button>
        ))}
      </div>
      {!data.data ? (
        <p className="text-ink-soft">Unrolling the map...</p>
      ) : (
        <Trail key={tab} data={data.data} track={tab} celebrating={celebrate} onSelect={setSelected} />
      )}
      {celebrate && !reducedMotion() && <Confetti big={celebrate.big} />}
      <NodeSheet selected={selected} data={data.data} onClose={() => setSelected(null)} />
    </div>
  );
}

function Trail({ data, track, celebrating, onSelect }: { data: Data; track: TrackId; celebrating: { unitId: string } | null; onSelect: (s: Selected) => void }) {
  const files = domainsOfTrack(data.files, track);
  const layout = useMemo(() => layoutTrack(files), [files]);
  const units = useMemo(() => unitsById(data.files), [data.files]);
  const current = currentUnitOfTrack(data.files, track, data.progress);
  const [scale, setScale] = useState(1);
  // drawn with rough.js once per layout
  const regionPaths = useMemo(
    () => layout.regions.map((r, i) => gen.toPaths(gen.rectangle(6, r.y + 4, layout.width - 12, r.height - 8, { roughness: 1.4, seed: 30 + i, stroke: 'var(--ink)', strokeWidth: 1.5 }))),
    [layout],
  );

  return (
    <TransformWrapper minScale={1} maxScale={2.5} onTransform={(_, s) => setScale(s.scale)} panning={{ disabled: scale <= 1.01 }} doubleClick={{ mode: 'toggle' }} wheel={{ disabled: true }}>
      <TransformComponent wrapperStyle={{ width: '100%', overflow: 'visible' }} contentStyle={{ width: '100%' }}>
        <div className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
          <svg aria-hidden="true" width={layout.width} height={layout.height} className="absolute inset-0">
            {layout.regions.map((r, i) => (
              <g key={r.domainId}>
                <rect x={6} y={r.y + 4} width={layout.width - 12} height={r.height - 8} rx={22} fill={`var(--${r.domainId})`} opacity={0.28} />
                {regionPaths[i]!.map((p, j) => (
                  <path key={j} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill="none" opacity={0.35} />
                ))}
                <Gate x={r.gate.x} y={r.gate.y} open={finalBossAvailable(files[i]!, data.progress)} />
              </g>
            ))}
            <path d={layout.path} fill="none" stroke="var(--ink)" strokeWidth={2.5} strokeDasharray="1 9" strokeLinecap="round" opacity={0.55} />
          </svg>

          {layout.regions.map((r, ri) => {
            const file = files[ri]!;
            return (
              <div key={r.domainId}>
                <p className="absolute right-5 left-5 text-center text-title font-bold" style={{ top: r.y + 18 }}>
                  {r.title}
                  <span className="ml-2 text-caption font-semibold">{Math.round(domainMastery(file, data.progress))}%</span>
                </p>
                {r.nodes.map((n) => {
                  const unit = file.units.find((u) => u.id === n.unitId)!;
                  return (
                    <Stop
                      key={n.unitId}
                      node={n}
                      unit={unit}
                      colour={`var(--${r.domainId})`}
                      mastery={unitMastery(unit, data.progress)}
                      passed={unitPassed(unit, data.progress)}
                      locked={!unitUnlocked(unit, data.progress, units)}
                      current={current?.id === unit.id}
                      bowing={celebrating?.unitId === unit.id}
                      bossStatus={effectiveStatus(data.rows[unit.miniBoss.id], new Date())}
                      onSelect={onSelect}
                    />
                  );
                })}
                <button
                  type="button"
                  className="absolute"
                  style={{ left: r.gate.x - 44, top: r.gate.y - 92, width: 88 }}
                  onClick={() => onSelect({ kind: 'boss', boss: file.domain.finalBoss, status: effectiveStatus(data.rows[file.domain.finalBoss.id], new Date()) })}
                >
                  <span className="sr-only">Final boss: {file.domain.finalBoss.name}</span>
                  <span aria-hidden="true">
                    <BossFigure bossId={file.domain.finalBoss.id} colour={`var(--${r.domainId})`} size={84} pose={celebrating?.unitId === file.domain.id ? 'bow' : undefined} />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </TransformComponent>
    </TransformWrapper>
  );
}

function Gate({ x, y, open }: { x: number; y: number; open: boolean }) {
  const d = `M ${x - 46} ${y + 34} L ${x - 46} ${y - 20} Q ${x} ${y - 52} ${x + 46} ${y - 20} L ${x + 46} ${y + 34}`;
  return <path d={d} fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" strokeDasharray={open ? undefined : '6 6'} opacity={0.8} />;
}

interface StopProps {
  node: MapNode;
  unit: Unit;
  colour: string;
  mastery: number;
  passed: boolean;
  locked: boolean;
  current: boolean;
  bowing: boolean;
  bossStatus: string;
  onSelect: (s: Selected) => void;
}

const R = 28;

// A jar that fills from the bottom as mastery rises; passed glows amber, locked is dashed with a padlock.
function Stop({ node, unit, colour, mastery, passed, locked, current, bowing, bossStatus, onSelect }: StopProps) {
  const outline = useMemo(() => gen.toPaths(gen.circle(R + 4, R + 4, R * 2, { roughness: 1.1, seed: node.number * 7, stroke: 'var(--ink)', strokeWidth: 2.5 })), [node.number]);
  const fillH = (Math.min(100, mastery) / 100) * R * 2;
  const clip = `jar-${unit.id}`;
  return (
    <>
      <button
        type="button"
        className="absolute rounded-full"
        style={{ left: node.x - R - 4, top: node.y - R - 4, width: R * 2 + 8, height: R * 2 + 8, filter: passed ? 'drop-shadow(0 0 8px var(--amber))' : undefined }}
        aria-label={`Unit ${unit.number}, ${unit.title}, ${Math.round(mastery)} percent${passed ? ', passed' : locked ? ', locked' : current ? ', you are here' : ''}`}
        onClick={() => onSelect({ kind: 'unit', unit })}
      >
        <svg width={R * 2 + 8} height={R * 2 + 8} aria-hidden="true" className="overflow-visible">
          <defs>
            <clipPath id={clip}>
              <circle cx={R + 4} cy={R + 4} r={R - 1} />
            </clipPath>
          </defs>
          <circle cx={R + 4} cy={R + 4} r={R} fill="var(--paper-raised)" />
          <rect x={4} y={R * 2 + 4 - fillH} width={R * 2} height={fillH} fill={passed ? 'var(--amber)' : colour} clipPath={`url(#${clip})`} />
          {locked ? (
            <circle cx={R + 4} cy={R + 4} r={R} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="5 5" opacity={0.6} />
          ) : (
            outline.map((p, i) => <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill="none" />)
          )}
          {current && <circle cx={R + 4} cy={R + 4} r={R + 6} fill="none" stroke="var(--amber)" strokeWidth={4} />}
          <text x={R + 4} y={R + 10} textAnchor="middle" className="fill-ink text-[18px] font-bold">
            {unit.number}
          </text>
        </svg>
        {locked && (
          <span className="absolute -right-1 -bottom-1">
            <Doodle name="padlock" size={22} />
          </span>
        )}
        {passed && (
          <>
            <span className="absolute -top-2 -left-2">
              <Doodle name="star" size={18} />
            </span>
            <span className="absolute -right-3 top-1">
              <Doodle name="star" size={14} />
            </span>
          </>
        )}
      </button>
      <button
        type="button"
        className="absolute"
        style={{ left: node.x + node.bossSide * (R + 18) - 22, top: node.y - 34, width: 44 }}
        onClick={() => onSelect({ kind: 'boss', boss: unit.miniBoss, status: bossStatus })}
      >
        <span className="sr-only">Mini-boss: {unit.miniBoss.name}</span>
        <span aria-hidden="true">
          <BossFigure bossId={unit.miniBoss.id} colour={colour} size={52} pose={bowing ? 'bow' : undefined} />
        </span>
      </button>
      {current && (
        <span className="pointer-events-none absolute" style={{ left: node.x - node.bossSide * (R + 18) - 24, top: node.y - 38 }} aria-hidden="true">
          <StickFigure pose="stand" expression="delighted" props={[{ key: 'lantern', colour: 'var(--amber)' }]} size={58} seed={11} label="You" />
        </span>
      )}
    </>
  );
}

const STATUS_WORD: Record<string, string> = { passed: 'Beaten', pending_review: 'Waiting', locked: 'Back tomorrow', revision_required: 'Revise first', available: 'Not fought yet' };

function NodeSheet({ selected, data, onClose }: { selected: Selected; data: Data | null; onClose: () => void }) {
  const navigate = useNavigate();
  if (!selected || !data) return null;
  if (selected.kind === 'boss') {
    return (
      <Sheet open onClose={onClose} title={selected.boss.name}>
        <p className="calm mb-3 text-[16px]">{selected.boss.persona}</p>
        <p className="mb-4 text-small font-semibold">{STATUS_WORD[selected.status]}</p>
        <Button
          block
          onClick={() => {
            onClose();
            navigate(`/boss/${encodeURIComponent(selected.boss.id)}`);
          }}
        >
          Go to the boss
        </Button>
      </Sheet>
    );
  }
  const u = selected.unit;
  return (
    <Sheet open onClose={onClose} title={`${u.number}. ${u.title}`}>
      <p className="mb-3 text-body font-bold">Mastery {Math.round(unitMastery(u, data.progress))}%</p>
      <MasteryChecklist unit={u} progress={data.progress} rows={data.rows} />
      <Button
        block
        className="mt-5"
        onClick={() => {
          onClose();
          navigate(`/library/${u.domain}/${u.number}`);
        }}
      >
        Open unit
      </Button>
    </Sheet>
  );
}

