import React from 'react';
import { PlusCircle, Download, Upload, Smartphone, Sun, Moon, Cloud, CloudOff, Lock, MoreVertical, Languages, HelpCircle, Info } from 'lucide-react';
import LocaleModal from './LocaleModal';
import InfoModal from './InfoModal';
import { t } from '../i18n';
import logo from '../assets/logo.png';

export default function Header({ onOpenAddStation, onExport, onImport, onOpenInstall, isInstalled, theme, onToggleTheme, cloudStatus = 'off', onOpenCloud, isLockOn = false, onOpenLock }) {
  const fileInputRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [localeOpen, setLocaleOpen] = React.useState(false);
  const [info, setInfo] = React.useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
    // Allow choosing the same file again later
    e.target.value = '';
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={logo} alt="Hisapo" className="w-10 h-10 rounded-xl shadow-md shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Hisapo
            </h1>
            <p className="text-[11px] text-slate-400 whitespace-nowrap truncate">{t('Yakıt avans defteri')}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isInstalled && (
            <button
              onClick={onOpenInstall}
              title={t('Telefona Yükle')}
              className="p-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition animate-pulse"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span className="text-[11px]">{t('Yükle')}</span>
            </button>
          )}

          <button
            onClick={onOpenCloud}
            title={t('Bulut yedek ve ortak defter')}
            className="relative p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            {cloudStatus === 'off' ? <CloudOff className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
            {cloudStatus !== 'off' && (
              <span
                className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  cloudStatus === 'ok'
                    ? 'bg-emerald-400'
                    : cloudStatus === 'error'
                      ? 'bg-red-500'
                      : cloudStatus === 'syncing'
                        ? 'bg-sky-400 animate-pulse'
                        : 'bg-slate-500'
                }`}
              />
            )}
          </button>

          {onOpenAddStation && (
          <button
            onClick={onOpenAddStation}
            title={t('Yeni İstasyon Ekle')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title={t('Diğer')}
              className="relative p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <MoreVertical className="w-4 h-4" />
              {isLockOn && <Lock className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 text-amber-300" />}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1">
                  <MenuItem icon={Download} onClick={() => { setMenuOpen(false); onExport(); }}>
                    {t('Verileri yedekle (dosya)')}
                  </MenuItem>
                  {onImport && (
                    <MenuItem icon={Upload} onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}>
                      {t('Yedekten geri yükle')}
                    </MenuItem>
                  )}
                  <MenuItem icon={Lock} onClick={() => { setMenuOpen(false); onOpenLock(); }}>
                    {isLockOn ? t('Uygulama kilidi (açık)') : t('Uygulama kilidi')}
                  </MenuItem>
                  <MenuItem icon={theme === 'light' ? Moon : Sun} onClick={() => { setMenuOpen(false); onToggleTheme(); }}>
                    {theme === 'light' ? t('Koyu temaya geç') : t('Açık temaya geç')}
                  </MenuItem>
                  <MenuItem icon={Languages} onClick={() => { setMenuOpen(false); setLocaleOpen(true); }}>
                    {t('Dil ve birimler')}
                  </MenuItem>
                  <div className="my-1 border-t border-slate-800" />
                  <MenuItem icon={HelpCircle} onClick={() => { setMenuOpen(false); setInfo('help'); }}>
                    {t('Yardım')}
                  </MenuItem>
                  <MenuItem icon={Info} onClick={() => { setMenuOpen(false); setInfo('about'); }}>
                    {t('Hakkında')}
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {localeOpen && <LocaleModal onClose={() => setLocaleOpen(false)} />}
      <InfoModal mode={info} onClose={() => setInfo(null)} />
    </header>
  );
}

function MenuItem({ icon: Icon, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg text-left transition"
    >
      <Icon className="w-4 h-4 text-slate-400" />
      {children}
    </button>
  );
}
