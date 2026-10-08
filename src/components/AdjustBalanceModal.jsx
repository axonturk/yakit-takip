import React, { useState, useEffect } from 'react';
import { Sliders, X, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import StationLogo, { brandLabel } from './StationLogo';
import { formatTL } from '../services/storage';
import { t } from '../i18n';

const getNowISOString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

export default function AdjustBalanceModal({
  isOpen,
  onClose,
  stations,
  stationBalances,
  defaultStationId,
  onAdjustBalance
}) {
  const [stationId, setStationId] = useState(defaultStationId || stations[0]?.id || '');
  const [newBalance, setNewBalance] = useState('');
  const [datetime, setDatetime] = useState(getNowISOString());
  const [note, setNote] = useState(t('Bakiye Eşitleme / Düzeltme'));
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDatetime(getNowISOString());
      setErrorMsg(null);
      const targetId = defaultStationId && stations.some(s => s.id === defaultStationId)
        ? defaultStationId
        : stations[0]?.id || '';
      setStationId(targetId);

      const current = stationBalances[targetId]?.balance;
      if (current !== undefined) {
        setNewBalance(current.toString());
      } else {
        setNewBalance('');
      }
    }
  }, [isOpen, defaultStationId, stations, stationBalances]);

  const handleStationChange = (id) => {
    setStationId(id);
    const current = stationBalances[id]?.balance;
    if (current !== undefined) {
      setNewBalance(current.toString());
    }
  };

  const currentBal = stationBalances[stationId]?.balance ?? 0;
  const parsedNewBal = parseFloat(newBalance);
  const isValidNum = !isNaN(parsedNewBal);
  const diff = isValidNum ? parsedNewBal - currentBal : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidNum) {
      setErrorMsg(t('Lütfen geçerli bir bakiye tutarı girin!'));
      return;
    }

    if (Math.abs(diff) < 0.001) {
      setErrorMsg(t('Yeni bakiye mevcut bakiye ile aynı, herhangi bir değişiklik yapılmadı.'));
      return;
    }

    onAdjustBalance({
      stationId,
      newBalance: parsedNewBal,
      diff,
      date: datetime || getNowISOString(),
      note: note.trim() || t('Bakiye Eşitleme / Düzeltme')
    });

    onClose();
  };

  if (!isOpen) return null;

  const currentStation = stations.find(s => s.id === stationId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col p-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t('İstasyon Bakiyesini Düzelt')}</h2>
              <p className="text-[10px] text-slate-400">{t('Fiili Kalan Tutara Göre Bakiyeyi Eşitleyin')}</p>
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

        <form onSubmit={handleSubmit} className="mt-3 space-y-3.5">
          {/* Station Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400 font-medium">{t('Hangi İstasyon?')}</label>
              <span className="text-[10px] text-slate-500">{t('İstenirse değiştirilebilir')}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <StationLogo
                name={currentStation?.name}
                brand={currentStation?.brand}
                className="w-10 h-10"
              />
              <select
                value={stationId}
                onChange={(e) => handleStationChange(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {stations.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.brand ? `(${brandLabel(st.brand)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current vs New Balance Comparison */}
          <div className="p-3 bg-slate-800/60 border border-slate-700/80 rounded-2xl space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t('Sistemdeki Mevcut Bakiye:')}</span>
              <span className="font-bold text-slate-200">{formatTL(currentBal)}</span>
            </div>

            <div className="pt-2 border-t border-slate-700/60">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-amber-400">
                  {t('Gerçek / Yeni Bakiye Tutarı ({cur})')} *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (newBalance.startsWith('-')) {
                      setNewBalance(newBalance.slice(1));
                    } else if (newBalance) {
                      setNewBalance('-' + newBalance);
                    }
                  }}
                  className="text-[10px] px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-amber-300 rounded-md font-mono font-bold transition"
                  title={t('İşareti Değiştir (Pozitif / Negatif)')}
                >
                  {t('± Eksi / Artı Yap')}
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder={t('Örn: 1500 veya borç ise -500')}
                className={`w-full bg-slate-900 border-2 rounded-xl p-3 text-lg font-extrabold text-white focus:outline-none ${
                  isValidNum && parsedNewBal < 0
                    ? 'border-rose-500 text-rose-300 focus:border-rose-400'
                    : 'border-amber-500/80 focus:border-amber-400'
                }`}
                autoFocus
              />
              <p className="text-[10px] text-slate-500 mt-1">{t('İstasyon hesabınız ekside / borçtaysa eksi (-) tutar girebilirsiniz.')}</p>
            </div>

            {isValidNum && Math.abs(diff) > 0.001 && (
              <div className={`p-2 rounded-xl text-[11px] font-semibold flex items-center justify-between ${
                diff > 0
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-300 border border-red-500/30'
              }`}>
                <span>{t('Fark Tutarı:')}</span>
                <span>
                  {diff > 0
                    ? t('+{v} (Avans eklenecek)', { v: formatTL(diff) })
                    : t('-{v} (Harcama / borç yazılacak)', { v: formatTL(Math.abs(diff)) })}
                </span>
              </div>
            )}
          </div>

          {/* Datetime with current time quick reset */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400 font-medium">{t('Düzeltme Tarih & Saati')}</label>
              <button
                type="button"
                onClick={() => setDatetime(getNowISOString())}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5"
              >
                <Clock className="w-3 h-3" />
                <span>{t('Şu Anki Sistem Saati')}</span>
              </button>
            </div>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">{t('Sistem saati otomatik seçilidir, dokunup değiştirebilirsiniz.')}</p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">{t('Düzeltme Nedeni / Not')}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('Örn: İstasyon pompasıyla eşitlendi')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-950/40 transition active:scale-[0.98] mt-2 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t('BAKİYEYİ GÜNCELLE & EŞİTLE')}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
