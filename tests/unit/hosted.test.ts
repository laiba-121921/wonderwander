import { describe, expect, it } from 'vitest';
import { CALLS_PER_HOUR, chooseKey, isKeyShaped } from '../../supabase/functions/llm/access';
import { callModel, checkKey } from '../../supabase/functions/llm/gemini';
import { looksLikeKey, makeWrappingKey, maskKey, seal, unseal } from '../../src/lib/geminiKey';
import { checkRequest, CODE_ALPHABET, isCodeShaped, makeCode, normaliseCode } from '../../supabase/functions/invite/logic';

const KEY = 'AIzaSyA1234567890abcdefghijklmnopqrstu';
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('whose Gemini key a request uses (PHASE_15_PLUS 4.3)', () => {
  it('uses the key sent with the request, for anyone', () => {
    expect(chooseKey({ headerKey: KEY, isOwner: false, secret: 'server' })).toEqual({ key: KEY });
    expect(chooseKey({ headerKey: ` ${KEY} `, isOwner: true, secret: 'server' })).toEqual({ key: KEY });
  });

  it('lets only the owner fall back to the server secret', () => {
    expect(chooseKey({ headerKey: null, isOwner: true, secret: 'server' })).toEqual({ key: 'server' });
    expect(chooseKey({ headerKey: null, isOwner: false, secret: 'server' })).toEqual({ error: 'nokey' });
    expect(chooseKey({ headerKey: '', isOwner: false, secret: 'server' })).toEqual({ error: 'nokey' });
    expect(chooseKey({ headerKey: null, isOwner: true, secret: undefined })).toEqual({ error: 'not_configured' });
  });

  it('refuses a header that is not shaped like a key before Google sees it', () => {
    expect(chooseKey({ headerKey: 'short', isOwner: true, secret: 'server' })).toEqual({ error: 'denied' });
    expect(isKeyShaped(KEY)).toBe(true);
    expect(isKeyShaped(`${KEY}\nx-evil: 1`)).toBe(false);
    expect(CALLS_PER_HOUR).toBe(60);
  });
});

describe('checking a key with Google', () => {
  it('reads ok, refused and unreachable', async () => {
    expect(await checkKey({ apiKey: KEY, model: 'm', fetchImpl: reply(200, { name: 'models/m' }) })).toBe('ok');
    expect(await checkKey({ apiKey: KEY, model: 'm', fetchImpl: reply(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } }) })).toBe('denied');
    expect(await checkKey({ apiKey: KEY, model: 'm', fetchImpl: reply(403, {}) })).toBe('denied');
    expect(await checkKey({ apiKey: KEY, model: 'm', fetchImpl: reply(503, {}) })).toBe('busy');
    expect(await checkKey({ apiKey: KEY, model: 'm', fetchImpl: (async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch })).toBe('busy');
  });

  it('reports an unknown key as refused, not as a garbled reply', async () => {
    const r = await callModel({ prompt: 'p', temperature: 0, maxTokens: 10 }, { apiKey: KEY, model: 'm', backoff: [], fetchImpl: reply(400, { error: { message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } }) });
    expect(r).toMatchObject({ ok: false, error: 'denied' });
  });
});

describe('invite codes (PHASE_15_PLUS 4.1)', () => {
  it('makes ten characters a phone user can type, without look-alike letters', () => {
    for (let i = 0; i < 200; i++) {
      const code = makeCode();
      expect(isCodeShaped(code)).toBe(true);
      expect(code).not.toMatch(/[01IO]/);
    }
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(makeCode(() => new Uint8Array(10).fill(255))).toBe('9999999999');
  });

  it('matches the database check on invite.code', () => {
    expect(/^[A-HJ-NP-Z2-9]{10}$/.test(makeCode())).toBe(true);
  });

  it('forgives spaces, dashes and lower case when a code is typed', () => {
    expect(normaliseCode('abcd efgh jk')).toBe('ABCDEFGHJK');
  });

  it('checks a request before the database sees it', () => {
    expect(checkRequest(null)).toEqual({ ok: false, error: 'bad_request' });
    expect(checkRequest({ code: 'abc' })).toEqual({ ok: false, error: 'invalid' });
    expect(checkRequest({ code: 'ABCDEFGHJK', check: true })).toEqual({ ok: true, code: 'ABCDEFGHJK' });
    expect(checkRequest({ code: 'ABCDEFGHJK', email: 'nope', password: 'longenough' })).toEqual({ ok: false, error: 'email' });
    expect(checkRequest({ code: 'ABCDEFGHJK', email: 'a@b.co', password: 'short' })).toEqual({ ok: false, error: 'weak' });
    expect(checkRequest({ code: 'ABCDEFGHJK', email: ' Sana@Example.com ', password: 'longenough' })).toEqual({ ok: true, code: 'ABCDEFGHJK', email: 'sana@example.com', password: 'longenough' });
  });
});

describe('the Gemini key on the phone (PHASE_15_PLUS 4.3)', () => {
  it('is stored encrypted and read back exactly', async () => {
    const wrap = await makeWrappingKey();
    expect(wrap.extractable).toBe(false);
    const sealed = await seal(wrap, KEY);
    expect(new TextDecoder().decode(sealed.data)).not.toContain('AIza');
    expect(await unseal(wrap, sealed)).toBe(KEY);
    await expect(unseal(await makeWrappingKey(), sealed)).rejects.toThrow(); // another browser's key cannot open it
  });

  it('is shown masked, and its shape is checked as the server checks it', () => {
    expect(maskKey(KEY)).toBe('AIza••••••rstu');
    expect(looksLikeKey(` ${KEY} `)).toBe(true);
    expect(looksLikeKey('AIza short')).toBe(false);
  });
});
