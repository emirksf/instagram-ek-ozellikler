(function () {
  "use strict";
  // DM uyumluluk tanılaması (tek seferlik, kullanıcı başlatır).
  // Instagram 10 Ekim 2026'da web'deki direct_v2 REST uçlarını kaldırdı; DM'ler artık GraphQL ile okunuyor.
  // Bu betik, Instagram'ın KENDİ DM isteklerinin yalnızca YAPISINI kaydeder: sorgu adı, doc_id, değişken adları
  // ve yanıtın alan adları + veri türleri. İsim, mesaj, kimlik numarası, oturum anahtarı (fb_dtsg, lsd, çerez) KAYDEDİLMEZ.
  // Sayfa yüklenmeye başlarken (documentStart) çalışır ki Instagram'ın ilk isteklerini de görebilsin.
  if (window.top !== window) return;
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  let on = false;
  try { on = localStorage.getItem("igd_dmcap") === "1" && Date.now() - parseInt(localStorage.getItem("igd_dmcap_t") || "0", 10) < 30 * 60000; } catch (e) {}
  if (!on || window.__igdCap) return;
  window.__igdCap = true;

  const STORE = "igd_dmcap_data";
  const RX_NAME = /direct|inbox|thread|message|msys|igd|messag|chat/i;
  const MAX_ENTRIES = 40;

  // Değer yerine yalnızca tür ve uzunluk; kimlik gibi görünen anahtarlar da gizlenir.
  function shape(v, depth) {
    if (depth > 9) return "…";
    if (v === null) return "null";
    if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), "uzunluk:" + v.length] : ["boş dizi"];
    const t = typeof v;
    if (t === "string") return /^\d+$/.test(v) ? "rakam-dizesi:" + v.length : "dize:" + Math.min(v.length, 999);
    if (t === "number") return "sayı:" + String(Math.trunc(Math.abs(v))).length + "hane";
    if (t === "boolean") return "mantıksal";
    if (t !== "object") return t;
    const out = {}; let n = 0;
    for (const k of Object.keys(v)) {
      if (++n > 80) { out["…"] = Object.keys(v).length + " alan"; break; }
      const safeKey = /^\d{4,}$/.test(k) || /^[0-9a-f]{16,}$/i.test(k) ? "<kimlik>" : k;
      out[safeKey] = shape(v[k], depth + 1);
    }
    return out;
  }
  function parseBody(body) {
    try {
      if (!body) return null;
      if (typeof body === "string") return new URLSearchParams(body);
      if (body instanceof URLSearchParams) return body;
      if (body instanceof FormData) { const p = new URLSearchParams(); body.forEach((v, k) => { if (typeof v === "string") p.append(k, v); }); return p; }
    } catch (e) {}
    return null;
  }
  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(STORE, JSON.stringify(list.slice(-MAX_ENTRIES))); } catch (e) {} }

  function record(url, method, body, status, text) {
    let u; try { u = new URL(url, location.href); } catch (e) { return; }
    const path = u.pathname;
    const isGql = /graphql/.test(path);
    const isRestDm = /\/api\/v1\/direct/.test(path);
    if (!isGql && !isRestDm) return;
    const p = parseBody(body);
    const name = (p && (p.get("fb_api_req_friendly_name") || "")) || "";
    if (isGql && !RX_NAME.test(name)) return;
    let vars = null;
    try { vars = p && p.get("variables") ? shape(JSON.parse(p.get("variables")), 0) : null; } catch (e) { vars = "ayrıştırılamadı"; }
    let res = null;
    try {
      // @defer yanıtları birden çok JSON satırı olabilir
      const parts = String(text || "").split(/\r?\n/).filter((l) => l.trim().startsWith("{")).slice(0, 4);
      res = parts.map((l) => { try { return shape(JSON.parse(l), 0); } catch (e) { return "json değil"; } });
    } catch (e) {}
    const entry = {
      t: Date.now(), method, path: path.replace(/\d{5,}/g, "<kimlik>"), status,
      name: name || null, doc_id: p && p.get("doc_id") || null,
      formKeys: p ? [...new Set([...p.keys()])] : null, // yalnızca alan ADLARI (değerler yok)
      variables: vars, response: res,
    };
    const list = load();
    if (!list.some((e) => e.name === entry.name && e.path === entry.path && e.doc_id === entry.doc_id)) { list.push(entry); save(list); }
  }

  // XHR: prototip üzerinden (Instagram kurucuyu önceden saklamış olsa da yakalanır)
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) { this.__igdc = { m, url }; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    const c = this.__igdc;
    if (c) this.addEventListener("load", () => { try { record(c.url, c.m, body, this.status, this.responseType === "" || this.responseType === "text" ? this.responseText : ""); } catch (e) {} });
    return XS.apply(this, arguments);
  };
  // fetch
  const F = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const p = F.apply(this, arguments);
    p.then((r) => { if (/graphql|\/api\/v1\/direct/.test(url)) r.clone().text().then((t) => record(url, (init && init.method) || "GET", init && init.body, r.status, t)).catch(() => {}); }).catch(() => {});
    return p;
  };
})();
