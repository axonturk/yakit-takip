import { describe, it, expect, afterEach } from 'vitest';
import { detectCountry, defaultsFor, setLocale, t } from './index';
import { formatL100, formatKm } from '../services/consumption';

describe('first-launch defaults from the phone', () => {
  afterEach(() => setLocale({ lang: 'tr', currency: 'TRY', units: 'metric' }));

  it('finds the country from the time zone, then the language region', () => {
    expect(detectCountry('Europe/Istanbul', ['en-US'])).toBe('TR');
    expect(detectCountry('Asia/Calcutta', ['en'])).toBe('IN');
    expect(detectCountry('America/Chicago', ['es-MX'])).toBe('US');
    expect(detectCountry('Europe/Berlin', ['de-DE', 'en'])).toBe('DE');
    expect(detectCountry('', ['en'])).toBe(null);
  });

  it('picks language, currency and units per country', () => {
    expect(defaultsFor('TR', ['tr-TR'])).toEqual({ lang: 'tr', currency: 'TRY', units: 'metric' });
    expect(defaultsFor('TR', ['en-US'])).toEqual({ lang: 'en', currency: 'TRY', units: 'metric' });
    expect(defaultsFor('IN', ['en-IN'])).toEqual({ lang: 'en', currency: 'INR', units: 'metric' });
    expect(defaultsFor('US', ['en-US'])).toEqual({ lang: 'en', currency: 'USD', units: 'us' });
    expect(defaultsFor('DE', ['de-DE'])).toEqual({ lang: 'en', currency: 'EUR', units: 'metric' });
    expect(defaultsFor('GB', ['en-GB'])).toEqual({ lang: 'en', currency: 'GBP', units: 'metric' });
    expect(defaultsFor(null, [])).toEqual({ lang: 'en', currency: 'USD', units: 'metric' });
  });

  it('shows gallons, miles and mpg with US units', () => {
    setLocale({ lang: 'en', currency: 'USD', units: 'us' });
    expect(t('Birim Fiyat ({cur}/{vol})')).toBe('Unit price ($/gal)');
    expect(formatKm(1200)).toBe('1,200 mi');
    // 4 gal per 100 mi → 25 mpg
    expect(formatL100(4)).toBe('25 mpg');
    setLocale({ lang: 'tr', currency: 'TRY', units: 'metric' });
    expect(formatL100(7.5)).toBe('7,5 L/100 km');
  });
});

describe('receiptLanguage', () => {
  it('reads receipts of the country the money is in', async () => {
    const { receiptLanguage } = await import('./index');
    expect(receiptLanguage({ currency: 'TRY', units: 'metric' })).toEqual({ country: 'TR', langs: ['tur'] });
    expect(receiptLanguage({ currency: 'INR', units: 'metric' })).toEqual({ country: 'IN', langs: ['eng'] });
    expect(receiptLanguage({ currency: 'USD', units: 'us' })).toEqual({ country: 'US', langs: ['eng'] });
    expect(receiptLanguage({ currency: 'EUR', units: 'metric' }, 'FR')).toEqual({ country: 'FR', langs: ['fra', 'eng'] });
    expect(receiptLanguage({ currency: 'EUR', units: 'metric' }, 'DE')).toEqual({ country: 'DE', langs: ['deu', 'eng'] });
    expect(receiptLanguage({ currency: 'EUR', units: 'metric' }, 'IT')).toEqual({ country: 'IT', langs: ['eng'] });
  });
});
