import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Share2, Download } from 'lucide-react';
import { monthRange, formatDay, formatTL, nowLocalISO, buildCSV } from '../services/storage';
import { buildFleetReport, reportCSV, reportText, REPORT_GROUPS } from '../services/report';

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700/60 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400';

function download(text, name) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Monthly fuel spend per vehicle, person or station, for the owner and the accountant.
export default function ReportView({ transactions, hasTeam }) {
  const today = nowLocalISO().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [by, setBy] = useState('plate');
  const { from, to } = monthRange(month || today.slice(0, 7));
  const report = useMemo(() => buildFleetReport(transactions, from, to, by), [transactions, from, to, by]);
  const groups = Object.entries(REPORT_GROUPS).filter(([key]) => key !== 'person' || hasTeam);
  const top = report.rows[0]?.amount || 1;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Aylık Yakıt Raporu</h2>
        <p className="text-[10px] text-slate-400">Araç, kişi ya da istasyon bazında harcama; muhasebe için Excel</p>
      </div>

      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />

      <div className="flex gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
        {groups.map(([key, g]) => (
          <button
            key={key}
            onClick={() => setBy(key)}
            className={`flex-1 py-1.5 rounded-lg font-medium transition ${
              by === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex justify-between items-end">
        <div>
          <div className="text-[10px] text-slate-400">
            {formatDay(from)} – {formatDay(to)} · {report.count} harcama
          </div>
          <div className="text-lg font-extrabold text-red-400">{formatTL(report.total)}</div>
        </div>
        {report.liters > 0 && <div className="text-xs text-slate-300">{String(report.liters).replace('.', ',')} L</div>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(reportText(report, by, from, to))}`, '_blank', 'noopener')}
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
          onClick={() => download(reportCSV(report, by, from, to), `hisapo_rapor_${month}_${by}.csv`)}
          className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" /> Excel
        </button>
      </div>
      {report.count > 0 && (
        <button
          onClick={() => download(buildCSV(report.purchases), `hisapo_harcamalar_${month}.csv`)}
          className="w-full text-[11px] text-amber-400 hover:text-amber-300"
        >
          Muhasebe için tüm harcama satırlarını indir (Excel)
        </button>
      )}

      {report.rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
          Bu ay harcama yok.
        </div>
      ) : (
        <div className="space-y-1.5">
          {report.rows.map((r) => (
            <div key={r.key || '_none'} className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 space-y-1">
              <div className="flex justify-between gap-2 text-xs">
                <span className={`font-semibold truncate ${by === 'plate' && r.key ? 'font-mono' : ''} ${r.key ? 'text-slate-100' : 'text-slate-400'}`}>
                  {r.label}
                </span>
                <span className="font-extrabold text-red-400 shrink-0">{formatTL(r.amount)}</span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.max(2, (r.amount / top) * 100)}%` }} />
              </div>
              <div className="flex justify-between gap-2 text-[10px] text-slate-400">
                <span className="truncate">
                  {r.count} işlem
                  {r.liters ? ` · ${String(r.liters).replace('.', ',')} L` : ''}
                  {r.avgPrice ? ` · ort. ${formatTL(r.avgPrice)}/L` : ''}
                  {by !== 'station' && r.stations.length ? ` · ${r.stations.join(', ')}` : ''}
                </span>
                <span className="shrink-0">%{String(r.share).replace('.', ',')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {createPortal(<PrintableReport report={report} by={by} from={from} to={to} />, document.body)}
    </div>
  );
}

function PrintableReport({ report, by, from, to }) {
  const cell = { border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' };
  const num = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };
  const g = REPORT_GROUPS[by];
  return (
    <div className="print-only" style={{ color: '#000', background: '#fff', fontSize: 11, padding: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Hisapo · Aylık Yakıt Raporu ({g.label})</h1>
      <p style={{ margin: '4px 0 12px' }}>
        {formatDay(from)} – {formatDay(to)} · Hazırlanma: {formatDay(nowLocalISO())}
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {[g.label, 'İşlem', 'Litre', 'Ort. TL/L', 'Pay', 'İstasyonlar', 'Tutar'].map((h) => (
              <th key={h} style={{ ...cell, background: '#eee' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.key || '_none'}>
              <td style={cell}>{r.fullLabel}</td>
              <td style={num}>{r.count}</td>
              <td style={num}>{r.liters ? String(r.liters).replace('.', ',') : ''}</td>
              <td style={num}>{r.avgPrice ? formatTL(r.avgPrice) : ''}</td>
              <td style={num}>%{String(r.share).replace('.', ',')}</td>
              <td style={cell}>{r.stations.join(', ')}</td>
              <td style={num}>{formatTL(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }}>Toplam</td>
            <td style={{ ...num, fontWeight: 700 }}>{report.count}</td>
            <td style={{ ...num, fontWeight: 700 }}>{report.liters ? String(report.liters).replace('.', ',') : ''}</td>
            <td style={cell} />
            <td style={num}>%100</td>
            <td style={cell} />
            <td style={{ ...num, fontWeight: 700 }}>{formatTL(report.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
