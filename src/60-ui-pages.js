
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

  function dmGoneBar() {
    if (!capActive()) return "";
    const n = capEntries().length;
    const cap = capActive()
      ? `<span><b>Tanılama açık</b> · ${n} istek yakalandı.</span><button class="igd-btn sm primary" id="igd-cap-save">${ic("download", 12)} Raporu kaydet</button><button class="igd-btn sm ghost" id="igd-cap-stop">Tanılamayı bitir</button>`
      : `<button class="igd-btn sm ghost" id="igd-cap-start">Sorun olursa: tanılama…</button>`;
    return `<div class="igd-bar2">${ic("search", 14)}<span class="igd-sp"></span>${cap}</div>`;
  }
  function wireDmGoneBar() {
    const a = $("igd-cap-start"); if (a) a.onclick = startDmCapture;
    const b = $("igd-cap-save"); if (b) b.onclick = saveDmCapture;
    const c = $("igd-cap-stop"); if (c) c.onclick = stopDmCapture;
  }

  function renderDMHead() {
    const el = $("igd-dm-head"); if (!el) return;
    const btn = $("igd-dm-del");
    const n = S.dmSel.size;
    if (btn) { btn.disabled = n === 0 || isBusy(); btn.textContent = `Seçilenleri sil (${n})`; }
    if (!S.dmThreads.length) { el.innerHTML = dmGoneBar(); wireDmGoneBar(); return; }
    const vis = S.dmVis;
    const all = vis.length > 0 && vis.every((t) => S.dmSel.has(t.id));
    el.innerHTML = dmGoneBar() + `<div class="igd-selbar">
      <label class="igd-chk"><input type="checkbox" class="igd-cb" id="igd-dm-all" ${all ? "checked" : ""} ${vis.length ? "" : "disabled"}/> Tümünü seç</label>
      <span>${fmtN(S.dmThreads.length)} sohbet yüklü · ${fmtN(vis.length)} görünüyor${n ? ` · <b>${fmtN(n)} seçili</b>` : ""}</span>
      <span class="igd-sp"></span><span class="igd-note">Silme kalıcıdır · Shift+tık: aralık seç</span></div>`;
    wireDmGoneBar();
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

  // ================================================================ Rapor sayfası (grafik + gelen/ayrılan)
  const RANGES = [[7, "7 gün"], [30, "30 gün"], [90, "90 gün"], [0, "Tümü"]];
  function buildReportPage(page) {
    page.innerHTML = `
      <div class="igd-toolbar">
        <button class="igd-btn primary" id="igd-rep-run">${ic("report")} Raporu oluştur</button>
        <label class="igd-chk"><input type="checkbox" id="igd-rep-auto" ${lsGet("igd_report_auto", "0") === "1" ? "checked" : ""}/> Ayda bir otomatik (uygulama açıkken)</label>
        <span class="igd-note">Rapor, tam takipçi listeni önceki raporla karşılaştırır.</span>
      </div>
      <div class="igd-scroll" id="igd-rep-body" style="padding:0 20px 20px;"></div>`;
    $("igd-rep-run").onclick = generateReport;
    $("igd-rep-auto").onchange = (e) => {
      const on = e.target.checked;
      lsSet("igd_report_auto", on ? "1" : "0");
      if (on) {
        if (!S.reportBase) toast("Önce bir kez “Raporu oluştur” ile temel oluştur; sonra ayda bir otomatik çalışır.", true);
        else toast("Aylık otomatik rapor açıldı.");
        if (window.__igdWatch && window.__igdWatch.ensureTimer) window.__igdWatch.ensureTimer();
      } else toast("Aylık otomatik rapor kapatıldı.");
    };
    $("igd-rep-body").onclick = (e) => {
      const s = e.target.closest("[data-sb]"); if (s) sb(s.dataset.sb);
      const c = e.target.closest("[data-cta]"); if (c) runCta(c.dataset.cta);
      const r = e.target.closest("[data-range]"); if (r) { S.chartRange = +r.dataset.range; lsSet("igd_chart_range", String(S.chartRange)); render(); }
    };
    // Grafik ve rapor verisini tazele (izleyici arka planda yeni nokta eklemiş olabilir)
    Promise.all([DB.get(K.series), loadReportState()]).then(([s]) => { S.series = s || []; if (S.section === "report") render(); }).catch(() => {});
  }

  function seriesInRange() {
    const days = S.chartRange;
    const pts = S.series || [];
    if (!days) return pts;
    const cut = Date.now() - days * 86400000;
    const inR = pts.filter((p) => p[0] >= cut);
    // Aralığın başındaki değeri de göster (çizgi aralık başından başlasın)
    const before = pts.filter((p) => p[0] < cut).pop();
    return before ? [[cut, before[1]], ...inR] : inR;
  }

  function chartHtml() {
    const pts = seriesInRange();
    const seg = `<div class="igd-seg" role="group" aria-label="Zaman aralığı">${RANGES.map(([d, l]) => `<button data-range="${d}" class="${S.chartRange === d ? "on" : ""}" aria-pressed="${S.chartRange === d}">${l}</button>`).join("")}</div>`;
    if (pts.length < 2) {
      return `<div class="igd-chartbox"><div class="hero"><span class="igd-sp"></span>${seg}</div>` + emptyCard({ compact: true, icon: "analysis", title: "Grafik için veri birikiyor",
        html: `<p>İzleyici takipçi sayını 30 dakikada bir kaydeder (tek küçük istek). Birkaç kayıt oluşunca takipçi grafiğin burada görünür.${lsGet("igd_series_on", "1") === "0" ? " <b>Kayıt şu an Ayarlar'da kapalı.</b>" : ""}</p>` }) + `</div>`;
    }
    const first = pts[0][1], last = pts[pts.length - 1][1], diff = last - first;
    const label = (RANGES.find(([d]) => d === S.chartRange) || RANGES[1])[1];
    const rows = (S.series || []).slice(-30).reverse().map(([t, n]) => `<tr><td>${esc(fmtDate(t))}</td><td>${fmtN(n)}</td></tr>`).join("");
    return `<div class="igd-chartbox">
      <div class="hero"><b>${fmtN(last)}</b><span class="d ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "+" : ""}${fmtN(diff)} · ${esc(label)}</span>
        <span class="igd-note">takipçi</span><span class="igd-sp"></span>${seg}</div>
      <div id="igd-chart-wrap" style="position:relative;"></div>
      <details><summary>Tablo olarak göster (son 30 kayıt)</summary><table><thead><tr><th>Tarih</th><th>Takipçi</th></tr></thead><tbody>${rows}</tbody></table></details>
    </div>`;
  }

  // Tek seri çizgi grafik: tek eksen, ince çizgi, sessiz ızgara, üzerine gelince çizgi + ipucu.
  function drawChart(wrap, pts) {
    const W = Math.max(320, wrap.clientWidth || 700), H = 200, ml = 58, mr = 14, mt = 10, mb = 24;
    const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    let lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
    const X = (t) => ml + (t1 === t0 ? 0 : (t - t0) / (t1 - t0)) * (W - ml - mr);
    const Y = (v) => mt + (1 - (v - lo) / (hi - lo)) * (H - mt - mb);
    const ticks = [0, 1, 2, 3].map((i) => Math.round(lo + (hi - lo) * i / 3));
    const day = (t) => { const d = new Date(t); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`; };
    const xt = [t0, (t0 + t1) / 2, t1];
    const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    wrap.innerHTML = `<svg class="igd-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Takipçi sayısı grafiği: ${fmtN(pts[0][1])} → ${fmtN(pts[pts.length - 1][1])}">
      ${ticks.map((v) => `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtN(v)}</text>`).join("")}
      ${xt.map((t, i) => `<text class="ax" x="${X(t)}" y="${H - 6}" text-anchor="${["start", "middle", "end"][i]}">${day(t)}</text>`).join("")}
      <path class="ln" d="${d}"/>
      <line class="xh" id="igd-xh" y1="${mt}" y2="${H - mb}" visibility="hidden"/>
      <circle class="dot" id="igd-xd" r="5" visibility="hidden"/>
      <rect id="igd-hit" x="${ml}" y="0" width="${W - ml - mr}" height="${H}" fill="transparent"/>
    </svg><div class="igd-tip" id="igd-tip" hidden></div>`;
    const hit = $("igd-hit"), xh = $("igd-xh"), xd = $("igd-xd"), tip = $("igd-tip");
    const svg = wrap.firstElementChild;
    hit.onmousemove = (e) => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) * (W / r.width);
      const t = t0 + (x - ml) / (W - ml - mr) * (t1 - t0);
      let lo2 = 0, hi2 = pts.length - 1;
      while (hi2 - lo2 > 1) { const m = (lo2 + hi2) >> 1; if (pts[m][0] < t) lo2 = m; else hi2 = m; }
      const p = Math.abs(pts[lo2][0] - t) < Math.abs(pts[hi2][0] - t) ? pts[lo2] : pts[hi2];
      const px = X(p[0]), py = Y(p[1]);
      xh.setAttribute("x1", px); xh.setAttribute("x2", px); xh.setAttribute("visibility", "visible");
      xd.setAttribute("cx", px); xd.setAttribute("cy", py); xd.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = `<b>${fmtN(p[1])} takipçi</b>${esc(fmtDate(p[0]))}`;
      const sx = px * (r.width / W);
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(0, sx + 10)) + "px";
      tip.style.top = Math.max(0, py * (r.height / H) - 44) + "px";
    };
    hit.onmouseleave = () => { xh.setAttribute("visibility", "hidden"); xd.setAttribute("visibility", "hidden"); tip.hidden = true; };
  }

  function updateReportPage() {
    const c = $("igd-rep-body"); if (!c) return;
    const rb = $("igd-rep-run"); if (rb) rb.disabled = isBusy();
    const r = S.reportLast;
    let rep;
    if (!r) {
      rep = emptyCard({ icon: "report", title: "Henüz rapor yok",
        html: "<p>İlk rapor temel alınır. <b>Bir sonraki</b> raporda iki tarama arasında <b>gelen ve ayrılan</b> takipçiler isim isim listelenir.</p>",
        actions: [{ label: "Raporu oluştur", cta: "report", primary: true, icon: "report" }],
        note: "Rapor için tüm takipçilerin taranır; başlamadan önce kaç kişi olduğunu ve tahmini süreyi gösteririm." });
    } else if (r.baseline) {
      rep = emptyCard({ icon: "check", title: "Rapor temeli alındı",
        html: `<p>${esc(fmtDate(r.t))} · ${S.reportBase ? fmtN(S.reportBase.n) : 0} takipçi.${r.prevIncomplete ? " Önceki temel eksik bir listeye dayandığı için yeni temel alındı." : ""}</p><p>Bundan sonraki raporda gelen/ayrılan farkları çıkacak.</p>` });
    } else {
      const section = (title, arr, icon, color) => {
        if (!arr.length) return `<div class="igd-secbar">${title} (0)</div>` + emptyCard({ compact: true, title: "Yok" });
        return `<div class="igd-secbar">${title} (${arr.length})</div>` + arr.slice().sort((a, b) => coll.compare(a.username, b.username)).map((u) =>
          `<div class="igd-item"><div style="width:30px;text-align:center;color:${color};">${ic(icon, 16)}</div>
            <div class="igd-meta"><div class="igd-name"><a href="https://www.instagram.com/${esc(u.username)}/" target="_blank">@${esc(u.username)}</a></div></div>
            <div class="igd-actions"><button class="igd-mini icon" data-sb="${esc(u.username)}" aria-label="@${esc(u.username)} SocialBlade" title="SocialBlade">${ic("trend", 14)}</button></div></div>`).join("");
      };
      rep = `<div class="igd-bar2"><span>Bu rapor: <b>${esc(fmtDate(r.t))}</b> · önceki: ${r.prevT ? esc(fmtDate(r.prevT)) : "—"}</span>
          <span class="igd-sp"></span><span><b style="color:var(--igd-ok);">+${r.gained.length}</b> gelen · <b style="color:var(--igd-dtx);">-${r.lost.length}</b> ayrılan</span></div>` +
        section("Gelen takipçiler", r.gained, "check", "var(--igd-ok)") + section("Ayrılan takipçiler", r.lost, "x", "var(--igd-dtx)");
    }
    const baseNote = S.reportBase && !S.reportBase.complete
      ? `<div class="igd-bar2 warn">${ic("alert", 14)}<span>Kayıtlı rapor temeli eksik bir takipçi listesine dayanıyor (${fmtN(S.reportBase.n)} hesap). Bir sonraki rapor karşılaştırma yapmadan yeni bir tam temel alacak.</span></div>` : "";
    c.innerHTML = chartHtml() + baseNote + rep;
    const wrap = $("igd-chart-wrap");
    if (wrap) drawChart(wrap, seriesInRange());
  }

  // ================================================================ İşlem Geçmişi sayfası
  const UNDO = { unfollow: "follow", follow: "unfollow" };
  const HIST_FILTERS = [["all", "Tümü"], ["unfollow", "Takibi bırakılanlar"], ["follow", "Takip edilenler"], ["remove", "Takipçiden çıkarılanlar"], ["dm", "DM işlemleri"], ["fail", "Başarısızlar"]];
  const histKey = (e) => e.t + "|" + e.pk;

  function buildHistoryPage(page) {
    S.histSel = new Set(); S.histLastIdx = -1;
    page.innerHTML = `
      <div class="igd-toolbar">
        <div class="igd-search">${ic("search")}<input id="igd-h-q" placeholder="Kullanıcı adı ara..." aria-label="Geçmişte kullanıcı adı ara" autocomplete="off" value="${esc(S.histQuery)}"/></div>
        <select id="igd-h-f" class="igd-sel" aria-label="İşlem türü">${HIST_FILTERS.map(([v, l]) => `<option value="${v}" ${S.histFilter === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button class="igd-btn" id="igd-h-csv">${ic("download")} CSV</button>
        <button class="igd-btn primary" id="igd-h-undo" disabled>Seçilenleri geri al (0)</button>
      </div>
      <div class="igd-listhead" id="igd-h-head"></div>
      <div class="igd-list" id="igd-h-list" role="list" aria-label="İşlem geçmişi"></div>`;
    $("igd-h-q").oninput = (e) => { S.histQuery = e.target.value.trim().toLowerCase(); S.histSel.clear(); render(); };
    $("igd-h-f").onchange = (e) => { S.histFilter = e.target.value; S.histSel.clear(); render(); };
    $("igd-h-csv").onclick = exportHistory;
    $("igd-h-undo").onclick = undoSelected;
    $("igd-h-list").onclick = onHistClick;
  }

  function histVisible() {
    const f = S.histFilter, q = S.histQuery;
    return S.hist.filter((e) => {
      if (f === "fail") { if (e.ok) return false; }
      else if (f === "dm") { if (e.a !== "dmdelete" && e.a !== "unsend") return false; }
      else if (f !== "all" && e.a !== f) return false;
      return !q || String(e.u || "").toLowerCase().includes(q);
    }).reverse(); // en yeni üstte
  }
  const undoable = (e) => e.ok && !!UNDO[e.a];

  function histRowHtml(e, i) {
    const k = histKey(e), sel = S.histSel.has(k), can = undoable(e);
    const isDm = e.a === "dmdelete" || e.a === "unsend";
    const name = esc(e.u);
    const who = isDm ? name : `<a href="https://www.instagram.com/${name}/" target="_blank">@${name}</a>`;
    return `<div class="igd-item ${sel ? "sel" : ""} ${can ? "" : "nosel"}" data-i="${i}" role="listitem">
      <input type="checkbox" class="igd-cb" aria-label="${name} işlemini seç" ${sel ? "checked" : ""} ${can ? "" : "disabled"}/>
      <div style="width:28px;text-align:center;color:${e.ok ? "var(--igd-ok)" : "var(--igd-dtx)"};">${ic(e.ok ? "check" : "x", 16)}</div>
      <div class="igd-meta">
        <div class="igd-name">${who}<span class="igd-tag ${e.ok ? "" : "dm never"}">${esc(HIST_LABELS[e.a] || e.a)}${e.ok ? "" : " · başarısız"}</span></div>
        <div class="igd-full">${esc(fmtDate(e.t))}${e.e ? " · " + esc(e.e) : ""}</div>
      </div>
      <div class="igd-actions">${can ? `<button class="igd-mini" data-undo="${i}">${ic("undo", 13)} ${e.a === "unfollow" ? "Yeniden takip et" : "Takibi bırak"}</button>`
        : e.a === "remove" && e.ok ? `<span class="igd-note">geri alınamaz</span>` : ""}</div>
    </div>`;
  }

  function onHistClick(ev) {
    const t = ev.target;
    const btn = t.closest("button");
    if (btn && btn.dataset.undo != null) { const e = S.histVis[+btn.dataset.undo]; if (e) bulkAction(UNDO[e.a], [e.pk], { [e.pk]: e.u }); return; }
    if (btn || t.closest("a")) return;
    const row = t.closest(".igd-item[data-i]"); if (!row) return;
    const i = +row.dataset.i, e = S.histVis[i];
    if (!e || !undoable(e)) { if (t.matches("input")) ev.preventDefault(); return; }
    const want = t.matches("input.igd-cb") ? t.checked : !S.histSel.has(histKey(e));
    if (ev.shiftKey && S.histLastIdx >= 0) {
      const lo = Math.min(S.histLastIdx, i), hi = Math.max(S.histLastIdx, i);
      for (let k = lo; k <= hi; k++) { const x = S.histVis[k]; if (undoable(x)) { if (want) S.histSel.add(histKey(x)); else S.histSel.delete(histKey(x)); } }
      try { window.getSelection().removeAllRanges(); } catch (err) {}
    } else if (want) S.histSel.add(histKey(e)); else S.histSel.delete(histKey(e));
    S.histLastIdx = i;
    drawVList($("igd-h-list"), true);
    renderHistHead();
  }

  function renderHistHead() {
    const el = $("igd-h-head"); if (!el) return;
    const used = dailyUsed(S.hist).length, lim = dailyLimit();
    const n = S.histSel.size;
    const ub = $("igd-h-undo");
    if (ub) { ub.disabled = n === 0 || isBusy(); ub.textContent = `Seçilenleri geri al (${n})`; }
    el.innerHTML = `<div class="igd-bar2">${ic("clock", 14)}<span>Son 24 saatte <b>${used}</b> takip işlemi${lim ? ` · günlük sınır ${lim} · kalan <b>${Math.max(0, lim - used)}</b>` : " · günlük sınır kapalı"}</span>
      <span class="igd-sp"></span><span class="igd-note">Takibi bırakılanlar yeniden takip edilebilir; takipçiden çıkarılanlar geri alınamaz.</span></div>
      ${S.histVis.length ? `<div class="igd-selbar"><span>${fmtN(S.histVis.length)} kayıt${n ? ` · <b>${n} seçili</b>` : ""}</span><span class="igd-sp"></span><span class="igd-note">Satıra tıkla: seç · Shift+tık: aralık seç</span></div>` : ""}`;
  }

  function updateHistoryPage() {
    S.histVis = histVisible();
    renderHistHead();
    const box = $("igd-h-list");
    if (!S.hist.length) setListContent(box, emptyCard({ icon: "clock", title: "Henüz işlem yok", html: "<p>Takibi bırakma, takip etme, takipçiden çıkarma ve DM işlemlerin burada tarihiyle listelenir; takibi bıraktıklarını buradan yeniden takip edebilirsin.</p>" }));
    else if (!S.histVis.length) setListContent(box, emptyCard({ compact: true, icon: "search", title: "Eşleşen kayıt yok" }));
    else mountVList(box, S.histVis, histRowHtml);
  }

  async function undoSelected() {
    const sel = S.histVis.filter((e) => S.histSel.has(histKey(e)));
    if (!sel.length) return;
    const kinds = new Set(sel.map((e) => e.a));
    if (kinds.size > 1) { toast("Seçimde farklı işlem türleri var — önce üstteki süzgeçten tek bir türü seç.", true); return; }
    const a = UNDO[sel[0].a];
    const names = {}; sel.forEach((e) => { names[e.pk] = e.u; });
    const pks = [...new Set(sel.map((e) => e.pk))];
    S.histSel.clear();
    await bulkAction(a, pks, names);
  }

  function exportHistory() {
    const list = S.histVis && S.histVis.length ? S.histVis : histVisible();
    if (!list.length) { toast("Dışa aktarılacak kayıt yok.", true); return; }
    const rows = list.map((e) => [fmtDate(e.t), HIST_LABELS[e.a] || e.a, e.u, e.ok ? "başarılı" : "başarısız", e.e || ""]);
    const name = `instagram-islem-gecmisi-${stampNow()}.csv`;
    saveTextFile(name, toCSV(["tarih", "islem", "hesap", "sonuc", "hata"], rows), "İşlem geçmişi dışa aktarıldı", `${list.length} kayıt Downloads/${name} dosyasına kaydedildi ✓`);
  }

  // ================================================================ Ayarlar sayfası
  const PRIVACY_HTML = `<ul>
    <li><b>Şifreni görmez.</b> Giriş, Instagram'ın kendi gerçek sayfasında yapılır; bu uygulama yalnızca o sayfayı gösteren bir penceredir. Şifren uygulamaya yazılmaz, hiçbir yerde saklanmaz.</li>
    <li><b>Her şey bu Mac'te kalır.</b> Uygulamanın sunucusu yoktur; hiçbir bilgin internete ya da başka birine gönderilmez. Analizler kendi oturumunda, cihazında çalışır.</li>
    <li><b>Ne okur:</b> takip/takipçi listelerini, (istersen) son gönderilerini beğenenleri ve hikayeni görenleri Instagram'ın kendi arayüzünden çeker. DM bölümünde sohbet <b>listesini</b> ve tarihleri görür; mesaj içeriklerini okumaz — yalnızca sen “yedekle” dersen <b>kendi gönderdiğin</b> mesajların metnini Downloads klasörüne kaydeder.</li>
    <li><b>İşlemler senin komutunla:</b> takibi bırakma, takipçiden çıkarma, DM silme ve mesaj geri çekme yalnızca sen onayladığında ve kendi hesabınla yapılır; günlük sınır ve art arda hata durdurması hesabını korur.</li>
    <li><b>Sorumluluk sende:</b> araç Instagram'ın resmi olmayan uçlarını kullanır. Aşırı ya da hızlı kullanım hesabına geçici kısıtlama getirebilir.</li>
  </ul>`;

  function buildSettingsPage(page) {
    page.innerHTML = `<div class="igd-scroll"><div class="igd-settings">
      <section class="igd-panel" aria-labelledby="igd-set-l">
        <h2 id="igd-set-l">${ic("shield")} Güvenlik sınırları</h2>
        <p class="igd-note">Instagram kesin sınırı açıklamaz; çok sayıda takip işlemi aynı gün hesabı geçici olarak kısıtlatabilir. Sınır dolunca kuyruk bekler ve hak açılınca (uygulama açıksa) kendiliğinden sürer. Instagram art arda reddederse işlem her durumda durur.</p>
        <div class="row"><label class="igd-chk">24 saatte en fazla <input type="number" id="igd-lim" min="0" max="1000" class="igd-num"/> takip işlemi (0 = sınırsız)</label>
          <button class="igd-btn" id="igd-lim-save">Kaydet</button><span class="igd-note" id="igd-lim-info"></span></div>
      </section>
      <section class="igd-panel" aria-labelledby="igd-set-n">
        <h2 id="igd-set-n">${ic("bell")} Takipçi bildirimleri</h2>
        <div class="igd-nform">
          <label class="igd-chk"><input type="checkbox" id="ign-en"/> Beni takibi bırakanlar için bildirim gönder (arka planda)</label>
          <label class="igd-chk"><input type="checkbox" id="ign-new"/> Yeni takipçiler için de bildirim gönder</label>
          <label class="igd-chk"><input type="checkbox" id="ign-deep"/> Düşüş olunca <b>kimin</b> ayrıldığını da otomatik bul (ağır tarama — en fazla 3 saatte bir)</label>
          <label class="igd-chk"><input type="checkbox" id="ign-series"/> Takipçi sayısını grafik için kaydet (Rapor sayfası)</label>
          <label class="igd-chk">Kontrol aralığı <input type="number" id="ign-int" min="10" max="720" class="igd-num"/> dakika</label>
          <div class="igd-note" id="ign-info"></div>
        </div>
        <div class="row"><button class="igd-btn primary" id="ign-save">Kaydet</button><button class="igd-btn" id="ign-check">${ic("refresh")} Şimdi kontrol et</button></div>
      </section>
      <section class="igd-panel" aria-labelledby="igd-set-g">
        <h2 id="igd-set-g">${ic("heart")} Hayalet takipçiler</h2>
        <div class="row"><label class="igd-chk">Son <input type="number" id="igd-gp" min="3" max="30" class="igd-num"/> gönderinin beğenileri taransın</label>
          <button class="igd-btn" id="igd-gp-save">Kaydet</button></div>
        <p class="igd-note" style="margin-top:8px;">Daha çok gönderi daha doğru sonuç verir ama gönderi başına bir istek daha yapar.</p>
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
      <section class="igd-panel" aria-labelledby="igd-set-b">
        <h2 id="igd-set-b">${ic("download")} Yedekle ve geri yükle</h2>
        <p class="igd-note">Ayarların, koru listen, profil izleme listen, işlem geçmişin, hikaye izleyici kayıtların, raporların ve grafik verin tek bir JSON dosyasına kaydedilir (Downloads). Başka bir Mac'e taşımak ya da sıfırdan kurulumdan sonra geri yüklemek için kullanabilirsin.</p>
        <div class="row"><label class="igd-chk"><input type="checkbox" id="igd-bk-scans"/> Tarama sonuçlarını da ekle (dosya büyür)</label></div>
        <div class="row"><button class="igd-btn primary" id="igd-bk-save">${ic("download")} Yedeği kaydet</button><button class="igd-btn" id="igd-bk-load">${ic("upload")} Yedekten geri yükle…</button></div>
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
    $("igd-lim").value = dailyLimit();
    $("igd-lim-save").onclick = () => {
      const v = Math.max(0, Math.min(1000, parseInt($("igd-lim").value || "0", 10) || 0));
      $("igd-lim").value = v; lsSet("igd_daily_limit", String(v));
      toast(v ? `Günlük sınır ${v} işlem yapıldı.` : "Günlük sınır kapatıldı.");
      if (S.queue && S.queue.state === "wait") { S.queue.resumeAt = nextSlotAt(); saveQueue(); scheduleQueue(); }
      render();
    };
    $("ign-en").checked = lsGet("igd_watch_enabled", "0") === "1";
    $("ign-new").checked = lsGet("igd_watch_newfollowers", "0") === "1";
    $("ign-deep").checked = lsGet("igd_watch_deep", "0") === "1";
    $("ign-series").checked = lsGet("igd_series_on", "1") !== "0";
    $("ign-int").value = parseInt(lsGet("igd_watch_interval", "30"), 10);
    $("ign-check").onclick = () => { if (W()) { W().checkNow(); toast("Kontrol başlatıldı..."); setTimeout(render, 4000); } else toast("İzleyici hazır değil, sayfayı yenileyin.", true); };
    $("ign-save").onclick = () => {
      const iv = Math.max(10, Math.min(720, parseInt($("ign-int").value || "30", 10)));
      $("ign-int").value = iv;
      lsSet("igd_watch_newfollowers", $("ign-new").checked ? "1" : "0");
      lsSet("igd_watch_deep", $("ign-deep").checked ? "1" : "0");
      lsSet("igd_series_on", $("ign-series").checked ? "1" : "0");
      lsSet("igd_watch_interval", String(iv));
      if (!W()) { toast("İzleyici hazır değil, sayfayı yenileyin.", true); return; }
      if ($("ign-en").checked) { W().start(); toast("Bildirimler açıldı ✓ (ilk kontrol temel alınır)"); }
      else { W().stop(); toast("Ayarlar kaydedildi; bildirimler kapalı."); }
      W().ensureTimer(); if (W().stopTimerIfIdle) W().stopTimerIfIdle();
      render();
    };
    $("igd-gp").value = ghostPosts();
    $("igd-gp-save").onclick = () => {
      const v = Math.max(3, Math.min(30, parseInt($("igd-gp").value || "12", 10) || 12));
      $("igd-gp").value = v; lsSet("igd_ghost_posts", String(v)); toast(`Hayalet taraması son ${v} gönderiyi kullanacak.`);
    };
    $("igd-th-dark").onclick = () => setTheme(false);
    $("igd-th-light").onclick = () => setTheme(true);
    $("igd-bk-save").onclick = () => saveBackup($("igd-bk-scans").checked);
    $("igd-bk-load").onclick = pickRestore;
    $("igd-clear").onclick = clearAll;
    $("igd-onb-again").onclick = () => openOnboarding(1);
  }

  function updateSettingsPage() {
    const W = window.__igdWatch;
    const last = W ? W.lastCheck() : 0, cnt = W ? W.count() : 0;
    const info = $("ign-info");
    if (info) info.innerHTML = `Durum: <b>${W && W.isOn() ? "açık" : "kapalı"}</b> · son kontrol: ${last ? esc(fmtDate(last)) : "henüz yok"} · son bilinen takipçi sayısı: ${cnt ? fmtN(cnt) : "—"}<br>
      Arka planda yalnızca <b>takipçi sayına</b> bakılır (tek küçük istek), tüm liste taranmaz. Sayı düşünce net kaç kişi olduğu bildirilir; isimler için Takipçiler sayfasından tara.
      İzleyicinin çalışması için uygulama açık ya da menü çubuğunda kalmalı.`;
    const li = $("igd-lim-info");
    if (li) { const used = dailyUsed(S.hist).length; li.textContent = `Son 24 saatte ${used} işlem yapıldı.`; }
    const dk = $("igd-th-dark"), lt = $("igd-th-light");
    if (dk) { dk.classList.toggle("on", !isLight()); dk.setAttribute("aria-pressed", String(!isLight())); lt.classList.toggle("on", isLight()); lt.setAttribute("aria-pressed", String(isLight())); }
    const wl = $("igd-wlinfo");
    if (wl) {
      const known = [...S.whitelist].map((pk) => findUser(pk)).filter(Boolean);
      const sug = protectSuggestions();
      wl.innerHTML = `<p class="igd-note">Korunan hesaplar toplu “Takibi bırak” işlemlerinde atlanır ve seçilemez. Listedeki ${ic("shield", 12)} düğmesiyle eklenir.</p>
        <div class="row"><span><b>${fmtN(S.whitelist.size)}</b> hesap korunuyor.</span>
          ${sug.length ? `<button class="igd-btn sm" id="igd-wlsug">Son 90 günde DM'leştiğin ${sug.length} kişiyi koru…</button>` : S.dmScanned ? "" : `<span class="igd-note">DM kutusunu tararsan yakın arkadaşlarını korumaya önerebilirim.</span>`}
          ${S.whitelist.size ? `<button class="igd-btn sm danger" id="igd-wlclear">Tüm korumaları kaldır…</button>` : ""}</div>
        ${known.length ? `<div class="igd-chips" style="margin-top:10px;">${known.slice(0, 100).map((u) => `<span class="igd-tag wl" style="font-size:12px;padding:2px 8px;">@${esc(u.username)}</span>`).join("")}</div>` : ""}`;
      const sb_ = $("igd-wlsug"); if (sb_) sb_.onclick = protectSuggested;
      const b = $("igd-wlclear");
      if (b) b.onclick = async () => {
        const ok = await askConfirm({ title: "Tüm korumalar kaldırılsın mı?", html: `<p>${fmtN(S.whitelist.size)} hesabın koruması kalkar; toplu “Takibi bırak” işlemlerinde seçilebilir hâle gelirler.</p>`, danger: true, okLabel: "Korumaları kaldır" });
        if (!ok) return;
        S.whitelist.clear(); saveWhitelist(); render(); toast("Korumalar kaldırıldı.");
      };
    }
  }

  // --- Yedekle / geri yükle ---
  // Kuyruk yedeğe girmez: eski bir yedek, iptal edilmiş bir toplu işlemi geri getirip çalıştırmasın.
  const BACKUP_IDB_KEYS = [K.history, K.series, K.snapReport, K.reportLast, K.snapFollowers, K.stories];
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const BACKUP_SHAPES = {
    [K.history]: (v) => Array.isArray(v) && v.every((e) => isObj(e) && typeof e.t === "number" && typeof e.a === "string"),
    [K.series]: (v) => Array.isArray(v) && v.every((p) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number"),
    [K.snapReport]: (v) => isObj(v) && isObj(v.map),
    [K.reportLast]: (v) => isObj(v) && Array.isArray(v.gained || []) && Array.isArray(v.lost || []),
    [K.snapFollowers]: (v) => isObj(v) && isObj(v.map),
    [K.stories]: (v) => isObj(v) && isObj(v.stories) && Array.isArray(v.log),
    [K.cache]: (v) => isObj(v) && Array.isArray(v.following),
    [K.likes]: (v) => isObj(v) && Array.isArray(v.likers),
  };
  async function saveBackup(includeScans) {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("igd_")) ls[k] = localStorage.getItem(k); }
    const idb = {};
    for (const k of BACKUP_IDB_KEYS.concat(includeScans ? [K.cache, K.likes] : [])) {
      try { const v = await DB.get(k); if (v !== undefined) idb[k] = v; } catch (e) {}
    }
    const name = `instagram-denetim-yedek-${stampNow()}.json`;
    saveTextFile(name, JSON.stringify({ app: "instadenetim", v: 1, t: Date.now(), ls, idb }), "Yedek kaydedildi", `Yedek Downloads/${name} dosyasına kaydedildi ✓`);
  }
  function pickRestore() {
    if (guardBusy()) return;
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      let d;
      try { d = JSON.parse(await f.text()); } catch (e) { toast("Dosya okunamadı (geçerli bir JSON değil).", true); return; }
      if (!d || d.app !== "instadenetim" || typeof d.ls !== "object") { toast("Bu dosya bir Instagram Takip Denetimi yedeği değil.", true); return; }
      const idbKeys = Object.keys(isObj(d.idb) ? d.idb : {}).filter((k) => BACKUP_SHAPES[k] && BACKUP_SHAPES[k](d.idb[k]));
      const h = (d.idb || {})[K.history];
      const ok = await askConfirm({
        title: "Yedek geri yüklensin mi?",
        html: `<p><b>${esc(fmtDate(d.t))}</b> tarihli yedek: ${Object.keys(d.ls).length} ayar${Array.isArray(h) ? `, ${fmtN(h.length)} geçmiş kaydı` : ""}${(d.idb || {})[K.cache] ? ", tarama sonuçları" : ""}.</p>
          <p>Bu Mac'teki aynı ayarlar ve kayıtlar yedektekilerle <b>değiştirilir</b>. Panel ardından yeniden yüklenir.</p>`,
        danger: true, okLabel: "Geri yükle",
      });
      if (!ok || guardBusy()) return;
      Object.keys(d.ls).forEach((k) => { if (k.startsWith("igd_") && typeof d.ls[k] === "string") lsSet(k, d.ls[k]); });
      for (const k of idbKeys) { try { await DB.set(k, d.idb[k]); } catch (e) {} }
      toast("Yedek geri yüklendi ✓ — panel yeniden yükleniyor…");
      setTimeout(() => location.reload(), 1200);
    };
    inp.click();
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
    followers: { label: "Takipçiler",    icon: "users",    title: "Takipçiler",    sub: "Seni takip edenler: hayranların, şüpheli hesaplar ve hayaletler", build: buildListPage,     update: updateListPage },
    dm:        { label: "DM'lerim",      icon: "message",  title: "DM'lerim",      sub: "Sohbetlerini yönet: topluca sil, gönderdiğin mesajları geri çek", build: buildDMPage,       update: updateDMPage },
    profile:   { label: "Profil İzleme", icon: "eye",      title: "Profil İzleme", sub: "Başka bir hesabın takip ettikleri ve takip/bırakma bildirimleri", build: buildProfilePage,  update: updateProfilePage },
    stories:   { label: "Hikayeme bakanlar", icon: "story", title: "Hikayeme bakanlar", sub: "Hikayene kimler, kaç kez bakıyor — aralıklı takip ve tarihli günlük", build: buildStoriesPage, update: updateStoriesPage },
    report:    { label: "Rapor",         icon: "report",   title: "Takipçi raporu", sub: "Takipçi grafiğin; iki tarama arasında gelen ve ayrılan takipçiler", build: buildReportPage, update: updateReportPage },
    history:   { label: "İşlem Geçmişi", icon: "clock",    title: "İşlem Geçmişi", sub: "Yaptığın işlemler tarihiyle — takibi bıraktıklarını geri al",     build: buildHistoryPage,  update: updateHistoryPage },
    settings:  { label: "Ayarlar",       icon: "settings", title: "Ayarlar",       sub: "Güvenlik sınırları, bildirimler, koru listesi, yedek ve gizlilik", build: buildSettingsPage, update: updateSettingsPage },
  };

  const SHELL = `
    <nav class="igd-side" aria-label="Bölümler">
      <div class="igd-brandrow">
        <div class="igd-logo igd-grad" aria-hidden="true">${ic("analysis", 18)}</div>
        <div class="igd-brand"><b>Instagram Takip Denetimi</b><small>Emir Kosif · v4.1</small></div>
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
    $("igd-fab").innerHTML = `${ic("analysis", 15)} ${capActive() ? "Tanılama açık — panele dön" : "Denetim paneline dön"}`;
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

  // Kayıtlı veriyi IndexedDB'den yükle (eski localStorage kayıtları bir kez buraya taşınır)
  async function loadAll() {
    await migrateStorage();
    const hadCache = await loadCache();
    const [hist, series, likes, resume] = await Promise.all([
      histLoad().catch(() => []), DB.get(K.series).catch(() => null), DB.get(K.likes).catch(() => null), DB.get(K.resumeFollowers).catch(() => null),
    ]);
    S.hist = hist || [];
    S.series = series || [];
    if (likes && Array.isArray(likes.likers)) S.likes = Object.assign({}, likes, { likers: new Set(likes.likers) });
    S.resume = resume || null;
    await loadReportState();
    await loadQueue();
    return hadCache;
  }

  async function boot() {
    const sec = lsGet("igd_section", "analysis");
    S.section = PAGES[sec] ? sec : "analysis";
    if (S.section === "analysis" || S.section === "followers") S.cat = S.catBySec[S.section];
    S.chartRange = parseInt(lsGet("igd_chart_range", "30"), 10) || 0;
    if (!RANGES.some(([d]) => d === S.chartRange)) S.chartRange = 30;
    S.statusText = "Kayıtlı sonuçlar yükleniyor…";
    ensureUI();
    let hadCache = false;
    try { hadCache = await loadAll(); } catch (e) { toast("Kayıtlı sonuçlar okunamadı: " + (e && e.message || e), true); }
    S.loaded = true;
    S.statusText = hadCache ? "Önceki tarama yüklendi · her veri kaynağının ne zaman alındığı yukarıda yazıyor." : "Hazır.";
    if (S.queue) S.statusText = "Kuyrukta bekleyen bir toplu işlem var — alttaki tepsiden devam ettirebilirsin.";
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
