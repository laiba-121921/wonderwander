// A small key-value store on IndexedDB, for the downloaded content pack (PHASE_15_PLUS 3.3) and the encrypted
// Gemini key (4.3). No library: two object stores and promise wrappers.

const DB = 'wonderwander';
const STORES = ['pack', 'secrets'] as const;
export type Store = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });

export async function idbGet<T>(store: Store, key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetMany(store: Store, entries: [string, unknown][]): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  for (const [k, v] of entries) tx.objectStore(store).put(v, k);
  return done(tx);
}

export const idbSet = (store: Store, key: string, value: unknown) => idbSetMany(store, [[key, value]]);

export async function idbDelete(store: Store, keys: string[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  for (const k of keys) tx.objectStore(store).delete(k);
  return done(tx);
}

export async function idbKeys(store: Store): Promise<string[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result.map(String));
    req.onerror = () => reject(req.error);
  });
}
