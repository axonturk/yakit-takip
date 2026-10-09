import { describe, it, expect } from 'vitest';
import { parseReceipt, parseTRNumber } from './receipt';

describe('parseTRNumber', () => {
  it('reads Turkish and English number styles', () => {
    expect(parseTRNumber('1.083,00')).toBe(1083);
    expect(parseTRNumber('*1.083,00')).toBe(1083);
    expect(parseTRNumber('44,73')).toBe(44.73);
    expect(parseTRNumber('1,083.50')).toBe(1083.5);
    expect(parseTRNumber('1.083')).toBe(1083);
    expect(parseTRNumber('24.214')).toBe(24214);
    expect(parseTRNumber('1O83,00')).toBe(1083);
    expect(parseTRNumber('abc')).toBeNull();
  });
});

describe('parseReceipt', () => {
  it('reads a fiscal register receipt with quantity × price', () => {
    const text = `PETROL OFİSİ
KICI PETROL LTD. ŞTİ.
TARİH : 02.10.2026  SAAT : 16:38
FİŞ NO : 0042
MOTORİN
24,214 LT X 44,73
                  %20  *1.083,00
TOPKDV            *180,50
TOPLAM          *1.083,00
KREDİ KARTI     *1.083,00
PLAKA: 34 ABC 123`;
    expect(parseReceipt(text)).toEqual({
      amount: 1083,
      liters: 24.214,
      unitPrice: 44.73,
      plate: '34 ABC 123',
      date: '2026-10-02T16:38',
      receiptNo: '42',
      fuelType: 'Motorin'
    });
  });

  it('reads a pump slip with labelled fields', () => {
    const text = `SHELL KADIKOY
Tarih: 05/10/2026 09:12
Ürün: Kurşunsuz Benzin 95
Birim Fiyat: 47,35 TL/LT
Miktar: 31,68 LT
Tutar: 1.500,05 TL
Plaka 06XYZ99`;
    expect(parseReceipt(text)).toMatchObject({
      amount: 1500.05,
      liters: 31.68,
      unitPrice: 47.35,
      plate: '06 XYZ 99',
      date: '2026-10-05T09:12',
      fuelType: 'Benzin'
    });
  });

  it('derives litres from total and price, and drops a price that disagrees', () => {
    expect(parseReceipt('LPG\nBIRIM FIYAT 25,00\nTOPLAM *500,00')).toMatchObject({ amount: 500, unitPrice: 25, liters: 20, fuelType: 'LPG' });
    const wrong = parseReceipt('10,00 LT X 44,00\nTOPLAM *1.083,00');
    expect(wrong.amount).toBe(1083);
    expect(wrong.unitPrice).toBeUndefined();
  });

  it('ignores KDV and subtotal lines when picking the total', () => {
    expect(parseReceipt('ARA TOPLAM 900,00\nTOPKDV 180,00\nTOPLAM 1.080,00').amount).toBe(1080);
  });

  it('returns nothing it cannot read', () => {
    expect(parseReceipt('bulanık bir fotoğraf')).toEqual({});
  });

  // Real OPET autogas receipts (Kırıkhan, 9 Oct 2026) as the phone read them, misreads included
  it('reads real receipts despite misread characters', () => {
    const misreadTotal = `09-10-2026 28:30
FİŞ NO: 0063
S1ASS626
15,79 LT X 37,990
AUTO GAS X20 *600, 00
KDV *100,00
TOPLAM 1600, 00
NAKİT: *600, 00`;
    expect(parseReceipt(misreadTotal)).toMatchObject({ amount: 600, liters: 15.79, unitPrice: 37.99, receiptNo: '63', fuelType: 'LPG' });

    const quotedTotal = `09-10-2026 08:25 |,
FİŞ NO:0062 |
31SH965ö0
13,16 LT X 37,990
AUTO GAS x20 *b00, 00
KDV *83,33
TOPLAM “500,00 |
NAKİT: *500,00 |`;
    expect(parseReceipt(quotedTotal)).toEqual({
      amount: 500,
      liters: 13.16,
      unitPrice: 37.99,
      date: '2026-10-09T08:25',
      receiptNo: '62',
      fuelType: 'LPG'
    });

    const noTotalLine = `09-10-2026 08:25
| FİŞ NO:0061
| BGEA5423
10,53 LT X 37,990
AUTO GAS X20 *400,00
KDV *66,61
NAKİT: *400,00`;
    expect(parseReceipt(noTotalLine)).toMatchObject({ amount: 400, liters: 10.53, unitPrice: 37.99 });
  });

  it('does not take the VAT line for litres, and works out the price from total and litres', () => {
    const text = `FİŞ NO:0063
15,79 LÜX GTA
AUTO GAS X20 *600,00
KOV *100,00
TOPLAM *600, 00`;
    expect(parseReceipt(text)).toMatchObject({ amount: 600, liters: 15.79, unitPrice: 38 });
    // "37,990" cut short to "31," by the reader
    expect(parseReceipt('10,53 LT X 31,\nAUTO GAS X20 *400,00\nNAKİT: *400,00')).toMatchObject({ amount: 400, liters: 10.53, unitPrice: 37.99 });
    expect(parseReceipt('10,53 LT\nAUTO GAS %20 *400,00\nTOPLAM *400,00')).toMatchObject({ amount: 400, liters: 10.53, unitPrice: 37.99 });
  });
});

