// App lock: a PIN screen that hides the ledger from whoever picks up the phone.
// It is a screen lock, not encryption; the PIN is stored only as a salted hash on this device.

const KEY = 'hisapo_lock_v1';
export const LOCK_DELAYS = [
  { minutes: 0, label: 'Hemen' },
  { minutes: 1, label: '1 dk' },
  { minutes: 5, label: '5 dk' },
  { minutes: 15, label: '15 dk' }
];

export function loadLock() {
  try {
    const cfg = JSON.parse(localStorage.getItem(KEY));
    return cfg && cfg.hash && cfg.salt ? cfg : null;
  } catch {
    return null;
  }
}

export function saveLock(cfg) {
  try {
    if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: lock lasts for this session only
  }
}

export const validPin = (pin) => /^\d{4,6}$/.test(pin);

async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeLock(pin, after = 1) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { salt, hash: await hashPin(pin, salt), len: pin.length, after, fails: 0, until: 0 };
}

export async function checkPin(cfg, pin) {
  return (await hashPin(pin, cfg.salt)) === cfg.hash;
}

// After 5 wrong tries the screen waits, longer each time (30 s, 1 min, 2 min … up to 15 min).
export function waitAfterFails(fails) {
  return fails < 5 ? 0 : Math.min(30000 * 2 ** (fails - 5), 15 * 60000);
}

// Lock again when the app comes back after being in the background for `after` minutes.
export function shouldRelock(cfg, hiddenAt, now = Date.now()) {
  if (!cfg || hiddenAt === null) return false;
  return now - hiddenAt >= (cfg.after ?? 1) * 60000;
}
