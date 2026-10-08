import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, X, UserPlus, Users, FileSpreadsheet, Send, Trash2 } from 'lucide-react';
import { loadContacts, saveContacts, normalizePhone, formatPhone, whatsappUrl, canShareFile } from '../services/share';
import { t } from '../i18n';

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-400';
const rowClass =
  'w-full flex items-center gap-2.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition';

// WhatsApp button with saved people (one tap to the accountant) and, where the phone allows, the Excel file itself.
export default function WhatsAppShare({ text, file }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
      >
        <Share2 className="w-3.5 h-3.5" /> WhatsApp
      </button>
      {open && createPortal(<Sheet text={text} file={file} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Sheet({ text, file, onClose }) {
  const [contacts, setContacts] = useState(loadContacts);
  const [adding, setAdding] = useState(() => loadContacts().length === 0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState(null);

  const csvFile = file ? new File([file.content.startsWith('\uFEFF') ? file.content : '\uFEFF' + file.content], file.name, { type: 'text/csv' }) : null;
  const fileOk = csvFile && canShareFile(csvFile);

  const send = (to) => {
    window.open(whatsappUrl(text, to), '_blank', 'noopener');
    onClose();
  };

  const update = (list) => {
    setContacts(list);
    saveContacts(list);
  };

  const add = (e) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (!p) return setErr(t('Numara geçersiz. Örn: 0532 123 45 67'));
    update([...contacts.filter((c) => c.phone !== p), { name: name.trim() || formatPhone(p), phone: p }]);
    setName('');
    setPhone('');
    setErr(null);
    setAdding(false);
  };

  const shareFile = async () => {
    try {
      await navigator.share({ files: [csvFile], text: text.split('\n')[0] });
      onClose();
    } catch (e) {
      if (e?.name !== 'AbortError') setErr(t('Dosya paylaşılamadı. Excel düğmesiyle indirip gönderebilirsin.'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar space-y-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">{t('WhatsApp ile gönder')}</h2>
          <button onClick={onClose} aria-label={t('Kapat')} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {contacts.map((c) => (
          <div key={c.phone} className="flex gap-1.5">
            <button onClick={() => send(c.phone)} className={rowClass}>
              <Send className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white truncate">{c.name}</span>
                <span className="block text-[10px] text-slate-400">{formatPhone(c.phone)}</span>
              </span>
            </button>
            <button
              onClick={() => update(contacts.filter((x) => x.phone !== c.phone))}
              aria-label={t('{name} sil', { name: c.name })}
              className="px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-400 hover:text-red-300 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <button onClick={() => send()} className={rowClass}>
          <Users className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-100">{t('Kişi ya da grup seç')}</span>
        </button>

        {fileOk && (
          <button onClick={shareFile} className={rowClass}>
            <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-100">{t('Excel dosyası olarak gönder')}</span>
              <span className="block text-[10px] text-slate-400">{t('Paylaş ekranında WhatsApp\'ı seç')}</span>
            </span>
          </button>
        )}

        {adding ? (
          <form onSubmit={add} className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-[11px] text-slate-300 font-semibold">{t('Sık gönderdiğin kişiyi kaydet')}</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Ad (örn: Muhasebeci Ahmet)')} className={inputClass} />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              placeholder={t('Telefon (örn: 0532 123 45 67)')}
              className={inputClass}
            />
            <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition">
              {t('Kaydet')}
            </button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 pt-1">
            <UserPlus className="w-3.5 h-3.5" /> {t('Kişi kaydet')}
          </button>
        )}
        {err && <p className="text-[11px] text-red-300">{err}</p>}
      </div>
    </div>
  );
}
