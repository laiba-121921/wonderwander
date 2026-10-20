import { expect, test } from '@playwright/test';
import { fakeSupabase, signIn } from './helpers';

test.beforeEach(async ({ page }) => fakeSupabase(page));

test('the logic pulse plays all six items offline', async ({ page, context }) => {
  await signIn(page);
  await page.getByRole('link', { name: /Logic pulse/ }).click();
  await expect(page.getByText('1 of 6')).toBeVisible();
  // warm the lazily loaded chunks, then cut the network
  await context.setOffline(true);

  for (let i = 0; i < 6; i++) {
    const options = page.getByRole('group', { name: 'Options' });
    if (await options.isVisible()) {
      await options.getByRole('button').first().click();
      await page.getByRole('button', { name: 'Check' }).click();
    } else {
      // truth table or main connective
      const t = page.getByRole('button', { name: /Row 1: true/ });
      if (await t.isVisible()) {
        for (const b of await page.getByRole('button', { name: /: true$/ }).all()) await b.click();
        await page.getByRole('button', { name: 'Check' }).click();
      } else await page.getByRole('button', { name: /^Connective/ }).first().click();
    }
    await expect(page.getByRole('main').getByRole('status')).toBeVisible(); // the result, not the offline banner
    await page.getByRole('button', { name: i < 5 ? 'Next' : 'Finish' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Pulse done' })).toBeVisible();
  await expect(page.getByText(/of 6 right/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
