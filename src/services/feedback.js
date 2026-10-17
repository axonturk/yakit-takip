import { SUPABASE_URL, SUPABASE_ANON_KEY } from './cloud';
import { deviceId } from './telemetry';
import { getCurrency, getLang, getUnits, receiptLanguage } from '../i18n';
import { version } from '../../package.json';

// Pilot feedback: bug reports and, when the user agrees, receipts the reader got wrong.
// Rows go to the feedback table and photos to the private "feedback" bucket; only the project owner sees them.

const headers = (type) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': type
});

async function uploadPhoto(kind, blob) {
  const path = `${kind}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/feedback/${path}`, {
    method: 'POST',
    headers: headers(blob.type || 'image/jpeg'),
    body: blob
  });
  if (!res.ok) throw new Error(`photo upload failed (${res.status})`);
  return path;
}

// kind: 'bug' (message, optional contact and screenshot) or 'receipt' (photo, what was read, what was saved)
export async function sendFeedback({ kind, message = '', contact = '', photo = null, info = {} }) {
  const row = {
    device: deviceId(),
    version,
    kind,
    message: message.trim().slice(0, 2000) || null,
    contact: contact.trim().slice(0, 200) || null,
    info: { lang: getLang(), currency: getCurrency(), units: getUnits(), country: receiptLanguage().country, ...info }
  };
  if (import.meta.env.DEV) {
    console.info('Feedback (not sent in development)', row);
    return;
  }
  if (photo) row.photo = await uploadPhoto(kind, photo);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
    method: 'POST',
    headers: { ...headers('application/json'), Prefer: 'return=minimal' },
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error(`feedback failed (${res.status})`);
}
