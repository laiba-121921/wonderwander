import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, type Route } from '@playwright/test';
import JSZip from 'jszip';

// The e2e server runs against a fake Supabase (playwright.config.ts) answered here, so tests never touch the real project
// or spend Gemini quota. Tables live in memory; the llm function answers from the student's text:
// RIGHT passes, WRONG fails, ODD passes with off-key content, MAYBE makes the auditor disagree (a soft retry); the
// tie-break run of a MAYBE answer passes only if it says MAYBE-PASS.
function fakeJwt(sub: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

export type Db = Record<string, Record<string, unknown>[]>;

// Titles come from the content when the tests run, so no curriculum text is written into the tests themselves.
const contentJson = (file: string) => JSON.parse(readFileSync(join(process.cwd(), 'content', 'json', file), 'utf8'));
export const unitTitle = (unitId: string): string => contentJson(`${unitId.replace(/-\d+$/, '')}.json`).units.find((u: { id: string }) => u.id === unitId).title;
export const domainTitle = (domainId: string): string => contentJson(`${domainId}.json`).domain.title;

// profiles made by the app count as onboarded unless a test seeds one that is not (PHASE_15_PLUS 4.2)
const DEFAULTS: Record<string, Record<string, unknown>> = { review_queue: { status: 'pending' }, profile: { onboarded: true, display_name: 'Laiba', timezone: 'Asia/Karachi' } };
const KEYS: Record<string, string[]> = { invite: ['code'], writing_submission: ['id'], item_state: ['item_id'], card_state: ['card_id'], profile: ['user_id'], llm_usage: ['usage_date', 'mode'] };

function matches(row: Record<string, unknown>, params: URLSearchParams): boolean {
  for (const [k, v] of params) {
    if (['select', 'on_conflict', 'limit', 'order', 'columns'].includes(k)) continue;
    if (v.startsWith('eq.') && String(row[k]) !== decodeURIComponent(v.slice(3))) return false;
    if (v === 'is.null' && row[k] != null) return false;
    if (v.startsWith('in.(') && !v.slice(4, -1).split(',').map((x) => decodeURIComponent(x).replace(/^"|"$/g, '')).includes(String(row[k]))) return false;
  }
  return true;
}

function grader(answer: string, second = false) {
  const pass = /RIGHT/.test(answer) || (/MAYBE/.test(answer) && (!second || /MAYBE-PASS/.test(answer)));
  return {
    steps: ['1. compared with the key'],
    verdict: pass || /ODD/.test(answer) ? 'PASS' : 'FAIL',
    confidence: 'HIGH',
    missing_or_wrong: pass && !/MAYBE/.test(answer) ? '' : 'the second premise',
    off_key: /ODD/.test(answer) ? 'mentions something the key does not cover' : '',
    feedback: pass ? 'Clear and complete.' : 'Close, but one element is missing.',
  };
}

const auditor = (answer: string) => {
  const unsure = /MAYBE/.test(answer);
  return { my_verdict: unsure ? 'FAIL' : grader(answer).verdict, agreement: unsure ? 'DISAGREE' : 'AGREE', grader_error: unsure ? 'missed a required element' : 'none', error_checks: { a: false, b: false, c: false, d: false, e: false }, confidence: 'HIGH' };
};

// The content bucket is answered from the pack scripts/build-pack.ts last wrote (.pack/latest). Owner-only files are
// refused unless the signed-in user is the instance owner, as the storage policies do.
const PACK = join(process.cwd(), '.pack');

export async function fakeSupabase(page: Page, { owner = true }: { owner?: boolean } = {}): Promise<Db> {
  const db: Db = {};
  let seq = 0;
  const user = { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'laiba@example.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  await page.route('https://fake.supabase.test/auth/v1/token**', async (route) => {
    const body = route.request().postDataJSON() as { password?: string };
    if (body.password !== undefined && body.password !== 'right-password') {
      return route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials' } });
    }
    return route.fulfill({ json: { access_token: fakeJwt(user.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user } });
  });
  await page.route('https://fake.supabase.test/auth/v1/user**', (route) => route.fulfill({ json: user }));
  await page.route('https://fake.supabase.test/auth/v1/logout**', (route) => route.fulfill({ status: 204 }));

  await page.route('https://fake.supabase.test/functions/v1/push', async (route) => {
    const req = route.request();
    (db.push_calls ??= []).push({ method: req.method(), body: req.postData() ?? '' });
    if (req.method() === 'GET') return route.fulfill({ json: { publicKey: 'BNoThZJ8XMsWiObeNlJ8EWt6CaTK_XQkef_YlPfeDmSNkONRurS8At7BinEivoSQeBIyTV39HwSeqjAkMSzyizM' } });
    return route.fulfill({ json: { due: 9, sent: (db.push_subscription ?? []).length, removed: 0 } });
  });

  // invite codes live in db.invite; GLADCASE22 style codes are seeded by tests
  await page.route('https://fake.supabase.test/functions/v1/invite', async (route) => {
    const body = route.request().postDataJSON() as { code: string; check?: boolean; email?: string; password?: string };
    (db.invite_calls ??= []).push(body);
    const inv = (db.invite ?? []).find((i) => i.code === body.code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (!inv) return route.fulfill({ json: { error: 'invalid' } });
    if (Number(inv.uses ?? 0) >= Number(inv.max_uses ?? 1)) return route.fulfill({ json: { error: 'used' } });
    if (!body.check) inv.uses = Number(inv.uses ?? 0) + 1;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route('https://fake.supabase.test/functions/v1/delete-account', async (route) => {
    (db.deleted ??= []).push({ at: Date.now() });
    return route.fulfill({ json: owner ? { error: 'owner' } : { ok: true } });
  });
  await page.route('https://fake.supabase.test/rest/v1/rpc/**', async (route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop();
    if (fn === 'is_owner') return route.fulfill({ json: owner });
    if (fn === 'instance_status') return route.fulfill({ json: owner ? { users: 2, cap: 25 } : null });
    return route.fulfill({ json: null });
  });

  await page.route('https://fake.supabase.test/functions/v1/llm', async (route) => {
    const { mode, payload, second } = route.request().postDataJSON() as { mode: string; payload: Record<string, string>; second?: boolean };
    const geminiKey = route.request().headers()['x-gemini-key'];
    (db.gemini_keys ??= []).push({ mode, key: geminiKey ?? null });
    // a key starting with AIzaGood is one Google accepts
    if (mode === 'check_key') return route.fulfill({ json: { result: { key: geminiKey?.startsWith('AIzaGood') ? 'ok' : 'denied' } } });
    if (db.llm_error?.[0]) return route.fulfill({ json: { error: db.llm_error[0].error } });
    const judged = (t: string) => ({
      checklist: { C1: 'ok', C2: 'ok', C3: 'ok', C4: 'ok', C5: 'ok', C6: 'ok', C7: 'ok' },
      rubric: [{ item: 'The first rubric item.', result: /WRONG/.test(t) ? 'FAIL' : 'PASS', quote: 'q' }],
      verdict: /WRONG/.test(t) ? 'FAIL' : 'PASS',
      confidence: 'HIGH',
      written: /WRONG/.test(t) ? 'You attacked the conclusion every time.' : 'Your strongest moment was the counterexample.',
    });
    if (mode === 'transcribe') {
      (db.llm_calls ??= []).push({ mode, second: false });
      return route.fulfill({ json: { result: { text: 'RIGHT: words heard in the recording.' }, model: 'fake', tier: 'light' } });
    }
    if (mode === 'referee') {
      (db.llm_calls ??= []).push({ mode, second: Boolean(second) });
      const fails = /DRAFT ONE/.test(payload.draft ?? '') ? ['R1', 'R4', 'R6'] : ['R4'];
      const checklist = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`R${i + 1}`, { result: fails.includes(`R${i + 1}`) ? 'FAIL' : 'PASS', quote: 'q', reason: `reason ${i + 1}` }]));
      return route.fulfill({ json: { result: { checklist, report: 'The thesis is clear; the reply is weakened.', confidence: 'MEDIUM' }, model: 'fake', used: 1, cap: 200 } });
    }
    if (mode === 'boss_turn' || mode === 'judge') {
      (db.llm_calls ??= []).push({ mode, second: Boolean(second) });
      const result = mode === 'judge' ? judged(payload.transcript ?? '') : { reply: `Level ${payload.level} reply.`, matched_objection: null, conceded: null };
      return route.fulfill({ json: { result, model: 'fake', used: 1, cap: 200 } });
    }
    const result = mode === 'grade' ? grader(payload.student_answer ?? '', second) : mode === 'audit' ? auditor(payload.student_answer ?? '') : mode === 'variant' ? { text: `A fresh version: ${payload.exercise_text}` } : mode === 'author_reply' ? { text: `On premise ${payload.n}: show me why it fails as stated.` } : { ok: true, reason: 'kept' };
    (db.llm_calls ??= []).push({ mode, second: Boolean(second) });
    return route.fulfill({ json: { result, model: 'fake', used: 1, cap: 200 } });
  });

  await page.route('https://fake.supabase.test/storage/v1/object/content/**', async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname.replace('/storage/v1/object/content/', ''));
    (db.pack_gets ??= []).push({ path });
    const latest = existsSync(join(PACK, 'latest')) ? readFileSync(join(PACK, 'latest'), 'utf8').trim() : '';
    const file = path === 'packs/current.json' ? null : join(PACK, path.replace(/^packs\//, ''));
    const refused = (!owner && path.includes('/owner-only/')) || (file !== null && !existsSync(file));
    if (refused || !latest) return route.fulfill({ status: 400, json: { statusCode: '404', error: 'not_found', message: 'Object not found' } });
    return route.fulfill({ contentType: 'application/json', body: file ? readFileSync(file) : JSON.stringify({ version: latest }) });
  });
  await page.route('https://fake.supabase.test/storage/v1/**', async (route) => {
    if (route.request().url().includes('/object/content/')) return route.fallback();
    (db.storage ??= []).push({ path: new URL(route.request().url()).pathname, method: route.request().method() });
    return route.fulfill({ json: { Key: 'drafts/x', Id: 'x' } });
  });

  await page.route('https://fake.supabase.test/rest/v1/**', async (route: Route) => {
    if (route.request().url().includes('/rest/v1/rpc/')) return route.fallback();
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop()!;
    const rows = (db[table] ??= []);
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    if (req.method() === 'GET') {
      const out = rows.filter((r) => matches(r, url.searchParams));
      return route.fulfill({ json: single ? (out[0] ?? null) : out });
    }
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      const list: Record<string, unknown>[] = (Array.isArray(body) ? body : [body]).map((r: Record<string, unknown>) => ({ id: r.id ?? `id-${++seq}`, user_id: user.id, created_at: new Date().toISOString(), ...DEFAULTS[table], ...r })); // column defaults, as in the schema
      const keys = KEYS[table];
      for (const r of list) {
        const i = keys ? rows.findIndex((x) => keys.every((k) => x[k] === r[k])) : -1;
        if (i >= 0) {
          if (!(req.headers()['prefer'] ?? '').includes('ignore-duplicates')) rows[i] = { ...rows[i], ...r };
        } else rows.push(r);
      }
      return route.fulfill({ status: 201, json: single ? list[0] : list });
    }
    if (req.method() === 'PATCH') {
      const patch = req.postDataJSON();
      for (const r of rows.filter((x) => matches(x, url.searchParams))) Object.assign(r, patch);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ status: 204 });
  });
  return db;
}

