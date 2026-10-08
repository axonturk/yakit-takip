import React, { useState, useEffect } from 'react';
import PhotoPicker from './PhotoPicker';
import { CreditCard, X, Plus, AlertCircle, Clock } from 'lucide-react';
import StationLogo, { brandLabel } from './StationLogo';
import { PAYMENT_METHODS, findDuplicate, formatTL, formatTRDate } from '../services/storage';
import { t } from '../i18n';


export default function TopupModal({
  isOpen,
  onClose,
  stations,
  onSaveTopup,
  defaultStationId,
  transactions = []
}) {
  const [stationId, setStationId] = useState(defaultStationId || stations[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [datetime, setDatetime] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [photo, setPhoto] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setPhoto(null);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg(t('Lütfen geçerli bir yükleme tutarı girin!'));
      return;
    }

    const candidate = {
      type: 'topup',
      stationId,
      amount: parsedAmount,
      paymentMethod: paymentMethod || null,
      receiptNo: receiptNo.trim() || null,
      date: datetime,
      note: note || t('Avans Çekildi')
    };

    const dup = findDuplicate(transactions, candidate);
    if (
      dup &&
      !window.confirm(
        t('Benzer bir yükleme zaten var:') +
          `\n${dup.stationName} · ${formatTL(dup.amount)} · ${formatTRDate(dup.date)}` +
          (dup.receiptNo ? ' · ' + t('Slip {no}', { no: dup.receiptNo }) : '') +
          '\n\n' +
          t('Yine de kaydedilsin mi?')
      )
    ) {
      return;
    }

    onSaveTopup({ ...candidate, photo });

    setAmount('');
    setNote('');
    setReceiptNo('');
    setPhoto(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col p-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t('Peşin Avans / Bakiye Yükle')}</h2>
              <p className="text-[10px] text-slate-400">{t('İstasyona Peşin Çektirilen Tutarı Hesaba Ekle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Top-up Form */}
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400 font-medium">{t('Hangi İstasyon?')}</label>
              {defaultStationId && stationId === defaultStationId && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  {t('Seçili istasyon açıldı (Değiştirebilirsiniz)')}
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
                    {st.name} {st.brand ? `(${brandLabel(st.brand)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>


          <div>
            <label className="block text-xs font-bold text-amber-400 mb-1">
              {t('Yüklenen Tutar ({cur})')} * <span className="text-[10px] font-normal text-slate-400">{t('(Zorunlu)')}</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('Örn: {v}', { v: 3000 })}
              className="w-full bg-slate-900 border-2 border-amber-500/80 rounded-xl p-3 text-lg font-extrabold text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{t('Ödeme Yöntemi')}</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              >
                <option value="">{t('Seçilmedi')}</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{t(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{t('Slip / Dekont No')}</label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder={t('Opsiyonel')}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <PhotoPicker value={photo} onChange={setPhoto} label={t('Dekont fotoğrafı')} />

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">{t('Not (kart, taksit vb.)')}</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('Örn: Bonus Kart 3 Taksit, Nakit Avans vb.')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-400 font-medium">{t('Tarih & Saat')}</label>
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

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-950/40 transition active:scale-[0.98] mt-2 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('+ BAKİYE YÜKLE VE KAYDET')}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
