
  // ================================================================ ORTAK: kalıcı depo (IndexedDB)
  // localStorage ~5 MB ile sınırlı ve büyük hesaplarda doluyordu. Büyük veri (tarama sonuçları,
  // takipçi anlık görüntüleri, geçmiş, grafik verisi, iş kuyruğu) IndexedDB'de; küçük ayarlar localStorage'da.
  const DB = (() => {
    let dbp = null;
    function open() {
      if (!dbp) dbp = new Promise((resolve, reject) => {
        const r = indexedDB.open("igd", 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv"); };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => { dbp = null; reject(r.error); };
      });
      return dbp;
    }
    function req(mode, fn) {
      return open().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction("kv", mode);
        const r = fn(tx.objectStore("kv"));
        tx.oncomplete = () => resolve(r && r.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }));
    }
    return {
      get: (k) => req("readonly", (s) => s.get(k)),
      set: (k, v) => req("readwrite", (s) => s.put(v, k)),
      del: (k) => req("readwrite", (s) => s.delete(k)),
    };
  })();

  // Aynı anahtara oku-değiştir-yaz yapan işlemleri sıraya koy (iki betik aynı window'u paylaşır)
  const LOCKS = window.__igdLocks || (window.__igdLocks = {});
  function withLock(key, fn) {
    const p = (LOCKS[key] || Promise.resolve()).then(fn, fn);
    LOCKS[key] = p.catch(() => {});
    return p;
  }

  // Anahtarlar
  const K = {
    cache: "cache",                 // panelin tarama sonuçları
    snapFollowers: "snap:followers", // son TAM takipçi listesi {t, count, map:{pk:username}}
    snapReport: "snap:report",       // son raporun temeli {t, map}
    reportLast: "report:last",       // son rapor sonucu
    resumeFollowers: "resume:followers", // yarım takipçi taraması imleci
    history: "history",              // işlem geçmişi [{t,a,pk,u,ok,e}]
    series: "series:followers",      // takipçi sayısı geçmişi [[t,n]]
    queue: "queue",                  // toplu işlem kuyruğu
    likes: "likes",                  // son gönderileri beğenenler (hayalet takipçiler)
    stories: "stories",              // hikayeme bakanlar: hikaye başına izleyiciler + günlük
  };

  // Eski localStorage verisini bir kez IndexedDB'ye taşı ve yer aç (iki betik de çağırabilir).
  function migrateStorage() {
    if (window.__igdMig) return window.__igdMig;
    window.__igdMig = (async () => {
      // Eski anlık görüntüler eksik olabilir (Instagram listeyi kısaltmış olabilir): son bilinen takipçi sayısıyla kontrol et
      const expected = parseInt(lsGet("igd_follower_count", "0"), 10) || 0;
      const moves = [
        ["igd_scan_cache_v2", K.cache, (v) => v],
        ["igd_followers_fullsnap", K.snapFollowers, (v) => { const n = Object.keys(v).length; return { t: 0, count: n, expected, complete: isCompleteList(n, expected), map: v }; }],
        ["igd_report_snap", K.snapReport, (v) => { const n = Object.keys(v.map || {}).length; return Object.assign({}, v, { complete: isCompleteList(n, expected) }); }],
        ["igd_report_last", K.reportLast, (v) => v],
      ];
      for (const [lk, ik, conv] of moves) {
        const raw = lsGet(lk, null);
        if (raw == null) continue;
        try {
          if ((await DB.get(ik)) === undefined) await DB.set(ik, conv(JSON.parse(raw)));
          localStorage.removeItem(lk);
        } catch (e) { /* taşınamazsa eski kayıt yerinde kalır, bir sonraki açılışta yeniden denenir */ }
      }
    })();
    return window.__igdMig;
  }

  // --- İşlem geçmişi (geri alma, günlük sınır ve dışa aktarma bunu kullanır) ---
  const HIST_MAX = 20000;
  async function histLoad() { return (await DB.get(K.history)) || []; }
  function histAdd(entries) {
    return withLock(K.history, async () => {
      const h = await histLoad();
      for (const e of entries) h.push(e);
      if (h.length > HIST_MAX) h.splice(0, h.length - HIST_MAX);
      await DB.set(K.history, h);
      return h;
    });
  }
  // Son 24 saatte başarıyla yapılan takip işlemleri (takip et / bırak / takipçiden çıkar)
  const LIMITED_ACTIONS = ["unfollow", "follow", "remove"];
  function dailyUsed(h, now) {
    const since = (now || Date.now()) - 86400000;
    return h.filter((e) => e.ok && e.t > since && LIMITED_ACTIONS.includes(e.a));
  }

  // --- Takipçi sayısı geçmişi (grafik) ---
  function seriesAdd(n) {
    if (typeof n !== "number") return Promise.resolve();
    return withLock(K.series, () => seriesAddNow(n));
  }
  async function seriesAddNow(n) {
    const s = (await DB.get(K.series)) || [];
    const last = s[s.length - 1];
    const now = Date.now();
    // Sayı değişmediyse en fazla 6 saatte bir nokta ekle (grafik düz kalsın, veri şişmesin)
    if (last && last[1] === n && now - last[0] < 6 * 3600000) return;
    s.push([now, n]);
    if (s.length > 20000) s.splice(0, s.length - 20000);
    await DB.set(K.series, s);
  }

  // --- Panel ve izleyici aynı anda ağır iş yapmasın ---
  const panelBusy = () => !!(window.__igd && window.__igd.busy && window.__igd.busy());
  const watcherBusy = () => !!(window.__igdWatch && window.__igdWatch.busy && window.__igdWatch.busy());
