import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { __LOCAL_CONTENT__: 'true', __APP_VERSION__: JSON.stringify('1.0.0 (test)') },
  resolve: { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./tests/stubs/pwa-register.ts', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    // content/tests holds the tests that quote the curriculum; it exists only where the private content is checked out
    include: ['tests/unit/**/*.test.{ts,tsx}', 'content/tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
