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
});
