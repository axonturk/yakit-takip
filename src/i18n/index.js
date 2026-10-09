// Language, currency and units for this device. Turkish text is the key: t('Kaydet') returns it
// as is in Turkish and looks it up in the English dictionaries (src/i18n/en/*.js) otherwise.
// The first launch picks them from the phone's country; the person can change them any time.
// Changing a setting reloads the app, so plain function calls are enough (no React context).

const KEY = 'hisapo_locale_v1';

export const LANGUAGES = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' }
];

export const CURRENCIES = [
  { id: 'TRY', symbol: '₺', label: 'Türk lirası (₺)' },
  { id: 'INR', symbol: '₹', label: 'Indian rupee (₹)' },
  { id: 'USD', symbol: '$', label: 'US dollar ($)' },
  { id: 'EUR', symbol: '€', label: 'Euro (€)' },
  { id: 'GBP', symbol: '£', label: 'British pound (£)' },
  { id: 'AED', symbol: 'AED', label: 'UAE dirham (AED)' }
];

// metric: litres and km; us: US gallons and miles. Numbers are stored as entered, never converted.
export const UNITS = [
  { id: 'metric', label: 'Litre · km', vol: 'L', dist: 'km' },
  { id: 'us', label: 'Galon · mil', vol: 'gal', dist: 'mi' }
];

const EURO = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];

const EURO_ZONES = {
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Europe/Berlin': 'DE',
  'Europe/Vienna': 'AT',
  'Europe/Brussels': 'BE',
  'Europe/Amsterdam': 'NL',
  'Europe/Rome': 'IT',
  'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE',
  'Europe/Luxembourg': 'LU'
};

// Country of the phone: its time zone first (a Turkish phone set to English is still in Turkey),
// then the region in the language setting (en-IN → IN).
export function detectCountry(timeZone, languages) {
  const tz = timeZone || '';
  if (tz === 'Europe/Istanbul' || tz === 'Asia/Istanbul') return 'TR';
  if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
  if (tz === 'Asia/Dubai') return 'AE';
  if (tz === 'Europe/London') return 'GB';
  if (EURO_ZONES[tz]) return EURO_ZONES[tz];
  if (/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu)$/.test(tz)) return 'US';
  for (const l of languages || []) {
    const m = /^[a-z]{2,3}[-_]([A-Z]{2})\b/i.exec(l || '');
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function defaultsFor(country, languages) {
  const first = (languages || [])[0] || '';
  const lang = /^tr\b/i.test(first) || (!first && country === 'TR') ? 'tr' : 'en';
  const currency =
    country === 'TR' ? 'TRY' : country === 'IN' ? 'INR' : country === 'GB' ? 'GBP' : country === 'AE' ? 'AED' : EURO.includes(country) ? 'EUR' : lang === 'tr' ? 'TRY' : 'USD';
  const units = country === 'US' ? 'us' : 'metric';
  return { lang, currency, units };
}

function deviceDefaults() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const languages = nav.languages?.length ? [...nav.languages] : nav.language ? [nav.language] : [];
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // old browser
  }
  const d = defaultsFor(detectCountry(tz, languages), languages);
  // hisapo.com/en/ links to /app/?lang=en so a first visit opens in that language
  const param = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  if (param === 'en' || param === 'tr') d.lang = param;
  return d;
}

export function loadLocale() {
  const defaults = deviceDefaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      return {
        lang: LANGUAGES.some((l) => l.id === saved.lang) ? saved.lang : defaults.lang,
        currency: CURRENCIES.some((c) => c.id === saved.currency) ? saved.currency : defaults.currency,
        units: UNITS.some((u) => u.id === saved.units) ? saved.units : defaults.units
      };
    }
  } catch {
    // private mode or no storage: device defaults
  }
  return defaults;
}

let current = loadLocale();

// Remember a language that came from the link, so the home-screen app keeps it
try {
  if (new URLSearchParams(location.search).get('lang') && !localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, JSON.stringify(current));
  }
} catch {
  // tests or no storage
}

export function saveLocale(next) {
  current = { ...current, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // keeps working for this session
  }
}

// Receipts the reader should expect: their country (number style, price range, date order)
// and the OCR languages to load. Comes from the currency and units the person uses,
// and for the euro from the phone's country, since French, Spanish and German receipts differ.
const OCR_LANGS = { TR: ['tur'], FR: ['fra', 'eng'], BE: ['fra', 'eng'], LU: ['fra', 'eng'], ES: ['spa', 'eng'], DE: ['deu', 'eng'], AT: ['deu', 'eng'] };

export function receiptLanguage(locale = current, deviceCountry = null) {
  let country;
  if (locale.currency === 'TRY') country = 'TR';
  else if (locale.currency === 'INR') country = 'IN';
  else if (locale.currency === 'USD' || locale.units === 'us') country = 'US';
  else if (locale.currency === 'GBP') country = 'GB';
  else if (locale.currency === 'AED') country = 'AE';
  else {
    let device = deviceCountry;
    if (device === null) {
      try {
        device = detectCountry(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages || [navigator.language]);
      } catch {
        device = null;
      }
    }
    country = EURO.includes(device) ? device : 'EU';
  }
  return { country, langs: OCR_LANGS[country] || ['eng'] };
}

// For tests
export function setLocale(next) {
  current = { ...current, ...next };
}

export const getLang = () => current.lang;
export const getUnits = () => current.units || 'metric';
const unit = () => UNITS.find((u) => u.id === getUnits()) || UNITS[0];
export const volUnit = () => unit().vol;
export const distUnit = () => unit().dist;
export const getCurrency = () => current.currency;
export const currencySymbol = () => (CURRENCIES.find((c) => c.id === current.currency) || CURRENCIES[0]).symbol;

// Locale for numbers and dates: Turkish in Turkish, otherwise the currency's home format
export function intlLocale() {
  if (current.lang === 'tr') return 'tr-TR';
  return current.currency === 'INR' ? 'en-IN' : current.currency === 'GBP' ? 'en-GB' : 'en-US';
}

const modules = import.meta.glob('./en/*.js', { eager: true });
export const EN = Object.assign({}, ...Object.values(modules).map((m) => m.default || {}));

// t('İstasyon hesabı {n} {cur} ile başlatılacak.', { n: 50 }); {cur} is always the currency symbol,
// {vol} the volume unit (L / gal) and {dist} the distance unit (km / mi)
export function t(text, vars) {
  const s = current.lang === 'tr' ? text : (EN[text] ?? text);
  const all = { cur: currencySymbol(), vol: volUnit(), dist: distUnit(), ...(vars || {}) };
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
}

// 24,5 in Turkish, 24.5 in English
export function decimal(v) {
  if (v === null || v === undefined || v === '') return '';
  return current.lang === 'tr' ? String(v).replace('.', ',') : String(v);
}

// Excel opens ";" files correctly with Turkish settings and "," files with English ones
export const csvSeparator = () => (current.lang === 'tr' ? ';' : ',');

// Column and field names for the chosen units
export const volLabel = () => (getUnits() === 'us' ? t('Galon') : t('Litre'));
export const distLabel = () => (getUnits() === 'us' ? t('Mil') : t('Km'));
