// LocalStorage key
const STORAGE_KEY = 'yakit_takip_data_v1';

// Sample data, shown only when the user asks to see an example
export const SAMPLE_DATA = {
  stations: [
    { id: 'opet-maslak', name: 'Opet Maslak', color: '#10b981', brand: 'Opet' },
    { id: 'shell-kadikoy', name: 'Shell Kadıköy', color: '#eab308', brand: 'Shell' },
    { id: 'po-cevre', name: 'Petrol Ofisi Çevre Yolu', color: '#ef4444', brand: 'Petrol Ofisi' },
    { id: 'bp-atasehir', name: 'BP Ataşehir', color: '#22c55e', brand: 'BP' }
  ],
  transactions: [
    {
      id: 'tx-1',
      type: 'expense',
      stationId: 'shell-kadikoy',
      stationName: 'Shell Kadıköy',
      amount: 350.00,
      liters: 7.95,
      unitPrice: 44.02,
      date: '2026-10-01T17:45',
      note: 'Pompa No: 4'
    },
    {
      id: 'tx-2',
      type: 'expense',
      stationId: 'opet-maslak',
      stationName: 'Opet Maslak',
      amount: 220.00,
      liters: 5.00,
      unitPrice: 44.00,
      date: '2026-10-01T11:20',
      note: 'Dönüş yolu'
    },
    {
      id: 'tx-3',
      type: 'topup',
      stationId: 'opet-maslak',
      stationName: 'Opet Maslak',
      amount: 2500.00,
      liters: null,
      unitPrice: null,
      date: '2026-09-30T14:30',
      note: 'Garanti Bonus 3 Taksit'
    },
    {
      id: 'tx-4',
      type: 'topup',
      stationId: 'shell-kadikoy',
      stationName: 'Shell Kadıköy',
      amount: 2000.00,
      liters: null,
      unitPrice: null,
      date: '2026-09-29T10:15',
      note: 'Yapı Kredi World'
    },
    {
      id: 'tx-5',
      type: 'topup',
      stationId: 'po-cevre',
      stationName: 'Petrol Ofisi Çevre Yolu',
      amount: 1000.00,
      liters: null,
      unitPrice: null,
      date: '2026-09-27T09:00',
      note: 'Nakit Avans'
    },
    {
      id: 'tx-6',
      type: 'expense',
      stationId: 'po-cevre',
      stationName: 'Petrol Ofisi Çevre Yolu',
      amount: 200.00,
      liters: 4.57,
      unitPrice: 43.75,
      date: '2026-09-28T18:00',
      note: 'Şehir içi'
    }
  ]
};

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  currency: 'TRY',
  volumeUnit: 'L'
};

export function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    stations: [],
    transactions: []
  };
}

// Local "YYYY-MM-DDTHH:mm" for datetime-local inputs and stored dates.
// toISOString() alone is UTC, which shifts Turkish times 3 hours back.
export function nowLocalISO(date = new Date()) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Money is rounded to kuruş on every write and summed as integers on read,
// so balances never drift by floating point leftovers.
export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

const toKurus = (value) => Math.round(Number(value || 0) * 100);

// Upgrades any older or partial shape to the current schema without dropping data.
export function migrateData(raw) {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
    stations: Array.isArray(raw.stations) ? raw.stations : [],
    transactions: Array.isArray(raw.transactions)
      ? raw.transactions.map((tx) => ({ ...tx, amount: roundMoney(tx.amount) }))
      : []
  };
}

