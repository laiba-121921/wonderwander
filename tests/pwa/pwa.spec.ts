import { expect, test } from '@playwright/test';
import { fakeSupabase, signIn, unitTitle, type Db } from '../e2e/helpers';

let db: Db;
test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
});

test('the build is installable: manifest, icons, a service worker that controls the page', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'wonderwander', short_name: 'wonderwander', display: 'standalone', orientation: 'portrait', theme_color: '#f2a531', background_color: '#fff6e5', start_url: '.' });
  expect(manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`)).toEqual(['192x192', '512x512', '512x512 maskable']);
  for (const i of manifest.icons) expect((await request.get(i.src)).headers()['content-type']).toBe('image/png');
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});

test('offline, the shell, the library and a bundled reading still open', async ({ page, context }) => {
  await signIn(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 15000 }).toBe(true).catch(async () => {
    await page.reload();
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // warm the lazily loaded screens once, as a first visit would
  await page.goto('./#/library/logic/1');
  await expect(page.getByRole('heading', { name: unitTitle('logic-1') })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: unitTitle('logic-1') })).toBeVisible();
  await page.getByRole('button', { name: /Read Dialogues Concerning Natural Religion/ }).click();
  await expect(page.getByText('EPICURUS', { exact: false }).first()).toBeVisible();
  await page.goto('./#/pulse');
  await expect(page.getByText('1 of 6')).toBeVisible(); // the logic pulse needs no network
  await context.setOffline(false);
});

test('card reminders subscribe with the key from the push function and store the subscription', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  // headless Chromium has no push service, so the browser's subscribe call is stood in for
  await page.addInitScript(() => {
    // headless Chromium reports notifications as blocked whatever is granted, so permission is stood in for too
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    Notification.requestPermission = async () => 'granted';
    PushManager.prototype.getSubscription = async () => null;
    PushManager.prototype.subscribe = async function (opts?: PushSubscriptionOptionsInit) {
      const key = opts?.applicationServerKey as Uint8Array;
      (window as unknown as { __keyLength: number }).__keyLength = key.byteLength;
      return { endpoint: 'https://push.example.invalid/sub/1', toJSON: () => ({ endpoint: 'https://push.example.invalid/sub/1', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => true } as unknown as PushSubscription;
    };
  });
  await signIn(page);
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration()))).toBe(true);
  await page.goto('./#/me');
  await page.getByRole('button', { name: 'Turn on card reminders' }).click();
  await expect(page.getByText('Reminders are on.')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __keyLength: number }).__keyLength)).toBe(65); // an uncompressed P-256 key
  expect(db.push_subscription).toEqual([expect.objectContaining({ endpoint: 'https://push.example.invalid/sub/1', keys: { p256dh: 'p', auth: 'a' } })]);

  await page.getByRole('button', { name: 'Send a test' }).click();
  await expect(page.getByText('Test reminder sent.')).toBeVisible();
  expect(db.push_calls!.at(-1)).toMatchObject({ method: 'POST', body: '{"test":true}' });

  await page.getByLabel('Time', { exact: true }).selectOption('07:00');
  await expect.poll(() => db.profile?.[0]?.push_hour).toBe(7);
});

test('no reload banner while no new version is waiting', async ({ page }) => {
  await page.goto('./');
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
  // pretend a new worker is installed and waiting, as after a deploy
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.dispatchEvent(new Event('updatefound'));
  });
  await expect(page.getByRole('status').filter({ hasText: 'A fresh version is ready.' })).toHaveCount(0); // nothing is waiting, so no banner
});
