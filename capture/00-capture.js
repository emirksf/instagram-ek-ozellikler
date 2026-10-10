(function () {
  "use strict";
  // GraphQL yardımcısı (sayfa başında, documentStart).
  // Instagram 10 Ekim 2026'da web'deki direct_v2 REST uçlarını kaldırdı; DM'ler artık GraphQL ile okunuyor.
  // 1) Öğrenme (her zaman): Instagram'ın KENDİ GraphQL isteklerinden
  //    - istek şablonunu (oturum anahtarları dahil) YALNIZCA BELLEKTE tutar → panel aynı oturumla sorgu yapabilsin,
  //    - DM sorgularının güncel doc_id'sini ve kişisel olmayan değişkenlerini localStorage'a yazar → Instagram
  //      kimlikleri değiştirse bile DM kutusu bir kez açılınca uygulama kendini günceller.
  // 2) Tanılama (yalnızca kullanıcı başlatınca, 30 dk): DM isteklerinin YAPISINI kaydeder (alan adları + türler).
  //    İsim, mesaj, kimlik numarası, oturum anahtarı ve çerez KAYDEDİLMEZ.
  if (window.top !== window) return;
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  if (window.__igdCap) return;
  window.__igdCap = true;

  let diag = false;
  try { diag = localStorage.getItem("igd_dmcap") === "1" && Date.now() - parseInt(localStorage.getItem("igd_dmcap_t") || "0", 10) < 30 * 60000; } catch (e) {}

  const STORE = "igd_dmcap_data";
  const DOCS = "igd_gql_docs";
  const RX_NAME = /direct|inbox|thread|message|msys|igd|messag|chat/i;
  const RX_LEARN = /^(PolarisDirectInboxQuery|IGDThreadList\w*PaginationQuery|IGDThreadDetailQuery)$/;
  // Değişkenlerden kişisel/oturuma özgü olanlar saklanmaz
  const VAR_DROP = /^(id|cursor|after|before)$|device|fbid|thread|seq_id|user_?id|viewer/i;
  const MAX_ENTRIES = 40;

  // Panel kendi sorgularında bunu kullanır; böylece kendi istekleri "öğrenilmez"
  window.__igdNativeFetch = window.fetch.bind(window);

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
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function learn(p, headers) {
    // İstek şablonu: yalnızca bellekte (fb_dtsg / lsd gibi oturum anahtarları içerir)
    window.__igdGql = { params: p.toString(), headers: headers || {}, t: Date.now() };
    const name = p.get("fb_api_req_friendly_name") || "";
    if (!RX_LEARN.test(name) || !p.get("doc_id")) return;
    let vars = {};
    try { vars = JSON.parse(p.get("variables") || "{}"); } catch (e) {}
    Object.keys(vars).forEach((k) => { if (VAR_DROP.test(k)) delete vars[k]; });
    const docs = load(DOCS, {});
    docs[name] = { doc_id: p.get("doc_id"), vars, t: Date.now() };
    save(DOCS, docs);
  }

  function record(url, method, body, status, text, headers) {
    let u; try { u = new URL(url, location.href); } catch (e) { return; }
    const path = u.pathname;
    const isGql = /graphql/.test(path);
    const p = parseBody(body);
    if (isGql && p && String(method).toUpperCase() === "POST") learn(p, headers);
    if (!diag) return;
    const isRestDm = /\/api\/v1\/direct/.test(path);
    if (!isGql && !isRestDm) return;
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
    const list = load(STORE, []);
    if (!list.some((e) => e.name === entry.name && e.path === entry.path && e.doc_id === entry.doc_id)) { list.push(entry); save(STORE, list.slice(-MAX_ENTRIES)); }
  }

  const KEEP_HEADERS = ["x-asbd-id", "x-fb-lsd", "x-ig-app-id", "x-csrftoken", "x-bloks-version-id", "x-ig-d"];
  // XHR: prototip üzerinden (Instagram kurucuyu önceden saklamış olsa da yakalanır)
  const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send, XH = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, url) { this.__igdc = { m, url, h: {} }; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try { const lk = String(k).toLowerCase(); if (this.__igdc && KEEP_HEADERS.includes(lk)) this.__igdc.h[lk] = String(v); } catch (e) {}
    return XH.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const c = this.__igdc;
    if (c && /graphql|\/api\/v1\/direct/.test(String(c.url))) {
      this.addEventListener("load", () => {
        try { record(c.url, c.m, body, this.status, diag && (this.responseType === "" || this.responseType === "text") ? this.responseText : "", c.h); } catch (e) {}
      });
    }
    return XS.apply(this, arguments);
  };
  // WebSocket (yalnızca tanılama modunda): Instagram bazı DM işlemlerini (ör. mesaj geri çekme) gerçek zamanlı
  // kanaldan gönderebilir. İçerik KAYDEDİLMEZ; yalnızca adres yolu, paket türü ve boyutu.
  if (diag && window.WebSocket) {
    const WS = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      try {
        const u = new URL(this.url);
        const size = typeof data === "string" ? data.length : (data && (data.byteLength || data.size)) || 0;
        const key = "WS " + u.host + u.pathname;
        const list = load(STORE, []);
        let e = list.find((x) => x.path === key);
        if (!e) { e = { t: Date.now(), method: "WS", path: key, name: null, frames: 0, sizes: [] }; list.push(e); }
        e.frames++; if (e.sizes.length < 30) e.sizes.push((typeof data === "string" ? "metin:" : "ikili:") + size);
        e.lastT = Date.now();
        save(STORE, list.slice(-MAX_ENTRIES));
      } catch (err) {}
      return WS.apply(this, arguments);
    };
  }

  // fetch
  const F = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const p = F.apply(this, arguments);
    if (/graphql|\/api\/v1\/direct/.test(url)) {
      const h = {};
      try { const src = init && init.headers; if (src) new Headers(src).forEach((v, k) => { if (KEEP_HEADERS.includes(k)) h[k] = v; }); } catch (e) {}
      p.then((r) => {
        if (diag) r.clone().text().then((t) => record(url, (init && init.method) || "GET", init && init.body, r.status, t, h)).catch(() => {});
        else record(url, (init && init.method) || "GET", init && init.body, r.status, "", h);
      }).catch(() => {});
    }
    return p;
  };
})();
