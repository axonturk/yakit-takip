import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  loadData,
  saveData,
  calculateBalances,
  sortTransactions,
  validateBackup,
  migrateData,
  emptyData,
  nowLocalISO,
  roundMoney,
  formatTL,
  lowBalanceLimit,
  daysSince,
  SAMPLE_DATA
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
import EditTransactionModal from './components/EditTransactionModal';
import EditStationModal from './components/EditStationModal';
import StatementView from './components/StatementView';

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
    let dismissed = false;
    try {
      dismissed = !!localStorage.getItem('pwa_card_dismissed');
    } catch {
      // storage unavailable: show the card
    }
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
  // History tab shows either the movement list or the period statement
  const [historyView, setHistoryView] = useState('list');

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

  // Home screen shortcuts open a form directly (manifest "shortcuts")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (data.stations.some((s) => !s.archived)) {
      if (action === 'expense') setIsManualOpen(true);
      if (action === 'topup') setIsTopupOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state to localStorage
  useEffect(() => {
    saveData(data);
  }, [data]);

  const { stationBalances, totalBalance, totalTopup, totalExpense } = calculateBalances(
    data.stations,
    data.transactions
  );

  const sortedTransactions = useMemo(() => sortTransactions(data.transactions), [data.transactions]);
  const activeStations = useMemo(() => data.stations.filter((s) => !s.archived), [data.stations]);
  const plates = useMemo(
    () => [...new Set(sortedTransactions.map((t) => t.plate).filter(Boolean))],
    [sortedTransactions]
  );
  const recentTransactions = sortedTransactions
    .filter((t) => !selectedStationFilter || t.stationId === selectedStationFilter)
    .slice(0, 5);

  // Transaction being edited, and the last deleted one (for "Geri al")
  const [editingTx, setEditingTx] = useState(null);
  const [undoState, setUndoState] = useState(null);
  const undoTimer = useRef(null);
  const [savedToast, setSavedToast] = useState(null);
  const toastTimer = useRef(null);
  const [editingStation, setEditingStation] = useState(null);

  // Station of the most recently entered expense, preselected at the pump
  const lastStationId = data.transactions.find((t) => t.type === 'expense' && !t.kind)?.stationId || null;

  const lowStations = Object.values(stationBalances).filter(
    (s) => s.balance >= 0 && s.balance < lowBalanceLimit(s.station)
  );
  const backupAge = daysSince(data.settings?.lastBackupAt);
  const needsBackup =
    !data.isSample && data.transactions.length >= 5 && (backupAge === null || backupAge >= 7);

  // Handlers
  const handleSaveExpense = (newExpense) => {
    const st = data.stations.find((s) => s.id === newExpense.stationId);
    const tx = {
      id: 'tx-' + Date.now(),
      type: 'expense',
      stationId: newExpense.stationId,
      stationName: st ? st.name : 'Bilinmeyen İstasyon',
      amount: roundMoney(newExpense.amount),
      liters: newExpense.liters,
      unitPrice: newExpense.unitPrice,
      plate: newExpense.plate || null,
      fuelType: newExpense.fuelType || null,
      receiptNo: newExpense.receiptNo || null,
      date: newExpense.date,
      note: newExpense.note
    };

    setData((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
    showSavedToast(tx);
  };

  const handleSaveTopup = (newTopup) => {
    const st = data.stations.find((s) => s.id === newTopup.stationId);
    const tx = {
      id: 'tx-' + Date.now(),
      type: 'topup',
      stationId: newTopup.stationId,
      stationName: st ? st.name : 'Bilinmeyen İstasyon',
      amount: roundMoney(newTopup.amount),
      liters: null,
      unitPrice: null,
      paymentMethod: newTopup.paymentMethod || null,
      receiptNo: newTopup.receiptNo || null,
      date: newTopup.date,
      note: newTopup.note
    };

    setData((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
    showSavedToast(tx);
  };

  // After a save, show the station's new balance: the one number wanted at the pump
  const showSavedToast = (tx) => {
    const { stationBalances: next } = calculateBalances(data.stations, [tx, ...data.transactions]);
    const bal = next[tx.stationId]?.balance ?? 0;
    clearTimeout(toastTimer.current);
    setSavedToast({ stationName: tx.stationName, balance: bal });
    toastTimer.current = setTimeout(() => setSavedToast(null), 4000);
  };

  const handleEditStation = (stationId, changes) => {
    setData((prev) => ({
      ...prev,
      stations: prev.stations.map((s) => (s.id === stationId ? { ...s, ...changes } : s)),
      // Keep the name shown on past records in step with the station
      transactions: changes.name
        ? prev.transactions.map((t) => (t.stationId === stationId ? { ...t, stationName: changes.name } : t))
        : prev.transactions
    }));
  };

  const dismissInstallCard = () => {
    setShowAutoInstallCard(false);
    try {
      localStorage.setItem('pwa_card_dismissed', '1');
    } catch {
      // ignore
    }
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
        kind: 'opening',
        amount: roundMoney(initialBal),
        liters: null,
        unitPrice: null,
        date: nowLocalISO(),
        note: 'Başlangıç Avans Bakiyesi'
      };
      updatedTx = [topupTx, ...updatedTx];
    } else if (initialBal < 0) {
      const debtTx = {
        id: 'tx-' + Date.now(),
        type: 'expense',
        stationId: newStation.id,
        stationName: newStation.name,
        kind: 'opening',
        amount: roundMoney(Math.abs(initialBal)),
        liters: null,
        unitPrice: null,
        date: nowLocalISO(),
        note: 'Başlangıç Borç / Eksi Bakiye'
      };
      updatedTx = [debtTx, ...updatedTx];
    }

    setData((prev) => ({
      ...prev,
      isSample: false,
      stations: updatedStations,
      transactions: updatedTx
    }));
  };

  const handleDeleteTransaction = (id) => {
    const index = data.transactions.findIndex((t) => t.id === id);
    if (index === -1) return;
    const tx = data.transactions[index];
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id)
    }));
    clearTimeout(undoTimer.current);
    setUndoState({ tx, index });
    undoTimer.current = setTimeout(() => setUndoState(null), 7000);
  };

  const handleUndoDelete = () => {
    if (!undoState) return;
    const { tx, index } = undoState;
    setData((prev) => {
      const next = [...prev.transactions];
      next.splice(Math.min(index, next.length), 0, tx);
      return { ...prev, transactions: next };
    });
    clearTimeout(undoTimer.current);
    setUndoState(null);
  };

  // Edits keep the previous values in tx.edits so a corrected amount stays traceable.
  const handleEditTransaction = (id, changes) => {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => {
        if (t.id !== id) return t;
        const before = {};
        Object.keys(changes).forEach((k) => {
          before[k] = t[k] ?? null;
        });
        const st = prev.stations.find((s) => s.id === (changes.stationId || t.stationId));
        return {
          ...t,
          ...changes,
          amount: roundMoney(changes.amount ?? t.amount),
          stationName: st ? st.name : t.stationName,
          edits: [...(t.edits || []), { at: nowLocalISO(), before }]
        };
      })
    }));
  };

  // Export JSON backup
  const downloadBackup = (payload, suffix = '') => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pumpbook_yedek_${nowLocalISO().slice(0, 10)}${suffix}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportBackup = () => {
    const stamped = { ...data, settings: { ...data.settings, lastBackupAt: nowLocalISO() } };
    downloadBackup(stamped);
    setData(stamped);
  };

  // Import JSON backup
  const handleImportBackup = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = validateBackup(JSON.parse(e.target.result));
        if (!result.ok) {
          alert(`❌ Yedek yüklenemedi: ${result.error}`);
          return;
        }
        const incoming = result.data;
        const hasCurrent = data.transactions.length > 0 || data.stations.length > 0;
        const summary =
          `Yedekte ${incoming.stations.length} istasyon ve ${incoming.transactions.length} işlem var.` +
          (hasCurrent
            ? `\n\nMevcut ${data.stations.length} istasyon ve ${data.transactions.length} işlem bunlarla DEĞİŞTİRİLECEK. ` +
              'Güvenlik için mevcut verinin yedeği önce indirilecek.'
            : '') +
          '\n\nDevam edilsin mi?';
        if (!window.confirm(summary)) return;
        if (hasCurrent) downloadBackup(data, '_geri_yukleme_oncesi');
        setData(incoming);
        alert('✅ Yedek başarıyla geri yüklendi!');
      } catch {
        alert('❌ Dosya okunamadı, geçerli bir JSON yedeği değil.');
      }
    };
    reader.readAsText(file);
  };

  const handleOpenTopup = (stId) => {
    if (activeStations.length === 0) {
      setIsAddStationOpen(true);
      return;
    }
    if (stId) setSelectedStationFilter(stId);
    setIsTopupOpen(true);
  };

  const handleOpenExpense = (stId) => {
    if (activeStations.length === 0) {
      setIsAddStationOpen(true);
      return;
    }
    if (stId) setSelectedStationFilter(stId);
    setIsManualOpen(true);
  };

  const handleOpenAdjustBalance = (stId) => {
    if (activeStations.length === 0) {
      setIsAddStationOpen(true);
      return;
    }
    if (stId) setSelectedStationFilter(stId);
    setIsAdjustBalanceOpen(true);
  };

  const handleDeleteStation = (stationId) => {
    const st = data.stations.find((s) => s.id === stationId);
    const stationName = st ? st.name : 'bu istasyonu';
    const txCount = data.transactions.filter((t) => t.stationId === stationId).length;
    if (!window.confirm(`"${stationName}" istasyonu listeden kaldırılsın mı?${txCount > 0 ? `\n(${txCount} işlem kaydı geçmişte ve yedekte korunur, bakiyesi toplamdan çıkar)` : ''}`)) {
      return;
    }

    // Archive instead of deleting so past records stay in history and exports.
    setData((prev) => ({
      ...prev,
      stations: prev.stations.map((s) => (s.id === stationId ? { ...s, archived: true } : s))
    }));

    if (selectedStationFilter === stationId) {
      setSelectedStationFilter(null);
    }
  };

  const handleAdjustBalance = ({ stationId, diff, date, note }) => {
    const st = data.stations.find((s) => s.id === stationId);
    const stationName = st ? st.name : 'İstasyon';

    const tx = {
      id: 'tx-' + Date.now(),
      type: diff > 0 ? 'topup' : 'expense',
      kind: 'adjustment',
      stationId,
      stationName,
      amount: roundMoney(Math.abs(diff)),
      liters: null,
      unitPrice: null,
      date: date || nowLocalISO(),
      note: note || `Bakiye Düzeltme (${diff > 0 ? '+' : '-'}${formatTL(Math.abs(diff))})`
    };

    setData((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
  };

  const handleLoadSample = () => {
    setData({ ...migrateData(SAMPLE_DATA), isSample: true });
  };

  const handleClearSample = () => {
    setData(emptyData());
    setSelectedStationFilter(null);
  };

  const activeStation = activeStations.find((s) => s.id === selectedStationFilter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24 selection:bg-amber-500 selection:text-slate-950">
      
      {/* Header */}
      <Header
        onOpenAddStation={() => setIsAddStationOpen(true)}
        onExport={handleExportBackup}
        onImport={handleImportBackup}
        onOpenInstall={handleInstallClick}
        isInstalled={isInstalled}
      />

      {/* Install suggestion, once the app has been used a little */}
      {showAutoInstallCard && !isInstalled && data.transactions.length >= 2 && !data.isSample && !savedToast && !undoState && (
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
                  dismissInstallCard();
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
                  dismissInstallCard();
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

        {data.isSample && (
          <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-[11px] text-sky-200 flex items-center justify-between gap-2">
            <span>Örnek verileri görüyorsunuz. Kendi kayıtlarınıza başlamak için temizleyin.</span>
            <button
              onClick={handleClearSample}
              className="shrink-0 py-1 px-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg transition"
            >
              Temizle ve başla
            </button>
          </div>
        )}

        {activeTab === 'home' && lowStations.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200">
            Bakiyesi azalan istasyon: {lowStations.map((s) => `${s.station.name} (${formatTL(s.balance)})`).join(', ')}
          </div>
        )}

        {activeTab === 'home' && needsBackup && (
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-[11px] text-slate-300 flex items-center justify-between gap-2">
            <span>
              {backupAge === null ? 'Henüz yedek almadınız.' : `Son yedek ${backupAge} gün önce.`} Veriler yalnızca bu
              telefonda duruyor.
            </span>
            <button
              onClick={handleExportBackup}
              className="shrink-0 py-1 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
            >
              Yedek al
            </button>
          </div>
        )}

        {activeTab === 'home' && activeStations.length === 0 ? (
          <div className="p-6 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="text-3xl">⛽</div>
            <h2 className="text-sm font-bold text-white">Pumpbook'a hoş geldiniz</h2>
            <p className="text-xs text-slate-400">
              Avans yatırdığınız veya veresiye yakıt aldığınız ilk istasyonu ekleyin. Varsa mevcut bakiyesini de
              yazabilirsiniz.
            </p>
            <button
              onClick={() => setIsAddStationOpen(true)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
            >
              İlk istasyonu ekle
            </button>
            {data.transactions.length === 0 && (
              <button
                onClick={handleLoadSample}
                className="w-full py-2 text-xs text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-xl transition"
              >
                Önce örnek verilerle dene
              </button>
            )}
          </div>
        ) : activeTab === 'home' ? (
          <>
            {/* Top Total Balance Card */}
            <BalanceCard
              totalBalance={totalBalance}
              totalTopup={totalTopup}
              totalExpense={totalExpense}
              stationCount={activeStations.length}
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
              onEditStation={setEditingStation}
              onDeleteStation={handleDeleteStation}
            />

            {/* Recent Activity Mini-Section */}
            <TransactionHistory
              transactions={recentTransactions}
              stations={data.stations}
              selectedStationFilter={selectedStationFilter}
              onSelectStationFilter={setSelectedStationFilter}
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={setEditingTx}
              compact
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
          <div className="space-y-3">
            <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                ['list', 'Hareketler'],
                ['statement', 'Dönem Ekstresi']
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setHistoryView(key)}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${
                    historyView === key ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {historyView === 'statement' ? (
              <StatementView
                stations={data.stations}
                transactions={data.transactions}
                defaultStationId={selectedStationFilter}
              />
            ) : (
              <TransactionHistory
                transactions={sortedTransactions}
                stations={data.stations}
                plates={plates}
                selectedStationFilter={selectedStationFilter}
                onSelectStationFilter={setSelectedStationFilter}
                onDeleteTransaction={handleDeleteTransaction}
                onEditTransaction={setEditingTx}
              />
            )}
          </div>
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
        stations={activeStations}
        defaultStationId={selectedStationFilter}
        transactions={data.transactions}
        onSaveTopup={handleSaveTopup}
      />

      <ManualExpenseModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        stations={activeStations}
        plates={plates}
        defaultStationId={selectedStationFilter}
        lastStationId={lastStationId}
        transactions={data.transactions}
        onSaveExpense={handleSaveExpense}
      />

      <AdjustBalanceModal
        isOpen={isAdjustBalanceOpen}
        onClose={() => setIsAdjustBalanceOpen(false)}
        stations={activeStations}
        stationBalances={stationBalances}
        defaultStationId={selectedStationFilter}
        onAdjustBalance={handleAdjustBalance}
      />

      <AddStationModal
        isOpen={isAddStationOpen}
        onClose={() => setIsAddStationOpen(false)}
        onAddStation={handleAddStation}
      />

      <EditTransactionModal
        transaction={editingTx}
        stations={activeStations}
        plates={plates}
        onClose={() => setEditingTx(null)}
        onSave={handleEditTransaction}
      />

      <EditStationModal
        station={editingStation}
        onClose={() => setEditingStation(null)}
        onSave={handleEditStation}
      />

      {savedToast && !undoState && (
        <div className="fixed inset-x-3 bottom-24 z-50 max-w-md mx-auto">
          <div className="bg-emerald-600 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold truncate">✓ {savedToast.stationName}</span>
            <span className="text-sm font-black shrink-0">
              {savedToast.balance < 0 ? 'Borç ' : 'Kalan '}
              {formatTL(savedToast.balance)}
            </span>
          </div>
        </div>
      )}

      {undoState && (
        <div className="fixed inset-x-3 bottom-24 z-50 max-w-md mx-auto">
          <div className="bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl shadow-2xl px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="truncate">
              {undoState.tx.stationName} · {formatTL(undoState.tx.amount)} silindi
            </span>
            <button
              onClick={handleUndoDelete}
              className="shrink-0 font-bold text-amber-400 hover:text-amber-300"
            >
              Geri al
            </button>
          </div>
        </div>
      )}

      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        installPrompt={installPrompt}
        isInstalled={isInstalled}
      />

    </div>
  );
}
