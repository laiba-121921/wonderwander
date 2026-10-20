/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// vite-plugin-pwa's own declaration pulls in every framework's types; this app needs only the plain register call.
declare module 'virtual:pwa-register' {
  export function registerSW(options?: { immediate?: boolean; onNeedRefresh?: () => void; onOfflineReady?: () => void }): (reloadPage?: boolean) => Promise<void>;
}

// true when the app reads content/ directly (development and tests), false when it downloads the pack
declare const __LOCAL_CONTENT__: boolean;
// the package version and the commit the app was built from, for the About screen
declare const __APP_VERSION__: string;
