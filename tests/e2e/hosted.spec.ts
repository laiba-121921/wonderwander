import { expect, test, type Page } from '@playwright/test';
import { fakeSupabase, signIn } from './helpers';

// PHASE_15_PLUS 4: joining by invitation, the first run, each person's own Gemini key, and deleting an account.

const USER = '11111111-1111-1111-1111-111111111111';
const GOOD_KEY = 'AIzaGood_1234567890abcdefghijklmnop';
const BAD_KEY = 'AIzaBad_1234567890abcdefghijklmnopq';

async function answerDrill(page: Page, sourceId: string, text: string) {
  await page.getByRole('link', { name: new RegExp(`${sourceId}\\b`) }).click();
  await page.getByLabel('Your answer').fill(text);
  await page.getByRole('button', { name: 'Check my answer' }).click();
}

test('a new person joins with a code, reads the privacy note, sets up, and checks with their own key', async ({ page }) => {
  const db = await fakeSupabase(page, { owner: false });
  db.invite = [{ code: 'GLADCASE22', max_uses: 1, uses: 0 }];
  db.profile = [{ user_id: USER, display_name: '', onboarded: false, timezone: 'Asia/Karachi', weekend_day: 0, push_hour: 20, push_threshold: 12 }];

  await page.goto('/');
  await page.getByRole('button', { name: 'I have an invitation' }).click();
  await page.getByLabel('Invite code').fill('NAPENAPENA');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('That code is not one this app knows. Check it with the person who invited you.');

  await page.getByLabel('Invite code').fill('glad case 22');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What this app keeps, and where' })).toBeVisible();
  await expect(page.getByText(/people at Google may read it/)).toBeVisible();
  await page.getByLabel('Email').fill('sana@example.invalid');
  await page.getByLabel('Password (at least 8 characters)').fill('right-password');
  await page.getByRole('button', { name: 'Agree and make my account' }).click();
  expect(db.invite[0]!.uses).toBe(1);

  // first run: name, timezone, key; no way past the key without one
  await expect(page.getByRole('heading', { name: 'What should the app call you?' })).toBeVisible();
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await page.getByLabel('Your name').fill('Sana');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('Timezone')).not.toHaveValue('');
  await page.getByLabel('Timezone').selectOption('Europe/London');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Your Gemini key' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get a free key in Google AI Studio' })).toHaveAttribute('href', 'https://aistudio.google.com/apikey');
  await expect(page.getByRole('button', { name: /skip/i })).toHaveCount(0);
  await page.getByLabel('Gemini API key').fill('not a key');
  await page.getByRole('button', { name: 'Check and finish' }).click();
  await expect(page.getByRole('alert')).toContainText('does not look like a Gemini key');
  await page.getByLabel('Gemini API key').fill(BAD_KEY);
  await page.getByRole('button', { name: 'Check and finish' }).click();
  await expect(page.getByRole('alert')).toContainText('Google did not accept that key');
  await page.getByLabel('Gemini API key').fill(GOOD_KEY);
  await page.getByRole('button', { name: 'Check and finish' }).click();
  await expect(page.getByText(/(Morning|Evening), Sana/)).toBeVisible();
  expect(db.profile[0]).toMatchObject({ display_name: 'Sana', timezone: 'Europe/London', onboarded: true });

  // the key is on the phone, encrypted, and goes with every check
  const stored = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const req = indexedDB.open('wonderwander');
        req.onsuccess = () => {
          const all = req.result.transaction('secrets').objectStore('secrets').getAll();
          all.onsuccess = () => resolve(JSON.stringify(all.result.map((v) => (v instanceof CryptoKey ? 'CryptoKey' : Object.keys(v)))));
        };
      }),
  );
  expect(stored).not.toContain('AIzaGood');
  expect(stored).toContain('CryptoKey');
  await page.goto('/#/practice/logic-1');
  await answerDrill(page, 'L1-07', 'RIGHT: valid and unsound');
  await expect(page.getByText('Nailed it.')).toBeVisible();
  expect(db.gemini_keys!.filter((k) => k.mode === 'grade').every((k) => k.key === GOOD_KEY)).toBe(true);

  // a later launch goes straight in
  await page.goto('/#/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What should the app call you?' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^(Today|Weekend ritual)$/ })).toBeVisible();
});

test('a key problem says how to fix it and links to Settings, where the key is masked and can be replaced', async ({ page }) => {
  const db = await fakeSupabase(page, { owner: false });
  db.llm_error = [{ error: 'nokey' }];
  await signIn(page);
  // every screen says so until a key is added; the owner's key is never used instead
  await expect(page.getByRole('status').filter({ hasText: 'No Gemini key on this phone' })).toBeVisible();
  await page.goto('/#/practice/logic-1');
  await answerDrill(page, 'L1-07', 'RIGHT: valid and unsound');
  await expect(page.getByRole('alert')).toContainText('There is no Gemini key on this phone yet');
  await page.getByRole('link', { name: 'Open Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Gemini key' })).toBeVisible();
  await expect(page.getByText('No key on this phone yet, so nothing can be checked.')).toBeVisible();
  await page.getByRole('button', { name: 'Add a key' }).click();
  await page.getByLabel('New Gemini API key').fill(GOOD_KEY);
  await page.getByRole('button', { name: 'Check and save' }).click();
  await expect(page.getByText('Key saved on this phone.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'No Gemini key on this phone' })).toHaveCount(0);
  await expect(page.getByText('AIza••••••mnop')).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Key removed from this phone.')).toBeVisible();
});

test('only the owner sees Invitations, and can make a code', async ({ page }) => {
  const db = await fakeSupabase(page);
  await signIn(page);
  await page.goto('/#/me');
  await expect(page.getByRole('heading', { name: 'Invitations' })).toBeVisible();
  await expect(page.getByText('2 of 25 accounts in use.', { exact: false })).toBeVisible();
  await page.getByLabel('People per code').selectOption('2');
  await page.getByRole('button', { name: 'Make a code' }).click();
  await expect.poll(() => db.invite?.length).toBe(1);
  expect(db.invite![0]).toMatchObject({ max_uses: 2 });
  expect(String(db.invite![0]!.code)).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  await expect(page.getByText('You run this copy of wonderwander', { exact: false })).toBeVisible(); // no self-delete for the owner
  await expect(page.getByText(/never used for anyone else/)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'No Gemini key on this phone' })).toHaveCount(0); // the owner falls back to their own secret
  await page.getByRole('button', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'What this app keeps, and where' })).toBeVisible();
});

test('anyone else can delete their account after typing the word, and lands on sign-in', async ({ page }) => {
  const db = await fakeSupabase(page, { owner: false });
  await signIn(page);
  await page.goto('/#/me');
  await expect(page.getByRole('heading', { name: 'Invitations' })).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Delete everything' });
  await expect(button).toBeDisabled();
  await page.getByLabel('Type delete to confirm').fill('delete');
  await button.click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(db.deleted).toHaveLength(1);
});

test('the sign-in screen shows the name of this copy, which the owner can change', async ({ page }) => {
  const db = await fakeSupabase(page);
  db.app_config = [{ one: true, instance_name: 'Thinking Club', user_cap: 25 }];
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Thinking Club' })).toBeVisible();
  await expect(page).toHaveTitle('Thinking Club');
  await signIn(page);
  await page.goto('/#/me');
  await page.getByLabel('Name of this app (shown on the sign-in screen)').fill('Night Owls');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByText('Saved. The sign-in screen now shows it.')).toBeVisible();
  expect(db.app_config[0]).toMatchObject({ instance_name: 'Night Owls' });
});
