# Instagram EK Özellikler

Emir Kosif'in hazırladığı, Instagram'ı kendi penceresinde açan ve üstüne analiz paneli yükleyen masaüstü uygulaması. **Mac ve Windows**'ta çalışır, yeni sürümleri kendisi bulup kurar.

- Seni geri takip etmeyenler, hayranların, şüpheli/bot ve hayalet takipçiler
- Toplu takip bırakma / takipçiden çıkarma (günlük sınır ve geri alma ile)
- DM kutusu: topluca silme, mesaj geri çekme, yedekleme
- Profil izleme, takipçi bildirimleri, aylık rapor ve grafik
- **Hikayeme bakanlar**: hikayene kimlerin, kaç kez baktığını aralıklı takip eder

## Kurulum

En son sürümü **[Releases](https://github.com/emirksf/instagram-ek-ozellikler/releases/latest)** sayfasından indir:

| Sistem | Dosya |
|---|---|
| Mac (M1/M2/M3/M4) | `Instagram-EK-Ozellikler-…-mac-arm64.dmg` |
| Mac (Intel) | `Instagram-EK-Ozellikler-…-mac-x64.dmg` |
| Windows 10/11 | `Instagram-EK-Ozellikler-…-windows-kurulum.exe` |

**Mac:** `.dmg`'yi aç, uygulamayı Uygulamalar klasörüne sürükle.

**Windows:** Kurulum dosyasını çalıştır. Windows "Bilgisayarınız korundu" uyarısı gösterirse **Ek bilgi → Yine de çalıştır**'a bas (uygulama imzasız olduğu için çıkar).

Açılınca Instagram'a kendi sayfasında giriş yaparsın; şifren uygulamaya yazılmaz.

### Güncellemeler

Uygulama açılışta ve 6 saatte bir yeni sürüm olup olmadığına bakar, varsa arka planda indirir ve "Yeni sürüm hazır" bildirimi gösterir. "Şimdi yeniden başlat" dersen kurulur; demezsen uygulamadan çıkınca kendiliğinden kurulur. Elle denetlemek için menüden **Güncellemeleri Denetle…**.

### Eski “Instagram Takip Denetimi” Mac uygulamasından geçiş

Yeni sürüm farklı bir tarayıcı motoru kullandığı için kayıtların kendiliğinden taşınmaz. Eski uygulamada **Ayarlar → Yedekle ve geri yükle → Yedeği kaydet**, yenisinde **Yedekten geri yükle…**.

### Veri ve gizlilik

- Büyük veri (tarama sonuçları, anlık görüntüler, işlem geçmişi, grafik, kuyruk, hikaye kayıtları) Instagram kökenindeki IndexedDB `igd` veritabanında; küçük ayarlar `igd_` önekli localStorage anahtarlarında.
- Hiçbir veri bu bilgisayar dışına gönderilmez; uygulamanın sunucusu yoktur. Yalnızca güncelleme denetimi için GitHub'a bakılır.
- Araç Instagram'ın resmi olmayan uçlarını kullanır. Aşırı ya da hızlı kullanım hesabına geçici kısıtlama getirebilir; sorumluluk kullanıcıdadır.

## Geliştirme

| Yol | İçerik |
|---|---|
| `app/main.js` | Uygulama kabuğu (Electron): pencere, menüler, menü çubuğu / sistem tepsisi, bildirimler, dışa aktarma, otomatik güncelleme |
| `app/preload.js` | Panel betiklerini Instagram sayfasına yükler; kabukla tek mesaj kanalı (`window.igdNative`) |
| `src/` | Panel (`inject.js` olarak birleştirilir). `00-head` → `01-core` → veri → kuyruk → DM → profil/rapor → arayüz → açılış |
| `watcher/` | Arka plan izleyici (`watcher.js`): takipçi sayısı, bildirimler, profil izleme, aylık rapor, hikaye izleyicileri |
| `capture/` | DM GraphQL yardımcısı (`dmcapture.js`, sayfa başında yüklenir) |
| `shared/` | Panel ve izleyicinin ortak kodu: API yardımcıları, IndexedDB deposu, geçmiş/grafik, hikaye verisi |
| `assets/` | Uygulama simgesi (`icon.png`, `scripts/make_icon.swift` ile üretilir), tepsi simgeleri ve Mac'te görünen ad (`mac-lproj/`) |
| `test/` | Sahte Instagram API'li test sayfası |

`app/gen/` ve `dist/` derleme çıktısıdır; elle düzenlenmez.

Paket adı bilerek ASCII'dir (`Instagram EK Ozellikler`): Mac'te "Ö" dosya adlarında farklı kodlanıp uygulamayı açılışta çökertiyor. Kullanıcının gördüğü ad ("Instagram EK Özellikler") Mac'te `assets/mac-lproj/InfoPlist.strings`, Windows'ta kısayol adı, uygulama içinde `app.setName` ile verilir.

```bash
npm install
```

Uygulamayı geliştirme modunda aç:

```bash
npm start
```

Gerçek oturuma dokunmadan ayrı bir veri klasörüyle açmak için `IGD_USER_DATA=/tmp/igd npm start`.

Bu bilgisayar için paket üret (`dist/`):

```bash
npm run dist -- --publish never
```

### Test (gerçek hesaba dokunmadan)

```bash
./test/serve.sh
```

Ardından tarayıcıda `http://127.0.0.1:8766/index.html?fresh=1` aç. Senaryolar için adres parametreleri `test/serve.sh` içinde.

### Sürüm yayınlama

1. `package.json` içindeki `version`'ı artır (ör. `1.0.1`) ve commit'le.
2. Aynı sürümle etiket at ve gönder:

```bash
git tag v1.0.1 && git push origin main v1.0.1
```

GitHub Actions (`.github/workflows/release.yml`) Mac ve Windows paketlerini derler, taslak sürüme yükler, ikisi de hazırsa yayınlar. Kurulu uygulamalar birkaç saat içinde güncellemeyi kendileri alır.

### Mac imzası (bir kez)

Mac'te sessiz otomatik güncelleme ve uyarısız kurulum için paket Developer ID ile imzalanıp Apple'a notarize ettirilmeli. Deponun **Settings → Secrets and variables → Actions** bölümüne şu beş gizli değeri ekle:

| Ad | Değer |
|---|---|
| `MAC_CERT_P12_BASE64` | Anahtar Zinciri'nden dışa aktarılan **Developer ID Application** sertifikası (.p12), base64: `base64 -i sertifika.p12 \| pbcopy` |
| `MAC_CERT_PASSWORD` | .p12'yi dışa aktarırken verdiğin parola |
| `APPLE_ID` | Apple geliştirici hesabının e-postası |
| `APPLE_APP_SPECIFIC_PASSWORD` | [appleid.apple.com](https://appleid.apple.com) → Uygulamaya özel parolalar |
| `APPLE_TEAM_ID` | [developer.apple.com/account](https://developer.apple.com/account) → Üyelik ayrıntıları → Takım Kimliği |

Bunlar yoksa Mac paketi imzasız çıkar: kurulur ama macOS ilk açılışta uyarır ve uygulama kendini güncelleyemez (yeni sürüm olunca indirme sayfasını açmayı önerir). Windows paketi imzasızdır; kendini güncellemesi buna rağmen çalışır.
