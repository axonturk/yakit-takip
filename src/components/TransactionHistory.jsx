import React, { useState } from 'react';
import { formatTL, formatTRDate } from '../services/storage';
import { Trash2, Download } from 'lucide-react';
import StationLogo from './StationLogo';

export default function TransactionHistory({
  transactions,
  stations,
  selectedStationFilter,
  onSelectStationFilter,
  onDeleteTransaction
}) {
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'expense', 'topup'

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    if (selectedStationFilter && tx.stationId !== selectedStationFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    return true;
  });

  // Calculate filtered totals
  const filteredExpenses = filtered
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const filteredTopups = filtered
    .filter(t => t.type === 'topup')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const handleExportCSV = () => {
    const headers = ['ID,Tur,Istasyon,Tutar,Litre,BirimFiyat,TarihSaat,Not\n'];
    const rows = filtered.map(t =>
      `"${t.id}","${t.type === 'expense' ? 'Harcama' : 'Avans Yükleme'}","${t.stationName}","${t.amount}","${t.liters || ''}","${t.unitPrice || ''}","${t.date}","${(t.note || '').replace(/"/g, '""')}"`
    );
    const blob = new Blob([headers.concat(rows.join('\n'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yakit_ekstresi_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* Title & CSV Download */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            İşlem Geçmişi & Hareketler
          </h2>
          <p className="text-[10px] text-slate-400">
            {filtered.length} kayıt listeleniyor
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Excel/CSV</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
        <button
          onClick={() => setTypeFilter('all')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            typeFilter === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tümü ({transactions.length})
        </button>
        <button
          onClick={() => setTypeFilter('expense')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            typeFilter === 'expense'
              ? 'bg-red-500/20 text-red-300 shadow-sm border border-red-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Harcamalar
        </button>
        <button
          onClick={() => setTypeFilter('topup')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition ${
            typeFilter === 'topup'
              ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Avanslar (+)
        </button>
      </div>

      {/* Filter summary strip */}
      <div className="flex justify-between items-center px-3 py-2 bg-slate-800/40 border border-slate-800 rounded-xl text-[11px]">
        <span className="text-slate-400">Bu filtrenin toplamı:</span>
        <div className="flex gap-3">
          <span className="text-emerald-400 font-bold">+{formatTL(filteredTopups)}</span>
          <span className="text-red-400 font-bold">-{formatTL(filteredExpenses)}</span>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-850/50 rounded-2xl border border-slate-800">
            Henüz bu kritere uygun işlem bulunmuyor.
          </div>
        ) : (
          filtered.map((tx) => {
            const isExpense = tx.type === 'expense';

            return (
              <div
                key={tx.id}
                className="bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between transition group"
              >
                {/* Left brand logo & station */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <StationLogo
                      name={tx.stationName}
                      className="w-10 h-10"
                    />
                    {/* Badge indicator on bottom right of logo */}
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-slate-900 ${
                        isExpense ? 'bg-red-500 text-white' : 'bg-emerald-500 text-slate-950'
                      }`}
                    >
                      {isExpense ? '−' : '+'}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <span>{tx.stationName}</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        ({formatTRDate(tx.date)})
                      </span>
                    </div>

                    {/* Sub info */}
                    <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                      {isExpense && tx.liters && (
                        <span>
                          ⛽ <strong className="text-slate-200">{tx.liters} L</strong>
                          {tx.unitPrice ? ` @ ₺${tx.unitPrice}/L` : ''}
                        </span>
                      )}
                      {tx.note && <span className="italic text-slate-400">“{tx.note}”</span>}
                    </div>
                  </div>
                </div>

                {/* Right amount & delete */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div
                      className={`text-sm font-extrabold ${
                        isExpense ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}
                      {formatTL(tx.amount)}
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {isExpense ? 'Depo Dolumu' : 'Avans Yüklendi'}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
                        onDeleteTransaction(tx.id);
                      }
                    }}
                    title="İşlemi Sil"
                    className="p-1.5 text-slate-600 hover:text-red-400 opacity-60 group-hover:opacity-100 transition rounded-lg hover:bg-slate-700/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
