// Invite codes (PHASE_15_PLUS 4.1). Pure, so the app's tests can import it too.

// No 0, O, 1 or I: a code is read off a message and typed on a phone.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 10;

export function makeCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 256 is a multiple of 32, so every letter is equally likely
  return Array.from(random(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isCodeShaped = (code: string) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);

export type InviteError = 'invalid' | 'expired' | 'used' | 'full' | 'exists' | 'weak' | 'email' | 'bad_request' | 'failed';

// What a request to the invite function must look like before anything is checked against the database.
export function checkRequest(body: unknown): { ok: true; code: string; email?: string; password?: string } | { ok: false; error: InviteError } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad_request' };
  const b = body as { code?: unknown; email?: unknown; password?: unknown; check?: unknown };
  if (typeof b.code !== 'string') return { ok: false, error: 'bad_request' };
  const code = normaliseCode(b.code);
  if (!isCodeShaped(code)) return { ok: false, error: 'invalid' };
  if (b.check === true) return { ok: true, code };
  if (typeof b.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()) || b.email.length > 254) return { ok: false, error: 'email' };
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 72) return { ok: false, error: 'weak' };
  return { ok: true, code, email: b.email.trim().toLowerCase(), password: b.password };
}
