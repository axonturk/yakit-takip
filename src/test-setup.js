import { setLocale } from './i18n';

// Tests check Turkish text and ₺, whatever language the machine running them uses
setLocale({ lang: 'tr', currency: 'TRY' });
