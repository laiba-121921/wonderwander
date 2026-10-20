// Propositional formulas in the curriculum's symbols: ¬ ∧ ∨ → ↔ (Logic Unit 3).
export type BinOp = 'and' | 'or' | 'imp' | 'iff';
export type Formula = { kind: 'atom'; name: string } | { kind: 'not'; a: Formula } | { kind: 'bin'; op: BinOp; a: Formula; b: Formula };

export const SYMBOL: Record<BinOp | 'not', string> = { not: '¬', and: '∧', or: '∨', imp: '→', iff: '↔' };
const OP_OF: Record<string, BinOp> = { '∧': 'and', '∨': 'or', '→': 'imp', '↔': 'iff' };

export const atom = (name: string): Formula => ({ kind: 'atom', name });
export const not = (a: Formula): Formula => ({ kind: 'not', a });
export const bin = (op: BinOp, a: Formula, b: Formula): Formula => ({ kind: 'bin', op, a, b });
export const and = (a: Formula, b: Formula) => bin('and', a, b);
export const or = (a: Formula, b: Formula) => bin('or', a, b);
export const imp = (a: Formula, b: Formula) => bin('imp', a, b);
export const iff = (a: Formula, b: Formula) => bin('iff', a, b);

// Binary connectives do not chain without brackets: "P ∧ Q ∨ R" is rejected as ambiguous.
export function parse(src: string): Formula {
  const tokens = src.replace(/\s+/g, '').split('');
  let i = 0;
  const peek = () => tokens[i];
  function unary(): Formula {
    const t = peek();
    if (t === '¬') {
      i++;
      return not(unary());
    }
    if (t === '(') {
      i++;
      const f = expr();
      if (peek() !== ')') throw new Error(`expected ) at ${i}`);
      i++;
      return f;
    }
    if (t && /[A-Z]/.test(t)) {
      i++;
      return atom(t);
    }
    throw new Error(`unexpected ${t ?? 'end'} at ${i}`);
  }
  function expr(): Formula {
    const left = unary();
    const t = peek();
    if (t && OP_OF[t]) {
      i++;
      const right = unary();
      if (peek() && OP_OF[peek()!]) throw new Error('ambiguous: add brackets');
      return bin(OP_OF[t]!, left, right);
    }
    return left;
  }
  const f = expr();
  if (i !== tokens.length) throw new Error(`unexpected ${peek()} at ${i}`);
  return f;
}

export function print(f: Formula, top = true): string {
  if (f.kind === 'atom') return f.name;
  if (f.kind === 'not') return SYMBOL.not + print(f.a, false);
  const s = `${print(f.a, false)} ${SYMBOL[f.op]} ${print(f.b, false)}`;
  return top ? s : `(${s})`;
}

export function equal(a: Formula, b: Formula): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'atom') return a.name === (b as typeof a).name;
  if (a.kind === 'not') return equal(a.a, (b as typeof a).a);
  const bb = b as typeof a;
  return a.op === bb.op && equal(a.a, bb.a) && equal(a.b, bb.b);
}

export function atoms(...fs: Formula[]): string[] {
  const set = new Set<string>();
  const walk = (f: Formula) => {
    if (f.kind === 'atom') set.add(f.name);
    else if (f.kind === 'not') walk(f.a);
    else {
      walk(f.a);
      walk(f.b);
    }
  };
  fs.forEach(walk);
  return [...set].sort();
}

export type Assignment = Record<string, boolean>;

export function evaluate(f: Formula, v: Assignment): boolean {
  if (f.kind === 'atom') {
    if (!(f.name in v)) throw new Error(`no value for ${f.name}`);
    return v[f.name]!;
  }
  if (f.kind === 'not') return !evaluate(f.a, v);
  const a = evaluate(f.a, v);
  const b = evaluate(f.b, v);
  switch (f.op) {
    case 'and':
      return a && b;
    case 'or':
      return a || b;
    case 'imp':
      return !a || b;
    case 'iff':
      return a === b;
  }
}

// Rows in the curriculum's standard order: first atom alternates slowest, starting with T (Logic Unit 4).
export function rows(names: string[]): Assignment[] {
  const out: Assignment[] = [];
  const n = names.length;
  for (let r = 0; r < 2 ** n; r++) {
    const v: Assignment = {};
    names.forEach((name, k) => {
      v[name] = ((r >> (n - 1 - k)) & 1) === 0;
    });
    out.push(v);
  }
  return out;
}

export function truthColumn(f: Formula, names = atoms(f)): boolean[] {
  return rows(names).map((v) => evaluate(f, v));
}

export function equivalent(a: Formula, b: Formula): boolean {
  const names = atoms(a, b);
  return rows(names).every((v) => evaluate(a, v) === evaluate(b, v));
}

// Rows where every premise is true and the conclusion false. Empty means valid.
export function counterexamples(premises: Formula[], conclusion: Formula): Assignment[] {
  const names = atoms(...premises, conclusion);
  return rows(names).filter((v) => premises.every((p) => evaluate(p, v)) && !evaluate(conclusion, v));
}

export const isValid = (premises: Formula[], conclusion: Formula) => counterexamples(premises, conclusion).length === 0;
