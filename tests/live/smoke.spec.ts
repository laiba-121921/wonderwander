import { expect, test } from '@playwright/test';

// BUILD_PLAN 22, Phase 14: the smoke test on the deployed site. It never signs in as the owner; a made-up address
// proves the build reaches the real Supabase Auth without touching the account.
const SUPABASE = 'https://ekspkhpcuqkscbndglpy.supabase.co';

test('the deployed app loads at 390 by 844 with no errors and reaches Supabase', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource: the server responded with a status of 400/.test(m.text()) && errors.push(m.text()));
  await page.goto('./');
  await expect(page).toHaveTitle('wonderwander');
  await expect(page.getByLabel('Email')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); // no sideways scroll

  await page.getByLabel('Email').fill('smoke-test@example.invalid');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible(); // Supabase answered and the app explained the refusal
  expect(errors).toEqual([]);
});

test('the deployed app is installable and its worker takes control', async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
  expect(manifest).toMatchObject({ name: 'wonderwander', display: 'standalone', start_url: '.' });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state), { timeout: 90000 }).toBe('activated'); // the first install downloads the whole offline copy
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});

test('the edge functions answer as designed', async ({ request }) => {
  const key = (await request.get(`${SUPABASE}/functions/v1/push`)).status();
  expect(key).toBe(200);
  expect((await request.get(`${SUPABASE}/functions/v1/push`).then((r) => r.json())).publicKey).toMatch(/^B[A-Za-z0-9_-]{86}$/);
  expect((await request.post(`${SUPABASE}/functions/v1/llm`, { data: { mode: 'grade', payload: {} } })).status()).toBe(401); // never without sign-in
  expect((await request.post(`${SUPABASE}/functions/v1/push`, { data: { test: true } })).status()).toBe(403); // not the owner
});
