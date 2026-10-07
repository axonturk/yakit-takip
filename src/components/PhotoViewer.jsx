import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { loadPhoto } from '../services/photos';
import { formatTL, formatTRDate, transactionLabel } from '../services/storage';

export default function PhotoViewer({ transaction, onClose }) {
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!transaction?.photoId) return undefined;
    let objectUrl = null;
    loadPhoto(transaction.photoId).then(
      (blob) => {
        if (!blob) return setMissing(true);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      () => setMissing(true)
    );
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [transaction]);

  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex justify-between items-center p-3 text-white">
        <div className="text-xs">
          <div className="font-bold">{transaction.stationName} · {formatTL(transaction.amount)}</div>
          <div className="text-white/60">{transactionLabel(transaction)} · {formatTRDate(transaction.date)}</div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Kapat">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-3 min-h-0">
        {url ? (
          <img src={url} alt="Fiş fotoğrafı" className="max-w-full max-h-full object-contain rounded-lg" />
        ) : (
          <p className="text-xs text-white/60">
            {missing ? 'Fotoğraf bulunamadı. Çeken telefon henüz eşitlememiş olabilir.' : 'Yükleniyor…'}
          </p>
        )}
      </div>
    </div>
  );
}
