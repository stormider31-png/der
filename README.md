# OSİN KATMAN5

Herkese açık (public) kaynaklardan veri toplayan bir OSINT araç seti. Cordova tabanlı,
tek bir web arayüzünden (`www/index.html`) oluşan Android uygulaması.

**Geliştirici:** [@BY_SADRAZAM](https://t.me/BY_SADRAZAM) — Kanal: https://t.me/WallHack_Turkiye

## İçerik

- **Platform Profil Taraması** — Telegram / Instagram / X / TikTok için kullanıcı adından
  herkese açık profil bağlantısı üretir ve açar.
- **Alan Adı İstihbaratı** — DNS kayıtları (Google DNS-over-HTTPS), RDAP kayıt bilgisi,
  sertifika şeffaflığı üzerinden alt alan adı listesi (crt.sh).
- **IP Bilgisi** — herkese açık IP coğrafi konum / ASN verisi (ipapi.co).
- **Alan Adı (ek)** — SSL sertifika detayı (crt.sh) ve Wayback Machine arşiv kaydı.
- **IP (ek)** — Shodan InternetDB'den pasif, herkese açık port/CVE özeti.
- **E-posta Teknik Kontrol** — biçim/geçerlilik, MX/SPF/DMARC, geçici servis tespiti,
  Gravatar var/yok ve alan adı sızıntı istatistiği (HIBP). Kişi hakkında profil çıkarmaz.
- **EXIF Analiz** — JPEG meta verisini tamamen cihaz üzerinde okur, hiçbir veri dışarı
  gönderilmez. GPS varsa “Haritada Aç” (OpenStreetMap) ve koordinat kopyalama sunar.
- **URL Analiz** — bağlantı yapısını istemci tarafında çözümler.

Bu uygulama; SQL enjeksiyonu, şifre/kimlik bilgisi toplama, wifi/cihaz taraması veya
herhangi bir sisteme yetkisiz erişim işlevi **içermez**.

## .apk'yı GitHub Actions ile derleme (Termux üzerinden)

Bu proje, APK'yı sizin telefonunuzda değil, GitHub'ın sunucularında otomatik olarak
derleyecek şekilde ayarlanmış (`.github/workflows/build-apk.yml`). Termux'un işi sadece
kodu GitHub'a göndermek; ağır derleme işini GitHub Actions yapar.

### 1. Termux'ta hazırlık

```bash
pkg update && pkg install git -y
```

### 2. Projeyi aç ve GitHub'a gönder

Bu `.zip` dosyasını telefonunuza indirin, bir klasöre çıkarın, sonra Termux'ta:

```bash
cd /sdcard/Download/osin-katman5   # zip'i çıkardığınız klasör
git init
git add .
git commit -m "OSİN KATMAN5 ilk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/osin-katman5.git
git push -u origin main
```

(`KULLANICI_ADINIZ` yerine kendi GitHub kullanıcı adınızı yazın; önce GitHub'da boş bir
`osin-katman5` deposu oluşturmanız gerekir — Settings gerekmez, sadece "New repository".)

### 3. APK'yı indirin

Push işleminden sonra GitHub deponuzda **Actions** sekmesine gidin. "APK Derle" iş akışı
birkaç dakika içinde tamamlanır. Sonuçta çıkan **Artifacts** bölümünden
`osin-katman5-apk` dosyasını indirin — içinde kurulabilir `.apk` dosyası vardır.

### Alternatif: Tamamen Termux içinde yerel derleme

Mümkün ama çok daha ağır (Android SDK + Gradle'ı Termux'a kurmak gerekir, birkaç GB yer
kaplar). Pratik olarak önerilen yol yukarıdaki GitHub Actions yöntemidir.

## Not

Harici API çağrıları (DNS, RDAP, crt.sh, ipapi.co) yalnızca herkese açık, kimlik
doğrulama gerektirmeyen servislere yapılır. Bazı servisler (örn. crt.sh) zaman zaman
yavaş yanıt verebilir veya geçici olarak erişilemez olabilir; bu durumda uygulama
manuel kontrol için bağlantı önerir.
