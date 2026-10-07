import React, { useState, useEffect } from 'react';
import { Edit3, X, AlertCircle, MinusCircle, Clock } from 'lucide-react';
import StationLogo from './StationLogo';


export default function ManualExpenseModal({
  isOpen,
  onClose,
  stations,
  onSaveExpense,
  defaultStationId
}) {
  const [stationId, setStationId] = useState(defaultStationId || stations[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [liters, setLiters] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [datetime, setDatetime] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setDatetime(now.toISOString().slice(0, 16));
      if (defaultStationId && stations.some(s => s.id === defaultStationId)) {
        setStationId(defaultStationId);
      } else if (stations.length > 0 && (!stationId || !stations.some(s => s.id === stationId))) {
        setStationId(stations[0].id);
      }
    }
  }, [isOpen, defaultStationId, stations]);

  // Litre ve birim fiyat girilirse toplam tutarı otomatik hesapla
  const recalcAmount = (l, p) => {
    const lv = parseFloat(l);
    const pv = parseFloat(p);
    if (lv > 0 && pv > 0) {
      setAmount((lv * pv).toFixed(2));
    }
  };

  const handleLitersChange = (val) => {
    setLiters(val);
    recalcAmount(val, unitPrice);
  };

  const handleUnitPriceChange = (val) => {
    setUnitPrice(val);
    recalcAmount(liters, val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Lütfen geçerli bir Toplam Tutar girin!');
      return;
    }

    onSaveExpense({
      stationId,
      amount: parsedAmount,
      liters: liters ? parseFloat(liters) : null,
      unitPrice: unitPrice ? parseFloat(unitPrice) : null,
      date: datetime,
      note: note || 'Yakıt Alımı'
    });

    setAmount('');
    setLiters('');
    setUnitPrice('');
    setNote('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col p-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Yakıt Harcaması Gir</h2>
              <p className="text-[10px] text-slate-400">Litre × Fiyat girilirse tutar otomatik hesaplanır</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400 font-medium">Hangi İstasyon?</label>
              {defaultStationId && stationId === defaultStationId && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Seçili istasyon açıldı (Değiştirebilirsiniz)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <StationLogo
                name={stations.find(s => s.id === stationId)?.name}
                brand={stations.find(s => s.id === stationId)?.brand}
                className="w-10 h-10"
              />
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {stations.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.brand ? `(${st.brand})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>


          <div>
            <label className="block text-xs font-bold text-amber-400 mb-1">
              Toplam Tutar (TL) * <span className="text-[10px] font-normal text-slate-400">(Zorunlu Alan)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Örn: 1500"
              className="w-full bg-slate-900 border-2 border-amber-500/80 rounded-xl p-3 text-lg font-extrabold text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Litre <span className="text-[10px] text-slate-500">(Opsiyonel)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={liters}
                onChange={(e) => handleLitersChange(e.target.value)}
                placeholder="Örn: 34.00"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Birim Fiyat (TL/L) <span className="text-[10px] text-slate-500">(Opsiyonel)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                placeholder="Örn: 44.10"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-slate-400 font-medium">Tarih & Saat</label>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    setDatetime(now.toISOString().slice(0, 16));
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5"
                >
                  <Clock className="w-3 h-3" />
                  <span>Şu An</span>
                </button>
              </div>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Örn: Depo fulleme"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/40 transition active:scale-[0.98] mt-2 flex items-center justify-center gap-1.5"
          >
            <MinusCircle className="w-4 h-4" />
            <span>- BAKİYEDEN DÜŞ VE KAYDET</span>
          </button>
        </form>

      </div>
    </div>
  );
}
