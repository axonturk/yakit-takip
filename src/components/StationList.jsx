import React from 'react';
import { formatTL, formatTRDate } from '../services/storage';
import { Plus, ChevronRight, CreditCard, Fuel, Sliders, Trash2 } from 'lucide-react';
import StationLogo from './StationLogo';

export default function StationList({
  stationBalances,
  selectedStationFilter,
  onSelectStationFilter,
  onOpenAddStation,
  onOpenTopupForStation,
  onOpenExpenseForStation,
  onOpenAdjustBalance,
  onDeleteStation
}) {
  const list = Object.values(stationBalances);
  const selectedStationObj = list.find(s => s.station.id === selectedStationFilter);

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5 px-1">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <span>İstasyon Bakiyeleri</span>
          {selectedStationFilter && (
            <button
              onClick={() => onSelectStationFilter(null)}
              className="text-[10px] text-amber-400 font-normal hover:underline ml-1"
            >
              (Filtreyi Temizle)
            </button>
          )}
        </h2>
        <button
          onClick={onOpenAddStation}
          className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>İstasyon Ekle</span>
        </button>
      </div>

      {selectedStationObj && (
        <div className="mb-2.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold truncate">Aktif: {selectedStationObj.station.name}</span>
          </div>
          <span className="text-[10px] text-slate-400 shrink-0">Pompa / Bakiye buna işler</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {list.map(({ station, balance, lastActivity }) => {
          const isSelected = selectedStationFilter === station.id;
          const isNegative = balance < 0;
          const isLow = balance < 300 && !isNegative;

          return (
            <div
              key={station.id}
              onClick={() => onSelectStationFilter(isSelected ? null : station.id)}
              className={`p-3 rounded-2xl border cursor-pointer transition text-left flex flex-col justify-between relative overflow-hidden ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                  : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <StationLogo
                    name={station.name}
                    brand={station.brand}
                    className="w-8 h-8 shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-100 block truncate">
                      {station.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {station.brand || 'İstasyon'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">
                    {isNegative ? 'Borç / Eksi:' : 'Kalan Bakiye:'}
                  </span>
                  {isNegative && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-semibold border border-rose-500/30">
                      EKSİDE
                    </span>
                  )}
                </div>
                <div className={`text-base font-black tracking-tight ${
                  isNegative ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {formatTL(balance)}
                </div>
              </div>

              {lastActivity && (
                <div className="text-[9px] text-slate-500 mt-1">
                  Son: {formatTRDate(lastActivity)}
                </div>
              )}

              {/* Quick actions if selected */}
              {isSelected && (
                <div
                  className="mt-2.5 pt-2 border-t border-amber-500/30 space-y-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-1">
                    <button
                      onClick={() => onOpenTopupForStation && onOpenTopupForStation(station.id)}
                      className="flex-1 py-1.5 px-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[9px] font-bold flex items-center justify-center gap-0.5 shadow transition"
                      title="Bakiye Yükle"
                    >
                      <CreditCard className="w-2.5 h-2.5" />
                      <span>+ Bakiye</span>
                    </button>
                    <button
                      onClick={() => onOpenExpenseForStation && onOpenExpenseForStation(station.id)}
                      className="flex-1 py-1.5 px-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[9px] font-bold flex items-center justify-center gap-0.5 shadow transition"
                      title="Harcama Düş"
                    >
                      <Fuel className="w-2.5 h-2.5" />
                      <span>- Harca</span>
                    </button>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => onOpenAdjustBalance && onOpenAdjustBalance(station.id)}
                      className="flex-1 py-1 px-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 rounded-lg text-[9px] font-medium flex items-center justify-center gap-1 transition"
                      title="Bakiyeyi Düzelt / Eşitle"
                    >
                      <Sliders className="w-2.5 h-2.5 text-amber-400" />
                      <span>Bakiyeyi Düzelt</span>
                    </button>
                    <button
                      onClick={() => onDeleteStation && onDeleteStation(station.id)}
                      className="py-1 px-2 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 rounded-lg text-[9px] font-medium flex items-center justify-center gap-1 transition"
                      title="İstasyonu Sil"
                    >
                      <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      <span>Sil</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
