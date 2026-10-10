(function () {
  "use strict";

  // Panel yalnızca Instagram'ın ana çerçevesinde çalışır (SocialBlade / profil pencereleri hariç).
  if (window.top !== window) return;
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  if (window.__igd) { window.__igd.open(); return; }
