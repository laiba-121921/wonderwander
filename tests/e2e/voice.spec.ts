import { expect, test } from '@playwright/test';
import { fakeSupabase, seedPassed, signIn, type Db } from './helpers';

let db: Db;
test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
});

const mic = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^(Dictate \(hold to record\)|Record)$/ });

test('every answer screen has a mic', async ({ page }) => {
  seedPassed(db, ['logic-1', 'logic-2', 'logic-3', 'logic-4']);
  await signIn(page);
  for (const [name, path, count] of [
    ['drill', '/#/drill/logic-5%3Adrill%3AL5-02', 1],
    ['reconstruct', '/#/doing/logic-5%3Areconstruct', 3], // two premises and the conclusion
  ] as const) {
    await page.goto(path);
    await expect(mic(page).first(), name).toBeVisible();
    expect(await mic(page).count(), name).toBe(count);
  }

  await page.goto('/#/boss/logic-5%3Aboss');
  await page.getByRole('button', { name: 'Start the fight' }).click();
  await expect(mic(page)).toHaveCount(1);

  await page.goto('/#/write/logic%3Aladder%3Aabstract');
  await page.getByRole('button', { name: 'Write here' }).click();
  await expect(mic(page)).toHaveCount(1); // in the editor's top bar
});

test('a due card has a mic', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/cards');
  await expect(mic(page)).toHaveCount(1);
});

test('a recording uploaded on a writing screen is transcribed and previewed', async ({ page }) => {
  seedPassed(db, ['logic-1', 'logic-2', 'logic-3', 'logic-4']);
  await signIn(page);
  await page.goto('/#/write/logic%3Aladder%3Aabstract');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'abstract.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('not really audio, the fake transcribes anything') });
  await expect(page.getByText('Transcribed from abstract.m4a: 6 words')).toBeVisible();
  await expect(page.getByText('RIGHT: words heard in the recording.')).toBeVisible();
  expect(db.llm_calls!.filter((c) => c.mode === 'transcribe')).toHaveLength(1);
  expect(db.storage ?? []).toHaveLength(0); // audio is never stored
  await page.getByRole('button', { name: 'Send it' }).click();
  await expect(page.getByText('Nailed it.')).toBeVisible();
});

test('boss voices are off by default and can be turned on', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/me');
  const box = page.getByLabel('Read boss replies aloud');
  await expect(box).not.toBeChecked();
  await box.check();
  expect(await page.evaluate(() => localStorage.getItem('ww.boss.speak'))).toBe('true');
});
