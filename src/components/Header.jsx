import React from 'react';
import { PlusCircle, Download, Upload, Smartphone, Sun, Moon } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Header({ onOpenAddStation, onExport, onImport, onOpenInstall, isInstalled, theme, onToggleTheme }) {
  const fileInputRef = React.useRef(null);

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
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Hisapo" className="w-10 h-10 rounded-xl shadow-md" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Hisapo
            </h1>
            <p className="text-[11px] text-slate-400 whitespace-nowrap">Yakıt avans defteri</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isInstalled && (
            <button
              onClick={onOpenInstall}
              title="Telefona Yükle"
              className="p-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition animate-pulse"
            >
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] hidden min-[380px]:inline">Yükle</span>
            </button>
          )}

          <button
            onClick={onToggleTheme}
            title={theme === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç'}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenAddStation}
            title="Yeni İstasyon Ekle"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          <button
            onClick={onExport}
            title="Verileri Yedekle (JSON)"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Yedekten Geri Yükle"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
