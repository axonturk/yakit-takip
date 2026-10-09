// Reads a fuel receipt (text from the phone's OCR) into form fields.
// Receipts differ by country, station and cash register, so every field is optional and
// quantity × price is checked against the total before anything is trusted.
// country: 'TR' (default), 'US', 'IN' or any other code; it sets number style, price range and date order.

// "1.083,00" / "1083,00" / "1,083.00" / "44,73" → number.
// dotThousands: on Turkish receipts "1.083" is a thousand; elsewhere "1.649" is a price.
export function parseTRNumber(raw, { dotThousands = true } = {}) {
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
    if (dotThousands && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NUM = '(\\d{1,3}(?:[.\\s]\\d{3})*[.,]\\d{1,3}|\\d+[.,]\\d{1,3}|\\d+)';
const CUR = '(?:EUR|€|\\$|USD|RM|RS\\.?|INR|₹|TL|AED|£|GBP|AUD|MYR)';

// Words that mark each field, in Turkish, English, French, Spanish, German and Dutch
const TOTAL_WORDS = /TOPLAM|TUTAR|TOTAL|GENEL|TOT\.? ?TTC|MONTANT|IMPORTE|SUMME|BETRAG|GESAMT|TOTAAL|AMOUNT|\bSALE\b|BRANDSTOF/;
const STRONG_TOTAL = /TOPLAM|TOTAL|TOT\.? ?TTC|SUMME|TOTAAL|AMOUNT|\bSALE\b|MONTANT.?.?REEL/;
const NOT_TOTAL = /KDV|ARA ?TOPLAM|INDIRIM|PARA USTU|TVA|MWST|MW?ST|\bIVA\b|BTW|GST|\bTAX\b|SUB ?TOTA|\bNET\b|NETTO|EXCL|PREPAY|ROUNDING|CHANGE|RELIEF|BASE|POINTS|VAT/;
const PAYMENT = /NAKIT|KREDI|KART|CASH|VISA|DEBIT|CARTE|CARD|TARJETA|MASTERCARD|\bPIN\b|BANCAIRE|EFECTIVO|BAR\b|UPI/;
const VOLUME_WORDS = /MIKTAR|LITRE|\bLT\b|VOLUME|QUANTIT|\bQTY\b|LITROS|MENGE|GALLONS|LITER/;
const PRICE_WORDS = /FIYAT|PRIX|PRICE|RATE|PREIS|PRECIO|\bP\.? ?U\b|EUR ?\/ ?L|€ ?\/ ?L|\/ ?L\b|\/ ?LT|\/ ?G\b|\/ ?GAL|\/ ?LITRE/;
const VOLUME_UNIT = '(?:LTRS?|LT|LITRES?|LITERS?|LITROS?|LIT|GALLONS?|GAL|L|G|ℓ)';

function profile(country = 'TR') {
  const c = String(country || 'TR').toUpperCase();
  if (c === 'TR') return { dotThousands: true, price: [5, 500], monthFirst: false };
  if (c === 'IN') return { dotThousands: false, price: [50, 200], monthFirst: false };
  if (c === 'US') return { dotThousands: false, price: [1, 8], monthFirst: true };
  // Euro, pound, dirham, ringgit…: a litre costs between half a unit and a few units
  return { dotThousands: false, price: [0.5, 5], monthFirst: false };
}

// Upper-cases the text and evens out characters OCR often swaps.
function normalise(text) {
  return String(text || '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/[ÇĞÖŞÜÀÂÄÉÈÊËÎÏÔÙÛÑÁÍÓÚ]/g, (c) => 'CGOSUAAAEEEEIIOUUNAIOU'['ÇĞÖŞÜÀÂÄÉÈÊËÎÏÔÙÛÑÁÍÓÚ'.indexOf(c)])
    .replace(/[ \t]+/g, ' ')
    // "*600, 00" / "85. 54": OCR often puts a space after the decimal mark
    .replace(/(\d)([.,]) (\d{2})\b/g, '$1$2$3')
    // "$57 .80": and a space before it
    .replace(/(\d) ([.,]\d)/g, '$1$2')
    // "32 67 L": the decimal mark lost before a volume unit
    .replace(/\b(\d{1,3}) (\d{2}) ?(L|LT|LTR)\b/g, '$1.$2 $3')
    // "2.200 RM [LITRE": a slash read as a bracket or bar
    .replace(/(\d\s*(?:[A-Z€$]{1,3}\.?)?\s*)[[|](\s*(?:LITRE|LITER|LTR|LT|L|G|GAL)\b)/g, '$1/$2');
}

const close = (a, b, tolerance = 0.02) => a > 0 && b > 0 && Math.abs(a - b) / b <= tolerance;

function numbersIn(line, p) {
  return [...line.matchAll(new RegExp(NUM, 'g'))].map((m) => parseTRNumber(m[1], p)).filter((n) => n > 0);
}

function decimalsIn(line, p) {
  return [...line.matchAll(new RegExp(NUM, 'g'))]
    .filter((m) => /[.,]\d{2}$/.test(m[1]))
    .map((m) => parseTRNumber(m[1], p))
    .filter((n) => n > 0);
}

function findTotal(lines, p) {
  const candidates = [];
  lines.forEach((line, i) => {
    // Payment lines (cash, card) repeat the total and help when the total line is misread
    const payment = PAYMENT.test(line);
    if (!payment && !TOTAL_WORDS.test(line)) return;
    if (NOT_TOTAL.test(line)) return;
    // The amount is usually on the same line, otherwise on the next one
    // and it has decimals: "TOTAL 58,29€ V1 5H" is 58,29, not 5
    // Abroad a total always has decimals; "A0000000421010" under "CARTE BANCAIRE" is a card id
    const pick = (l) => (decimalsIn(l, p).length || !p.dotThousands ? decimalsIn(l, p) : numbersIn(l, p));
    const same = pick(line);
    const next = lines[i + 1] && !NOT_TOTAL.test(lines[i + 1]) ? pick(lines[i + 1]) : [];
    const nums = same.length ? same : next;
    if (nums.length) candidates.push({ value: nums[nums.length - 1], strong: !payment && STRONG_TOTAL.test(line) });
  });
  if (!candidates.length) return null;
  const strong = candidates.filter((c) => c.strong);
  return Math.max(...(strong.length ? strong : candidates).map((c) => c.value));
}

function allNumbers(lines, p) {
  return lines.flatMap((line) => numbersIn(line, p));
}

function findLitresAndPrice(lines, p) {
  // "24,214 LT X 44,73", "13.77 ℓ * € 1.579", "12.457 G @ $3.299" (quantity × unit price on one line)
  // Not "%20 *600,00" (VAT rate and amount, "%" often read as "X"): no number glued to a letter or "%",
  // and "*" only counts as "×" right after a volume unit.
  // A lone digit before "@" is a misread unit ("21.330 6 @ $2.989" for "21.330 G @"), and a short
  // unreadable word before "X" usually is too ("15,19 İLİ X 37,990").
  const pair = new RegExp(`(?<![%A-Z\\d.,])${NUM}\\s*(${VOLUME_UNIT}\\b|\\d(?= ?@))?\\s*(?:[A-Z]{1,3}\\s+)?([X×*@])\\s*${CUR}?\\s*${NUM}`);
  for (const line of lines) {
    const m = line.match(pair);
    // Abroad both numbers carry decimals ("25.00 L x EUR 2.420"); "3 X 14" is something else
    const decimals = p.dotThousands || (/[.,]\d/.test(m?.[1]) && /[.,]\d/.test(m?.[4]));
    if (m && (m[3] !== '*' || m[2]) && decimals) {
      const a = parseTRNumber(m[1], p);
      const b = parseTRNumber(m[4], p);
      if (a > 0 && b > 0) {
        const unitFirst = Boolean(m[2]) || /LT|LITRE| L /.test(line.slice(0, m.index + m[0].length));
        return unitFirst || (b >= p.price[0] && b <= p.price[1]) ? { liters: a, unitPrice: b } : { liters: b, unitPrice: a };
      }
    }
  }
  let liters = null;
  let unitPrice = null;
  for (const line of lines) {
    if (liters === null && VOLUME_WORDS.test(line) && !PRICE_WORDS.test(line)) {
      const m =
        line.match(new RegExp(`${NUM}\\s*${VOLUME_UNIT}\\b`)) ||
        line.match(new RegExp(`(?:MIKTAR|LITRE|VOLUME|QUANTITE|QUANTITY|QTY|LITROS|MENGE|GALLONS|LITER)[^\\d]*${NUM}`));
      // Abroad volumes have decimals: "#4 LITROS" in a column header is not 4 litres
      if (m && (p.dotThousands || /[.,]\d/.test(m[1]))) liters = parseTRNumber(m[1], p);
    }
    // "15,79 LÜX GTA": the line starts with the litres even when the rest is unreadable
    if (liters === null) {
      const m = line.match(new RegExp(`^${NUM}\\s*L`));
      if (m && /[.,]\d{2}/.test(m[1])) liters = parseTRNumber(m[1], p);
    }
    if (unitPrice === null && PRICE_WORDS.test(line)) {
      const label = line.match(/FIYAT|PRIX(?: UNIT\.?)?|PRICE(?: ?\/ ?GAL)?|RATE(?: ?\(RS ?\/ ?L\))?|PREIS|PRECIO/);
      const perUnit = line.match(new RegExp(`${NUM}\\s*(?:(?:${CUR}|[A-Z]{1,3}\\.?)\\s*)?\\/\\s*1?(?:L|LT|LIT|G|GAL|LITRE|LITER)\\b`));
      // After the label, the first number that can be a fuel price ("RATE (RS/L) 3 94.72": not the 3)
      const afterLabel = label
        ? [...line.slice(label.index + label[0].length).matchAll(new RegExp(NUM, 'g'))]
            .filter((m) => p.dotThousands || /[.,]\d/.test(m[1]))
            .map((m) => parseTRNumber(m[1], p))
        : [];
      const fits = afterLabel.find((n) => n >= p.price[0] && n <= p.price[1]);
      if (fits) unitPrice = fits;
      else if (perUnit) unitPrice = parseTRNumber(perUnit[1], p);
      else if (afterLabel.length) unitPrice = afterLabel[0];
    }
  }
  // Column layout: "PRODUCTO €/L LITROS IMPORTE" with the values on the next line
  if (liters === null) {
    lines.forEach((line, i) => {
      const words = line.split(' ');
      const at = words.findIndex((w) => /^(?:LITROS|LITRES|LITERS|LITRE|VOLUME|QTY|MENGE|CANT\S*)$/.test(w));
      const values = lines[i + 1] ? [...lines[i + 1].matchAll(new RegExp(NUM, 'g'))].filter((m) => /[.,]\d/.test(m[1])).map((m) => parseTRNumber(m[1], p)) : [];
      const after = words.length - 1 - at;
      if (liters === null && at >= 0 && values.length > after) liters = values[values.length - 1 - after];
    });
  }
  return { liters, unitPrice };
}

// No readable total: French and other receipts print the amount before VAT and the VAT separately
function totalFromNetAndVat(lines, p) {
  const last = (re) => {
    const line = lines.find((l) => re.test(l) && !/TOTAL/.test(l));
    const nums = line ? decimalsIn(line, p) : [];
    return nums.length ? nums[nums.length - 1] : null;
  };
  const net = last(/\bNET\b|NETTO|SUBTOTAAL|SUB ?TOTAL/);
  const vat = last(/\bTVA\b|\bIVA\b|MWST|\bBTW\b|\bVAT\b|\bKDV\b/);
  return net && vat && vat < net ? Math.round((net + vat) * 100) / 100 : null;
}

// Digits that differ by one added, dropped or changed character ("121.330" for "21.330")
function oneDigitOff(a, b) {
  const x = a.toFixed(2).replace('.', '');
  const y = b.toFixed(2).replace('.', '');
  if (Math.abs(x.length - y.length) > 1) return false;
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  const tail = (s, n) => s.slice(n);
  return tail(x, i + 1) === tail(y, i + 1) || tail(x, i + 1) === tail(y, i) || tail(x, i) === tail(y, i + 1);
}

// Last resort: three numbers on the receipt where quantity × price = total.
// Labelled numbers count more, so a VAT line that happens to multiply out does not win.
function findTriple(lines, p, hints) {
  const nums = [];
  lines.forEach((line) => {
    for (const m of line.matchAll(new RegExp(NUM, 'g'))) {
      if (!/[.,]\d/.test(m[1])) continue;
      const v = parseTRNumber(m[1], p);
      if (v > 0) nums.push({ v, line });
    }
  });
  let best = null;
  for (const q of nums) {
    if (!(q.v > 0.5 && q.v <= 2000)) continue;
    for (const u of nums) {
      if (u === q || !(u.v >= p.price[0] && u.v <= p.price[1])) continue;
      const want = q.v * u.v;
      for (const t of nums) {
        if (t === q || t === u || t.v <= q.v * 1.01 || t.v <= u.v * 1.01 || !close(want, t.v, 0.006)) continue;
        let score = 0;
        if (hints.amount && close(t.v, hints.amount, 0.001)) score += 3;
        else if (TOTAL_WORDS.test(t.line) || PAYMENT.test(t.line)) score += 2;
        if (VOLUME_WORDS.test(q.line) || new RegExp(`${VOLUME_UNIT}\\b`).test(q.line)) score += 2;
        if (PRICE_WORDS.test(u.line)) score += 2;
        if (q.line === u.line) score += 1;
        if (!best || score > best.score) best = { score, amount: t.v, liters: q.v, unitPrice: u.v };
      }
    }
  }
  return best && best.score >= 3 ? best : null;
}

function findPlate(text) {
  // Turkish plates: province 01–81, 1–3 letters, 2–4 digits
  const m = text.match(/(?:PLAKA[^\dA-Z]*)?\b(0[1-9]|[1-7]\d|8[01]) ?([A-Z]{1,3}) ?(\d{2,4})\b/);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
}

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

function findDate(text, p) {
  let day;
  let month;
  let year;
  let found;
  const iso = text.match(/\b(20\d{2})[./-](\d{2})[./-](\d{2})\b/);
  // A four-digit year first: "08-09-10" in a register number is not a date when "09-10-2026" is there
  const dmy = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/) || (!iso && text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2})\b/));
  const named = text.match(/\b(\d{1,2})[ -]([A-Z]{3})[ -](20\d{2})\b/);
  if (dmy) {
    found = dmy[0];
    let [a, b] = [Number(dmy[1]), Number(dmy[2])];
    // Month first in the US, unless that cannot be a date
    if ((p.monthFirst && a <= 12) || b > 12) [a, b] = [b, a];
    [day, month, year] = [a, b, dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])];
  } else if (iso) {
    found = iso[0];
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (named && MONTHS[named[2]]) {
    found = named[0];
    [day, month, year] = [Number(named[1]), MONTHS[named[2]], Number(named[3])];
  } else return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Time: prefer hh:mm, and never the day.month part of the date itself
  const rest = text.replace(found, ' ');
  const t = rest.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/) || rest.match(/\b([01]\d|2[0-3])\.([0-5]\d)\b(?![.,]\d)/);
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${t ? `${pad(t[1])}:${t[2]}` : '12:00'}`;
}

function findReceiptNo(lines) {
  for (const line of lines) {
    const m =
      line.match(/(?:FIS|FIS NO|BELGE NO|FIS NU)\s*(?:NO|NU)?[:.\s]*([0-9]{1,8})\b/) ||
      line.match(/(?:RECEIPT NO|BILL NO|TICKET NO|NO\.? TICKET|TRAN ?#|TXN NO|INVOICE NO|BELEG(?:-?NR)?|N\S? OPERACION|TRANSACTION #)[^\d]{0,4}([0-9]{1,10})\b/);
    if (m && !/Z NO/.test(line)) return m[1].replace(/^0+(?=\d)/, '');
  }
  return null;
}

const FUELS = [
  ['LPG', /LPG|OTOGAZ|AUTO ?GAS|\bGPL\b|\bGLP\b/],
  ['Motorin', /MOTORIN|DIZEL|DIESEL|GASOIL|GAZOLE|GASOLEO|ULTRAFORCE D|V\/MAX D|\bB7\b/],
  [
    'Benzin',
    /BENZIN|KURSUNSUZ|95 OKTAN|97 OKTAN|V\/MAX 95|\bSP ?9[58]|\bE10\b|SUPER|UNLEADED|REGULAR|PREMIUM|GASOLINA|SIN PLOMO|EFITEC|EURO ?95|RON ?9[57]|V-?POWER|FUELSAVE|ENERGY ?98|ULTIMATE|EXCELLIUM|OPTIMA ?98/
  ]
];

// The product line comes first; footers that list every fuel ("Diesel & Petrol RON95 relief") come last
function findFuel(text, p) {
  let best = null;
  // In Türkiye "PETROL" is in station and company names (Petrol Ofisi); elsewhere it is the product
  const fuels = p.dotThousands ? FUELS : [...FUELS, ['Benzin', /\bPETROL\b/]];
  for (const [fuel, re] of fuels) {
    const at = text.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { fuel, at };
  }
  return best ? best.fuel : null;
}

// Returns only the fields it is reasonably sure of; the form fills these and leaves the rest.
export function parseReceipt(rawText, { country = 'TR' } = {}) {
  const p = profile(country);
  const text = normalise(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = {};
  const inRange = (price) => price >= p.price[0] && price <= p.price[1];
  const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

  let amount = findTotal(lines, p) || totalFromNetAndVat(lines, p);
  let { liters, unitPrice } = findLitresAndPrice(lines, p);
  // A price far from what fuel costs in this country is a misread
  if (unitPrice !== null && !inRange(unitPrice)) unitPrice = null;
  if (liters !== null && !(liters > 0 && liters <= 2000)) liters = null;
  const priceRead = unitPrice;

  if (liters && unitPrice && amount && !close(liters * unitPrice, amount)) {
    // The total may be misread ("*600,00" read as "1600,00"); another line often repeats it correctly
    const repeat = allNumbers(lines, p).find((n) => close(liters * unitPrice, n, 0.005));
    if (repeat) amount = repeat;
  }
  if (!(liters && unitPrice && amount && close(liters * unitPrice, amount))) {
    // Labels unreadable or in another layout (columns, other language): look for numbers that multiply out
    const triple = findTriple(lines, p, { amount });
    if (triple) ({ amount, liters, unitPrice } = triple);
  }
  if (liters && unitPrice && amount && !close(liters * unitPrice, amount)) {
    // Keep the pair that agrees; the total line is the most reliable on fiscal receipts.
    // Litres one digit off what total ÷ price gives were misread ("121.330" for "21.330").
    // Abroad the price per litre is printed on its own line with three decimals and rarely misread.
    if (close(amount / unitPrice, liters, 0.05) || oneDigitOff(liters, amount / unitPrice) || !p.dotThousands) liters = round(amount / unitPrice, 2);
    else unitPrice = null;
  }
  // Litres a digit off agreeing with total and price to the cent ("10,58" for "10,53")
  if (liters && unitPrice && amount && !close(liters * unitPrice, amount, 0.001) && oneDigitOff(liters, amount / unitPrice)) {
    liters = round(amount / unitPrice, 2);
  }
  if (!amount && liters && unitPrice) amount = round(liters * unitPrice, 2);
  if (amount && unitPrice && !liters) liters = round(amount / unitPrice, 2);
  if (amount && liters && !unitPrice) {
    // Work the price out, unless a clearly different price was printed (then litres or total is wrong)
    const price = round(amount / liters, p.price[0] < 1 ? 3 : 2);
    if (inRange(price) && (!priceRead || close(priceRead, price, 0.3))) unitPrice = price;
  }

  if (amount) out.amount = amount;
  if (liters) out.liters = liters;
  if (unitPrice) out.unitPrice = unitPrice;
  if (p.dotThousands) {
    const plate = findPlate(text);
    if (plate) out.plate = plate;
  }
  const date = findDate(text, p);
  if (date) out.date = date;
  const receiptNo = findReceiptNo(lines);
  if (receiptNo) out.receiptNo = receiptNo;
  const fuel = findFuel(text, p);
  if (fuel) out.fuelType = fuel;
  return out;
}
