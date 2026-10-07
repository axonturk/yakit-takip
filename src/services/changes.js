import { formatTL, transactionLabel } from './storage';

// Turns one row of the cloud change log into words: what happened and which fields changed.

const TX_FIELDS = [
  ['amount', 'Tutar', (v) => formatTL(Number(v))],
  ['liters', 'Litre', (v) => `${String(v).replace('.', ',')} L`],
  ['unitPrice', 'Birim fiyat', (v) => formatTL(Number(v))],
  ['date', 'Tarih', (v) => String(v).replace('T', ' ')],
  ['plate', 'Plaka', String],
  ['fuelType', 'Yakıt', String],
  ['paymentMethod', 'Ödeme', String],
  ['receiptNo', 'Fiş no', String],
  ['note', 'Not', String]
];

const STATION_FIELDS = [
  ['name', 'Ad', String],
  ['brand', 'Marka', String],
  ['lowBalanceThreshold', 'Uyarı sınırı', (v) => formatTL(Number(v))],
  ['archived', 'Arşiv', (v) => (v ? 'arşivde' : 'açık')]
];

const empty = (v) => v === null || v === undefined || v === '';

function fieldChanges(fields, before, after) {
  const out = [];
  fields.forEach(([key, label, fmt]) => {
    const a = before?.[key];
    const b = after?.[key];
    if ((empty(a) && empty(b)) || a === b) return;
    out.push(`${label}: ${empty(a) ? '—' : fmt(a)} → ${empty(b) ? '—' : fmt(b)}`);
  });
  if (fields === TX_FIELDS && before?.stationId !== after?.stationId && before && after) {
    out.push(`İstasyon: ${before.stationName || '—'} → ${after.stationName || '—'}`);
  }
  if (fields === TX_FIELDS && Boolean(before?.photoId) !== Boolean(after?.photoId) && before && after) {
    out.push(after.photoId ? 'Fotoğraf eklendi' : 'Fotoğraf kaldırıldı');
  }
  return out;
}

const VERB = { create: 'eklendi', update: 'düzenlendi', delete: 'silindi' };

export function describeChange(entry, stationName = (id) => id) {
  const rec = entry.data || entry.previous || {};
  if (entry.kind === 'station') {
    return {
      title: `İstasyon ${VERB[entry.action]}: ${rec.name || entry.id}`,
      amount: null,
      details: entry.action === 'update' ? fieldChanges(STATION_FIELDS, entry.previous, entry.data) : []
    };
  }
  const where = rec.stationName || stationName(rec.stationId) || '';
  return {
    title: `${transactionLabel(rec)} ${VERB[entry.action]}${where ? ` · ${where}` : ''}`,
    amount: rec.amount === undefined ? null : Number(rec.amount),
    sign: rec.type === 'topup' ? '+' : '−',
    details: entry.action === 'update' ? fieldChanges(TX_FIELDS, entry.previous, entry.data) : []
  };
}

// "a@b.com" → "a"; keeps lists short on a phone.
export function shortEmail(email) {
  if (!email) return 'Bilinmiyor';
  return email.split('@')[0];
}
