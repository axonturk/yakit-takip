// Hisapo push notifications (Supabase Edge Function "notify").
//
// GET  → { publicKey }: the key phones need to subscribe. The key pair is made on first use and kept
//        in the push_keys table, which only this function (service role) can read.
// POST { workspace_id, id } → called by the database right after a new transaction is saved
//        (schema.sql, notify_record). The record is read back from the database, so the request body
//        is only a pointer and cannot make up a message.
//
// Managers (owner and member roles) of the ledger are told, except the person who made the entry:
//   • a fuel purchase or top-up entered by someone else
//   • a station balance dropping below its warning level
//   • a driver going over the monthly limit
// Messages are written in each phone's own language and currency.

export const TEXT = {
  tr: {
    purchase: '⛽ {who}: {amount}',
    purchaseBody: '{station}{details}',
    topup: '💰 Avans yüklendi: {amount}',
    topupBody: '{station} · {who}',
    low: '⚠️ {station} bakiyesi azaldı',
    lowBody: 'Kalan: {balance} (uyarı seviyesi {limit})',
    owed: '⚠️ {station} bakiyesi eksiye düştü',
    owedBody: 'Bakiye: {balance}',
    limit: '🚫 {who} aylık limiti aştı',
    limitBody: 'Bu ay: {spent} / {limit}',
    someone: 'Biri'
  },
  en: {
    purchase: '⛽ {who}: {amount}',
    purchaseBody: '{station}{details}',
    topup: '💰 Advance added: {amount}',
    topupBody: '{station} · {who}',
    low: '⚠️ {station} balance is low',
    lowBody: 'Left: {balance} (warning level {limit})',
    owed: '⚠️ {station} balance is below zero',
    owedBody: 'Balance: {balance}',
    limit: '🚫 {who} went over the monthly limit',
    limitBody: 'This month: {spent} / {limit}',
    someone: 'Someone'
  }
};

const DEFAULT_LOW_BALANCE = 300;

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function money(amount, lang, currency) {
  const locale = lang === 'tr' ? 'tr-TR' : currency === 'INR' ? 'en-IN' : 'en-US';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'TRY', minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2, maximumFractionDigits: 2 }).format(amount || 0);
}

const kurus = (v) => Math.round(Number(v || 0) * 100);

// Station balance in kuruş, the same way the app adds it up (calculateBalances in storage.js)
export function stationBalance(txs, stationId) {
  return txs
    .filter((x) => x.stationId === stationId)
    .reduce((sum, x) => sum + (x.type === 'topup' ? kurus(x.amount) : -kurus(x.amount)), 0);
}

// What happened, independent of language: the list of events the new transaction causes.
// txs: all live transactions of the ledger including the new one; station: its station record (or null);
// driver: { role, monthlyLimit } of the person who entered it.
// Entries older than this are old records reaching the cloud for the first time, not news.
export const MAX_AGE_HOURS = 48;

export function eventsFor(tx, { txs, station, driver, now = new Date() }) {
  if (!tx || tx.kind === 'opening' || tx.kind === 'adjustment') return [];
  const when = new Date(tx.date);
  if (!Number.isNaN(when.getTime()) && now - when > MAX_AGE_HOURS * 3600 * 1000) return [];
  if (station?.archived) return [];
  const who = (tx.enteredBy || '').split('@')[0] || null;
  const out = [];
  if (tx.type === 'topup') {
    out.push({ type: 'topup', who, amount: tx.amount, station: tx.stationName });
    return out;
  }
  out.push({ type: 'purchase', who: tx.plate || who, amount: tx.amount, station: tx.stationName, liters: tx.liters, by: tx.plate ? who : null });

  const after = stationBalance(txs, tx.stationId);
  const before = after + kurus(tx.amount);
  const limitRaw = Number(station?.lowBalanceThreshold);
  const limit = kurus(Number.isFinite(limitRaw) && limitRaw >= 0 ? limitRaw : DEFAULT_LOW_BALANCE);
  if (before >= 0 && after < 0) out.push({ type: 'owed', station: tx.stationName, balance: after / 100 });
  else if (before >= limit && after < limit) out.push({ type: 'low', station: tx.stationName, balance: after / 100, limit: limit / 100 });

  const monthly = driver?.role === 'driver' ? Number(driver.monthlyLimit) : NaN;
  if (Number.isFinite(monthly) && monthly > 0 && tx.enteredById) {
    const month = String(tx.date || '').slice(0, 7);
    const spent = txs
      .filter((x) => x.type === 'expense' && !x.kind && x.enteredById === tx.enteredById && String(x.date || '').slice(0, 7) === month)
      .reduce((sum, x) => sum + kurus(x.amount), 0);
    const prev = spent - kurus(tx.amount);
    if (prev <= kurus(monthly) && spent > kurus(monthly)) out.push({ type: 'limit', who, spent: spent / 100, limit: monthly });
  }
  return out;
}

