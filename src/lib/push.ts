import { supabase } from './supabase';

// BUILD_PLAN 18: the card reminder subscription. The public VAPID key comes from the push function, so no key is
// built into the app.

export type PushSupport = 'ok' | 'unsupported' | 'denied';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : 'ok';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() === 'unsupported') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  // some browsers never answer when push is unavailable; treat a slow answer as "not subscribed"
  return Promise.race([reg.pushManager.getSubscription(), new Promise<null>((r) => setTimeout(() => r(null), 3000))]);
}

export async function turnOnReminders(): Promise<'on' | 'denied' | 'no_worker' | 'failed'> {
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'no_worker';
  try {
    const { data, error } = await supabase.functions.invoke('push', { method: 'GET' });
    if (error || !data?.publicKey) return 'failed';
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey as string) });
    const json = sub.toJSON();
    const up = await supabase.from('push_subscription').upsert({ endpoint: sub.endpoint, keys: json.keys as never }, { onConflict: 'endpoint' });
    return up.error ? 'failed' : 'on';
  } catch {
    return 'failed';
  }
}

export async function turnOffReminders(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscription').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestReminder(): Promise<{ sent: number; due: number } | null> {
  const { data, error } = await supabase.functions.invoke('push', { body: { test: true } });
  return error ? null : (data as { sent: number; due: number });
}
