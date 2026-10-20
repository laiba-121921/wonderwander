import type { AnswerKey, AuthorPlaybook, BossPlaybook, Drill, TextRef } from '../../src/content/types';
import { boldDrills, buildDrill } from './drills';
import { numberedList, paragraphs, splitSections } from './markdown';
import type { Report } from './report';
import { emptyKey, listItems, plain, splitKey, splitNumbered } from './text';

export interface ParsedAppendixUnit {
  number: number;
  texts: TextRef[];
  guide: string[];
  comprehension: Drill[];
  reconstruct: { passage: string; identifyingPhrase?: string; key: AnswerKey };
  object: { loadBearing: string; alreadyAnswered: string; onTrackExamples?: string };
  author: AuthorPlaybook;
  boss: BossPlaybook;
}

export interface ParsedAppendix {
  intro: string;
  units: ParsedAppendixUnit[];
  ladderTheses: string[];
}

const CAPS_LABELS = [
  'BOSS',
  'POSITION',
  'OPENING MOVE',
  'STANDARD OBJECTIONS',
  'ESCALATION',
  'CONCESSION RULE',
  'FORBIDDEN',
  'FORBIDDEN MOVES',
  'EXIT',
  'ART',
  'RUBRIC',
  'REPLIES',
  'REQUIRED',
  'ACCEPT',
  'REJECT',
];

// Reads "LABEL: text" paragraphs. Unlabelled paragraphs belong to the previous label;
// bold-labelled paragraphs ("**Role reversal.**") become their own entries.
export function labelBlocks(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let last: string | null = null;
  for (const p of paragraphs(text)) {
    const caps = p.match(/^([A-Z][A-Z -]+[A-Z])(?: \(([^)]*)\))?:\s*([\s\S]*)$/);
    if (caps && CAPS_LABELS.includes(caps[1]!)) {
      last = caps[1]!;
      const qualifier = caps[2] ? `(${caps[2]}) ` : '';
      out.set(last, (out.get(last) ? out.get(last) + '\n\n' : '') + qualifier + caps[3]!.trim());
      continue;
    }
    const bold = p.match(/^\*\*([^*]+?)[:.]?\*\*[:.]?\s*([\s\S]*)$/);
    if (bold) {
      last = bold[1]!.trim();
      out.set(last, bold[2]!.trim());
      continue;
    }
    if (last) out.set(last, out.get(last) + '\n\n' + p);
    else out.set('_', (out.get('_') ? out.get('_') + '\n\n' : '') + p);
  }
  return out;
}

function findLabel(blocks: Map<string, string>, re: RegExp): string | undefined {
  for (const [k, v] of blocks) if (re.test(k)) return v;
  return undefined;
}

export function parseKeyBlock(text: string, where: string, report: Report): AnswerKey {
  const blocks = labelBlocks(text);
  const key = emptyKey();
  const required = blocks.get('REQUIRED');
  const inline = blocks.get('_');
  if (required) key.required = splitNumbered(plain(required)) ?? [plain(required)];
  else if (inline && /\bREQUIRED adds:/.test(inline)) {
    // Political 6 and 11: "**Key.** As in lesson Example 6A: a; b; c. REQUIRED adds: d."
    const [base, extra] = inline.split(/\s*\bREQUIRED adds:\s*/);
    key.required = [...splitKey(base!), plain(extra!)];
    report.warn(where, 'key given inline ("As the lesson\'s Example ...; REQUIRED adds: ..."); split on semicolons plus the added element');
  } else report.error(where, 'no REQUIRED line');
  if (blocks.get('ACCEPT')) key.accept = listItems(blocks.get('ACCEPT')!);
  if (blocks.get('REJECT')) key.reject = listItems(blocks.get('REJECT')!);
  return key;
}

export function parseAuthor(heading: string, body: string, where: string, report: Report): AuthorPlaybook {
  const blocks = labelBlocks(body);
  const author = heading.match(/\((.*)\)/)?.[1]?.trim() ?? '';
  const pb = {
    author,
    position: blocks.get('POSITION') ?? '',
    replies: blocks.get('REPLIES') ?? '',
    forbidden: blocks.get('FORBIDDEN') ?? '',
  };
  for (const [k, v] of Object.entries(pb)) if (!v) report.error(where, `author playbook missing ${k}`);
  return pb;
}

export function parseBoss(id: string, heading: string, body: string, final: boolean, report: Report): BossPlaybook {
  const blocks = labelBlocks(body);
  const name = heading.replace(/^(Boss playbook|.*final boss):\s*/i, '').trim();
  const bossLine = blocks.get('BOSS') ?? '';
  // "The Seeker, a sincere nonbeliever who..." gives the persona after the first comma
  const persona = bossLine.replace(/^[^,]+,\s*/, '');
  const exit = blocks.get('EXIT') ?? '';
  const exitTurns = Number(exit.match(/after (\d+) student turns/)?.[1] ?? 0);
  const rubricText = final
    ? (blocks.get('RUBRIC') ?? '').replace(/^[\s\S]*?\bplus:\s*/, '')
    : findLabel(blocks, /^Unit-specific rubric items/) ?? '';
  const boss: BossPlaybook = {
    id,
    name,
    persona: plain(persona),
    position: blocks.get('POSITION') ?? '',
    openingMove: blocks.get('OPENING MOVE') ?? '',
    standardObjections: blocks.get('STANDARD OBJECTIONS') ?? '',
    escalation: blocks.get('ESCALATION') ?? '',
    concessionRule: blocks.get('CONCESSION RULE') ?? '',
    exit,
    exitTurns,
    rubricExtra: listItems(rubricText),
    alwaysEscalate: final,
  };
  const forbidden = blocks.get('FORBIDDEN') ?? blocks.get('FORBIDDEN MOVES');
  if (forbidden) boss.forbidden = forbidden;
  // "ART: pose point; accessory toga." (27-final-bosses.md)
  const art = blocks.get('ART');
  if (art) {
    const pose = art.match(/pose ([^;.]+)/)?.[1]?.trim();
    const accessory = art.match(/accessory ([\s\S]+?)\.?$/)?.[1]?.trim();
    if (pose && accessory) boss.art = { pose, accessory };
    else report.warn(id, `could not read ART line "${art}"`);
  }
  const reversal = findLabel(blocks, /^Role reversal/i);
  if (reversal) boss.roleReversal = reversal;
  if (blocks.get('_')) report.warn(id, 'boss playbook has text before its first label');
  return boss;
}

