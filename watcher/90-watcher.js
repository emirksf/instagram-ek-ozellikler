(function () {
  "use strict";
  // Arka plan izleyici: takipçi listesini periyodik tarar, "beni takibi bırakanları" tespit
  // eder ve native bildirim gönderir. Instagram'ın her sayfasında (documentEnd) otomatik çalışır.
  if (window.__igdWatch) return;

  const APP_ID = "936619743392459";
  const K_EN = "igd_watch_enabled";
  const K_NEW = "igd_watch_newfollowers";
  const K_INT = "igd_watch_interval";      // dakika
  const K_COUNT = "igd_follower_count";     // son bilinen takipçi sayısı
  const K_LAST = "igd_watch_last";          // epoch ms
  const K_DEEP = "igd_watch_deep";          // düşüşte otomatik "kim ayrıldı" taraması
  const K_LASTDEEP = "igd_last_deepscan";   // son derin tarama epoch ms
  const FULLSNAP = "igd_followers_fullsnap"; // {pk: username} — inject.js ile paylaşılır
  const MIN_DEEP_GAP = 3 * 3600 * 1000;      // en fazla 3 saatte bir derin tarama

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a;

  function cookie(n) {
    const p = ("; " + document.cookie).split("; " + n + "=");
    if (p.length === 2) return p.pop().split(";").shift();
    return undefined;
  }
  function api(u) {
    return fetch(u, {
      headers: { "x-ig-app-id": APP_ID, "x-requested-with": "XMLHttpRequest" },
      credentials: "include",
    });
  }
  function post(m) { try { window.webkit.messageHandlers.igd.postMessage(m); } catch (e) {} }

  const enabled = () => localStorage.getItem(K_EN) === "1";
  const intervalMs = () => Math.max(10, parseInt(localStorage.getItem(K_INT) || "30", 10)) * 60000;

  let timer = null, busy = false;

  // Yalnızca takipçi SAYISINI çeker — tek ucuz istek (30k'da bile güvenli).
  async function fetchCount() {
    const uid = cookie("ds_user_id");
    if (!uid) return null;
    let res;
    try { res = await api(`https://www.instagram.com/api/v1/users/${uid}/info/`); }
    catch (e) { return null; }
    if (!res.ok) return null;
    let d; try { d = await res.json(); } catch (e) { return null; }
    const u = d.user || (d.data && d.data.user);
    if (!u || typeof u.follower_count !== "number") return null;
    return u.follower_count;
  }

  // Derin tarama: tüm takipçileri çekip bir önceki anlık görüntüyle karşılaştırır,
  // ayrılanların İSİMLERİNİ bildirir. Ağır (30k'da ~300 istek) — 3 saatte bir sınırlı.
  async function deepScan() {
    const uid = cookie("ds_user_id");
    if (!uid) return;
    localStorage.setItem(K_LASTDEEP, String(Date.now())); // baştan işaretle (tekrar tetiklenmesin)
    post({ type: "watch", status: "kim ayrıldı? derin tarama…" });
    const map = {};
    let maxId = "", guard = 0;
    while (true) {
      if (++guard > 600) break;
      const url = `https://www.instagram.com/api/v1/friendships/${uid}/followers/?count=100` +
        (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
      let res;
      try { res = await api(url); } catch (e) { await sleep(3000); continue; }
      if (res.status === 429) { await sleep(30000); continue; }
      if (!res.ok) return;
      let d; try { d = await res.json(); } catch (e) { return; }
      (d.users || []).forEach((u) => { map[String(u.pk)] = u.username; });
      maxId = d.next_max_id;
      if (!maxId) break;
      await sleep(rand(800, 1500));
    }
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(FULLSNAP) || "null"); } catch (e) {}
    try { localStorage.setItem(FULLSNAP, JSON.stringify(map)); } catch (e) {}
    post({ type: "watch", status: `açık · ${Object.keys(map).length.toLocaleString("tr-TR")} takipçi` });
    if (!prev) return; // ilk derin tarama → temel al
    const gone = [];
    for (const pk in prev) if (!(pk in map)) gone.push(prev[pk]);
    if (gone.length) {
      const l = gone.slice(0, 8).map((u) => "@" + u).join(", ") + (gone.length > 8 ? ` +${gone.length - 8}` : "");
      post({ type: "notify", title: gone.length === 1 ? `Takibi bıraktı: @${gone[0]}` : `Takibi bırakanlar (${gone.length}) 💔`, body: l, panel: "followers" });
    }
  }

  // Tüm takipçileri map olarak çek (aylık rapor için).
  async function fetchAllFollowersMap() {
    const uid = cookie("ds_user_id"); if (!uid) return null;
    const map = {}; let maxId = "", guard = 0;
    while (true) {
      if (++guard > 600) break;
      const url = `https://www.instagram.com/api/v1/friendships/${uid}/followers/?count=100` + (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
      let res;
      try { res = await api(url); } catch (e) { await sleep(3000); continue; }
      if (res.status === 429) { await sleep(30000); continue; }
      if (!res.ok) return null;
      let d; try { d = await res.json(); } catch (e) { return null; }
      (d.users || []).forEach((u) => { map[String(u.pk)] = u.username; });
      maxId = d.next_max_id;
      if (!maxId) break;
      await sleep(rand(800, 1500));
    }
    return map;
  }

  // Aylık takipçi değişim raporu: gelen/ayrılan takipçileri isim isim çıkarır.
  async function monthlyReport() {
    post({ type: "watch", status: "aylık rapor: takipçiler taranıyor…" });
    const map = await fetchAllFollowersMap();
    if (!map) return;
    let prev = null; try { prev = JSON.parse(localStorage.getItem("igd_report_snap") || "null"); } catch (e) {}
    const now = Date.now();
    try { localStorage.setItem("igd_report_snap", JSON.stringify({ t: now, map })); } catch (e) {}
    post({ type: "watch", status: `açık · ${Object.keys(map).length.toLocaleString("tr-TR")} takipçi` });
    if (!prev || !prev.map) { try { localStorage.setItem("igd_report_last", JSON.stringify({ t: now, prevT: 0, gained: [], lost: [], baseline: true })); } catch (e) {} return; }
    const gained = [], lost = [];
    for (const pk in map) if (!(pk in prev.map)) gained.push({ pk, username: map[pk] });
    for (const pk in prev.map) if (!(pk in map)) lost.push({ pk, username: prev.map[pk] });
    try { localStorage.setItem("igd_report_last", JSON.stringify({ t: now, prevT: prev.t, gained, lost })); } catch (e) {}
    post({ type: "notify", title: "Aylık takipçi raporu hazır 📊", body: `+${gained.length} yeni · -${lost.length} ayrılan — ayrıntılar için tıkla`, panel: "report" });
  }

  async function check() {
    if (busy) return;
    busy = true;
    try {
      const cur = await fetchCount();
      if (cur == null) { post({ type: "watch", status: "beklemede (oturum yok)" }); return; }
      localStorage.setItem(K_LAST, String(Date.now()));
      const raw = localStorage.getItem(K_COUNT);
      const prev = raw == null ? null : parseInt(raw, 10);
      localStorage.setItem(K_COUNT, String(cur));
      post({ type: "watch", status: `açık · ${cur.toLocaleString("tr-TR")} takipçi` });

      // Aylık takipçi değişim raporu (otomatik) — temel varsa ve 30 gün geçtiyse
      if (localStorage.getItem("igd_report_auto") === "1") {
        let snap = null; try { snap = JSON.parse(localStorage.getItem("igd_report_snap") || "null"); } catch (e) {}
        if (snap && snap.t && (Date.now() - snap.t > 30 * 24 * 3600 * 1000)) await monthlyReport();
      }

      if (prev == null || isNaN(prev)) return; // ilk çalıştırma → temel al

      const diff = cur - prev;
      if (diff < 0) {
        const n = -diff;
        const deepOn = localStorage.getItem(K_DEEP) === "1";
        const lastDeep = parseInt(localStorage.getItem(K_LASTDEEP) || "0", 10);
        const canDeep = deepOn && (Date.now() - lastDeep > MIN_DEEP_GAP);
        post({
          type: "notify",
          title: n === 1 ? "Biri seni takibi bıraktı 💔" : `${n} kişi takibi bıraktı 💔`,
          body: `Takipçi sayın: ${prev.toLocaleString("tr-TR")} → ${cur.toLocaleString("tr-TR")}.` +
                (canDeep ? " Kim olduğu birazdan ayrıca bildirilecek…" : " Kim olduğunu görmek için Takipçiler sayfasından tara."),
          panel: "followers",
        });
        if (canDeep) await deepScan(); // ağır ama 3 saatte bir sınırlı
      } else if (diff > 0 && localStorage.getItem(K_NEW) === "1") {
        post({
          type: "notify",
          title: diff === 1 ? "Yeni takipçi 🎉" : `${diff} yeni takipçi 🎉`,
          body: `Takipçi sayın: ${prev.toLocaleString("tr-TR")} → ${cur.toLocaleString("tr-TR")}.`,
          panel: "followers",
        });
      }
    } finally { busy = false; }
  }

  // --- Profil takibi: izlenen hesapların YENİ takip ettiklerini bildir ---
  const pfList = () => { try { return JSON.parse(localStorage.getItem("igd_pf_list") || "[]"); } catch (e) { return []; } };

  // Hedef hesabın takip ettiklerini çeker (id -> kullanıcı adı). ~1500 üst sınırı.
  async function fetchTargetFollowingMap(id) {
    const map = {}; let maxId = "", pages = 0;
    while (pages < 20) { // panel'deki 2000 üst sınırıyla aynı (tutarlı diff)
      const url = `https://www.instagram.com/api/v1/friendships/${id}/following/?count=100` + (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
      let res;
      try { res = await api(url); } catch (e) { return null; }
      if (res.status === 429) { await sleep(30000); continue; }
      if (!res.ok) return null;
      let d; try { d = await res.json(); } catch (e) { return null; }
      (d.users || []).forEach((u) => { map[String(u.pk)] = u.username; });
      pages++; maxId = d.next_max_id;
      if (!maxId) break;
      await sleep(rand(700, 1200));
    }
    return map;
  }

  async function pfCheck() {
    const list = pfList();
    for (const acc of list) {
      const cur = await fetchTargetFollowingMap(acc.id);
      if (!cur) continue;
      const raw = localStorage.getItem("igd_pf_snap_" + acc.id);
      let prev = null;
      try { const p = JSON.parse(raw || "null"); if (Array.isArray(p)) { prev = {}; p.forEach((id) => prev[id] = ""); } else prev = p; } catch (e) {}
      try { localStorage.setItem("igd_pf_snap_" + acc.id, JSON.stringify(cur)); } catch (e) {}
      if (!prev) continue; // ilk kez → temel al, bildirim yok

      const wantF = acc.nf !== false; // varsayılan: açık (geri uyum)
      const wantU = acc.uf !== false;
      const news = wantF ? Object.keys(cur).filter((id) => !(id in prev)) : [];
      const gone = wantU ? Object.keys(prev).filter((id) => !(id in cur)) : [];
      const now = Date.now();
      let log = []; try { log = JSON.parse(localStorage.getItem("igd_pf_log_" + acc.id) || "[]"); } catch (e) {}

      if (news.length) {
        const body = news.slice(0, 6).map((id) => "@" + cur[id]).join(", ") + (news.length > 6 ? ` +${news.length - 6}` : "");
        post({ type: "notify", title: news.length === 1 ? `@${acc.username} yeni birini takip etti` : `@${acc.username} ${news.length} yeni takip ekledi`, body, panel: "profile" });
        news.forEach((id) => log.unshift({ u: cur[id], t: now, type: "follow" }));
      }
      if (gone.length) {
        const body = gone.slice(0, 6).map((id) => "@" + (prev[id] || id)).join(", ") + (gone.length > 6 ? ` +${gone.length - 6}` : "");
        post({ type: "notify", title: gone.length === 1 ? `@${acc.username} birini takibi bıraktı` : `@${acc.username} ${gone.length} kişiyi takibi bıraktı`, body, panel: "profile" });
        gone.forEach((id) => log.unshift({ u: prev[id] || id, t: now, type: "unfollow" }));
      }
      try { localStorage.setItem("igd_pf_log_" + acc.id, JSON.stringify(log.slice(0, 300))); } catch (e) {}
      await sleep(rand(1200, 2200));
    }
  }

  // --- İki ayrı zamanlayıcı ---
  // (1) Ana tick: takipçi sayısı + aylık rapor (K_INT dk, varsayılan 30).
  // (2) pfTimer: profil izleme (igd_pf_interval dk, varsayılan 5, min 5) — bağımsız.
  const pfIntervalMs = () => Math.max(5, parseInt(localStorage.getItem("igd_pf_interval") || "5", 10)) * 60000;
  let pfTimer = null, tickBusy = false, pfCheckBusy = false;

  function tick() {
    if (tickBusy) return;
    tickBusy = true;
    (async () => { try { if (enabled()) await check(); } finally { tickBusy = false; } })();
  }
  function pfTick() {
    if (pfCheckBusy || !pfList().length) return;
    pfCheckBusy = true;
    (async () => { try { await pfCheck(); } finally { pfCheckBusy = false; } })();
  }
  function ensurePfTimer() { if (!pfTimer && pfList().length) pfTimer = setInterval(pfTick, pfIntervalMs()); }
  function restartPfTimer() { if (pfTimer) { clearInterval(pfTimer); pfTimer = null; } ensurePfTimer(); }
  function ensureTimer() {
    if (!timer && (enabled() || localStorage.getItem("igd_report_auto") === "1")) timer = setInterval(tick, intervalMs());
    ensurePfTimer();
  }
  function stopTimerIfIdle() {
    if (!enabled() && localStorage.getItem("igd_report_auto") !== "1" && timer) { clearInterval(timer); timer = null; }
    if (pfList().length === 0 && pfTimer) { clearInterval(pfTimer); pfTimer = null; }
  }

  function start() {
    localStorage.setItem(K_EN, "1");
    if (timer) { clearInterval(timer); timer = null; }
    tick();
    ensureTimer();
    post({ type: "watch", status: "açık" });
  }
  function stop() {
    localStorage.setItem(K_EN, "0");
    post({ type: "watch", status: "kapalı" });
    stopTimerIfIdle();
  }

  window.__igdWatch = {
    start, stop,
    checkNow: () => check(),
    ensureTimer,
    restartPfTimer,
    // Zamanlayıcının kontrolüyle aynı anda çalışmasın
    pfCheckNow: async () => {
      if (pfCheckBusy) return;
      pfCheckBusy = true;
      try { await pfCheck(); } finally { pfCheckBusy = false; }
    },
    isOn: enabled,
    lastCheck: () => parseInt(localStorage.getItem(K_LAST) || "0", 10),
    count: () => parseInt(localStorage.getItem(K_COUNT) || "0", 10),
  };

  if (enabled()) start();
  ensureTimer();
})();
