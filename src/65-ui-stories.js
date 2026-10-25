
  // ================================================================ Hikayeme bakanlar sayfası
  // Takibi arka plan izleyicisi yapar (watcher/60-stories.js); bu sayfa ayarları ve kayıtları gösterir.
  const STW = () => window.__igdWatch && window.__igdWatch.st;
  S.st = { data: null, active: null, activeT: 0, activeErr: "", view: "all", tab: "viewers", q: "", vis: [] };

  function storyLabel(rec) { return rec && rec.taken ? "Hikaye · " + fmtClock(rec.taken) : "Hikaye"; }
  function hhmm(ms) { const d = new Date(ms); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  // Bakışın olduğu aralık: "25.10 14:30–15:00"
  function fmtWin(from, to) {
    if (!from || fmtClock(from) === fmtClock(to)) return fmtClock(to);
    return new Date(from).toDateString() === new Date(to).toDateString() ? `${fmtClock(from)}–${hhmm(to)}` : `${fmtClock(from)} – ${fmtClock(to)}`;
  }
  function leftStr(exp) {
    const m = Math.round((exp - Date.now()) / 60000);
    if (m <= 0) return "süresi doldu";
    return m < 60 ? `${m} dk kaldı` : `${Math.floor(m / 60)} sa kaldı`;
  }

  async function stReload() {
    try { S.st.data = await stLoad(); } catch (e) { S.st.data = { v: 1, stories: {}, log: [] }; }
  }
  async function stFetchActive(force) {
    if (!isLoggedIn()) return;
    if (!force && S.st.active && Date.now() - S.st.activeT < 5 * 60000) return;
    try { S.st.active = await fetchMyStories(); S.st.activeErr = ""; }
    catch (e) { S.st.activeErr = e.message; if (force) toast(e.message, true); }
    S.st.activeT = Date.now();
  }
  if (!window.__igdStEv) {
    window.__igdStEv = true;
    window.addEventListener("igd-stories", async () => { if (S.section !== "stories") return; await stReload(); render(); });
  }

  // Kartlar: aktif hikayeler + kaydı olan eski hikayeler, en yeni önce
  function stCards() {
    const recs = (S.st.data && S.st.data.stories) || {};
    const map = {};
    (S.st.active || []).forEach((m) => { map[m.pk] = Object.assign({ live: true }, recs[m.pk] || {}, m); });
    Object.keys(recs).forEach((pk) => { if (!map[pk]) map[pk] = Object.assign({ live: false }, recs[pk]); });
    return Object.values(map).sort((a, b) => (b.taken || 0) - (a.taken || 0));
  }

  function buildStoriesPage(page) {
    page.innerHTML = `
      <div class="igd-toolbar">
        <button class="igd-btn" id="igd-st-toggle"></button>
        <div class="igd-seg" role="group" aria-label="Neyi takip edeyim">
          <button id="igd-st-all">Tüm hikayeler</button><button id="igd-st-sel">Seçili hikayeler</button>
        </div>
        <label class="igd-chk">Her <input type="number" id="igd-st-int" min="10" max="180" class="igd-num" style="width:64px;" aria-label="Kontrol aralığı (dakika)"/> dk</label>
        <button class="igd-btn" id="igd-st-check" title="Beklemeden şimdi kontrol et">${ic("refresh")} Şimdi kontrol et</button>
        <label class="igd-chk"><input type="checkbox" id="igd-st-notify"/> Tekrar bakınca bildir</label>
      </div>
      <div class="igd-listhead" id="igd-st-status"></div>
      <div class="igd-stories" id="igd-st-cards" aria-label="Hikayelerin"></div>
      <div class="igd-tabs" id="igd-st-tabs"></div>
      <div class="igd-toolbar">
        <div class="igd-search">${ic("search")}<input id="igd-st-q" placeholder="Kullanıcı adı ara..." aria-label="İzleyicilerde ara" autocomplete="off" value="${esc(S.st.q)}"/></div>
        <button class="igd-btn" id="igd-st-csv">${ic("download")} CSV</button>
        <button class="igd-btn danger" id="igd-st-clear">Kayıtları sil…</button>
      </div>
      <div class="igd-list" id="igd-st-list" role="list" aria-label="Hikaye izleyicileri"></div>`;
    $("igd-st-toggle").onclick = stToggle;
    $("igd-st-all").onclick = () => { lsSet(ST.mode, "all"); render(); };
    $("igd-st-sel").onclick = () => { lsSet(ST.mode, "sel"); render(); };
    $("igd-st-int").value = stIntervalMin();
    $("igd-st-int").onchange = (e) => {
      const v = Math.max(10, Math.min(180, parseInt(e.target.value || "30", 10) || 30));
      e.target.value = v; lsSet(ST.int, String(v));
      toast(`Hikayeler ${v} dakikada bir kontrol edilecek.`); render();
    };
    $("igd-st-notify").checked = lsGet(ST.notify, "0") === "1";
    $("igd-st-notify").onchange = (e) => lsSet(ST.notify, e.target.checked ? "1" : "0");
    $("igd-st-check").onclick = stCheckNow;
    $("igd-st-q").oninput = (e) => { S.st.q = e.target.value.trim().toLowerCase(); updateStoriesList(); };
    $("igd-st-csv").onclick = stExport;
    $("igd-st-clear").onclick = stClear;
    $("igd-st-cards").onclick = onStoryCardClick;
    $("igd-st-cards").onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".igd-story")) { e.preventDefault(); e.target.click(); } };
    $("igd-st-tabs").onclick = (e) => { const b = e.target.closest("[data-sttab]"); if (b) { S.st.tab = b.dataset.sttab; render(); } };
    (async () => {
      await stReload();
      await stFetchActive(false);
      if (S.section === "stories") render();
    })();
  }

  function onStoryCardClick(e) {
    const t = e.target;
    const cb = t.closest("input[data-sttrack]");
    if (cb) {
      const pk = cb.dataset.sttrack, sel = new Set(stSel());
      if (cb.checked) sel.add(pk); else sel.delete(pk);
      lsSet(ST.sel, JSON.stringify([...sel]));
      render(); return;
    }
    if (t.closest("label")) return;
    const only = t.closest("[data-stonly]");
    if (only) { stTrackOnly(only.dataset.stonly); return; }
    const card = t.closest("[data-stview]");
    if (card) { S.st.view = card.dataset.stview; render(); }
  }

  async function stToggle() {
    const W = STW();
    if (!W) { toast("İzleyici hazır değil, sayfayı yenile.", true); return; }
    if (stOn()) { W.stop(); toast("Hikaye takibi durduruldu. Kayıtlar duruyor."); render(); return; }
    if (stMode() === "sel" && !stSel().length) { toast("Önce aşağıdan takip edilecek hikayeyi işaretle ya da “Tüm hikayeler”i seç.", true); return; }
    if (guardBusy()) return;
    const none = S.st.active && !S.st.active.length;
    startJob({ title: "Hikaye takibi başlatılıyor", stoppable: false });
    await W.start();
    jobFinish(none ? "Takip açık — şu an aktif hikayen yok; paylaştığında kendiliğinden takibe alınır."
      : `Takip açık ✓ — o anki izleyiciler temel alındı, ${stIntervalMin()} dakikada bir kontrol edilecek.`);
    await stReload(); await stFetchActive(true); render();
  }

  async function stTrackOnly(pk) {
    lsSet(ST.mode, "sel"); lsSet(ST.sel, JSON.stringify([pk]));
    S.st.view = pk;
    if (stOn()) { toast("Artık yalnızca bu hikaye takip ediliyor."); render(); return; }
    await stToggle();
  }

  async function stCheckNow() {
    const W = STW();
    if (!W) { toast("İzleyici hazır değil, sayfayı yenile.", true); return; }
    if (guardBusy()) return;
    startJob({ title: "Hikaye izleyicileri kontrol ediliyor", stoppable: false });
    await W.checkNow();
    const err = lsGet(ST.err, "");
    jobFinish(err ? "Sorun: " + err : "Kontrol tamam ✓");
    await stReload(); await stFetchActive(true); render();
  }

  // Görünür izleyiciler: tek hikaye için o hikayenin kaydı, "Tümü" için hikayeler toplanır
  function stViewers() {
    const recs = (S.st.data && S.st.data.stories) || {};
    const pks = S.st.view === "all" ? Object.keys(recs) : (recs[S.st.view] ? [S.st.view] : []);
    const by = {};
    pks.forEach((spk) => {
      const r = recs[spk];
      for (const upk in r.viewers) {
        const v = r.viewers[upk];
        const a = by[upk] || (by[upk] = { pk: upk, u: v.u, n: v.n, p: v.p, views: 0, stories: 0, first: v.first, firstTo: v.firstTo, last: v.last, lastTo: v.lastTo });
        a.views += v.views; a.stories++;
        if (v.firstTo < a.firstTo) { a.first = v.first; a.firstTo = v.firstTo; }
        if (v.lastTo > a.lastTo) { a.last = v.last; a.lastTo = v.lastTo; a.u = v.u; a.n = v.n; if (v.p) a.p = v.p; }
      }
    });
    const q = S.st.q;
    return Object.values(by).filter((v) => !q || String(v.u).toLowerCase().includes(q) || String(v.n).toLowerCase().includes(q))
      .sort((a, b) => b.views - a.views || b.lastTo - a.lastTo);
  }
  function stLogVisible() {
    const log = (S.st.data && S.st.data.log) || [];
    const q = S.st.q;
    return log.filter((e) => (S.st.view === "all" || e.s === S.st.view) && (!q || String(e.u || "").toLowerCase().includes(q))).slice().reverse();
  }

  function stViewerRow(v, i) {
    const multi = S.st.view === "all" && Object.keys((S.st.data && S.st.data.stories) || {}).length > 1;
    return `<div class="igd-item" role="listitem">
      <img class="igd-ava" src="${esc(v.p || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
      <div class="igd-meta">
        <div class="igd-name"><a href="https://www.instagram.com/${esc(v.u)}/" target="_blank">@${esc(v.u)}</a>
          <span class="igd-tag ${v.views > 1 ? "st-multi" : ""}">${v.views} kez</span>${multi ? `<span class="igd-tag">${v.stories} hikaye</span>` : ""}</div>
        <div class="igd-full">${v.n ? `<b>${esc(v.n)}</b> · ` : ""}${v.views > 1 ? `son bakış ${esc(fmtWin(v.last, v.lastTo))} · ilk ${esc(fmtWin(v.first, v.firstTo))}` : `baktı ${esc(fmtWin(v.first, v.firstTo))}`}</div>
      </div>
      <div class="igd-actions"><button class="igd-mini icon" data-sb="${esc(v.u)}" aria-label="@${esc(v.u)} SocialBlade" title="SocialBlade">${ic("trend", 14)}</button></div>
    </div>`;
  }
  const ST_LOG_TXT = {
    new: (e) => ["eye", "var(--igd-ok)", `<a href="https://www.instagram.com/${esc(e.u)}/" target="_blank">@${esc(e.u)}</a> hikayene baktı`],
    again: (e) => ["refresh", "var(--igd-accent)", `<a href="https://www.instagram.com/${esc(e.u)}/" target="_blank">@${esc(e.u)}</a> hikayene tekrar baktı <span class="igd-tag st-multi">${e.n}. kez</span>`],
    base: (e) => ["play", "var(--igd-muted2)", `Takip başladı — ${fmtN(e.n)} izleyici temel alındı`],
    gone: () => ["clock", "var(--igd-muted)", "Hikayenin süresi doldu, takibi bitti"],
  };
  function stLogRow(e) {
    const f = ST_LOG_TXT[e.k] || ST_LOG_TXT.gone;
    const [icon, color, html] = f(e);
    const rec = S.st.data.stories[e.s];
    const when = e.k === "new" || e.k === "again" ? `${fmtWin(e.from, e.t)} arası` : fmtClock(e.t);
    return `<div class="igd-item" role="listitem">
      <div style="width:30px;text-align:center;color:${color};">${ic(icon, 16)}</div>
      <div class="igd-meta"><div class="igd-name">${html}</div>
        <div class="igd-full">${esc(when)}${S.st.view === "all" ? " · " + esc(storyLabel(rec)) : ""}</div></div>
    </div>`;
  }

  function updateStoriesPage() {
    if (!$("igd-st-list")) return;
    const on = stOn(), mode = stMode(), sel = new Set(stSel()), W = STW();
    const tb = $("igd-st-toggle");
    tb.innerHTML = on ? `${ic("stop")} Takibi durdur` : `${ic("play")} Takibi başlat`;
    tb.className = "igd-btn " + (on ? "danger" : "primary");
    $("igd-st-all").classList.toggle("on", mode === "all"); $("igd-st-all").setAttribute("aria-pressed", String(mode === "all"));
    $("igd-st-sel").classList.toggle("on", mode === "sel"); $("igd-st-sel").setAttribute("aria-pressed", String(mode === "sel"));

    // Durum satırı
    const last = parseInt(lsGet(ST.last, "0"), 10) || 0, next = W ? W.nextAt() : 0, err = lsGet(ST.err, "");
    const what = mode === "all" ? "tüm aktif hikayeler" : `${sel.size} seçili hikaye`;
    const anyUnreliable = Object.values((S.st.data && S.st.data.stories) || {}).some((r) => r.unreliable);
    $("igd-st-status").innerHTML = `
      <div class="igd-bar2">${ic(on ? "bell" : "clock", 14)}<span>${on ? `<b>Takip açık</b> · ${what} · ${stIntervalMin()} dakikada bir` : "<b>Takip kapalı</b>"}
        ${last ? ` · son kontrol ${esc(fmtClock(last))} (${esc(ageStr(last))})` : ""}${on && next ? ` · sonraki ~${esc(hhmm(Math.max(next, Date.now())))}` : ""}</span>
        <span class="igd-sp"></span><span class="igd-note">Uygulama açık ya da ${BG_WHERE} olmalı.</span></div>
      ${err ? `<div class="igd-bar2 warn">${ic("alert", 14)}<span>Son kontrolde sorun: ${esc(err)}</span></div>` : ""}
      ${S.st.activeErr && !err ? `<div class="igd-bar2 warn">${ic("alert", 14)}<span>Aktif hikayeler okunamadı: ${esc(S.st.activeErr)}</span></div>` : ""}
      <div class="igd-note" style="padding:0 2px 6px;">Instagram kaç kez bakıldığını göstermez; listeyi en son bakan en üstte verir. Tekrar bakışlar iki kontrol arasındaki sıra değişiminden <b>tahmin edilir</b> — aynı aralıktaki birden çok tekrar tek sayılır, yani sayılar alt sınırdır. Zamanlar bakışın olduğu kontrol aralığıdır.${anyUnreliable ? ` <b>${ST_ORDER_RELIABLE}+ izleyicili hikayelerde Instagram sırayı yakınlığa göre de dizebildiği için tahmin zayıflar.</b>` : ""}</div>`;

    // Hikaye kartları
    const cards = stCards();
    const recs = (S.st.data && S.st.data.stories) || {};
    if (S.st.view !== "all" && !cards.some((c) => c.pk === S.st.view)) S.st.view = "all";
    const totalPeople = new Set([].concat(...Object.values(recs).map((r) => Object.keys(r.viewers)))).size;
    let ch = `<div class="igd-story ${S.st.view === "all" ? "on" : ""}" data-stview="all" tabindex="0" role="button" aria-pressed="${S.st.view === "all"}">
      <div class="th">${ic("users", 26)}</div>
      <div class="l1">Tüm hikayeler</div><div class="l2">${fmtN(totalPeople)} kişi kayıtlı</div></div>`;
    ch += cards.map((c) => {
      const tracked = c.live && (mode === "all" || sel.has(c.pk));
      const nViewers = c.polls ? Math.max(c.total || 0, c.order.length) : c.count || 0;
      return `<div class="igd-story ${S.st.view === c.pk ? "on" : ""} ${c.live ? "" : "gone"}" data-stview="${esc(c.pk)}" tabindex="0" role="button" aria-pressed="${S.st.view === c.pk}" aria-label="${esc(storyLabel(c))}">
        <div class="th">${c.thumb ? `<img src="${esc(c.thumb)}" alt="" loading="lazy" onerror="this.remove()"/>` : ""}${on && tracked ? `<span class="trk">${ic("eye", 11)} takipte</span>` : ""}</div>
        <div class="l1">${esc(c.taken ? fmtClock(c.taken) : "?")}${c.video ? " · video" : ""}</div>
        <div class="l2">${c.live ? esc(leftStr(c.exp)) : "süresi doldu"} · ${fmtN(nViewers)} izleyici</div>
        ${c.live && mode === "sel" ? `<label class="igd-chk" style="font-size:12px;"><input type="checkbox" data-sttrack="${esc(c.pk)}" ${sel.has(c.pk) ? "checked" : ""}/> Takip et</label>`
          : c.live && !(on && mode === "sel" && sel.size === 1 && sel.has(c.pk)) ? `<button class="igd-btn sm ghost" data-stonly="${esc(c.pk)}" style="padding:3px 6px;">Yalnızca bunu takip et</button>` : ""}
      </div>`;
    }).join("");
    if (!cards.length) ch += `<div class="igd-note" style="align-self:center;padding:0 10px;">${S.st.active ? "Şu an aktif hikayen yok. Takibi başlatırsan paylaştığın yeni hikayeler kendiliğinden takibe alınır." : isLoggedIn() ? '<span class="igd-spin"></span> Hikayeler okunuyor…' : "Hikayeleri görmek için Instagram'da oturum açmalısın."}</div>`;
    $("igd-st-cards").innerHTML = ch;

    const logN = stLogVisible().filter((e) => e.k === "new" || e.k === "again").length;
    $("igd-st-tabs").innerHTML = [["viewers", "İzleyiciler", stViewers().length], ["log", "Günlük", logN]]
      .map(([k, l, n]) => `<button class="igd-tab ${S.st.tab === k ? "on" : ""}" data-sttab="${k}">${l} <span class="c">${fmtN(n)}</span></button>`).join("");
    updateStoriesList();
  }

  function updateStoriesList() {
    const box = $("igd-st-list"); if (!box || !S.st.data) return;
    box.onclick = (e) => { const s = e.target.closest("[data-sb]"); if (s) sb(s.dataset.sb); };
    const hasData = Object.keys(S.st.data.stories).length > 0;
    if (S.st.tab === "log") {
      S.st.vis = stLogVisible();
      if (!S.st.vis.length) setListContent(box, emptyCard({ compact: true, icon: "clock", title: hasData ? "Kayıt yok" : "Henüz kayıt yok", html: hasData ? "" : "<p>Takibi başlattığında yeni bakanlar ve tekrar bakanlar burada zaman aralığıyla listelenir.</p>" }));
      else mountVList(box, S.st.vis, stLogRow);
      return;
    }
    S.st.vis = stViewers();
    if (S.st.vis.length) { mountVList(box, S.st.vis, stViewerRow); return; }
    setListContent(box, hasData && S.st.q ? emptyCard({ compact: true, icon: "search", title: "Eşleşen izleyici yok" })
      : emptyCard({ icon: "eye", title: "Hikayene kimler, kaç kez bakıyor?",
        html: `<p><b>Takibi başlat</b>'a bas → o anki izleyicilerin temel alınır, sonra her ${stIntervalMin()} dakikada bir liste yeniden okunur.</p>
          <p>Yeni bakanlar ve <b>tekrar bakanlar</b> zaman aralığıyla günlüğe yazılır; her kişinin kaç kez baktığı burada görünür.</p>
          <p>Yalnızca bir hikayeyi izlemek için kartındaki <b>Yalnızca bunu takip et</b>'e bas ya da <b>Seçili hikayeler</b>'e geçip işaretle.</p>`,
        note: "İstediğin an durdurabilirsin; kayıtlar silinmez. Süresi dolan hikayelerin kayıtları 30 gün saklanır." }));
  }

  function stExport() {
    const recs = (S.st.data && S.st.data.stories) || {};
    const scope = S.st.view === "all" ? "tum" : "hikaye-" + hhmm(recs[S.st.view] && recs[S.st.view].taken || 0).replace(":", "");
    if (S.st.tab === "log") {
      const list = stLogVisible().filter((e) => e.k === "new" || e.k === "again");
      if (!list.length) { toast("Dışa aktarılacak kayıt yok.", true); return; }
      const rows = list.map((e) => [fmtDate(e.from), fmtDate(e.t), e.k === "again" ? "tekrar baktı" : "baktı", e.u, e.n, storyLabel(recs[e.s])]);
      const name = `hikaye-gunlugu-${scope}-${stampNow()}.csv`;
      saveTextFile(name, toCSV(["aralik_bas", "aralik_son", "olay", "hesap", "kacinci_bakis", "hikaye"], rows), "Hikaye günlüğü dışa aktarıldı", `${list.length} kayıt Downloads/${name} dosyasına kaydedildi ✓`);
      return;
    }
    const list = stViewers();
    if (!list.length) { toast("Dışa aktarılacak izleyici yok.", true); return; }
    const rows = list.map((v) => [v.u, v.n, v.views, v.stories, fmtWin(v.first, v.firstTo), fmtWin(v.last, v.lastTo)]);
    const name = `hikaye-izleyicileri-${scope}-${stampNow()}.csv`;
    saveTextFile(name, toCSV(["kullanici_adi", "isim", "bakis_sayisi", "hikaye_sayisi", "ilk_bakis", "son_bakis"], rows), "Hikaye izleyicileri dışa aktarıldı", `${list.length} kişi Downloads/${name} dosyasına kaydedildi ✓`);
  }

  async function stClear() {
    const ok = await askConfirm({
      title: "Hikaye kayıtları silinsin mi?",
      html: "<p>Tüm hikayelerin izleyici sayıları ve günlük silinir. Takip açıksa bir sonraki kontrolde o anki izleyiciler yeniden temel alınır.</p><p class=\"igd-note\">Instagram'da hiçbir şey değişmez.</p>",
      danger: true, okLabel: "Sil",
    });
    if (!ok) return;
    if (STW() && STW().busy()) { toast("Şu an bir kontrol sürüyor; birazdan tekrar dene.", true); return; }
    await withLock(K.stories, () => DB.del(K.stories)).catch(() => {});
    await stReload(); render(); toast("Hikaye kayıtları silindi.");
  }