function textRefs(body: string, where: string, report: Report): TextRef[] {
  const refs: TextRef[] = [];
  for (const p of paragraphs(body)) {
    const m = p.match(/^\*\*([^*]+?):?\*\*:?\s*/);
    const label = m?.[1]?.trim() ?? '';
    let role: TextRef['role'] | null = null;
    if (/^(Primary|Philosophy|Technique)/i.test(label)) role = 'primary';
    else if (/^Second/i.test(label)) role = 'second';
    else if (/^Companion/i.test(label)) role = 'companion';
    else if (/^Optional/i.test(label)) role = 'optional';
    if (!role) {
      report.warn(where, `reading paragraph without a known label: "${plain(p).slice(0, 60)}"`);
      continue;
    }
    refs.push({ role, label: plain(p) });
  }
  if (refs.length === 0) report.error(where, 'no reading texts');
  return refs;
}

export function parseAppendix(md: string, domainPrefix: string, report: Report): ParsedAppendix {
  const top = splitSections(md, 2);
  const result: ParsedAppendix = { intro: '', units: [], ladderTheses: [] };
  const intro: string[] = [];
  for (const sec of top.sections) {
    const unitMatch = sec.heading.match(/Unit (\d+) appendix$/);
    if (unitMatch) {
      result.units.push(parseUnitBlock(Number(unitMatch[1]), sec.body, domainPrefix, report));
    } else if (/final boss/i.test(sec.heading)) {
      // superseded by 27-final-bosses.md; kept out of the intro
    } else if (/writing ladder/i.test(sec.heading)) {
      result.ladderTheses = numberedList(sec.body);
    } else intro.push(`## ${sec.heading}\n\n${sec.body}`);
  }
  result.intro = intro.join('\n\n');
  return result;
}

function parseUnitBlock(number: number, body: string, domain: string, report: Report): ParsedAppendixUnit {
  const unitId = `${domain}-${number}`;
  const subs = splitSections(body, 3).sections;
  const get = (re: RegExp) => subs.find((s) => re.test(s.heading));

  const reading = get(/^Reading$/);
  const guide = get(/^Reading guide/);
  const comp = get(/^Comprehension drills/);
  const recon = get(/^Reconstruct/);
  const object = get(/^Object/);
  const author = get(/^Author playbook/);
  const boss = get(/^Boss playbook/);
  for (const [name, s] of Object.entries({ reading, guide, comp, recon, object, author, boss })) {
    if (!s) report.error(unitId, `appendix block missing ${name}`);
  }

  const comprehension = boldDrills(comp?.body ?? '').map((raw) => buildDrill(raw, `${unitId}:comp:${raw.sourceId}`, report));

  const reconBlocks = labelBlocks(recon?.body ?? '');
  const passage = plain(reconBlocks.get('Passage') ?? '');
  if (!passage) report.error(unitId, 'reconstruct has no passage');
  const identifyingPhrase = passage.match(/Identifying phrase:\s*"([^"]+)"/)?.[1];
  const keyText = (reconBlocks.get('Key') ? reconBlocks.get('Key') + '\n\n' : '') + ['REQUIRED', 'ACCEPT', 'REJECT'].filter((k) => reconBlocks.get(k)).map((k) => `${k}: ${reconBlocks.get(k)}`).join('\n\n');

  const objBlocks = labelBlocks(object?.body ?? '');
  const loadBearing = findLabel(objBlocks, /^Load-bearing/) ?? '';
  const alreadyAnswered = findLabel(objBlocks, /^ALREADY-ANSWERED/) ?? '';
  if (!loadBearing) report.error(unitId, 'object has no load-bearing premises');
  if (!alreadyAnswered) report.error(unitId, 'object has no ALREADY-ANSWERED list');
  const onTrack = findLabel(objBlocks, /^On-track/i);

  return {
    number,
    texts: textRefs(reading?.body ?? '', unitId, report),
    guide: numberedList(guide?.body ?? ''),
    comprehension,
    reconstruct: {
      passage,
      ...(identifyingPhrase ? { identifyingPhrase } : {}),
      key: parseKeyBlock(keyText, `${unitId}:reconstruct`, report),
    },
    object: { loadBearing: plain(loadBearing), alreadyAnswered: plain(alreadyAnswered), ...(onTrack ? { onTrackExamples: plain(onTrack) } : {}) },
    author: parseAuthor(author?.heading ?? '', author?.body ?? '', `${unitId}:reply`, report),
    boss: parseBoss(`${unitId}:boss`, boss?.heading ?? '', boss?.body ?? '', false, report),
  };
}
