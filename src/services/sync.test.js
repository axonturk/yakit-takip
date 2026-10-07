import { describe, it, expect } from 'vitest';
import { diffLocal, applyRemote, markPushed, hashRecord, recordKey } from './sync';

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
});
