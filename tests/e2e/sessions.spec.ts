import { expect, test } from '@playwright/test';
import { fakeSupabase, seedPassed, signIn, unitTitle, type Db } from './helpers';

let db: Db;
const MONDAY = new Date('2026-10-19T08:00:00Z'); // 13:00 in Karachi

test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
  await page.clock.setFixedTime(MONDAY);
});

test('the map shows each track as a trail; a node opens its sheet with exact mastery', async ({ page }) => {
  seedPassed(db, ['logic-1']);
  await signIn(page);
  await page.goto('/#/map');
  await expect(page.getByRole('tab', { name: 'Logic' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: new RegExp(`^Unit 1, ${unitTitle('logic-1')}, 100 percent, passed$`) })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Unit 2, .*, you are here$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Unit 3, .*, locked$/ })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Unit passed' })).toBeVisible(); // confetti, once

  await page.getByRole('button', { name: /^Unit 2,/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Mastery 0%')).toBeVisible();
  await expect(sheet.getByText('0 of 10')).toBeVisible();
  await sheet.getByRole('button', { name: 'Open unit' }).click();
  await expect(page).toHaveURL(/#\/library\/logic\/2$/);

  await page.goto('/#/map');
  await page.getByRole('tab', { name: 'B' }).click();
  await expect(page.getByText('Philosophy of Religion')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Unit 1, .*, you are here$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Final boss:/ }).first().click();
  await expect(page.getByRole('dialog').getByText('Not fought yet')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true'); // the tab is remembered
  await expect(page.getByRole('status', { name: 'Unit passed' })).toHaveCount(0); // never twice
});

test('the daily plan offers the next item in the picked track', async ({ page }) => {
  seedPassed(db, ['logic-1']);
  await signIn(page);
  await expect(page.getByText('Evening, Laiba').or(page.getByText('Morning, Laiba'))).toBeVisible();
  await page.getByRole('button', { name: 'Track C' }).click();
  await page.getByRole('link', { name: /reading comprehension C1/ }).click();
  await expect(page).toHaveURL(/political-1%3Acomp%3AC1/);
  await page.goto('/#/');
  await expect(page.getByText(/review/i)).toHaveCount(0); // no queue anywhere on Today (PHASE_15_PLUS 1.3)
  await expect(page.getByText(/^Overall mastery \d+%$/)).toBeVisible();
});

test('on the weekend day Today is the ritual: four acts, any can be skipped', async ({ page }) => {
  seedPassed(db, ['logic-1']);
  db.profile = [{ user_id: '11111111-1111-1111-1111-111111111111', display_name: 'Laiba', weekend_day: 1, push_threshold: 12, push_hour: 20, timezone: 'Asia/Karachi', track_rotation_start: '2026-10-19' }];
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Weekend ritual' })).toBeVisible();
  await expect(page.getByText('This weekend: Track A.')).toBeVisible();
  for (const t of ["1. This week's failures", '2. Reading', '3. Doing drills', '4. Boss or writing']) await expect(page.getByText(t)).toBeVisible();
  await expect(page.getByText(/review/i)).toHaveCount(0);
  await expect(page.getByText('1 of 4 done.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Skip' }).first().click();
  await expect(page.getByText('Skipped.')).toBeVisible();
  await page.getByRole('link', { name: 'Reconstruct' }).click();
  await expect(page.getByRole('heading', { name: 'Reconstruct the argument' })).toBeVisible();
  expect(db.session_log!.at(-1)).toMatchObject({ kind: 'weekend', track: 'A', items_done: 1 });

  await page.goto('/#/');
  await page.getByRole('button', { name: 'Show the daily plan instead' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});

test('settings change the display name and the weekend day', async ({ page }) => {
  db.profile = [{ user_id: '11111111-1111-1111-1111-111111111111', display_name: 'Laiba', weekend_day: 0, push_threshold: 12, push_hour: 20, timezone: 'Asia/Karachi', track_rotation_start: null }];
  await signIn(page);
  await page.goto('/#/me');
  await page.getByLabel('Display name').fill('Laiba A');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.getByLabel('Weekend ritual day').selectOption('Monday');
  await expect.poll(() => db.profile![0]).toMatchObject({ display_name: 'Laiba A', weekend_day: 1 });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Weekend ritual' })).toBeVisible();
  await expect(page.getByText(/, Laiba A$/)).toBeVisible();
});
