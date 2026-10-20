import { expect, test } from '@playwright/test';
import { fakeSupabase, seedPassed, signIn, type Db } from './helpers';

let db: Db;
test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
});

test('offline, a banner says what still works', async ({ page, context }) => {
  await signIn(page);
  await context.setOffline(true);
  await expect(page.getByText("You're offline. Lessons, readings and the logic pulse still work")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("You're offline.")).toHaveCount(0);
});

test('Download my data saves every table as one JSON file', async ({ page }) => {
  seedPassed(db, ['logic-1']);
  (db.attempt ??= []).push({ id: 'a1', item_id: 'logic-1:drill:L1-01', answer_text: 'mine' });
  await signIn(page);
  await page.goto('/#/me');
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download my data' }).click();
  const file = await wait;
  expect(file.suggestedFilename()).toMatch(/^wonderwander-data-\d{4}-\d{2}-\d{2}\.json$/);
  const json = JSON.parse(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(json.app).toBe('wonderwander');
  expect(Object.keys(json.tables)).toEqual(['profile', 'item_state', 'attempt', 'variant', 'card_state', 'card_review', 'review_queue', 'key_override', 'boss_session', 'writing_submission', 'session_log', 'llm_usage', 'push_subscription']);
  expect(json.tables.attempt).toEqual([expect.objectContaining({ answer_text: 'mine' })]);
  expect(json.tables.item_state).toHaveLength(17); // Logic 1: ten drills, three comprehension, three doing drills, the boss
  await expect(page.getByText(/^Saved wonderwander-data-.*rows\.$/)).toBeVisible();
});

test('a damaged saved fight does not break the boss screen', async ({ page }) => {
  await page.route('https://fake.supabase.test/rest/v1/boss_session**', (r) => r.fulfill({ json: [{ id: 's', boss_id: 'logic-1:boss', transcript: 'not a list', status: 'active', phase: 'normal', created_at: '2026-10-19' }] }));
  await signIn(page);
  await page.goto('/#/boss/logic-1%3Aboss');
  await expect(page.getByText('Turn 1 of 5')).toBeVisible();
});

test('a screen that breaks shows a way out instead of a blank page', async ({ page }) => {
  // content that reads but is not the shape the screen expects, as a half-written update could leave it
  await page.route('**/content/json/logic.json*', (r) => r.fulfill({ contentType: 'text/javascript', body: "export default { domain: { id: 'logic', track: 'logic', order: 0, title: 'Logic', unitIds: ['logic-1'] }, units: [{ id: 'logic-1', number: 1, title: { broken: true } }] };" }));
  await signIn(page);
  await page.goto('/#/library/logic');
  await expect(page.getByText('This screen tripped over something.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '#/');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible(); // the tabs stay usable
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible(); // the boundary resets on the next screen
});
