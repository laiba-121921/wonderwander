import type { DomainFile } from '../../content/types';

// BUILD_PLAN 19.5: a tall trail. Each domain is a region; its units are stops on a winding path; its final boss
// waits by a gate at the region's far edge. Pure geometry, so it is unit tested.

export const MAP_WIDTH = 358;
const HEADER = 64;
const STEP = 112;
const GATE = 132;
const GAP = 24;

export interface MapNode {
  unitId: string;
  number: number;
  x: number;
  y: number;
  bossSide: 1 | -1; // which side the mini-boss stands on
}

export interface MapRegion {
  domainId: string;
  title: string;
  y: number;
  height: number;
  nodes: MapNode[];
  gate: { x: number; y: number; bossId: string };
}

export interface MapLayout {
  width: number;
  height: number;
  regions: MapRegion[];
  path: string; // one winding dotted path through every stop and gate
}

const X = [96, MAP_WIDTH - 96];

export function layoutTrack(files: DomainFile[], width = MAP_WIDTH): MapLayout {
  const xs = [X[0]! * (width / MAP_WIDTH), X[1]! * (width / MAP_WIDTH)];
  let y = 0;
  let k = 0;
  const points: [number, number][] = [];
  const regions = files.map((f) => {
    const top = y;
    const nodes = f.units.map((u, i) => {
      const side = k++ % 2;
      const node: MapNode = { unitId: u.id, number: u.number, x: xs[side]!, y: top + HEADER + i * STEP + STEP / 2, bossSide: side === 0 ? 1 : -1 };
      points.push([node.x, node.y]);
      return node;
    });
    const gate = { x: width / 2, y: top + HEADER + f.units.length * STEP + GATE / 2, bossId: f.domain.finalBoss.id };
    points.push([gate.x, gate.y]);
    const height = HEADER + f.units.length * STEP + GATE;
    y = top + height + GAP;
    return { domainId: f.domain.id, title: f.domain.title, y: top, height, nodes, gate };
  });
  return { width, height: Math.max(0, y - GAP), regions, path: wind(points) };
}

// Smooth S-bends between consecutive stops.
export function wind(points: [number, number][]): string {
  if (!points.length) return '';
  const [first, ...rest] = points;
  let d = `M ${first![0]} ${first![1]}`;
  let prev = first!;
  for (const p of rest) {
    const my = (prev[1] + p[1]) / 2;
    d += ` C ${prev[0]} ${my}, ${p[0]} ${my}, ${p[0]} ${p[1]}`;
    prev = p;
  }
  return d;
}
