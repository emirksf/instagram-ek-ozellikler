// Uygulama kabuğu (Mac ve Windows): Instagram'ı bir pencerede açar, panel betiklerini yükler (preload.js);
// menü, menü çubuğu / sistem tepsisi simgesi, bildirimler, Downloads'a dışa aktarma, yan pencereler ve otomatik güncelleme.
const { app, BrowserWindow, Menu, Tray, Notification, dialog, ipcMain, shell, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const IG_URL = "https://www.instagram.com/";
const MAC = process.platform === "darwin";
const APP_ID = "com.emirkosif.instadenetim";
// package.json → build.publish ile aynı depo (paketlenmiş uygulamada "build" alanı silinir, oradan okunamaz)
const RELEASES_URL = "https://github.com/emirksf/instagram-ek-ozellikler/releases/latest";
// Electron/uygulama adı geçmeyen sıradan bir Chrome kimliği (Instagram gömülü tarayıcı sanmasın)
const UA = `Mozilla/5.0 (${MAC ? "Macintosh; Intel Mac OS X 10_15_7" : "Windows NT 10.0; Win64; x64"}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
// "1.0.0" → "1.0", "1.0.3" → "1.0.3"
const VER = app.getVersion().replace(/^(\d+\.\d+)\.0$/, "$1");
const BG_WHERE = MAC ? "menü çubuğunda" : "sistem tepsisinde (saatin yanındaki simgeler)";

let win = null, tray = null, sbWin = null, auxWin = null;
let quitting = false, watchStatus = "kapalı";
let pendingSection = null, panelReloadTried = false;
let updateReady = null; // indirilip kurulmayı bekleyen sürüm

// Paket adı ASCII ("Ozellikler"): Mac'te "Ö" dosya adlarında farklı kodlanıp uygulamayı çökertiyor. Görünen ad
// Mac'te InfoPlist.strings'ten, burada da iletişim kutuları ve bildirimler için. Veri klasörü ASCII adla kalır.
const userData = process.env.IGD_USER_DATA || app.getPath("userData"); // geliştirirken ayrı klasör verilebilir
app.setName("Instagram EK Özellikler");
app.setPath("userData", userData);

// ================================================================ küçük kalıcı ayarlar (pencere boyutu, ipucu)
const PREFS = path.join(app.getPath("userData"), "prefs.json");
let prefs = {};
try { prefs = JSON.parse(fs.readFileSync(PREFS, "utf8")); } catch (e) {}
function savePrefs() { try { fs.writeFileSync(PREFS, JSON.stringify(prefs)); } catch (e) {} }

// ================================================================ panel betikleri
const GEN = path.join(__dirname, "gen");
const SCRIPTS = {};
for (const k of ["dmcapture", "watcher", "inject"]) {
  try { SCRIPTS[k] = fs.readFileSync(path.join(GEN, k + ".js"), "utf8"); } catch (e) { SCRIPTS[k] = ""; }
}
const isInstagram = (u) => { try { return /(^|\.)instagram\.com$/.test(new URL(u).hostname); } catch (e) { return false; } };

// Betikler yalnızca ana penceredeki Instagram sayfasına verilir
ipcMain.on("igd-scripts", (e) => {
  const ok = win && e.sender === win.webContents && e.senderFrame && e.senderFrame === e.sender.mainFrame && isInstagram(e.senderFrame.url);
  e.returnValue = ok ? { cap: SCRIPTS.dmcapture, watcher: SCRIPTS.watcher, inject: SCRIPTS.inject, version: app.getVersion(), platform: process.platform } : null;
});

// Panel → kabuk mesajları (Mac sürümündeki WKScriptMessageHandler'ın karşılığı)
const str = (v, max) => String(v == null ? "" : v).slice(0, max || 500);
ipcMain.on("igd", (e, m) => {
  if (!win || e.sender !== win.webContents || !m || typeof m !== "object") return;
  switch (m.type) {
    case "notify": notify(str(m.title, 200) || "Instagram", str(m.body), m.panel ? str(m.panel, 40) : null); break;
    case "export": if (typeof m.name === "string" && typeof m.content === "string") saveExport(m.name, m.content, str(m.label, 100) || "Dosya kaydedildi"); break;
    case "sb": if (typeof m.username === "string") openSocialBlade(m.username); break;
    case "watch": watchStatus = str(m.status, 80); buildTrayMenu(); break;
  }
});

// ================================================================ ana pencere
function createWindow() {
  const b = prefs.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1180, height: b.height || 820, x: b.x, y: b.y,
    minWidth: 840, minHeight: 600,
    title: `Instagram EK Özellikler v${VER}`,
    icon: MAC ? undefined : path.join(__dirname, "..", "assets", "tray-win.png"),
    autoHideMenuBar: !MAC,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false, // pencere gizliyken de izleyici zamanlayıcıları aksamasın
    },
  });
  win.on("page-title-updated", (e) => e.preventDefault());
  win.once("ready-to-show", () => win.show());
  const remember = () => { if (!win.isMinimized() && !win.isFullScreen()) { prefs.bounds = win.getBounds(); savePrefs(); } };
  win.on("resized", remember); win.on("moved", remember);

  // Pencereyi kapatmak uygulamayı kapatmaz — izleyici arka planda sürsün
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    if (!prefs.closeHint) {
      prefs.closeHint = true; savePrefs();
      const r = dialog.showMessageBoxSync(win, {
        type: "info", buttons: ["Anladım", "Uygulamadan Çık"], defaultId: 0, cancelId: 0,
        message: `Uygulama ${MAC ? "menü çubuğunda" : "sistem tepsisinde"} çalışmaya devam ediyor`,
        detail: `Takipçi bildirimleri, profil izleme ve hikaye takibi arka planda sürer. Pencereyi ${BG_WHERE} simgeden geri açabilirsin. Tamamen kapatmak için simgedeki “Çıkış”ı${MAC ? " ya da ⌘Q'yu" : ""} kullan.`,
      });
      if (r === 1) { app.quit(); return; }
    }
    win.hide();
  });

  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) openAux(url); return { action: "deny" }; });
  win.webContents.on("did-finish-load", () => {
    if (pendingSection == null) return;
    const sec = pendingSection; pendingSection = null;
    setTimeout(() => { if (sec) openPanel(sec); panelReloadTried = false; }, 400);
  });
  win.loadURL(IG_URL);
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

// Paneli (isteğe bağlı bir bölümle) aç. Panel bu sayfada yoksa Instagram'ı yükler; yüklenince açılır.
function openPanel(section) {
  const clean = section ? String(section).replace(/[^a-z#]/g, "") : null;
  const arg = clean ? JSON.stringify(clean) : "undefined";
  win.webContents.executeJavaScript(`window.__igd ? (window.__igd.open(${arg}), true) : false`).then((r) => {
    if (r !== false || panelReloadTried) return; // sonsuz yeniden yükleme olmasın
    panelReloadTried = true;
    pendingSection = clean || "";
    win.loadURL(IG_URL);
  }).catch(() => {});
}
function showPanel(section) { showWindow(); openPanel(section || null); }
function showInstagram() { showWindow(); win.webContents.executeJavaScript("window.__igd ? (window.__igd.instagram(), true) : false").catch(() => {}); }

// ================================================================ yan pencereler (SocialBlade, profil bağlantıları)
function sideWindow(title) {
  const w = new BrowserWindow({ width: 1040, height: 820, title, autoHideMenuBar: true, webPreferences: { sandbox: true, contextIsolation: true } });
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) w.loadURL(url); return { action: "deny" }; });
  return w;
}
function openSocialBlade(username) {
  const clean = String(username || "").replace(/^[@\s]+|\s+$/g, "").toLowerCase();
  if (!clean) return;
  if (!sbWin || sbWin.isDestroyed()) sbWin = sideWindow("SocialBlade");
  sbWin.loadURL("https://socialblade.com/instagram/user/" + encodeURIComponent(clean));
  sbWin.show(); sbWin.focus();
}
// Kullanıcı adı sorma: küçük bir form, gönderilince aynı pencere SocialBlade'e gider
function socialBladePrompt() {
  if (!sbWin || sbWin.isDestroyed()) sbWin = sideWindow("SocialBlade");
  const html = `<!doctype html><meta charset="utf-8"><title>SocialBlade'de Ara</title>
    <body style="font:15px -apple-system,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:90vh;margin:0">
    <form onsubmit="event.preventDefault();var v=document.getElementById('u').value.trim().replace(/^@/,'').toLowerCase();if(v)location.href='https://socialblade.com/instagram/user/'+encodeURIComponent(v)">
    <p>Instagram kullanıcı adını gir:</p><input id="u" autofocus placeholder="kullaniciadi" style="font:inherit;padding:8px;width:240px"> <button style="font:inherit;padding:8px 14px">Aç</button></form>`;
  sbWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  sbWin.show(); sbWin.focus();
}
function openAux(url) {
  if (!auxWin || auxWin.isDestroyed()) auxWin = sideWindow("Instagram");
  auxWin.loadURL(url);
  auxWin.show(); auxWin.focus();
}

// ================================================================ bildirimler ve dışa aktarma
const liveNotes = new Set(); // tıklanabilmeleri için bildirimler çöpe gitmesin
function notify(title, body, panel, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  liveNotes.add(n);
  const done = () => liveNotes.delete(n);
  n.on("click", () => { done(); if (onClick) onClick(); else showPanel(panel); });
  n.on("close", done);
  n.show();
}

// DM yedeğini / CSV'yi Downloads klasörüne yaz (kullanıcının kendi verisi, kendi isteğiyle).
function saveExport(name, content, label) {
  const safe = path.basename(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "disa-aktarim.txt";
  const file = path.join(app.getPath("downloads"), safe);
  try {
    fs.writeFileSync(file, content, "utf8");
    notify(label, file, null, () => shell.showItemInFolder(file));
  } catch (e) {
    dialog.showMessageBox({ type: "error", message: "Dosya kaydedilemedi", detail: e.message });
  }
}

// ================================================================ menüler
function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Paneli Göster", click: () => showPanel() },
    { label: "Instagram'ı Göster", click: showInstagram },
    { label: "SocialBlade Ara…", click: socialBladePrompt },
    { type: "separator" },
    { label: "İzleyici: " + watchStatus, enabled: false },
    ...(updateReady ? [{ type: "separator" }, { label: `Güncellemeyi kur ve yeniden başlat (v${updateReady})`, click: installUpdate }] : []),
    { type: "separator" },
    { label: "Çıkış", click: () => app.quit() },
  ]));
}
function setupTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", MAC ? "trayTemplate.png" : "tray-win.png"));
  if (MAC) icon.setTemplateImage(true);
  tray = new Tray(MAC ? icon : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Instagram EK Özellikler");
  if (!MAC) tray.on("click", showWindow);
  buildTrayMenu();
}

function buildAppMenu() {
  const appItems = [
    { label: "Paneli Göster", accelerator: "CmdOrCtrl+1", click: () => showPanel() },
    { label: "Instagram'ı Göster", accelerator: "CmdOrCtrl+2", click: showInstagram },
    { label: "SocialBlade Ara…", accelerator: "CmdOrCtrl+B", click: socialBladePrompt },
    { type: "separator" },
    { label: "Ayarlar…", accelerator: "CmdOrCtrl+,", click: () => showPanel("settings") },
    { label: "Gizlilik ve Güvenlik…", click: () => showPanel("settings#privacy") },
    { type: "separator" },
    updateReady ? { label: `Güncellemeyi kur ve yeniden başlat (v${updateReady})`, click: installUpdate }
      : { label: "Güncellemeleri Denetle…", click: () => checkUpdates(true) },
    { type: "separator" },
    { label: "Çıkış", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
  ];
  const tpl = [
    { label: MAC ? app.name : "Uygulama", submenu: appItems },
    { label: "Düzenle", submenu: [
      { label: "Geri Al", role: "undo" }, { label: "Yinele", role: "redo" }, { type: "separator" },
      { label: "Kes", role: "cut" }, { label: "Kopyala", role: "copy" }, { label: "Yapıştır", role: "paste" }, { label: "Tümünü Seç", role: "selectAll" },
    ] },
    { label: "Görünüm", submenu: [
      { label: "Yeniden Yükle", accelerator: "CmdOrCtrl+R", click: () => win && win.reload() },
      { label: "Yakınlaştır", role: "zoomIn" }, { label: "Uzaklaştır", role: "zoomOut" }, { label: "Gerçek Boyut", role: "resetZoom" },
      ...(app.isPackaged ? [] : [{ type: "separator" }, { label: "Geliştirici Araçları", role: "toggleDevTools" }]),
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ================================================================ otomatik güncelleme (GitHub Releases)
// Açılışta ve 6 saatte bir bakar; yeni sürüm arka planda iner, yeniden başlatınca (ya da çıkışta) kurulur.
let manualCheck = false, seenVersion = null;
function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", (info) => {
    seenVersion = info.version;
    if (manualCheck) dialog.showMessageBox({ type: "info", message: `Yeni sürüm bulundu: v${info.version}`, detail: "Arka planda indiriliyor; hazır olunca haber vereceğim." });
    manualCheck = false;
  });
  autoUpdater.on("update-not-available", () => {
    if (manualCheck) dialog.showMessageBox({ type: "info", message: "Uygulama güncel", detail: `Kullandığın sürüm: v${app.getVersion()}` });
    manualCheck = false;
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateReady = info.version;
    buildAppMenu(); buildTrayMenu();
    notify("Güncelleme hazır", `v${info.version} indirildi. Kurmak için tıkla — ya da uygulamadan çıkınca kendiliğinden kurulur.`, null, askInstall);
    if (win && win.isVisible() && win.isFocused()) askInstall();
  });
  autoUpdater.on("error", (err) => {
    const msg = String(err && err.message || err).split("\n")[0];
    if (manualCheck) {
      manualCheck = false;
      dialog.showMessageBox({ type: "warning", message: "Güncelleme denetlenemedi", detail: msg, buttons: ["Tamam", "İndirme sayfasını aç"] })
        .then((r) => { if (r.response === 1) shell.openExternal(RELEASES_URL); });
    } else if (seenVersion && !updateReady) {
      // Yeni sürüm var ama kendiliğinden kurulamadı → elle indirme yolu
      notify("Yeni sürüm var", `v${seenVersion} kendiliğinden kurulamadı. İndirme sayfasını açmak için tıkla.`, null, () => shell.openExternal(RELEASES_URL));
      seenVersion = null;
    }
  });
  setTimeout(() => checkUpdates(false), 15000);
  setInterval(() => checkUpdates(false), 6 * 3600 * 1000);
}
function checkUpdates(manual) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox({ type: "info", message: "Geliştirme sürümü", detail: "Güncelleme denetimi yalnızca kurulu uygulamada çalışır." });
    return;
  }
  if (updateReady) { askInstall(); return; }
  manualCheck = manual;
  autoUpdater.checkForUpdates().catch(() => {}); // hata "error" olayında işlenir
}
function askInstall() {
  if (!updateReady) return;
  dialog.showMessageBox({
    type: "info", buttons: ["Şimdi yeniden başlat", "Sonra"], defaultId: 0, cancelId: 1,
    message: `Yeni sürüm hazır: v${updateReady}`,
    detail: "Uygulama kapanıp güncellenmiş hâliyle yeniden açılacak. “Sonra” dersen uygulamadan çıktığında kendiliğinden kurulur.",
  }).then((r) => { if (r.response === 0) installUpdate(); });
}
function installUpdate() { quitting = true; autoUpdater.quitAndInstall(); }

// ================================================================ açılış
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.setAppUserModelId(APP_ID); // Windows bildirimleri uygulama adıyla gelsin
  app.userAgentFallback = UA;
  app.whenReady().then(() => {
    buildAppMenu();
    setupTray();
    createWindow();
    setupUpdates();
  });
  app.on("activate", showWindow); // Mac: Dock simgesine tıklanınca
  app.on("before-quit", () => { quitting = true; });
  app.on("window-all-closed", () => {}); // pencere gizlenir, uygulama tepside sürer
}
