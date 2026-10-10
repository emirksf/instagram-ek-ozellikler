
  // ================================================================ İZLEYİCİ
  const K_EN = "igd_watch_enabled";
  const K_NEW = "igd_watch_newfollowers";
  const K_INT = "igd_watch_interval";      // dakika
  const K_COUNT = "igd_follower_count";     // son bilinen takipçi sayısı
  const K_LAST = "igd_watch_last";          // epoch ms
  const K_DEEP = "igd_watch_deep";          // düşüşte otomatik "kim ayrıldı" taraması
  const K_LASTDEEP = "igd_last_deepscan";   // son derin tarama epoch ms
  const K_SERIES = "igd_series_on";         // grafik için takipçi sayısını kaydet (varsayılan açık)
  const MIN_DEEP_GAP = 3 * 3600 * 1000;      // en fazla 3 saatte bir derin tarama
  const SNAP_FRESH = 6 * 3600 * 1000;        // bu kadar yeni tam liste varsa aylık rapor yeniden taramaz

  const enabled = () => lsGet(K_EN, "0") === "1";
  const seriesOn = () => lsGet(K_SERIES, "1") !== "0";
  const reportAuto = () => lsGet("igd_report_auto", "0") === "1";
  const intervalMs = () => Math.max(10, parseInt(lsGet(K_INT, "30"), 10)) * 60000;

  let timer = null, deepBusy = false, monthlyBusy = false;
  let pendingDeep = 0; // panel meşgulken ertelenen "kim ayrıldı" taraması (beklenen takipçi sayısı)

  // Yalnızca takipçi SAYISINI çeker — tek ucuz istek (30k'da bile güvenli).
  async function fetchCount() {
    const uid = getCookie("ds_user_id");
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

  // Tüm takipçileri {pk: username} olarak çeker. Döner: {map, complete} ya da null (alınamadı).
  async function fetchAllFollowersMap(expected) {
    const uid = getCookie("ds_user_id"); if (!uid) return null;
    const map = {}; let maxId = "", guard = 0;
    try {
      while (true) {
        if (++guard > 600) break;
        const { users, nextMaxId } = await fetchFollowersPage(uid, maxId);
        users.forEach((u) => { map[String(u.pk)] = u.username; });
        maxId = nextMaxId;
        if (!maxId) break;
        await sleep(rand(800, 1500));
      }
    } catch (e) { return null; }
    return { map, complete: isCompleteList(Object.keys(map).length, expected) };
  }

  // Derin tarama: tüm takipçileri çekip önceki TAM listeyle karşılaştırır, ayrılanların isimlerini bildirir.
  async function deepScan(expected) {
    if (deepBusy) return;
    if (panelBusy()) { pendingDeep = expected || pendingDeep || 1; return; } // panel çalışıyorsa sonraki kontrolde yap
    pendingDeep = 0;
    deepBusy = true;
    try {
      lsSet(K_LASTDEEP, String(Date.now())); // baştan işaretle (tekrar tetiklenmesin)
      post({ type: "watch", status: "kim ayrıldı? derin tarama…" });
      const r = await fetchAllFollowersMap(expected);
      if (!r) return;
      const n = Object.keys(r.map).length;
      post({ type: "watch", status: `açık · ${fmtN(expected || n)} takipçi` });
      if (!r.complete) {
        post({ type: "notify", title: "Kim ayrıldı belirlenemedi", body: `Instagram takipçi listenin yalnızca ${fmtN(n)} / ${fmtN(expected)} kısmını verdi; eksik listeyle karşılaştırma yapılmadı.`, panel: "followers" });
        return;
      }
      const prev = await DB.get(K.snapFollowers);
      await DB.set(K.snapFollowers, { t: Date.now(), count: n, expected, complete: true, map: r.map });
      if (!prev || !prev.complete || !prev.map) return; // ilk tam liste → temel al
      const gone = [];
      for (const pk in prev.map) if (!(pk in r.map)) gone.push(prev.map[pk]);
      if (gone.length) {
        const l = gone.slice(0, 8).map((u) => "@" + u).join(", ") + (gone.length > 8 ? ` +${gone.length - 8}` : "");
        post({ type: "notify", title: gone.length === 1 ? `Takibi bıraktı: @${gone[0]}` : `Takibi bırakanlar (${gone.length}) 💔`, body: l, panel: "followers" });
      }
    } finally { deepBusy = false; }
  }

  // Aylık takipçi değişim raporu: gelen/ayrılan takipçileri isim isim çıkarır.
  // Son 6 saatte alınmış tam liste varsa yeniden taramaz.
  async function monthlyReport(expected) {
    if (monthlyBusy || panelBusy()) return;
    monthlyBusy = true;
    try {
      let cur = await DB.get(K.snapFollowers);
      if (!(cur && cur.complete && cur.t && Date.now() - cur.t < SNAP_FRESH)) {
        post({ type: "watch", status: "aylık rapor: takipçiler taranıyor…" });
        const r = await fetchAllFollowersMap(expected);
        if (!r || !r.complete) return; // eksik listeyle rapor üretme
        cur = { t: Date.now(), count: Object.keys(r.map).length, expected, complete: true, map: r.map };
        await DB.set(K.snapFollowers, cur);
      }
      const prev = await DB.get(K.snapReport);
      const now = Date.now();
      await DB.set(K.snapReport, { t: now, complete: true, map: cur.map });
      post({ type: "watch", status: `açık · ${fmtN(expected || cur.count)} takipçi` });
      if (!prev || !prev.map || prev.complete === false) {
        await DB.set(K.reportLast, { t: now, prevT: 0, gained: [], lost: [], baseline: true });
        return;
      }
      const gained = [], lost = [];
      for (const pk in cur.map) if (!(pk in prev.map)) gained.push({ pk, username: cur.map[pk] });
      for (const pk in prev.map) if (!(pk in cur.map)) lost.push({ pk, username: prev.map[pk] });
      await DB.set(K.reportLast, { t: now, prevT: prev.t, gained, lost });
      post({ type: "notify", title: "Aylık takipçi raporu hazır 📊", body: `+${gained.length} yeni · -${lost.length} ayrılan — ayrıntılar için tıkla`, panel: "report" });
    } finally { monthlyBusy = false; }
  }

  async function check() {
    const cur = await fetchCount();
    if (cur == null) { post({ type: "watch", status: "beklemede (oturum yok)" }); return; }
    lsSet(K_LAST, String(Date.now()));
    const raw = lsGet(K_COUNT, null);
    const prev = raw == null ? null : parseInt(raw, 10);
    lsSet(K_COUNT, String(cur));
    if (seriesOn()) { try { await seriesAdd(cur); } catch (e) {} }
    if (pendingDeep && !panelBusy()) await deepScan(cur); // ertelenmiş "kim ayrıldı" taraması
    post({ type: "watch", status: enabled() ? `açık · ${fmtN(cur)} takipçi` : "kapalı" });

    // Aylık takipçi değişim raporu (otomatik) — temel varsa ve 30 gün geçtiyse
    if (reportAuto()) {
      const snap = await DB.get(K.snapReport);
      if (snap && snap.t && (Date.now() - snap.t > 30 * 24 * 3600 * 1000)) await monthlyReport(cur);
    }

    if (!enabled() || prev == null || isNaN(prev)) return; // bildirim kapalı ya da ilk çalıştırma → temel al

    const diff = cur - prev;
    if (diff < 0) {
      const n = -diff;
      const lastDeep = parseInt(lsGet(K_LASTDEEP, "0"), 10);
      const canDeep = lsGet(K_DEEP, "0") === "1" && (Date.now() - lastDeep > MIN_DEEP_GAP);
      post({
        type: "notify",
        title: n === 1 ? "Biri seni takibi bıraktı 💔" : `${n} kişi takibi bıraktı 💔`,
        body: `Takipçi sayın: ${fmtN(prev)} → ${fmtN(cur)}.` +
              (canDeep ? " Kim olduğu birazdan ayrıca bildirilecek…" : " Kim olduğunu görmek için Takipçiler sayfasından tara."),
        panel: "followers",
      });
      if (canDeep) await deepScan(cur); // ağır ama 3 saatte bir sınırlı
    } else if (diff > 0 && lsGet(K_NEW, "0") === "1") {
      post({
        type: "notify",
        title: diff === 1 ? "Yeni takipçi 🎉" : `${diff} yeni takipçi 🎉`,
        body: `Takipçi sayın: ${fmtN(prev)} → ${fmtN(cur)}.`,
        panel: "followers",
      });
    }
  }

  // --- Profil izleme: izlenen hesapların takip/bırakma hareketlerini bildir ---
  const pfList = () => lsJSON("igd_pf_list", []);

  // Hedef hesabın takip ettiklerini çeker (id -> kullanıcı adı). Panel'deki 2000 üst sınırıyla tutarlı.
  async function fetchTargetFollowingMap(id) {
    const map = {}; let maxId = "", pages = 0;
    while (pages < 20) {
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
      let prev = null;
      try { const p = JSON.parse(lsGet("igd_pf_snap_" + acc.id, "null")); if (Array.isArray(p)) { prev = {}; p.forEach((id) => prev[id] = ""); } else prev = p; } catch (e) {}
      lsSet("igd_pf_snap_" + acc.id, JSON.stringify(cur));
      if (!prev) continue; // ilk kez → temel al, bildirim yok

      const wantF = acc.nf !== false; // varsayılan: açık (geri uyum)
      const wantU = acc.uf !== false;
      const news = wantF ? Object.keys(cur).filter((id) => !(id in prev)) : [];
      const gone = wantU ? Object.keys(prev).filter((id) => !(id in cur)) : [];
      const now = Date.now();
      const log = lsJSON("igd_pf_log_" + acc.id, []);

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
      lsSet("igd_pf_log_" + acc.id, JSON.stringify(log.slice(0, 300)));
      await sleep(rand(1200, 2200));
    }
  }

  // --- İki ayrı zamanlayıcı ---
  // (1) Ana tick: takipçi sayısı (+ grafik, bildirim, aylık rapor) — K_INT dk, varsayılan 30.
  // (2) pfTimer: profil izleme (igd_pf_interval dk, varsayılan 5, min 5) — bağımsız.
  const pfIntervalMs = () => Math.max(5, parseInt(lsGet("igd_pf_interval", "5"), 10)) * 60000;
  let pfTimer = null, tickBusy = false, pfCheckBusy = false;

  function tick() {
    if (tickBusy) return;
    tickBusy = true;
    (async () => { try { await migrateStorage(); await check(); } catch (e) {} finally { tickBusy = false; } })();
  }
  function pfTick() {
    if (pfCheckBusy || !pfList().length || panelBusy()) return; // panel meşgulse sonraki tura
    pfCheckBusy = true;
    (async () => { try { await pfCheck(); } finally { pfCheckBusy = false; } })();
  }
  const needsTick = () => enabled() || reportAuto() || seriesOn();
  function ensurePfTimer() { if (!pfTimer && pfList().length) pfTimer = setInterval(pfTick, pfIntervalMs()); }
  function restartPfTimer() { if (pfTimer) { clearInterval(pfTimer); pfTimer = null; } ensurePfTimer(); }
  function ensureTimer() {
    if (!timer && needsTick()) timer = setInterval(tick, intervalMs());
    ensurePfTimer();
  }
  function stopTimerIfIdle() {
    if (!needsTick() && timer) { clearInterval(timer); timer = null; }
    if (pfList().length === 0 && pfTimer) { clearInterval(pfTimer); pfTimer = null; }
  }

  function start() {
    lsSet(K_EN, "1");
    if (timer) { clearInterval(timer); timer = null; }
    tick();
    ensureTimer();
    post({ type: "watch", status: "açık" });
  }
  function stop() {
    lsSet(K_EN, "0");
    post({ type: "watch", status: "kapalı" });
    stopTimerIfIdle();
  }

  window.__igdWatch = {
    start, stop,
    checkNow: () => tick(),
    ensureTimer, restartPfTimer, stopTimerIfIdle,
    // Zamanlayıcının kontrolüyle aynı anda çalışmasın
    pfCheckNow: async () => {
      if (pfCheckBusy) return;
      pfCheckBusy = true;
      try { await pfCheck(); } finally { pfCheckBusy = false; }
    },
    busy: () => deepBusy || monthlyBusy || pfCheckBusy,
    isOn: enabled,
    lastCheck: () => parseInt(lsGet(K_LAST, "0"), 10),
    count: () => parseInt(lsGet(K_COUNT, "0"), 10),
  };

  migrateStorage();
  if (needsTick()) tick();
  ensureTimer();
})();
