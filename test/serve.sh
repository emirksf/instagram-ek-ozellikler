#!/bin/bash
# Test sayfasını http://127.0.0.1:8766 adresinde sunar. Örnek adresler:
#   /index.html?fresh=1            — temiz başlangıç (tanıtım ekranı)
#   /index.html?nf=30000           — 30 bin takipçili hesap
#   /index.html?trunc=1            — Instagram takipçi listesini erken bitirir
#   /index.html?fail=1             — Instagram takip işlemlerini reddeder (feedback_required)
#   /index.html?login=0            — oturum kapalı
#   /index.html?speed=0.01         — bekleme süreleri 100 kat kısa (varsayılan)
cd "$(dirname "$0")" && ./build-test.sh && cd out && exec python3 -I -m http.server 8766 --bind 127.0.0.1
