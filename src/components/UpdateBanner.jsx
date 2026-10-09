import React, { useEffect, useState } from 'react';
import { t } from '../i18n';
import { hasNewVersion } from '../services/updateCheck';

const CHECK_EVERY = 30 * 60 * 1000;

// Shows "new version ready" when a newer deploy is live, checked when the app comes to the front.
export default function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let lastCheck = 0;
    const check = () => {
      if (document.hidden || !navigator.onLine) return;
      if (Date.now() - lastCheck < 60 * 1000) return;
      lastCheck = Date.now();
      hasNewVersion().then((yes) => yes && setReady(true)).catch(() => {});
    };
    check();
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!ready) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[60] max-w-md mx-auto">
      <div className="bg-amber-500 text-slate-950 rounded-xl shadow-2xl px-4 py-2.5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold">{t('Yeni sürüm hazır.')}</span>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 bg-slate-950 text-amber-400 text-xs font-bold rounded-lg px-3 py-1.5"
        >
          {t('Yenile')}
        </button>
      </div>
    </div>
  );
}
