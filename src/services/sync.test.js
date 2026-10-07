import { describe, it, expect } from 'vitest';
import { diffLocal, applyRemote, markPushed, hashRecord, recordKey, driverMayPush, dropRecords, newFromOthers } from './sync';

const data = (stations, transactions) => ({ schemaVersion: 2, settings: {}, stations, transactions });
const st = (id, name = id) => ({ id, name });
const tx = (id, amount, extra = {}) => ({ id, type: 'expense', stationId: 's1', amount, date: '2026-10-07T10:00', ...extra });

describe('sync', () => {
  it('hashes regardless of key order and ignores undefined', () => {
    expect(hashRecord({ a: 1, b: 2 })).toBe(hashRecord({ b: 2, a: 1, c: undefined }));
    expect(hashRecord({ a: 1 })).not.toBe(hashRecord({ a: 2 }));
  });

  it('sends everything the first time, nothing after marking pushed', () => {
    const d = data([st('s1')], [tx('t1', 100)]);
    const first = diffLocal(d, {});
    expect(first.upserts.map((r) => r.id)).toEqual(['s1', 't1']);
    const synced = markPushed({}, first.upserts, first.deletes);
    expect(diffLocal(d, synced)).toEqual({ upserts: [], deletes: [] });
  });

  it('detects edits and deletions', () => {
    const d = data([st('s1')], [tx('t1', 100), tx('t2', 50)]);
    const synced = markPushed({}, diffLocal(d, {}).upserts, []);
    const edited = data([st('s1')], [tx('t1', 120)]);
    const { upserts, deletes } = diffLocal(edited, synced);
    expect(upserts.map((r) => r.id)).toEqual(['t1']);
    expect(deletes).toEqual([{ kind: 'tx', id: 't2' }]);
  });

  it('applies remote adds, edits and deletes', () => {
    const d = data([st('s1')], [tx('t1', 100), tx('t2', 50)]);
    const synced = markPushed({}, diffLocal(d, {}).upserts, []);
    const rows = [
      { kind: 'tx', id: 't3', data: tx('t3', 70), deleted: false },
      { kind: 'tx', id: 't1', data: tx('t1', 999), deleted: false },
      { kind: 'tx', id: 't2', data: null, deleted: true },
      { kind: 'station', id: 's2', data: st('s2'), deleted: false }
    ];
    const r = applyRemote(d, rows, synced);
    expect(r.changed).toBe(true);
    expect(r.data.transactions.map((t) => [t.id, t.amount])).toEqual([['t3', 70], ['t1', 999]]);
    expect(r.data.stations.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(r.synced[recordKey('tx', 't2')]).toBeUndefined();
    // Applied rows count as synced: nothing to push back
    expect(diffLocal(r.data, r.synced)).toEqual({ upserts: [], deletes: [] });
  });

  it('keeps unsynced local edits over remote ones', () => {
    const d = data([st('s1')], [tx('t1', 100)]);
    const synced = markPushed({}, diffLocal(d, {}).upserts, []);
    const local = data([st('s1')], [tx('t1', 150)]);
    const r = applyRemote(local, [{ kind: 'tx', id: 't1', data: tx('t1', 999), deleted: false }], synced);
    expect(r.data.transactions[0].amount).toBe(150);
    expect(diffLocal(r.data, r.synced).upserts.map((x) => x.id)).toEqual(['t1']);
  });

  it('is a no-op when pulling its own pushed rows', () => {
    const d = data([st('s1')], [tx('t1', 100)]);
    const { upserts } = diffLocal(d, {});
    const synced = markPushed({}, upserts, []);
    const r = applyRemote(d, upserts.map((u) => ({ ...u, deleted: false })), synced);
    expect(r.changed).toBe(false);
    expect(r.data).toBe(d);
  });

  it('lets a driver push only their own fuel purchases', () => {
    const mine = { kind: 'tx', id: 'a', data: tx('a', 10, { enteredById: 'u1' }) };
    expect(driverMayPush(mine, 'u1')).toBe(true);
    expect(driverMayPush(mine, 'u2')).toBe(false);
    expect(driverMayPush({ kind: 'tx', id: 'b', data: tx('b', 10, { type: 'topup', enteredById: 'u1' }) }, 'u1')).toBe(false);
    expect(driverMayPush({ kind: 'tx', id: 'c', data: tx('c', 10, { kind: 'adjustment', enteredById: 'u1' }) }, 'u1')).toBe(false);
    expect(driverMayPush({ kind: 'station', id: 's1', data: st('s1') }, 'u1')).toBe(false);
    expect(driverMayPush({ kind: 'tx', id: 'd', data: tx('d', 10) }, null)).toBe(false);
  });

  it('drops records by key and finds new ones from others', () => {
    const d = data([st('s1'), st('s2')], [tx('t1', 1), tx('t2', 2)]);
    const dropped = dropRecords(d, new Set([recordKey('station', 's2'), recordKey('tx', 't1')]));
    expect(dropped.stations.map((s) => s.id)).toEqual(['s1']);
    expect(dropped.transactions.map((t) => t.id)).toEqual(['t2']);
    expect(dropRecords(d, new Set())).toBe(d);
    const after = data([st('s1')], [tx('t3', 3, { enteredById: 'u2' }), tx('t4', 4, { enteredById: 'u1' }), tx('t5', 5), ...d.transactions]);
    expect(newFromOthers(d, after, 'u1').map((t) => t.id)).toEqual(['t3']);
  });
});
