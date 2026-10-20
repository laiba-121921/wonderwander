import { expect, test, type Page } from '@playwright/test';
import { fakeSupabase, signIn, type Db } from './helpers';

let db: Db;
test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
});

async function say(page: Page, text: string) {
  await page.getByLabel('Your reply').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
}

const calls = (mode: string) => (db.llm_calls ?? []).filter((c) => c.mode === mode).length;

test('a mini-boss is fought, saved every turn, resumed, judged and passed', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/practice/logic-1');
  await page.getByRole('link', { name: /The Quarreller/ }).click();
  await page.getByRole('button', { name: 'Start the fight' }).click();
  await expect(page.getByText('The road is wet because it rained.')).toBeVisible();
  await expect(page.getByText('Turn 1 of 5')).toBeVisible();

  await say(page, 'RIGHT: that is an explanation, nothing is in question.');
  await expect(page.getByText('Level 1 reply.')).toBeVisible();
  await say(page, 'RIGHT: an argument needs a conclusion in doubt.');
  await expect(page.getByText('Level 1 reply.').nth(1)).toBeVisible();
  await expect(page.getByLabel('Escalation level 2 of 3')).toBeVisible();

  await page.reload(); // a closed app resumes the fight
  await expect(page.getByText('Turn 3 of 5')).toBeVisible();
  await expect(page.getByText('RIGHT: an argument needs a conclusion in doubt.')).toBeVisible();

  for (const t of ['RIGHT: reason as cause versus reason as evidence.', 'RIGHT: the bridge case.', 'RIGHT: premise 2 equivocates.']) await say(page, t);
  await expect(page.getByText('The judge will now rule.')).toBeVisible();
  await expect(page.getByText('Nailed it.')).toBeVisible();
  await expect(page.getByText('Your strongest moment was the counterexample.')).toBeVisible();

  expect(calls('boss_turn')).toBe(4); // the fifth turn goes straight to the judge
  expect(calls('judge')).toBe(1);
  expect(calls('audit')).toBe(1);
  const session = db.boss_session![0]!;
  expect(session.status).toBe('decided');
  expect((session.transcript as unknown[]).length).toBe(10);
  expect(db.item_state!.find((r) => r.item_id === 'logic-1:boss')!.status).toBe('passed');
  const att = db.attempt!.find((a) => a.item_id === 'logic-1:boss')!;
  expect(att.item_class).toBe('mini_boss');
  expect(String(att.answer_text)).toContain('STUDENT: RIGHT: the bridge case.');
});

test('a failed boss locks, its verdict is the revision, and the rematch opens after midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await signIn(page);
  await page.goto('/#/boss/logic-2%3Aboss');
  await page.getByRole('button', { name: 'Start the fight' }).click();
  for (let i = 0; i < 5; i++) await say(page, `WRONG: the conclusion is false (${i}).`);
  await expect(page.getByText('Not this time.')).toBeVisible();
  expect(db.item_state!.find((r) => r.item_id === 'logic-2:boss')!.status).toBe('locked');
  expect(db.review_queue ?? []).toHaveLength(0);

  await page.getByRole('button', { name: 'Revise now' }).click();
  await expect(page.getByText("The judge's verdict")).toBeVisible();
  await expect(page.getByText('You attacked the conclusion every time.')).toBeVisible();
  const done = page.getByRole('button', { name: "I've revised" });
  await done.scrollIntoViewIfNeeded();
  await page.clock.runFor(61_000);
  await page.clock.fastForward('24:00:00'); // past midnight in Karachi
  await done.click();

  await expect(page.getByText('Last time the judge said')).toBeVisible();
  await page.getByRole('button', { name: 'Start the fight' }).click();
  await expect(page.getByText('Turn 1 of 5')).toBeVisible();
  expect(db.boss_session).toHaveLength(2);
});

test('Political 13 switches sides after five turns, then three reversed turns', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/boss/political-13%3Aboss');
  await page.getByRole('button', { name: 'Start the fight' }).click();
  for (let i = 0; i < 5; i++) await say(page, `RIGHT: turn ${i + 1}.`);
  await expect(page.getByText('Turn 6 of 8')).toBeVisible();
  await page.getByRole('button', { name: 'Switch sides' }).click();
  await expect(page.getByLabel('Your reply')).toBeVisible();
  expect(db.boss_session![0]!.phase).toBe('reversal');
  for (let i = 0; i < 3; i++) await say(page, `RIGHT: reversed ${i + 1}.`);
  await expect(page.getByText('Nailed it.')).toBeVisible();
  expect(String(db.attempt![0]!.answer_text)).toContain('STUDENT (reversed): RIGHT: reversed 3.');
});

test('a final boss waits until every unit of its domain is passed', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/library/logic');
  await page.getByRole('link', { name: /The Sophist/ }).click();
  await expect(page.getByText('waits at the gate')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start the fight' })).toHaveCount(0);
});

test('a close fight is settled by a second judge, and the verdict can be appealed', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/boss/logic-3%3Aboss');
  await page.getByRole('button', { name: 'Start the fight' }).click();
  for (let i = 0; i < 5; i++) await say(page, `MAYBE: turn ${i + 1}.`); // the auditor disagrees with the judge
  await expect(page.getByText('A second judge settled this one.')).toBeVisible();
  expect(calls('judge')).toBe(2);
  expect((db.llm_calls ?? []).filter((c) => c.mode === 'judge' && c.second)).toHaveLength(1);
  const att = db.attempt!.find((a) => a.item_id === 'logic-3:boss')!;
  expect(att).toMatchObject({ appealable: true });
  expect(String(att.decision)).toMatch(/PASS|FAIL/);
});
