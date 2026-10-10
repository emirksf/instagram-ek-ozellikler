
  // ================================================================ DM'lerim sayfası
  function buildDMPage(page) {
    page.innerHTML = `
      <div class="igd-sources" id="igd-sources"></div>
      <div class="igd-toolbar">
        <div class="igd-search" style="max-width:280px;">${ic("user")}<input id="igd-dm-find" placeholder="Kişiyle sohbeti bul (kullanıcı adı)" aria-label="Kişiyle sohbeti bul: kullanıcı adı" autocomplete="off"/></div>
        <button class="igd-btn" id="igd-dm-findbtn">Getir</button>
        <div class="igd-search">${ic("search")}<input id="igd-dm-q" placeholder="Yüklü sohbetlerde ara..." aria-label="Yüklü sohbetlerde ara" autocomplete="off" value="${esc(S.dmQuery)}"/></div>
        <select id="igd-dm-filter" class="igd-sel" aria-label="Sohbet süzgeci">${DM_FILTERS.map(([v, l]) => `<option value="${v}" ${S.dmFilter === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <label class="igd-chk"><input type="checkbox" id="igd-dm-backup" ${lsGet("igd_dm_backup", "0") === "1" ? "checked" : ""}/> Geri çekmeden önce yedekle</label>
        <button class="igd-btn danger" id="igd-dm-del" disabled>Seçilenleri sil (0)</button>
      </div>
      <div class="igd-listhead" id="igd-dm-head"></div>
      <div class="igd-list" id="igd-dm-list" role="list" aria-label="Sohbetler"></div>`;
    $("igd-dm-find").onkeydown = (e) => { if (e.key === "Enter") dmFindPerson(); };
    $("igd-dm-findbtn").onclick = dmFindPerson;
    $("igd-dm-q").oninput = (e) => { S.dmQuery = e.target.value.trim(); S.dmLastIdx = -1; render(); };
    $("igd-dm-filter").onchange = (e) => { S.dmFilter = e.target.value; S.dmSel.clear(); S.dmLastIdx = -1; render(); };
    $("igd-dm-backup").onchange = (e) => lsSet("igd_dm_backup", e.target.checked ? "1" : "0");
    $("igd-dm-del").onclick = deleteDMs;
    $("igd-dm-list").onclick = onDMClick;
  }

  function dmRowHtml(t, i) {
    const sel = S.dmSel.has(t.id);
    const u0 = t.users[0] || {};
    const title = t.group ? esc(t.title || "Grup") : `@${esc(u0.username || t.title || "?")}`;
    return `<div class="igd-item ${sel ? "sel" : ""}" data-i="${i}" data-tid="${esc(t.id)}" role="listitem">
      <input type="checkbox" class="igd-cb" aria-label="${title} sohbetini seç" ${sel ? "checked" : ""}/>
      <img class="igd-ava" src="${esc(u0.pic || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
      <div class="igd-meta">
        <div class="igd-name">${t.group ? ic("users", 14) : ""}${title}${t.group ? '<span class="igd-tag">Grup</span>' : ""}</div>
        <div class="igd-dmdate">${dmThreadDate(t.act)}</div>
      </div>
      <div class="igd-actions">
        <button class="igd-mini" data-retract="${esc(t.id)}" title="Bu sohbette gönderdiğin mesajları geri çek (iki taraftan siler)" aria-label="${title}: gönderdiğim mesajları geri çek">${ic("undo", 13)} Mesajlarım</button>
      </div>
    </div>`;
  }

  function onDMClick(e) {
    const t = e.target;
    const btn = t.closest("button");
    if (btn) {
      if (btn.dataset.retract) retractMessages(btn.dataset.retract);
      else if (btn.dataset.cta) runCta(btn.dataset.cta);
      return;
    }
    const row = t.closest(".igd-item[data-tid]"); if (!row) return;
    const i = +row.dataset.i, th = S.dmVis[i]; if (!th) return;
    const want = t.matches("input.igd-cb") ? t.checked : !S.dmSel.has(th.id);
    if (e.shiftKey && S.dmLastIdx >= 0 && S.dmLastIdx < S.dmVis.length) {
      const lo = Math.min(S.dmLastIdx, i), hi = Math.max(S.dmLastIdx, i);
      for (let k = lo; k <= hi; k++) { const id = S.dmVis[k].id; if (want) S.dmSel.add(id); else S.dmSel.delete(id); }
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    } else if (want) S.dmSel.add(th.id); else S.dmSel.delete(th.id);
    S.dmLastIdx = i;
    drawVList($("igd-dm-list"), true);
    renderDMHead();
  }

  function renderDMHead() {
    const el = $("igd-dm-head"); if (!el) return;
    const btn = $("igd-dm-del");
    const n = S.dmSel.size;
    if (btn) { btn.disabled = n === 0 || isBusy(); btn.textContent = `Seçilenleri sil (${n})`; }
    if (!S.dmThreads.length) { el.innerHTML = ""; return; }
    const vis = S.dmVis;
    const all = vis.length > 0 && vis.every((t) => S.dmSel.has(t.id));
    el.innerHTML = `<div class="igd-selbar">
      <label class="igd-chk"><input type="checkbox" class="igd-cb" id="igd-dm-all" ${all ? "checked" : ""} ${vis.length ? "" : "disabled"}/> Tümünü seç</label>
      <span>${fmtN(S.dmThreads.length)} sohbet yüklü · ${fmtN(vis.length)} görünüyor${n ? ` · <b>${fmtN(n)} seçili</b>` : ""}</span>
      <span class="igd-sp"></span><span class="igd-note">Silme kalıcıdır · Shift+tık: aralık seç</span></div>`;
    $("igd-dm-all").onchange = (e) => {
      if (e.target.checked) vis.forEach((t) => S.dmSel.add(t.id)); else vis.forEach((t) => S.dmSel.delete(t.id));
      S.dmLastIdx = -1; render();
    };
  }

  function updateDMPage() {
    renderSources();
    S.dmVis = dmVisible();
    const vis = new Set(S.dmVis.map((t) => t.id));
    [...S.dmSel].forEach((id) => { if (!vis.has(id)) S.dmSel.delete(id); });
    renderDMHead();
    const box = $("igd-dm-list");
    if (!S.dmThreads.length) {
      setListContent(box, emptyCard({ icon: "message", title: "Sohbetlerini yönet",
        html: `<p><b>Tek bir kişi:</b> yukarıdaki “Kişiyle sohbeti bul” kutusuna kullanıcı adını yaz ve <b>Getir</b>'e bas — tüm kutuyu taramadan o sohbeti getirir.</p>
          <p><b>Tüm kutu:</b> topluca süzmek ve silmek için DM kutunu tara.</p>`,
        actions: [{ label: "DM kutusunu tara", cta: "dm", primary: true, icon: "refresh" }],
        note: "Mesaj içeriği okunmaz; yalnızca sohbet listesi ve tarihler. Geri çekerken istersen kendi mesajların yedeklenir." }));
    } else if (!S.dmVis.length) setListContent(box, emptyCard({ compact: true, icon: "search", title: "Bu süzgece uyan sohbet yok" }));
    else mountVList(box, S.dmVis, dmRowHtml);
  }

  // ================================================================ Profil İzleme sayfası
  function buildProfilePage(page) {
    page.innerHTML = `
      <div class="igd-toolbar">
        <div class="igd-search">${ic("search")}<input id="igd-pf-user" placeholder="Kullanıcı adı (örn: nasa)" aria-label="İzlenecek kullanıcı adı" autocomplete="off"/></div>
        <button class="igd-btn primary" id="igd-pf-get">Getir</button>
        <label class="igd-chk"><input type="checkbox" id="igd-pf-rev" ${S.pfReverse ? "checked" : ""}/> Sırayı ters çevir</label>
        <button class="igd-btn" id="igd-pf-watch" disabled>${ic("bell")} İzle</button>
        <button class="igd-btn" id="igd-pf-check" title="İzlenen hesapları beklemeden şimdi kontrol et">${ic("refresh")} Şimdi kontrol et</button>
        <label class="igd-chk">Aralık <input type="number" id="igd-pf-int" min="5" max="720" value="${Math.max(5, parseInt(lsGet("igd_pf_interval", "5"), 10))}" class="igd-num" style="width:64px;" aria-label="Kontrol aralığı (dakika)"/> dk</label>
      </div>
      <div class="igd-scroll" id="igd-pf-body" style="padding:0 20px 20px;"></div>`;
    $("igd-pf-get").onclick = () => pfGet();
    $("igd-pf-user").onkeydown = (e) => { if (e.key === "Enter") pfGet(); };
    $("igd-pf-rev").onchange = (e) => { S.pfReverse = e.target.checked; render(); };
    $("igd-pf-watch").onclick = pfToggleWatch;
    $("igd-pf-check").onclick = pfCheckNow;
    $("igd-pf-int").onchange = (e) => {
      const v = Math.max(5, Math.min(720, parseInt(e.target.value || "5", 10)));
      e.target.value = v;
      lsSet("igd_pf_interval", String(v));
      if (window.__igdWatch && window.__igdWatch.restartPfTimer) window.__igdWatch.restartPfTimer();
      toast(`İzleme aralığı ${v} dk yapıldı.`);
    };
    $("igd-pf-body").onclick = (e) => {
      const t = e.target;
      const rm = t.closest("[data-pfrm]");
      if (rm) { e.stopPropagation(); pfRemove(rm.dataset.pfrm); toast("İzleme bırakıldı."); render(); return; }
      const op = t.closest("[data-pfopen]");
      if (op) { const inp = $("igd-pf-user"); if (inp) inp.value = op.dataset.pfopen; pfGet(op.dataset.pfopen); return; }
      const s = t.closest("[data-sb]"); if (s) sb(s.dataset.sb);
    };
  }

  function updateProfilePage() {
    const c = $("igd-pf-body"); if (!c) return;
    const watches = pfList();
    let html = `<div class="igd-bar2" style="margin-top:2px;">${ic("bell", 14)} İzlenen hesaplar: ${watches.length
      ? `<span class="igd-chips">${watches.map((a) => `<span class="igd-tag" style="display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 9px;font-size:12px;">
          <button class="igd-btn sm ghost" style="padding:0;" data-pfopen="${esc(a.username)}" title="${a.nf !== false ? "yeni takip" : ""}${a.nf !== false && a.uf !== false ? " + " : ""}${a.uf !== false ? "bırakma" : ""} bildirimi">@${esc(a.username)}</button>
          <button class="igd-btn sm ghost" style="padding:1px 4px;" data-pfrm="${esc(a.id)}" aria-label="@${esc(a.username)} izlemesini bırak" title="İzlemeyi bırak">${ic("x", 12)}</button></span>`).join("")}</span>`
      : "<span style='color:var(--igd-muted)'>yok</span>"}</div>`;

    if (S.pfUser && S.pfFollowing) {
      const watched = pfIsWatched(S.pfUser.id);
      if (watched) {
        const log = pfLog(S.pfUser.id);
        html += `<div class="igd-secbar">İzlemeye aldıktan sonraki hareketler (tarihli, kesin)</div>`;
        html += log.length
          ? log.slice(0, 80).map((e) => {
            const uf = e.type === "unfollow";
            return `<div class="igd-item">
              <div style="width:30px;text-align:center;color:${uf ? "var(--igd-dtx)" : "var(--igd-ok)"};">${ic(uf ? "x" : "check", 16)}</div>
              <div class="igd-meta"><div class="igd-name"><a href="https://www.instagram.com/${esc(e.u)}/" target="_blank">@${esc(e.u)}</a>
                <span class="igd-tag ${uf ? "dm never" : ""}">${uf ? "takibi bıraktı" : "takip etti"}</span></div>
                <div class="igd-full">${esc(fmtDate(e.t))}</div></div>
              <div class="igd-actions"><button class="igd-mini icon" data-sb="${esc(e.u)}" aria-label="@${esc(e.u)} SocialBlade" title="SocialBlade">${ic("trend", 14)}</button></div>
            </div>`;
          }).join("")
          : emptyCard({ compact: true, icon: "bell", title: "Henüz hareket yok", html: "<p>Bu hesap birini takip ettiğinde ya da bıraktığında burada tarihiyle görünecek (uygulama açık ya da menü çubuğunda olmalı).</p>" });
      }
      html += `<div class="igd-secbar">@${esc(S.pfUser.username)} şu an takip ediyor (${fmtN(S.pfFollowing.length)})</div>
        <div class="igd-note" style="padding:0 14px 8px;">Sıra Instagram'ın verdiği sıradır, <b>kesin kronolojik değildir</b>. Kesin ve tarihli sonuç için 🔔 İzle'yi kullan.</div>`;
      let list = S.pfFollowing.slice();
      if (S.pfReverse) list = list.reverse();
      html += list.map((u, i) => `<div class="igd-item">
        <div style="width:30px;text-align:center;color:var(--igd-muted);font-size:12px;">${i + 1}</div>
        <img class="igd-ava" src="${esc(u.profile_pic_url || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
        <div class="igd-meta"><div class="igd-name"><a href="https://www.instagram.com/${esc(u.username)}/" target="_blank">@${esc(u.username)}</a>${u.is_verified ? `<span class="badge">${ic("check", 13)}</span>` : ""}</div><div class="igd-full">${esc(u.full_name)}</div></div>
        <div class="igd-actions"><button class="igd-mini icon" data-sb="${esc(u.username)}" aria-label="@${esc(u.username)} SocialBlade" title="SocialBlade">${ic("trend", 14)}</button></div>
      </div>`).join("");
    } else {
      html += emptyCard({ icon: "eye", title: "Bir profilin takip hareketlerini izle",
        html: `<p><b>1.</b> Yukarıya bir kullanıcı adı yaz ve <b>Getir</b>'e bas → o hesabın şu an kimleri takip ettiğini görürsün.</p>
          <p><b>2.</b> <b>İzle</b> dersen, o andan itibaren biri takip edildiğinde ya da bırakıldığında bildirim gelir; hepsi burada tarihiyle listelenir.</p>`,
        note: "Instagram geçmiş takip sırasını kesin vermediği için izlemeden önceki sıra yaklaşıktır. Yalnızca herkese açık ya da senin takip ettiğin hesaplar." });
    }
    c.innerHTML = html;
    const wb = $("igd-pf-watch");
    if (wb) {
      if (S.pfUser) { wb.disabled = false; const on = pfIsWatched(S.pfUser.id); wb.innerHTML = `${ic("bell")} ${on ? "İzlemeyi bırak" : "İzle"}`; wb.classList.toggle("primary", !on); }
      else { wb.disabled = true; wb.innerHTML = `${ic("bell")} İzle`; wb.classList.remove("primary"); }
    }
  }

  // ================================================================ Rapor sayfası
  function buildReportPage(page) {
    page.innerHTML = `
      <div class="igd-toolbar">
        <button class="igd-btn primary" id="igd-rep-run">${ic("report")} Raporu oluştur</button>
        <label class="igd-chk"><input type="checkbox" id="igd-rep-auto" ${lsGet("igd_report_auto", "0") === "1" ? "checked" : ""}/> Ayda bir otomatik (uygulama açıkken)</label>
        <span class="igd-note">Takipçi listenin tamamını önceki raporla karşılaştırır.</span>
      </div>
      <div class="igd-scroll" id="igd-rep-body" style="padding:0 20px 20px;"></div>`;
    $("igd-rep-run").onclick = generateReport;
    $("igd-rep-auto").onchange = (e) => {
      const on = e.target.checked;
      lsSet("igd_report_auto", on ? "1" : "0");
      if (on) {
        if (!loadReportSnap()) toast("Önce bir kez “Raporu oluştur” ile temel oluştur; sonra ayda bir otomatik çalışır.", true);
        else toast("Aylık otomatik rapor açıldı.");
        if (window.__igdWatch && window.__igdWatch.ensureTimer) window.__igdWatch.ensureTimer();
      } else toast("Aylık otomatik rapor kapatıldı.");
    };
    $("igd-rep-body").onclick = (e) => {
      const s = e.target.closest("[data-sb]"); if (s) sb(s.dataset.sb);
      const c = e.target.closest("[data-cta]"); if (c) runCta(c.dataset.cta);
    };
  }

  function updateReportPage() {
    const c = $("igd-rep-body"); if (!c) return;
    const rb = $("igd-rep-run"); if (rb) rb.disabled = isBusy();
    const r = loadReportLast();
    const snap = loadReportSnap();
    if (!r) {
      c.innerHTML = emptyCard({ icon: "report", title: "Henüz rapor yok",
        html: "<p>İlk rapor temel alınır. <b>Bir sonraki</b> raporda iki tarama arasında <b>gelen ve ayrılan</b> takipçiler isim isim listelenir.</p>",
        actions: [{ label: "Raporu oluştur", cta: "report", primary: true, icon: "report" }],
        note: "Rapor için tüm takipçilerin taranır; başlamadan önce kaç kişi olduğunu ve tahmini süreyi gösteririm." });
      return;
    }
    if (r.baseline) {
      c.innerHTML = emptyCard({ icon: "check", title: "İlk rapor temel alındı",
        html: `<p>${esc(fmtDate(r.t))} · ${snap ? fmtN(Object.keys(snap.map).length) : 0} takipçi.</p><p>Bundan sonraki raporda gelen/ayrılan farkları çıkacak.</p>` });
      return;
    }
    const section = (title, arr, icon, color) => {
      if (!arr.length) return `<div class="igd-secbar">${title} (0)</div>` + emptyCard({ compact: true, title: "Yok" });
      return `<div class="igd-secbar">${title} (${arr.length})</div>` + arr.slice().sort((a, b) => coll.compare(a.username, b.username)).map((u) =>
        `<div class="igd-item"><div style="width:30px;text-align:center;color:${color};">${ic(icon, 16)}</div>
          <div class="igd-meta"><div class="igd-name"><a href="https://www.instagram.com/${esc(u.username)}/" target="_blank">@${esc(u.username)}</a></div></div>
          <div class="igd-actions"><button class="igd-mini icon" data-sb="${esc(u.username)}" aria-label="@${esc(u.username)} SocialBlade" title="SocialBlade">${ic("trend", 14)}</button></div></div>`).join("");
    };
    c.innerHTML = `<div class="igd-bar2"><span>Bu rapor: <b>${esc(fmtDate(r.t))}</b> · önceki: ${r.prevT ? esc(fmtDate(r.prevT)) : "—"}</span>
        <span class="igd-sp"></span><span><b style="color:var(--igd-ok);">+${r.gained.length}</b> gelen · <b style="color:var(--igd-dtx);">-${r.lost.length}</b> ayrılan</span></div>` +
      section("Gelen takipçiler", r.gained, "check", "var(--igd-ok)") + section("Ayrılan takipçiler", r.lost, "x", "var(--igd-dtx)");
  }

  // ================================================================ Ayarlar sayfası
  const PRIVACY_HTML = `<ul>
    <li><b>Şifreni görmez.</b> Giriş, Instagram'ın kendi gerçek sayfasında yapılır; bu uygulama yalnızca o sayfayı gösteren bir penceredir. Şifren uygulamaya yazılmaz, hiçbir yerde saklanmaz.</li>
    <li><b>Her şey bu Mac'te kalır.</b> Uygulamanın sunucusu yoktur; hiçbir bilgin internete ya da başka birine gönderilmez. Analizler kendi oturumunda, cihazında çalışır.</li>
    <li><b>Ne okur:</b> takip/takipçi listelerini Instagram'ın kendi arayüzünden çeker. DM bölümünde sohbet <b>listesini</b> ve tarihleri görür; mesaj içeriklerini okumaz — yalnızca sen “yedekle” dersen <b>kendi gönderdiğin</b> mesajların metnini Downloads klasörüne kaydeder.</li>
    <li><b>İşlemler senin komutunla:</b> takibi bırakma, takipçiden çıkarma, DM silme ve mesaj geri çekme yalnızca sen onayladığında ve kendi hesabınla yapılır.</li>
    <li><b>Sorumluluk sende:</b> araç Instagram'ın resmi olmayan uçlarını kullanır. Aşırı ya da hızlı kullanım hesabına geçici kısıtlama getirebilir (bu yüzden aralarda otomatik beklemeler var).</li>
  </ul>`;

  function buildSettingsPage(page) {
    page.innerHTML = `<div class="igd-scroll"><div class="igd-settings">
      <section class="igd-panel" aria-labelledby="igd-set-n">
        <h2 id="igd-set-n">${ic("bell")} Takipçi bildirimleri</h2>
        <div class="igd-nform">
          <label class="igd-chk"><input type="checkbox" id="ign-en"/> Beni takibi bırakanlar için bildirim gönder (arka planda)</label>
          <label class="igd-chk"><input type="checkbox" id="ign-new"/> Yeni takipçiler için de bildirim gönder</label>
          <label class="igd-chk"><input type="checkbox" id="ign-deep"/> Düşüş olunca <b>kimin</b> ayrıldığını da otomatik bul (ağır tarama — en fazla 3 saatte bir)</label>
          <label class="igd-chk">Kontrol aralığı <input type="number" id="ign-int" min="10" max="720" class="igd-num"/> dakika</label>
          <div class="igd-note" id="ign-info"></div>
        </div>
        <div class="row"><button class="igd-btn primary" id="ign-save">Kaydet</button><button class="igd-btn" id="ign-check">${ic("refresh")} Şimdi kontrol et</button></div>
      </section>
      <section class="igd-panel" aria-labelledby="igd-set-a">
        <h2 id="igd-set-a">${ic("sun")} Görünüm</h2>
        <div class="igd-seg" role="group" aria-label="Tema">
          <button id="igd-th-dark" aria-pressed="false">${ic("moon", 14)} Koyu</button><button id="igd-th-light" aria-pressed="false">${ic("sun", 14)} Açık</button>
        </div>
      </section>
      <section class="igd-panel" aria-labelledby="igd-set-w">
        <h2 id="igd-set-w">${ic("shield")} Koru listesi</h2>
        <div id="igd-wlinfo"></div>
      </section>
      <section class="igd-panel" aria-labelledby="igd-set-d">
        <h2 id="igd-set-d">${ic("alert")} Veriler</h2>
        <p class="igd-note">Tarama sonuçları bu Mac'te saklanır, böylece uygulamayı yeniden açınca kaldığın yerden devam edersin. Temizlemek Instagram hesabında hiçbir şeyi değiştirmez.</p>
        <div class="row"><button class="igd-btn danger" id="igd-clear">Tarama sonuçlarını temizle…</button></div>
      </section>
      <section class="igd-panel" id="igd-privacy" aria-labelledby="igd-set-p">
        <h2 id="igd-set-p">${ic("lock")} Gizlilik ve güvenlik</h2>
        ${PRIVACY_HTML}
        <div class="row"><button class="igd-btn" id="igd-onb-again">${ic("sparkle")} Tanıtımı yeniden göster</button></div>
      </section>
    </div></div>`;
    const W = () => window.__igdWatch;
    $("ign-en").checked = lsGet("igd_watch_enabled", "0") === "1";
    $("ign-new").checked = lsGet("igd_watch_newfollowers", "0") === "1";
    $("ign-deep").checked = lsGet("igd_watch_deep", "0") === "1";
    $("ign-int").value = parseInt(lsGet("igd_watch_interval", "30"), 10);
    $("ign-check").onclick = () => { if (W()) { W().checkNow(); toast("Kontrol başlatıldı..."); setTimeout(render, 4000); } else toast("İzleyici hazır değil, sayfayı yenileyin.", true); };
    $("ign-save").onclick = () => {
      const iv = Math.max(10, Math.min(720, parseInt($("ign-int").value || "30", 10)));
      $("ign-int").value = iv;
      lsSet("igd_watch_newfollowers", $("ign-new").checked ? "1" : "0");
      lsSet("igd_watch_deep", $("ign-deep").checked ? "1" : "0");
      lsSet("igd_watch_interval", String(iv));
      if (!W()) { toast("İzleyici hazır değil, sayfayı yenileyin.", true); return; }
      if ($("ign-en").checked) { W().start(); toast("Bildirimler açıldı ✓ (ilk kontrol temel alınır)"); }
      else { W().stop(); toast("Bildirimler kapatıldı."); }
      render();
    };
    $("igd-th-dark").onclick = () => setTheme(false);
    $("igd-th-light").onclick = () => setTheme(true);
    $("igd-clear").onclick = clearAll;
    $("igd-onb-again").onclick = () => openOnboarding(1);
  }

  function updateSettingsPage() {
    const W = window.__igdWatch;
    const last = W ? W.lastCheck() : 0, cnt = W ? W.count() : 0;
    const info = $("ign-info");
    if (info) info.innerHTML = `Durum: <b>${W && W.isOn() ? "açık" : "kapalı"}</b> · son kontrol: ${last ? esc(fmtDate(last)) : "henüz yok"} · son bilinen takipçi sayısı: ${cnt ? fmtN(cnt) : "—"}<br>
      Arka planda yalnızca <b>takipçi sayına</b> bakılır (tek küçük istek), tüm liste taranmaz — 30.000 takipçide bile Instagram'ı yormaz. Sayı düşünce net kaç kişi olduğu bildirilir; isimler için Takipçiler sayfasından tara.
      İzleyicinin çalışması için uygulama açık ya da menü çubuğunda kalmalı.`;
    const dk = $("igd-th-dark"), lt = $("igd-th-light");
    if (dk) { dk.classList.toggle("on", !isLight()); dk.setAttribute("aria-pressed", String(!isLight())); lt.classList.toggle("on", isLight()); lt.setAttribute("aria-pressed", String(isLight())); }
    const wl = $("igd-wlinfo");
    if (wl) {
      const known = [...S.whitelist].map((pk) => findUser(pk)).filter(Boolean);
      wl.innerHTML = `<p class="igd-note">Korunan hesaplar toplu “Takibi bırak” işlemlerinde atlanır ve seçilemez. Listedeki ${ic("shield", 12)} düğmesiyle eklenir.</p>
        <div class="row"><span><b>${fmtN(S.whitelist.size)}</b> hesap korunuyor.</span>
          ${S.whitelist.size ? `<button class="igd-btn sm danger" id="igd-wlclear">Tüm korumaları kaldır…</button>` : ""}</div>
        ${known.length ? `<div class="igd-chips" style="margin-top:10px;">${known.slice(0, 100).map((u) => `<span class="igd-tag wl" style="font-size:12px;padding:2px 8px;">@${esc(u.username)}</span>`).join("")}</div>` : ""}`;
      const b = $("igd-wlclear");
      if (b) b.onclick = async () => {
        const ok = await askConfirm({ title: "Tüm korumalar kaldırılsın mı?", html: `<p>${fmtN(S.whitelist.size)} hesabın koruması kalkar; toplu “Takibi bırak” işlemlerinde seçilebilir hâle gelirler.</p>`, danger: true, okLabel: "Korumaları kaldır" });
        if (!ok) return;
        S.whitelist.clear(); saveWhitelist(); render(); toast("Korumalar kaldırıldı.");
      };
    }
  }

  // ================================================================ Tanıtım (ilk açılış)
  const ONB_KEY = "igd_onboarded_v1";
  let onbStep = 0;
  function openOnboarding(step) { onbStep = step || 1; renderOnboarding(); }
  function closeOnboarding() { onbStep = 0; lsSet(ONB_KEY, "1"); try { sessionStorage.removeItem("igd_onb_login"); } catch (e) {} const o = $("igd-onb"); if (o) o.remove(); render(); }
  function renderOnboarding() {
    const root = $("igd-root"); if (!root || !onbStep) return;
    let o = $("igd-onb");
    if (!o) { o = document.createElement("div"); o.id = "igd-onb"; o.className = "igd-onb"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-labelledby", "igd-onb-t"); root.appendChild(o); }
    const steps = `<div class="igd-onb-steps" aria-label="Adım ${onbStep} / 3">${[1, 2, 3].map((i) => `<i class="${i <= onbStep ? "on" : ""}"></i>`).join("")}</div>`;
    let body = "";
    if (onbStep === 1) {
      const li = isLoggedIn();
      body = `<h2 id="igd-onb-t">Hoş geldin 👋</h2>
        <p>Bu uygulama Instagram hesabını analiz eder: seni geri takip etmeyenleri, hayranlarını, şüpheli takipçileri ve uzun süredir yazışmadıklarını bulur; istediklerini topluca yönetirsin.</p>
        <ul>
          <li>${ic("lock")}<span><b>Şifreni görmez, verin bu Mac'te kalır.</b> Giriş Instagram'ın kendi sayfasında yapılır; hiçbir sunucuya veri gönderilmez.</span></li>
          <li>${ic("shield")}<span><b>Hiçbir işlem sen onaylamadan yapılmaz.</b> Aralarda hesabını koruyan otomatik beklemeler var.</span></li>
        </ul>
        ${li ? `<div class="igd-okline">${ic("check")} Instagram oturumun açık.</div>` : `<p class="igd-note">Başlamak için Instagram'da giriş yapman gerekiyor. Giriş yapınca bu ekran kendiliğinden geri gelir.</p>`}
        <div class="igd-onb-foot">
          <button class="igd-btn ghost" id="igd-onb-skip">Tanıtımı atla</button><span class="igd-sp"></span>
          ${li ? `<button class="igd-btn primary" id="igd-onb-next">Devam</button>` : `<button class="igd-btn primary" id="igd-onb-login">${ic("instagram")} Instagram'da giriş yap</button>`}
        </div>`;
    } else if (onbStep === 2) {
      body = `<h2 id="igd-onb-t">İlk tarama</h2>
        <p>Her şey üç veri kaynağından beslenir. Hepsini birden taramak gerekmez; ihtiyaç duydukça ayrı ayrı tararsın.</p>
        <ul>
          <li>${ic("users")}<span><b>Takip listesi</b> (1–2 dk) — geri takip etmeyenler, karşılıklılar.</span></li>
          <li>${ic("user")}<span><b>Takipçiler</b> (takipçi sayına göre uzun) — hayranlar, şüpheli/bot hesaplar, aylık rapor.</span></li>
          <li>${ic("message")}<span><b>DM kutusu</b> — etkileşimsizler ve DM'lerim.</span></li>
        </ul>
        <p class="igd-note">Taramalar alttaki işlem tepsisinde sürer; bu sırada uygulamayı kullanmaya devam edebilir, istediğin an durdurabilirsin.</p>
        <div class="igd-onb-foot">
          <button class="igd-btn ghost" id="igd-onb-back">${ic("arrowleft")} Geri</button><span class="igd-sp"></span>
          <button class="igd-btn" id="igd-onb-next">Şimdilik atla</button>
          <button class="igd-btn primary" id="igd-onb-scan" ${isLoggedIn() ? "" : "disabled"}>${ic("refresh")} Takip listemi tara</button>
        </div>`;
    } else {
      body = `<h2 id="igd-onb-t">Neler var?</h2>
        <ul>
          <li>${ic("analysis")}<span><b>Analiz</b> — geri takip etmeyenler, karşılıklılar, etkileşimsizler; seç ve topluca takibi bırak.</span></li>
          <li>${ic("users")}<span><b>Takipçiler</b> — hayranların ve şüpheli/bot takipçiler.</span></li>
          <li>${ic("message")}<span><b>DM'lerim</b> — eski sohbetleri sil, gönderdiğin mesajları geri çek.</span></li>
          <li>${ic("eye")}<span><b>Profil İzleme</b> — başka bir hesabın takip/bırakma hareketlerinden haberdar ol.</span></li>
          <li>${ic("report")}<span><b>Rapor</b> — iki tarama arasında gelen ve ayrılan takipçiler.</span></li>
          <li>${ic("settings")}<span><b>Ayarlar</b> — bildirimler, tema, koru listesi ve gizlilik.</span></li>
        </ul>
        <p class="igd-note">Instagram'ın kendisine kenar çubuğundaki “Instagram'ı aç” ile geçebilir, üstteki düğmeyle panele dönebilirsin.</p>
        <div class="igd-onb-foot">
          <button class="igd-btn ghost" id="igd-onb-back">${ic("arrowleft")} Geri</button><span class="igd-sp"></span>
          <button class="igd-btn primary" id="igd-onb-done">Başla</button>
        </div>`;
    }
    o.innerHTML = `<div class="igd-onb-card">${steps}${body}</div>`;
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
    on("igd-onb-skip", closeOnboarding);
    on("igd-onb-next", () => { onbStep++; renderOnboarding(); });
    on("igd-onb-back", () => { onbStep--; renderOnboarding(); });
    on("igd-onb-login", () => { try { sessionStorage.setItem("igd_onb_login", "1"); } catch (e) {} showInstagram(); });
    on("igd-onb-scan", () => { onbStep = 3; renderOnboarding(); runScan(); });
    on("igd-onb-done", closeOnboarding);
    const f = o.querySelector(".igd-btn.primary:not(:disabled)") || o.querySelector(".igd-btn");
    if (f) f.focus();
  }

  // ================================================================ çerçeve: kenar çubuğu + sayfalar
  const PAGES = {
    analysis:  { label: "Analiz",        icon: "analysis", title: "Analiz",        sub: "Takip ettiklerin: kim geri takip ediyor, kimle etkileşimin yok", build: buildListPage,     update: updateListPage },
    followers: { label: "Takipçiler",    icon: "users",    title: "Takipçiler",    sub: "Seni takip edenler: hayranların ve şüpheli hesaplar",             build: buildListPage,     update: updateListPage },
    dm:        { label: "DM'lerim",      icon: "message",  title: "DM'lerim",      sub: "Sohbetlerini yönet: topluca sil, gönderdiğin mesajları geri çek", build: buildDMPage,       update: updateDMPage },
    profile:   { label: "Profil İzleme", icon: "eye",      title: "Profil İzleme", sub: "Başka bir hesabın takip ettikleri ve takip/bırakma bildirimleri", build: buildProfilePage,  update: updateProfilePage },
    report:    { label: "Rapor",         icon: "report",   title: "Takipçi raporu", sub: "İki tarama arasında gelen ve ayrılan takipçiler",                build: buildReportPage,   update: updateReportPage },
    settings:  { label: "Ayarlar",       icon: "settings", title: "Ayarlar",       sub: "Bildirimler, görünüm, koru listesi ve gizlilik",                 build: buildSettingsPage, update: updateSettingsPage },
  };

  const SHELL = `
    <nav class="igd-side" aria-label="Bölümler">
      <div class="igd-brandrow">
        <div class="igd-logo igd-grad" aria-hidden="true">${ic("analysis", 18)}</div>
        <div class="igd-brand"><b>Instagram Takip Denetimi</b><small>Emir Kosif · v2.0</small></div>
      </div>
      ${Object.keys(PAGES).map((k) => (k === "settings" ? `<div class="igd-sp"></div>` : "") +
        `<button class="igd-nav" data-sec="${k}" title="${PAGES[k].label}">${ic(PAGES[k].icon, 18)}<span class="lbl">${PAGES[k].label}</span></button>`).join("")}
      <div class="igd-navsep"></div>
      <button class="igd-nav" id="igd-igbtn" title="Instagram'ı aç">${ic("instagram", 18)}<span class="lbl">Instagram'ı aç</span></button>
      <button class="igd-nav" id="igd-themebtn" title="Temayı değiştir"></button>
    </nav>
    <main class="igd-main">
      <header class="igd-pagehdr"><div><h1 id="igd-ptitle"></h1><small id="igd-psub"></small></div></header>
      <div id="igd-loginbar"></div>
      <div class="igd-page" id="igd-page"></div>
      <div class="igd-tray" id="igd-tray"></div>
    </main>`;

  function setSection(sec) {
    if (!PAGES[sec]) sec = "analysis";
    const changed = S.section !== sec;
    S.section = sec;
    if (sec === "analysis" || sec === "followers") {
      const want = S.catBySec[sec];
      if (S.cat !== want) { S.cat = want; S.selected.clear(); S.lastSelIdx = -1; }
    }
    lsSet("igd_section", sec);
    if (changed) S._built = null;
    render();
  }

  function renderSideState() {
    document.querySelectorAll(".igd-nav[data-sec]").forEach((b) => {
      const on = b.dataset.sec === S.section;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      // Bu bölümün işi sürüyorsa nokta göster
      const j = S.job, runningHere = j && !j.finished && (
        (b.dataset.sec === "dm" && S.dmBusy) || (b.dataset.sec === "profile" && S.pfBusy) ||
        (b.dataset.sec === "followers" && S.followersLoading) || (b.dataset.sec === "analysis" && S.running && !S.followersLoading));
      let dot = b.querySelector(".dot");
      if (runningHere && !dot) { dot = document.createElement("span"); dot.className = "dot"; dot.setAttribute("aria-label", "işlem sürüyor"); b.appendChild(dot); }
      else if (!runningHere && dot) dot.remove();
    });
  }

  function render() {
    if (!$("igd-root")) return;
    const p = PAGES[S.section];
    const page = $("igd-page");
    if (S._built !== S.section) {
      page.innerHTML = "";
      p.build(page);
      S._built = S.section;
      $("igd-ptitle").textContent = p.title;
      $("igd-psub").textContent = p.sub;
    }
    const lb = $("igd-loginbar");
    if (lb) lb.innerHTML = !isLoggedIn() && !onbStep
      ? `<div class="igd-loginbar">${ic("alert", 14)} Instagram oturumu açık değil — tarama ve işlemler için giriş yapmalısın.<span class="igd-sp"></span><button class="igd-btn sm" id="igd-loginbtn">Instagram'da giriş yap</button></div>`
      : "";
    const lbb = $("igd-loginbtn"); if (lbb) lbb.onclick = showInstagram;
    p.update();
    renderSideState();
    renderTray();
  }

  // ================================================================ panel ⇄ Instagram görünümü
  function setView(v) { try { sessionStorage.setItem("igd_view", v); } catch (e) {} }
  function getView() { try { return sessionStorage.getItem("igd_view") || "panel"; } catch (e) { return "panel"; } }

  function showPanel(section) {
    ensureUI();
    const root = $("igd-root"), fab = $("igd-fab");
    root.style.display = "flex";
    if (fab) fab.style.display = "none";
    setView("panel");
    if (section) {
      const [sec, anchor] = String(section).split("#");
      if (PAGES[sec]) setSection(sec);
      if (anchor) setTimeout(() => { const a = $("igd-" + anchor); if (a) a.scrollIntoView({ block: "start" }); }, 30);
    } else render();
    // Giriş için Instagram'a gidilmişse tanıtım kaldığı yerden sürsün
    let resumeOnb = false; try { resumeOnb = sessionStorage.getItem("igd_onb_login") === "1"; } catch (e) {}
    if (resumeOnb && isLoggedIn()) { try { sessionStorage.removeItem("igd_onb_login"); } catch (e) {} openOnboarding(2); }
  }
  function showInstagram() {
    ensureUI();
    $("igd-root").style.display = "none";
    $("igd-fab").style.display = "inline-flex";
    setView("ig");
  }

  // ================================================================ açılış
  let ROOT = null, FAB = null;
  // Panel öğeleri sayfadan koparıldıysa (Instagram gövdeyi yeniden kurarsa) aynı öğeleri geri takar.
  function ensureUI() {
    if (!$("igd-style")) {
      const style = document.createElement("style"); style.id = "igd-style"; style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }
    if (ROOT) {
      if (!ROOT.isConnected) document.body.appendChild(ROOT);
      if (!FAB.isConnected) document.body.appendChild(FAB);
      return;
    }
    const root = ROOT = document.createElement("div"); root.id = "igd-root"; root.innerHTML = SHELL;
    document.body.appendChild(root);
    const fab = FAB = document.createElement("button");
    fab.id = "igd-fab"; fab.type = "button";
    fab.innerHTML = `${ic("analysis", 15)} Denetim paneline dön`;
    fab.setAttribute("aria-label", "Denetim paneline dön");
    fab.onclick = () => showPanel();
    document.body.appendChild(fab);

    root.querySelectorAll(".igd-nav[data-sec]").forEach((b) => b.onclick = () => setSection(b.dataset.sec));
    $("igd-igbtn").onclick = showInstagram;
    $("igd-themebtn").onclick = () => setTheme(!isLight());
    if (!window.__igdEsc) { window.__igdEsc = true; document.addEventListener("keydown", onEscape, true); }
    applyTheme();
  }

  function boot() {
    const hadCache = loadCache();
    const sec = lsGet("igd_section", "analysis");
    S.section = PAGES[sec] ? sec : "analysis";
    if (S.section === "analysis" || S.section === "followers") S.cat = S.catBySec[S.section];
    if (hadCache) S.statusText = "Önceki tarama yüklendi · her veri kaynağının ne zaman alındığı yukarıda yazıyor.";
    ensureUI();
    // Var olan kullanıcı tanıtımı görmesin; ilk kez açanlar görsün
    if (hadCache) lsSet(ONB_KEY, "1");
    if (getView() === "ig") showInstagram(); else showPanel();
    if (lsGet(ONB_KEY, "0") !== "1" && !onbStep) openOnboarding(1);

    // Instagram sayfa içi gezinmede gövdeyi yeniden kurarsa paneli geri tak
    setInterval(() => {
      ensureUI();
      // Giriş bekleniyorsa oturum açılınca panele dön
      let waiting = false; try { waiting = sessionStorage.getItem("igd_onb_login") === "1"; } catch (e) {}
      if (waiting && isLoggedIn() && getView() === "ig") showPanel();
    }, 1500);
  }
