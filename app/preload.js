// Ana pencerenin önyükleyicisi: panel betiklerini Instagram sayfasının kendi dünyasında çalıştırır
// (sayfanın fetch'i ve çerezleriyle), kabuğa da yalnızca tek bir mesaj kanalı açar.
const { contextBridge, ipcRenderer, webFrame } = require("electron");

const S = ipcRenderer.sendSync("igd-scripts"); // Instagram dışındaki sayfalarda null
if (S) {
  contextBridge.exposeInMainWorld("igdNative", {
    post: (msg) => ipcRenderer.send("igd", msg),
    version: S.version,
    platform: S.platform,
  });
  // DM yardımcısı Instagram'ın ilk isteklerinden önce (sayfa başı), panel ve izleyici DOM hazır olunca
  webFrame.executeJavaScript(S.cap);
  window.addEventListener("DOMContentLoaded", () => {
    webFrame.executeJavaScript(S.watcher);
    webFrame.executeJavaScript(S.inject);
  });
}