export async function signIn(page: Page) {
  await page.goto('./'); // relative, so a build served under a base path works too
  await page.getByLabel('Email').fill('laiba@example.invalid');
  await page.getByLabel('Password').fill('right-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^(Today|Weekend ritual)$/ })).toBeVisible();
}

// Marks whole units passed (every drill, card, comprehension, doing drill and the mini-boss), as progress reads them.
export function seedPassed(db: Db, unitIds: string[]) {
  for (const id of unitIds) {
    const file = JSON.parse(readFileSync(`content/json/${id.replace(/-\d+$/, '')}.json`, 'utf8')) as { units: { id: string; drills: { id: string }[]; cards: { id: string }[]; reading: { comprehension: { id: string }[] }; doing: Record<string, { id: string }>; miniBoss: { id: string } }[] };
    const u = file.units.find((x) => x.id === id)!;
    const items = [...u.drills, ...u.reading.comprehension, u.doing.reconstruct!, u.doing.object!, u.doing.reply!, u.miniBoss].map((x) => x.id);
    for (const item of items) (db.item_state ??= []).push({ item_id: item, unit_id: id, status: 'passed', fail_count: 0 });
    for (const c of u.cards) (db.card_state ??= []).push({ card_id: c.id, pass_days: ['2026-10-01', '2026-10-02'] });
  }
}

// A minimal Word document, built the way Word stores one (a zip of XML parts).
export async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

// A one-page PDF. With lines it has real text; with padding and no lines it is a large file with no words (a scan).
export function makePdf(lines: string[], padding = 0): Buffer {
  const content = [...lines.map((l, i) => `BT /F1 12 Tf 72 ${720 - i * 16} Td (${l}) Tj ET`), padding ? `% ${'x'.repeat(padding)}` : ''].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
