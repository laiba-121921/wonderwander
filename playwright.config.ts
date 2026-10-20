import { defineConfig, devices } from '@playwright/test';

const PORT = 5174; // separate from the everyday dev server so tests never reuse its real Supabase settings

export default defineConfig({
  // the app is driven through real units, so these need the private content checked out at content/; content/e2e
  // holds the specs that quote it
  testDir: '.',
  testMatch: ['tests/e2e/**/*.spec.ts', 'content/e2e/**/*.spec.ts'],
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --mode e2e`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://fake.supabase.test', VITE_SUPABASE_ANON_KEY: 'fake-key' },
  },
});
