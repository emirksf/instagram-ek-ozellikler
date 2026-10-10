
  // ================================================================ LİSTE SAYFALARI (Analiz, Takipçiler)
  const SOURCES = [
    { key: "following", name: "Takip listesi", icon: "users", feeds: "Geri takip etmeyenler · Karşılıklı · Etkileşimsizler · Takip ettiklerin",
      has: () => S.scanned, t: () => S.followingScanTime, n: () => `${fmtN(S.following.length)} kişi`, run: () => runScan() },
    { key: "followers", name: "Takipçiler", icon: "user", feeds: "Hayranların · Şüpheli/Bot · Hayaletler · Rapor",
      has: () => S.followersFull || S.followers.length > 0, partial: () => !S.followersFull && !S.followersLoading && S.followers.length > 0,
      t: () => S.followersScanTime, n: () => `${fmtN(S.followers.length)}${S.followerCount ? " / " + fmtN(S.followerCount) : ""} takipçi`, run: () => fetchAllFollowers() },
    { key: "likes", name: "Beğeniler", icon: "heart", feeds: "Hayaletler (son gönderilerini beğenmeyenler)",
      has: () => !!S.likes, t: () => S.likes && S.likes.t, n: () => `${S.likes.posts} gönderi · ${fmtN(S.likes.likers.size)} beğenen`, run: () => scanLikes() },
    { key: "dm", name: "DM kutusu", icon: "message", feeds: "Etkileşimsizler · DM'lerim",
      has: () => S.dmScanned, t: () => S.dmScanTime, n: () => `${fmtN(S.dmThreads.length)} sohbet`, run: () => scanDM() },
  ];
  const PAGE_SOURCES = { analysis: ["following", "dm"], followers: ["followers", "likes"], dm: ["dm"] };
  const resumable = () => !!(S.resume && S.resume.maxId && Date.now() - S.resume.t < RESUME_MAX_AGE && S.followers.length === S.resume.n && !S.followersFull);
  const srcBusy = (key) => S.job && !S.job.finished && S.job.src === key;
  const srcHas = (key) => SOURCES.find((s) => s.key === key).has();
  const LOCK_HINT = { following: "takip listesi taraması gerekli", followers: "takipçi taraması gerekli", dm: "DM taraması gerekli", likes: "beğeni taraması gerekli" };

  function renderSources() {
    const el = $("igd-sources"); if (!el) return;
    const keys = PAGE_SOURCES[S.section] || [];
    el.innerHTML = SOURCES.filter((s) => keys.includes(s.key)).map((s) => {
      const has = s.has(), busy = srcBusy(s.key), partial = s.partial && s.partial();
      const trunc = s.key === "followers" && S.followersTrunc && !busy;
      let r2;
      if (busy) r2 = `<span class="igd-spin"></span> Taranıyor…`;
      else if (s.key === "dm" && dmGone()) r2 = has ? `Instagram erişimi değiştirdi · kayıtlı veri ${esc(ageStr(s.t()))}` : "Instagram web'de DM erişimini değiştirdi";
      else if (trunc) r2 = `Eksik: Instagram ${esc(s.n())} verdi`;
      else if (partial) r2 = `Kısmi (durduruldu) · ${esc(s.n())}`;
      else if (has) r2 = `${s.t() ? esc(ageStr(s.t())) : "zamanı bilinmiyor"} · ${esc(s.n())}`;
      else r2 = "Henüz taranmadı";
      const label = has && !partial ? "Yenile" : partial ? (s.key === "followers" && resumable() ? "Devam et" : "Yeniden tara") : "Tara";
      return `<div class="igd-src ${has ? "" : "none"} ${partial || trunc ? "partial" : ""}" role="group" aria-label="Veri kaynağı: ${esc(s.name)}">
        <div class="r1">${ic(s.icon, 14)} ${esc(s.name)}
          <button class="igd-btn sm ${has && !partial ? "" : "primary"}" data-src="${s.key}" ${isBusy() ? "disabled" : ""}
            aria-label="${esc(s.name)}: ${label}">${ic("refresh", 12)} ${label}</button></div>
        <div class="r2">${r2}</div>
        <div class="r3" title="${esc(s.feeds)}">Besler: ${esc(s.feeds)}</div>
      </div>`;
    }).join("");
    el.querySelectorAll("[data-src]").forEach((b) => b.onclick = () => SOURCES.find((s) => s.key === b.dataset.src).run());
  }

  function go(section, cat) {
    if (cat) { S.catBySec[section] = cat; }
    setSection(section);
  }

  function renderStats() {
    const el = $("igd-stats"); if (!el) return;
    const haveFollowers = srcHas("followers") || S.followersLoading;
    const dash = (v) => (S.scanned && !S.detecting ? fmtN(v) : "–");
    const cards = [
      { n: dash(S.following.length), l: "Takip ettiğin", sec: "analysis", cat: "all" },
      { n: S.followerCount != null ? fmtN(S.followerCount) : haveFollowers ? fmtN(S.followers.length) : "–", l: "Takipçin", sec: "followers", cat: "fans" },
      { n: dash(catList("non").length), l: "Geri takip etmeyen", sec: "analysis", cat: "non", accent: true },
      haveFollowers
        ? { n: fmtN(catList("fans").length), l: "Hayranın (tek taraflı)", sec: "followers", cat: "fans" }
        : { lock: true, l: "Hayranın (tek taraflı)", sec: "followers", cat: "fans" },
      { n: dash(catList("mutual").length), l: "Karşılıklı", sec: "analysis", cat: "mutual" },
    ];
    el.innerHTML = cards.map((c, i) => c.lock
      ? `<button class="igd-stat lock" data-i="${i}" aria-label="Hayranlarını görmek için takipçileri tara"><div class="n">${ic("lock", 13)} Takipçileri tara</div><div class="l">${c.l}</div></button>`
      : `<button class="igd-stat ${c.accent ? "accent" : ""} ${S.section === c.sec && S.cat === c.cat ? "on" : ""}" data-i="${i}" aria-label="${c.l}: ${c.n} — listeyi aç"><div class="n">${c.n}</div><div class="l">${c.l}</div></button>`
    ).join("");
    el.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => {
      const c = cards[+b.dataset.i];
      go(c.sec, c.cat);
      if (c.lock) confirmFollowersScan();
    });
  }

  async function confirmFollowersScan() {
    if (guardBusy()) return;
    const n = S.followerCount;
    const ok = await askConfirm({
      title: "Takipçiler taranacak",
      html: `<p>Hayranlarını ve şüpheli takipçileri görmek için ${n ? `<b>${fmtN(n)}</b> takipçinin` : "tüm takipçilerin"} taranması gerekiyor. Taradıkça listelenir; istediğin an alttaki tepsiden durdurabilirsin.</p>`,
      estimate: n ? Math.ceil(n / 100) * 2.6 : 0,
      okLabel: "Takipçileri tara",
    });
    if (ok) fetchAllFollowers();
  }

  function tabCount(k) {
    const src = CATS[k].src;
    if (src === "following" && !S.scanned) return null;
    if (src === "followers" && !(srcHas("followers") || S.followersLoading)) return null;
    if (src === "dm" && (!S.dmScanned || !S.scanned)) return null;
    if (src === "likes" && (!S.likes || !S.followers.length)) return null;
    if (S.detecting && (k === "non" || k === "mutual")) return "…";
    if (k === "bots") return fmtN(S.followers.filter(isSuspect).length);
    if (k === "idle") return fmtN(S.following.filter((u) => { const ms = S.dmMap[String(u.pk)]; return !ms || ms < Date.now() - 180 * 86400000; }).length);
    return fmtN(catList(k).length);
  }

  function renderTabs() {
    const el = $("igd-tabs"); if (!el) return;
    const keys = Object.keys(CATS).filter((k) => CATS[k].sec === S.section);
    el.innerHTML = keys.map((k) => {
      const c = tabCount(k);
      const lockSrc = c === null ? (CATS[k].src === "dm" && S.dmScanned ? "following" : CATS[k].src === "likes" && !S.followers.length ? "followers" : CATS[k].src) : null;
      const cnt = c === null
        ? `<span class="c" title="${esc(LOCK_HINT[lockSrc])}">${ic("lock", 12)}</span>`
        : `<span class="c">${c}</span>`;
      return `<button type="button" class="igd-tab ${k === S.cat ? "on" : ""}" data-cat="${k}" role="tab" aria-selected="${k === S.cat}"${c === null ? ` aria-label="${esc(CATS[k].label)} — ${esc(LOCK_HINT[lockSrc])}"` : ""}>${esc(CATS[k].label)}${cnt}</button>`;
    }).join("");
    el.querySelectorAll(".igd-tab").forEach((t) => {
      t.onclick = () => { S.cat = t.dataset.cat; S.catBySec[S.section] = S.cat; S.selected.clear(); S.lastSelIdx = -1; resetListScroll(); render(); };
    });
  }

  function resetListScroll() { const l = $("igd-list"); if (l) l.scrollTop = 0; }

  function buildListPage(page) {
    page.innerHTML = `
      <div class="igd-sources" id="igd-sources"></div>
      ${S.section === "analysis" ? `<div class="igd-stats" id="igd-stats"></div>` : ""}
      <div class="igd-tabs" id="igd-tabs" role="tablist" aria-label="Listeler"></div>
      <div class="igd-toolbar">
        <div class="igd-search">${ic("search")}<input id="igd-q" placeholder="Kullanıcı adı veya isim ara..." aria-label="Kullanıcı adı veya isim ara" autocomplete="off" value="${esc(S.query)}"/></div>
        <select id="igd-acct" class="igd-sel" aria-label="Hesap türü süzgeci">${ACCT_FILTERS.map(([v, l]) => `<option value="${v}" ${S.acctFilter === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select id="igd-sort" class="igd-sel" aria-label="Sıralama"></select>
        <button class="igd-btn" id="igd-copy" title="Kullanıcı adlarını panoya kopyala (seçim varsa yalnız seçilenler)">${ic("copy")} Kopyala</button>
        <button class="igd-btn" id="igd-csv" title="Tüm alanlarla CSV olarak Downloads'a kaydet (seçim varsa yalnız seçilenler)">${ic("download")} CSV</button>
        <button class="igd-btn primary" id="igd-do" disabled>İşle</button>
      </div>
      <div class="igd-listhead" id="igd-listhead"></div>
      <div class="igd-list" id="igd-list" role="list" aria-label="Hesaplar"></div>`;
    $("igd-q").oninput = (e) => { S.query = e.target.value.trim(); S.lastSelIdx = -1; resetListScroll(); render(); };
    $("igd-acct").onchange = (e) => { S.acctFilter = e.target.value; S.lastSelIdx = -1; render(); };
    $("igd-sort").onchange = (e) => { S.sortBy[S.cat] = e.target.value; S.lastSelIdx = -1; resetListScroll(); render(); };
    $("igd-copy").onclick = copyList;
    $("igd-csv").onclick = exportCSV;
    $("igd-do").onclick = () => bulkAction(CATS[S.cat].action, [...S.selected]);
    $("igd-list").onclick = onListClick;
  }

  function renderSortSelect() {
    const sel = $("igd-sort"); if (!sel) return;
    const cur = currentSort();
    const hasInfo = S.vis.some((u) => u._info);
    const sig = S.cat + "|" + cur + "|" + S.dmScanned + "|" + hasInfo;
    if (sel.dataset.sig === sig) return;
    sel.dataset.sig = sig;
    sel.innerHTML = sortKeys(S.cat).map((k) => {
      const need = SORTS[k].need;
      const off = (need === "dm" && !S.dmScanned) || (need === "info" && !hasInfo);
      const hint = off ? (need === "dm" ? " (DM taraması gerekli)" : " (derin doğrulama gerekli)") : "";
      return `<option value="${k}" ${k === cur ? "selected" : ""} ${off ? "disabled" : ""}>${SORTS[k].label}${hint}</option>`;
    }).join("");
  }

  // Sekmenin listesi gösterilemiyorsa nedenini anlatan kart (null → liste gösterilebilir)
  function listBlocker() {
    const cat = CATS[S.cat];
    const needsFollowers = cat.src === "followers" || cat.src === "likes";
    if (!S.loaded) return emptyCard({ icon: "refresh", spin: true, title: "Kayıtlı sonuçlar yükleniyor…" });
    if (!isLoggedIn() && !S.scanned && !(needsFollowers && S.followers.length)) {
      return emptyCard({ icon: "instagram", title: "Instagram oturumu gerekli",
        html: "<p>Analiz kendi Instagram oturumunla yapılır. Önce Instagram'da giriş yap; panel sonra kaldığın yerden açılır.</p>",
        actions: [{ label: "Instagram'da giriş yap", cta: "login", primary: true, icon: "instagram" }] });
    }
    if (!needsFollowers && !S.scanned) {
      return emptyCard({ icon: "users", title: "Önce takip listeni tara",
        html: "<p>Kimleri takip ettiğini ve kimin seni geri takip ettiğini öğrenir. Genelde 1–2 dakika sürer; tarama alttaki tepside ilerler.</p>",
        actions: [{ label: "Takip listesini tara", cta: "scan", primary: true, icon: "refresh" }] });
    }
    if (S.needRescan && (S.cat === "non" || S.cat === "mutual")) {
      return emptyCard({ icon: "alert", title: "Geri takip bilgisi yeniden taranmalı",
        html: "<p>Kayıtlı geri takip bilgisi, Instagram'ın eksik verdiği bir takipçi listesinden hesaplanmış. Bu durumda seni takip eden kişiler de bu listede görünebilir. Güvenli sonuç için takip listesini yeniden tara (1–2 dk).</p>",
        actions: [{ label: "Takip listesini tara", cta: "scan", primary: true, icon: "refresh" }] });
    }
    if (S.detecting && !needsFollowers) {
      return emptyCard({ icon: "users", spin: true, title: "Kim geri takip ediyor analiz ediliyor…",
        html: `<p>Takip ettiğin ${fmtN(S.following.length)} kişi kontrol ediliyor. Sonuç kesinleşince liste burada görünecek.</p>` });
    }
    if (needsFollowers && !S.followers.length && !S.followersLoading) {
      const cnt = S.followerCount != null ? fmtN(S.followerCount) : "tüm";
      return emptyCard({ icon: "lock", title: "Bu sekme için takipçi taraması gerekli",
        html: `<p>${S.cat === "bots" ? "Bot / sahte / boş takipçileri bulmak" : S.cat === "ghosts" ? "Son gönderilerini beğenmeyen takipçileri bulmak" : "Seni takip edip senin takip etmediklerini görmek"} için <b>${esc(cnt)} takipçinin tamamı</b> taranmalı. Takip listesinden <b>ayrı ve daha uzun</b> bir taramadır; taradıkça listelenir, istediğin an durdurabilirsin.</p>`,
        actions: [{ label: "Takipçileri tara", cta: "foll", primary: true, icon: "refresh" }],
        note: S.cat === "bots" ? "Rastgele ad, fotosuz ve isimsiz hesaplar işaretlenir; gönderi/takipçi sayıları otomatik getirilir." : "" });
    }
    if (cat.src === "likes" && !S.likes) {
      return emptyCard({ icon: "heart", title: "Hayalet takipçiler için beğeni taraması gerekli",
        html: `<p>Son <b>${ghostPosts()}</b> gönderini beğenenler alınır; hiçbirini beğenmemiş takipçilerin burada listelenir. Yalnızca okuma yapar, ~${ghostPosts() + 1} istek.</p>`,
        actions: [{ label: "Beğenileri tara", cta: "likes", primary: true, icon: "refresh" }],
        note: "Instagram popüler gönderilerde beğenen listesini kısaltabildiği için sonuç yaklaşıktır; kapsama oranı listenin üstünde gösterilir." });
    }
    if (cat.src === "dm" && !S.dmScanned) {
      return emptyCard({ icon: "lock", title: "Bu sekme için DM taraması gerekli",
        html: "<p>Takip ettiğin kişilerle <b>en son ne zaman mesajlaştığını</b> bulur; en uzun süredir yazışmadıkların (ya da hiç yazışmadıkların) en üste gelir.</p>",
        actions: [{ label: "DM kutusunu tara", cta: "dm", primary: true, icon: "refresh" }],
        note: "Yalnızca sohbet listesi ve tarihler okunur, mesaj içerikleri okunmaz. Beğeni/yorum etkileşimi Instagram'dan güvenle ölçülemez." });
    }
    return null;
  }

  function renderListHead() {
    const el = $("igd-listhead"); if (!el) return;
    let h = "";
    const fsrc = CATS[S.cat].src === "followers" || CATS[S.cat].src === "likes";
    if (S.followersLoading && fsrc) {
      h += `<div class="igd-bar2"><span class="igd-spin"></span> Takipçiler taranıyor: ${fmtN(S.followers.length)}${S.followerCount ? " / " + fmtN(S.followerCount) : ""} — taradıkça güncelleniyor.</div>`;
    } else if (fsrc && S.followersTrunc) {
      h += `<div class="igd-bar2 warn">${ic("alert", 14)} Instagram takipçi listenin yalnızca ${fmtN(S.followers.length)} / ${fmtN(S.followerCount)} kısmını verdi — bu liste eksik olabilir.</div>`;
    } else if (fsrc && !S.followersFull && S.followers.length > 0) {
      h += `<div class="igd-bar2 warn">${ic("alert", 14)} Kısmi liste: ${fmtN(S.followers.length)} takipçi tarandı (durduruldu).
        <button class="igd-btn sm" data-cta="foll">${resumable() ? "Kaldığı yerden devam et" : "Takipçileri yeniden tara"}</button></div>`;
    }
    if (S.cat === "ghosts" && S.likes) {
      const L = S.likes, cov = L.totalLikes ? Math.round(Math.min(1, L.gotLikes / L.totalLikes) * 100) : 100;
      h += `<div class="igd-bar2 ${cov < 90 ? "warn" : ""}">${ic("heart", 14)} Son ${L.posts} gönderinden hiçbirini beğenmemiş takipçiler · beğeni kapsaması %${cov} (${esc(ageStr(L.t))})
        ${cov < 90 ? "· Instagram bazı beğenen listelerini kısalttı; çıkarmadan önce gözden geçir." : ""}</div>`;
    }
    const sug = CATS[S.cat].sec === "analysis" && !S.protectHintHidden ? protectSuggestions() : [];
    if (sug.length) {
      h += `<div class="igd-bar2">${ic("shield", 14)}<span>Son 90 günde DM'leştiğin <b>${sug.length}</b> kişi korunmuyor.</span>
        <button class="igd-btn sm" id="igd-protsug">Hepsini koru…</button><button class="igd-btn sm ghost" id="igd-protsug-hide">Gizle</button></div>`;
    }
    if (S.cat === "idle" && S.dmScanned && S.scanned) {
      const opts = [[0, "Tümü"], [90, "3+ ay etkileşimsiz"], [180, "6+ ay etkileşimsiz"], [365, "1+ yıl etkileşimsiz"], [-1, "Hiç DM yok"]];
      h += `<div class="igd-bar2">Süzgeç: <select id="igd-idlesel" class="igd-sel" aria-label="Etkileşimsizlik süzgeci">${opts.map(([v, l]) => `<option value="${v}" ${S.idleDays === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <span style="color:var(--igd-muted);">Yalnızca DM etkileşimi ölçülür.</span></div>`;
    } else if (S.cat === "bots" && S.followers.length) {
      h += `<div class="igd-bar2">Şüpheli takipçiler: fotosu yok, 0 gönderi/takipçi ya da rastgele ad + isimsiz.
        <button class="igd-btn sm" id="igd-botverify" ${isBusy() ? "disabled" : ""}>${ic("search", 12)} Derin doğrula (ilk 200)</button></div>`;
    }
    const blocked = !!listBlocker();
    if (!blocked) {
      const selectableN = S.vis.filter(selectable).length;
      const n = S.selected.size;
      const all = n > 0 && n >= selectableN;
      h += `<div class="igd-selbar">
        <label class="igd-chk"><input type="checkbox" class="igd-cb" id="igd-all" ${all ? "checked" : ""} ${selectableN ? "" : "disabled"}/> Tümünü seç</label>
        <span>${fmtN(S.vis.length)} hesap${n ? ` · <b>${fmtN(n)} seçili</b>` : ""}</span>
        ${n ? `<button class="igd-btn sm ghost" id="igd-selclear">Seçimi temizle</button>` : ""}
        <span class="igd-sp"></span><span class="igd-note">Satıra tıkla: seç · Shift+tık: aralık seç</span>
      </div>`;
    }
    el.innerHTML = h;
    const s = $("igd-idlesel"); if (s) s.onchange = () => { S.idleDays = parseInt(s.value, 10); S.selected.clear(); render(); };
    const bv = $("igd-botverify"); if (bv) bv.onclick = deepVerifyBots;
    const ps = $("igd-protsug"); if (ps) ps.onclick = protectSuggested;
    const ph = $("igd-protsug-hide"); if (ph) ph.onclick = () => { S.protectHintHidden = true; lsSet("igd_protect_hint_hidden", "1"); render(); };
    const all = $("igd-all"); if (all) all.onchange = (e) => selectAllVisible(e.target.checked);
    const sc = $("igd-selclear"); if (sc) sc.onclick = () => { S.selected.clear(); S.lastSelIdx = -1; render(); };
    el.querySelectorAll("[data-cta]").forEach((b) => b.onclick = () => runCta(b.dataset.cta));
  }

  function rowHtml(u, i) {
    const cat = CATS[S.cat];
    const pk = esc(String(u.pk));
    const wl = S.whitelist.has(String(u.pk));
    const canSel = selectable(u);
    const sel = S.selected.has(String(u.pk));
    const name = esc(u.username);
    const A = ACTIONS[cat.action];
    let tags = "";
    if (u.is_verified) tags += `<span class="badge" title="Doğrulanmış">${ic("check", 13)}</span>`;
    if (u.is_private) tags += '<span class="igd-tag priv">Gizli</span>';
    if (wl) tags += '<span class="igd-tag wl">Korunuyor</span>';
    if (S.dmScanned) {
      const ms = S.dmMap[String(u.pk)];
      const days = ms ? Math.floor((Date.now() - ms) / 86400000) : Infinity;
      tags += `<span class="igd-tag dm ${!ms ? "never" : days >= 180 ? "old" : ""}">${dmAgoLabel(u.pk)}</span>`;
    }
    let line2 = esc(u.full_name);
    if (CATS[S.cat].sec === "analysis" && currentSort() === "drop") {
      const r = dropScore(u).reasons;
      if (r.length) line2 = `<b>${esc(r.join(" · "))}</b>${u.full_name ? " · " + esc(u.full_name) : ""}`;
    }
    if (S.cat === "bots") {
      const r = botScore(u).reasons;
      if (r.length) tags += `<span class="igd-tag bot">${esc(r.join(" · "))}</span>`;
      if (u._info) line2 = `<b>${fmtN(u._info.media_count)} gönderi · ${fmtN(u._info.follower_count)} takipçi · ${fmtN(u._info.following_count)} takip</b>${u.full_name ? " · " + esc(u.full_name) : ""}`;
    }
    const shield = cat.action === "unfollow"
      ? `<button class="igd-mini icon ${wl ? "on" : ""}" data-wl="${pk}" aria-pressed="${wl}" aria-label="${wl ? `@${name} korumasını kaldır` : `@${name} hesabını takibi bırakmaya karşı koru`}" title="${wl ? "Korumayı kaldır" : "Yanlışlıkla takibi bırakmaya karşı koru"}">${ic("shield", 14)}</button>`
      : "";
    return `<div class="igd-item ${wl ? "wl" : ""} ${sel ? "sel" : ""} ${canSel ? "" : "nosel"}" data-i="${i}" data-pk="${pk}" role="listitem">
      <input type="checkbox" class="igd-cb" aria-label="@${name} seç" ${sel ? "checked" : ""} ${canSel ? "" : `disabled title="Korunan hesap seçilemez"`}/>
      <img class="igd-ava" src="${esc(u.profile_pic_url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
      <div class="igd-meta">
        <div class="igd-name"><a href="https://www.instagram.com/${name}/" target="_blank">@${name}</a>${tags}</div>
        <div class="igd-full">${line2}</div>
      </div>
      <div class="igd-actions">
        <button class="igd-mini icon" data-sb="${name}" aria-label="@${name} SocialBlade istatistikleri" title="SocialBlade istatistikleri">${ic("trend", 14)}</button>
        ${shield}
        <button class="igd-mini ${cat.action === "follow" ? "follow" : "act"}" data-act="${pk}" aria-label="@${name}: ${A.btn}">${A.btn}</button>
        ${S.cat === "bots" ? `<button class="igd-mini block" data-block="${name}" aria-label="@${name} profilini engellemek için aç" title="Elle engellemek için profili aç (Instagram'ın kendi Engelle'sine basarsın)">${ic("block", 13)} Engelle</button>` : ""}
      </div>
    </div>`;
  }

  function runCta(cta) {
    if (cta === "scan") runScan();
    else if (cta === "foll") fetchAllFollowers();
    else if (cta === "dm") scanDM();
    else if (cta === "login") showInstagram();
    else if (cta === "report") generateReport();
    else if (cta === "likes") scanLikes();
  }

  // Satır tıklama: düğme/bağlantı kendi işini yapar; satırın geri kalanı seçimi değiştirir (Shift = aralık).
  function onListClick(e) {
    const t = e.target;
    const btn = t.closest("button");
    if (btn) {
      if (btn.dataset.act) bulkAction(CATS[S.cat].action, [btn.dataset.act]);
      else if (btn.dataset.wl) toggleWhitelist(btn.dataset.wl);
      else if (btn.dataset.sb) sb(btn.dataset.sb);
      else if (btn.dataset.block) openBlockHelper(btn.dataset.block);
      else if (btn.dataset.cta) runCta(btn.dataset.cta);
      return;
    }
    if (t.closest("a")) return;
    const row = t.closest(".igd-item[data-pk]"); if (!row) return;
    const i = +row.dataset.i, u = S.vis[i];
    if (!u || !selectable(u)) { if (t.matches("input")) e.preventDefault(); return; }
    const pk = String(u.pk);
    const want = t.matches("input.igd-cb") ? t.checked : !S.selected.has(pk);
    if (e.shiftKey && S.lastSelIdx >= 0 && S.lastSelIdx < S.vis.length) {
      const lo = Math.min(S.lastSelIdx, i), hi = Math.max(S.lastSelIdx, i);
      for (let k = lo; k <= hi; k++) {
        const v = S.vis[k]; if (!selectable(v)) continue;
        if (want) S.selected.add(String(v.pk)); else S.selected.delete(String(v.pk));
      }
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    } else if (want) S.selected.add(pk); else S.selected.delete(pk);
    S.lastSelIdx = i;
    drawVList($("igd-list"), true);
    renderListHead(); updateBar();
  }

  function selectAllVisible(on) {
    if (on) S.vis.forEach((u) => { if (selectable(u)) S.selected.add(String(u.pk)); });
    else S.vis.forEach((u) => S.selected.delete(String(u.pk)));
    S.lastSelIdx = -1;
    render();
  }

  function updateBar() {
    const btn = $("igd-do"); if (!btn) return;
    const cat = CATS[S.cat], A = ACTIONS[cat.action];
    const n = S.selected.size;
    btn.disabled = n === 0 || isBusy();
    btn.classList.toggle("danger", cat.action !== "follow");
    btn.classList.toggle("primary", cat.action === "follow");
    btn.textContent = `${cat.action === "follow" ? "Seçilenleri takip et" : A.btn} (${n})`;
    const blocked = !!listBlocker();
    const copy = $("igd-copy"); if (copy) copy.disabled = blocked || !S.vis.length;
    const csv = $("igd-csv"); if (csv) csv.disabled = blocked || !S.vis.length;
  }

  function updateListPage() {
    renderSources();
    renderStats();
    renderTabs();
    const box = $("igd-list");
    const blocker = listBlocker();
    const prevVis = S.vis;
    S.vis = blocker ? [] : visibleList();
    if (S.vis.length !== prevVis.length || S.vis[0] !== prevVis[0]) S.lastSelIdx = -1;
    // Seçimde artık görünmeyen / seçilemeyen kalmasın
    if (S.selected.size) {
      const ok = new Set(S.vis.filter(selectable).map((u) => String(u.pk)));
      [...S.selected].forEach((pk) => { if (!ok.has(pk)) S.selected.delete(pk); });
    }
    renderSortSelect();
    renderListHead();
    if (blocker) setListContent(box, blocker);
    else if (!S.vis.length) setListContent(box, emptyCard({ compact: true, icon: S.query ? "search" : "check", title: S.query ? "Eşleşme yok" : CATS[S.cat].empty }));
    else mountVList(box, S.vis, rowHtml);
    updateBar();
    // Şüpheli sekmesinde gönderi/takipçi sayılarını bir kez OTOMATİK getir
    if (S.cat === "bots" && !blocker && !isBusy() && !S._botVerifyTried && (S.followersFull || S.followersTrunc) && S.vis.length && !S.vis.some((u) => u._info)) {
      S._botVerifyTried = true;
      setTimeout(() => deepVerifyBots(), 60);
    }
  }
