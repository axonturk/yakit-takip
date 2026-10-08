import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Languages, X } from 'lucide-react';
import { LANGUAGES, CURRENCIES, UNITS, getLang, getCurrency, getUnits, saveLocale, t } from '../i18n';
import { updatePushLocale } from '../services/push';

// Language and currency for this phone. Saving reloads the app so every screen picks it up.
// Drawn on <body>: the header's backdrop blur would otherwise trap this fixed overlay inside it.
export default function LocaleModal({ onClose }) {
  const [lang, setLang] = useState(getLang());
  const [currency, setCurrency] = useState(getCurrency());
  const [units, setUnits] = useState(getUnits());

  const handleSave = async () => {
    if (lang === getLang() && currency === getCurrency() && units === getUnits()) return onClose();
    saveLocale({ lang, currency, units });
    // Notifications are written on the server in the phone's language; give it a moment, never block on it
    await Promise.race([updatePushLocale(lang, currency, units).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
    window.location.reload();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Languages className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">{t('Dil, para birimi ve birimler')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 space-y-4">
          <Choice label={t('Dil')} options={LANGUAGES} value={lang} onChange={setLang} />
          <Choice label={t('Para birimi')} options={CURRENCIES} value={currency} onChange={setCurrency} />
          <Choice label={t('Birimler')} options={UNITS.map((u) => ({ ...u, label: t(u.label) }))} value={units} onChange={setUnits} />
          <p className="text-[11px] text-slate-500">
            {t('İlk açılışta telefonun ülkesine göre seçilir. Değiştirmek sadece gösterimi değiştirir; kayıtlı tutar ve miktarlar çevrilmez.')}
          </p>
          <button
            onClick={handleSave}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition"
          >
            {t('Kaydet')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Choice({ label, options, value, onChange }) {
  return (
    <div>
      <div className="text-[11px] text-slate-400 mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`py-2 px-2 rounded-xl text-xs border transition ${
              value === o.id
                ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-semibold'
                : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
