// PHASE_15_PLUS 4.3 and 4.4: whose Gemini key a request uses, and how many calls an hour anyone may make.

export const CALLS_PER_HOUR = 60;

// A Google AI Studio key: letters, digits, dash and underscore. Anything else is refused before Google sees it.
export const isKeyShaped = (key: string) => /^[A-Za-z0-9_-]{30,64}$/.test(key);

// The key sent with the request wins. Only the instance owner may fall back to the GEMINI_API_KEY secret.
export function chooseKey(opts: { headerKey: string | null; isOwner: boolean; secret: string | undefined }): { key: string } | { error: 'nokey' | 'denied' | 'not_configured' } {
  const header = opts.headerKey?.trim();
  if (header) return isKeyShaped(header) ? { key: header } : { error: 'denied' };
  if (!opts.isOwner) return { error: 'nokey' };
  return opts.secret ? { key: opts.secret } : { error: 'not_configured' };
}
