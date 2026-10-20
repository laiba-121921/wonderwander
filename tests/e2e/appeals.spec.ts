import { expect, test } from '@playwright/test';
import { fakeSupabase, signIn, type Db } from './helpers';

let db: Db;
test.beforeEach(async ({ page, context }) => {
  db = await fakeSupabase(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test('an appeal round trip: appeal fails, export the pack, paste the ruling, states and keys update', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/me/appeals');
  await expect(page.getByText('No appeals. The owl is asleep.')).toBeVisible();

  // two fails, both appealed from their result screens
  await page.goto('/#/practice/logic-1');
  await page.getByRole('link', { name: /L1-08\b/ }).click();
  await page.getByLabel('Your answer').fill('WRONG: the premises are false but the form is valid');
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await page.getByRole('button', { name: 'Appeal this verdict' }).click();
  await expect(page.getByText('Appealed.')).toBeVisible();

  await page.goto('/#/cards');
  await page.getByLabel('Your answer').fill('WRONG: a set of claims, one supported by the rest');
  await page.getByRole('button', { name: 'Check' }).click();
  await page.getByRole('button', { name: 'Appeal this verdict' }).click();
  await expect(page.getByText('Appealed.')).toBeVisible();

  await page.goto('/#/me');
  await page.getByRole('link', { name: 'Open appeals' }).click();
  await expect(page.getByText('2 appealed')).toBeVisible();
  await page.getByRole('button', { name: 'Copy appeal pack' }).click();
  await expect(page.getByText('Copied. Paste it into your assistant.')).toBeVisible();
  const pack = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  expect(pack).toMatch(/^wonderwander appeal pack, \d{4}-\d{2}-\d{2}, 2 items\.\n\nInstructions: you are ruling on appealed/);
  expect(pack).not.toMatch(/Claude|weekly review/i);
  const items = JSON.parse(pack.slice(pack.indexOf('Items:\n') + 7)) as { queue_id: string; item_id: string }[];
  const id = (item: string) => items.find((i) => i.item_id === item)!.queue_id;

  const rulings = {
    rulings: [
      { queue_id: id('logic-1:drill:L1-08'), verdict: 'FAIL', reason: 'The key says invalid; the answer calls the form valid.' },
      { queue_id: id('logic-1:card:1'), verdict: 'PASS', reason: 'A correct definition in other words.', key_amendment: { accept_add: ['a set of claims, one of which is supported by the others'], reject_add: [], required_edit: null } },
      { queue_id: 'not-a-queue-id', verdict: 'PASS', reason: 'A stray ruling.' },
    ],
  };
  await page.getByRole('button', { name: 'Paste rulings' }).click();
  await page.getByLabel('The ruling').fill(`Discussion first.\n\n\`\`\`json\n${JSON.stringify(rulings)}\n\`\`\``);
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('logic-1:card:1: PASS')).toBeVisible();
  await expect(page.getByText('Unknown item not-a-queue-id, will be skipped: PASS')).toBeVisible();
  await page.getByRole('button', { name: 'Apply rulings' }).click();
  await expect(page.getByText('2 rulings applied: 1 passed, 1 failed.')).toBeVisible();
  await expect(page.getByText('Keys updated: logic-1:card:1.')).toBeVisible();
  await expect(page.getByText('No appeals. The owl is asleep.')).toBeVisible();

  expect(db.item_state!.find((r) => r.item_id === 'logic-1:drill:L1-08')!.status).toBe('locked');
  expect(db.review_queue!.every((q) => q.status === 'ruled')).toBe(true);
  expect((db.card_state!.find((c) => c.card_id === 'logic-1:card:1')!.pass_days as string[]).length).toBe(1);
  expect(db.key_override!.map((k) => [k.item_id, k.version])).toEqual([['logic-1:card:1', 2]]);
});
