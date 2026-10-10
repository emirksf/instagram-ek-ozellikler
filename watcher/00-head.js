(function () {
  "use strict";
  // Arka plan izleyici: takipçi sayısını periyodik okur, düşüşte/artışta native bildirim gönderir,
  // izlenen profilleri kontrol eder ve aylık raporu hazırlar. Instagram'ın her sayfasında
  // (documentEnd) otomatik çalışır; ağır işleri panel meşgulken ertelenir.
  if (window.top !== window) return;
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  if (window.__igdWatch) return;
