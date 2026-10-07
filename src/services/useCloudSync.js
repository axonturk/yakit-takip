import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient, cloudWasUsed, loadMeta, saveMeta, pullRecords, pushRecords, myMembership, uploadPhoto, downloadPhoto } from './cloud';
import { getPhoto, listPhotoIds, setRemotePhotoSource } from './photos';
import { applyRemote, diffLocal, markPushed, driverMayPush, dropRecords, newFromOthers, recordKey } from './sync';
import { reportError } from './telemetry';

// Re-read rows a little older than the last pull, so a change committed just
// before our previous pull finished is not missed. Re-applying is a no-op.
const OVERLAP_MS = 5 * 60 * 1000;
// Photos are sent a few per sync so a long backlog never holds up the ledger itself.
const PHOTOS_PER_SYNC = 5;

// Upload receipt photos this device has and the cloud does not. Returns the updated "uploaded" map.
export async function pushPhotos(workspaceId, transactions, uploaded) {
  const local = new Set(await listPhotoIds().catch(() => []));
  const todo = transactions
    .map((t) => t.photoId)
    .filter((id) => id && local.has(id) && !uploaded[id])
    .slice(0, PHOTOS_PER_SYNC);
  const next = { ...uploaded };
  for (const id of todo) {
    const blob = await getPhoto(id);
    if (!blob) continue;
    await uploadPhoto(workspaceId, id, blob);
    next[id] = 1;
  }
  return next;
}

