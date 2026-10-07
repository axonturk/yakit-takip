# ⛽ Pumpbook · Yakıt Avans & Bakiye Takip (PWA)

Akaryakıt istasyonlarına yatırılan peşin avansları ve istasyondan veresiye (eksi bakiye) alınan yakıtı istasyon bazında takip eden, mobil öncelikli **Progressive Web App**.

Canlı: https://axonturk.github.io/yakit-takip/

---

## 🚀 Temel Özellikler

1. **İstasyon bazlı bakiye:** Her istasyon için avans, harcama ve kalan bakiye; borç varsa eksi bakiye olarak gösterilir.
2. **Hızlı harcama girişi:** Litre × birim fiyat girilince tutar otomatik hesaplanır. İsteğe bağlı plaka etiketi, geçmişte araca göre filtre.
3. **Güvenilir kayıt:** İşlemler düzenlenebilir (eski değerler değişiklik geçmişinde saklanır), silinen işlem "Geri al" ile geri gelir, kaldırılan istasyonun geçmişi korunur. Tutarlar kuruşa yuvarlanır.
4. **Açılış bakiyesi ve düzeltme:** İstasyon eklerken mevcut bakiye girilebilir; "Düzelt" ekranı istasyonun defteriyle eşitleme kaydı oluşturur.
5. **Yedekleme:** JSON yedek indirme; geri yüklemede dosya doğrulanır, özet gösterilir ve mevcut veri önce otomatik yedeklenir.
6. **Dönem ekstresi:** İstasyon ve ay (veya tarih aralığı) seçilir; devir, yükleme, tüketim, kapanış ve satır satır bakiye gösterilir. PDF (yazdır), WhatsApp ile paylaş ve Excel/CSV.
7. **Geçmiş:** Güne göre gruplu liste; plaka, fiş no, not veya tutarla arama ve tarih aralığı filtresi.
8. **Çevrimdışı PWA:** Telefona uygulama gibi kurulur, veriler cihazda (`localStorage`) tutulur.

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
