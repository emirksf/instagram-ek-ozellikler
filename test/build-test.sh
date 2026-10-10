#!/bin/bash
# Test paketi: gerçek paketle aynı birleştirme, yalnızca instagram.com alan adı koruması kaldırılır
# (sahte API'li test sayfası localhost'ta çalıştığı için). Gerçek uygulamaya dokunmaz.
set -e
cd "$(dirname "$0")/.."
OUT=test/out; mkdir -p "$OUT"
GUARD='if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;'
strip() { python3 -c "import sys; s=sys.stdin.read(); g=sys.argv[1]; assert g in s, 'koruma satırı bulunamadı'; sys.stdout.write(s.replace(g,'/* test: alan adı koruması kapalı */'))" "$GUARD"; }
{ cat src/00-head.js shared/*.js; ls src/*.js | grep -v '/00-head.js$' | xargs cat; } | strip > "$OUT/inject.js"
{ cat watcher/00-head.js shared/*.js; ls watcher/*.js | grep -v '/00-head.js$' | xargs cat; } | strip > "$OUT/watcher.js"
cp test/index.html "$OUT/index.html"
node --check "$OUT/inject.js" && node --check "$OUT/watcher.js"
echo "Test paketi hazır: $OUT"