// One notification per event, in the phone's language and currency
export function render(event, lang = 'tr', currency = 'TRY', units = 'metric') {
  const L = TEXT[lang] || TEXT.tr;
  const m = (v) => money(v, lang, currency);
  const who = event.who || L.someone;
  const liters = event.liters ? `${lang === 'tr' ? String(event.liters).replace('.', ',') : event.liters} ${units === 'us' ? 'gal' : 'L'}` : '';
  const details = [liters, event.by].filter(Boolean).map((s) => ` · ${s}`).join('');
  switch (event.type) {
    case 'purchase':
      return { title: fill(L.purchase, { who, amount: m(event.amount) }), body: fill(L.purchaseBody, { station: event.station, details }) };
    case 'topup':
      return { title: fill(L.topup, { amount: m(event.amount) }), body: fill(L.topupBody, { station: event.station, who }) };
    case 'low':
      return { title: fill(L.low, { station: event.station }), body: fill(L.lowBody, { balance: m(event.balance), limit: m(event.limit) }) };
    case 'owed':
      return { title: fill(L.owed, { station: event.station }), body: fill(L.owedBody, { balance: m(event.balance) }) };
    case 'limit':
      return { title: fill(L.limit, { who }), body: fill(L.limitBody, { spent: m(event.spent), limit: m(event.limit) }) };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- server (Deno, Supabase Edge)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function vapidKeys(db, webpush) {
  const { data } = await db.from('push_keys').select('public_key, private_key').eq('id', 1).maybeSingle();
  if (data) return { publicKey: data.public_key, privateKey: data.private_key };
  const keys = webpush.generateVAPIDKeys();
  await db.from('push_keys').upsert({ id: 1, public_key: keys.publicKey, private_key: keys.privateKey }, { ignoreDuplicates: true });
  // Two first calls at once: keep whichever pair was saved
  const { data: saved } = await db.from('push_keys').select('public_key, private_key').eq('id', 1).single();
  return { publicKey: saved.public_key, privateKey: saved.private_key };
}

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const webpush = (await import('npm:web-push@3.6.7')).default;
  const env = globalThis.Deno.env;
  const db = createClient(env.get('SUPABASE_URL'), env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const keys = await vapidKeys(db, webpush);
  if (req.method === 'GET') return json({ publicKey: keys.publicKey });

  const { workspace_id: ws, id } = await req.json().catch(() => ({}));
  if (!ws || !id) return json({ error: 'workspace_id and id required' }, 400);

  const { data: rec } = await db.from('records').select('data, deleted, created_by').eq('workspace_id', ws).eq('kind', 'tx').eq('id', id).maybeSingle();
  if (!rec || rec.deleted || !rec.data) return json({ sent: 0, reason: 'no record' });
  const tx = rec.data;

  const [{ data: rows }, { data: members }, { data: subs }] = await Promise.all([
    db.from('records').select('kind, data').eq('workspace_id', ws).eq('deleted', false),
    db.from('workspace_members').select('user_id, role, monthly_limit').eq('workspace_id', ws),
    db.from('push_subscriptions').select('endpoint, user_id, p256dh, auth, lang, currency, units').eq('workspace_id', ws)
  ]);
  const txs = (rows || []).filter((r) => r.kind === 'tx' && r.data).map((r) => r.data);
  const station = (rows || []).find((r) => r.kind === 'station' && r.data?.id === tx.stationId)?.data || null;
  const author = rec.created_by || tx.enteredById || null;
  const authorRow = (members || []).find((m) => m.user_id === author);
  const events = eventsFor(tx, { txs, station, driver: authorRow && { role: authorRow.role, monthlyLimit: authorRow.monthly_limit } });
  if (!events.length) return json({ sent: 0 });

  const managers = new Set((members || []).filter((m) => m.role === 'owner' || m.role === 'member').map((m) => m.user_id));
  const targets = (subs || []).filter((s) => managers.has(s.user_id) && s.user_id !== author);

  webpush.setVapidDetails('mailto:destek@hisapo.com', keys.publicKey, keys.privateKey);
  let sent = 0;
  const gone = [];
  await Promise.all(
    targets.flatMap((s) =>
      events.map(async (event) => {
        const msg = render(event, s.lang, s.currency, s.units);
        const payload = JSON.stringify({ ...msg, tag: `${event.type}-${id}`, url: '/app/' });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
          sent += 1;
        } catch (e) {
          if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint);
          else console.error('push failed', e?.statusCode, e?.body);
        }
      })
    )
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', [...new Set(gone)]);
  return json({ sent, removed: gone.length });
}

if (globalThis.Deno?.serve) globalThis.Deno.serve(handle);
