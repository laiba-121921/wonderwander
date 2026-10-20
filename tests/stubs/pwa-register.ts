// Unit tests run without the PWA plugin; registering a service worker is a no-op there.
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
