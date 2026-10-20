import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

// PHASE_15_PLUS 6: the version shown on the About screen, the package version plus the commit it was built from.
function appVersion(): string {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  let sha = process.env.GITHUB_SHA?.slice(0, 7);
  try {
    sha ??= execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    sha = 'local';
  }
  return `${pkg.version} (${sha})`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/',
    // PHASE_15_PLUS 3.3: production reads the downloaded pack; the local content loader is compiled out of it
    define: {
      __LOCAL_CONTENT__: JSON.stringify((env.VITE_CONTENT_SOURCE || (mode === 'production' ? 'pack' : 'local')) === 'local'),
      __APP_VERSION__: JSON.stringify(appVersion()),
    },
    plugins: [
      react(),
      tailwindcss(),
      // BUILD_PLAN 20: installable, works offline for everything that needs no network
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src/sw',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'wonderwander',
          short_name: 'wonderwander',
          description: 'A philosophy gym: lessons, drills, debates and a paper.',
          lang: 'en-GB',
          theme_color: '#f2a531',
          background_color: '#fff6e5',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
          // the PDF reader is needed only for uploads; non-Latin font subsets download only if such letters ever appear
          globIgnores: ['**/pdf.worker*', '**/pdf-*.js', '**/*-cyrillic*.woff2', '**/*-greek*.woff2', '**/*-vietnamese*.woff2'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          // libraries change rarely, so they get their own long-lived chunks
          codeSplitting: {
            groups: [
              { name: 'supabase', test: /node_modules[\\/]@supabase/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
