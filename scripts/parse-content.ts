import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Architecture, Domain, DomainFile, KeyedDrill, PaperModule, Unit } from '../src/content/types';
import { parseAppendix, parseBoss } from './content/appendix';
import { splitSections } from './content/markdown';
import { attachTexts } from './content/texts';
import { parseArchitecture } from './content/architecture';
import { buildDrill } from './content/drills';
import { parsePaper } from './content/paper';
import { Report } from './content/report';
import { mapRevision } from './content/revision';
import { DOMAINS, FINAL_BOSSES_FILE, SOFT_PREREQUISITES, hardPrerequisites } from './content/structure';
import { replaceDashes, stripByline } from './content/text';
import { parseDomainDoc, parseLogicUnitDoc, type ParsedUnitDoc } from './content/unitDoc';
import { collectIds, validate } from './validate-content';

const ROOT = process.cwd();
const RAW = join(ROOT, 'content', 'raw');
const OUT = join(ROOT, 'content', 'json');
const OVERRIDES = join(ROOT, 'content', 'overrides');

export interface Parsed {
  domains: DomainFile[];
  architecture: Architecture;
  paper: PaperModule;
}

function readRaw(file: string, report: Report): string {
  const path = join(RAW, file);
  if (!existsSync(path)) {
    report.error(file, 'raw file is missing');
    return '';
  }
  const text = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
  return replaceDashes(stripByline(text), file, report);
}

function parseFinalBosses(report: Report): Map<string, { heading: string; body: string }> {
  const out = new Map<string, { heading: string; body: string }>();
  for (const s of splitSections(readRaw(FINAL_BOSSES_FILE, report), 2).sections) {
    const label = s.heading.match(/^(.*?) final boss:/)?.[1]?.trim();
    if (label) out.set(label, s);
    else report.warn(FINAL_BOSSES_FILE, `unrecognised section "${s.heading}"`);
  }
  return out;
}

export function parseAll(report: Report): Parsed {
  const architecture = parseArchitecture(readRaw('00-testing-architecture.md', report), report);
  const paper = parsePaper(readRaw('30-paper-module.md', report), report);
  const finalBosses = parseFinalBosses(report);
  report.notes.push(`domain final bosses read from ${FINAL_BOSSES_FILE}; the final boss sections at the end of appendices 20 to 26 are superseded and ignored`);

  const domains: DomainFile[] = DOMAINS.map((spec) => {
    let title = 'Logic';
    let intro = '';
    let outro = '';
    let docs: ParsedUnitDoc[];
    if (spec.id === 'logic') {
      docs = spec.unitFiles.map((f, i) => parseLogicUnitDoc(readRaw(f, report), i + 1, report));
    } else {
      const parsed = parseDomainDoc(readRaw(spec.unitFiles[0]!, report), spec.id, report);
      ({ title, intro, outro } = parsed);
      docs = parsed.units;
    }
    const appendix = parseAppendix(readRaw(spec.appendixFile, report), spec.id, report);
    if (docs.length !== spec.unitCount) report.error(spec.id, `expected ${spec.unitCount} units in the unit docs, found ${docs.length}`);
    if (appendix.units.length !== spec.unitCount) report.error(spec.id, `expected ${spec.unitCount} appendix blocks, found ${appendix.units.length}`);

    const units: Unit[] = docs.map((doc) => {
      const id = `${spec.id}-${doc.number}`;
      const app = appendix.units.find((a) => a.number === doc.number);
      if (!app) report.error(id, 'no appendix block for this unit');
      const drills = doc.rawDrills.map((raw) => {
        const drill = buildDrill(raw, `${id}:drill:${raw.sourceId}`, report);
        const keyText = drill.kind === 'keyed' ? drill.key.required.join(' ') : drill.options.map((o) => o.text).join(' ');
        const mapped = mapRevision(`${drill.prompt} ${keyText}`, doc.lesson);
        if (!mapped.confident) report.low(drill.id, `no lesson section matched clearly (best score ${mapped.best}); revision shows all ${doc.lesson.length} sections`);
        drill.revisionSectionIds = mapped.ids;
        return drill;
      });
      return {
        id,
        domain: spec.id,
        number: doc.number,
        title: doc.title,
        lesson: doc.lesson,
        ...(doc.whyCares ? { whyCares: doc.whyCares } : {}),
        workedExamples: doc.workedExamples,
        drills,
        cards: doc.cards,
        mistakes: doc.mistakes,
        reading: { texts: app?.texts ?? [], guide: app?.guide ?? [], comprehension: app?.comprehension ?? [] },
        doing: {
          reconstruct: { id: `${id}:reconstruct`, ...(app?.reconstruct ?? { passage: '', key: { required: [], accept: [], reject: [], version: 1 } }) },
          object: { id: `${id}:object`, ...(app?.object ?? { loadBearing: '', alreadyAnswered: '' }) },
          reply: { id: `${id}:reply` },
          authorPlaybook: app?.author ?? { author: '', position: '', replies: '', forbidden: '' },
        },
        miniBoss: app?.boss ?? ({ id: `${id}:boss` } as Unit['miniBoss']),
        prerequisites: hardPrerequisites(spec, doc.number),
        softPrerequisites: SOFT_PREREQUISITES[id] ?? [],
      };
    });

    const ladder =
      spec.id === 'political'
        ? appendix.ladderTheses
        : paper.ladderTheses.filter((l) => l.label === spec.paperLadderLabel).map((l) => l.text);
    if (ladder.length === 0) report.warn(spec.id, 'no writing ladder thesis suggestions found');
    const fb = finalBosses.get(spec.finalBossLabel);
    if (!fb) report.error(spec.id, `no final boss "${spec.finalBossLabel}" in ${FINAL_BOSSES_FILE}`);
    const finalBoss = fb ? parseBoss(`${spec.id}:final-boss`, fb.heading, fb.body, true, report) : null;

    const domain: Domain = {
      id: spec.id,
      track: spec.track,
      order: spec.order,
      title,
      unitIds: units.map((u) => u.id),
      finalBoss: finalBoss ?? ({ id: `${spec.id}:final-boss` } as Domain['finalBoss']),
      writingLadder: { thesisSuggestions: ladder },
      ...(intro ? { intro } : {}),
      ...(outro ? { outro } : {}),
      ...(appendix.intro ? { appendixIntro: appendix.intro } : {}),
    };
    return { domain, units };
  });

  attachTexts(domains, report);
  return { domains, architecture, paper };
}

