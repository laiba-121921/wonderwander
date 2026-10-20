import { z } from 'zod';

// Output shapes. Each JSON mode has a zod schema (checked after the call) and a Gemini responseSchema (sent with it).
const Conf = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const GraderOut = z.object({
  steps: z.array(z.string()),
  verdict: z.enum(['PASS', 'FAIL', 'ABSTAIN']),
  confidence: Conf,
  missing_or_wrong: z.string(),
  off_key: z.string(),
  feedback: z.string(),
});

export const AuditorOut = z.object({
  my_verdict: z.enum(['PASS', 'FAIL', 'ABSTAIN']),
  agreement: z.enum(['AGREE', 'DISAGREE']),
  grader_error: z.string(),
  error_checks: z.object({ a: z.boolean(), b: z.boolean(), c: z.boolean(), d: z.boolean(), e: z.boolean() }),
  confidence: Conf,
});

export const VariantCheckOut = z.object({ ok: z.boolean(), reason: z.string() });

export const BossTurnOut = z.object({
  reply: z.string(),
  matched_objection: z.number().int().nullable(),
  conceded: z.string().nullable(),
});

export const JudgeOut = z.object({
  checklist: z.record(z.string(), z.string()),
  rubric: z.array(z.object({ item: z.string(), result: z.enum(['PASS', 'FAIL']), quote: z.string() })),
  verdict: z.enum(['PASS', 'FAIL', 'ABSTAIN']),
  confidence: Conf,
  written: z.string(),
});

const RefereeItem = z.object({ result: z.enum(['PASS', 'FAIL']), quote: z.string(), reason: z.string() });
export const RefereeOut = z.object({
  checklist: z.record(z.string(), RefereeItem),
  report: z.string(),
  confidence: Conf,
});

export type GraderOutput = z.infer<typeof GraderOut>;
export type AuditorOutput = z.infer<typeof AuditorOut>;
export type JudgeOutput = z.infer<typeof JudgeOut>;
export type BossTurnOutput = z.infer<typeof BossTurnOut>;
export type RefereeOutput = z.infer<typeof RefereeOut>;

// Gemini responseSchema (OpenAPI subset). Records become objects with the expected keys listed.
const S = (type: string, extra: object = {}) => ({ type, ...extra });
const str = S('STRING');
const conf = S('STRING', { enum: ['HIGH', 'MEDIUM', 'LOW'] });
const obj = (properties: Record<string, object>, required = Object.keys(properties)) => S('OBJECT', { properties, required });

export const RESPONSE_SCHEMA = {
  grade: obj({
    steps: S('ARRAY', { items: str }),
    verdict: S('STRING', { enum: ['PASS', 'FAIL', 'ABSTAIN'] }),
    confidence: conf,
    missing_or_wrong: str,
    off_key: str,
    feedback: str,
  }),
  audit: obj({
    my_verdict: S('STRING', { enum: ['PASS', 'FAIL', 'ABSTAIN'] }),
    agreement: S('STRING', { enum: ['AGREE', 'DISAGREE'] }),
    grader_error: str,
    error_checks: obj({ a: S('BOOLEAN'), b: S('BOOLEAN'), c: S('BOOLEAN'), d: S('BOOLEAN'), e: S('BOOLEAN') }),
    confidence: conf,
  }),
  variant_check: obj({ ok: S('BOOLEAN'), reason: str }),
  boss_turn: obj({ reply: str, matched_objection: S('INTEGER', { nullable: true }), conceded: S('STRING', { nullable: true }) }),
  judge: obj({
    checklist: obj(Object.fromEntries(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map((k) => [k, str]))),
    rubric: S('ARRAY', { items: obj({ item: str, result: S('STRING', { enum: ['PASS', 'FAIL'] }), quote: str }) }),
    verdict: S('STRING', { enum: ['PASS', 'FAIL', 'ABSTAIN'] }),
    confidence: conf,
    written: str,
  }),
  referee: obj({
    checklist: obj(
      Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [`R${i + 1}`, obj({ result: S('STRING', { enum: ['PASS', 'FAIL'] }), quote: str, reason: str })]),
      ),
    ),
    report: str,
    confidence: conf,
  }),
} as const;

export const ZOD = {
  grade: GraderOut,
  audit: AuditorOut,
  variant_check: VariantCheckOut,
  boss_turn: BossTurnOut,
  judge: JudgeOut,
  referee: RefereeOut,
} as const;
