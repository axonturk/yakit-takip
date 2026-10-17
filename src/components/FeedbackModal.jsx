import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareWarning, X, Loader2, CheckCircle2 } from 'lucide-react';
import { compressImage } from '../services/photos';
import { sendFeedback } from '../services/feedback';
import { t } from '../i18n';

// "Hata bildir": a short note, an optional e-mail to reply to and an optional screenshot
export default function FeedbackModal({ isOpen, onClose }) {
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [shot, setShot] = useState(null);
  const [state, setState] = useState(null); // null | 'busy' | 'sent' | { error }

  if (!isOpen) return null;

  const close = () => {
    setState(null);
    onClose();
  };

  const pickShot = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShot(file ? await compressImage(file, 1600, 0.8) : null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setState('busy');
    try {
      await sendFeedback({ kind: 'bug', message, contact, photo: shot, info: { screen: `${innerWidth}x${innerHeight}`, ua: navigator.userAgent.slice(0, 300) } });
      setMessage('');
      setShot(null);
      setState('sent');
    } catch (err) {
      console.warn('Feedback failed', err);
      setState({ error: navigator.onLine ? t('Gönderilemedi. Biraz sonra tekrar dene ya da destek@hisapo.com adresine yaz.') : t('İnternet yok. Bağlanınca tekrar dene.') });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar p-5 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <MessageSquareWarning className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">{t('Hata bildir / öneri gönder')}</h2>
          </div>
          <button onClick={close} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mt-3 leading-relaxed">
          {t('Hisapo pilot aşamasında. Gördüğün her hata ve aklına gelen her öneri gelişmemize yardımcı olur. Lütfen yaz, teşekkür ederiz!')}
        </p>

        {state === 'sent' ? (
          <div className="mt-4 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t('Teşekkürler, mesajın bize ulaştı.')}</span>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              autoFocus
              placeholder={t('Ne oldu? Hangi ekranda, ne yaparken?')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
            <input
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder={t('E-posta (cevap vermemizi istersen)')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
            />
            <label className="block text-[11px] text-slate-400">
              {t('Ekran görüntüsü (opsiyonel)')}
              <input type="file" accept="image/*" onChange={pickShot} className="block mt-1 text-[11px] text-slate-300" />
            </label>
            {state?.error && <p className="text-[11px] text-red-300">{state.error}</p>}
            <button
              type="submit"
              disabled={state === 'busy' || !message.trim()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              {state === 'busy' && <Loader2 className="w-4 h-4 animate-spin" />}
              {state === 'busy' ? t('Gönderiliyor…') : t('Gönder')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
