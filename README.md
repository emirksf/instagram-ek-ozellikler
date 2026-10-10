# Emir Kosif · Instagram Takip Denetimi

Instagram'ı bir WKWebView içinde açan ve üstüne analiz paneli yükleyen macOS uygulaması.

## Klasörler

| Yol | İçerik |
|---|---|
| `main.swift` | Pencere, menüler, bildirimler (UNUserNotificationCenter), JS ↔ Swift köprüsü |
| `src/` | Panel (`inject.js` olarak birleştirilir). `00-head` → `01-core` → veri → kuyruk → DM → profil/rapor → arayüz → açılış |
| `watcher/` | Arka plan izleyici (`watcher.js` olarak birleştirilir): takipçi sayısı, bildirimler, profil izleme, aylık rapor |
| `shared/` | İki betiğin ortak kodu: API yardımcıları, IndexedDB deposu, geçmiş/grafik verisi |
| `test/` | Sahte Instagram API'li test sayfası |

`inject.js`, `watcher.js` ve `.app` derleme çıktısıdır; elle düzenlenmez.

## Derleme ve kurulum

```bash
./build.sh
```

```bash
ditto "Emir Kosif Instagram Takip Denetimi v2.0.app" "/Applications/Emir Kosif Instagram Takip Denetimi v2.0.app"
```

## Test (gerçek hesaba dokunmadan)

```bash
./test/serve.sh
```

Ardından tarayıcıda `http://127.0.0.1:8766/index.html?fresh=1` aç. Senaryolar için adres parametreleri `test/serve.sh` içinde (30 bin takipçi, eksik liste, Instagram reddi, oturum kapalı).

## Veri

- Büyük veri (tarama sonuçları, anlık görüntüler, işlem geçmişi, grafik, kuyruk) Instagram kökenindeki IndexedDB `igd` veritabanında.
- Küçük ayarlar `igd_` önekli localStorage anahtarlarında.
- Hiçbir veri bu Mac dışına gönderilmez.
