// Language and currency for this device. Turkish text is the key: t('Kaydet') returns it
// as is in Turkish and looks it up in the English dictionaries (src/i18n/en/*.js) otherwise.
// Changing either setting reloads the app, so plain function calls are enough (no React context).

const KEY = 'hisapo_locale_v1';

export const LANGUAGES = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' }
];

export const CURRENCIES = [
  { id: 'TRY', symbol: '₺', label: 'Türk lirası (₺)' },
  { id: 'INR', symbol: '₹', label: 'Indian rupee (₹)' },
  { id: 'USD', symbol: '$', label: 'US dollar ($)' },
  { id: 'EUR', symbol: '€', label: 'Euro (€)' }
];

function browserDefaults() {
  // hisapo.com/en/ links to /app/?lang=en so a first visit opens in English
  const param = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  if (param === 'en') return { lang: 'en', currency: /-IN$/i.test(globalThis.navigator?.language || '') ? 'INR' : 'USD' };
  if (param === 'tr') return { lang: 'tr', currency: 'TRY' };
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  if (!nav || /^tr\b/i.test(nav)) return { lang: 'tr', currency: 'TRY' };
  return { lang: 'en', currency: /-IN$/i.test(nav) ? 'INR' : 'USD' };
}

export function loadLocale() {
  const defaults = browserDefaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      return {
        lang: LANGUAGES.some((l) => l.id === saved.lang) ? saved.lang : defaults.lang,
        currency: CURRENCIES.some((c) => c.id === saved.currency) ? saved.currency : defaults.currency
      };
    }
  } catch {
    // private mode or no storage: browser defaults
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

// For tests
export function setLocale(next) {
  current = { ...current, ...next };
}

export const getLang = () => current.lang;
export const getCurrency = () => current.currency;
export const currencySymbol = () => (CURRENCIES.find((c) => c.id === current.currency) || CURRENCIES[0]).symbol;

// Locale for numbers and dates: Turkish in Turkish, otherwise the currency's home format
export function intlLocale() {
  if (current.lang === 'tr') return 'tr-TR';
  return current.currency === 'INR' ? 'en-IN' : 'en-US';
}

const modules = import.meta.glob('./en/*.js', { eager: true });
export const EN = Object.assign({}, ...Object.values(modules).map((m) => m.default || {}));

// t('İstasyon hesabı {n} {cur} ile başlatılacak.', { n: 50 }); {cur} is always the currency symbol
export function t(text, vars) {
  const s = current.lang === 'tr' ? text : (EN[text] ?? text);
  const all = { cur: currencySymbol(), ...(vars || {}) };
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
}

// 24,5 in Turkish, 24.5 in English
export function decimal(v) {
  if (v === null || v === undefined || v === '') return '';
  return current.lang === 'tr' ? String(v).replace('.', ',') : String(v);
}

// Excel opens ";" files correctly with Turkish settings and "," files with English ones
export const csvSeparator = () => (current.lang === 'tr' ? ';' : ',');
