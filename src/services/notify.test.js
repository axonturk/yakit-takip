import { describe, it, expect } from 'vitest';
import { eventsFor as rawEvents, render } from '../../supabase/functions/notify/index.ts';

const NOW = new Date('2026-10-08T12:00');
const eventsFor = (tx, ctx) => rawEvents(tx, { now: NOW, ...ctx });
const tx = (id, amount, extra = {}) => ({
  id, type: 'expense', stationId: 's1', stationName: 'Opet Maslak', amount, date: '2026-10-08T10:00', enteredBy: 'ali@x.com', enteredById: 'u2', ...extra
});
const topup = (amount) => ({ id: 'tp', type: 'topup', stationId: 's1', stationName: 'Opet Maslak', amount, date: '2026-10-08T09:00', enteredBy: 'fatih@x.com' });

describe('push notification events', () => {
  it('tells managers about a purchase, with plate and liters', () => {
    const t = tx('a', 1200, { plate: '34 ABC 12', liters: 26.5 });
    const ev = eventsFor(t, { txs: [topup(5000), t], station: { id: 's1' }, driver: { role: 'driver' } });
    expect(ev.map((e) => e.type)).toEqual(['purchase']);
    expect(render(ev[0], 'tr', 'TRY')).toEqual({ title: '⛽ 34 ABC 12: ₺1.200', body: 'Opet Maslak · 26,5 L · ali' });
    expect(render(ev[0], 'en', 'INR').body).toBe('Opet Maslak · 26.5 L · ali');
  });

  it('warns once when the balance drops below the warning level', () => {
    const a = tx('a', 4500);
    const ev = eventsFor(a, { txs: [topup(5000), a], station: { id: 's1', lowBalanceThreshold: 1000 } });
    expect(ev.map((e) => e.type)).toEqual(['purchase', 'low']);
    expect(render(ev[1], 'tr', 'TRY').body).toContain('₺500');
    const b = tx('b', 100);
    expect(eventsFor(b, { txs: [topup(5000), a, b], station: { id: 's1', lowBalanceThreshold: 1000 } }).map((e) => e.type)).toEqual(['purchase']);
  });

  it('warns when the balance goes below zero', () => {
    const a = tx('a', 600);
    const ev = eventsFor(a, { txs: [topup(500), a], station: { id: 's1' } });
    expect(ev.map((e) => e.type)).toEqual(['purchase', 'owed']);
    expect(render(ev[1], 'en', 'USD').title).toBe('⚠️ Opet Maslak balance is below zero');
  });

  it('tells managers when a driver goes over the monthly limit', () => {
    const a = tx('a', 1500);
    const b = tx('b', 1000);
    const ev = eventsFor(b, { txs: [topup(50000), a, b], station: { id: 's1' }, driver: { role: 'driver', monthlyLimit: 2000 } });
    expect(ev.map((e) => e.type)).toEqual(['purchase', 'limit']);
    expect(render(ev[1], 'tr', 'TRY')).toEqual({ title: '🚫 ali aylık limiti aştı', body: 'Bu ay: ₺2.500 / ₺2.000' });
    // Already over: no repeat
    const c = tx('c', 100);
    expect(eventsFor(c, { txs: [topup(50000), a, b, c], station: { id: 's1' }, driver: { role: 'driver', monthlyLimit: 2000 } }).map((e) => e.type)).toEqual(['purchase']);
  });

  it('skips opening balances and corrections', () => {
    expect(eventsFor(tx('a', 100, { kind: 'adjustment' }), { txs: [], station: null })).toEqual([]);
  });

  it('ignores old records uploaded for the first time', () => {
    const old = tx('a', 100, { date: '2026-09-01T10:00' });
    expect(eventsFor(old, { txs: [old], station: null })).toEqual([]);
  });

  it('reports top-ups', () => {
    const ev = eventsFor(topup(10000), { txs: [topup(10000)], station: { id: 's1' } });
    expect(render(ev[0], 'en', 'USD')).toEqual({ title: '💰 Advance added: $10,000', body: 'Opet Maslak · fatih' });
  });
});
