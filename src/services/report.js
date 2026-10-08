import { roundMoney, formatTL, formatDay } from './storage';
import { periodConsumption, highFills, formatKm, formatL100 } from './consumption';

// Monthly fuel report for the fleet: purchases grouped by vehicle (plate) or by the person who entered them.

export const REPORT_GROUPS = {
  plate: { label: 'Araç', none: 'Plakasız', key: (t) => t.plate || '' },
  person: { label: 'Kişi', none: 'Bilinmiyor', key: (t) => t.enteredBy || '' },
  station: { label: 'İstasyon', none: 'İstasyonsuz', key: (t) => t.stationName || '' }
};

const inPeriod = (t, from, to) => {
  const day = String(t.date || '').slice(0, 10);
  return day >= from && day <= to;
};

export function buildFleetReport(transactions, from, to, by = 'plate') {
  const group = REPORT_GROUPS[by];
  const purchases = transactions.filter((t) => t.type === 'expense' && !t.kind && inPeriod(t, from, to));
  const map = new Map();
  purchases.forEach((t) => {
    const key = group.key(t);
    const g = map.get(key) || { key, label: key || group.none, count: 0, amount: 0, liters: 0, pricedAmount: 0, stations: new Set() };
    g.count += 1;
    g.amount += Number(t.amount || 0);
    if (Number(t.liters) > 0) {
      g.liters += Number(t.liters);
      g.pricedAmount += Number(t.amount || 0);
    }
    if (t.stationName) g.stations.add(t.stationName);
    map.set(key, g);
  });
  const total = purchases.reduce((s, t) => s + Number(t.amount || 0), 0);
  // Vehicles only: km driven, L/100 km and purchases flagged as unusually high
  const usage = by === 'plate' ? periodConsumption(transactions, from, to) : new Map();
  const flagged = by === 'plate' ? highFills(transactions) : new Map();
  const rows = [...map.values()]
    .map((g) => ({
      key: g.key,
      label: by === 'person' && g.key ? g.key.split('@')[0] : g.label,
      fullLabel: g.label,
      count: g.count,
      amount: roundMoney(g.amount),
      liters: Math.round(g.liters * 100) / 100,
      // Average price only over purchases where litres were recorded
      avgPrice: g.liters > 0 ? roundMoney(g.pricedAmount / g.liters) : null,
      share: total > 0 ? Math.round((g.amount / total) * 1000) / 10 : 0,
      stations: [...g.stations].sort(),
      km: usage.get(g.key)?.km ?? null,
      l100: usage.get(g.key)?.l100 ?? null,
      high: by === 'plate' ? purchases.filter((t) => t.plate === g.key && g.key && flagged.has(t.id)).length : 0
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, 'tr'));
  return {
    rows,
    purchases,
    total: roundMoney(total),
    liters: Math.round(purchases.reduce((s, t) => s + (Number(t.liters) > 0 ? Number(t.liters) : 0), 0) * 100) / 100,
    count: purchases.length
  };
}

const num = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Excel (Turkish locale) summary: one line per vehicle/person, then the total.
export function reportCSV(report, by, from, to) {
  const g = REPORT_GROUPS[by];
  const veh = by === 'plate';
  const lines = [
    [cell(`Hisapo yakıt raporu ${from} – ${to}`)],
    [],
    [g.label, 'İşlem', 'Tutar (TL)', 'Litre', 'Ort. TL/L', 'Pay %', 'İstasyonlar', ...(veh ? ['Km', 'L/100 km', 'Yüksek alış'] : [])].map(cell),
    ...report.rows.map((r) =>
      [
        r.fullLabel, r.count, num(r.amount), num(r.liters || ''), num(r.avgPrice ?? ''), num(r.share), r.stations.join(', '),
        ...(veh ? [r.km ?? '', num(r.l100 ?? ''), r.high || ''] : [])
      ].map(cell)
    ),
    ['Toplam', report.count, num(report.total), num(report.liters || ''), '', '100', ''].map(cell)
  ];
  return '﻿' + lines.map((l) => l.join(';')).join('\r\n');
}

export function reportText(report, by, from, to) {
  const g = REPORT_GROUPS[by];
  const head = `⛽ Yakıt raporu (${g.label.toLowerCase()} bazında)\n${formatDay(from)} – ${formatDay(to)}\n`;
  const body = report.rows
    .slice(0, 30)
    .map(
      (r) =>
        `• ${r.fullLabel}: ${formatTL(r.amount)}${r.liters ? ` · ${num(r.liters)} L` : ''} (${r.count} işlem)` +
        (r.km ? `\n   ${formatKm(r.km)} · ${formatL100(r.l100)}` : '') +
        (r.high ? `\n   ⚠ ${r.high} yüksek tüketimli alış` : '')
    )
    .join('\n');
  return `${head}\n${body}\n\nToplam: ${formatTL(report.total)} · ${report.count} işlem`;
}
