// LocalStorage key
const STORAGE_KEY = 'yakit_takip_data_v1';

// Initial dummy data for instant demo & onboarding
export const INITIAL_DATA = {
  stations: [
    { id: 'opet-maslak', name: 'Opet Maslak', color: '#10b981', brand: 'Opet' },
    { id: 'shell-kadikoy', name: 'Shell Kadıköy', color: '#eab308', brand: 'Shell' },
    { id: 'po-cevre', name: 'Petrol Ofisi Çevre Yolu', color: '#ef4444', brand: 'Petrol Ofisi' },
    { id: 'bp-atasehir', name: 'BP Ataşehir', color: '#22c55e', brand: 'BP' }
  ],
  transactions: [
    {
      id: 'tx-1',
      type: 'expense',
      stationId: 'shell-kadikoy',
      stationName: 'Shell Kadıköy',
      amount: 350.00,
      liters: 7.95,
      unitPrice: 44.02,
      date: '2026-10-01T17:45',
      note: 'Pompa No: 4'
    },
    {
      id: 'tx-2',
      type: 'expense',
      stationId: 'opet-maslak',
      stationName: 'Opet Maslak',
      amount: 220.00,
      liters: 5.00,
      unitPrice: 44.00,
      date: '2026-10-01T11:20',
      note: 'Dönüş yolu'
    },
    {
      id: 'tx-3',
      type: 'topup',
      stationId: 'opet-maslak',
      stationName: 'Opet Maslak',
      amount: 2500.00,
      liters: null,
      unitPrice: null,
      date: '2026-09-30T14:30',
      note: 'Garanti Bonus 3 Taksit'
    },
    {
      id: 'tx-4',
      type: 'topup',
      stationId: 'shell-kadikoy',
      stationName: 'Shell Kadıköy',
      amount: 2000.00,
      liters: null,
      unitPrice: null,
      date: '2026-09-29T10:15',
      note: 'Yapı Kredi World'
    },
    {
      id: 'tx-5',
      type: 'topup',
      stationId: 'po-cevre',
      stationName: 'Petrol Ofisi Çevre Yolu',
      amount: 1000.00,
      liters: null,
      unitPrice: null,
      date: '2026-09-27T09:00',
      note: 'Nakit Avans'
    },
    {
      id: 'tx-6',
      type: 'expense',
      stationId: 'po-cevre',
      stationName: 'Petrol Ofisi Çevre Yolu',
      amount: 200.00,
      liters: 4.57,
      unitPrice: 43.75,
      date: '2026-09-28T18:00',
      note: 'Şehir içi'
    }
  ]
};

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    const parsed = JSON.parse(raw);
    return {
      stations: parsed.stations || INITIAL_DATA.stations,
      transactions: parsed.transactions || INITIAL_DATA.transactions
    };
  } catch (err) {
    console.error('Failed to load storage data, using fallback:', err);
    return INITIAL_DATA;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Calculate balances per station and total
export function calculateBalances(stations, transactions) {
  const stationBalances = {};
  
  stations.forEach(s => {
    stationBalances[s.id] = {
      station: s,
      topups: 0,
      expenses: 0,
      balance: 0,
      lastActivity: null
    };
  });

  // Process transactions chronologically
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(tx => {
    if (!stationBalances[tx.stationId]) {
      stationBalances[tx.stationId] = {
        station: { id: tx.stationId, name: tx.stationName, color: '#94a3b8' },
        topups: 0,
        expenses: 0,
        balance: 0,
        lastActivity: tx.date
      };
    }

    if (tx.type === 'topup') {
      stationBalances[tx.stationId].topups += Number(tx.amount);
      stationBalances[tx.stationId].balance += Number(tx.amount);
    } else {
      stationBalances[tx.stationId].expenses += Number(tx.amount);
      stationBalances[tx.stationId].balance -= Number(tx.amount);
    }
    stationBalances[tx.stationId].lastActivity = tx.date;
  });

  let totalBalance = 0;
  let totalTopup = 0;
  let totalExpense = 0;

  Object.values(stationBalances).forEach(s => {
    totalBalance += s.balance;
    totalTopup += s.topups;
    totalExpense += s.expenses;
  });

  return {
    stationBalances,
    totalBalance,
    totalTopup,
    totalExpense
  };
}

// Format currency
export function formatTL(amount) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

// Format date
export function formatTRDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return isoString;
  }
}
