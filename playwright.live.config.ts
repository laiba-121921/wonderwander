import { defineConfig, devices } from '@playwright/test';

// The deployed site, as the phone sees it. No fake backend: this checks the real build, Pages and Supabase.
export default defineConfig({
  testDir: 'tests/live',
  use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL: 'https://laiba-121921.github.io/wonderwander/', serviceWorkers: 'allow' },
});
