// Reads a Turkish fuel receipt (text from the phone's OCR) into form fields.
// Receipts differ by station and cash register, so every field is optional and
// litres × price is checked against the total before anything is trusted.

// "1.083,00" / "1083,00" / "1,083.00" / "44,73" → number
export function parseTRNumber(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).replace(/[*₺\s]|TL/gi, '').replace(/[Oo]/g, '0');
  if (!/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, '');
  } else if (lastDot !== -1 && lastComma === -1) {
    // "1.083" is a thousands dot when exactly three digits follow and nothing else does
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NUM = '(\\d{1,3}(?:[.\\s]\\d{3})*[.,]\\d{1,3}|\\d+[.,]\\d{1,3}|\\d+)';

// Upper-cases Turkish text and evens out characters OCR often swaps.
function normalise(text) {
  return String(text || '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/[ÇĞÖŞÜ]/g, (c) => ({ Ç: 'C', Ğ: 'G', Ö: 'O', Ş: 'S', Ü: 'U' })[c])
    .replace(/[ \t]+/g, ' ');
}

const close = (a, b, tolerance = 0.02) => a > 0 && b > 0 && Math.abs(a - b) / b <= tolerance;

function findTotal(lines) {
  const candidates = [];
  lines.forEach((line, i) => {
    if (!/TOPLAM|TUTAR|TOTAL|GENEL/.test(line)) return;
    if (/KDV|ARA ?TOPLAM|INDIRIM|PARA USTU/.test(line)) return;
    // The amount is usually on the same line, otherwise on the next one
    const same = [...line.matchAll(new RegExp(NUM, 'g'))].map((m) => parseTRNumber(m[1]));
    const next = lines[i + 1] && !/KDV/.test(lines[i + 1]) ? [...lines[i + 1].matchAll(new RegExp(NUM, 'g'))].map((m) => parseTRNumber(m[1])) : [];
    const nums = (same.length ? same : next).filter((n) => n > 0);
    if (nums.length) candidates.push({ value: nums[nums.length - 1], strong: /TOPLAM/.test(line) });
  });
  if (!candidates.length) return null;
  const strong = candidates.filter((c) => c.strong);
  return Math.max(...(strong.length ? strong : candidates).map((c) => c.value));
}

function findLitresAndPrice(text, lines) {
  // "24,214 LT X 44,73" or "24,214 X 44,73 TL" (quantity × unit price on one line)
  const pair = new RegExp(`${NUM}\\s*(?:LT|LITRE|L)?\\s*[X×*]\\s*${NUM}`);
  for (const line of lines) {
    const m = line.match(pair);
    if (m) {
      const a = parseTRNumber(m[1]);
      const b = parseTRNumber(m[2]);
      if (a > 0 && b > 0) return /LT|LITRE| L /.test(line.slice(0, m.index + m[0].length)) || b < 200 ? { liters: a, unitPrice: b } : { liters: b, unitPrice: a };
    }
  }
  let liters = null;
  let unitPrice = null;
  for (const line of lines) {
    if (liters === null && /MIKTAR|LITRE|\bLT\b/.test(line) && !/FIYAT/.test(line)) {
      const m = line.match(new RegExp(`${NUM}\\s*(?:LT|LITRE|L\\b)`)) || line.match(new RegExp(`(?:MIKTAR|LITRE)[^\\d]*${NUM}`));
      if (m) liters = parseTRNumber(m[1]);
    }
    if (unitPrice === null && /FIYAT|TL\/L|TL \/ L/.test(line)) {
      const m = line.match(new RegExp(`(?:FIYAT)[^\\d]*${NUM}`)) || line.match(new RegExp(`${NUM}\\s*TL\\s*/\\s*L`));
      if (m) unitPrice = parseTRNumber(m[1]);
    }
  }
  return { liters, unitPrice, text };
}

function findPlate(text) {
  // Turkish plates: province 01–81, 1–3 letters, 2–4 digits
  const m = text.match(/(?:PLAKA[^\dA-Z]*)?\b(0[1-9]|[1-7]\d|8[01]) ?([A-Z]{1,3}) ?(\d{2,4})\b/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
}

function findDate(text) {
  const d = text.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (!d) return null;
  // Time: prefer hh:mm, and never the day.month part of the date itself
  const rest = text.replace(d[0], ' ');
  const t = rest.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/) || rest.match(/\b([01]\d|2[0-3])\.([0-5]\d)\b(?![.,]\d)/);
  const [, day, month, year] = d;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}T${t ? `${t[1]}:${t[2]}` : '12:00'}`;
}

function findReceiptNo(lines) {
  for (const line of lines) {
    const m = line.match(/(?:FIS|FIS NO|BELGE NO|FIS NU)\s*(?:NO|NU)?[:.\s]*([0-9]{1,8})\b/);
    if (m && !/Z NO/.test(line)) return m[1].replace(/^0+(?=\d)/, '');
  }
  return null;
}

function findFuel(text) {
  if (/LPG|OTOGAZ|AUTOGAS/.test(text)) return 'LPG';
  if (/MOTORIN|DIZEL|DIESEL|EURODIESEL|ULTRAFORCE D|V\/MAX D/.test(text)) return 'Motorin';
  if (/BENZIN|KURSUNSUZ|95 OKTAN|97 OKTAN|V\/MAX 95/.test(text)) return 'Benzin';
  return null;
}

// Returns only the fields it is reasonably sure of; the form fills these and leaves the rest.
export function parseReceipt(rawText) {
  const text = normalise(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = {};

  let amount = findTotal(lines);
  let { liters, unitPrice } = findLitresAndPrice(text, lines);
  // Fuel prices are tens of lira per litre; anything else is a misread
  if (unitPrice !== null && !(unitPrice >= 5 && unitPrice <= 500)) unitPrice = null;
  if (liters !== null && !(liters > 0 && liters <= 2000)) liters = null;

  if (liters && unitPrice && amount && !close(liters * unitPrice, amount)) {
    // Keep the pair that agrees; the total line is the most reliable on fiscal receipts
    if (close(amount / unitPrice, liters, 0.05)) liters = Math.round((amount / unitPrice) * 100) / 100;
    else unitPrice = null;
  }
  if (!amount && liters && unitPrice) amount = Math.round(liters * unitPrice * 100) / 100;
  if (amount && unitPrice && !liters) liters = Math.round((amount / unitPrice) * 100) / 100;

  if (amount) out.amount = amount;
  if (liters) out.liters = liters;
  if (unitPrice) out.unitPrice = unitPrice;
  const plate = findPlate(text);
  if (plate) out.plate = plate;
  const date = findDate(text);
  if (date) out.date = date;
  const receiptNo = findReceiptNo(lines);
  if (receiptNo) out.receiptNo = receiptNo;
  const fuel = findFuel(text);
  if (fuel) out.fuelType = fuel;
  return out;
}
