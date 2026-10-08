import React, { useState } from 'react';
import { Pencil, X, AlertCircle } from 'lucide-react';
import PhotoPicker from './PhotoPicker';
import ChangeLog, { ChangeLogTitle } from './ChangeLog';
import { formatTL, transactionLabel, FUEL_TYPES, PAYMENT_METHODS } from '../services/storage';
import { checkFill, lastOdometer } from '../services/consumption';
import KmField, { FillNotice } from './KmField';

const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400';

export default function EditTransactionModal({ transaction, stations, plates = [], transactions = [], onClose, onSave, workspaceId }) {
  if (!transaction) return null;
  // Keyed by id so the form resets for each transaction opened
  return (
    <EditForm
      key={transaction.id}
      tx={transaction}
      stations={stations}
      plates={plates}
      transactions={transactions}
      onClose={onClose}
      onSave={onSave}
      workspaceId={workspaceId}
    />
  );
}

function EditForm({ tx, stations, plates, transactions, onClose, onSave, workspaceId }) {
  const isExpense = tx.type === 'expense';
  const [stationId, setStationId] = useState(tx.stationId);
  const [amount, setAmount] = useState(String(tx.amount ?? ''));
  const [liters, setLiters] = useState(tx.liters != null ? String(tx.liters) : '');
  const [unitPrice, setUnitPrice] = useState(tx.unitPrice != null ? String(tx.unitPrice) : '');
  const [plate, setPlate] = useState(tx.plate || '');
  const [odometer, setOdometer] = useState(tx.odometer ? String(tx.odometer) : '');
  const [datetime, setDatetime] = useState(tx.date || '');
  const [note, setNote] = useState(tx.note || '');
  const [receiptNo, setReceiptNo] = useState(tx.receiptNo || '');
  const [fuelType, setFuelType] = useState(tx.fuelType || '');
  const [paymentMethod, setPaymentMethod] = useState(tx.paymentMethod || '');
  const [errorMsg, setErrorMsg] = useState(null);
  // undefined = keep current photo, Blob = replace, null = remove
  const [photo, setPhoto] = useState(undefined);

  // The current station stays selectable even if it was archived later
  const stationOptions = stations.some((s) => s.id === tx.stationId)
    ? stations
    : [{ id: tx.stationId, name: tx.stationName }, ...stations];

  const recalcAmount = (l, p) => {
    const lv = parseFloat(l);
    const pv = parseFloat(p);
    if (lv > 0 && pv > 0) setAmount((lv * pv).toFixed(2));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Lütfen geçerli bir tutar girin!');
      return;
    }

    const next = {
      stationId,
      amount: parsedAmount,
      date: datetime,
      note: note.trim(),
      receiptNo: receiptNo.trim() || null
    };
    if (isExpense) {
      next.liters = liters ? parseFloat(liters) : null;
      next.unitPrice = unitPrice ? parseFloat(unitPrice) : null;
      next.plate = plate.trim().toUpperCase() || null;
      next.odometer = odometer ? parseInt(odometer, 10) : null;
      next.fuelType = fuelType || null;
    } else {
      next.paymentMethod = paymentMethod || null;
    }

    // Only record fields that actually changed
    const changes = {};
    Object.keys(next).forEach((k) => {
      if ((next[k] ?? null) !== (tx[k] ?? null)) changes[k] = next[k];
    });
    const photoChanged = photo !== undefined && !(photo === null && !tx.photoId);
    if (Object.keys(changes).length > 0 || photoChanged) onSave(tx.id, changes, photoChanged ? photo : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col p-5 shadow-2xl">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">İşlemi Düzenle</h2>
              <p className="text-[10px] text-slate-400">
                {transactionLabel(tx)} · eski değerler geçmişte saklanır
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">İstasyon</label>
            <select value={stationId} onChange={(e) => setStationId(e.target.value)} className={inputClass}>
              {stationOptions.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-amber-400 mb-1">Tutar (TL)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} text-base font-extrabold`}
            />
          </div>

          {isExpense && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Litre</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={liters}
                    onChange={(e) => {
                      setLiters(e.target.value);
                      recalcAmount(e.target.value, unitPrice);
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Birim Fiyat (TL/L)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => {
                      setUnitPrice(e.target.value);
                      recalcAmount(liters, e.target.value);
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Plaka (opsiyonel)</label>
                  <input
                    type="text"
                    list="edit-plates"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Örn: 34 ABC 123"
                    className={`${inputClass} uppercase`}
                  />
                  <datalist id="edit-plates">
                    {plates.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                <KmField
                  value={odometer}
                  onChange={setOdometer}
                  lastKm={lastOdometer(transactions, plate.trim().toUpperCase(), datetime, tx.id)}
                  disabled={!plate.trim()}
                />
              </div>
              <FillNotice
                check={checkFill(transactions, {
                  id: tx.id,
                  plate: plate.trim().toUpperCase(),
                  odometer,
                  liters,
                  date: datetime
                })}
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            {isExpense ? (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Yakıt Türü</label>
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={inputClass}>
                  <option value="">Seçilmedi</option>
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Ödeme Yöntemi</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  <option value="">Seçilmedi</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Fiş / Belge No</label>
              <input type="text" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tarih & Saat</label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Not</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
          </div>

          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            existingId={tx.photoId}
            label={isExpense ? 'Fiş fotoğrafı' : 'Dekont fotoğrafı'}
          />

          {workspaceId ? (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 space-y-2">
              <ChangeLogTitle>Kim, ne zaman değiştirdi</ChangeLogTitle>
              <ChangeLog workspaceId={workspaceId} kind="tx" id={tx.id} limit={10} emptyText="Bu kayıt henüz buluta gitmedi." />
            </div>
          ) : tx.edits?.length > 0 && (
            <div className="text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 space-y-0.5">
              <div className="font-semibold text-slate-300">Değişiklik geçmişi</div>
              {tx.edits.map((ed, i) => (
                <div key={i}>
                  {ed.at.replace('T', ' ')}
                  {ed.before.amount != null ? ` · önceki tutar ${formatTL(ed.before.amount)}` : ''}
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition active:scale-[0.98]"
          >
            DEĞİŞİKLİKLERİ KAYDET
          </button>
        </form>
      </div>
    </div>
  );
}
