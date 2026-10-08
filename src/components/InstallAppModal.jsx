import React from 'react';
import { Smartphone, Download, X, CheckCircle2, AlertCircle, Share2, MoreVertical, ShieldCheck } from 'lucide-react';
import { t } from '../i18n';

export default function InstallAppModal({ isOpen, onClose, installPrompt, isInstalled }) {
  if (!isOpen) return null;

  const promptObj = window.deferredInstallPrompt || installPrompt;

  const handleNativeInstall = async () => {
    if (promptObj) {
      try {
        await promptObj.prompt();
        const choice = await promptObj.userChoice;
        if (choice.outcome === 'accepted') {
          onClose();
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{t('Telefona Uygulama Olarak Yükle')}</h2>
              <p className="text-[11px] text-slate-400">{t('Tam ekran ve internet olmadan kullanım')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Native Install Button if available */}
        {promptObj && !isInstalled && (
          <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-transparent border border-amber-500/30 rounded-2xl space-y-2">
            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-amber-400" />
              {t('Doğrudan Tek Tıkla Yükle')}
            </div>
            <p className="text-[11px] text-slate-300">
              {t('Tarayıcınız otomatik yüklemeyi destekliyor. Aşağıdaki butona basarak doğrudan telefonunuza ekleyebilirsiniz.')}
            </p>
            <button
              onClick={handleNativeInstall}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{t('UYGULAMAYI ŞİMDİ YÜKLE')}</span>
            </button>
          </div>
        )}

        {/* Status if already installed */}
        {isInstalled && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{t('Uygulama zaten telefonunuzda kurulu modda çalışıyor!')}</span>
          </div>
        )}

        {/* Step-by-Step Instructions */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            {t('Yükleme Adımları (Chrome / Android)')}
          </div>

          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-700 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </div>
              <div>
                <span className="font-semibold text-white block mb-0.5">{t('Chrome Menüsünü Açın')}</span>
                <span>{t('Chrome tarayıcınızın sağ alt veya sağ üst köşesindeki')} </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-[10px]">
                  <MoreVertical className="w-3 h-3 inline" /> {t('3 Nokta')}
                </span>
                <span> {t('simgesine dokunun.')}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-slate-700 text-amber-400 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </div>
              <div>
                <span className="font-semibold text-white block mb-0.5">{t('"Uygulamayı Yükle" veya "Ana Ekrana Ekle"')}</span>
                <span>{t('Menüden')} </span>
                <span className="text-amber-400 font-semibold">{t('"Uygulamayı yükle"')}</span>
                <span> ({t('veya')} </span>
                <span className="text-amber-400 font-semibold">{t('"Ana ekrana ekle"')}</span>
                <span>) {t('seçeneğini seçip onaylayın.')}</span>
              </div>
            </div>

            {/* Xiaomi / Redmi / POCO Warning Box */}
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-1.5">
              <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
                {t('Xiaomi / Redmi / POCO Kullanıcıları İçin Çözüm:')}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {t('Xiaomi telefonların güvenlik sistemi bazen Chrome\'un ana ekrana simge koymasını engeller. Eğer "yükle" dedikten sonra ana ekrana simge gelmiyorsa:')}
              </p>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div>1. <Rich text={t('Telefonunuzun <b>Ayarlar</b> bölümüne gidin.')} /></div>
                <div>2. <Rich text={t('<b>Uygulamalar > İzinler > Diğer İzinler</b> (veya Uygulama Yönetimi > Chrome > İzinler) sekmesini açın.')} /></div>
                <div>3. <Rich text={t('<b>Chrome</b>\'u seçin ve <b>"Ana ekran kısayolları"</b> iznini <b>İzin Ver (Yeşil Onay)</b> yapın.')} /></div>
                <div>4. <Rich text={t('Ardından tekrar Chrome\'a dönüp <b>"Ana ekrana ekle"</b> deyin. Simge hemen masaüstünüze gelecektir!')} /></div>
              </div>
            </div>

            {/* iOS note */}
            <div className="p-2.5 bg-slate-800/40 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <Rich text={t('<b>iPhone (Safari) Kullanıcıları:</b> Alttaki Paylaş butonuna basıp <b>"Ana Ekrana Ekle"</b>yi seçebilirsiniz.')} />
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition"
        >
          {t('Anladım, Kapat')}
        </button>

      </div>
    </div>
  );
}

// Shows a translated sentence with <b>...</b> parts in bold
function Rich({ text }) {
  return text.split(/<b>(.*?)<\/b>/).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}
