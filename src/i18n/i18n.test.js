import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { t, setLocale, EN, intlLocale } from './index';

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'i18n' ? [] : sourceFiles(p);
    return /\.(js|jsx)$/.test(name) && !name.includes('.test.') ? [p] : [];
  });
}

// Every t('...') in the app must have an English entry
function keysInSource() {
  const keys = new Map();
  for (const file of sourceFiles(new URL('..', import.meta.url).pathname)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      keys.set(m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'), file);
    }
  }
  return keys;
}

describe('i18n', () => {
  afterEach(() => setLocale({ lang: 'tr', currency: 'TRY' }));

  it('returns Turkish as is and fills variables', () => {
    setLocale({ lang: 'tr', currency: 'TRY' });
    expect(t('Bakiye {n} {cur}', { n: 5 })).toBe('Bakiye 5 ₺');
  });

  it('translates to English with the chosen currency', () => {
    setLocale({ lang: 'en', currency: 'INR' });
    expect(intlLocale()).toBe('en-IN');
    expect(t('Kaydet')).toBe(EN['Kaydet']);
  });

  it('has an English text for every t() call', () => {
    const missing = [...keysInSource()].filter(([k]) => !(k in EN)).map(([k, f]) => `${f.split('/src/')[1]}: ${k}`);
    expect(missing).toEqual([]);
  });

  it('keeps the same {variables} in English', () => {
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const bad = Object.entries(EN).filter(([k, v]) => vars(k) !== vars(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
