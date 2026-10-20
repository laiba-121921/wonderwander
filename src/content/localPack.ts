import type { DomainFile } from './types';

// Development and tests: the same pack paths, read from the parser's output in content/ instead of downloaded. In a
// production build this module is never included (load.ts only imports it when __LOCAL_CONTENT__ is true).

const domainFiles = import.meta.glob<DomainFile>('../../content/json/{logic,epistemology,metaphysics,mind,religion,religious-epistemology,political}.json', { import: 'default' });
const indexFile = import.meta.glob<{ domains: unknown[] }>('../../content/json/index.json', { import: 'default', eager: true });
const singles = import.meta.glob<unknown>('../../content/json/{architecture,prompts,paper}.json', { import: 'default' });
const textFiles = import.meta.glob<string>('../../content/texts/*.md', { query: '?raw', import: 'default' });
const manifest = import.meta.glob<unknown>('../../content/texts/MANIFEST.json', { import: 'default' });

export const localOrder = (Object.values(indexFile)[0]?.domains ?? []) as unknown[];

const json = (v: unknown) => JSON.stringify(v);

async function allDomains(): Promise<DomainFile[]> {
  return Promise.all(Object.values(domainFiles).map((load) => load()));
}

export async function readLocal(path: string): Promise<string | null> {
  if (path === 'domains.json') return json({ domains: (await allDomains()).map((f) => f.domain), order: localOrder });
  const unit = path.match(/^units\/(.+)\.json$/);
  if (unit) {
    const domain = unit[1]!.replace(/-\d+$/, '');
    const file = await domainFiles[`../../content/json/${domain}.json`]?.();
    const u = file?.units.find((x) => x.id === unit[1]);
    return u ? json(u) : null;
  }
  if (path === 'architecture.json' || path === 'prompts.json') return json(await singles[`../../content/json/${path}`]?.());
  if (path === 'owner-only/paper-module.json') {
    const load = singles['../../content/json/paper.json'];
    return load ? json(await load()) : null;
  }
  if (path === 'texts/MANIFEST.json') {
    const load = Object.values(manifest)[0];
    return load ? json(await load()) : null;
  }
  const text = path.match(/^texts\/(.+\.md)$/);
  if (text) return (await textFiles[`../../content/texts/${text[1]}`]?.()) ?? null;
  return null;
}
