
  // ================================================================ dış arayüz (Swift köprüsü ve menü bunu çağırır)
  window.__igd = {
    open: (section) => showPanel(section),
    instagram: () => showInstagram(),
  };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
