import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download } from 'lucide-react';
import { monthRange, formatDay, formatTL, nowLocalISO, buildCSV } from '../services/storage';
import WhatsAppShare from './WhatsAppShare';
import { t, decimal, volUnit, volLabel, distLabel } from '../i18n';
import { formatKm, formatL100, consumptionUnit } from '../services/consumption';
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
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{t('Aylık Yakıt Raporu')}</h2>
        <p className="text-[10px] text-slate-400">{t('Araç, kişi ya da istasyon bazında harcama; muhasebe için Excel')}</p>
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
            {formatDay(from)} – {formatDay(to)} · {t('{n} harcama', { n: report.count })}
          </div>
          <div className="text-lg font-extrabold text-red-400">{formatTL(report.total)}</div>
        </div>
        {report.liters > 0 && <div className="text-xs text-slate-300">{decimal(report.liters)} {volUnit()}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <WhatsAppShare
          text={reportText(report, by, from, to)}
          file={{ content: reportCSV(report, by, from, to), name: `${t('hisapo_rapor')}_${month}_${by}.csv` }}
        />
        <button
          onClick={() => window.print()}
          className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" /> PDF
        </button>
        <button
          onClick={() => download(reportCSV(report, by, from, to), `${t('hisapo_rapor')}_${month}_${by}.csv`)}
          className="py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" /> Excel
        </button>
      </div>
      {report.count > 0 && (
        <button
          onClick={() => download(buildCSV(report.purchases), `${t('hisapo_harcamalar')}_${month}.csv`)}
          className="w-full text-[11px] text-amber-400 hover:text-amber-300"
        >
          {t('Muhasebe için tüm harcama satırlarını indir (Excel)')}
        </button>
      )}

      {report.rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
          {t('Bu ay harcama yok.')}
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
                  {t('{n} işlem', { n: r.count })}
                  {r.liters ? ` · ${decimal(r.liters)} ${volUnit()}` : ''}
                  {r.avgPrice ? ` · ${t('ort. {v}/{vol}', { v: formatTL(r.avgPrice) })}` : ''}
                  {by !== 'station' && r.stations.length ? ` · ${r.stations.join(', ')}` : ''}
                </span>
                <span className="shrink-0">{t('%{n}', { n: decimal(r.share) })}</span>
              </div>
              {(r.km || r.high > 0) && (
                <div className="flex flex-wrap gap-x-2 text-[10px]">
                  {r.km && (
                    <span className="text-slate-300">
                      {formatKm(r.km)} · <b>{formatL100(r.l100)}</b>
                    </span>
                  )}
                  {r.high > 0 && <span className="text-amber-300 font-semibold">⚠ {t('{n} yüksek tüketimli alış', { n: r.high })}</span>}
                </div>
              )}
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
      <h1 style={{ fontSize: 18, margin: 0 }}>Hisapo · {t('Aylık Yakıt Raporu')} ({g.label})</h1>
      <p style={{ margin: '4px 0 12px' }}>
        {formatDay(from)} – {formatDay(to)} · {t('Hazırlanma: {d}', { d: formatDay(nowLocalISO()) })}
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {[g.label, t('İşlem'), volLabel(), t('Ort. {cur}/{vol}'), t('Pay'), t('İstasyonlar'), ...(by === 'plate' ? [distLabel(), consumptionUnit()] : []), t('Tutar')].map((h) => (
              <th key={h} style={{ ...cell, background: '#eee' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.key || '_none'}>
              <td style={cell}>{r.fullLabel}</td>
              <td style={num}>{r.count}</td>
              <td style={num}>{r.liters ? decimal(r.liters) : ''}</td>
              <td style={num}>{r.avgPrice ? formatTL(r.avgPrice) : ''}</td>
              <td style={num}>{t('%{n}', { n: decimal(r.share) })}</td>
              <td style={cell}>{r.stations.join(', ')}</td>
              {by === 'plate' && <td style={num}>{r.km ? formatKm(r.km) : ''}</td>}
              {by === 'plate' && <td style={num}>{r.l100 ? `${decimal(r.l100)}${r.high ? ' ⚠' : ''}` : ''}</td>}
              <td style={num}>{formatTL(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 700 }}>{t('Toplam')}</td>
            <td style={{ ...num, fontWeight: 700 }}>{report.count}</td>
            <td style={{ ...num, fontWeight: 700 }}>{report.liters ? decimal(report.liters) : ''}</td>
            <td style={cell} />
            <td style={num}>{t('%{n}', { n: 100 })}</td>
            <td style={cell} />
            {by === 'plate' && <td style={cell} />}
            {by === 'plate' && <td style={cell} />}
            <td style={{ ...num, fontWeight: 700 }}>{formatTL(report.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
