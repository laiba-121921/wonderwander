import { idbDelete, idbGet, idbSet } from './idb';
import { supabase } from './supabase';

// PHASE_15_PLUS 4.3: each person's Gemini key lives on their phone only, never in the database. It is kept encrypted
// with AES-GCM under a key the browser made and cannot export, so the stored value is not readable as plain text.
// (The plan suggested a key derived from the Supabase session; sessions refresh every hour, which would lose the key.)

export interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

export async function makeWrappingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(wrap: CryptoKey, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrap, new TextEncoder().encode(text)) };
}

export async function unseal(wrap: CryptoKey, sealed: Sealed): Promise<string> {
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, wrap, sealed.data));
}

// Shown in Settings: enough to recognise the key, never enough to use it.
export const maskKey = (key: string) => (key.length > 8 ? `${key.slice(0, 4)}${'•'.repeat(6)}${key.slice(-4)}` : '•'.repeat(6));

// The shape of an AI Studio key, as the llm function checks it.
export const looksLikeKey = (key: string) => /^[A-Za-z0-9_-]{30,64}$/.test(key.trim());

async function wrappingKey(): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>('secrets', 'wrap');
  if (existing) return existing;
  const fresh = await makeWrappingKey();
  await idbSet('secrets', 'wrap', fresh);
  return fresh;
}

async function userId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// One entry per account, so a second person signing in on the same phone never uses the first person's key.
const slot = (uid: string) => `gemini:${uid}`;

let memo: { uid: string; key: string | null } | null = null;

// Screens that show whether a key is present listen for this.
export const KEY_CHANGED = 'wonderwander:gemini-key';
const announce = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(KEY_CHANGED));
};

// Never throws: with no key, or no way to read it, a call simply goes without one.
export async function getGeminiKey(): Promise<string | null> {
  try {
    const uid = await userId();
    if (!uid) return null;
    if (memo?.uid === uid) return memo.key;
    const sealed = await idbGet<Sealed>('secrets', slot(uid));
    const key = sealed ? await unseal(await wrappingKey(), sealed) : null;
    memo = { uid, key };
    return key;
  } catch {
    return null;
  }
}

export async function setGeminiKey(key: string): Promise<void> {
  const uid = await userId();
  if (!uid) throw new Error('not signed in');
  await idbSet('secrets', slot(uid), await seal(await wrappingKey(), key.trim()));
  memo = { uid, key: key.trim() };
  announce();
}

export async function removeGeminiKey(): Promise<void> {
  const uid = await userId();
  memo = null;
  if (uid) await idbDelete('secrets', [slot(uid)]);
  announce();
}
