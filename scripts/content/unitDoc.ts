import type { Card, DomainId, LessonSection } from '../../src/content/types';
import { paragraphs, splitSections, type Section } from './markdown';
import type { Report } from './report';
import { boldDrills, headingDrills, parseCards, type RawDrill } from './drills';

export interface ParsedUnitDoc {
  number: number;
  title: string;
  lesson: LessonSection[];
  whyCares?: string;
  workedExamples: string;
  rawDrills: RawDrill[];
  cards: Card[];
  mistakes: string;
}

type Kind = 'worked' | 'drills' | 'cards' | 'drillsAndCards' | 'why' | 'mistakes' | 'lesson';

function classify(title: string): Kind {
  if (/^Worked examples/i.test(title)) return 'worked';
  if (/^Drills and move-cards/i.test(title)) return 'drillsAndCards';
  if (/^Drills/i.test(title)) return 'drills';
  if (/^Move-cards/i.test(title)) return 'cards';
  if (/^Why philosophy cares$/i.test(title)) return 'why';
  if (/^(Common beginner mistakes|Mistakes)/i.test(title)) return 'mistakes';
  return 'lesson';
}

// Drops the superseded pass condition (Testing Architecture section 8 replaces it).
function mistakesOnly(body: string): string {
  const { preamble, sections } = splitSections(body, 3);
  if (sections.length) {
    return [preamble, ...sections.filter((s) => !/^Pass condition/i.test(s.heading)).map((s) => `### ${s.heading}\n\n${s.body}`)]
      .filter(Boolean)
      .join('\n\n');
  }
  return paragraphs(body)
    .filter((p) => !/^\*\*Pass condition\.?\*\*/.test(p))
    .join('\n\n');
}

function build(
  unitId: string,
  number: number,
  title: string,
  parts: { number: string; title: string; body: string }[],
  report: Report,
): ParsedUnitDoc {
  const out: ParsedUnitDoc = { number, title, lesson: [], workedExamples: '', rawDrills: [], cards: [], mistakes: '' };
  for (const p of parts) {
    const kind = classify(p.title);
    if (kind === 'lesson') {
      out.lesson.push({ id: `${unitId}:s${p.number}`, number: p.number, heading: p.title, markdown: p.body });
    } else if (kind === 'why') out.whyCares = p.body;
    else if (kind === 'worked') out.workedExamples = p.body;
    else if (kind === 'mistakes') out.mistakes = mistakesOnly(p.body);
    else {
      const sub = splitSections(p.body, 3).sections;
      const cardRegion =
        kind === 'cards' ? p.body : sub.filter((s) => /^Move-cards/i.test(s.heading)).map((s) => s.body).join('\n');
      const drillRegion =
        kind === 'cards' ? '' : kind === 'drillsAndCards' ? sub.filter((s) => /^Drills/i.test(s.heading)).map((s) => s.body).join('\n') : p.body;
      if (kind !== 'cards') {
        const heading = headingDrills(sub);
        out.rawDrills.push(...(heading.length ? heading : boldDrills(drillRegion)));
        const skipped = sub.filter((s) => !/^Drill |^Move-cards|^Drills/i.test(s.heading));
        for (const s of skipped) report.notes.push(`${unitId}: skipped "${s.heading}" inside the drills section (superseded by the Testing Architecture)`);
      }
      if (cardRegion) out.cards.push(...parseCards(cardRegion, unitId, report));
    }
  }
  if (!out.workedExamples) report.error(unitId, 'no worked examples section');
  if (!out.mistakes) report.error(unitId, 'no mistakes section');
  if (out.lesson.length === 0) report.error(unitId, 'no lesson sections');
  return out;
}

// Logic unit docs: one unit per file, "## N. Title" sections.
export function parseLogicUnitDoc(md: string, number: number, report: Report): ParsedUnitDoc {
  const unitId = `logic-${number}`;
  const h1 = md.match(/^# (.*)$/m)?.[1] ?? '';
  const title = h1.replace(/^.*?Unit \d+:\s*/, '').trim();
  const { sections } = splitSections(md, 2);
  const parts = sections.map((s) => {
    const m = s.heading.match(/^(\d+)\.\s+(.*)$/);
    if (!m) report.warn(unitId, `unnumbered section "${s.heading}"`);
    return { number: m?.[1] ?? '', title: m?.[2] ?? s.heading, body: s.body };
  });
  return build(unitId, number, title, parts, report);
}

// Domain docs: "## Unit N: Title" with "### N.M Title" sections. Returns the intro too.
export function parseDomainDoc(
  md: string,
  domain: DomainId,
  report: Report,
): { title: string; intro: string; outro: string; units: ParsedUnitDoc[] } {
  const h1 = md.match(/^# (.*)$/m)?.[1] ?? '';
  const title = h1.replace(/^wonderwander\s+/, '').replace(/:.*$/, '').replace(/\s*\(Track [A-C]\)/, '').trim();
  const top = splitSections(md, 2);
  const unitSections = top.sections.filter((s) => /^Unit \d+:/.test(s.heading));
  const introSections = top.sections.filter((s) => !/^Unit \d+:/.test(s.heading));
  const intro = introSections.map((s: Section) => `## ${s.heading}\n\n${s.body}`).join('\n\n');
  const outro: string[] = [];
  const units = unitSections.map((s) => {
    const m = s.heading.match(/^Unit (\d+):\s*(.*)$/)!;
    const number = Number(m[1]);
    const unitId = `${domain}-${number}`;
    // The last unit closes with "What this track has given you", which is about the domain, not the unit.
    const subs = splitSections(s.body, 3).sections.filter((sub) => {
      if (!/^What .* given you$/.test(sub.heading)) return true;
      outro.push(`### ${sub.heading}\n\n${sub.body}`);
      return false;
    });
    const parts = subs.map((sub) => {
      const mm = sub.heading.match(/^(\d+\.\d+)\s+(.*)$/);
      if (!mm) report.warn(unitId, `unnumbered section "${sub.heading}"`);
      return { number: mm?.[1] ?? '', title: mm?.[2] ?? sub.heading, body: sub.body };
    });
    return build(unitId, number, m[2]!.trim(), parts, report);
  });
  return { title, intro, outro: outro.join('\n\n'), units };
}
