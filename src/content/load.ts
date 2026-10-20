import { useEffect, useState } from 'react';
import type { DoingText } from '../engines/doing/standardForm';
import type { DomainFile, DomainId, PaperModule, TrackId, Unit } from './types';
import { extractDiagnoses, setFallacyDiagnoses } from '../engines/logic/fallacies';
import { ensurePack, OWNER_ONLY_PAPER, readPacked, type Progress } from './packStore';

export interface DomainSummary {
  id: DomainId;
  track: TrackId;
  order: number;
  title: string;
  unitIds: string[];
}

export interface TextManifestEntry {
  id: string;
  title: string;
  author: string;
  translator?: string;
  source: string;
  words: number;
}

export interface Architecture {
  doing: DoingText;
  playbookTemplate: string;
  bossBaseRubric: string[];
  ladder: { step: number; title: string; prompt?: string; rubric: string[]; reject: string[]; body: string }[];
}

// PHASE_15_PLUS 3.3: production reads the downloaded content pack; development and tests read content/ directly.
export const CONTENT_SOURCE: 'pack' | 'local' = __LOCAL_CONTENT__ ? 'local' : 'pack';

// Filled before the app renders (PackGate); in local mode straight away.
export const DOMAINS: DomainSummary[] = [];
export const TRACKS: { id: TrackId; title: string }[] = [
  { id: 'logic', title: 'Logic' },
  { id: 'A', title: 'Track A' },
  { id: 'B', title: 'Track B' },
  { id: 'C', title: 'Track C' },
];

let reader: ((path: string) => Promise<string | null>) | null = null;
let paperAvailable = false;
let ready: Promise<void> | null = null;

async function useLocal() {
  const local = await import('./localPack');
  reader = local.readLocal;
  paperAvailable = (await local.readLocal(OWNER_ONLY_PAPER)) !== null;
  DOMAINS.splice(0, DOMAINS.length, ...(local.localOrder as DomainSummary[]));
}

// Downloads the pack if needed (reporting progress) and makes it readable. Safe to call more than once.
export function initContent(onProgress?: Progress): Promise<void> {
  ready ??= (async () => {
    if (__LOCAL_CONTENT__) await useLocal();
    else {
      const meta = await ensurePack(onProgress);
      reader = (path) => readPacked(meta.version, path);
      paperAvailable = meta.hasPaper;
      const domains = JSON.parse((await reader('domains.json'))!) as { order: DomainSummary[] };
      DOMAINS.splice(0, DOMAINS.length, ...domains.order);
    }
    // the fallacy finder's key is Logic 7's own wording
    const logic7 = await reader!('units/logic-7.json');
    setFallacyDiagnoses(logic7 ? extractDiagnoses((JSON.parse(logic7) as Unit).lesson) : {});
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export const hasPaperModule = () => paperAvailable;

export interface PackInfo {
  version: string;
  author: string;
  licence: string;
}

// PHASE_15_PLUS 6: who wrote the content in use and under what licence, from the pack's own manifest. Development
// reads content/ directly and has no manifest.
export async function loadPackInfo(): Promise<PackInfo | null> {
  await initContent();
  const text = await reader!('pack.json');
  if (!text) return null;
  const { version, author, licence } = JSON.parse(text) as PackInfo;
  return { version, author, licence };
}

const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    const p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return cache.get(key) as Promise<T>;
}

async function readJson<T>(path: string): Promise<T> {
  await initContent();
  const text = await reader!(path);
  if (text === null) throw new Error(`Not in the content pack: ${path}`);
  return JSON.parse(text) as T;
}

export function loadDomain(id: string): Promise<DomainFile> {
  return cached(`domain:${id}`, async () => {
    const { domains } = await readJson<{ domains: DomainFile['domain'][] }>('domains.json');
    const domain = domains.find((d) => d.id === id);
    if (!domain) throw new Error(`No domain ${id}`);
    const units = await Promise.all(domain.unitIds.map((u) => readJson<Unit>(`units/${u}.json`)));
    return { domain, units };
  });
}

export function loadPaper(): Promise<PaperModule> {
  return cached('paper', () => readJson<PaperModule>(OWNER_ONLY_PAPER));
}

export function loadText(id: string): Promise<string> {
  return cached(`text:${id}`, async () => {
    await initContent();
    const text = await reader!(`texts/${id}.md`);
    if (text === null) throw new Error(`No text ${id}`);
    return text;
  });
}

export function loadManifest(): Promise<TextManifestEntry[]> {
  return cached('manifest', () => readJson<TextManifestEntry[]>('texts/MANIFEST.json').catch(() => []));
}

export function loadArchitecture(): Promise<Architecture> {
  return cached('architecture', () => readJson<Architecture>('architecture.json'));
}

// The authored student prompts and rubrics of the doing drills (Testing Architecture section 4).
export function loadDoingText(): Promise<DoingText> {
  return loadArchitecture().then((a) => a.doing);
}

// The playbook template (for its standard FORBIDDEN MOVES line) and the standard boss rubric (Testing Architecture section 5).
export function loadBossText(): Promise<{ playbookTemplate: string; bossBaseRubric: string[] }> {
  return loadArchitecture().then((a) => ({ playbookTemplate: a.playbookTemplate, bossBaseRubric: a.bossBaseRubric }));
}

// Each result is tagged with the inputs it was loaded for, so a stale result reads as "still loading".
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: Error | null } {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; data: T | null; error: Error | null }>({ key: '', data: null, error: null });
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ key, data, error: null }),
      (error: Error) => live && setState({ key, data: null, error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: null, error: null };
}
