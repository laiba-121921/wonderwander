import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// BUILD_PLAN 20: maskable icons, a lantern-carrying stick figure on amber. Run with `npx tsx scripts/make-icons.ts`.
const figure = (ink: string, lantern: boolean) => `
  <g fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="232" cy="158" r="34" />
    <path d="M232 192 L236 318" />
    <path d="M236 318 L204 410" /><path d="M236 318 L270 408" />
    <path d="M233 236 L186 286" /><path d="M233 236 L302 250" />
    <path d="M302 250 L304 268" />
  </g>
  ${
    lantern
      ? `<circle cx="304" cy="300" r="44" fill="#fff6e5" opacity="0.45" />
         <path d="M286 268 L322 268 L327 326 L281 326 Z" fill="#ffe380" stroke="${ink}" stroke-width="6" stroke-linejoin="round" />
         <path d="M304 280 Q296 296 304 312 Q312 296 304 280 Z" fill="#e8676b" />`
      : `<path d="M286 268 L322 268 L327 326 L281 326 Z" fill="${ink}" />`
  }
  <path d="M212 152 h1 M250 152 h1" stroke="${ink}" stroke-width="8" stroke-linecap="round" />
  <path d="M216 172 Q232 184 248 172" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" />`;

// full bleed amber with the figure inside the maskable safe zone (the central 80 percent)
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f2a531"/><g transform="translate(41 41) scale(0.84)">${figure('#2f2546', true)}</g></svg>`;
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#f2a531"/><g transform="translate(26 20) scale(0.9)">${figure('#2f2546', true)}</g></svg>`;
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${figure('#ffffff', false)}</svg>`;

const out = 'public/icons';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/icon.svg`, rounded);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, svg, size, transparent] of [
  ['icon-192.png', rounded, 192, true],
  ['icon-512.png', rounded, 512, true],
  ['maskable-512.png', icon, 512, false],
  ['apple-touch-180.png', icon, 180, false],
  ['badge-96.png', badge, 96, true],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${out}/${name}`, omitBackground: transparent });
}
await browser.close();
console.log('icons written to', out);
