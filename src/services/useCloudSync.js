import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient, cloudWasUsed, loadMeta, saveMeta, pullRecords, pushRecords } from './cloud';
import { applyRemote, diffLocal, markPushed } from './sync';
import { reportError } from './telemetry';

// Re-read rows a little older than the last pull, so a change committed just
// before our previous pull finished is not missed. Re-applying is a no-op.
const OVERLAP_MS = 5 * 60 * 1000;

export default function useCloudSync(data, setData) {
  const [session, setSession] = useState(null);
  const [meta, setMetaState] = useState(loadMeta);
  const [status, setStatus] = useState('idle'); // idle | syncing | ok | error | offline
  const [error, setError] = useState(null);

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

  const workspaceId = session ? meta.workspaceId : null;
  const active = Boolean(workspaceId) && !data.isSample;

  const syncNow = useCallback(async () => {
    const m = metaRef.current;
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
      const rows = await pullRecords(m.workspaceId, pullFrom);
      if (rows.length > 0) {
        const r = applyRemote(dataRef.current, rows, synced);
        synced = r.synced;
        if (r.changed) {
          dataRef.current = r.data;
          setData(r.data);
        }
      }
      const { upserts, deletes } = diffLocal(dataRef.current, synced);
      if (upserts.length || deletes.length) {
        await pushRecords(m.workspaceId, upserts, deletes);
        synced = markPushed(synced, upserts, deletes);
      }
      const lastPulledAt = rows.length ? rows[rows.length - 1].updated_at : m.lastPulledAt;
      setMeta({ ...metaRef.current, synced, lastPulledAt, lastSyncAt: new Date().toISOString() });
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
  const chooseWorkspace = useCallback(
    (ws) => setMeta({ workspaceId: ws.id, workspaceName: ws.name, inviteCode: ws.invite_code, synced: {}, lastPulledAt: null }),
    [setMeta]
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
    lastSyncAt: meta.lastSyncAt,
    status: active ? status : 'idle',
    error,
    syncNow,
    activate,
    chooseWorkspace,
    leave,
    setMeta
  };
}
