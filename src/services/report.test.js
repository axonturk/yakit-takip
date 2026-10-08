import { describe, it, expect } from 'vitest';
import { buildFleetReport, reportCSV, reportText } from './report';

const tx = (id, amount, extra = {}) => ({ id, type: 'expense', amount, date: '2026-10-05T10:00', stationName: 'Opet', ...extra });
const txs = [
  tx('1', 1000, { plate: '34 ABC 12', liters: 20, enteredBy: 'ali@x.com' }),
  tx('2', 500, { plate: '34 ABC 12', enteredBy: 'ali@x.com', stationName: 'Shell' }),
  tx('3', 1500, { plate: '06 XYZ 99', liters: 30, enteredBy: 'veli@x.com' }),
  tx('4', 200, {}),
  tx('5', 9999, { plate: '34 ABC 12', date: '2026-09-30T23:59' }),
  { id: '6', type: 'topup', amount: 5000, date: '2026-10-02T10:00', plate: '34 ABC 12' },
  tx('7', 300, { kind: 'adjustment', plate: '34 ABC 12' })
];

describe('fleet report', () => {
  it('groups the period\'s purchases by plate', () => {
    const r = buildFleetReport(txs, '2026-10-01', '2026-10-31', 'plate');
    expect(r.total).toBe(3200);
    expect(r.count).toBe(4);
    expect(r.liters).toBe(50);
    expect(r.rows.map((x) => [x.label, x.count, x.amount])).toEqual([
      ['34 ABC 12', 2, 1500],
      ['06 XYZ 99', 1, 1500],
      ['Plakasız', 1, 200]
    ].sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], 'tr')));
    const abc = r.rows.find((x) => x.label === '34 ABC 12');
    expect(abc.avgPrice).toBe(50);
    expect(abc.stations).toEqual(['Opet', 'Shell']);
    expect(abc.share).toBe(46.9);
  });

  it('groups by person with short names', () => {
    const r = buildFleetReport(txs, '2026-10-01', '2026-10-31', 'person');
    expect(r.rows.map((x) => x.label).sort()).toEqual(['Bilinmiyor', 'ali', 'veli']);
    expect(r.rows.find((x) => x.label === 'ali').fullLabel).toBe('ali@x.com');
  });

  it('exports a Turkish Excel summary and a WhatsApp text', () => {
    const r = buildFleetReport(txs, '2026-10-01', '2026-10-31', 'plate');
    const csv = reportCSV(r, 'plate', '2026-10-01', '2026-10-31');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"34 ABC 12";"2";"1500";"20";"50";"46,9";"Opet, Shell"');
    expect(csv).toContain('"Toplam";"4";"3200";"50"');
    expect(reportText(r, 'plate', '2026-10-01', '2026-10-31')).toContain('Toplam:');
  });
});

describe('vehicle consumption in the report', () => {
  const f = (id, day, odometer, liters) => ({
    id, type: 'expense', plate: '34 ABC 12', stationName: 'Opet', odometer, liters, amount: liters * 45, date: `2026-10-${day}T10:00`
  });
  const txs = [f('a', '01', 10000, 40), f('b', '03', 10400, 40), f('c', '05', 10800, 40), f('d', '07', 11200, 40), f('e', '09', 11400, 30)];

  it('adds km, L/100 km and high fills per vehicle', () => {
    const r = buildFleetReport(txs, '2026-10-01', '2026-10-31', 'plate');
    expect(r.rows[0]).toMatchObject({ km: 1400, l100: 10.7, high: 1 });
    const csv = reportCSV(r, 'plate', '2026-10-01', '2026-10-31');
    expect(csv).toContain('"Km";"L/100 km";"Yüksek alış"');
    expect(csv).toContain('"1400";"10,7";"1"');
    expect(reportText(r, 'plate', '2026-10-01', '2026-10-31')).toContain('1.400 km · 10,7 L/100 km');
  });

  it('leaves vehicle columns out of other groupings', () => {
    const r = buildFleetReport(txs, '2026-10-01', '2026-10-31', 'station');
    expect(r.rows[0]).toMatchObject({ km: null, l100: null, high: 0 });
    expect(reportCSV(r, 'station', '2026-10-01', '2026-10-31')).not.toContain('L/100');
  });
});
