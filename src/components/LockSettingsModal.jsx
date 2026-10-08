import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { LOCK_DELAYS, checkPin, makeLock, validPin } from '../services/lock';
import { t } from '../i18n';

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-white tracking-[0.4em] text-center focus:outline-none focus:border-amber-400';
const primary =
  'w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50';
const secondary =
  'w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition disabled:opacity-50';

const digits = (v) => v.replace(/\D/g, '').slice(0, 6);

function PinInput({ value, onChange, placeholder }) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(digits(e.target.value))}
      className={inputClass}
    />
  );
}

function DelayPicker({ value, onChange }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400 mb-1">{t('Arka plana geçince ne zaman kilitlensin?')}</div>
      <div className="grid grid-cols-4 gap-1.5">
        {LOCK_DELAYS.map((d) => (
          <button
            key={d.minutes}
            type="button"
            onClick={() => onChange(d.minutes)}
            className={`py-2 rounded-lg text-[11px] font-semibold border transition ${
              value === d.minutes
                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {t(d.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LockSettingsModal({ isOpen, onClose, cfg, onChange, onLockNow, hasCloud }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar p-5 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t('Uygulama kilidi')}</h2>
              <p className="text-[10px] text-slate-400">{cfg ? t('Açık') : t('Kapalı')} · {t('telefonu başkası açınca kayıtlar gizli kalır')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4">
          {cfg ? (
            <LockOn cfg={cfg} onChange={onChange} onLockNow={onLockNow} onClose={onClose} />
          ) : (
            <LockOff onChange={onChange} hasCloud={hasCloud} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function LockOff({ onChange, hasCloud, onClose }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [after, setAfter] = useState(1);
  const mismatch = pin2.length >= pin.length && pin2 !== pin && pin2.length > 0;

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        onChange(await makeLock(pin, after));
        onClose();
      }}
    >
      <p className="text-xs text-slate-300">{t('4 ile 6 haneli bir PIN seç. Uygulama her açıldığında PIN sorulur.')}</p>
      <PinInput value={pin} onChange={setPin} placeholder={t('Yeni PIN')} />
      <PinInput value={pin2} onChange={setPin2} placeholder={t('PIN tekrar')} />
      {mismatch && <p className="text-[11px] text-red-300">{t('PIN\'ler aynı değil.')}</p>}
      <DelayPicker value={after} onChange={setAfter} />
      <p
        className={`text-[11px] rounded-lg p-2 border ${
          hasCloud
            ? 'text-slate-300 bg-slate-800/60 border-slate-700/60'
            : 'text-amber-200 bg-amber-500/10 border-amber-500/30'
        }`}
      >
        {hasCloud
          ? t('PIN\'i unutursan kayıtların bulut yedeğinden geri gelir.')
          : t('PIN\'i unutursan kilidi kaldırmak için bu telefondaki kayıtlar silinir. Önce bulut yedeği açmanı ya da yedek dosyası almanı öneririz.')}
      </p>
      <button type="submit" className={primary} disabled={!validPin(pin) || pin !== pin2}>
        {t('Kilidi aç')}
      </button>
    </form>
  );
}

function LockOn({ cfg, onChange, onLockNow, onClose }) {
  const [mode, setMode] = useState(null); // null | 'change' | 'remove'
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState(null);

  const verify = async () => {
    if (await checkPin(cfg, current)) return true;
    setErr(t('Mevcut PIN yanlış.'));
    return false;
  };

  if (mode) {
    return (
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (!(await verify())) return;
          onChange(mode === 'remove' ? null : await makeLock(pin, cfg.after));
          onClose();
        }}
      >
        <PinInput value={current} onChange={setCurrent} placeholder={t('Mevcut PIN')} />
        {mode === 'change' && (
          <>
            <PinInput value={pin} onChange={setPin} placeholder={t('Yeni PIN')} />
            <PinInput value={pin2} onChange={setPin2} placeholder={t('Yeni PIN tekrar')} />
          </>
        )}
        {err && <p className="text-[11px] text-red-300">{err}</p>}
        <button
          type="submit"
          className={primary}
          disabled={current.length < 4 || (mode === 'change' && (!validPin(pin) || pin !== pin2))}
        >
          {mode === 'remove' ? t('Kilidi kaldır') : t('PIN\'i değiştir')}
        </button>
        <button type="button" onClick={() => setMode(null)} className="w-full text-[11px] text-slate-400 hover:text-slate-200">
          {t('Vazgeç')}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <DelayPicker value={cfg.after ?? 1} onChange={(after) => onChange({ ...cfg, after })} />
      <button
        className={primary}
        onClick={() => {
          onClose();
          onLockNow();
        }}
      >
        {t('Şimdi kilitle')}
      </button>
      <button className={secondary} onClick={() => setMode('change')}>
        {t('PIN\'i değiştir')}
      </button>
      <button className={secondary} onClick={() => setMode('remove')}>
        {t('Kilidi kaldır')}
      </button>
    </div>
  );
}
