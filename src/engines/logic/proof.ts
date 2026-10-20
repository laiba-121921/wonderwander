import { and, equal, iff, imp, not, or, type Formula } from './formula';

// The thirteen rules of Logic Unit 5: eight inference rules on whole lines, five replacement rules anywhere in a line.
export const INFERENCE_RULES = ['MP', 'MT', 'HS', 'DS', 'Simp', 'Conj', 'Add', 'DN'] as const;
export const REPLACEMENT_RULES = ['DeM', 'Contra', 'CE', 'BE', 'Comm'] as const;
export type Rule = (typeof INFERENCE_RULES)[number] | (typeof REPLACEMENT_RULES)[number];

export const RULE_NAMES: Record<Rule, string> = {
  MP: 'Modus ponens',
  MT: 'Modus tollens',
  HS: 'Hypothetical syllogism',
  DS: 'Disjunctive syllogism',
  Simp: 'Simplification',
  Conj: 'Conjunction',
  Add: 'Addition',
  DN: 'Double negation',
  DeM: 'De Morgan',
  Contra: 'Contraposition',
  CE: 'Conditional exchange',
  BE: 'Biconditional exchange',
  Comm: 'Commutation',
};

const isImp = (f: Formula): f is Extract<Formula, { kind: 'bin' }> => f.kind === 'bin' && f.op === 'imp';
const isOp = (f: Formula, op: string): f is Extract<Formula, { kind: 'bin' }> => f.kind === 'bin' && f.op === op;

// Each replacement rule as a function giving the formulas it may rewrite f into (both directions).
const REWRITES: Record<(typeof REPLACEMENT_RULES)[number] | 'DN', (f: Formula) => Formula[]> = {
  DeM: (f) => {
    const out: Formula[] = [];
    if (f.kind === 'not' && isOp(f.a, 'and')) out.push(or(not(f.a.a), not(f.a.b)));
    if (f.kind === 'not' && isOp(f.a, 'or')) out.push(and(not(f.a.a), not(f.a.b)));
    if (isOp(f, 'or') && f.a.kind === 'not' && f.b.kind === 'not') out.push(not(and(f.a.a, f.b.a)));
    if (isOp(f, 'and') && f.a.kind === 'not' && f.b.kind === 'not') out.push(not(or(f.a.a, f.b.a)));
    return out;
  },
  Contra: (f) => {
    const out: Formula[] = [];
    if (isImp(f)) out.push(imp(not(f.b), not(f.a)));
    if (isImp(f) && f.a.kind === 'not' && f.b.kind === 'not') out.push(imp(f.b.a, f.a.a));
    return out;
  },
  CE: (f) => {
    const out: Formula[] = [];
    if (isImp(f)) out.push(or(not(f.a), f.b));
    if (isOp(f, 'or') && f.a.kind === 'not') out.push(imp(f.a.a, f.b));
    return out;
  },
  BE: (f) => {
    const out: Formula[] = [];
    if (isOp(f, 'iff')) out.push(and(imp(f.a, f.b), imp(f.b, f.a)));
    if (isOp(f, 'and')) {
      const [l, r] = [f.a, f.b];
      if (isImp(l) && isImp(r) && equal(l.a, r.b) && equal(l.b, r.a)) out.push(iff(l.a, l.b));
    }
    return out;
  },
  Comm: (f) => (f.kind === 'bin' && f.op === 'and' ? [and(f.b, f.a)] : f.kind === 'bin' && f.op === 'or' ? [or(f.b, f.a)] : []),
  DN: (f) => (f.kind === 'not' && f.a.kind === 'not' ? [f.a.a, not(f)] : [not(not(f))]),
};

// True when b is a with exactly one subformula rewritten by the rule.
function rewritesTo(a: Formula, b: Formula, rewrite: (f: Formula) => Formula[]): boolean {
  if (rewrite(a).some((r) => equal(r, b))) return true;
  if (a.kind === 'not' && b.kind === 'not') return rewritesTo(a.a, b.a, rewrite);
  if (a.kind === 'bin' && b.kind === 'bin' && a.op === b.op) {
    return (rewritesTo(a.a, b.a, rewrite) && equal(a.b, b.b)) || (equal(a.a, b.a) && rewritesTo(a.b, b.b, rewrite));
  }
  return false;
}

// Is `result` a legal line by `rule` from the cited lines (in the order cited)?
export function checkStep(rule: Rule, cited: Formula[], result: Formula): boolean {
  const two = cited.length === 2 ? cited : null;
  const pairs: [Formula, Formula][] = two ? [[two[0]!, two[1]!], [two[1]!, two[0]!]] : [];
  switch (rule) {
    case 'MP':
      return pairs.some(([c, x]) => isImp(c) && equal(c.a, x) && equal(c.b, result));
    case 'MT':
      return pairs.some(([c, x]) => isImp(c) && x.kind === 'not' && equal(x.a, c.b) && equal(result, not(c.a)));
    case 'HS':
      return pairs.some(([c, d]) => isImp(c) && isImp(d) && equal(c.b, d.a) && equal(result, imp(c.a, d.b)));
    case 'DS':
      return pairs.some(
        ([d, x]) => isOp(d, 'or') && x.kind === 'not' && ((equal(x.a, d.a) && equal(result, d.b)) || (equal(x.a, d.b) && equal(result, d.a))),
      );
    case 'Conj':
      return pairs.some(([x, y]) => equal(result, and(x, y)));
    case 'Simp':
      return cited.length === 1 && isOp(cited[0]!, 'and') && (equal(result, cited[0].a) || equal(result, cited[0].b));
    case 'Add':
      return cited.length === 1 && isOp(result, 'or') && equal(result.a, cited[0]!);
    case 'DN':
      return cited.length === 1 && rewritesTo(cited[0]!, result, REWRITES.DN);
    default:
      return cited.length === 1 && rewritesTo(cited[0]!, result, REWRITES[rule]);
  }
}
