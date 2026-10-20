# Content packs

The app teaches from a content pack: a folder of JSON and Markdown files that it downloads after sign-in. The code in this repository contains no curriculum. The original wonderwander curriculum belongs to its author, Laiba, is licensed CC BY-NC-SA 4.0, and is available from the author on request; it is not in any public repository or bucket.

## Layout

```
pack.json                  manifest: { name, version, author, licence, files, ownerOnly }
domains.json               { domains: [...], order: [...] }: every domain and its units, in study order
units/<unit-id>.json       one unit: lesson, worked examples, drills, cards, mistakes, reading, doing, mini-boss
architecture.json          shared text: the doing drills' prompts and rubrics, the boss rubric, the writing ladder
prompts.json               the Gemini prompts
texts/<id>.md              bundled public-domain readings
texts/MANIFEST.json        each reading's title, author, translator and source
owner-only/...             readable by the instance owner alone (for example a paper module)
LICENCE.md                 the content licence
```

- `version` names the content: the build date and a hash of the files, so the same files always give the same version.
- `author` and `licence` appear on the About screen, so a pack carries its own notice.
- The exact shapes are the TypeScript types in `src/content/types.ts`, checked on download by the zod schemas in `src/content/packSchema.ts`.

## Ids

Content and user progress meet only through ids, so they must stay stable across versions.

- Domains: `logic`, `epistemology`, `metaphysics`, `mind`, `religion`, `religious-epistemology`, `political`, in tracks `logic`, `A`, `B` and `C`.
- Units: `<domain>-<n>`, for example `logic-1`.
- Items inside a unit: `<unit>:drill:<id>`, `<unit>:card:<n>`, `<unit>:comp:<id>`, the doing drills `<unit>:reconstruct`, `<unit>:object` and their siblings, and `<unit>:boss`; per domain, `<domain>:final-boss` and the writing ladder `<domain>:ladder:<step>`.

## Building a pack from Markdown

`npm run content` parses Markdown sources in `content/raw` into `content/json`, and writes `content/PARSE_REPORT.md` with anything it could not place. The parser keeps definitions and keys word for word: it splits documents into fields and never rewrites them. It expects:

- one file per Logic unit and one file per other domain, plus one appendix per domain (file names in `scripts/content/structure.ts`);
- in a unit document, numbered `##` sections (`## 1. Title`), with lesson subsections as `###` headings; domain documents use `## Unit <n>: <title>` with numbered `### <n>.<m> Title` subsections;
- drills and cards in their own sections, each drill with its answer key in REQUIRED, ACCEPT, REJECT and NOTES parts;
- the fallacy unit's lesson giving each fallacy a `###` heading whose following paragraph opens with its one sentence diagnosis (the fallacy finder uses that sentence as its key);
- boss playbooks in the appendices with POSITION, STANDARD OBJECTIONS, ESCALATION LADDER, CONCESSION RULE and FORBIDDEN MOVES.

A different curriculum can be written in the same layout, or converted to the JSON shapes above by any other means.

## Publishing

1. `npm run content`, then `PACK_AUTHOR="Your Name" npm run pack`: writes `.pack/<version>/` (not committed).
2. `npm run upload-pack`: signs in as the owner (the password is asked for, never stored), uploads `packs/<version>/` to the private `content` bucket, then points `packs/current.json` at it.
3. Phones pick up the new version at their next daily check.
4. After the curriculum changes, `npm run fingerprints` refreshes `scripts/curriculum-fingerprints.txt`, the hashes that let `npm run lint` refuse curriculum text in this repository.