export default function useCloudSync(data, setData) {
  const [session, setSession] = useState(null);
  const [meta, setMetaState] = useState(loadMeta);
  const [status, setStatus] = useState('idle'); // idle | syncing | ok | error | offline
  const [error, setError] = useState(null);
  const [photoError, setPhotoError] = useState(null);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const metaRef = useRef(meta);
  const busy = useRef(false);
  const again = useRef(false);

  const setMeta = useCallback((next) => {
    metaRef.current = next;
    saveMeta(next);
    setMetaState(next);
  }, []);

  // Load the cloud client only if this device uses the cloud or the user opens the cloud screen.
  const [wanted, setWanted] = useState(cloudWasUsed);
  const activate = useCallback(() => setWanted(true), []);

  useEffect(() => {
    if (!wanted) return undefined;
    let sub = null;
    let cancelled = false;
    getClient().then((client) => {
      if (cancelled) return;
      client.auth.getSession().then(({ data: d }) => !cancelled && setSession(d.session));
      sub = client.auth.onAuthStateChange((_e, s) => setSession(s)).data.subscription;
    });
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [wanted]);

  const userId = session?.user?.id || null;
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  const workspaceId = session ? meta.workspaceId : null;
  const active = Boolean(workspaceId) && !data.isSample;

  const syncNow = useCallback(async () => {
    const m = { ...metaRef.current };
    if (!m.workspaceId || dataRef.current.isSample) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    busy.current = true;
    setStatus('syncing');
    try {
      // Role, plate, limit and codes can change on the server (or the owner removed us)
      const mine = await myMembership(m.workspaceId);
      if (!mine) {
        setMeta({ removedFrom: m.workspaceName || 'defter' });
        setStatus('idle');
        return;
      }
      const role = mine.role;
      Object.assign(m, {
        role,
        plate: mine.plate || null,
        monthlyLimit: mine.monthly_limit === null ? null : Number(mine.monthly_limit),
        workspaceName: mine.workspaces?.name || m.workspaceName,
        inviteCode: mine.workspaces?.invite_code || m.inviteCode,
        driverCode: mine.workspaces?.driver_code || m.driverCode,
        setupOutdated: Boolean(mine.outdated)
      });
      const uid = userIdRef.current;

      const since = m.lastPulledAt ? new Date(new Date(m.lastPulledAt).getTime() - OVERLAP_MS).toISOString() : null;
      let synced = m.synced || {};
      let pullFrom = since;
      // Safety net: a wiped or replaced local ledger (cleared sample, restored backup)
      // must not delete the shared one. Forget sync history and merge instead.
      const pending = diffLocal(dataRef.current, synced);
      const syncedCount = Object.keys(synced).length;
      const localCount = dataRef.current.stations.length + dataRef.current.transactions.length;
      const wiped = localCount === 0 && syncedCount > 0;
      if (wiped || (pending.deletes.length > 10 && pending.deletes.length > syncedCount / 2)) {
        synced = {};
        pullFrom = null;
      }
      // A driver's local changes to anything but their own purchases are dropped and re-read from the cloud
      if (role === 'driver') {
        const blocked = new Set(
          diffLocal(dataRef.current, synced)
            .upserts.filter((rec) => !driverMayPush(rec, uid))
            .map((rec) => recordKey(rec.kind, rec.id))
        );
        if (blocked.size) {
          const cleaned = dropRecords(dataRef.current, blocked);
          dataRef.current = cleaned;
          setData(cleaned);
          synced = Object.fromEntries(Object.entries(synced).filter(([k]) => !blocked.has(k)));
          pullFrom = null;
        }
      }
      const rows = await pullRecords(m.workspaceId, pullFrom);
      let unseen = m.unseen || [];
      if (rows.length > 0) {
        const before = dataRef.current;
        const r = applyRemote(before, rows, synced);
        synced = r.synced;
        if (r.changed) {
          dataRef.current = r.data;
          setData(r.data);
          // Purchases other people entered show up as news for the owner and managers
          if (role !== 'driver' && m.lastSyncAt) {
            const fresh = newFromOthers(before, r.data, uid).filter((t) => t.type === 'expense').map((t) => t.id);
            unseen = [...new Set([...unseen, ...fresh])].slice(-50);
          }
        }
      }
      const { upserts, deletes } = diffLocal(dataRef.current, synced);
      if (upserts.length || deletes.length) {
        await pushRecords(m.workspaceId, upserts, deletes);
        synced = markPushed(synced, upserts, deletes);
      }
      // Photos last: a failure here (e.g. storage not set up yet) must not block the ledger
      let photosUp = m.photosUp || {};
      try {
        photosUp = await pushPhotos(m.workspaceId, dataRef.current.transactions, photosUp);
        setPhotoError(null);
      } catch (e) {
        setPhotoError(e.message);
        reportError(`Fotoğraf yükleme: ${e.message}`);
      }
      const lastPulledAt = rows.length ? rows[rows.length - 1].updated_at : m.lastPulledAt;
      // The user may have switched or left the workspace while this sync ran
      if (metaRef.current.workspaceId !== m.workspaceId) return;
      setMeta({ ...metaRef.current, ...m, synced, unseen, photosUp, lastPulledAt, lastSyncAt: new Date().toISOString() });
      setError(null);
      setStatus('ok');
    } catch (e) {
      setError(e.message);
      setStatus(navigator.onLine ? 'error' : 'offline');
      if (navigator.onLine) reportError(`Eşitleme: ${e.message}`, e.stack);
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(syncNow, 500);
      }
    }
  }, [setData, setMeta]);

  // Photos entered on other phones are fetched when someone opens them
  useEffect(() => {
    if (!active) {
      setRemotePhotoSource(null);
      return undefined;
    }
    setRemotePhotoSource(async (photoId) => {
      const blob = await downloadPhoto(workspaceId, photoId);
      // Already in the cloud, so this device never needs to upload it
      if (blob && metaRef.current.workspaceId === workspaceId) {
        setMeta({ ...metaRef.current, photosUp: { ...(metaRef.current.photosUp || {}), [photoId]: 1 } });
      }
      return blob;
    });
    return () => setRemotePhotoSource(null);
  }, [active, workspaceId, setMeta]);

  // Sync on start, shortly after every local change, on focus/online, and every minute.
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(syncNow, 2500);
    return () => clearTimeout(t);
  }, [active, data, syncNow]);

  useEffect(() => {
    if (!active) return undefined;
    const onWake = () => syncNow();
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    const iv = setInterval(syncNow, 60000);
    return () => {
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      clearInterval(iv);
    };
  }, [active, syncNow]);

  // Switching workspace starts a fresh sync history for this device.
  // A driver starts from the shared ledger only: local records are not merged into it.
  const chooseWorkspace = useCallback(
    (ws, role = null) => {
      if (role === 'driver') {
        const cleared = { ...dataRef.current, stations: [], transactions: [], isSample: false };
        dataRef.current = cleared;
        setData(cleared);
      }
      setMeta({
        workspaceId: ws.id,
        workspaceName: ws.name,
        inviteCode: ws.invite_code,
        driverCode: ws.driver_code,
        role,
        synced: {},
        lastPulledAt: null
      });
    },
    [setMeta, setData]
  );

  const markSeen = useCallback(() => setMeta({ ...metaRef.current, unseen: [] }), [setMeta]);

  // Who entered a new record, stored on the record itself for lists and reports
  const stamp = useCallback(
    () => (session && metaRef.current.workspaceId ? { enteredBy: session.user.email, enteredById: session.user.id } : {}),
    [session]
  );

  const leave = useCallback(() => {
    setMeta({});
    setStatus('idle');
  }, [setMeta]);

  return {
    session,
    email: session?.user?.email || null,
    workspaceId,
    workspaceName: meta.workspaceName,
    inviteCode: meta.inviteCode,
    driverCode: meta.driverCode,
    role: workspaceId ? meta.role || 'member' : null,
    plate: meta.plate || null,
    monthlyLimit: meta.monthlyLimit ?? null,
    unseen: workspaceId ? meta.unseen || [] : [],
    removedFrom: meta.removedFrom || null,
    setupOutdated: Boolean(meta.setupOutdated),
    userId,
    lastSyncAt: meta.lastSyncAt,
    status: active ? status : 'idle',
    error,
    photoError,
    syncNow,
    activate,
    chooseWorkspace,
    markSeen,
    stamp,
    leave,
    setMeta
  };
}
