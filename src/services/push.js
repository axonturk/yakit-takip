import { getClient } from './cloud';
import { getLang, getCurrency, getUnits } from '../i18n';

// Phone notifications for managers of a shared ledger. The phone subscribes with the browser's
// push service; the "notify" function on Supabase sends the messages (supabase/functions/notify).

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iPhone only allows notifications for the app added to the home screen
export function needsInstallFirst() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

function base64ToBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// 'on' | 'off' | 'blocked' | 'unsupported'
export async function pushState(workspaceId) {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const sub = await currentSubscription().catch(() => null);
  if (!sub || !workspaceId) return 'off';
  const supabase = await getClient();
  const { data } = await supabase.from('push_subscriptions').select('workspace_id').eq('endpoint', sub.endpoint).maybeSingle();
  return data?.workspace_id === workspaceId ? 'on' : 'off';
}

export class PushSetupError extends Error {}

export async function enablePush(workspaceId) {
  if (Notification.permission !== 'granted') {
    const answer = await Notification.requestPermission();
    if (answer !== 'granted') throw new PushSetupError('permission');
  }
  const supabase = await getClient();
  const { data: key, error } = await supabase.functions.invoke('notify', { method: 'GET' });
  if (error || !key?.publicKey) throw new PushSetupError('server');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  const wanted = base64ToBytes(key.publicKey);
  const current = sub?.options?.applicationServerKey;
  if (sub && current && toB64(current) !== toB64(wanted)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wanted });

  const json = sub.toJSON();
  const { data: user } = await supabase.auth.getUser();
  const { error: saveError } = await supabase.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    user_id: user?.user?.id,
    workspace_id: workspaceId,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    lang: getLang(),
    currency: getCurrency(),
    units: getUnits()
  });
  if (saveError) throw new PushSetupError('server');
}

export async function disablePush() {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  const supabase = await getClient();
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

// After the language or currency changes, later notifications follow it
export async function updatePushLocale(lang, currency, units) {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub) return;
  const supabase = await getClient();
  await supabase.from('push_subscriptions').update({ lang, currency, units }).eq('endpoint', sub.endpoint);
}
