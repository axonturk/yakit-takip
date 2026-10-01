import React from 'react';
import { Fuel, PlusCircle, Download, Upload } from 'lucide-react';

export default function Header({ onOpenTopup, onOpenAddStation, onExport, onImport }) {
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-md">
            <Fuel className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              Yakıt Avans Takip
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-semibold px-1.5 py-0.5 rounded border border-emerald-500/20">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">İstasyon Peşin Bakiye Defteri</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenAddStation}
            title="Yeni İstasyon Ekle"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <PlusCircle className="w-5 h-5" />
          </button>

          <button
            onClick={onExport}
            title="Verileri Yedekle (Excel/JSON)"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
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
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
