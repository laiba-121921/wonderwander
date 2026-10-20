import { expect, test } from '@playwright/test';
import { fakeSupabase, signIn, type Db } from './helpers';

let db: Db;
test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
});

async function answerDrill(page: import('@playwright/test').Page, sourceId: string, text: string) {
  await page.getByRole('link', { name: new RegExp(`${sourceId}\\b`) }).click();
  await page.getByLabel('Your answer').fill(text);
  await page.getByRole('button', { name: 'Check my answer' }).click();
}

test('recall drills: a clear fail locks only that item, a pass passes, off-key with a pass passes', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await expect(page.getByRole('heading', { name: /Practise/ })).toBeVisible();

  await answerDrill(page, 'L1-04', 'WRONG: only the first premise');
  await expect(page.getByText('Not this time. This one rests until tomorrow.')).toBeVisible();
  await expect(page.getByText('the second premise')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the unit' }).click();
  await expect(page.getByRole('link', { name: /L1-04/ })).toContainText('Back tomorrow');
  await expect(page.getByRole('link', { name: /L1-07/ })).toContainText('Ready'); // only that item locked

  const locked = db.item_state!.find((r) => r.item_id === 'logic-1:drill:L1-04')!;
  expect(locked.status).toBe('locked');
  expect(new Date(String(locked.locked_until)).getUTCHours()).toBe(19); // midnight in Karachi

  await answerDrill(page, 'L1-07', 'RIGHT: valid and unsound');
  await expect(page.getByText('Nailed it.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the unit' }).click();

  await answerDrill(page, 'L1-08', 'ODD: dolphins are mammals anyway');
  await expect(page.getByText('Nailed it.')).toBeVisible(); // off-key no longer escalates by itself
  expect(db.review_queue ?? []).toHaveLength(0);
  expect(db.attempt).toHaveLength(3);
  expect(db.llm_calls!.filter((c) => c.mode === 'grade')).toHaveLength(3);
});

test('an unresolved first result is a soft retry; an unresolved second goes to the tie-break and can be appealed', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await answerDrill(page, 'L1-05', 'MAYBE: valid');
  await expect(page.getByText('Nearly. Say it more fully.')).toBeVisible();
  await expect(page.getByText('the second premise')).toBeVisible();
  await expect(page.getByLabel('Your answer')).toHaveValue('MAYBE: valid'); // the first answer is there to build on
  expect(db.item_state!.find((r) => r.item_id === 'logic-1:drill:L1-05')!.status).toBe('available'); // nothing locked
  const first = db.attempt!.at(-1)!;
  expect(first.decision).toBe('RETRY');

  await page.getByLabel('Your answer').fill('MAYBE: valid, and unsound because premise 2 is false');
  await page.getByRole('button', { name: 'Check my fuller answer' }).click();
  await expect(page.getByText('Not this time.')).toBeVisible(); // the tie-break: grader PASS, auditor FAIL, tie-break FAIL
  const second = db.attempt!.at(-1)!;
  expect(second).toMatchObject({ decision: 'FAIL', appealable: true, retry_of: first.id });
  expect(db.llm_calls!.filter((c) => c.mode === 'grade' && c.second)).toHaveLength(1);

  await page.getByRole('button', { name: 'Appeal this verdict' }).click();
  await expect(page.getByText('Appealed.')).toBeVisible();
  expect(db.review_queue).toEqual([expect.objectContaining({ attempt_id: second.id, item_id: 'logic-1:drill:L1-05', reason: 'appeal' })]);
});

test('the tie-break can pass a fuller answer', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await answerDrill(page, 'L1-05', 'MAYBE: valid');
  await expect(page.getByText('Nearly. Say it more fully.')).toBeVisible();
  await page.getByLabel('Your answer').fill('MAYBE-PASS: valid and unsound, premise 2 is false');
  await page.getByRole('button', { name: 'Check my fuller answer' }).click();
  await expect(page.getByText('Nailed it.')).toBeVisible();
});

test('a TAP drill is checked on the device, with no Gemini call', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await page.getByRole('link', { name: /L1-01/ }).click();
  await page.getByRole('button', { name: 'Faisalabad is in Punjab.' }).click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Nailed it.')).toBeVisible();
  expect(db.llm_calls ?? []).toHaveLength(0);
  expect(db.item_state!.find((r) => r.item_id === 'logic-1:drill:L1-01')!.status).toBe('passed');
});

test('revision opens only after reading to the end and sixty seconds', async ({ page }) => {
  await page.clock.install();
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await answerDrill(page, 'L1-04', 'WRONG');
  await page.getByRole('button', { name: 'Revise now' }).click();
  const done = page.getByRole('button', { name: "I've revised" });
  await expect(done).toBeDisabled();
  await done.scrollIntoViewIfNeeded();
  await page.clock.runFor(61_000);
  await expect(done).toBeEnabled();
  await done.click();
  await expect(page.getByText('Revised. The retry opens at midnight.')).toBeVisible();
  expect(db.item_state!.find((r) => r.item_id === 'logic-1:drill:L1-04')!.revision_done_at).toBeTruthy();
});

test('cards: due cards are created, graded twice-checked, and scheduled', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/cards');
  await expect(page.getByText('1 of 8')).toBeVisible();
  expect(db.card_state!.length).toBe(12); // Logic 1's twelve cards entered the deck
  await page.getByLabel('Your answer').fill('RIGHT: a set of statements with premises and a conclusion');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Nailed it.')).toBeVisible();
  await expect(page.getByText('The back of the card')).toBeVisible();
  expect(db.card_review).toHaveLength(1);
  expect(db.card_review![0]!.rating).toBe(3); // PASS at HIGH is Good
  expect(db.item_state ?? []).toHaveLength(0); // cards follow FSRS, not the lock lifecycle
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect(page.getByText('2 of 8')).toBeVisible();
});

test('an answer given offline is kept and checked as soon as the phone is back online', async ({ page, context }) => {
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await page.getByRole('link', { name: /L1-07\b/ }).click();
  await page.getByLabel('Your answer').fill('RIGHT: valid and unsound');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Check my answer' }).click();
  await expect(page.getByText("You're offline. Your answer is saved and will be checked when you're back.")).toBeVisible();
  expect(db.attempt ?? []).toHaveLength(0);
  await context.setOffline(false);
  await expect(page.getByText('Nailed it.')).toBeVisible();
  expect(db.attempt).toHaveLength(1);
});
