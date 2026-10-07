import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Share2, Download } from 'lucide-react';
import {
  buildStatement,
  statementText,
  monthRange,
  formatDay,
  formatTL,
  transactionLabel,
  buildCSV,
  nowLocalISO
} from '../services/storage';

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700/60 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400';

export default function StatementView({ stations, transactions, defaultStationId }) {
  const today = nowLocalISO().slice(0, 10);
  const [stationId, setStationId] = useState(
    defaultStationId || stations.find((s) => !s.archived)?.id || stations[0]?.id || ''
  );
  const [mode, setMode] = useState('month'); // 'month' | 'range'
  const [month, setMonth] = useState(today.slice(0, 7));
  const [rangeFrom, setRangeFrom] = useState(`${today.slice(0, 7)}-01`);
  const [rangeTo, setRangeTo] = useState(today);

  const { from, to } = mode === 'month' ? monthRange(month || today.slice(0, 7)) : { from: rangeFrom, to: rangeTo };
  const station = stations.find((s) => s.id === stationId);
  const stationName = station?.name || '';

  const s = useMemo(
    () => buildStatement(transactions, stationId, from, to),
    [transactions, stationId, from, to]
  );

  if (stations.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
        Ekstre için önce bir istasyon ekleyin.
      </div>
    );
  }

  const handleShare = () => {
    const text = statementText(stationName, from, to, s);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const handleCSV = () => {
    const blob = new Blob([buildCSV(s.rows.map((r) => r.tx))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hisapo_ekstre_${stationName.replace(/\s+/g, '_')}_${from}_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const summary = [
    { label: 'Devir', value: s.opening, cls: 'text-slate-200' },
    { label: `+ Yüklenen (${s.topupCount})`, value: s.topups, cls: 'text-emerald-400' },
    { label: `− Tüketim (${s.expenseCount})`, value: s.expenses, cls: 'text-red-400' },
    { label: '= Kapanış', value: s.closing, cls: s.closing < 0 ? 'text-red-300' : 'text-amber-300' }
  ];

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Dönem Ekstresi</h2>
        <p className="text-[10px] text-slate-400">İstasyonla ay sonu mutabakatı için</p>
      </div>

      <select value={stationId} onChange={(e) => setStationId(e.target.value)} className={inputClass}>
        {stations.map((st) => (
          <option key={st.id} value={st.id}>
            {st.name}
            {st.archived ? ' (arşiv)' : ''}
          </option>
        ))}
      </select>

      <div className="flex gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
        {[
          ['month', 'Ay'],
          ['range', 'Tarih aralığı']
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 py-1.5 rounded-lg font-medium transition ${
              mode === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'month' ? (
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className={inputClass} />
          <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className={inputClass} />
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
        <div className="text-[10px] text-slate-400">
          {stationName} · {formatDay(from)} – {formatDay(to)}
        </div>
        {summary.map((row) => (
          <div key={row.label} className="flex justify-between text-xs">
            <span className="text-slate-400">{row.label}</span>
            <span className={`font-bold ${row.cls}`}>{formatTL(row.value)}</span>
          </div>
        ))}
        {s.liters > 0 && (
          <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800">
            <span className="text-slate-500">Toplam yakıt</span>
            <span className="text-slate-300">{String(s.liters).replace('.', ',')} L</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleShare}
          className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
        >
          <Share2 className="w-3.5 h-3.5" /> WhatsApp
        </button>
        <button
          onClick={() => window.print()}
          className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" /> PDF
        </button>
        <button
          onClick={handleCSV}
          className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" /> Excel
        </button>
      </div>

      <div className="space-y-1.5">
        {s.rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
            Bu dönemde hareket yok.
          </div>
        ) : (
          s.rows.map(({ tx, balance }) => {
            const isExpense = tx.type === 'expense';
            return (
              <div
                key={tx.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 flex justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-200 font-semibold">
                    {formatDay(tx.date)} {tx.date.slice(11, 16)} · {transactionLabel(tx)}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {[tx.plate, tx.liters && `${tx.liters} L`, tx.receiptNo && `Fiş ${tx.receiptNo}`, tx.note]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-extrabold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isExpense ? '−' : '+'}
                    {formatTL(tx.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400">Bakiye {formatTL(balance)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {createPortal(<PrintableStatement stationName={stationName} from={from} to={to} s={s} />, document.body)}
    </div>
  );
}

// Light, table-based copy that only shows when printing (Save as PDF).
function PrintableStatement({ stationName, from, to, s }) {
  const cell = { border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' };
  const num = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <div className="print-only" style={{ color: '#000', background: '#fff', fontSize: 11, padding: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Hisapo · Dönem Ekstresi</h1>
      <p style={{ margin: '4px 0 12px' }}>
        <strong>{stationName}</strong> · {formatDay(from)} – {formatDay(to)} · Hazırlanma: {formatDay(nowLocalISO())}
      </p>
      <table style={{ borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <tr><td style={cell}>Devir</td><td style={num}>{formatTL(s.opening)}</td></tr>
          <tr><td style={cell}>+ Yüklenen ({s.topupCount} işlem)</td><td style={num}>{formatTL(s.topups)}</td></tr>
          <tr><td style={cell}>− Tüketim ({s.expenseCount} işlem{s.liters ? `, ${String(s.liters).replace('.', ',')} L` : ''})</td><td style={num}>{formatTL(s.expenses)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700 }}>= Kapanış</td><td style={{ ...num, fontWeight: 700 }}>{formatTL(s.closing)}</td></tr>
        </tbody>
      </table>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Tarih', 'İşlem', 'Plaka', 'Litre', 'Fiş No', 'Not', 'Tutar', 'Bakiye'].map((h) => (
              <th key={h} style={{ ...cell, background: '#eee' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.rows.map(({ tx, balance }) => (
            <tr key={tx.id}>
              <td style={cell}>{formatDay(tx.date)} {tx.date.slice(11, 16)}</td>
              <td style={cell}>{transactionLabel(tx)}</td>
              <td style={cell}>{tx.plate || ''}</td>
              <td style={num}>{tx.liters ?? ''}</td>
              <td style={cell}>{tx.receiptNo || ''}</td>
              <td style={cell}>{tx.note || ''}</td>
              <td style={num}>{tx.type === 'expense' ? '−' : '+'}{formatTL(tx.amount)}</td>
              <td style={num}>{formatTL(balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, color: '#555' }}>
        İstasyon kayıtlarıyla karşılaştırınız. Farklılık varsa fiş numarası üzerinden kontrol edebilirsiniz.
      </p>
      <p style={{ marginTop: 32 }}>İşletme: ______________________ &nbsp;&nbsp;&nbsp; İstasyon: ______________________</p>
    </div>
  );
}
