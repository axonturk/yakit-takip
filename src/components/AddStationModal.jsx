import React, { useState } from 'react';
import { Fuel, X, Plus } from 'lucide-react';
import StationLogo, { BRAND_OPTIONS, BRAND_KEYS } from './StationLogo';
import { newId } from '../services/storage';

export default function AddStationModal({
  isOpen,
  onClose,
  onAddStation
}) {
  const [selectedBrand, setSelectedBrand] = useState(BRAND_KEYS.OPET);
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  const handleBrandSelect = (brandKey) => {
    setSelectedBrand(brandKey);
    const brandObj = BRAND_OPTIONS.find(b => b.key === brandKey);
    if (brandObj && (!name || BRAND_OPTIONS.some(b => name.startsWith(b.name)))) {
      setName(brandObj.name + ' ');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const brandObj = BRAND_OPTIONS.find(b => b.key === selectedBrand);

    const newStation = {
      id: newId('st'),
      name: name.trim(),
      brand: brandObj ? brandObj.name : 'İstasyon',
      color: brandObj ? brandObj.bg : '#3b82f6'
    };

    const initBal = parseFloat(initialBalance);
    onAddStation(newStation, !isNaN(initBal) && initBal !== 0 ? initBal : 0);

    setName('');
    setInitialBalance('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Yeni İstasyon Ekle</h2>
              <p className="text-[10px] text-slate-400">Türkiye'deki İstasyon Amblemini Seçin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {/* Brand Grid Selector */}
          <div>
            <label className="block text-[11px] text-slate-300 font-bold mb-2">
              İstasyon Markası / Amblemi Seçin:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {BRAND_OPTIONS.map((b) => {
                const isSelected = selectedBrand === b.key;
                return (
                  <button
                    type="button"
                    key={b.key}
                    onClick={() => handleBrandSelect(b.key)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 scale-105'
                        : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <StationLogo brand={b.key} name={b.name} className="w-10 h-10" />
                    <span className="text-[10px] font-medium text-slate-200 truncate w-full text-center">
                      {b.name}
                    </span>
                  </button>

                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 font-medium">İstasyon Tam Adı / Şubesi</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Opet Maslak, Shell Bostancı"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] text-slate-400 font-medium">
                Başlangıç Avans Bakiyesi (TL) <span className="text-slate-500">(Opsiyonel)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (initialBalance.startsWith('-')) {
                    setInitialBalance(initialBalance.slice(1));
                  } else if (initialBalance) {
                    setInitialBalance('-' + initialBalance);
                  }
                }}
                className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded font-mono transition"
                title="İşareti Değiştir (Eksi/Artı)"
              >
                ± Eksi / Artı
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="Varsa mevcut bakiye (örn: 2000 veya borç ise -500)"
              className={`w-full bg-slate-900 border rounded-xl p-2.5 text-xs text-white focus:outline-none ${
                parseFloat(initialBalance) < 0 ? 'border-rose-500 text-rose-300' : 'border-slate-700 focus:border-amber-400'
              }`}
            />
            {initialBalance && !isNaN(parseFloat(initialBalance)) && (
              <p className={`text-[10px] mt-1 font-medium ${
                parseFloat(initialBalance) < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {parseFloat(initialBalance) < 0
                  ? `İstasyon hesabı ${Math.abs(parseFloat(initialBalance))} TL eksi / borç ile başlatılacak.`
                  : `İstasyon hesabı ${parseFloat(initialBalance)} TL avans ile başlatılacak.`}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition active:scale-[0.98] mt-3 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>İSTASYONU KAYDET</span>
          </button>
        </form>
      </div>
    </div>
  );
}
