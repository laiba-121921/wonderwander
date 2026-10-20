import { expect, test } from '@playwright/test';
import { fakeSupabase, signIn } from './helpers';

test.beforeEach(async ({ page }) => fakeSupabase(page));

test('a wrong password is explained and the app stays closed', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('laiba@example.invalid');
  await page.getByLabel('Password').fill('nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

test('sign in, every tab opens at 390 by 844, sign out', async ({ page }) => {
  await signIn(page);
  for (const name of ['Map', 'Library', 'Me']) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('design gallery renders every section and all 63 bosses at 390 px', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await signIn(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Me' }).click();
  await page.getByRole('link', { name: 'Design gallery' }).click();
  await expect(page.getByRole('heading', { name: 'Bosses: Political Philosophy' })).toBeVisible();
  await expect(page.getByText('Final boss', { exact: true })).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(errors).toEqual([]);
});
