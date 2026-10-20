import type { Architecture, LadderStep, Prompts } from '../../src/content/types';
import { fencedBlocks, numberedList, splitSections, type Section } from './markdown';
import type { Report } from './report';
import { labelBlocks } from './appendix';
import { listItems, plain, unescapeMarkdown } from './text';

function allH3(md: string): Section[] {
  return splitSections(md, 2).sections.flatMap((s) => splitSections(s.body, 3).sections);
}

// "(1) first. (2) second." into its items.
export function parenList(text: string): string[] {
  return plain(text)
    .split(/\s*\(\d+\)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstQuote(text: string): string {
  return unescapeMarkdown(text.match(/"([^"]+)"/)?.[1] ?? '');
}

export function parseArchitecture(md: string, report: Report): Architecture {
  const h3 = allH3(md);
  const sec = (re: RegExp) => {
    const s = h3.find((x) => re.test(x.heading));
    if (!s) report.error('architecture', `section matching ${re} not found`);
    return s?.body ?? '';
  };
  const block = (re: RegExp, name: string) => {
    const b = fencedBlocks(sec(re))[0];
    if (!b) report.error('architecture', `prompt "${name}" not found`);
    return b ?? '';
  };

  const variantBody = sec(/^Variant generator prompt/);
  const variantCheck = variantBody.match(/"(Does the VARIANT preserve the STRUCTURE NOTE\?[^"]*)"/)?.[1] ?? '';
  if (!variantCheck) report.error('architecture', 'variant check prompt not found');

  const prompts: Prompts = {
    grader: block(/^Grader prompt v2/, 'grader'),
    auditor: block(/^Auditor prompt/, 'auditor'),
    authorReply: block(/^Reply$/, 'authorReply'),
    boss: block(/^The boss prompt/, 'boss'),
    judge: block(/^The judge prompt/, 'judge'),
    variant: fencedBlocks(variantBody)[0] ?? '',
    variantCheck,
    referee: block(/^Step 4: Referee round/, 'referee'),
  };
  if (!prompts.variant) report.error('architecture', 'prompt "variant" not found');

  const escalation = sec(/^Escalation rules/);
  const escalatedMessage = escalation.match(/the student sees: "([^"]+)"/)?.[1] ?? '';
  if (!escalatedMessage) report.warn('architecture', 'escalated message not found');

  const recon = labelBlocks(sec(/^Reconstruct$/));
  const object = labelBlocks(sec(/^Object$/));
  const reply = labelBlocks(sec(/^Reply$/));

  const ladder: LadderStep[] = h3
    .filter((s) => /^Step \d+:/.test(s.heading))
    .map((s) => {
      const blocks = labelBlocks(s.body);
      const rubric = [...blocks].find(([k]) => /^Rubric/.test(k))?.[1];
      const referee = /Referee/.test(s.heading);
      return {
        step: Number(s.heading.match(/^Step (\d+)/)![1]),
        title: s.heading.replace(/^Step \d+:\s*/, ''),
        ...(blocks.get('Prompt') ? { prompt: firstQuote(blocks.get('Prompt')!) } : {}),
        rubric: referee
          ? (fencedBlocks(s.body)[0] ?? '').split('\n').filter((l) => /^R\d+\./.test(l)).map((l) => l.trim())
          : rubric
            ? parenList(rubric)
            : [],
        reject: blocks.get('REJECT') ? listItems(blocks.get('REJECT')!) : [],
        body: s.body,
      };
    });
  if (ladder.length !== 4) report.error('architecture', `expected 4 writing ladder steps, found ${ladder.length}`);

  const bossBaseRubric = numberedList(sec(/^The standard boss rubric/));
  if (bossBaseRubric.length !== 6) report.error('architecture', `expected 6 base boss rubric items, found ${bossBaseRubric.length}`);

  const pass = splitSections(md, 2).sections.find((s) => /Revised pass conditions/.test(s.heading));

  return {
    prompts,
    playbookTemplate: block(/^The playbook template/, 'playbook template'),
    bossBaseRubric,
    escalatedMessage,
    doing: {
      reconstructPrompt: firstQuote(recon.get('Prompt to student') ?? ''),
      reconstructKeyFormat: recon.get('Key format') ?? '',
      objectPrompt: firstQuote(object.get('Prompt to student') ?? ''),
      objectRubric: parenList([...object].find(([k]) => /^Rubric/.test(k))?.[1] ?? ''),
      objectReject: listItems(object.get('REJECT') ?? ''),
      replyPrompt: firstQuote(reply.get('Prompt to student') ?? ''),
      replyRubric: parenList([...reply].find(([k]) => /^Reply rubric/.test(k))?.[1] ?? ''),
      replyReject: listItems(reply.get('REJECT') ?? ''),
    },
    ladder,
    passConditions: pass?.body ?? '',
  };
}
