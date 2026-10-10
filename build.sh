#!/bin/bash
set -e
cd "$(dirname "$0")"

APP="Emir Kosif Instagram Takip Denetimi v4.1.app"

echo "==> Eski derleme temizleniyor..."
rm -rf "$APP" AppIcon.iconset AppIcon.icns

echo "==> Simge üretiliyor..."
if swift make_icon.swift AppIcon.iconset >/dev/null 2>&1; then
  iconutil -c icns AppIcon.iconset -o AppIcon.icns 2>/dev/null && echo "   simge hazır." || echo "   (iconutil atlandı)"
else
  echo "   (simge üretimi atlandı, sorun değil)"
fi

echo "==> Bundle yapısı oluşturuluyor..."
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

echo "==> Betikler birleştiriliyor (src/ + shared/ → inject.js, watcher/ + shared/ → watcher.js)..."
HDR="// OTOMATİK ÜRETİLİR — düzenleme için src/, shared/ ve watcher/ altındaki dosyaları değiştir, sonra ./build.sh çalıştır."
{ echo "$HDR"; cat src/00-head.js shared/*.js; ls src/*.js | grep -v '/00-head.js$' | xargs cat; } > inject.js
{ echo "$HDR"; cat watcher/00-head.js shared/*.js; ls watcher/*.js | grep -v '/00-head.js$' | xargs cat; } > watcher.js
if command -v node >/dev/null 2>&1; then node --check inject.js && node --check watcher.js; fi

echo "==> Swift derleniyor..."
swiftc main.swift -O -target arm64-apple-macosx13.0 \
  -o "$APP/Contents/MacOS/InstaDenetim" -framework Cocoa -framework WebKit

echo "==> Kaynaklar kopyalanıyor..."
cp inject.js "$APP/Contents/Resources/inject.js"
cp watcher.js "$APP/Contents/Resources/watcher.js"
cp Info.plist "$APP/Contents/Info.plist"
[ -f AppIcon.icns ] && cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

echo "==> Ad-hoc imzalanıyor..."
codesign --force --deep --sign - "$APP" 2>/dev/null || echo "   (imzalama atlandı)"

echo "==> Bitti: $APP"
