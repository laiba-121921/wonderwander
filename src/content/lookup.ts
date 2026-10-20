import { paperSource, unitSource, type DoingSource } from '../engines/doing/source';
import { loadDoingText, loadDomain, loadPaper } from './load';
import { isWritingId } from './writing';
import type { BossPlaybook, DomainFile, Drill, LessonSection, Unit } from './types';

export const unitIdOf = (itemId: string) => itemId.split(':')[0]!;
export const domainIdOf = (unitId: string) => unitId.replace(/-\d+$/, '');

export interface DrillRef {
  drill: Drill;
  comprehension: boolean;
  unitId: string; // item_state.unit_id ("paper" for the Paper Module)
  title: string;
  backTo: string;
  sections: LessonSection[]; // lesson sections the drill tests
  guide: string[]; // the reading guide, for comprehension drills
}

export const isLadderId = (itemId: string) => isWritingId(itemId);

export async function findDrill(itemId: string): Promise<DrillRef> {
  // the literature map: one keyed item per abstract, answered as four numbered answers (Paper Module section 4)
  const lit = itemId.match(/^paper:literature-map:(\d+)$/);
  if (lit) {
    const paper = await loadPaper();
    const k = paper.literatureMap.keys[Number(lit[1]) - 1];
    if (!k) throw new Error(`No drill ${itemId}`);
    const prompt = [paper.literatureMap.intro.split('\n')[0]!, '', `**Abstract:** ${k.label}`, '', ...paper.literatureMap.questions.map((q, i) => `${i + 1}. ${q}`)].join('\n');
    const drill: Drill = { kind: 'keyed', id: itemId, sourceId: k.label, prompt, revisionSectionIds: [], variants: false, key: { required: [k.text], accept: [], reject: [], version: 1 } };
    return { drill, comprehension: true, unitId: 'paper', title: 'Literature map', backTo: '/paper', sections: [], guide: paper.readingGuide };
  }
  if (itemId.startsWith('paper:comp:')) {
    const paper = await loadPaper();
    const drill = paper.comprehension.find((d) => d.id === itemId);
    if (!drill) throw new Error(`No drill ${itemId}`);
    return { drill, comprehension: true, unitId: 'paper', title: 'Paper Module', backTo: '/paper', sections: [], guide: paper.readingGuide };
  }
  const unitId = unitIdOf(itemId);
  const file = await loadDomain(domainIdOf(unitId));
  const unit = file.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`No unit ${unitId}`);
  const inDrills = unit.drills.find((d) => d.id === itemId);
  const inComp = unit.reading.comprehension.find((d) => d.id === itemId);
  const drill = inDrills ?? inComp;
  if (!drill) throw new Error(`No drill ${itemId}`);
  return {
    drill,
    comprehension: !inDrills,
    unitId: unit.id,
    title: unit.title,
    backTo: `/practice/${unit.id}`,
    sections: unit.lesson.filter((s) => drill.revisionSectionIds.includes(s.id)),
    guide: unit.reading.guide,
  };
}

export type DoingKind = 'reconstruct' | 'object' | 'reply';
export const DOING: DoingKind[] = ['reconstruct', 'object', 'reply'];

export function doingKindOf(itemId: string): DoingKind | null {
  const parts = itemId.split(':');
  const k = parts.at(-1) as DoingKind;
  if (!DOING.includes(k)) return null;
  // a unit's set ("logic-1:object") or a Paper Module thesis set ("paper:A:object")
  return parts.length === 2 || (parts.length === 3 && parts[0] === 'paper' && /^[ABC]$/.test(parts[1]!)) ? k : null;
}

export interface DoingRef {
  source: DoingSource;
  kind: DoingKind;
}

export async function findDoing(itemId: string): Promise<DoingRef> {
  const kind = doingKindOf(itemId);
  if (!kind) throw new Error(`No doing drill ${itemId}`);
  const text = await loadDoingText();
  if (itemId.startsWith('paper:')) {
    const set = (await loadPaper()).thesisSets.find((s) => s.thesis === itemId.split(':')[1]);
    if (!set) throw new Error(`No thesis set ${itemId}`);
    return { source: paperSource(set), kind };
  }
  const { unit } = await loadUnit(unitIdOf(itemId));
  return { source: unitSource(unit, text), kind };
}

export interface BossRef {
  file: DomainFile;
  unit: Unit | null; // null for a domain final boss
  boss: BossPlaybook;
  final: boolean;
}

export const isBossId = (itemId: string) => /:(boss|final-boss)$/.test(itemId);

export async function findBoss(itemId: string): Promise<BossRef> {
  if (itemId.endsWith(':final-boss')) {
    const file = await loadDomain(itemId.replace(/:final-boss$/, ''));
    if (file.domain.finalBoss.id !== itemId) throw new Error(`No boss ${itemId}`);
    return { file, unit: null, boss: file.domain.finalBoss, final: true };
  }
  const { file, unit } = await loadUnit(itemId.replace(/:boss$/, ''));
  if (unit.miniBoss.id !== itemId) throw new Error(`No boss ${itemId}`);
  return { file, unit, boss: unit.miniBoss, final: false };
}

export async function loadUnit(unitId: string): Promise<{ file: DomainFile; unit: Unit }> {
  const file = await loadDomain(domainIdOf(unitId));
  const unit = file.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`No unit ${unitId}`);
  return { file, unit };
}
