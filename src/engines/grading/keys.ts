import type { AnswerKey } from '../../content/types';

export interface KeyOverride {
  item_id: string;
  version: number;
  accept_add: string[];
  reject_add: string[];
  required_edit: string[] | null;
}

// The effective key is the authored key plus the latest weekly-review amendment (BUILD_PLAN 15.2).
export function effectiveKey(base: AnswerKey, overrides: KeyOverride[]): AnswerKey {
  const latest = overrides.reduce<KeyOverride | null>((best, o) => (!best || o.version > best.version ? o : best), null);
  if (!latest) return base;
  return {
    required: latest.required_edit ?? base.required,
    accept: [...base.accept, ...overrides.flatMap((o) => o.accept_add)],
    reject: [...base.reject, ...overrides.flatMap((o) => o.reject_add)],
    ...(base.notes ? { notes: base.notes } : {}),
    version: latest.version,
  };
}

// The ANSWER KEY slot of the grader and auditor prompts, in the four parts the prompt names.
export function keyBlock(key: AnswerKey): string {
  const lines = ['REQUIRED:', ...key.required.map((r, i) => `${i + 1}. ${r}`)];
  if (key.accept.length) lines.push('ACCEPT:', ...key.accept.map((a) => `- ${a}`));
  if (key.reject.length) lines.push('REJECT:', ...key.reject.map((r) => `- ${r}`));
  if (key.notes) lines.push(`NOTES: ${key.notes}`);
  return lines.join('\n');
}
