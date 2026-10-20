/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

// BUILD_PLAN 20: the app shell, fonts, content and art are precached; Supabase and the functions stay network only.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

// A new version waits until the page says "Reload" (the update banner).
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// BUILD_PLAN 18: the card reminder, the only notification there is.
self.addEventListener('push', (e) => {
  const msg = (() => {
    try {
      return e.data?.json() as { title: string; body: string; url: string };
    } catch {
      return null;
    }
  })();
  if (!msg) return;
  e.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'cards', data: { url: msg.url } }));
});

// Tapping it opens the Cards screen, reusing an open window if there is one.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url ?? '#/cards', self.registration.scope).href;
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = wins[0];
      if (win) {
        await win.navigate(target).catch(() => undefined);
        return void (await win.focus());
      }
      await self.clients.openWindow(target);
    })(),
  );
});
