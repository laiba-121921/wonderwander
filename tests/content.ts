import { existsSync, readFileSync } from 'node:fs';

// The curriculum lives in a private repository, checked out at content/ by those who have it (docs/CONTENT_PACK.md).
// Tests that use it as data skip when it is absent, as they do in the public repository's CI.
export const HAS_CONTENT = existsSync('content/json/index.json');

export function readContent<T>(path: string, fallback: T): T {
  return HAS_CONTENT && existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}
