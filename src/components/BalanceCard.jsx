import React from 'react';
import { formatTL } from '../services/storage';
import { CreditCard, Fuel, TrendingUp, TrendingDown } from 'lucide-react';

export default function BalanceCard({
  totalBalance,
  totalTopup,
  totalExpense,
  stationCount,
  onOpenExpense,
  onOpenTopup
}) {
  return (
    <div className="space-y-3">
      {/* Hero Card */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl relative overflow-hidden">
        {/* Subtle glow / watermark */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-center mb-1">
          <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
            totalBalance < 0 ? 'text-rose-400' : 'text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              totalBalance < 0 ? 'bg-rose-400' : 'bg-amber-400'
            } animate-pulse`} />
            {totalBalance < 0 ? 'Toplam Borç / Eksi Bakiye' : 'Toplam Kalan Avans Bakiyesi'}
          </span>
          <span className="text-[11px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full font-medium">
            {stationCount} İstasyon
          </span>
        </div>

        <div className={`text-3xl font-extrabold tracking-tight my-1 ${
          totalBalance < 0 ? 'text-rose-400' : 'text-white'
        }`}>
          {formatTL(totalBalance)}
        </div>

        <p className="text-[11px] text-slate-400">
          {totalBalance < 0
            ? 'İstasyonlara olan toplam kapatılması gereken borç / eksi bakiye tutarı'
            : 'İstasyonlara önceden ödenmiş ve depoya aktarılmayı bekleyen toplam bakiye'}
        </p>

        {/* Small stats row */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Toplam Yüklenen</div>
              <div className="font-bold text-emerald-400">{formatTL(totalTopup)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Toplam Harcanan</div>
              <div className="font-bold text-red-400">{formatTL(totalExpense)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className={`grid gap-2 ${onOpenTopup ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          onClick={onOpenExpense}
          className="py-3 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/40 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          <Fuel className="w-4 h-4 stroke-[2.2]" />
          <span>- HARCAMA GİR</span>
        </button>

        {onOpenTopup && (
        <button
          onClick={onOpenTopup}
          className="py-3 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          <CreditCard className="w-4 h-4 stroke-[2.2]" />
          <span>+ BAKİYE YÜKLE</span>
        </button>
        )}
      </div>
    </div>
  );
}