// Checks an imported backup; returns { ok, data, error }.
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Dosya bir Hisapo yedeği değil.' };
  }
  if (!Array.isArray(parsed.stations) || !Array.isArray(parsed.transactions)) {
    return { ok: false, error: 'Yedekte istasyon veya işlem listesi yok.' };
  }
  const badStation = parsed.stations.find((s) => !s || !s.id || !s.name);
  if (badStation) {
    return { ok: false, error: 'Yedekte adı veya kimliği eksik bir istasyon var.' };
  }
  const badTx = parsed.transactions.find(
    (t) =>
      !t ||
      !t.id ||
      !t.stationId ||
      (t.type !== 'topup' && t.type !== 'expense') ||
      !Number.isFinite(Number(t.amount)) ||
      Number(t.amount) < 0
  );
  if (badTx) {
    return { ok: false, error: 'Yedekte hatalı bir işlem kaydı var (tür, istasyon veya tutar).' };
  }
  return { ok: true, data: migrateData(parsed) };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return migrateData(JSON.parse(raw));
  } catch (err) {
    console.error('Failed to load storage data, using fallback:', err);
    return emptyData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Newest first; ties keep insertion order (newer entries were prepended).
export function sortTransactions(transactions) {
  return transactions
    .map((tx, i) => ({ tx, i }))
    .sort((a, b) => {
      const diff = new Date(b.tx.date) - new Date(a.tx.date);
      return diff !== 0 ? diff : a.i - b.i;
    })
    .map(({ tx }) => tx);
}

// Calculate balances per station and total. Archived stations keep their
// history but are left out of the station list and the totals.
export function calculateBalances(stations, transactions) {
  const archivedIds = new Set(stations.filter((s) => s.archived).map((s) => s.id));
  const acc = {};

  stations.forEach((s) => {
    if (s.archived) return;
    acc[s.id] = { station: s, topups: 0, expenses: 0, balance: 0, lastActivity: null };
  });

  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach((tx) => {
    if (archivedIds.has(tx.stationId)) return;
    if (!acc[tx.stationId]) {
      acc[tx.stationId] = {
        station: { id: tx.stationId, name: tx.stationName, color: '#94a3b8' },
        topups: 0,
        expenses: 0,
        balance: 0,
        lastActivity: null
      };
    }
    const kurus = toKurus(tx.amount);
    if (tx.type === 'topup') {
      acc[tx.stationId].topups += kurus;
      acc[tx.stationId].balance += kurus;
    } else {
      acc[tx.stationId].expenses += kurus;
      acc[tx.stationId].balance -= kurus;
    }
    acc[tx.stationId].lastActivity = tx.date;
  });

  let totalBalance = 0;
  let totalTopup = 0;
  let totalExpense = 0;
  const stationBalances = {};

  Object.entries(acc).forEach(([id, s]) => {
    totalBalance += s.balance;
    totalTopup += s.topups;
    totalExpense += s.expenses;
    stationBalances[id] = {
      ...s,
      topups: s.topups / 100,
      expenses: s.expenses / 100,
      balance: s.balance / 100
    };
  });

  return {
    stationBalances,
    totalBalance: totalBalance / 100,
    totalTopup: totalTopup / 100,
    totalExpense: totalExpense / 100
  };
}

// Human label for a transaction's type in lists and exports.
export function transactionLabel(tx) {
  if (tx.kind === 'opening') return 'Açılış Bakiyesi';
  if (tx.kind === 'adjustment') return 'Bakiye Düzeltme';
  return tx.type === 'expense' ? 'Depo Dolumu' : 'Avans Yüklendi';
}

// Turkish Excel opens ";" separated files with comma decimals; the BOM keeps ş, ğ, ı intact.
export function buildCSV(transactions) {
  const num = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = [
    'Tarih', 'Tür', 'İstasyon', 'Plaka', 'Tutar', 'Litre', 'Birim Fiyat',
    'Yakıt', 'Ödeme', 'Fiş No', 'Not', 'Kayıt No'
  ];
  const rows = transactions.map((t) =>
    [
      cell(t.date ? t.date.replace('T', ' ') : ''),
      cell(transactionLabel(t)),
      cell(t.stationName),
      cell(t.plate || ''),
      cell(num(t.type === 'expense' ? -roundMoney(t.amount) : roundMoney(t.amount))),
      cell(num(t.liters)),
      cell(num(t.unitPrice)),
      cell(t.fuelType || ''),
      cell(t.paymentMethod || ''),
      cell(t.receiptNo || ''),
      cell(t.note || ''),
      cell(t.id)
    ].join(';')
  );
  return '\uFEFF' + [header.map(cell).join(';'), ...rows].join('\r\n');
}

// Format currency
export function formatTL(amount) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

// Format date
export function formatTRDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return isoString;
  }
}

export const FUEL_TYPES = ['Benzin', 'Motorin', 'LPG', 'Elektrik'];
export const PAYMENT_METHODS = ['Nakit', 'Kredi kartı', 'Banka kartı', 'Havale / EFT', 'Diğer'];
export const DEFAULT_LOW_BALANCE = 300;

// Latest expense details for a station, used to prefill the pump-side form.
export function lastExpenseAt(transactions, stationId) {
  const expenses = sortTransactions(
    transactions.filter((t) => t.type === 'expense' && t.stationId === stationId && !t.kind)
  );
  if (expenses.length === 0) return null;
  const withPrice = expenses.find((t) => t.unitPrice);
  return {
    amount: expenses[0].amount,
    unitPrice: withPrice ? withPrice.unitPrice : null,
    fuelType: expenses[0].fuelType || null
  };
}

