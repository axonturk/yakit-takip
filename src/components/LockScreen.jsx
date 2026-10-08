import React, { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import logo from '../assets/logo.png';
import { checkPin, saveLock, waitAfterFails } from '../services/lock';
import { t } from '../i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LockScreen({ cfg, onUnlock, hasCloud, onReset }) {
  const [pin, setPin] = useState('');
  const [fails, setFails] = useState(cfg.fails || 0);
  const [until, setUntil] = useState(cfg.until || 0);
  const [now, setNow] = useState(() => Date.now());
  const [shake, setShake] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const waiting = until > now;

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  const press = async (k) => {
    if (waiting) return;
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (!k) return;
    const next = (pin + k).slice(0, cfg.len || 6);
    setPin(next);
    if (next.length < (cfg.len || 4)) return;
    if (await checkPin(cfg, next)) {
      saveLock({ ...cfg, fails: 0, until: 0 });
      onUnlock();
      return;
    }
    const f = fails + 1;
    const u = Date.now() + waitAfterFails(f);
    setFails(f);
    setUntil(u);
    setNow(Date.now());
    saveLock({ ...cfg, fails: f, until: u });
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin('');
    }, 400);
  };

  if (forgot) {
    // "Type DELETE to confirm": the word is bold, so split the sentence around it
    const word = t('SİL');
    const [before, after] = t('Onaylamak için {word} yaz', { word: '\u0000' }).split('\u0000');
    const typed = confirmText.trim();
    const confirmed = /^s[iıİI]l$/i.test(typed) || typed.toLowerCase() === word.toLowerCase();
    return (
      <Shell>
        <div className="w-full max-w-xs space-y-3 text-left">
          <h2 className="text-sm font-bold text-white">{t('PIN\'i unuttum')}</h2>
          <p className="text-xs text-slate-300">
            {hasCloud
              ? t('Kilidi kaldırmak için bu telefondaki kayıtlar silinir. Bulut yedeğin olduğu için tekrar giriş yapınca kayıtların geri gelir. Son dakikalarda girilen ve henüz eşitlenmemiş kayıtlar kaybolabilir.')
              : t('Kilidi kaldırmanın tek yolu bu telefondaki kayıtları silmek. Bulut yedeğin yok; yedek dosyan da yoksa kayıtlar geri gelmez.')}
          </p>
          <label className="block text-[11px] text-slate-400">
            {before}
            <b className="text-slate-200">{word}</b>
            {after}
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-red-400"
          />
          <button
            disabled={!confirmed}
            onClick={onReset}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-40"
          >
            {t('Kayıtları sil ve kilidi kaldır')}
          </button>
          <button onClick={() => setForgot(false)} className="w-full text-[11px] text-slate-400 hover:text-slate-200">
            {t('Vazgeç')}
          </button>
        </div>
      </Shell>
    );
  }

  const secondsLeft = Math.ceil((until - now) / 1000);

  return (
    <Shell>
      <div className="flex items-center gap-1.5 text-xs text-slate-300">
        <Lock className="w-3.5 h-3.5" /> {t('PIN\'ini gir')}
      </div>
      <div className={`flex gap-3 my-5 ${shake ? 'animate-[shake_0.4s]' : ''}`}>
        {Array.from({ length: cfg.len || 4 }).map((_, i) => (
          <span
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 ${i < pin.length ? 'bg-amber-400 border-amber-400' : 'border-slate-500'}`}
          />
        ))}
      </div>
      <div className="h-4 text-[11px] text-red-300 mb-2">
        {waiting
          ? t('Çok fazla yanlış deneme. {n} sn bekle.', { n: secondsLeft })
          : fails >= 3
            ? t('Yanlış PIN ({n}. deneme)', { n: fails })
            : fails > 0
              ? t('Yanlış PIN')
              : ''}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => press(k)}
              disabled={waiting}
              aria-label={k === 'del' ? t('Sil') : k}
              className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 active:bg-slate-600 text-white text-xl font-semibold flex items-center justify-center transition disabled:opacity-40"
            >
              {k === 'del' ? <Delete className="w-5 h-5" /> : k}
            </button>
          )
        )}
      </div>
      <button onClick={() => setForgot(true)} className="mt-6 text-[11px] text-slate-400 hover:text-slate-200">
        {t('PIN\'i unuttum')}
      </button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <img src={logo} alt="Hisapo" className="w-16 h-16 rounded-2xl shadow-lg mb-3" />
      <div className="text-base font-bold text-white mb-4">Hisapo</div>
      {children}
    </div>
  );
}
