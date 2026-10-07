import React, { useState, useEffect } from 'react';
import {
  loadData,
  saveData,
  calculateBalances,
  formatTL,
  INITIAL_DATA
} from './services/storage';

import Header from './components/Header';
import BalanceCard from './components/BalanceCard';
import StationList from './components/StationList';
import TransactionHistory from './components/TransactionHistory';
import TopupModal from './components/TopupModal';
import ManualExpenseModal from './components/ManualExpenseModal';
import AddStationModal from './components/AddStationModal';
import AdjustBalanceModal from './components/AdjustBalanceModal';
import InstallAppModal from './components/InstallAppModal';

import { Home, CreditCard, Clock, Fuel, Sliders } from 'lucide-react';

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [selectedStationFilter, setSelectedStationFilter] = useState(null);

  // Modals
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState(() => window.deferredInstallPrompt || null);
  const [isInstalled, setIsInstalled] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  });
  const [showAutoInstallCard, setShowAutoInstallCard] = useState(() => {
    const isStand = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const dismissed = sessionStorage.getItem('pwa_card_dismissed');
    return !isStand && !dismissed;
  });

  const handleInstallClick = async () => {
    const promptEvent = window.deferredInstallPrompt || installPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
          setInstallPrompt(null);
          window.deferredInstallPrompt = null;
          setShowAutoInstallCard(false);
          setIsInstallModalOpen(false);
          return;
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    // Fallback: If prompt is not directly available or rejected, open the step-by-step guidance modal
    setIsInstallModalOpen(true);
  };

  // Active bottom nav tab ('home' or 'history')
  const [activeTab, setActiveTab] = useState('home');

  // Check PWA standalone mode and listen for install prompt
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      setShowAutoInstallCard(false);
    }

    const handlePromptReady = () => {
      setInstallPrompt(window.deferredInstallPrompt);
    };

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e;
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      window.deferredInstallPrompt = null;
      setShowAutoInstallCard(false);
      setIsInstallModalOpen(false);
    };

    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Sync state to localStorage
  useEffect(() => {
    saveData(data);
  }, [data]);

  const { stationBalances, totalBalance, totalTopup, totalExpense } = calculateBalances(
    data.stations,
    data.transactions
  );

  // Handlers
  const handleSaveExpense = (newExpense) => {
    const st = data.stations.find((s) => s.id === newExpense.stationId);
    const tx = {
      id: 'tx-' + Date.now(),
      type: 'expense',
      stationId: newExpense.stationId,
      stationName: st ? st.name : 'Bilinmeyen İstasyon',
      amount: newExpense.amount,
      liters: newExpense.liters,
      unitPrice: newExpense.unitPrice,
      date: newExpense.date,
      note: newExpense.note
    };

    setData((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
  };

  const handleSaveTopup = (newTopup) => {
    const st = data.stations.find((s) => s.id === newTopup.stationId);
    const tx = {
      id: 'tx-' + Date.now(),
      type: 'topup',
      stationId: newTopup.stationId,
      stationName: st ? st.name : 'Bilinmeyen İstasyon',
      amount: newTopup.amount,
      liters: null,
      unitPrice: null,
      date: newTopup.date,
      note: newTopup.note
    };

    setData((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
  };

  const handleAddStation = (newStation, initialBal) => {
    const updatedStations = [...data.stations, newStation];
    let updatedTx = data.transactions;

    if (initialBal > 0) {
      const topupTx = {
        id: 'tx-' + Date.now(),
        type: 'topup',
        stationId: newStation.id,
        stationName: newStation.name,
        amount: initialBal,
        liters: null,
        unitPrice: null,
        date: new Date().toISOString().slice(0, 16),
        note: 'Başlangıç Avans Bakiyesi'
      };
      updatedTx = [topupTx, ...updatedTx];
    } else if (initialBal < 0) {
      const debtTx = {
        id: 'tx-' + Date.now(),
        type: 'expense',
        stationId: newStation.id,
        stationName: newStation.name,
        amount: Math.abs(initialBal),
        liters: null,
        unitPrice: null,
        date: new Date().toISOString().slice(0, 16),
        note: 'Başlangıç Borç / Eksi Bakiye'
      };
      updatedTx = [debtTx, ...updatedTx];
    }

    setData({
      stations: updatedStations,
      transactions: updatedTx
    });
  };

  const handleDeleteTransaction = (id) => {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id)
    }));
  };

  // Export JSON backup
  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yakit_takip_yedek_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  // Import JSON backup
  const handleImportBackup = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.stations && parsed.transactions) {
          setData(parsed);
          alert('✅ Yedek başarıyla geri yüklendi!');
        } else {
          alert('❌ Geçersiz yedek dosyası formatı!');
        }
      } catch (err) {
        alert('❌ Dosya okunurken hata oluştu!');
      }
    };
    reader.readAsText(file);
  };

  const handleOpenTopup = (stId) => {
    if (stId) setSelectedStationFilter(stId);
    setIsTopupOpen(true);
  };

  const handleOpenExpense = (stId) => {
    if (stId) setSelectedStationFilter(stId);
    setIsManualOpen(true);
  };

  const handleOpenAdjustBalance = (stId) => {
    if (stId) setSelectedStationFilter(stId);
    setIsAdjustBalanceOpen(true);
  };

  const handleDeleteStation = (stationId) => {
    const st = data.stations.find((s) => s.id === stationId);
    const stationName = st ? st.name : 'bu istasyonu';
    const txCount = data.transactions.filter((t) => t.stationId === stationId).length;
    if (!window.confirm(`"${stationName}" istasyonunu silmek istediğinize emin misiniz?${txCount > 0 ? `\n(Bu istasyona ait ${txCount} adet işlem kaydı da silinecektir)` : ''}`)) {
      return;
    }

    setData((prev) => ({
      stations: prev.stations.filter((s) => s.id !== stationId),
      transactions: prev.transactions.filter((t) => t.stationId !== stationId)
    }));

    if (selectedStationFilter === stationId) {
      setSelectedStationFilter(null);
    }
  };

  const handleAdjustBalance = ({ stationId, newBalance, diff, date, note }) => {
    const st = data.stations.find((s) => s.id === stationId);
    const stationName = st ? st.name : 'İstasyon';

    const tx = {
      id: 'tx-' + Date.now(),
      type: diff > 0 ? 'topup' : 'expense',
      stationId,
      stationName,
      amount: Math.abs(diff),
      liters: null,
      unitPrice: null,
      date: date || new Date().toISOString().slice(0, 16),
      note: note || `Bakiye Düzeltme (${diff > 0 ? '+' : '-'}${formatTL(Math.abs(diff))})`
    };

    setData((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
  };

  const activeStation = data.stations.find((s) => s.id === selectedStationFilter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24 selection:bg-amber-500 selection:text-slate-950">
      
      {/* Header */}
      <Header
        onOpenTopup={() => handleOpenTopup(selectedStationFilter)}
        onOpenAddStation={() => setIsAddStationOpen(true)}
        onExport={handleExportBackup}
        onImport={handleImportBackup}
        onOpenInstall={handleInstallClick}
        isInstalled={isInstalled}
      />

      {/* Install Banner (shows when app is not installed yet) */}
      {!isInstalled && (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-slate-900 border-b border-amber-500/30 px-3 py-2">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <span className="text-base animate-bounce shrink-0">📲</span>
              <div className="truncate">
                <span className="text-[11px] font-bold text-amber-300 block truncate">
                  Uygulama Olarak Kullanın
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Telefona yükleyin, reklamsız & internetsiz açın
                </span>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              className="py-1 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] shadow transition shrink-0"
            >
              YÜKLE
            </button>
          </div>
        </div>
      )}

      {/* Auto-Prompt Card on Initial Launch (when not installed) */}
      {showAutoInstallCard && !isInstalled && (
        <div className="fixed inset-x-3 bottom-20 z-50 max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 p-3.5 rounded-2xl shadow-2xl border-2 border-amber-300 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-bounce">📲</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    Uygulamayı Telefona Yükle
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-800">
                    Masaüstünden tek tıkla doğrudan açın
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAutoInstallCard(false);
                  sessionStorage.setItem('pwa_card_dismissed', '1');
                }}
                className="p-1 text-slate-800 hover:text-slate-950 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-400 font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>ŞİMDİ YÜKLE</span>
              </button>
              <button
                onClick={() => {
                  setShowAutoInstallCard(false);
                  sessionStorage.setItem('pwa_card_dismissed', '1');
                }}
                className="py-2.5 px-3 bg-white/20 hover:bg-white/30 text-slate-900 font-bold rounded-xl text-xs transition"
              >
                Daha Sonra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container (Mobile Max Width) */}
      <main className="max-w-md mx-auto w-full p-4 space-y-5 flex-1">

        {activeTab === 'home' ? (
          <>
            {/* Top Total Balance Card */}
            <BalanceCard
              totalBalance={totalBalance}
              totalTopup={totalTopup}
              totalExpense={totalExpense}
              stationCount={data.stations.length}
              onOpenExpense={() => handleOpenExpense(selectedStationFilter)}
              onOpenTopup={() => handleOpenTopup(selectedStationFilter)}
            />

            {/* Individual Station Balances Grid */}
            <StationList
              stationBalances={stationBalances}
              selectedStationFilter={selectedStationFilter}
              onSelectStationFilter={setSelectedStationFilter}
              onOpenAddStation={() => setIsAddStationOpen(true)}
              onOpenTopupForStation={handleOpenTopup}
              onOpenExpenseForStation={handleOpenExpense}
              onOpenAdjustBalance={handleOpenAdjustBalance}
              onDeleteStation={handleDeleteStation}
            />

            {/* Recent Activity Mini-Section */}
            <TransactionHistory
              transactions={data.transactions.slice(0, 5)}
              stations={data.stations}
              selectedStationFilter={selectedStationFilter}
              onSelectStationFilter={setSelectedStationFilter}
              onDeleteTransaction={handleDeleteTransaction}
            />

            {data.transactions.length > 5 && (
              <button
                onClick={() => setActiveTab('history')}
                className="w-full py-2.5 text-center text-xs font-semibold text-amber-400 hover:text-amber-300 bg-slate-900 border border-slate-800 rounded-xl transition"
              >
                Tüm Geçmiş Hareketleri Gör ({data.transactions.length}) →
              </button>
            )}
          </>
        ) : (
          /* Full History View */
          <TransactionHistory
            transactions={data.transactions}
            stations={data.stations}
            selectedStationFilter={selectedStationFilter}
            onSelectStationFilter={setSelectedStationFilter}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

      </main>

      {/* Active Station Indicator Ribbon above bottom nav */}
      {activeStation && (
        <div className="fixed bottom-[61px] left-0 right-0 z-30">
          <div className="max-w-md mx-auto px-3">
            <div className="bg-amber-500 text-slate-950 text-[10px] font-bold py-1 px-3 rounded-t-xl shadow-lg shadow-amber-950/30 flex items-center justify-between">
              <span className="truncate flex items-center gap-1">
                <span>🎯 Düğmeler Seçili İstasyon İçin:</span>
                <span className="underline font-black">{activeStation.name}</span>
              </span>
              <button
                onClick={() => setSelectedStationFilter(null)}
                className="text-[9px] bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 px-1.5 py-0.5 rounded transition shrink-0 ml-2"
              >
                Filtreyi Temizle ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 py-2 px-3 z-40">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center text-center">
          
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center text-[10px] font-semibold transition ${
              activeTab === 'home' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span>Ana Sayfa</span>
          </button>

          <button
            onClick={() => handleOpenTopup(selectedStationFilter)}
            className="flex flex-col items-center justify-center text-slate-400 hover:text-amber-400 text-[10px] font-medium transition"
          >
            <CreditCard className="w-5 h-5 mb-0.5" />
            <span>+ Bakiye</span>
          </button>

          <button
            onClick={() => handleOpenExpense(selectedStationFilter)}
            className="flex flex-col items-center justify-center text-rose-400 hover:text-rose-300 text-[10px] font-bold transition -mt-3"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-950/60 border-2 border-slate-900 active:scale-95 transition">
              <Fuel className="w-5 h-5" />
            </div>
            <span className="mt-1">Harcama</span>
          </button>

          <button
            onClick={() => handleOpenAdjustBalance(selectedStationFilter)}
            className="flex flex-col items-center justify-center text-slate-400 hover:text-amber-300 text-[10px] font-medium transition"
          >
            <Sliders className="w-5 h-5 mb-0.5" />
            <span>Düzelt</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center text-[10px] font-semibold transition ${
              activeTab === 'history' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span>Geçmiş</span>
          </button>

        </div>
      </nav>

      {/* MODALS */}
      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        stations={data.stations}
        defaultStationId={selectedStationFilter}
        onSaveTopup={handleSaveTopup}
      />

      <ManualExpenseModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        stations={data.stations}
        defaultStationId={selectedStationFilter}
        onSaveExpense={handleSaveExpense}
      />

      <AdjustBalanceModal
        isOpen={isAdjustBalanceOpen}
        onClose={() => setIsAdjustBalanceOpen(false)}
        stations={data.stations}
        stationBalances={stationBalances}
        defaultStationId={selectedStationFilter}
        onAdjustBalance={handleAdjustBalance}
      />

      <AddStationModal
        isOpen={isAddStationOpen}
        onClose={() => setIsAddStationOpen(false)}
        onAddStation={handleAddStation}
      />

      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        installPrompt={installPrompt}
        isInstalled={isInstalled}
      />

    </div>
  );
}