// A likely double entry: same receipt number at the station, or the same
// amount at the same station within 15 minutes.
export function findDuplicate(transactions, candidate) {
  const receipt = (candidate.receiptNo || '').trim();
  const at = new Date(candidate.date).getTime();
  return (
    transactions.find((t) => {
      if (t.id === candidate.id || t.stationId !== candidate.stationId || t.type !== candidate.type) return false;
      if (receipt && (t.receiptNo || '').trim() === receipt) return true;
      const sameAmount = roundMoney(t.amount) === roundMoney(candidate.amount);
      const close = Math.abs(new Date(t.date).getTime() - at) <= 15 * 60 * 1000;
      return sameAmount && close;
    }) || null
  );
}

export function lowBalanceLimit(station) {
  const v = Number(station?.lowBalanceThreshold);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_LOW_BALANCE;
}

// Days since the last backup, or null if never backed up.
export function daysSince(isoDate, now = new Date()) {
  if (!isoDate) return null;
  return Math.floor((now - new Date(isoDate)) / 86400000);
}

// "2026-10" → { from: '2026-10-01', to: '2026-10-31' }
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

// "2026-10-07" → "07.10.2026"
export function formatDay(day) {
  if (!day) return '';
  const [y, m, d] = day.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

// Period statement for one station between two days (inclusive, 'YYYY-MM-DD').
// Everything before `from` is carried over as the opening balance.
export function buildStatement(transactions, stationId, from, to) {
  const own = transactions
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.stationId === stationId)
    .sort((a, b) => {
      const diff = new Date(a.t.date) - new Date(b.t.date);
      return diff !== 0 ? diff : b.i - a.i;
    })
    .map(({ t }) => t);

  let balance = 0;
  let topups = 0;
  let expenses = 0;
  let liters = 0;
  let topupCount = 0;
  let expenseCount = 0;
  let opening = null;
  const rows = [];

  own.forEach((t) => {
    const day = (t.date || '').slice(0, 10);
    if (to && day > to) return;
    const kurus = toKurus(t.amount);
    const signed = t.type === 'topup' ? kurus : -kurus;
    if (from && day < from) {
      balance += signed;
      return;
    }
    if (opening === null) opening = balance;
    balance += signed;
    if (t.type === 'topup') {
      topups += kurus;
      topupCount += 1;
    } else {
      expenses += kurus;
      expenseCount += 1;
      liters += Number(t.liters) || 0;
    }
    rows.push({ tx: t, balance: balance / 100 });
  });

  if (opening === null) opening = balance;
  return {
    opening: opening / 100,
    topups: topups / 100,
    expenses: expenses / 100,
    closing: balance / 100,
    liters: Math.round(liters * 100) / 100,
    topupCount,
    expenseCount,
    rows
  };
}

// Plain-text statement for WhatsApp; *bold* is WhatsApp markup.
export function statementText(stationName, from, to, s, maxRows = 40) {
  const lines = [
    '*Hisapo · Dönem Ekstresi*',
    `İstasyon: ${stationName}`,
    `Dönem: ${formatDay(from)} – ${formatDay(to)}`,
    '',
    `Devir: ${formatTL(s.opening)}`,
    `+ Yüklenen: ${formatTL(s.topups)} (${s.topupCount} işlem)`,
    `− Tüketim: ${formatTL(s.expenses)} (${s.expenseCount} işlem${s.liters ? `, ${String(s.liters).replace('.', ',')} L` : ''})`,
    `*= Kapanış: ${formatTL(s.closing)}*`
  ];
  if (s.rows.length > 0 && s.rows.length <= maxRows) {
    lines.push('', 'Hareketler:');
    s.rows.forEach(({ tx, balance }) => {
      const sign = tx.type === 'topup' ? '+' : '−';
      const extra = [tx.plate, tx.receiptNo && `Fiş ${tx.receiptNo}`].filter(Boolean).join(' · ');
      lines.push(
        `${formatDay(tx.date)} ${tx.date.slice(11, 16)}  ${sign}${formatTL(tx.amount)}${extra ? `  ${extra}` : ''}  → ${formatTL(balance)}`
      );
    });
  }
  return lines.join('\n');
}

// Free-text search over the fields a user would remember.
export function matchesSearch(tx, query) {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return true;
  const hay = [
    tx.stationName, tx.plate, tx.receiptNo, tx.note, tx.fuelType, tx.paymentMethod,
    transactionLabel(tx), String(tx.amount), String(tx.amount).replace('.', ',')
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR');
  return hay.includes(q);
}

// Group an already-sorted list into [{ day, items, topups, expenses }].
export function groupByDay(transactions) {
  const groups = [];
  transactions.forEach((t) => {
    const day = (t.date || '').slice(0, 10);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, items: [], topups: 0, expenses: 0 };
      groups.push(g);
    }
    g.items.push(t);
    if (t.type === 'topup') g.topups = roundMoney(g.topups + Number(t.amount));
    else g.expenses = roundMoney(g.expenses + Number(t.amount));
  });
  return groups;
}
