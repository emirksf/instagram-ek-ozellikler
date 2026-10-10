
  // ================================================================ Profil İzleme: veri
  async function resolveUser(username) {
    const u = String(username || "").replace(/^@/, "").trim().toLowerCase();
    const res = await api(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(u)}`);
    if (res.status === 404) throw new Error("Böyle bir kullanıcı yok.");
    if (!res.ok) throw new Error("Kullanıcı çözümlenemedi (HTTP " + res.status + ")");
    const d = await res.json();
    const user = d.data && d.data.user;
    if (!user) throw new Error("Kullanıcı bulunamadı.");
    return {
      id: String(user.id), username: user.username, full_name: user.full_name,
      profile_pic_url: user.profile_pic_url, is_private: user.is_private,
      followed_by_viewer: user.followed_by_viewer,
      following_count: user.edge_follow && user.edge_follow.count,
    };
  }

  async function fetchTargetFollowing(id, onProgress, cap) {
    cap = cap || 2000;
    const out = []; let maxId = "", guard = 0;
    while (true) {
      if (S.stopFlag) break;
      if (++guard > 60) break;
      const url = `https://www.instagram.com/api/v1/friendships/${id}/following/?count=100` + (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
      let res;
      try { res = await api(url); } catch (e) { await sleep(2000); continue; }
      if (res.status === 401 || res.status === 403) throw new Error("Bu hesabın takip listesi görünmüyor (gizli hesap ya da erişim yok).");
      if (res.status === 429) { onProgress && onProgress(out.length, "limit — 30 sn"); await sleep(30000); continue; }
      if (!res.ok) { if (out.length === 0) throw new Error("Liste okunamadı (HTTP " + res.status + ")"); break; }
      let d; try { d = await res.json(); } catch (e) { break; }
      (d.users || []).forEach((u) => out.push({ pk: String(u.pk), username: u.username, full_name: u.full_name, is_verified: u.is_verified, is_private: u.is_private, profile_pic_url: u.profile_pic_url }));
      onProgress && onProgress(out.length, "");
      maxId = d.next_max_id;
      if (!maxId || out.length >= cap) break;
      await sleep(rand(500, 1000));
    }
    return out;
  }

  const pfList = () => lsJSON("igd_pf_list", []);
  const pfSaveList = (l) => lsSet("igd_pf_list", JSON.stringify(l));
  const pfIsWatched = (id) => pfList().some((a) => String(a.id) === String(id));
  function pfAdd(acc, following, opts) {
    opts = opts || { nf: true, uf: true };
    const l = pfList();
    const entry = { id: String(acc.id), username: acc.username, nf: !!opts.nf, uf: !!opts.uf };
    const idx = l.findIndex((a) => String(a.id) === String(acc.id));
    if (idx >= 0) l[idx] = entry; else l.push(entry);
    pfSaveList(l);
    // Anlık görüntü: id -> kullanıcı adı (bırakılanların adını da bilmek için)
    const map = {};
    (following || []).forEach((u) => { map[String(u.pk)] = u.username; });
    lsSet("igd_pf_snap_" + acc.id, JSON.stringify(map));
    if (window.__igdWatch && window.__igdWatch.ensureTimer) window.__igdWatch.ensureTimer();
  }
  function pfRemove(id) {
    pfSaveList(pfList().filter((a) => String(a.id) !== String(id)));
    try { localStorage.removeItem("igd_pf_snap_" + id); } catch (e) {}
  }
  const pfLog = (id) => lsJSON("igd_pf_log_" + id, []);

  async function pfGet(name) {
    if (guardBusy()) return;
    const uname = String(name || (($("igd-pf-user") || {}).value || "")).trim().replace(/^@/, "");
    if (!uname) { toast("Bir kullanıcı adı yaz.", true); return; }
    S.pfBusy = true; S.stopFlag = false;
    startJob({ title: `@${uname} takip listesi getiriliyor` });
    let summary = "";
    try {
      setStatus("Kullanıcı çözümleniyor...");
      const acc = await resolveUser(uname);
      const list = await fetchTargetFollowing(acc.id, (n, m) => setStatus(`@${acc.username}: ${n} kişi ${m}`));
      S.pfUser = acc; S.pfFollowing = list;
      const partial = acc.following_count && list.length < acc.following_count ? ` (ilk ${list.length})` : "";
      summary = `@${acc.username} · ${list.length} takip${partial}`;
    } catch (e) {
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally { S.pfBusy = false; S.stopFlag = false; jobFinish(summary); render(); }
  }

  async function pfToggleWatch() {
    const acc = S.pfUser; if (!acc) return;
    if (pfIsWatched(acc.id)) { pfRemove(acc.id); toast("İzleme bırakıldı."); render(); return; }
    const r = await openDialog({
      title: `@${acc.username} — neyi bildireyim?`,
      body: `<div class="igd-nform">
          <label class="igd-chk"><input type="checkbox" id="pfo-f" checked/> 🆕 Yeni birini <b>takip ettiğinde</b> bildir</label>
          <label class="igd-chk"><input type="checkbox" id="pfo-u" checked/> ❌ Birini <b>takibi bıraktığında</b> bildir</label>
          <div class="igd-note">İkisini birden ya da yalnızca birini seçebilirsin. İzleyicinin çalışması için uygulama açık ya da menü çubuğunda olmalı. Hareketler tarihiyle kaydedilir.</div>
        </div>`,
      buttons: [
        { label: "Vazgeç", value: null },
        { label: "İzlemeye al", kind: "primary", handler: (card) => {
          const nf = card.querySelector("#pfo-f").checked, uf = card.querySelector("#pfo-u").checked;
          if (!nf && !uf) { toast("En az birini seç.", true); return false; }
          return { nf, uf };
        } },
      ],
    });
    if (!r) return;
    pfAdd(acc, S.pfFollowing || [], r);
    const what = r.nf && r.uf ? "takip ve bırakmalarında" : r.nf ? "yeni takiplerinde" : "takibi bırakmalarında";
    toast(`@${acc.username} izleniyor — ${what} bildirim gelecek.`);
    render();
  }

  async function pfCheckNow() {
    if (!pfList().length) { toast("Önce bir hesabı 🔔 İzle ile ekle.", true); return; }
    if (!window.__igdWatch || !window.__igdWatch.pfCheckNow) { toast("İzleyici hazır değil, sayfayı yenile.", true); return; }
    if (guardBusy()) return;
    S.pfBusy = true;
    // İzleyicinin kendi kontrolü yarıda kesilemez → Durdur düğmesi gösterilmez
    startJob({ title: "İzlenen hesaplar kontrol ediliyor", stoppable: false });
    try { await window.__igdWatch.pfCheckNow(); } catch (e) {}
    S.pfBusy = false;
    jobFinish("Kontrol tamam ✓ — değişiklik olduysa bildirim geldi ve hareketlere işlendi.");
    render();
  }

  // ================================================================ Rapor: veri
  const loadReportLast = () => lsJSON("igd_report_last", null);
  const loadReportSnap = () => lsJSON("igd_report_snap", null);
  const saveReportSnap = (o) => lsSet("igd_report_snap", JSON.stringify(o));
  const saveReportLast = (o) => lsSet("igd_report_last", JSON.stringify(o));

  async function generateReport() {
    if (guardBusy()) return;
    // Taze tam takipçi listesi varsa (30 dk'dan yeni) onu kullan; yoksa açıkça sorup tara.
    const fresh = S.followersFull && S.followers.length && S.followersScanTime && (Date.now() - S.followersScanTime < 30 * 60000);
    if (!fresh) {
      const n = S.followerCount;
      const ok = await askConfirm({
        title: "Rapor için takipçiler taranacak",
        html: `<p>Rapor, takipçi listenin <b>tamamını</b> bir önceki raporla karşılaştırır. Bunun için ${n ? `<b>${fmtN(n)}</b> takipçinin` : "tüm takipçilerin"} yeniden taranması gerekiyor.</p>
          <p class="igd-note">Tarama alttaki tepside sürer; durdurursan rapor oluşturulmaz.</p>`,
        estimate: n ? Math.ceil(n / 100) * 2.6 : 0, // sayfa başına ~0,9 sn bekleme + istek + her 6 sayfada 7 sn mola
        okLabel: "Tara ve raporu oluştur",
      });
      if (!ok) return;
      await fetchAllFollowers();
    }
    if (!S.followersFull || !S.followers.length) { toast("Takipçi taraması tamamlanmadığı için rapor oluşturulamadı.", true); return; }

    const curMap = {}; S.followers.forEach((u) => { curMap[String(u.pk)] = u.username; });
    const prev = loadReportSnap();
    const now = Date.now();
    saveReportSnap({ t: now, map: curMap });
    if (!prev || !prev.map) {
      saveReportLast({ t: now, prevT: 0, gained: [], lost: [], baseline: true });
    } else {
      const gained = [], lost = [];
      for (const pk in curMap) if (!(pk in prev.map)) gained.push({ pk, username: curMap[pk] });
      for (const pk in prev.map) if (!(pk in curMap)) lost.push({ pk, username: prev.map[pk] });
      saveReportLast({ t: now, prevT: prev.t, gained, lost });
    }
    toast("Rapor hazır ✓");
    render();
  }
