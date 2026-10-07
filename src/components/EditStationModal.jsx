import React, { useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { lowBalanceLimit } from '../services/storage';

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400';

export default function EditStationModal({ station, onClose, onSave }) {
  if (!station) return null;
  return <EditStationForm key={station.id} station={station} onClose={onClose} onSave={onSave} />;
}

function EditStationForm({ station, onClose, onSave }) {
  const [name, setName] = useState(station.name);
  const [threshold, setThreshold] = useState(String(lowBalanceLimit(station)));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const t = parseFloat(threshold);
    onSave(station.id, {
      name: name.trim(),
      lowBalanceThreshold: Number.isFinite(t) && t >= 0 ? t : lowBalanceLimit(station)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Settings2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">İstasyonu Düzenle</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">İstasyon Adı</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Düşük bakiye uyarısı (TL)</label>
            <input
              type="number"
              inputMode="decimal"
              step="1"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={inputClass}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Bakiye bu tutarın altına inince istasyon sarı görünür ve ana sayfada uyarı çıkar.
            </p>
          </div>
          <button
            type="submit"
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition active:scale-[0.98]"
          >
            KAYDET
          </button>
        </form>
      </div>
    </div>
  );
}
