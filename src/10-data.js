
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

  // Profildeki gerçek takipçi/takip sayıları (istatistik kartları ve grafik için, tek ucuz istek).
  async function fetchProfileCounts() {
    try {
      const uid = getCookie("ds_user_id");
      const res = await api(`https://www.instagram.com/api/v1/users/${uid}/info/`);
      if (!res.ok) return;
      const d = await res.json();
      const u = d.user || (d.data && d.data.user);
      if (u) {
        if (typeof u.follower_count === "number") {
          S.followerCount = u.follower_count; // igd_follower_count yalnızca izleyicinindir (bildirim tabanı)
          if (lsGet("igd_series_on", "1") !== "0") seriesAdd(u.follower_count).catch(() => {});
        }
        if (typeof u.following_count === "number") S.followingCount = u.following_count;
        render();
      }
    } catch (e) {}
  }

  // TAKİP LİSTESİ taraması: takip ettiklerini çeker, geri-takip durumunu show_many ile öğrenir.
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
        // TAM takipçi listen var → geri-takip kesin biliniyor, ekstra analiz gerekmez.
        // (Eksik/kısaltılmış liste burada KULLANILMAZ: seni takip edenleri yanlışlıkla "geri takip etmiyor" sayardı.)
        S.followerIds = new Set(S.followers.map((u) => String(u.pk)));
        setStatus("Mevcut tam takipçi listen kullanıldı (yeniden tarama yok).");
      } else {
        S.followerIds = new Set();
        S.detecting = true;   // analiz bitene kadar liste "analiz ediliyor" gösterir
        render();

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
            S.followers = followers;
            S.followersFull = isCompleteList(followers.length, S.followerCount);
            S.followersTrunc = !S.followersFull;
            S.followersScanTime = Date.now();
            if (!S.followersFull) {
              // Eksik listeyle geri-takip hesaplanırsa seni takip edenler "geri takip etmiyor" görünür → güvenli değil
              Object.assign(S, prev);
              throw new Error("Instagram geri takip bilgisini vermedi ve takipçi listesini de eksik verdi; geri takip etmeyenler güvenilir hesaplanamadı. Önceki sonuçlar korunuyor — biraz sonra yeniden dene.");
            }
            S.followerIds = new Set(followers.map((u) => String(u.pk)));
          }
        }
        S.detecting = false;
      }
      if (S.stopFlag) {
        Object.assign(S, prev);
        summary = "Tarama durduruldu — önceki sonuçlar korunuyor.";
      } else {
        S.needRescan = false;
        S.followingScanTime = Date.now();
        S.cacheTime = Date.now(); await saveCache();
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

  // Tüm takipçileri çek — AKIŞLI (taradıkça liste canlı güncellenir) ve KALDIĞI YERDEN DEVAM EDEBİLİR.
  // Liste profildeki sayının belirgin altında biterse "eksik" sayılır: anlık görüntü ve "kim ayrıldı"
  // karşılaştırması yapılmaz, geri-takip kümesi küçültülmez.
  const RESUME_MAX_AGE = 6 * 3600000;
  async function fetchAllFollowers() {
    if (guardBusy()) return;
    if (!isLoggedIn()) { toast("Önce Instagram'a giriş yap.", true); return; }
    let resume = null;
    const r = S.resume;
    if (r && r.maxId && Date.now() - r.t < RESUME_MAX_AGE && S.followers.length === r.n && !S.followersFull) {
      const choice = await openDialog({
        title: "Yarım kalan takipçi taraması",
        body: `<p>Önceki tarama <b>${fmtN(r.n)}${r.expected ? " / " + fmtN(r.expected) : ""}</b> takipçide kalmıştı (${esc(ageStr(r.t))}).</p>
          <p class="igd-note">Kaldığın yerden devam etmek istekleri ve süreyi azaltır. Instagram'ın kaldığın yeri hatırlama süresi dolmuşsa tarama otomatik olarak baştan başlar.</p>`,
        buttons: [{ label: "Vazgeç", value: null }, { label: "Baştan tara", value: "fresh" }, { label: "Kaldığı yerden devam et", kind: "primary", value: "resume" }],
      });
      if (!choice) return;
      if (choice === "resume") resume = r;
    }
    if (guardBusy()) return;
    S.running = true; S.stopFlag = false;
    if (!resume) S.followers = [];
    S.followersFull = false; S.followersTrunc = false; S.followersLoading = true; S._botVerifyTried = false;
    startJob({ title: "Takipçiler taranıyor", total: S.followerCount || 0, src: "followers" });
    render();
    await fetchProfileCounts(); // beklenen sayı tamlık kontrolü için güncel olsun
    const expected = S.followerCount || 0;
    if (S.job && expected) S.job.total = expected;
    let summary = "", maxId = resume ? resume.maxId : "", page = 0, natural = false, badCursor = false;
    const seen = new Set(S.followers.map((u) => String(u.pk)));
    const saveResume = async () => {
      S.resume = { maxId, n: S.followers.length, t: Date.now(), expected };
      await DB.set(K.resumeFollowers, S.resume).catch(() => {});
      await saveCache();
    };
    try {
      const uid = getCookie("ds_user_id");
      while (true) {
        if (S.stopFlag) break;
        if (page > 600) break;
        let pg;
        try { pg = await fetchFollowersPage(uid, maxId, (m) => setStatus(`${m} (${fmtN(S.followers.length)} takipçi)`)); }
        catch (e) {
          if (e.message === "CURSOR" && resume && page === 0) {
            jobLog("Kaldığın yer Instagram'da artık geçerli değil; baştan taranıyor.", "warn");
            S.followers = []; seen.clear(); maxId = ""; resume = null; continue;
          }
          if (e.message === "CURSOR") { badCursor = true; throw new Error("Instagram listenin devamını vermedi (HTTP 400)."); }
          throw e;
        }
        pg.users.forEach((u) => { const k = String(u.pk); if (!seen.has(k)) { seen.add(k); S.followers.push(u); } });
        page++;
        setStatus(`${fmtN(S.followers.length)}${expected ? " / " + fmtN(expected) : ""} takipçi — taradıkça listeleniyor`);
        if (expected) jobProgress(Math.min(S.followers.length, expected), expected);
        if (page % 2 === 0) render(); // canlı göster (sanal liste sayesinde ucuz)
        maxId = pg.nextMaxId;
        if (!maxId) { natural = true; break; }
        if (page % 20 === 0) await saveResume(); // uygulama kapanırsa kaldığı yerden devam
        await sleep(rand(600, 1200));
        if (page % 6 === 0) { setStatus(`Güvenlik molası ~7 sn... (${fmtN(S.followers.length)} takipçi)`); await sleep(7000); }
      }

      S.followersLoading = false;
      const n = S.followers.length;
      const complete = natural && isCompleteList(n, expected);
      // Geri-takip kümesi yalnızca TAM listede yeniden kurulur; aksi halde yalnızca genişletilir.
      if (complete) S.followerIds = new Set(S.followers.map((u) => String(u.pk)));
      else S.followers.forEach((u) => S.followerIds.add(String(u.pk)));
      S.followersScanTime = Date.now();

      if (complete) {
        S.followersFull = true; S.resume = null; DB.del(K.resumeFollowers).catch(() => {});
        const curMap = {};
        S.followers.forEach((u) => { curMap[String(u.pk)] = u.username; });
        const prevSnap = await DB.get(K.snapFollowers);
        await DB.set(K.snapFollowers, { t: Date.now(), count: n, expected, complete: true, map: curMap });
        if (prevSnap && prevSnap.complete && prevSnap.map) {
          const gone = [];
          for (const pk in prevSnap.map) if (!(pk in curMap)) gone.push(prevSnap.map[pk]);
          if (gone.length) {
            const l = gone.slice(0, 12).map((u) => "@" + u).join(", ") + (gone.length > 12 ? ` +${gone.length - 12}` : "");
            summary = `Takipçiler tarandı ✓ · son tam taramadan bu yana ${gone.length} kişi ayrılmış`;
            jobLog(`Ayrılanlar: ${gone.map((u) => "@" + u).join(", ")}`, "warn");
            toast(`${gone.length} kişi seni takibi bırakmış:\n${l}`);
          } else summary = "Takipçiler tarandı ✓ · son tam taramadan bu yana ayrılan yok 🎉";
        } else summary = `Takipçiler tarandı ✓ · ${fmtN(n)} takipçi`;
      } else if (natural) {
        S.followersTrunc = true; S.resume = null; DB.del(K.resumeFollowers).catch(() => {});
        summary = `Instagram listenin yalnızca ${fmtN(n)} / ${fmtN(expected)} kısmını verdi`;
        jobLog(`Instagram takipçi listesini ${fmtN(n)} hesapta bitirdi (profilde ${fmtN(expected)}). Liste eksik olduğu için “kim ayrıldı” karşılaştırması ve rapor bu taramayla yapılmadı; Hayranlar/Şüpheli listeleri eksik olabilir.`, "warn");
      } else {
        await saveResume();
        summary = `Durduruldu — ${fmtN(n)} takipçi alındı. Kaynak kartından kaldığın yerden devam edebilirsin.`;
      }
      S.cacheTime = Date.now(); await saveCache();
    } catch (e) {
      S.followersLoading = false;
      if (S.followers.length && maxId && !badCursor) await saveResume();
      else { S.resume = null; DB.del(K.resumeFollowers).catch(() => {}); await saveCache(); }
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally {
      S.running = false; S.stopFlag = false;
      jobFinish(summary);
      render();
    }
  }

  // ================================================================ VERİ: DM kutusu
  // DM kutusunu sayfalayıp hem etkileşim haritasını (pk->ms) hem de sohbet listesini çeker.
  // Yalnızca liste ve tarih; mesaj içeriği okunmaz.
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
      await saveCache();
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

  // ================================================================ VERİ: hayalet takipçiler (son gönderileri beğenmeyenler)
  // Yalnızca okuma yapar: kendi son N gönderinin beğenenlerini toplar. Popüler gönderilerde
  // Instagram beğenen listesini kısaltabildiği için sonuç yaklaşıktır; kapsama oranı gösterilir.
  const ghostPosts = () => Math.max(3, Math.min(30, parseInt(lsGet("igd_ghost_posts", "12"), 10) || 12));
  async function scanLikes() {
    if (guardBusy()) return;
    if (!isLoggedIn()) { toast("Önce Instagram'a giriş yap.", true); return; }
    const uid = getCookie("ds_user_id");
    const want = ghostPosts();
    S.running = true; S.stopFlag = false;
    startJob({ title: "Son gönderilerini beğenenler alınıyor", total: want, src: "likes" });
    let summary = "";
    try {
      const res = await api(`https://www.instagram.com/api/v1/feed/user/${uid}/?count=${want}`);
      if (!res.ok) throw new Error("Gönderilerin okunamadı (HTTP " + res.status + ")");
      const d = await res.json();
      const posts = (d.items || []).slice(0, want);
      if (!posts.length) throw new Error("Hiç gönderin bulunamadı.");
      const likers = new Set();
      let total = 0, got = 0, done = 0;
      for (const p of posts) {
        if (S.stopFlag) break;
        const mid = String(p.id || "").includes("_") ? p.id : `${p.pk}_${uid}`;
        try {
          const lr = await api(`https://www.instagram.com/api/v1/media/${encodeURIComponent(mid)}/likers/`);
          if (lr.status === 429) { setStatus("hız limiti — 30 sn bekleniyor"); await sleep(30000); }
          else if (lr.ok) {
            const ld = await lr.json();
            (ld.users || []).forEach((u) => likers.add(String(u.pk)));
            got += (ld.users || []).length;
          } else jobLog(`Bir gönderinin beğenenleri okunamadı (HTTP ${lr.status})`, "warn");
        } catch (e) { jobLog("Bir gönderinin beğenenleri okunamadı", "warn"); }
        total += typeof p.like_count === "number" ? p.like_count : 0;
        done++;
        jobProgress(done, posts.length);
        setStatus(`${done}/${posts.length} gönderi · ${fmtN(likers.size)} farklı beğenen`);
        await sleep(rand(1500, 3000));
      }
      if (S.stopFlag) { summary = "Durduruldu — beğeniler kaydedilmedi."; return; }
      S.likes = { t: Date.now(), posts: done, likers, totalLikes: total, gotLikes: got };
      await DB.set(K.likes, { t: S.likes.t, posts: done, likers: [...likers], totalLikes: total, gotLikes: got });
      const cov = total ? Math.round(Math.min(1, got / total) * 100) : 100;
      summary = `Beğeniler alındı ✓ · ${done} gönderi · ${fmtN(likers.size)} farklı beğenen · kapsama %${cov}`;
    } catch (e) {
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally { S.running = false; S.stopFlag = false; jobFinish(summary); render(); }
  }

  // ================================================================ listeler, süzme, sıralama
  function catList(cat) {
    if (cat === "non")    return S.following.filter((u) => !S.followerIds.has(String(u.pk)));
    if (cat === "fans")   return S.followers.filter((u) => !S.followingIds.has(String(u.pk)));
    if (cat === "mutual") return S.following.filter((u) => S.followerIds.has(String(u.pk)));
    if (cat === "bots")   return S.followers.slice(); // şüpheli takipçiler bunlar arasından
    if (cat === "ghosts") return S.likes ? S.followers.filter((u) => !S.likes.likers.has(String(u.pk))) : [];
    return S.following.slice(); // "idle" ve "all" → takip ettiklerin
  }

  // Bot/sahte heuristikleri — yalnızca AÇIKÇA otomatik/rastgele adları yakalar (yanlış pozitife karşı muhafazakâr).
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
  // Şüpheli sayılma koşulu (kullanıcı adı TEK BAŞINA yeterli değil — yanlış pozitifi önler)
  function isSuspect(u) {
    if (u.has_anonymous_profile_picture) return true;
    if (u._info && (u._info.media_count === 0 || u._info.follower_count === 0)) return true;
    if (isGibberish(u.username) && (!u.full_name || !String(u.full_name).trim())) return true;
    return false;
  }

  // "Bırakılabilirlik": geri takip etmiyor + uzun süredir/hiç DM yok → yüksek; korunan/doğrulanmış → düşük.
  function dropScore(u) {
    const pk = String(u.pk);
    let s = 0;
    const reasons = [];
    if (!S.followerIds.has(pk)) { s += 3; reasons.push("geri takip etmiyor"); }
    if (S.dmScanned) {
      const ms = S.dmMap[pk];
      if (!ms) { s += 2; reasons.push("hiç DM yok"); }
      else {
        const d = (Date.now() - ms) / 86400000;
        if (d > 365) { s += 1.5; reasons.push("1+ yıldır DM yok"); }
        else if (d > 180) { s += 1; reasons.push("6+ aydır DM yok"); }
        else if (d < 90) { s -= 2; }
      }
    }
    if (u.is_verified) s -= 1;
    if (S.whitelist.has(pk)) s -= 10;
    return { s, reasons };
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
      await saveCache();
      summary = S.stopFlag ? "Doğrulama durduruldu." : `Doğrulama tamam ✓ · ${list.length} hesap kontrol edildi`;
    } catch (e) { summary = "Hata: " + e.message; }
    finally { S.running = false; S.stopFlag = false; jobFinish(summary); render(); }
  }

  const coll = new Intl.Collator("tr");
  const SORTS = {
    name:    { label: "Kullanıcı adı (A→Z)",              fn: (a, b) => coll.compare(a.username || "", b.username || "") },
    drop:    { label: "Bırakılabilirlik (önce en uygun)", fn: (a, b) => dropScore(b).s - dropScore(a).s },
    dm_old:  { label: "Son DM: en eski önce",             fn: (a, b) => (S.dmMap[String(a.pk)] || 0) - (S.dmMap[String(b.pk)] || 0), need: "dm" },
    dm_new:  { label: "Son DM: en yeni önce",             fn: (a, b) => (S.dmMap[String(b.pk)] || 0) - (S.dmMap[String(a.pk)] || 0), need: "dm" },
    bot:     { label: "Bot skoru (yüksekten)",            fn: (a, b) => botScore(b).score - botScore(a).score },
    fc_asc:  { label: "Takipçi sayısı (azdan çoğa)",      fn: (a, b) => fcOf(a) - fcOf(b), need: "info" },
    fc_desc: { label: "Takipçi sayısı (çoktan aza)",      fn: (a, b) => fcOf(b, -1) - fcOf(a, -1), need: "info" },
  };
  // Takipçi sayısı yalnızca derin doğrulanan hesaplarda bilinir; bilinmeyenler sona.
  function fcOf(u, unknown) { return u._info && typeof u._info.follower_count === "number" ? u._info.follower_count : (unknown === -1 ? -1 : Infinity); }
  function sortKeys(cat) {
    if (CATS[cat].sec === "followers") return ["name", "dm_old", "dm_new", "bot", "fc_asc", "fc_desc"];
    return ["name", "drop", "dm_old", "dm_new"];
  }
  function defaultSort(cat) { return cat === "idle" ? "dm_old" : cat === "bots" ? "bot" : "name"; }
  function currentSort() {
    const k = S.sortBy[S.cat] || defaultSort(S.cat);
    const need = SORTS[k] && SORTS[k].need;
    if (need === "dm" && !S.dmScanned) return defaultSort(S.cat);
    return SORTS[k] && sortKeys(S.cat).includes(k) ? k : defaultSort(S.cat);
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
    if (S.cat === "bots") list = list.filter(isSuspect);
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

  // Son 90 günde DM'leştiğin ama korunmayan, takip ettiğin kişiler (akıllı koruma önerisi)
  function protectSuggestions() {
    if (!S.dmScanned) return [];
    const cut = Date.now() - 90 * 86400000;
    return S.following.filter((u) => { const pk = String(u.pk); return !S.whitelist.has(pk) && (S.dmMap[pk] || 0) > cut; });
  }
  async function protectSuggested() {
    const list = protectSuggestions();
    if (!list.length) { toast("Önerilecek kimse yok."); return; }
    const ok = await askConfirm({
      title: `${list.length} kişi korunsun mu?`,
      html: "<p>Son 90 günde DM'leştiğin ve takip ettiğin bu kişiler koru listesine eklenir; toplu “Takibi bırak” işlemlerinde atlanırlar.</p>",
      names: list.map((u) => u.username), okLabel: `Koru (${list.length})`,
    });
    if (!ok) return;
    list.forEach((u) => { S.whitelist.add(String(u.pk)); S.selected.delete(String(u.pk)); });
    saveWhitelist();
    toast(`${list.length} kişi koru listesine eklendi.`);
    render();
  }

  // ================================================================ tek tek işlem
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
    let j = null;
    try { j = await res.json(); } catch (e) {}
    const ok = res.ok && (!j || j.status === "ok");
    if (!ok) {
      // Instagram kısıtlamayı genellikle "feedback_required" / spam ile bildirir — kuyruk bunu görüp durur
      const why = j && (j.feedback_title || j.message || (j.spam ? "spam" : ""));
      const flag = j && (j.feedback_required || j.spam) ? " · feedback_required" : "";
      throw new Error("HTTP " + res.status + (why ? " · " + why : "") + flag);
    }
    return true;
  }

  function findUser(pk) {
    pk = String(pk);
    return S.followers.find((x) => String(x.pk) === pk) || S.following.find((x) => String(x.pk) === pk);
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

  // Elle engelleme yardımcısı: profili ayrı pencerede açar; kullanıcı Instagram'ın kendi "Engelle"sine basar.
  // Otomatik engelleme Instagram tarafından güvenlik gereği reddedildiği (oturumu kapattığı) için tek güvenli yol budur.
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

  // Excel/Numbers'da formül olarak çalışabilecek değerleri (=, +, -, @ ile başlayan) metne çevir.
  function csvCell(v) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n;']/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(head, rows) { return "﻿" + head.join(",") + "\n" + rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n"; }
  const stampNow = () => fmtDate(Date.now()).replace(/[: ]/g, "-");
  function saveTextFile(name, content, label, okMsg) {
    if (post({ type: "export", name, content, label })) { toast(okMsg || `Downloads/${name} dosyasına kaydedildi ✓`); return; }
    // Uygulama dışı (tarayıcı) yedeği
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
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
        inf.media_count, inf.follower_count, inf.following_count];
    });
    const name = `instagram-${S.cat}-${stampNow()}.csv`;
    saveTextFile(name, toCSV(head, rows), "CSV dışa aktarıldı", `${list.length} ${what} hesap Downloads/${name} dosyasına kaydedildi ✓`);
  }

  // Tarama sonuçlarını temizle (koru listesi, geçmiş, raporlar ve ayarlar kalır)
  async function clearAll() {
    if (guardBusy()) return;
    const ok = await askConfirm({
      title: "Tarama sonuçları temizlensin mi?",
      html: `<p>Takip listesi, takipçiler, şüpheliler, beğeniler ve DM listeleri silinir. <b>Koru listen, işlem geçmişin, raporların, grafik verisi ve ayarların kalır.</b></p>
        <p class="igd-note">Instagram hesabında hiçbir şey değişmez; yalnızca bu uygulamanın kaydettiği sonuçlar silinir.</p>`,
      danger: true, okLabel: "Temizle",
    });
    if (!ok || guardBusy()) return;
    S.following = []; S.followers = [];
    S.followingIds = new Set(); S.followerIds = new Set();
    S.scanned = false; S.detecting = false;
    S.followersFull = false; S.followersTrunc = false; S.followersLoading = false;
    S.followerCount = null; S.followingCount = null;
    S.followingScanTime = 0; S.followersScanTime = 0; S.dmScanTime = 0;
    S.dmMap = {}; S.dmThreads = []; S.dmScanned = false; S.dmSel.clear();
    S.selected.clear(); S.query = ""; S._botVerifyTried = false; S.likes = null; S.resume = null;
    await Promise.all([DB.del(K.cache), DB.del(K.likes), DB.del(K.resumeFollowers)]).catch(() => {});
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