// Overrides: content/overrides/*.json, each {"id": "<item id>", "set": {...fields}};
// structure notes: content/overrides/structure-notes/*.json, each {"<drill id>": "note" | {"variants": false, "reason": "..."}}.
export function applyOverrides(parsed: Parsed, report: Report): void {
  if (!existsSync(OVERRIDES)) return;
  const index = new Map<string, Record<string, unknown>>();
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.id === 'string') index.set(o.id, o);
      Object.values(o).forEach(visit);
    }
  };
  visit(parsed);

  const notesDir = join(OVERRIDES, 'structure-notes');
  if (existsSync(notesDir)) {
    for (const file of readdirSync(notesDir).filter((f) => f.endsWith('.json')).sort()) {
      const data = JSON.parse(readFileSync(join(notesDir, file), 'utf8')) as Record<string, string | { variants: false; reason: string }>;
      for (const [id, note] of Object.entries(data)) {
        const drill = index.get(id) as KeyedDrill | undefined;
        if (!drill || drill.kind !== 'keyed') report.error(`structure-notes/${file}`, `note for unknown or non-keyed drill ${id}`);
        else if (typeof note === 'string') drill.structureNote = note;
        else drill.variants = false;
      }
    }
  }

  for (const file of readdirSync(OVERRIDES).filter((f) => f.endsWith('.json')).sort()) {
    const data = JSON.parse(readFileSync(join(OVERRIDES, file), 'utf8'));
    const target = index.get(data.id);
    if (!target) {
      report.error(file, `override targets unknown id ${data.id}`);
      continue;
    }
    Object.assign(target, data.set);
    report.notes.push(`override applied: ${file} to ${data.id}`);
  }
}

function write(name: string, value: unknown) {
  writeFileSync(join(OUT, name), JSON.stringify(value, null, 2) + '\n');
}

function main() {
  const report = new Report();
  const parsed = parseAll(report);
  applyOverrides(parsed, report);
  validate(parsed, report);

  mkdirSync(OUT, { recursive: true });
  const ids = collectIds(parsed);
  const idsPath = join(OUT, 'ids.json');
  if (existsSync(idsPath)) {
    const previous: string[] = JSON.parse(readFileSync(idsPath, 'utf8'));
    const now = new Set(ids);
    for (const gone of previous.filter((id) => !now.has(id))) report.warn(gone, 'item id disappeared since the last parse; saved progress for it will be orphaned');
  }

  for (const d of parsed.domains) write(`${d.domain.id}.json`, d);
  write('architecture.json', parsed.architecture);
  write('prompts.json', parsed.architecture.prompts);
  write('paper.json', parsed.paper);
  write('index.json', {
    domains: parsed.domains.map((d) => ({ id: d.domain.id, track: d.domain.track, order: d.domain.order, title: d.domain.title, unitIds: d.domain.unitIds })),
  });
  write('ids.json', ids);
  writeFileSync(join(ROOT, 'content', 'PARSE_REPORT.md'), report.toMarkdown());

  console.log(`Parsed ${parsed.domains.reduce((n, d) => n + d.units.length, 0)} units. Errors ${report.errors.length}, warnings ${report.warnings.length}, low-confidence ${report.lowConfidence.length}.`);
  for (const e of report.errors.slice(0, 40)) console.error(`ERROR ${e.where}: ${e.message}`);
  if (report.errors.length > 40) console.error(`...and ${report.errors.length - 40} more in content/PARSE_REPORT.md`);
  if (report.errors.length) process.exit(1);
}

if (process.argv[1]?.endsWith('parse-content.ts')) main();
