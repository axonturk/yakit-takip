# ⛽ Hisapo · Yakıt Avans & Bakiye Takip (PWA)

Akaryakıt istasyonlarına yatırılan peşin avansları ve istasyondan veresiye (eksi bakiye) alınan yakıtı istasyon bazında takip eden, mobil öncelikli **Progressive Web App**.

Canlı: https://hisapo.com (tanıtım sayfası, `landing/`) · uygulama: https://hisapo.com/app/ · gizlilik: https://hisapo.com/gizlilik.html. Eski adres https://axonturk.github.io/yakit-takip/ hisapo.com'a yönlenir.

---

## 🚀 Temel Özellikler

1. **İstasyon bazlı bakiye:** Her istasyon için avans, harcama ve kalan bakiye; borç varsa eksi bakiye olarak gösterilir.
2. **Hızlı harcama girişi:** Litre × birim fiyat girilince tutar otomatik hesaplanır. İsteğe bağlı plaka etiketi, geçmişte araca göre filtre.
3. **Güvenilir kayıt:** İşlemler düzenlenebilir (eski değerler değişiklik geçmişinde saklanır), silinen işlem "Geri al" ile geri gelir, kaldırılan istasyonun geçmişi korunur. Tutarlar kuruşa yuvarlanır.
4. **Açılış bakiyesi ve düzeltme:** İstasyon eklerken mevcut bakiye girilebilir; "Düzelt" ekranı istasyonun defteriyle eşitleme kaydı oluşturur.
5. **Yedekleme:** JSON yedek indirme; geri yüklemede dosya doğrulanır, özet gösterilir ve mevcut veri önce otomatik yedeklenir.
6. **Dönem ekstresi:** İstasyon ve ay (veya tarih aralığı) seçilir; devir, yükleme, tüketim, kapanış ve satır satır bakiye gösterilir. PDF (yazdır), WhatsApp ile paylaş ve Excel/CSV.
7. **Geçmiş:** Güne göre gruplu liste; plaka, fiş no, not veya tutarla arama ve tarih aralığı filtresi.
8. **Fiş / dekont fotoğrafı:** Harcama ve avans kaydına telefon kamerasıyla fotoğraf eklenir; küçültülüp cihazda (IndexedDB) saklanır, yedek dosyasına girmez.
9. **Açık / koyu tema:** Başlıktaki ⋮ menüsünden değişir, tercih saklanır.
10. **Bulut yedek ve ortak defter:** E-postadaki bağlantı (ya da kod) ile giriş; kayıtlar Supabase'e yedeklenir, davet koduyla ekip aynı defteri kullanır. İnternet yokken çalışır, bağlanınca eşitler. Kurulum: `supabase/schema.sql` ve `supabase/email-template.html`.
11. **Değişiklik geçmişi:** Bulutta kim, hangi kaydı, ne zaman ekledi, düzenledi ya da sildi; düzenlemede eski ve yeni değerler. Bulut ekranında ve işlem düzenleme penceresinde görünür.
12. **Uygulama kilidi:** 4-6 haneli PIN; açılışta ve uygulama arka planda seçilen süreyi geçince sorulur. PIN yalnızca tuzlanmış özet olarak cihazda saklanır. Bu bir ekran kilididir, verileri şifrelemez.
13. **Hata kaydı ve kullanım ölçümü:** Cihaz başına günde bir anonim "açıldı" kaydı (kayıt sayıları, tema, kurulu mu) ve hata mesajları Supabase `app_events` tablosuna gider. Tutar, istasyon adı, not ya da e-posta gönderilmez.
14. **Şoför rolü ve ekip:** Ortak defterde iki davet kodu var. Yönetici koduyla katılan her şeyi yapar; şoför koduyla katılan sadece harcama girer ve yalnızca kendi girdiğini düzeltip silebilir (Supabase kurallarıyla da zorunlu). Kurucu, ekip listesinden rol, varsayılan plaka ve aylık harcama limiti belirler, kişiyi ekipten çıkarır. Yeni şoför harcamaları kurucu ve yöneticilerin ana sayfasında "Ekipten yeni harcama" olarak görünür.
15. **Fiş fotoğrafları bulutta:** Ortak defterde fotoğraflar eşitlemede Supabase Storage'daki özel `receipts` kovasına yüklenir (her eşitlemede en fazla 5). Başka telefonun çektiği fotoğraf, kayda dokununca indirilir ve cihazda saklanır. Kovayı yalnızca o defterin üyeleri görür.
16. **Aylık yakıt raporu:** Geçmiş → Rapor. Seçilen ayın harcamaları araç (plaka), kişi ya da istasyon bazında; tutar, litre, ortalama TL/L, pay. WhatsApp, PDF ve muhasebe için Excel (özet ve tüm satırlar, "Giren" sütunuyla).
17. **WhatsApp ile gönderim:** Rapor ve ekstrede WhatsApp'a basınca kayıtlı kişiler (muhasebeci, ortak) çıkar; tek dokunuşla rapor o kişinin sohbetine gider. Gruplar için WhatsApp'ın kişi/grup seçicisi açılır. Destekleyen telefonlarda Excel dosyası da doğrudan paylaşılır. Kayıtlı kişiler yalnızca o telefonda saklanır.
18. **Km ve tüketim takibi:** Harcamaya isteğe bağlı km sayacı girilir. Aynı plakanın önceki alışına göre gidilen yol ve 100 km'de litre hesaplanır; bu aracın olağan tüketiminden (diğer alışlarının medyanı) %30 fazla olan alış formda uyarı verir, geçmişte ⚠ ile işaretlenir. Km önceki kayıttan düşükse onay sorulur. Aylık raporda araç başına km, L/100 km ve yüksek alış sayısı; Excel'de Km sütunu.
19. **Fişi okut:** Harcama formunda "Fişi okut" ile fişin fotoğrafı çekilir; metin telefonda (Tesseract, Türkçe) okunur, internete gönderilmez. Tutar, litre, birim fiyat, plaka, tarih, fiş no ve yakıt türü bulunursa forma dolar; litre × fiyat toplamla tutmuyorsa fiyat bırakılır. Fotoğraf fiş fotoğrafı olarak da eklenir. Okuma aracı (~4 MB) ilk kullanımda sitemizden indirilir, sonra çevrimdışı çalışır.
20. **Dil, para birimi ve birimler:** İlk açılışta telefonun ülkesine göre seçilir (önce saat dilimi, sonra dil bölgesi: Türkiye ₺, Hindistan ₹, ABD $ + galon/mil/mpg, Avro bölgesi €, İngiltere £, BAE AED); ⋮ "Dil ve birimler" ile değiştirilir (telefon başına). Yalnız gösterim değişir, tutar ve miktarlar çevrilmez; tüketim içeride hep 100 birim yoldaki hacimdir, ABD biriminde mpg olarak gösterilir. Türkçe metin anahtardır: `t('Kaydet')`; İngilizceleri `src/i18n/en/*.js` içinde, eksik çeviriyi test yakalar. İngilizce tanıtım sayfası hisapo.com/en, `/app/?lang=en` ilk açılışta İngilizce açar. Fişi okut yalnız Türkçede görünür.
21. **Bildirimler:** Bulut ⇒ "Bildirimler" ile yönetici ve sahip telefonuna bildirim açar: ekipten biri harcama ya da avans girince, istasyon bakiyesi uyarı seviyesinin altına ya da eksiye düşünce, şoför aylık limiti aşınca. Yeni kayıt Supabase'de `records_notify` tetikleyicisiyle `notify` fonksiyonunu (supabase/functions/notify) çağırır; mesaj her telefonun dil ve para biriminde yazılır. 48 saatten eski kayıtlar (ilk yükleme) bildirim üretmez. iPhone'da yalnız ana ekrana eklenmiş uygulamada çalışır.
20. **Çevrimdışı PWA:** Telefona uygulama gibi kurulur, veriler cihazda (`localStorage`) tutulur.

