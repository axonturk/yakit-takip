import { SUPABASE_URL, SUPABASE_ANON_KEY } from './cloud';
import { version } from '../../package.json';

// Anonymous app health: one "open" a day per device with record counts, and error messages.
// Never amounts, station names, notes or e-mails. Failures are ignored.

const DEVICE_KEY = 'hisapo_device_v1';
const OPEN_KEY = 'hisapo_last_open_v1';
const MAX_ERRORS = 5;
const sentErrors = new Set();

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

function send(row) {
  if (import.meta.env.DEV) return;
  fetch(`${SUPABASE_URL}/rest/v1/app_events`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ device: deviceId(), version, ...row })
  }).catch(() => {});
}

export function reportOpen(info, today = new Date().toISOString().slice(0, 10)) {
  try {
    if (localStorage.getItem(OPEN_KEY) === today) return;
    localStorage.setItem(OPEN_KEY, today);
  } catch {
    return;
  }
  send({ kind: 'open', info });
}

export function reportError(message, detail = '') {
  const text = String(message || 'Bilinmeyen hata').slice(0, 500);
  if (sentErrors.size >= MAX_ERRORS || sentErrors.has(text)) return;
  sentErrors.add(text);
  send({ kind: 'error', message: text, detail: String(detail || '').slice(0, 4000), info: { path: location.hash || null } });
}

export function watchErrors() {
  window.addEventListener('error', (e) => reportError(e.message, e.error?.stack));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason?.message || String(e.reason), e.reason?.stack));
}
