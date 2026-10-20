import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fakeSupabase, seedPassed, signIn } from './helpers';

// BUILD_PLAN 14: the accessibility pass. Every main screen against the WCAG 2 A and AA rules, at 390 by 844.
const SCREENS: [string, string][] = [
  ['Today', '/#/'],
  ['Map', '/#/map'],
  ['Library', '/#/library'],
  ['Domain', '/#/library/logic'],
  ['Unit', '/#/library/logic/1'],
  ['Lesson', '/#/lesson/logic-1'],
  ['Reader', '/#/read/hume-dialogues-part-10'],
  ['Practice', '/#/practice/logic-1'],
  ['Drill', '/#/drill/logic-1%3Adrill%3AL1-07'],
  ['TAP drill', '/#/drill/logic-1%3Adrill%3AL1-01'],
  ['Cards', '/#/cards'],
  ['Pulse', '/#/pulse'],
  ['Reconstruct', '/#/doing/logic-1%3Areconstruct'],
  ['Boss', '/#/boss/logic-1%3Aboss'],
  ['Writing', '/#/write/logic%3Aladder%3Aabstract'],
  ['Paper', '/#/paper'],
  ['Appeals', '/#/me/appeals'],
  ['About', '/#/me/about'],
  ['Me', '/#/me'],
];

test('every main screen passes the automated accessibility rules', async ({ page }) => {
  test.setTimeout(240_000);
  const db = await fakeSupabase(page);
  seedPassed(db, ['logic-1', 'logic-2', 'logic-3', 'logic-4']);
  await signIn(page);
  const failures: string[] = [];
  for (const [name, path] of SCREENS) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Opening...'), name).toHaveCount(0, { timeout: 20000 });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of violations) failures.push(`${name}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  }
  expect(failures).toEqual([]);
});

test('the sign-in screen passes too', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});

test('tap targets are at least 44 px tall (links inside running text excepted)', async ({ page }) => {
  test.setTimeout(240_000);
  const db = await fakeSupabase(page);
  seedPassed(db, ['logic-1', 'logic-2', 'logic-3', 'logic-4']);
  await signIn(page);
  const small: string[] = [];
  for (const [name, path] of SCREENS) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Opening...'), name).toHaveCount(0, { timeout: 20000 });
    const found = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('a, button, input, select, textarea, summary, [role=button], [role=tab]')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || el.closest('[aria-hidden=true]') || el.classList.contains('sr-only')) return false; // a hidden file input's target is its label
          if (el.tagName === 'A' && el.closest('p, li, td, blockquote') && el.closest('.prose, .calm, article, main p')) return false; // inline links in text
          if (el.tagName === 'INPUT' && (el.closest('label')?.getBoundingClientRect().height ?? 0) >= 44) return false; // the whole label row is the target
          return r.height < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().height)}px`),
    );
    small.push(...[...new Set(found)].map((f) => `${name}: ${f}`));
  }
  expect(small).toEqual([]);
});

test('keyboard focus is always visible', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/');
  await expect(page.getByLabel('Email')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.tagName)) === 'BODY') await page.keyboard.press('Tab');
    const style = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { tag: el.tagName, outline: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(style.outline, style.tag).not.toBe('none');
    expect(style.width, style.tag).toBeGreaterThanOrEqual(2);
  }
});
