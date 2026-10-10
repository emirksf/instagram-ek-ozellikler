
  // ================================================================ VERİ: takip / takipçi
  async function fetchList(kind, onProgress) {
    const uid = getCookie("ds_user_id");
    if (!uid) throw new Error("Giriş yapılmamış (ds_user_id yok). Önce Instagram'a giriş yapın.");
    const out = [];
    let maxId = "", page = 0, guard = 0;
    while (true) {
      if (S.stopFlag) break;
      if (++guard > 500) break;
      const url =
        `https://www.instagram.com/api/v1/friendships/${uid}/${kind}/?count=100` +
        (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
      let res;
      try { res = await api(url); } catch (e) { await sleep(3000); continue; }
      if (res.status === 401 || res.status === 403)
        throw new Error("Instagram isteği reddetti (oturum/limit). Birkaç dk bekleyip tekrar deneyin.");
      if (res.status === 429) { onProgress && onProgress(out.length, "hız limiti — 30 sn"); await sleep(30000); continue; }
      if (!res.ok) { await sleep(2000); continue; }
      let data; try { data = await res.json(); } catch (e) { await sleep(2000); continue; }
      (data.users || []).forEach((u) => out.push(u));
      onProgress && onProgress(out.length, "");
      maxId = data.next_max_id;
      page++;
      if (!maxId) break;
      await sleep(rand(600, 1200));
      if (page % 6 === 0) { onProgress && onProgress(out.length, "güvenlik molası ~7 sn"); await sleep(7000); }
    }
    return out;
  }

  // Bir grup kullanıcı için "beni takip ediyor mu" toplu sorgusu (tek istekte ~200 kişi).
  // Döner: {id: {followed_by, following, ...}} veya başarısızsa null (yedek yola geç).
  async function showMany(ids) {
    const csrf = getCookie("csrftoken");
    if (!csrf) return null;
    let res;
    try {
      res = await api("https://www.instagram.com/api/v1/friendships/show_many/", {
        method: "POST",
        headers: { "x-csrftoken": csrf, "content-type": "application/x-www-form-urlencoded" },
        body: "user_ids=" + ids.join(","),
      });
    } catch (e) { return null; }
    if (!res.ok) return null;
    let d; try { d = await res.json(); } catch (e) { return null; }
    if (!d || !d.friendship_statuses) return null;
    return d.friendship_statuses;
  }

  // Tek kişi için "beni takip ediyor mu" — kesin ama tek istek. show_many çalışmazsa kullanılır.
  async function showSingle(id) {
    try {
      const res = await api(`https://www.instagram.com/api/v1/friendships/show/${id}/`);
      if (!res.ok) return null;
      const d = await res.json();
      const fs = d.friendship_status || d;
      return typeof fs.followed_by === "boolean" ? fs.followed_by : null;
    } catch (e) { return null; }
  }

  // show/{id}'yi paralel (eşzamanlı) çalıştırır — 577 kişi ~1 dk. Döner: kullanılabilir veri geldi mi.
  async function detectViaShow(ids, onProgress) {
    const conc = 4;
    let idx = 0, done = 0, usable = false;
    async function worker() {
      while (idx < ids.length && !S.stopFlag) {
        const id = ids[idx++];
        const fb = await showSingle(id);
        if (fb === true) { S.followerIds.add(String(id)); usable = true; }
        else if (fb === false) { usable = true; }
        done++;
        if (done % 15 === 0) onProgress && onProgress(done, ids.length);
        await sleep(rand(250, 550));
        if (done % 120 === 0) { for (let i = 0; i < 6 && !S.stopFlag; i++) await sleep(1000); } // periyodik mola
      }
    }
    const ws = [];
    for (let k = 0; k < conc; k++) ws.push(worker());
    await Promise.all(ws);
    onProgress && onProgress(done, ids.length);
    return usable;
  }

  // Profildeki gerçek takipçi/takip sayıları (istatistik kartları için, tek ucuz istek).
  async function fetchProfileCounts() {
    try {
      const uid = getCookie("ds_user_id");
      const res = await api(`https://www.instagram.com/api/v1/users/${uid}/info/`);
      if (!res.ok) return;
      const d = await res.json();
      const u = d.user || (d.data && d.data.user);
      if (u) {
        if (typeof u.follower_count === "number") S.followerCount = u.follower_count;
        if (typeof u.following_count === "number") S.followingCount = u.following_count;
        render();
      }
    } catch (e) {}
  }

  // TAKİP LİSTESİ taraması: takip ettiklerini çeker, geri-takip durumunu show_many ile öğrenir.
  // 30.000 takipçi taranmaz. "Hayranlar" için ayrıca fetchAllFollowers() gerekir.
  async function runScan() {
    if (guardBusy()) return;
    if (!isLoggedIn()) { toast("Önce Instagram'a giriş yap.", true); return; }
    // Son tarama 1 günden yeniyse gereksiz yeniden taramayı önlemek için sor
    if (S.scanned && S.followingScanTime && (Date.now() - S.followingScanTime) < 86400000) {
      const ok = await askConfirm({
        title: "Takip listesi yakın zamanda tarandı",
        html: `<p>Son tarama <b>${esc(ageStr(S.followingScanTime))}</b> yapıldı. Mevcut sonuçlar hâlâ kullanılabilir.</p>
          <p>Yenilemek yalnızca takip ettiklerini ve geri takip durumunu günceller; takipçiler ve DM ayrı kaynaklardır.</p>`,
        okLabel: "Yine de yenile",
      });
      if (!ok) return;
    }
    if (guardBusy()) return; // onay beklerken başka bir iş başlamış olabilir
    S.running = true; S.stopFlag = false; S.selected.clear();
    // Durdurulursa yarım veri (eksik geri-takip kümesi) kaydedilmesin: önceki sonuç geri yüklenir
    const prev = { following: S.following, followingIds: S.followingIds, followerIds: S.followerIds, scanned: S.scanned };
    startJob({ title: "Takip listesi taranıyor", src: "following" });
    fetchProfileCounts(); // ateşle-unut
    let summary = "";

    try {
      setStatus("Takip ettiklerin çekiliyor...");
      const following = await fetchList("following", (n, m) => setStatus(`Takip ettiklerin: ${n} kişi ${m}`));
      if (S.stopFlag) { summary = "Tarama durduruldu — önceki sonuçlar korunuyor."; return; }

      S.following = following;
      S.followingIds = new Set(following.map((u) => String(u.pk)));
      S.scanned = true;

      if (S.followersFull && S.followers.length) {
        // Zaten tam takipçi listen var → geri-takip kesin biliniyor, ekstra analiz gerekmez.
        S.followerIds = new Set(S.followers.map((u) => String(u.pk)));
        setStatus("Mevcut takipçi listen kullanıldı (yeniden tarama yok).");
      } else {
        S.followerIds = new Set();
        S.detecting = true;   // analiz bitene kadar liste "analiz ediliyor" gösterir
        render();

        // Geri-takip durumlarını topluca öğren. Sonuç güvenilir olana kadar liste GÖSTERİLMEZ.
        setStatus("Kim geri takip ediyor analiz ediliyor...");
        const ids = following.map((u) => String(u.pk));
        let gotData = false;

        // Yöntem 1 — toplu sorgu (en ucuz). followed_by alanı gelirse kullan.
        for (let i = 0; i < ids.length; i += 200) {
          if (S.stopFlag) break;
          const map = await showMany(ids.slice(i, i + 200));
          if (map === null) break; // show_many yok → Yöntem 2
          for (const id in map) {
            const e = map[id];
            if (e && typeof e.followed_by === "boolean") { gotData = true; if (e.followed_by) S.followerIds.add(String(id)); }
          }
          setStatus(`Analiz ediliyor: ${Math.min(i + 200, ids.length)}/${ids.length}`);
          jobProgress(Math.min(i + 200, ids.length), ids.length);
          await sleep(rand(250, 600));
        }

        // Yöntem 2 — tek tek (paralel) kontrol. show_many veri vermediyse; hâlâ hızlı (~1 dk).
        if (!gotData && !S.stopFlag) {
          S.followerIds = new Set();
          setStatus("Ayrıntılı yöntemle kontrol ediliyor (kesin, ~1 dk)...");
          if (await detectViaShow(ids, (d, n) => { setStatus(`Kontrol ediliyor: ${d}/${n}`); jobProgress(d, n); })) gotData = true;
        }

        // Yöntem 3 — son çare: tüm takipçileri çek (yavaş ama kesin).
        if (!gotData && !S.stopFlag) {
          setStatus("Son çare: takipçi listesi taranıyor (uzun sürebilir)...");
          const followers = await fetchList("followers", (n, m) => setStatus(`Takipçiler: ${n} kişi ${m}`));
          if (!S.stopFlag) {
            S.followers = followers; S.followersFull = true;
            S.followerIds = new Set(followers.map((u) => String(u.pk)));
            S.followersScanTime = Date.now();
          }
        }
        S.detecting = false;
      }
      if (S.stopFlag) {
        Object.assign(S, prev);
        summary = "Tarama durduruldu — önceki sonuçlar korunuyor.";
      } else {
        S.followingScanTime = Date.now();
        S.cacheTime = Date.now(); saveCache();
        summary = `Takip listesi tarandı ✓ · ${fmtN(S.following.length)} kişi`;
      }
    } catch (e) {
      summary = "Hata: " + e.message;
      toast(e.message, true);
    } finally {
      S.running = false; S.stopFlag = false; S.detecting = false;
      jobFinish(summary);
      render();
    }
  }

  // Tüm takipçileri çek — AKIŞLI (taradıkça liste canlı güncellenir).
  async function fetchAllFollowers() {
    if (guardBusy()) return;
    if (!isLoggedIn()) { toast("Önce Instagram'a giriş yap.", true); return; }
    S.running = true; S.stopFlag = false;
    S.followers = []; S.followersFull = false; S.followersLoading = true; S._botVerifyTried = false;
    startJob({ title: "Takipçiler taranıyor", total: S.followerCount || 0, src: "followers" });
    render();
    let summary = "";
    try {
      const uid = getCookie("ds_user_id");
      let maxId = "", page = 0;
      while (true) {
        if (S.stopFlag) break;
        if (page > 500) break;
        const url = `https://www.instagram.com/api/v1/friendships/${uid}/followers/?count=100` + (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
        let res;
        try { res = await api(url); } catch (e) { await sleep(3000); continue; }
        if (res.status === 401 || res.status === 403) throw new Error("İstek reddedildi (oturum veya geçici limit).");
        if (res.status === 429) { setStatus(`Limit — 30 sn bekleniyor... (${fmtN(S.followers.length)} takipçi)`); await sleep(30000); continue; }
        if (!res.ok) { await sleep(2000); continue; }
        let d; try { d = await res.json(); } catch (e) { await sleep(2000); continue; }

        (d.users || []).forEach((u) => S.followers.push(u));
        page++;
        setStatus(`${fmtN(S.followers.length)}${S.followerCount ? " / " + fmtN(S.followerCount) : ""} takipçi — taradıkça listeleniyor`);
        if (S.followerCount) jobProgress(Math.min(S.followers.length, S.followerCount), S.followerCount);
        if (page % 2 === 0) render(); // canlı göster (sanal liste sayesinde ucuz)

        maxId = d.next_max_id;
        if (!maxId) break;
        await sleep(rand(600, 1200));
        if (page % 6 === 0) { setStatus(`Güvenlik molası ~7 sn... (${fmtN(S.followers.length)} takipçi)`); await sleep(7000); }
      }

      // Tam listede geri-takip kümesi kesinleşir. Durdurulduysa küme yalnızca genişletilir:
      // eksik liste, seni takip edenleri "geri takip etmeyenler"e düşürmesin.
      if (!S.stopFlag) S.followerIds = new Set(S.followers.map((u) => String(u.pk)));
      else S.followers.forEach((u) => S.followerIds.add(String(u.pk)));
      S.followersLoading = false;

      if (!S.stopFlag) {
        S.followersFull = true;
        S.followersScanTime = Date.now();
        const curMap = {};
        S.followers.forEach((u) => { curMap[String(u.pk)] = u.username; });
        const prevSnap = loadFullSnap();
        saveFullSnap(curMap);
        S.cacheTime = Date.now(); saveCache();
        if (prevSnap) {
          const gone = [];
          for (const pk in prevSnap) if (!(pk in curMap)) gone.push(prevSnap[pk]);
          if (gone.length) {
            const l = gone.slice(0, 12).map((u) => "@" + u).join(", ") + (gone.length > 12 ? ` +${gone.length - 12}` : "");
            summary = `Takipçiler tarandı ✓ · son taramadan bu yana ${gone.length} kişi ayrılmış`;
            jobLog(`Ayrılanlar: ${gone.map((u) => "@" + u).join(", ")}`, "warn");
            toast(`${gone.length} kişi seni takibi bırakmış:\n${l}`);
          } else summary = "Takipçiler tarandı ✓ · son taramadan bu yana ayrılan yok 🎉";
        } else summary = `Takipçiler tarandı ✓ · ${fmtN(S.followers.length)} takipçi`;
      } else {
        summary = `Durduruldu — ${fmtN(S.followers.length)} takipçi alındı (kısmi).`;
      }
    } catch (e) {
      S.followersLoading = false;
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally {
      S.running = false; S.stopFlag = false;
      jobFinish(summary);
      render();
    }
  }

  // ================================================================ VERİ: DM kutusu
  // DM kutusunu sayfalayıp hem etkileşim haritasını (pk->ms) hem de sohbet listesini
  // (thread_id ile — silme için gerekli) çeker. Yalnızca liste ve tarih; mesaj içeriği okunmaz.
  async function fetchDMThreads(onProgress) {
    const map = {}, threads = [];
    let cursor = "", pages = 0, guard = 0;
    const base = "https://www.instagram.com/api/v1/direct_v2/inbox/?persistentBadging=true&limit=20&thread_message_limit=1";
    while (true) {
      if (S.stopFlag) break;
      if (++guard > 80) break; // üst sınır (~1600 sohbet)
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}&direction=older` : base;
      let res;
      try { res = await api(url); } catch (e) { await sleep(2000); continue; }
      if (res.status === 429) { onProgress && onProgress(pages, threads.length, "limit — 30 sn"); await sleep(30000); continue; }
      if (!res.ok) { if (pages === 0) throw new Error("DM kutusu okunamadı (HTTP " + res.status + ")"); break; }
      let d; try { d = await res.json(); } catch (e) { break; }
      const inbox = d.inbox || {};
      (inbox.threads || []).forEach((t) => {
        if (!t.thread_id) return;
        const act = t.last_activity_at ? Math.floor(t.last_activity_at / 1000) : 0; // µs → ms
        const users = (t.users || []).map((u) => ({ pk: String(u.pk), username: u.username, pic: u.profile_pic_url }));
        const group = users.length > 1 || t.is_group === true;
        if (users.length === 1) { const pk = users[0].pk; if (!map[pk] || act > map[pk]) map[pk] = act; }
        threads.push({ id: t.thread_id, users, group, act, title: t.thread_title || users.map((u) => u.username).join(", ") });
      });
      pages++;
      onProgress && onProgress(pages, threads.length, "");
      cursor = inbox.oldest_cursor;
      if (!inbox.has_older || !cursor) break;
      await sleep(rand(500, 1000));
    }
    return { map, threads };
  }

  // DM kutusunu tara — hem "Etkileşimsizler" sekmesini hem "DM'lerim" sayfasını besler.
  async function scanDM() {
    if (guardBusy()) return;
    if (!isLoggedIn()) { toast("Önce Instagram'a giriş yap.", true); return; }
    S.dmBusy = true; S.stopFlag = false;
    startJob({ title: "DM kutusu taranıyor", src: "dm" });
    let summary = "";
    try {
      setStatus("DM kutusu okunuyor...");
      const { map, threads } = await fetchDMThreads((p, n, m) => setStatus(`${p}. sayfa · ${fmtN(n)} sohbet ${m}`));
      if (S.stopFlag) { summary = "Durduruldu."; return; }
      S.dmMap = map; S.dmThreads = threads; S.dmScanned = true;
      S.dmScanTime = Date.now();
      saveCache();
      summary = `DM kutusu tarandı ✓ · ${fmtN(threads.length)} sohbet · ${fmtN(Object.keys(map).length)} kişiyle DM geçmişi`;
    } catch (e) {
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally {
      S.dmBusy = false; S.stopFlag = false;
      jobFinish(summary);
      render();
    }
  }

  function dmAgoLabel(pk) {
    const ms = S.dmMap[String(pk)];
    if (!ms) return "Hiç DM yok";
    const days = Math.floor((Date.now() - ms) / 86400000);
    if (days <= 0) return "Bugün DM";
    if (days === 1) return "Dün DM";
    if (days < 30) return `${days} gün önce DM`;
    const mo = Math.floor(days / 30);
    if (mo < 12) return `${mo} ay önce DM`;
    return `${Math.floor(mo / 12)}+ yıl önce DM`;
  }

  // ================================================================ listeler, süzme, sıralama
  function catList(cat) {
    if (cat === "non")    return S.following.filter((u) => !S.followerIds.has(String(u.pk)));
    if (cat === "fans")   return S.followers.filter((u) => !S.followingIds.has(String(u.pk)));
    if (cat === "mutual") return S.following.filter((u) => S.followerIds.has(String(u.pk)));
    if (cat === "bots")   return S.followers.slice(); // şüpheli takipçiler bunlar arasından
    return S.following.slice(); // "idle" ve "all" → takip ettiklerin
  }

  // Bot/sahte heuristikleri
  // Yalnızca AÇIKÇA otomatik/rastgele adları yakalar. Sesli harfi atılmış normal
  // adları (yarenclknt = Yaren Çelikkent) YANLIŞ işaretlememek için çok muhafazakâr.
  function isGibberish(name) {
    if (!name) return false;
    const compact = String(name).toLowerCase().replace(/[._]/g, "");
    const digits = (compact.match(/[0-9]/g) || []).length;
    if (digits >= 5) return true;                       // çok sayıda rakam (…151515)
    if (/(.{2,3})\1{2,}/.test(compact)) return true;    // tekrarlı örüntü (xnxnxn, asdasd)
    return false;
  }
  // Skor kullanıcı başına önbelleklenir; derin doğrulama (_info) gelince yeniden hesaplanır.
  const _botCache = new WeakMap();
  function botScore(u) {
    const c = _botCache.get(u);
    if (c && c.info === u._info) return c.v;
    const reasons = []; let score = 0;
    if (u.has_anonymous_profile_picture) { score += 2; reasons.push("profil fotosu yok"); }
    if (!u.full_name || !String(u.full_name).trim()) { score += 1; reasons.push("isim yok"); }
    if (isGibberish(u.username)) { score += 1; reasons.push("rastgele ad"); }
    if (u._info) {
      if (u._info.media_count === 0) { score += 3; reasons.push("0 gönderi"); }
      if (u._info.follower_count === 0) { score += 2; reasons.push("0 takipçi"); }
      if (u._info.following_count >= 1500 && u._info.follower_count < 30) { score += 1; reasons.push("aşırı takip/az takipçi"); }
    }
    const v = { score, reasons };
    _botCache.set(u, { info: u._info, v });
    return v;
  }
  // Şüpheli sayılma koşulu (kullanıcı adı TEK BAŞINA yeterli değil — yanlış pozitifi önler):
  function isSuspect(u) {
    if (u.has_anonymous_profile_picture) return true;                          // profil fotosu yok
    if (u._info && (u._info.media_count === 0 || u._info.follower_count === 0)) return true; // doğrulanmış boşluk
    if (isGibberish(u.username) && (!u.full_name || !String(u.full_name).trim())) return true; // rastgele ad + isimsiz
    return false;
  }

  async function fetchUserInfo(pk) {
    try {
      const res = await api(`https://www.instagram.com/api/v1/users/${pk}/info/`);
      if (!res.ok) return null;
      const d = await res.json();
      const u = d.user || (d.data && d.data.user);
      if (!u) return null;
      return { media_count: u.media_count, follower_count: u.follower_count, following_count: u.following_count };
    } catch (e) { return null; }
  }

  async function deepVerifyBots() {
    if (guardBusy()) return;
    // Sekmeden bağımsız: en şüpheli ilk 200 takipçi (otomatik tetiklemede sekme değişse de doğru liste)
    const list = S.followers.filter(isSuspect).sort(SORTS.bot.fn).slice(0, 200);
    if (!list.length) return;
    S.running = true; S.stopFlag = false;
    startJob({ title: "Şüpheliler doğrulanıyor", total: list.length });
    let summary = "";
    try {
      let done = 0, idx = 0;
      const conc = 4;
      async function worker() {
        while (idx < list.length && !S.stopFlag) {
          const u = list[idx++];
          const info = await fetchUserInfo(u.pk);
          if (info) u._info = info;
          done++;
          jobProgress(done, list.length);
          if (done % 8 === 0) { setStatus(`Gönderi/takipçi sayıları alınıyor: ${done}/${list.length}`); render(); }
          await sleep(rand(300, 600));
        }
      }
      const ws = []; for (let k = 0; k < conc; k++) ws.push(worker());
      await Promise.all(ws);
      saveCache();
      summary = S.stopFlag ? "Doğrulama durduruldu." : `Doğrulama tamam ✓ · ${list.length} hesap kontrol edildi`;
    } catch (e) { summary = "Hata: " + e.message; }
    finally { S.running = false; S.stopFlag = false; jobFinish(summary); render(); }
  }

  const coll = new Intl.Collator("tr");
  const SORTS = {
    name:    { label: "Kullanıcı adı (A→Z)",            fn: (a, b) => coll.compare(a.username || "", b.username || "") },
    dm_old:  { label: "Son DM: en eski önce",           fn: (a, b) => (S.dmMap[String(a.pk)] || 0) - (S.dmMap[String(b.pk)] || 0), need: "dm" },
    dm_new:  { label: "Son DM: en yeni önce",           fn: (a, b) => (S.dmMap[String(b.pk)] || 0) - (S.dmMap[String(a.pk)] || 0), need: "dm" },
    bot:     { label: "Bot skoru (yüksekten)",          fn: (a, b) => botScore(b).score - botScore(a).score },
    fc_asc:  { label: "Takipçi sayısı (azdan çoğa)",    fn: (a, b) => fcOf(a) - fcOf(b), need: "info" },
    fc_desc: { label: "Takipçi sayısı (çoktan aza)",    fn: (a, b) => fcOf(b, -1) - fcOf(a, -1), need: "info" },
  };
  // Takipçi sayısı yalnızca derin doğrulanan hesaplarda bilinir; bilinmeyenler sona.
  function fcOf(u, unknown) { return u._info && typeof u._info.follower_count === "number" ? u._info.follower_count : (unknown === -1 ? -1 : Infinity); }
  function sortKeys(cat) {
    const keys = ["name", "dm_old", "dm_new"];
    if (cat === "fans" || cat === "bots") keys.push("bot", "fc_asc", "fc_desc");
    return keys;
  }
  function defaultSort(cat) { return cat === "idle" ? "dm_old" : cat === "bots" ? "bot" : "name"; }
  function currentSort() {
    const k = S.sortBy[S.cat] || defaultSort(S.cat);
    const need = SORTS[k] && SORTS[k].need;
    if (need === "dm" && !S.dmScanned) return defaultSort(S.cat);
    return SORTS[k] ? k : "name";
  }

  const ACCT_FILTERS = [
    ["all", "Tüm hesaplar"], ["private", "Yalnız gizli"], ["public", "Yalnız herkese açık"],
    ["verified", "Yalnız doğrulanmış"], ["noverified", "Doğrulanmışları gizle"],
  ];

  function visibleList() {
    let list = catList(S.cat);
    const f = S.acctFilter;
    if (f === "private") list = list.filter((u) => u.is_private);
    else if (f === "public") list = list.filter((u) => !u.is_private);
    else if (f === "verified") list = list.filter((u) => u.is_verified);
    else if (f === "noverified") list = list.filter((u) => !u.is_verified);
    if (S.query) {
      const q = S.query.toLowerCase();
      list = list.filter((u) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q));
    }
    // Şüpheli/Bot: yalnızca gerçek şüpheliler
    if (S.cat === "bots") list = list.filter(isSuspect);
    // Etkileşimsizler: son DM eşiğine göre süz
    if (S.cat === "idle") {
      const thr = S.idleDays || 0;
      if (thr === -1) list = list.filter((u) => !S.dmMap[String(u.pk)]);
      else if (thr > 0) {
        const cut = Date.now() - thr * 86400000;
        list = list.filter((u) => { const ms = S.dmMap[String(u.pk)]; return !ms || ms < cut; });
      }
    }
    return list.sort(SORTS[currentSort()].fn);
  }

  // Bu satır seçilebilir mi? (korunanlar takibi bırakmada seçilemez)
  const selectable = (u) => !(CATS[S.cat].action === "unfollow" && S.whitelist.has(String(u.pk)));

  // ================================================================ işlemler
  async function friendship(kind, pk) {
    const csrf = getCookie("csrftoken");
    if (!csrf) throw new Error("csrftoken yok — sayfayı yenileyin.");
    const res = await api(`https://www.instagram.com/api/v1/friendships/${kind}/${pk}/`, {
      method: "POST",
      headers: {
        "x-csrftoken": csrf,
        "x-instagram-ajax": "1",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "container_module=profile",
    });
    let ok = res.ok;
    try { const j = await res.json(); ok = ok && (j.status === "ok"); } catch (e) {}
    if (!ok) throw new Error("HTTP " + res.status);
    return true;
  }

  function findUser(pk) {
    pk = String(pk);
    return S.followers.find((x) => String(x.pk) === pk) || S.following.find((x) => String(x.pk) === pk);
  }

  // Ortalama kişi başı süre (sn): 3,5–6,5 sn bekleme + her 6 kişide 45–80 sn mola + istek.
  const SEC_PER_FRIENDSHIP = 16;

  async function bulkAction(action, pks) {
    if (guardBusy()) return;
    const A = ACTIONS[action];
    const list = pks.filter((pk) => action !== "unfollow" || !S.whitelist.has(String(pk)));
    const skipped = pks.length - list.length;
    if (!list.length) { toast("İşlenecek kişi yok (korunanlar hariç tutuldu).", true); return; }
    const names = list.map((pk) => { const u = findUser(pk); return u ? u.username : String(pk); });
    const ok = await askConfirm({
      title: `${list.length} kişi — ${A.btn}`,
      html: `<p>Aşağıdaki ${list.length} hesap için <b>${esc(A.btn)}</b> işlemi yapılacak.${skipped ? ` Korunan <b>${skipped}</b> hesap hariç tutuldu.` : ""}</p>
        <p class="igd-note">Hesabını korumak için aralarda otomatik bekleme yapılır. İşlem alttaki tepside sürer; bu arada uygulamayı kullanmaya devam edebilir, istediğin an duraklatıp durdurabilirsin.</p>`,
      names,
      estimate: list.length * SEC_PER_FRIENDSHIP,
      danger: action !== "follow",
      okLabel: `${A.btn} (${list.length})`,
    });
    if (!ok || guardBusy()) return;

    S.running = true; S.stopFlag = false; S.paused = false;
    startJob({ title: A.title, total: list.length, pausable: true });
    let done = 0, okN = 0, fail = 0;

    try {
      for (const pk of list) {
        await waitIfPaused();
        if (S.stopFlag) { jobLog("⏹ Kullanıcı durdurdu.", "warn"); break; }
        const u = findUser(pk);
        const name = u ? u.username : pk;
        try {
          await friendship(A.kind, pk);
          okN++;
          jobLog(`✓ @${name} ${A.done}`, "ok");
          applyLocalChange(action, pk, u);
          S.selected.delete(String(pk));
        } catch (e) {
          fail++;
          jobLog(`✗ @${name} başarısız (${e.message})`, "err");
        }
        done++;
        jobProgress(done, list.length, okN, fail);
        if (done % 3 === 0) render();
        if (done < list.length && !S.stopFlag) {
          await pSleep(rand(3500, 6500));
          if (done % 6 === 0 && !S.stopFlag) {
            const secs = rand(45, 80);
            jobLog(`⏳ Güvenlik molası ~${secs} sn`, "warn");
            setStatus(`Güvenlik molası ~${secs} sn`);
            await pSleep(secs * 1000);
          }
        }
      }
    } finally {
      S.running = false; S.stopFlag = false; S.paused = false;
      jobFinish(`Bitti — başarılı ${okN}, hata ${fail}${done < list.length ? `, ${list.length - done} kişi işlenmedi` : ""}.`);
      saveCache();
      render();
    }
  }

  // yerel listeleri güncelle (yeniden tarama gerekmeden)
  function applyLocalChange(action, pk, u) {
    pk = String(pk);
    if (action === "unfollow") {
      S.following = S.following.filter((x) => String(x.pk) !== pk);
      S.followingIds.delete(pk);
    } else if (action === "follow" && u) {
      if (!S.followingIds.has(pk)) { S.following.push(u); S.followingIds.add(pk); }
    } else if (action === "remove") {
      S.followers = S.followers.filter((x) => String(x.pk) !== pk);
      S.followerIds.delete(pk);
      if (S.followerCount != null) S.followerCount = Math.max(0, S.followerCount - 1);
    }
  }

  // Elle engelleme yardımcısı: profili ayrı pencerede açar; kullanıcı Instagram'ın
  // kendi "Engelle"sine basar. Otomatik engelleme Instagram tarafından güvenlik gereği
  // reddedildiği (oturumu kapattığı) için tek güvenli yol budur.
  function openBlockHelper(username) {
    const u = String(username || "").replace(/^@/, "").trim();
    if (!u) return;
    try { window.open("https://www.instagram.com/" + encodeURIComponent(u) + "/", "_blank"); } catch (e) {}
    toast(`@${u} açıldı — sağ üstteki ⋯ menüsünden “Engelle” ile elle engelle.\n(Otomatik engellemeyi Instagram güvenlik gereği engelliyor.)`);
  }

  function toggleWhitelist(pk) {
    pk = String(pk);
    if (S.whitelist.has(pk)) S.whitelist.delete(pk);
    else { S.whitelist.add(pk); S.selected.delete(pk); }
    saveWhitelist();
    render();
  }

  // ================================================================ dışa aktarma
  // Seçim varsa yalnızca seçilenler, yoksa görünen liste.
  function exportSet() {
    const vis = S.vis;
    if (S.selected.size) return { list: vis.filter((u) => S.selected.has(String(u.pk))), what: "seçilen" };
    return { list: vis, what: "görünen" };
  }

  async function copyList() {
    const { list, what } = exportSet();
    const text = list.map((u) => u.username).join("\n");
    try { await navigator.clipboard.writeText(text); toast(`${list.length} ${what} kullanıcı adı panoya kopyalandı ✓`); }
    catch (e) { toast("Kopyalanamadı: " + e.message, true); }
  }

  function csvCell(v) {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCSV() {
    const { list, what } = exportSet();
    if (!list.length) { toast("Dışa aktarılacak kimse yok.", true); return; }
    const head = ["kullanici_adi", "isim", "profil", "gizli", "dogrulanmis", "korunuyor", "son_dm", "bot_nedenleri", "gonderi", "takipci", "takip"];
    const rows = list.map((u) => {
      const pk = String(u.pk), ms = S.dmMap[pk], inf = u._info || {};
      return [u.username, u.full_name, `https://www.instagram.com/${u.username}/`,
        u.is_private ? "evet" : "hayır", u.is_verified ? "evet" : "hayır", S.whitelist.has(pk) ? "evet" : "hayır",
        S.dmScanned ? (ms ? fmtDate(ms) : "yok") : "", botScore(u).reasons.join(" · "),
        inf.media_count, inf.follower_count, inf.following_count].map(csvCell).join(",");
    });
    // Excel'in Türkçe karakterleri doğru açması için BOM
    const content = "﻿" + head.join(",") + "\n" + rows.join("\n") + "\n";
    const stamp = fmtDate(Date.now()).replace(/[: ]/g, "-");
    const name = `instagram-${S.cat}-${stamp}.csv`;
    if (post({ type: "export", name, content, label: "CSV dışa aktarıldı" })) {
      toast(`${list.length} ${what} hesap Downloads/${name} dosyasına kaydedildi ✓`);
      return;
    }
    // Uygulama dışı (tarayıcı) yedeği
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // Tarama sonuçlarını temizle (koru listesi ve ayarlar kalır)
  async function clearAll() {
    if (guardBusy()) return;
    const ok = await askConfirm({
      title: "Tarama sonuçları temizlensin mi?",
      html: `<p>Takip listesi, takipçiler, şüpheliler ve DM listeleri silinir. <b>Koru listen, tema ve bildirim ayarların kalır.</b></p>
        <p class="igd-note">Instagram hesabında hiçbir şey değişmez; yalnızca bu uygulamanın kaydettiği sonuçlar silinir.</p>`,
      danger: true, okLabel: "Temizle",
    });
    if (!ok || guardBusy()) return;
    S.following = []; S.followers = [];
    S.followingIds = new Set(); S.followerIds = new Set();
    S.scanned = false; S.detecting = false;
    S.followersFull = false; S.followersLoading = false;
    S.followerCount = null; S.followingCount = null;
    S.followingScanTime = 0; S.followersScanTime = 0; S.dmScanTime = 0;
    S.dmMap = {}; S.dmThreads = []; S.dmScanned = false; S.dmSel.clear();
    S.selected.clear(); S.query = ""; S._botVerifyTried = false;
    try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    S.statusText = "Sonuçlar temizlendi.";
    render();
    toast("Tarama sonuçları temizlendi.");
  }

  // SocialBlade: uygulama içindeki ayrı pencerede aç (Swift köprüsü), yoksa yeni sekme.
  function sb(username) {
    const u = String(username || "").replace(/^@/, "").trim();
    if (!u) return;
    if (!post({ type: "sb", username: u })) window.open("https://socialblade.com/instagram/user/" + encodeURIComponent(u), "_blank");
  }
