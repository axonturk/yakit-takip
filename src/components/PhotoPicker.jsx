import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { compressImage, loadPhoto } from '../services/photos';

// value: a new Blob, null (no photo) or undefined (keep existingId).
export default function PhotoPicker({ value, onChange, existingId = null, label = 'Fiş fotoğrafı' }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    const show = (blob) => {
      if (cancelled || !blob) return setPreview(null);
      url = URL.createObjectURL(blob);
      setPreview(url);
    };
    if (value instanceof Blob) show(value);
    else if (value === undefined && existingId) loadPhoto(existingId).then(show, () => setPreview(null));
    else setPreview(null);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [value, existingId]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onChange(await compressImage(file));
    setBusy(false);
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      {preview ? (
        <div className="flex items-center gap-2">
          <img src={preview} alt={label} className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[11px] text-amber-400 hover:text-amber-300"
          >
            Değiştir
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Kaldır
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full py-2.5 border border-dashed border-slate-600 hover:border-amber-400 text-slate-300 hover:text-amber-300 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Camera className="w-4 h-4" />
          {busy ? 'Hazırlanıyor…' : `${label} ekle (opsiyonel)`}
        </button>
      )}
      <p className="text-[10px] text-slate-500 mt-1">Fotoğraflar bu telefonda, ortak defter açıksa bulutta da saklanır. Yedek dosyasına girmez.</p>
    </div>
  );
}
