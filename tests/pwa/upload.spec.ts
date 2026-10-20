import { expect, test, type Page } from '@playwright/test';
import { fakeSupabase, makeDocx, makePdf, seedPassed, signIn, type Db } from '../e2e/helpers';

// Uploads in the production build, served under the deployed base path: mammoth for Word files, and pdf.js with its
// worker loaded from the built assets.
let db: Db;
test.beforeEach(async ({ page }) => {
  db = await fakeSupabase(page);
  seedPassed(db, ['logic-1', 'logic-2', 'logic-3', 'logic-4']); // the writing ladder opens at four passed units
});

const upload = (page: Page, name: string, mimeType: string, buffer: Buffer) => page.locator('input[type=file]').first().setInputFiles({ name, mimeType, buffer });

test('a Word file is read on the phone, previewed with its word count, stored and graded', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await signIn(page);
  await page.goto('./#/write/logic%3Aladder%3Aabstract');
  await upload(page, 'draft.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', await makeDocx(['RIGHT: The first paragraph of a sample draft.', 'And a second one.']));
  await expect(page.getByText('From draft.docx: 12 words')).toBeVisible();
  await page.getByRole('button', { name: 'This looks right, send it' }).click();
  await expect(page.getByText(/Nailed it/)).toBeVisible();
  expect(db.writing_submission!.find((r) => r.attempt_id)).toMatchObject({ source: 'upload', text: 'RIGHT: The first paragraph of a sample draft.\n\nAnd a second one.' });
  expect(errors).toEqual([]);
});

test('a PDF is read with the built pdf.js worker; a scanned one is refused plainly', async ({ page }) => {
  const workers: string[] = [];
  page.on('request', (r) => {
    if (/pdf\.worker/.test(r.url())) workers.push(r.url());
  });
  await signIn(page);
  await page.goto('./#/write/logic%3Aladder%3Aabstract');
  await upload(page, 'scan.pdf', 'application/pdf', makePdf([], 60 * 1024));
  await expect(page.getByRole('alert')).toContainText('This PDF looks like images');
  await upload(page, 'draft.pdf', 'application/pdf', makePdf(['RIGHT: A sample draft saved', 'as a text PDF from a word processor.']));
  await expect(page.getByText('From draft.pdf: 13 words')).toBeVisible();
  await page.getByRole('button', { name: 'This looks right, send it' }).click();
  await expect(page.getByText(/Nailed it/)).toBeVisible();
  expect(workers.length).toBeGreaterThan(0);
  for (const w of workers) expect(new URL(w).pathname).toMatch(/^\/wonderwander\/assets\/pdf\.worker/);
});