## 📲 Telefona Nasıl Yüklenir?

### Android (Chrome / Brave / Edge)
1. Uygulama linkini Chrome'da açın.
2. Sağ üstteki üç nokta menüsüne (`⋮`) dokunun.
3. **"Uygulamayı Yükle"** veya **"Ana Ekrana Ekle"** seçeneğini seçin.
4. Telefonunuzun ana ekranında uygulama ikonu belirecek ve tam ekran mobil uygulama olarak çalışacaktır.

### iOS (iPhone Safari)
1. Uygulama linkini Safari'de açın.
2. Alttaki **Paylaş** (kare içinden yukarı ok çıkan simge) butonuna dokunun.
3. Aşağı kaydırıp **"Ana Ekrana Ekle"** (`+`) seçeneğine dokunun.
4. "Ekle" butonuna bastığınızda uygulama iPhone'unuzun ana ekranına eklenir.

---

## 🛠️ Teknolojiler
- **React 19**, **Vite 8**, **Tailwind CSS v4**
- **Lucide React** (ikonlar)
- **Vitest** (birim testleri)
- **PWA Service Worker & Web App Manifest**

## 👩‍💻 Geliştirme

```bash
npm ci
npm run dev     # yerel geliştirme sunucusu
npm test        # birim testleri
npm run build   # dist/ klasörüne üretim çıktısı
```
