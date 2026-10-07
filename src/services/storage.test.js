import { describe, it, expect } from 'vitest';
import {
  calculateBalances,
  sortTransactions,
  migrateData,
  validateBackup,
  buildCSV,
  nowLocalISO,
  roundMoney,
  SAMPLE_DATA,
  SCHEMA_VERSION
} from './storage';

const st = (id, extra = {}) => ({ id, name: id.toUpperCase(), ...extra });
const tx = (id, type, stationId, amount, date, extra = {}) => ({
  id,
  type,
  stationId,
  stationName: stationId.toUpperCase(),
  amount,
  date,
  ...extra
});

describe('calculateBalances', () => {
  it('sums top-ups and expenses per station without float drift', () => {
    const { stationBalances, totalBalance } = calculateBalances(
      [st('a')],
      [
        tx('1', 'topup', 'a', 0.1, '2026-10-01T10:00'),
        tx('2', 'topup', 'a', 0.2, '2026-10-01T11:00'),
        tx('3', 'expense', 'a', 0.3, '2026-10-01T12:00')
      ]
    );
    expect(stationBalances.a.balance).toBe(0);
    expect(totalBalance).toBe(0);
  });

  it('shows credit (veresiye) as a negative balance', () => {
    const { stationBalances } = calculateBalances(
      [st('a')],
      [tx('1', 'expense', 'a', 500, '2026-10-01T10:00')]
    );
    expect(stationBalances.a.balance).toBe(-500);
  });

  it('leaves archived stations out of the list and totals', () => {
    const { stationBalances, totalBalance } = calculateBalances(
      [st('a'), st('b', { archived: true })],
      [tx('1', 'topup', 'a', 100, '2026-10-01T10:00'), tx('2', 'topup', 'b', 900, '2026-10-01T10:00')]
    );
    expect(Object.keys(stationBalances)).toEqual(['a']);
    expect(totalBalance).toBe(100);
  });

  it('tracks the latest activity date even when entries are backdated', () => {
    const { stationBalances } = calculateBalances(
      [st('a')],
      [tx('new-entry', 'expense', 'a', 10, '2026-09-01T10:00'), tx('old-entry', 'topup', 'a', 50, '2026-10-01T10:00')]
    );
    expect(stationBalances.a.lastActivity).toBe('2026-10-01T10:00');
  });
});

describe('sortTransactions', () => {
  it('orders newest first by date, not by entry order', () => {
    const list = [
      tx('backdated', 'expense', 'a', 1, '2026-09-01T10:00'),
      tx('recent', 'expense', 'a', 1, '2026-10-05T10:00'),
      tx('middle', 'expense', 'a', 1, '2026-09-20T10:00')
    ];
    expect(sortTransactions(list).map((t) => t.id)).toEqual(['recent', 'middle', 'backdated']);
  });
});

describe('migrateData', () => {
  it('upgrades v1 data, keeps records and adds settings', () => {
    const v1 = { stations: [st('a')], transactions: [tx('1', 'topup', 'a', 10.005, '2026-10-01T10:00')] };
    const out = migrateData(v1);
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    expect(out.settings).toEqual({ currency: 'TRY', volumeUnit: 'L' });
    expect(out.stations).toHaveLength(1);
    expect(out.transactions[0].amount).toBe(10.01);
  });

  it('starts empty instead of loading sample data', () => {
    expect(migrateData(null).transactions).toEqual([]);
  });
});

describe('validateBackup', () => {
  it('accepts the sample data', () => {
    expect(validateBackup(SAMPLE_DATA).ok).toBe(true);
  });

  it('rejects files without lists', () => {
    expect(validateBackup({ foo: 1 }).ok).toBe(false);
  });

  it('rejects a transaction with an invalid amount', () => {
    const bad = { stations: [st('a')], transactions: [tx('1', 'topup', 'a', 'abc', '2026-10-01T10:00')] };
    expect(validateBackup(bad).ok).toBe(false);
  });
});

describe('buildCSV', () => {
  it('uses BOM, semicolons and comma decimals for Turkish Excel', () => {
    const csv = buildCSV([tx('1', 'expense', 'a', 1250.5, '2026-10-01T10:00', { liters: 28.4, plate: '34 ABC 12' })]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header.split(';')).toHaveLength(9);
    expect(row).toContain('"-1250,5"');
    expect(row).toContain('"28,4"');
    expect(row).toContain('"34 ABC 12"');
  });
});

describe('time and money helpers', () => {
  it('nowLocalISO keeps the local wall-clock time', () => {
    const d = new Date(2026, 9, 7, 14, 5);
    expect(nowLocalISO(d)).toBe('2026-10-07T14:05');
  });

  it('roundMoney rounds to kuruş', () => {
    expect(roundMoney(44.025)).toBeCloseTo(44.03, 2);
    expect(roundMoney('abc')).toBe(0);
  });
});
