import { expect, test } from '@playwright/test';
import { fakeSupabase, signIn, unitTitle, type Db } from '../e2e/helpers';

// PHASE_15_PLUS 3.3: the production build carries no curriculum; it downloads the pack once and then opens offline.

const unitGets = (db: Db) => (db.pack_gets ?? []).filter((g) => String(g.path).includes('/units/')).length;

test('the first launch downloads the pack; the owner sees the Paper Module; a reload downloads nothing', async ({ page }) => {
  const db = await fakeSupabase(page);
  await signIn(page);
  expect(unitGets(db)).toBeGreaterThan(40);
  expect(db.pack_gets!.some((g) => String(g.path).endsWith('owner-only/paper-module.json'))).toBe(true);

  await page.goto('./#/library');
  await expect(page.getByRole('link', { name: /Paper Module/ })).toBeVisible();
  await page.getByRole('link', { name: /Paper Module/ }).click();
  await expect(page.getByText('That part of the library does not exist.')).toHaveCount(0);

  const before = db.pack_gets!.length;
  await page.reload();
  await page.goto('./#/library/logic/1');
  await expect(page.getByRole('heading', { name: unitTitle('logic-1') })).toBeVisible();
  expect(db.pack_gets!.length).toBe(before); // checked today already, so the copy on the phone is used
});

test('anyone but the owner gets the units and readings but no Paper Module', async ({ page }) => {
  const db = await fakeSupabase(page, { owner: false });
  await signIn(page);
  expect(unitGets(db)).toBeGreaterThan(40);
  await page.goto('./#/library');
  await expect(page.getByRole('link', { name: /Track A|Logic/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Paper Module/ })).toHaveCount(0);
  await page.goto('./#/paper');
  await expect(page.getByText('That part of the library does not exist.')).toBeVisible();
});

test('a new day looks for a new version and keeps the copy when it is the same', async ({ page }) => {
  const db = await fakeSupabase(page);
  await signIn(page);
  // pretend the last look was yesterday
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('wonderwander');
        req.onsuccess = () => {
          const store = req.result.transaction('pack', 'readwrite').objectStore('pack');
          const get = store.get('meta');
          get.onsuccess = () => {
            store.put({ ...get.result, checkedOn: '2000-01-01' }, 'meta');
            store.transaction.oncomplete = () => resolve();
          };
        };
      }),
  );
  const units = unitGets(db);
  await page.reload();
  await expect(page.getByRole('heading', { name: /^(Today|Weekend ritual)$/ })).toBeVisible();
  expect(db.pack_gets!.filter((g) => g.path === 'packs/current.json').length).toBe(2);
  expect(unitGets(db)).toBe(units);
});

test('offline before the first download, the gate says so and offers a retry', async ({ page }) => {
  await fakeSupabase(page);
  let offline = true;
  await page.route('https://fake.supabase.test/storage/v1/object/content/**', (r) => (offline ? r.abort('internetdisconnected') : r.fallback()));
  await page.goto('./');
  await page.getByLabel('Email').fill('laiba@example.invalid');
  await page.getByLabel('Password').fill('right-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be downloaded');
  offline = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: /^(Today|Weekend ritual)$/ })).toBeVisible();
});

test('About names who wrote the curriculum and built the app, with both licences and the versions in use', async ({ page }) => {
  await fakeSupabase(page);
  await signIn(page);
  await page.goto('./#/me');
  await page.getByRole('link', { name: 'About, licences and versions' }).click();
  await expect(page.getByText('Curriculum written by Laiba, 2026. App designed and built by Laiba.')).toBeVisible();
  await expect(page.getByText('MIT licence, copyright Laiba.', { exact: false })).toBeVisible();
  await expect(page.getByText('Creative Commons Attribution-NonCommercial-ShareAlike 4.0, copyright Laiba.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'github.com/laiba-121921/wonderwander' })).toHaveAttribute('href', 'https://github.com/laiba-121921/wonderwander');
  await expect(page.getByText(/^1\.0\.0 \([0-9a-f]{7}\)$/)).toBeVisible();
  await expect(page.getByText(/^\d{8}-[0-9a-f]{8}$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What this app keeps, and where' })).toBeVisible();
});
