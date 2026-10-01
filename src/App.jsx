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
import PumpScannerModal from './components/PumpScannerModal';
import TopupModal from './components/TopupModal';
import ManualExpenseModal from './components/ManualExpenseModal';
import AddStationModal from './components/AddStationModal';
import AdjustBalanceModal from './components/AdjustBalanceModal';

import { Home, Camera, CreditCard, Clock, Plus, Fuel } from 'lucide-react';

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [selectedStationFilter, setSelectedStationFilter] = useState(null);

  // Modals
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);
  const [isAdjustBalanceOpen, setIsAdjustBalanceOpen] = useState(false);

  // Active bottom nav tab ('home' or 'history')
  const [activeTab, setActiveTab] = useState('home');

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

  const handleOpenScan = (stId) => {
    if (stId) setSelectedStationFilter(stId);
    setIsScanOpen(true);
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
      />

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
              onOpenScan={() => handleOpenScan(selectedStationFilter)}
              onOpenTopup={() => handleOpenTopup(selectedStationFilter)}
            />

            {/* Individual Station Balances Grid */}
            <StationList
              stationBalances={stationBalances}
              selectedStationFilter={selectedStationFilter}
              onSelectStationFilter={setSelectedStationFilter}
              onOpenAddStation={() => setIsAddStationOpen(true)}
              onOpenScanForStation={handleOpenScan}
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
            onClick={() => handleOpenScan(selectedStationFilter)}
            className="flex flex-col items-center justify-center text-emerald-400 hover:text-emerald-300 text-[10px] font-bold transition -mt-3"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-950/60 border-2 border-slate-900 active:scale-95 transition">
              <Camera className="w-5 h-5" />
            </div>
            <span className="mt-1">Pompa Tara</span>
          </button>

          <button
            onClick={() => handleOpenExpense(selectedStationFilter)}
            className="flex flex-col items-center justify-center text-slate-400 hover:text-red-400 text-[10px] font-medium transition"
          >
            <Fuel className="w-5 h-5 mb-0.5" />
            <span>- Harcama</span>
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
      <PumpScannerModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        stations={data.stations}
        defaultStationId={selectedStationFilter}
        onSaveExpense={handleSaveExpense}
      />

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

    </div>
  );
}
