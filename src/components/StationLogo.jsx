import React from 'react';

import opetLogo from '../assets/logos/opet.svg';
import shellLogo from '../assets/logos/shell.svg';
import poLogo from '../assets/logos/petrol-ofisi.svg';
import bpLogo from '../assets/logos/bp.svg';
import totalLogo from '../assets/logos/total.svg';
import aytemizLogo from '../assets/logos/aytemiz.svg';
import tpLogo from '../assets/logos/tp.svg';
import digerLogo from '../assets/logos/diger.svg';

export const BRAND_KEYS = {
  OPET: 'opet',
  SHELL: 'shell',
  PETROL_OFISI: 'po',
  BP: 'bp',
  TOTAL: 'total',
  AYTEMIZ: 'aytemiz',
  TURKIYE_PETROLLERI: 'tp',
  OTHER: 'other'
};

export const BRAND_CONFIG = {
  [BRAND_KEYS.OPET]: {
    name: 'Opet',
    logoSrc: opetLogo,
    bgClass: 'bg-white',
    borderClass: 'border-blue-200'
  },
  [BRAND_KEYS.SHELL]: {
    name: 'Shell',
    logoSrc: shellLogo,
    bgClass: 'bg-white',
    borderClass: 'border-amber-200'
  },
  [BRAND_KEYS.PETROL_OFISI]: {
    name: 'Petrol Ofisi',
    logoSrc: poLogo,
    bgClass: 'bg-white',
    borderClass: 'border-red-200'
  },
  [BRAND_KEYS.BP]: {
    name: 'BP',
    logoSrc: bpLogo,
    bgClass: 'bg-white',
    borderClass: 'border-emerald-200'
  },
  [BRAND_KEYS.TOTAL]: {
    name: 'TotalEnergies',
    logoSrc: totalLogo,
    bgClass: 'bg-white',
    borderClass: 'border-rose-200'
  },
  [BRAND_KEYS.AYTEMIZ]: {
    name: 'Aytemiz',
    logoSrc: aytemizLogo,
    bgClass: 'bg-white',
    borderClass: 'border-red-200'
  },
  [BRAND_KEYS.TURKIYE_PETROLLERI]: {
    name: 'Türkiye Petrolleri (TP)',
    logoSrc: tpLogo,
    bgClass: 'bg-white',
    borderClass: 'border-sky-200'
  },
  [BRAND_KEYS.OTHER]: {
    name: 'Diğer / Bağımsız',
    logoSrc: digerLogo,
    bgClass: 'bg-slate-900',
    borderClass: 'border-slate-700'
  }
};

export const BRAND_OPTIONS = Object.entries(BRAND_CONFIG).map(([key, cfg]) => ({
  key,
  name: cfg.name,
  logoSrc: cfg.logoSrc
}));

// Helper to deduce brand from station name or explicit brand field
export function detectBrand(stationName, explicitBrand) {
  const brandVal = (explicitBrand || '').toLowerCase().trim();
  if (brandVal && BRAND_CONFIG[brandVal]) {
    return brandVal;
  }
  for (const [key, cfg] of Object.entries(BRAND_CONFIG)) {
    if (cfg.name.toLowerCase() === brandVal) return key;
  }
  const lower = ((stationName || '') + ' ' + (explicitBrand || '')).toLowerCase();
  if (lower.includes('opet')) return BRAND_KEYS.OPET;
  if (lower.includes('shell')) return BRAND_KEYS.SHELL;
  if (lower.includes('petrol ofisi') || lower.includes('ofisi') || /\bpo\b/.test(lower)) return BRAND_KEYS.PETROL_OFISI;
  if (/\bbp\b/.test(lower) || lower.includes(' bp')) return BRAND_KEYS.BP;
  if (lower.includes('total')) return BRAND_KEYS.TOTAL;
  if (lower.includes('aytemiz')) return BRAND_KEYS.AYTEMIZ;
  if (lower.includes('türkiye petrolleri') || lower.includes('turkiye petrolleri') || /\btp\b/.test(lower)) return BRAND_KEYS.TURKIYE_PETROLLERI;
  return BRAND_KEYS.OTHER;
}

export default function StationLogo({
  brand,
  name,
  className = 'w-10 h-10',
  rounded = 'rounded-xl',
  showBackground = true
}) {
  const brandKey = detectBrand(name, brand);
  const config = BRAND_CONFIG[brandKey] || BRAND_CONFIG[BRAND_KEYS.OTHER];

  return (
    <div
      className={`${className} ${rounded} shrink-0 overflow-hidden flex items-center justify-center p-1.5 shadow-sm transition-transform ${
        showBackground ? `${config.bgClass} border ${config.borderClass || 'border-slate-200/90'} shadow-slate-950/20` : ''
      }`}
      title={name || config.name}
    >
      <img
        src={config.logoSrc}
        alt={config.name}
        className="w-full h-full object-contain filter drop-shadow-none"
        loading="lazy"
        onError={(e) => {
          // Fallback if image fails
          e.target.style.display = 'none';
          if (e.target.parentElement) {
            e.target.parentElement.innerText = '⛽';
          }
        }}
      />
    </div>
  );
}
