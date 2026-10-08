import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { pushState, enablePush, disablePush, needsInstallFirst, PushSetupError } from '../services/push';
import { t } from '../i18n';

// Managers turn on phone notifications for the shared ledger: another person's purchase,
// low station balance, a driver over the monthly limit.
export default function PushToggle({ workspaceId }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    pushState(workspaceId).then((s) => alive && setState(s), () => alive && setState('off'));
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  if (state === 'loading') return null;

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (state === 'on') {
        await disablePush();
        setState('off');
      } else {
        await enablePush(workspaceId);
        setState('on');
      }
    } catch (e) {
      const reason = e instanceof PushSetupError ? e.message : '';
      if (reason === 'permission') {
        setError(t('Bildirim izni verilmedi. Telefon ayarlarından Hisapo için bildirimlere izin verip tekrar dene.'));
        if (Notification.permission === 'denied') setState('blocked');
      } else if (reason === 'server') {
        setError(t('Bildirim servisi henüz kurulmadı. Kurulum bitince bu düğme çalışacak.'));
      } else {
        setError(t('Bildirimler açılamadı: {error}', { error: e?.message || '' }));
      }
    } finally {
      setBusy(false);
    }
  };

  const on = state === 'on';
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
            {on ? <Bell className="w-3.5 h-3.5 text-amber-300" /> : <BellOff className="w-3.5 h-3.5" />} {t('Bildirimler')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {t('Ekipten biri harcama girince, istasyon bakiyesi azalınca ve şoför aylık limiti aşınca bu telefona bildirim gelir.')}
          </div>
        </div>
        {state !== 'unsupported' && state !== 'blocked' && !needsInstallFirst() && (
          <button
            onClick={toggle}
            disabled={busy}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition disabled:opacity-50 ${
              on ? 'bg-slate-900 border-slate-600 text-slate-200' : 'bg-amber-500 border-amber-400 text-slate-950'
            }`}
          >
            {busy ? '…' : on ? t('Kapat') : t('Aç')}
          </button>
        )}
      </div>
      {state === 'unsupported' && <p className="text-[10px] text-slate-500">{t('Bu tarayıcı bildirimleri desteklemiyor.')}</p>}
      {state === 'blocked' && (
        <p className="text-[10px] text-amber-300">{t('Bildirimler bu telefonda engelli. Telefon ayarlarından Hisapo için bildirimlere izin ver.')}</p>
      )}
      {state !== 'unsupported' && needsInstallFirst() && (
        <p className="text-[10px] text-amber-300">{t('iPhone\'da bildirim için önce Hisapo\'yu ana ekrana ekle, oradan aç.')}</p>
      )}
      {error && <p className="text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
