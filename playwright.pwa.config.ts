import { defineConfig, devices } from '@playwright/test';

// The production build with its service worker, served by vite preview against the same fake Supabase. It reads the
// content pack (PHASE_15_PLUS 3.3), which the fake storage serves from the pack built first.
const PORT = 5175;

export default defineConfig({
  testDir: 'tests/pwa',
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
  },
  webServer: {
    command: `npx tsx scripts/build-pack.ts && npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort --mode e2e`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_SUPABASE_URL: 'https://fake.supabase.test', VITE_SUPABASE_ANON_KEY: 'fake-key', VITE_BASE_PATH: '/', VITE_CONTENT_SOURCE: 'pack', PACK_AUTHOR: 'Laiba' },
  },
});
