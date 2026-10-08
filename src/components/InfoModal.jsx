import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Info, X, ChevronDown, Mail, Shield, FileText, Globe } from 'lucide-react';
import { version } from '../../package.json';
import logo from '../assets/logo.png';
import { t, getLang } from '../i18n';

const SUPPORT = 'destek@hisapo.com';

// Each answer is one t() key; keys stay short Turkish sentences so the English file stays readable.
export const HELP = [
  {
    q: 'Nasıl başlarım?',
    a: [
      'Önce üstteki + ile avans yatırdığın ya da veresiye aldığın istasyonu ekle.',
      'İstasyona para yatırınca "+ Bakiye yükle" ile gir; bakiye artar.',
      'Yakıt alınca "- Harcama gir" ile gir; tutar bakiyeden düşer.',
      'Ana ekranda her istasyonun kalan bakiyesini görürsün.'
    ]
  },
  {
    q: 'Bakiye eksiye düşerse ne olur?',
    a: [
      'Eksi bakiye istasyona borçlu olduğun anlamına gelir; uygulama bunu kırmızı gösterir.',
      'Bakiye uyarı seviyesinin altına inince uyarı çıkar. Seviyeyi istasyon kartındaki dişli simgesiyle değiştirebilirsin.'
    ]
  },
  {
    q: 'Harcamayı hızlı nasıl girerim?',
    a: [
      'Litre ve birim fiyatı yazarsan tutar kendiliğinden hesaplanır.',
      'Son tutar ve plaka hazır gelir; tek dokunuşla seçebilirsin.',
      '"Fişi okut" ile fişin fotoğrafını çekersen tutar, litre ve plaka forma dolar. Kaydetmeden önce kontrol et.',
      'Km sayacını girersen aracın tüketimi hesaplanır, normalden fazla yakan alış işaretlenir.'
    ]
  },
  {
    q: 'Yanlış girdiğim kaydı nasıl düzeltirim?',
    a: [
      'Geçmiş sekmesinde kayda dokun, kalem simgesiyle düzenle ya da çöp kutusuyla sil.',
      'Sildikten hemen sonra çıkan "Geri al" ile kaydı geri getirebilirsin.',
      'İstasyonun gerçek bakiyesi farklıysa "Düzelt" ile bakiyeyi istasyondakiyle eşitle.'
    ]
  },
  {
    q: 'Şoförlerim de kullanabilir mi?',
    a: [
      'Evet. Üstteki bulut simgesinden ortak defter aç.',
      'Şoför davet kodunu şoföre gönder; şoför sadece kendi harcamasını girer.',
      'Yönetici davet koduyla katılan kişi her şeyi görür ve girer.',
      'Şoföre plaka ve aylık limit verebilirsin; limit aşılınca sana bildirim gelir.'
    ]
  },
  {
    q: 'Muhasebeciye nasıl gönderirim?',
    a: [
      'Geçmiş → Ekstre: bir istasyonun dönem ekstresi (devir, yükleme, tüketim, kapanış).',
      'Geçmiş → Rapor: araç, kişi ya da istasyon bazında aylık rapor.',
      'Her ikisini PDF, Excel ya da WhatsApp ile gönderebilirsin.'
    ]
  },
  {
    q: 'Telefonum kaybolursa ya da değişirse?',
    a: [
      'Bulut yedeği açıksa yeni telefonda aynı e-postayla giriş yapman yeterli; kayıtlar geri gelir.',
      'Bulut kullanmıyorsan ⋮ → "Verileri yedekle" ile dosya yedeği al, yeni telefonda "Yedekten geri yükle" ile aç.',
      'Bulut yedeği kapalıyken kayıtlar sadece bu telefonda durur.'
    ]
  },
  {
    q: 'PIN kodumu unuttum',
    a: [
      'Kilit ekranında "PIN\'i unuttum" ile telefondaki kayıtlar silinir ve kilit kalkar.',
      'Bulut yedeği açıksa tekrar giriş yapınca kayıtlar geri gelir.'
    ]
  },
  {
    q: 'İnternet olmadan çalışır mı?',
    a: [
      'Evet. Kayıtlar telefonda tutulur; internet gelince bulutla eşitlenir.',
      '"Fişi okut" ilk kullanımda okuma aracını indirir, sonra internetsiz de çalışır.'
    ]
  }
];

export default function InfoModal({ mode, onClose }) {
  if (!mode) return null;
  const Icon = mode === 'help' ? HelpCircle : Info;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">{mode === 'help' ? t('Yardım') : t('Hakkında')}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 overflow-y-auto">{mode === 'help' ? <Help /> : <About />}</div>
      </div>
    </div>,
    document.body
  );
}

function Help() {
  const [open, setOpen] = useState(0);
  return (
    <div className="space-y-2">
      {HELP.map((item, i) => (
        <div key={item.q} className="bg-slate-800/60 border border-slate-700/60 rounded-xl">
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full flex items-center justify-between gap-2 p-3 text-left text-xs font-semibold text-slate-100"
          >
            {t(item.q)}
            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition ${open === i ? 'rotate-180' : ''}`} />
          </button>
          {open === i && (
            <ul className="px-3 pb-3 space-y-1.5 text-[11px] text-slate-300 list-disc pl-7">
              {/* Receipt reading is Turkish only, so its tips are too */}
              {item.a.filter((line) => getLang() === 'tr' || !line.includes('Fişi okut')).map((line) => (
                <li key={line}>{t(line)}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <Contact text={t('Cevabını bulamadın mı? Bize yaz:')} />
    </div>
  );
}

function About() {
  const en = getLang() !== 'tr';
  const links = [
    { icon: Globe, label: 'hisapo.com', href: en ? 'https://hisapo.com/en/' : 'https://hisapo.com/' },
    { icon: Shield, label: t('Gizlilik politikası'), href: en ? 'https://hisapo.com/en/privacy.html' : 'https://hisapo.com/gizlilik.html' },
    { icon: FileText, label: t('Kullanım koşulları'), href: en ? 'https://hisapo.com/en/terms.html' : 'https://hisapo.com/kosullar.html' }
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="w-14 h-14 rounded-2xl" />
        <div>
          <div className="text-base font-bold text-white">Hisapo</div>
          <div className="text-[11px] text-slate-400">{t('Yakıt avans defteri')}</div>
          <div className="text-[11px] text-slate-500">{t('Sürüm {v}', { v: version })}</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-300">
        {t('İstasyonlardaki yakıt avansını, veresiyeyi ve araç başına yakıt harcamasını takip etmek için. Kayıtlar telefonunda durur; bulut yedeğini açarsan ekibinle paylaşılır.')}
      </p>
      <div className="space-y-1.5">
        {links.map(({ icon: Ico, label, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs text-slate-200 hover:bg-slate-800"
          >
            <Ico className="w-4 h-4 text-slate-400" />
            {label}
          </a>
        ))}
      </div>
      <Contact text={t('Öneri, hata ya da soru için:')} />
      <p className="text-[10px] text-slate-500">
        {t('Fiş okuma Tesseract (Apache 2.0) ile telefonda yapılır. © 2026 Hisapo')}
      </p>
    </div>
  );
}

function Contact({ text }) {
  const subject = encodeURIComponent(`Hisapo ${version}`);
  return (
    <a
      href={`mailto:${SUPPORT}?subject=${subject}`}
      className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200"
    >
      <Mail className="w-4 h-4 shrink-0" />
      <span>
        {text} <b>{SUPPORT}</b>
      </span>
    </a>
  );
}
