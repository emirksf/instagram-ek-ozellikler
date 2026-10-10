
  // ================================================================ dış arayüz (Swift köprüsü ve menü bunu çağırır)
  window.__igd = {
    open: (section) => showPanel(section),
    instagram: () => showInstagram(),
    busy: () => isBusy(),   // izleyici, panel meşgulken ağır işlerini erteler
  };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
