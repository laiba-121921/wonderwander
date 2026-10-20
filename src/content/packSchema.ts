import { z } from 'zod';

// PHASE_15_PLUS 3.1 and 3.3: the content pack's shapes, checked when a pack is built and again when the app downloads
// one. The checks are structural (the parser validates the content itself); unknown fields pass through.

export const PackManifest = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^[\w.-]+$/),
  author: z.string().min(1),
  licence: z.string().min(1),
  files: z.array(z.string().min(1)),
  ownerOnly: z.array(z.string()).default([]),
});
export type PackManifest = z.infer<typeof PackManifest>;

export const CurrentPointer = z.object({ version: z.string().regex(/^[\w.-]+$/) });

const Key = z.looseObject({ required: z.array(z.string()), accept: z.array(z.string()), reject: z.array(z.string()) });
const Drill = z.looseObject({ id: z.string(), kind: z.enum(['tap', 'keyed']), prompt: z.string() });
const Boss = z.looseObject({ id: z.string(), name: z.string(), position: z.string(), exitTurns: z.number() });

export const DomainsFile = z.object({
  domains: z.array(z.looseObject({ id: z.string(), title: z.string(), track: z.string(), unitIds: z.array(z.string()), finalBoss: Boss })),
  order: z.array(z.looseObject({ id: z.string(), track: z.string(), order: z.number(), title: z.string(), unitIds: z.array(z.string()) })),
});

export const UnitFile = z.looseObject({
  id: z.string(),
  domain: z.string(),
  number: z.number(),
  title: z.string(),
  lesson: z.array(z.looseObject({ id: z.string(), heading: z.string(), markdown: z.string() })),
  drills: z.array(Drill),
  cards: z.array(z.looseObject({ id: z.string(), front: z.string(), back: z.string(), key: Key })),
  reading: z.looseObject({ texts: z.array(z.unknown()), guide: z.array(z.string()), comprehension: z.array(Drill) }),
  doing: z.looseObject({ reconstruct: z.looseObject({ id: z.string(), key: Key }) }),
  miniBoss: Boss,
});

export const PaperFile = z.looseObject({ intro: z.string(), comprehension: z.array(Drill), thesisSets: z.array(z.unknown()) });
export const ArchitectureFile = z.looseObject({ doing: z.looseObject({ reconstructPrompt: z.string() }), ladder: z.array(z.unknown()) });
export const TextManifest = z.array(z.looseObject({ id: z.string(), title: z.string() }));
