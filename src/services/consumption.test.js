import { describe, it, expect } from 'vitest';
import { checkFill, highFills, lastOdometer, periodConsumption, formatKm, formatL100 } from './consumption';

const fill = (id, date, odometer, liters, plate = '34 ABC 12') => ({
  id, type: 'expense', plate, odometer, liters, amount: liters * 45, date: `2026-10-${date}T10:00`
});

// 10 L/100 km steady, then a fill of 30 L for 200 km (15 L/100 km).
const txs = [
  fill('a', '01', 10000, 40),
  fill('b', '03', 10400, 40),
  fill('c', '05', 10800, 40),
  fill('d', '07', 11200, 40),
  fill('e', '09', 11400, 30),
  fill('x', '04', 50000, 60, '06 XYZ 99'),
  { id: 'top', type: 'topup', amount: 5000, date: '2026-10-01T09:00' }
];

describe('consumption', () => {
  it('finds the last km of a plate', () => {
    expect(lastOdometer(txs, '34 ABC 12')).toBe(11400);
    expect(lastOdometer(txs, '34 ABC 12', '2026-10-06T00:00')).toBe(10800);
    expect(lastOdometer(txs, 'YOK')).toBeNull();
    expect(lastOdometer(txs, '')).toBeNull();
  });

  it('flags only the fill well above the vehicle average', () => {
    const flagged = highFills(txs);
    expect([...flagged.keys()]).toEqual(['e']);
    expect(flagged.get('e')).toEqual({ l100: 15, avg: 10, pct: 50 });
  });

  it('checks a new fill against the previous km and the average', () => {
    expect(checkFill(txs, { plate: '34 ABC 12', odometer: 11300, liters: 20, date: '2026-10-10T10:00' })).toEqual({ lower: true, prevKm: 11400 });
    expect(checkFill(txs, { plate: '34 ABC 12', odometer: 11800, liters: 40, date: '2026-10-10T10:00' })).toEqual({ distance: 400, l100: 10, avg: 10 });
    expect(checkFill(txs, { plate: '34 ABC 12', odometer: 11500, liters: 30, date: '2026-10-10T10:00' }).high).toBe(200);
    expect(checkFill(txs, { plate: '06 XYZ 99', odometer: 50500, liters: 40, date: '2026-10-10T10:00' })).toEqual({ distance: 500, l100: 8 });
    expect(checkFill(txs, { plate: '34 ABC 12', odometer: '', liters: 40, date: '2026-10-10T10:00' })).toBeNull();
    // editing a saved fill leaves itself out of the comparison
    expect(checkFill(txs, { id: 'e', plate: '34 ABC 12', odometer: 11400, liters: 30, date: '2026-10-09T10:00' }).high).toBe(50);
  });

  it('sums km and consumption for a period', () => {
    const p = periodConsumption(txs, '2026-10-04', '2026-10-31');
    expect(p.get('34 ABC 12')).toEqual({ km: 1000, l100: 11 });
    expect(p.has('06 XYZ 99')).toBe(false);
  });

  it('formats km and L/100 km', () => {
    expect(formatKm(125400)).toBe('125.400 km');
    expect(formatL100(10.5)).toBe('10,5 L/100 km');
  });
});
