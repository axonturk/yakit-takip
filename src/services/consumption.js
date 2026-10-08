import { intlLocale, decimal } from '../i18n';
// Fuel consumption per vehicle from the odometer (km) entered with each purchase.
// Litres bought at a fill are counted against the km driven since the previous fill of the same plate.

export const HIGH_RATIO = 1.3; // a fill 30% above the vehicle's average is flagged
const MIN_PAIRS = 2; // need this many other measured fills before judging one

const isFill = (t) => t.type === 'expense' && !t.kind && t.plate && Number(t.odometer) > 0;

function fillsByPlate(transactions) {
  const map = new Map();
  transactions.filter(isFill).forEach((t) => {
    if (!map.has(t.plate)) map.set(t.plate, []);
    map.get(t.plate).push(t);
  });
  map.forEach((list) =>
    list.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.odometer - b.odometer)
  );
  return map;
}

// Every fill that can be measured: { tx, distance, liters, l100 }, grouped by plate.
function measuredByPlate(transactions) {
  const out = new Map();
  fillsByPlate(transactions).forEach((list, plate) => {
    const pairs = [];
    for (let i = 1; i < list.length; i++) {
      const distance = list[i].odometer - list[i - 1].odometer;
      const liters = Number(list[i].liters);
      if (distance > 0 && liters > 0) pairs.push({ tx: list[i], distance, liters, l100: (liters / distance) * 100 });
    }
    out.set(plate, pairs);
  });
  return out;
}

const round1 = (v) => Math.round(v * 10) / 10;

// The vehicle's usual L/100 km: median over its measured fills, optionally leaving one out.
// Median rather than mean, so one bad fill doesn't hide the next one.
function average(pairs, excludeId) {
  const values = pairs.filter((p) => p.tx.id !== excludeId).map((p) => p.l100).sort((a, b) => a - b);
  if (values.length < MIN_PAIRS) return null;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

// Highest km recorded for a plate (optionally only before a date), for the form hint.
export function lastOdometer(transactions, plate, beforeDate, excludeId) {
  if (!plate) return null;
  const list = (fillsByPlate(transactions).get(plate) || []).filter(
    (t) => t.id !== excludeId && (!beforeDate || String(t.date) < String(beforeDate))
  );
  return list.length ? list[list.length - 1].odometer : null;
}

// Checks a purchase being entered: km lower than before, or consumption well above the vehicle's usual.
export function checkFill(transactions, { id, plate, odometer, liters, date }) {
  const km = Number(odometer);
  if (!plate || !(km > 0)) return null;
  const prev = lastOdometer(transactions, plate, date, id);
  if (prev === null) return null;
  if (km <= prev) return { lower: true, prevKm: prev };
  const distance = km - prev;
  const lv = Number(liters);
  if (!(lv > 0)) return { distance };
  const l100 = (lv / distance) * 100;
  const avg = average(measuredByPlate(transactions).get(plate) || [], id);
  const result = { distance, l100: round1(l100) };
  if (avg) {
    result.avg = round1(avg);
    if (l100 > avg * HIGH_RATIO) result.high = Math.round((l100 / avg - 1) * 100);
  }
  return result;
}

// Ids of saved purchases whose consumption is well above their vehicle's average, with the numbers.
export function highFills(transactions) {
  const flagged = new Map();
  measuredByPlate(transactions).forEach((pairs) => {
    pairs.forEach((p) => {
      const avg = average(pairs, p.tx.id);
      if (avg && p.l100 > avg * HIGH_RATIO) {
        flagged.set(p.tx.id, { l100: round1(p.l100), avg: round1(avg), pct: Math.round((p.l100 / avg - 1) * 100) });
      }
    });
  });
  return flagged;
}

// Km driven and L/100 km per plate for fills dated within [from, to] (days, inclusive).
export function periodConsumption(transactions, from, to) {
  const out = new Map();
  measuredByPlate(transactions).forEach((pairs, plate) => {
    let liters = 0;
    let km = 0;
    pairs.forEach((p) => {
      const day = String(p.tx.date).slice(0, 10);
      if (day < from || day > to) return;
      liters += p.liters;
      km += p.distance;
    });
    if (km > 0) out.set(plate, { km, l100: round1((liters / km) * 100) });
  });
  return out;
}

export function formatKm(km) {
  return `${new Intl.NumberFormat(intlLocale()).format(km)} km`;
}

export function formatL100(v) {
  return `${decimal(v)} L/100 km`;
}
