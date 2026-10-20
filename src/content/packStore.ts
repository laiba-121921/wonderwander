import { localDate } from '../domain/dates';
import { idbDelete, idbGet, idbKeys, idbSetMany } from '../lib/idb';
import { supabase } from '../lib/supabase';
import { ArchitectureFile, CurrentPointer, DomainsFile, PackManifest, PaperFile, TextManifest, UnitFile } from './packSchema';

// PHASE_15_PLUS 3.3: on sign-in the app reads packs/current.json, downloads the pack files it may read, validates
// them and keeps them in IndexedDB under the pack version. Later launches read IndexedDB and look for a new version
// once a day. Offline, the copy on the device is used.

export interface PackMeta {
  version: string;
  checkedOn: string; // local date of the last look at current.json
  hasPaper: boolean;
}

export type Progress = (done: number, total: number) => void;
export const OWNER_ONLY_PAPER = 'owner-only/paper-module.json';

async function download(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('content').download(path);
  if (error || !data) return null;
  return data.text();
}

function check(path: string, text: string): void {
  const v = JSON.parse(text) as unknown;
  if (path === 'domains.json') DomainsFile.parse(v);
  else if (path.startsWith('units/')) UnitFile.parse(v);
  else if (path === 'architecture.json') ArchitectureFile.parse(v);
  else if (path === 'texts/MANIFEST.json') TextManifest.parse(v);
  else if (path === OWNER_ONLY_PAPER) PaperFile.parse(v);
}

const key = (version: string, path: string) => `${version}/${path}`;

async function fetchPack(version: string, onProgress?: Progress): Promise<PackMeta> {
  const manifestText = await download(`packs/${version}/pack.json`);
  if (!manifestText) throw new Error('The content pack could not be downloaded.');
  const manifest = PackManifest.parse(JSON.parse(manifestText));
  const entries: [string, string][] = [[key(version, 'pack.json'), manifestText]];
  const total = manifest.files.length + 1;
  let done = 0;
  // a few at a time: quick on a phone without flooding it
  const queue = [...manifest.files];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        const text = await download(`packs/${version}/${path}`);
        if (text === null) throw new Error(`The content pack is missing ${path}.`);
        if (path.endsWith('.json')) check(path, text);
        entries.push([key(version, path), text]);
        onProgress?.(++done, total);
      }
    }),
  );
  // owner-only files exist for the owner alone; for anyone else the download is refused and the module stays hidden
  const paper = await download(`packs/${version}/${OWNER_ONLY_PAPER}`);
  if (paper) {
    check(OWNER_ONLY_PAPER, paper);
    entries.push([key(version, OWNER_ONLY_PAPER), paper]);
  }
  onProgress?.(total, total);
  const meta: PackMeta = { version, checkedOn: localDate(new Date()), hasPaper: Boolean(paper) };
  await idbSetMany('pack', [...entries, ['meta', meta]]);
  // drop any older version
  const stale = (await idbKeys('pack')).filter((k) => k !== 'meta' && !k.startsWith(`${version}/`));
  if (stale.length) await idbDelete('pack', stale);
  return meta;
}

export async function ensurePack(onProgress?: Progress): Promise<PackMeta> {
  const meta = await idbGet<PackMeta>('pack', 'meta').catch(() => undefined);
  const today = localDate(new Date());
  if (meta && meta.checkedOn === today) return meta;
  const pointer = await download('packs/current.json').catch(() => null);
  if (!pointer) {
    if (meta) return meta; // offline or unreachable: keep using the copy on the device
    throw new Error('The content could not be downloaded. Check the connection and try again.');
  }
  const { version } = CurrentPointer.parse(JSON.parse(pointer));
  if (meta && meta.version === version) {
    const next = { ...meta, checkedOn: today };
    await idbSetMany('pack', [['meta', next]]);
    return next;
  }
  return fetchPack(version, onProgress);
}

export async function readPacked(version: string, path: string): Promise<string | null> {
  return (await idbGet<string>('pack', key(version, path))) ?? null;
}
