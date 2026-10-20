import type { PaperModule, PaperThesisSet } from '../../src/content/types';
import { labelBlocks, parseAuthor, parseKeyBlock } from './appendix';
import { boldDrills, buildDrill } from './drills';
import { numberedList, paragraphs, splitSections } from './markdown';
import type { Report } from './report';
import { plain } from './text';

export function parsePaper(md: string, report: Report): PaperModule {
  const top = splitSections(md, 2).sections;
  const h2 = (re: RegExp) => {
    const s = top.find((x) => re.test(x.heading));
    if (!s) report.error('paper', `section matching ${re} not found`);
    return s?.body ?? '';
  };
  const h3 = (body: string, re: RegExp) => splitSections(body, 3).sections.find((s) => re.test(s.heading))?.body ?? '';

  const intro = h2(/What this module is/);
  const theses = paragraphs(intro)
    .map((p) => p.match(/^\*\*Thesis ([ABC])\b[^*]*\*\*\s*/))
    .map((m, i) => (m ? { id: m[1] as 'A' | 'B' | 'C', text: paragraphs(intro)[i]! } : null))
    .filter((t): t is { id: 'A' | 'B' | 'C'; text: string } => t !== null);
  if (theses.length !== 3) report.error('paper', `expected 3 theses, found ${theses.length}`);

  const readingSec = h2(/Reading guide and comprehension/);
  const comprehension = boldDrills(h3(readingSec, /^Comprehension drills/)).map((raw) =>
    buildDrill(raw, `paper:comp:${raw.sourceId}`, report),
  );

  const litSec = h2(/literature map drill/);
  const litParts = splitSections(litSec, 3);
  const keysBody = litParts.sections.find((s) => /^Keys/.test(s.heading))?.body ?? '';
  const keyParas = paragraphs(keysBody);
  const keys = keyParas
    .map((p) => p.match(/^\*\*([^*]+?)\.\*\*\s*([\s\S]*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ label: m[1]!.trim(), text: plain(m[2]!) }));
  if (keys.length !== 7) report.error('paper:literature-map', `expected 7 abstract keys, found ${keys.length}`);

  const thesisSets: PaperThesisSet[] = (['A', 'B', 'C'] as const).map((t, i) => {
    const body = h2(new RegExp(`^${5 + i}\\. Thesis ${t} drills`));
    const title = top.find((x) => x.heading.startsWith(`${5 + i}. Thesis ${t}`))?.heading.replace(/^.*?drills:\s*/, '') ?? '';
    const recon = labelBlocks(h3(body, /^Reconstruct/));
    const obj = labelBlocks(h3(body, /^Object/));
    const replyBody = h3(body, /^Reply/);
    const replyBlocks = labelBlocks(replyBody);
    const authorLabel = [...replyBlocks.keys()].find((k) => /^Author playbook/.test(k)) ?? '';
    const playbookText = ['POSITION', 'REPLIES', 'FORBIDDEN'].map((k) => `${k}: ${replyBlocks.get(k) ?? ''}`).join('\n\n');
    const keyText = ['REQUIRED', 'ACCEPT', 'REJECT'].filter((k) => recon.get(k)).map((k) => `${k}: ${recon.get(k)}`).join('\n\n');
    const find = (m: Map<string, string>, re: RegExp) => [...m].find(([k]) => re.test(k))?.[1];
    const onTrack = find(obj, /^On-track/);
    return {
      thesis: t,
      title,
      reconstruct: { id: `paper:${t}:reconstruct`, task: plain(recon.get('Task') ?? ''), key: parseKeyBlock(keyText, `paper:${t}:reconstruct`, report) },
      object: {
        id: `paper:${t}:object`,
        task: plain(obj.get('Task') ?? ''),
        rubric: plain(find(obj, /^Rubric/) ?? ''),
        ...(onTrack ? { onTrackExamples: plain(onTrack) } : {}),
        alreadyAnswered: plain(find(obj, /^ALREADY-ANSWERED/) ?? ''),
      },
      reply: {
        id: `paper:${t}:reply`,
        authorPlaybook: parseAuthor(authorLabel, playbookText, `paper:${t}:reply`, report),
        rubric: plain(find(replyBlocks, /^Reply rubric/) ?? ''),
      },
    };
  });

  const finalSec = h2(/Selection gate/);
  const ladderBody = h3(finalSec, /^Writing ladders/);
  const ladderTheses = ladderBody
    .split('\n')
    .map((l) => l.match(/^-\s+\*\*([^*]+?):\*\*\s*(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ label: m[1]!.trim(), text: plain(m[2]!) }));

  return {
    intro,
    theses,
    sources: h2(/The source base/),
    readingGuide: numberedList(h3(readingSec, /^Reading guide/)),
    comprehension,
    whyTheseMatter: h3(readingSec, /^Why these matter/),
    literatureMap: {
      id: 'paper:literature-map',
      intro: litParts.preamble.split('\n').filter((l) => !/^\d+\./.test(l)).join('\n').trim(),
      questions: numberedList(litParts.preamble),
      keysIntro: keyParas.filter((p) => !/^\*\*/.test(p)).join('\n\n'),
      keys,
      synthesis: litParts.sections.find((s) => /synthesis/i.test(s.heading))?.body ?? '',
    },
    thesisSets,
    selectionGate: h3(finalSec, /^The selection gate/),
    ladderTheses,
    finalPaper: h3(finalSec, /^The final paper/),
  };
}
