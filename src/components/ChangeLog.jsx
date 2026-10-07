import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { changeLog } from '../services/cloud';
import { describeChange, shortEmail } from '../services/changes';
import { formatTL, formatTRDate } from '../services/storage';

const ACTION_TONE = {
  create: 'bg-emerald-400',
  update: 'bg-amber-400',
  delete: 'bg-red-400'
};

// Who changed what and when, from the cloud log. Whole workspace, or one record when kind/id are given.
export default function ChangeLog({ workspaceId, kind, id, limit = 50, emptyText = 'Henüz değişiklik yok.' }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    changeLog(workspaceId, { kind, id, limit }).then(
      (r) => !cancelled && setRows(r),
      (e) => {
        if (cancelled) return;
        setErr(e.message);
        setRows([]);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId, kind, id, limit]);

  if (err) return <p className="text-[11px] text-red-300">{err}</p>;
  if (!rows) return <p className="text-[11px] text-slate-400">Yükleniyor…</p>;
  if (rows.length === 0) return <p className="text-[11px] text-slate-400">{emptyText}</p>;

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const d = describeChange(row);
        return (
          <li key={row.log_id} className="flex gap-2 text-[11px]">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${ACTION_TONE[row.action]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <span className="text-slate-200 font-semibold truncate">{d.title}</span>
                {d.amount !== null && !kind && (
                  <span className="text-slate-300 font-mono shrink-0">
                    {d.sign}
                    {formatTL(d.amount)}
                  </span>
                )}
              </div>
              {d.details.map((line) => (
                <div key={line} className="text-slate-400">
                  {line}
                </div>
              ))}
              <div className="text-slate-500">
                {shortEmail(row.changed_by_email)} · {formatTRDate(row.changed_at)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ChangeLogTitle({ children }) {
  return (
    <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
      <History className="w-3.5 h-3.5" /> {children}
    </div>
  );
}
