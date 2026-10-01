# ⛽ Yakıt Avans & Pompa Takip (PWA)

İstasyonlara yapılan peşin avans ödemelerini (kredi kartı / nakit) ve her depo dolumundaki yakıt harcamalarını takip eden mobil öncelikli **Progressive Web App (PWA)**.

---

## 🚀 Temel Özellikler

1. **İstasyon Bazlı Bakiye Takibi:**
   - Opet, Shell, BP, Petrol Ofisi, TotalEnergies, Aytemiz, Türkiye Petrolleri ve Bağımsız istasyonlar için ayrı avans bakiyesi yönetimi.
   - Her istasyon için gerçek zamanlı kalan bakiye, son işlem tarihi ve bakiye uyarıları.

2. **📷 Kamera ile Pompa Ekranı Okuma (OCR):**
   - Pompa ekranını telefon kamerasıyla tarayarak **Toplam Tutar (TL)**, **Litre (L)** ve **Birim Fiyat (TL/L)** değerlerini otomatik okuma.
   - Matematiksel çapraz doğrulama formülü: $\text{Litre} \times \text{Birim Fiyat} \approx \text{Tutar}$ kontrolü ile %100 doğruluk güvencesi.

3. **💳 Peşin Avans Yükleme:**
   - İstasyonlara ay içinde peşin çektirilen avans tutarlarını hesaba ekleme.
   - Kamera ile POS slip / fiş okuma desteği.

4. **⚡ Doğrudan Seçili İstasyon Desteği:**
   - Ana ekranda hangi istasyona tıklandıysa, alt menüdeki **Pompa Tara**, **+ Bakiye** veya **- Harcama** butonları otomatik olarak o istasyon için açılır.
   - İstenirse açılan penceredeki listeden istasyon kolayca değiştirilebilir.

5. **📱 Telefona Doğrudan Yükleme (PWA):**
   - Tarayıcıda açıldıktan sonra **"Ana Ekrana Ekle"** veya **"Yükle"** butonuna basılarak telefona yerel uygulama gibi kurulabilir.
   - Çevrimdışı (offline) çalışma desteği.
   - Veriler kullanıcının cihazında (`localStorage`) güvenle saklanır, harici API maliyeti ve sunucu bağımlılığı yoktur.

6. **💾 Yedekleme & Dışa Aktarma:**
   - JSON formatında tüm veriyi indirme ve geri yükleme.
   - İşlem geçmişini Excel/CSV formatında tek tıkla indirme.

---

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
- **React 19**
- **Vite 8**
- **Tailwind CSS v4**
- **Tesseract.js** (İstemci taraflı OCR)
- **Lucide React** (İkonlar)
- **PWA Service Worker & Web App Manifest**