// Receipts from other countries, as the phone's reader read them (misreads included).
// Sources: public receipt datasets (France, Malaysia, Australia) and made-up US, Indian and Dutch slips.
describe('parseReceipt abroad', () => {
  it('reads a French self-service ticket', () => {
    const text = `LE 17-07-25 A 19-59-18
STATION AVIA DA
MONTANT REEL
65.63 EUR
Ticket No :
No pompe = 5
Carburant = SP98
Quantite = 32 67 L
Prix unit. = 2,009 EUR
TVA 20,00% = 10,94 EUR`;
    expect(parseReceipt(text, { country: 'FR' })).toMatchObject({ amount: 65.63, liters: 32.67, unitPrice: 2.009, date: '2025-07-17T12:00', fuelType: 'Benzin' });
  });

  it('adds net and VAT when the total line is unreadable', () => {
    const text = `Date 26-02-2025 17:21:59
Pompe 3 SP98
Volume 20.29% Te
Prix € 2.129/?
Tor TIC
TVA 20.00 % €7.19
Net € 35.94`;
    expect(parseReceipt(text, { country: 'FR' })).toMatchObject({ amount: 43.13, liters: 20.26, unitPrice: 2.129 });
  });

  it('reads Spanish columns and works out the misread price', () => {
    const text = `Fecha: 13-09-2026 Hora: 14:35:40
PRODU TO VL LITROS rosie
efitec 98 4,095 28,44 9,67
Total tarjeta; — j - 59,67.`;
    expect(parseReceipt(text, { country: 'ES' })).toMatchObject({ amount: 59.67, liters: 28.44, unitPrice: 2.098, fuelType: 'Benzin' });
  });

  it('reads a Dutch receipt with quantity × price', () => {
    const text = `Datum: 19-07-2026 Tijd: 14:32
EURO 95
25.00 L x EUR 2.420
Brandstof EUR 60.50
Subtotaal excl. BTW EUR 50.00
BTW 21% EUR 10.50
TOTAAL EUR 60.50`;
    expect(parseReceipt(text, { country: 'NL' })).toEqual({ amount: 60.5, liters: 25, unitPrice: 2.42, date: '2026-07-19T14:32', fuelType: 'Benzin' });
  });

  it('reads a Malaysian receipt and takes the product, not the footer, as the fuel', () => {
    const text = `39.42 litre Punp # 09
FuelSave 95 RM 85.54 C
2.170 RM / litre
Total RM 85.54
Total Gross C RM 85. 54
26/02/18 08.28 10886 09
~ Diesel & Petrol RON9S`;
    expect(parseReceipt(text, { country: 'MY' })).toMatchObject({ amount: 85.54, liters: 39.42, unitPrice: 2.17, date: '2018-02-26T08:28', fuelType: 'Benzin' });
  });

  it('reads an Australian receipt with spaces inside numbers', () => {
    const text = `>OPREMIUM 98 $57 .80
30.630L @ $1 .887/L
rOTAL (incl GST) $57.80
Date 15-SEP-2025`;
    expect(parseReceipt(text, { country: 'AU' })).toMatchObject({ amount: 57.8, liters: 30.63, unitPrice: 1.887, date: '2025-09-15T12:00' });
  });

  it('reads US gallons, dollars and month-first dates', () => {
    const text = `DATE 06/04/2026 TIME 08:14
PREMIUM
GALLONS ~~ 14.002
PRICE/GAL ~~ $4.199
FUEL SALE $58.79
TOTAL ~~ $58.79`;
    expect(parseReceipt(text, { country: 'US' })).toMatchObject({ amount: 58.79, liters: 14.002, unitPrice: 4.199, date: '2026-06-04T08:14', fuelType: 'Benzin' });
    // "121.330" for "21.330": the gallons are a digit off what total ÷ price gives
    expect(parseReceipt('121.330 6 @ $2.989/ G\nTOTAL $63.76', { country: 'US' })).toMatchObject({ amount: 63.76, liters: 21.33, unitPrice: 2.989 });
  });

  it('reads an Indian pump slip in rupees', () => {
    const text = `RECEIPT NO : 004511
PRODUCT : PETROL
RATE (Rs/L) : 94.72
VOLUME (L) =: 10.56 :
AMOUNT (Rs) : 1000.24
DATE: 15/01/2026 TIME: 10:41`;
    expect(parseReceipt(text, { country: 'IN' })).toEqual({ amount: 1000.24, liters: 10.56, unitPrice: 94.72, date: '2026-01-15T10:41', receiptNo: '4511', fuelType: 'Benzin' });
  });

  it('keeps Turkish rules at home: "1.083" is a thousand and Petrol Ofisi is not a fuel', () => {
    expect(parseReceipt('PETROL OFISI\nTOPLAM 1.083', { country: 'TR' })).toEqual({ amount: 1083 });
    expect(parseReceipt('PRIX 1.649 EUR/L\nTOTAL 49,47', { country: 'FR' })).toMatchObject({ unitPrice: 1.649, liters: 30 });
  });
});
