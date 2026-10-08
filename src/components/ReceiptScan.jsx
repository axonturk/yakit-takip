import React, { useRef, useState } from 'react';
import { ScanLine, Loader2 } from 'lucide-react';
import { compressImage } from '../services/photos';
import { t, getLang } from '../i18n';

const LABELS = {
  amount: () => t('tutar'),
  liters: () => t('litre'),
  unitPrice: () => t('birim fiyat'),
  plate: () => t('plaka'),
  fuelType: () => t('yakıt türü'),
  receiptNo: () => t('fiş no'),
  date: () => t('tarih')
};

// "Fişi okut": photograph the receipt, read it on the phone and fill the form.
// The reader only understands Turkish receipts, so it is hidden in other languages.
export default function ReceiptScan({ onRead }) {
  const inputRef = useRef(null);
  const [state, setState] = useState(null); // null | 'busy' | { found: [] } | { error }

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setState('busy');
    try {
      // A larger copy reads better; the smaller one is what gets saved as the receipt photo
      const [forOcr, photo] = await Promise.all([compressImage(file, 2000, 0.9), compressImage(file)]);
      const { readReceipt } = await import('../services/ocr');
      const { fields } = await readReceipt(forOcr);
      onRead(fields, photo);
      setState({ found: Object.keys(fields).filter((k) => LABELS[k]) });
    } catch (err) {
      setState({ error: navigator.onLine ? t('Fiş okunamadı. Bilgileri elle gir.') : t('İlk okuma için internet gerekiyor.') });
      console.warn('Receipt OCR failed', err);
    }
  };

  if (getLang() !== 'tr') return null;

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={() => inputRef.current?.click()}
        className="w-full py-2.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-60"
      >
        {state === 'busy' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
        {state === 'busy' ? t('Fiş okunuyor…') : t('Fişi okut (fotoğraftan doldur)')}
      </button>
      {state === 'busy' && (
        <p className="text-[10px] text-slate-400 mt-1">{t('İlk seferde okuma aracı indirilir (yaklaşık 4 MB), sonra internetsiz de çalışır.')}</p>
      )}
      {state?.found && (
        <p className={`text-[11px] mt-1 ${state.found.length ? 'text-emerald-300' : 'text-amber-300'}`}>
          {state.found.length
            ? t('Okunan: {list}. Lütfen kontrol et.', { list: state.found.map((k) => LABELS[k]()).join(', ') })
            : t('Fişte okunabilen bilgi bulunamadı. Fişi düz ve aydınlık çekip tekrar dene.')}
        </p>
      )}
      {state?.error && <p className="text-[11px] text-red-300 mt-1">{state.error}</p>}
    </div>
  );
}
