import { describe, it, expect } from 'vitest';
import { memberMonthSpend, permissions } from './team';

const now = new Date(2026, 9, 15).getTime();
const txs = [
  { type: 'expense', amount: 500, date: '2026-10-02T10:00', enteredById: 'd1' },
  { type: 'expense', amount: 250.5, date: '2026-10-14T10:00', enteredById: 'd1' },
  { type: 'expense', amount: 999, date: '2026-09-30T23:00', enteredById: 'd1' },
  { type: 'topup', amount: 5000, date: '2026-10-03T10:00', enteredById: 'd1' },
  { type: 'expense', amount: 70, date: '2026-10-03T10:00', enteredById: 'd2' }
];

describe('team', () => {
  it('sums a person\'s fuel purchases this month', () => {
    expect(memberMonthSpend(txs, 'd1', now)).toBe(750.5);
    expect(memberMonthSpend(txs, 'nobody', now)).toBe(0);
  });

  it('lets a driver change only their own purchases', () => {
    const p = permissions('driver', 'd1');
    expect(p.manage).toBe(false);
    expect(p.changeTx(txs[0])).toBe(true);
    expect(p.changeTx(txs[3])).toBe(false);
    expect(p.changeTx(txs[4])).toBe(false);
    expect(p.changeTx({ type: 'expense', kind: 'adjustment', enteredById: 'd1' })).toBe(false);
    const owner = permissions('owner', 'o1');
    expect(owner.manage).toBe(true);
    expect(owner.changeTx(txs[4])).toBe(true);
  });
});
