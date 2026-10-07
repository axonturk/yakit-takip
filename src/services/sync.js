// Record-level sync between the local ledger and the cloud `records` table.
// Each station and transaction is one row; a per-device map of content hashes
// tells which records changed locally since the last sync.

export const recordKey = (kind, id) => `${kind}:${id}`;

// Stable stringify so the same object always hashes the same.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function hashRecord(obj) {
  const s = stable(obj);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${s.length}`;
}

export function localRecords(data) {
  const out = new Map();
  data.stations.forEach((s) => out.set(recordKey('station', s.id), { kind: 'station', id: s.id, data: s }));
  data.transactions.forEach((t) => out.set(recordKey('tx', t.id), { kind: 'tx', id: t.id, data: t }));
  return out;
}

// What this device must send: new or changed records, and deletions of records
// that were synced before but are gone locally.
export function diffLocal(data, synced) {
  const upserts = [];
  const deletes = [];
  const local = localRecords(data);
  local.forEach((rec, key) => {
    if (synced[key] !== hashRecord(rec.data)) upserts.push(rec);
  });
  Object.keys(synced).forEach((key) => {
    if (!local.has(key)) {
      const i = key.indexOf(':');
      deletes.push({ kind: key.slice(0, i), id: key.slice(i + 1) });
    }
  });
  return { upserts, deletes };
}

export function dirtyKeys(data, synced) {
  const { upserts, deletes } = diffLocal(data, synced);
  return new Set([...upserts, ...deletes].map((r) => recordKey(r.kind, r.id)));
}

// Apply rows pulled from the cloud. Records changed locally and not yet pushed
// are left alone (local wins; the push that follows sends them).
export function applyRemote(data, rows, synced) {
  const dirty = dirtyKeys(data, synced);
  const stations = [...data.stations];
  const transactions = [...data.transactions];
  const nextSynced = { ...synced };
  let changed = false;

  rows.forEach((row) => {
    const key = recordKey(row.kind, row.id);
    if (dirty.has(key)) return;
    const list = row.kind === 'station' ? stations : transactions;
    const idx = list.findIndex((r) => r.id === row.id);
    if (row.deleted) {
      if (idx !== -1) {
        list.splice(idx, 1);
        changed = true;
      }
      delete nextSynced[key];
      return;
    }
    const h = hashRecord(row.data);
    if (idx === -1) {
      // New transactions go first, like locally added ones
      if (row.kind === 'tx') list.unshift(row.data);
      else list.push(row.data);
      changed = true;
    } else if (hashRecord(list[idx]) !== h) {
      list[idx] = row.data;
      changed = true;
    }
    nextSynced[key] = h;
  });

  return { data: changed ? { ...data, stations, transactions } : data, synced: nextSynced, changed };
}

// After a successful push, remember what the cloud now holds.
export function markPushed(synced, upserts, deletes) {
  const next = { ...synced };
  upserts.forEach((r) => (next[recordKey(r.kind, r.id)] = hashRecord(r.data)));
  deletes.forEach((r) => delete next[recordKey(r.kind, r.id)]);
  return next;
}
