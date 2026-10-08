import React from 'react';
import { AlertTriangle, Gauge } from 'lucide-react';
import { formatKm, formatL100 } from '../services/consumption';
import { t } from '../i18n';

// Odometer input shown next to the plate; the vehicle's last km is the hint.
export default function KmField({ value, onChange, lastKm, disabled }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-400 mb-1">
        {t('Km sayacı')} <span className="text-[10px] text-slate-500">{t('(Opsiyonel)')}</span>
      </label>
      <input
        type="number"
        inputMode="numeric"
        step="1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={disabled ? t('Önce plaka') : lastKm ? t('Son: {v}', { v: lastKm }) : t('Örn: {v}', { v: 125400 })}
        disabled={disabled}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 disabled:opacity-50"
      />
      {lastKm && !disabled && <div className="text-[10px] text-slate-500 mt-0.5">{t('Son kayıt: {v}', { v: formatKm(lastKm) })}</div>}
    </div>
  );
}

// What this fill means for the vehicle: km driven, L/100 km, and a warning when it looks too high.
export function FillNotice({ check }) {
  if (!check) return null;
  if (check.lower) {
    return (
      <Box tone="red">
        {t('Km, bu aracın son kaydından ({v}) düşük. Sayaç doğru mu?', { v: formatKm(check.prevKm) })}
      </Box>
    );
  }
  if (!check.l100) {
    return <Box tone="slate">{t('Son alıştan beri {v} yol.', { v: formatKm(check.distance) })}</Box>;
  }
  if (check.high) {
    return (
      <Box tone="amber">
        {t('Bu alış normalden')} <b>{t('%{n} fazla', { n: check.high })}</b>:{' '}
        {t('{v} (bu aracın ortalaması {avg}). Litre ve km\'yi kontrol et.', { v: formatL100(check.l100), avg: formatL100(check.avg) })}
      </Box>
    );
  }
  return (
    <Box tone="slate">
      {t('{v} yol', { v: formatKm(check.distance) })} · {formatL100(check.l100)}
      {check.avg ? ' ' + t('(ortalama {v})', { v: formatL100(check.avg) }) : ''}
    </Box>
  );
}

const TONES = {
  red: 'bg-red-500/10 border-red-500/30 text-red-200',
  amber: 'bg-amber-500/10 border-amber-500/40 text-amber-200',
  slate: 'bg-slate-800/60 border-slate-700/60 text-slate-300'
};

function Box({ tone, children }) {
  const Icon = tone === 'slate' ? Gauge : AlertTriangle;
  return (
    <div className={`text-[11px] rounded-xl p-2 border flex items-start gap-1.5 ${TONES[tone]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
