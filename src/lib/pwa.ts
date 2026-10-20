import { useEffect, useState } from 'react';

// BUILD_PLAN 20: register the service worker in production builds and offer "Reload" when a new version waits.
export function useUpdateBanner(): { ready: boolean; reload: () => void } {
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let live = true;
    import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => live && setUpdate(() => updateSW),
      });
    });
    return () => {
      live = false;
    };
  }, []);
  return { ready: Boolean(update), reload: () => void update?.(true) };
}
