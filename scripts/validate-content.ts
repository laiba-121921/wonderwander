import type { BossPlaybook, Drill, Unit } from '../src/content/types';
import type { Parsed } from './parse-content';
import type { Report } from './content/report';
import { DOMAINS } from './content/structure';

export function collectIds(parsed: Parsed): string[] {
  const ids: string[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.id === 'string' && o.id.includes(':')) ids.push(o.id);
      Object.values(o).forEach(visit);
    }
  };
  visit(parsed.domains);
  visit(parsed.paper);
  for (const d of parsed.domains) for (const u of d.units) ids.push(u.id);
  return ids;
}

function checkDrill(d: Drill, report: Report) {
  if (d.kind === 'tap') {
    if (d.options.length < 2) report.error(d.id, 'TAP drill has fewer than two options');
    if (d.correct.length === 0 || d.correct.some((c) => !d.options.some((o) => o.id === c))) report.error(d.id, 'TAP drill correct answer is not an option');
  } else {
    if (d.key.required.length === 0) report.error(d.id, 'keyed drill has no REQUIRED element');
    if (!d.alwaysQueue && !d.structureNote && d.variants !== false) report.error(d.id, 'keyed drill has no structure note and is not marked symbolic');
  }
  if (!d.prompt.trim()) report.error(d.id, 'drill has an empty prompt');
}

function checkBoss(b: BossPlaybook, report: Report) {
  const missing = (['position', 'openingMove', 'escalation', 'concessionRule'] as const).filter((k) => !b[k]?.trim());
  if (missing.length) report.error(b.id, `boss playbook missing ${missing.join(', ')}`);
  if (!b.exitTurns) report.error(b.id, 'boss playbook has no exit turn count');
}

function checkUnit(u: Unit, report: Report) {
  if (u.drills.length !== 10) report.error(u.id, `expected 10 drills, found ${u.drills.length}`);
  if (u.cards.length !== 12) report.error(u.id, `expected 12 cards, found ${u.cards.length}`);
  if (u.reading.texts.length === 0) report.error(u.id, 'reading has no texts');
  if (u.reading.guide.length === 0) report.error(u.id, 'reading has no guide');
  if (u.reading.comprehension.length !== 3) report.warn(u.id, `expected 3 comprehension drills, found ${u.reading.comprehension.length}`);
  if (!u.doing.reconstruct.passage) report.error(u.id, 'doing set has no reconstruct passage');
  for (const d of [...u.drills, ...u.reading.comprehension]) checkDrill(d, report);
  for (const c of u.cards) if (c.key.required.length === 0) report.error(c.id, 'card has no REQUIRED element');
  checkBoss(u.miniBoss, report);
  report.counts.push({
    unit: u.id,
    drills: u.drills.length,
    tap: u.drills.filter((d) => d.kind === 'tap').length,
    cards: u.cards.length,
    comprehension: u.reading.comprehension.length,
    lessonSections: u.lesson.length,
  });
}

const SLOTS: Record<string, string[]> = {
  grader: ['{exercise_text}', '{key_block}', '{student_answer}'],
  auditor: ['{exercise_text}', '{key_block}', '{student_answer}', '{grader_json}'],
  authorReply: ['{author}', '{n}', '{playbook}', '{standard_form}', '{objection}'],
  boss: ['{playbook}', '{transcript}', '{level}'],
  judge: ['{playbook}', '{rubric}', '{transcript}'],
  variant: ['{exercise_text}'],
  referee: ['{draft}'],
};

const DASH = /[\u2013\u2014\u2e3a\u2e3b]/;

export function validate(parsed: Parsed, report: Report): void {
  for (const spec of DOMAINS) {
    const file = parsed.domains.find((d) => d.domain.id === spec.id);
    if (!file) {
      report.error(spec.id, 'domain missing');
      continue;
    }
    if (file.units.length !== spec.unitCount) report.error(spec.id, `expected ${spec.unitCount} units, found ${file.units.length}`);
    for (const u of file.units) checkUnit(u, report);
    checkBoss(file.domain.finalBoss, report);
  }

  for (const [name, text] of Object.entries(parsed.architecture.prompts)) {
    if (!text.trim()) report.error(`prompt:${name}`, 'prompt not found');
    for (const slot of SLOTS[name] ?? []) if (!text.includes(slot)) report.warn(`prompt:${name}`, `slot ${slot} not found in the prompt text`);
  }
  for (const d of parsed.paper.comprehension) checkDrill(d, report);

  const ids = collectIds(parsed);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) report.error(id, 'duplicate id');
    seen.add(id);
  }

  const json = JSON.stringify(parsed);
  if (DASH.test(json)) report.error('content/json', 'output contains an em or en dash');
}
