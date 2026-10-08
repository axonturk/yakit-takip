import React from 'react';
import { AlertTriangle, Gauge } from 'lucide-react';
import { formatKm, formatL100 } from '../services/consumption';

// Odometer input shown next to the plate; the vehicle's last km is the hint.
export default function KmField({ value, onChange, lastKm, disabled }) {
  return (
    <div>
      <label className="block text-[11px] text-slate-400 mb-1">
        Km sayacı <span className="text-[10px] text-slate-500">(Opsiyonel)</span>
      </label>
      <input
        type="number"
        inputMode="numeric"
        step="1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={disabled ? 'Önce plaka' : lastKm ? `Son: ${lastKm}` : 'Örn: 125400'}
        disabled={disabled}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 disabled:opacity-50"
      />
      {lastKm && !disabled && <div className="text-[10px] text-slate-500 mt-0.5">Son kayıt: {formatKm(lastKm)}</div>}
    </div>
  );
}

// What this fill means for the vehicle: km driven, L/100 km, and a warning when it looks too high.
export function FillNotice({ check }) {
  if (!check) return null;
  if (check.lower) {
    return (
      <Box tone="red">
        Km, bu aracın son kaydından ({formatKm(check.prevKm)}) düşük. Sayaç doğru mu?
      </Box>
    );
  }
  if (!check.l100) {
    return <Box tone="slate">Son alıştan beri {formatKm(check.distance)} yol.</Box>;
  }
  if (check.high) {
    return (
      <Box tone="amber">
        Bu alış normalden <b>%{check.high} fazla</b>: {formatL100(check.l100)} (bu aracın ortalaması{' '}
        {formatL100(check.avg)}). Litre ve km'yi kontrol et.
      </Box>
    );
  }
  return (
    <Box tone="slate">
      {formatKm(check.distance)} yol · {formatL100(check.l100)}
      {check.avg ? ` (ortalama ${formatL100(check.avg)})` : ''}
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
