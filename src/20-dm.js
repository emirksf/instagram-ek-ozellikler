
  // ================================================================ DM'lerim: veri ve işlemler
  async function hideThread(id) {
    const csrf = getCookie("csrftoken");
    if (!csrf) throw new Error("csrftoken yok — sayfayı yenileyin.");
    const res = await api(`https://www.instagram.com/api/v1/direct_v2/threads/${id}/hide/`, {
      method: "POST",
      headers: { "x-csrftoken": csrf, "x-instagram-ajax": "1", "content-type": "application/x-www-form-urlencoded" },
      body: "use_unified_inbox=true",
    });
    let ok = res.ok;
    try { const j = await res.json(); ok = ok && (j.status === "ok"); } catch (e) {}
    if (!ok) throw new Error(res.status === 404 ? "HTTP 404 (web'de kapalı)" : "HTTP " + res.status);
    return true;
  }

  function dmThreadDate(ms) {
    if (!ms) return "Son mesaj tarihi bilinmiyor";
    const days = Math.floor((Date.now() - ms) / 86400000);
    let rel;
    if (days <= 0) rel = "bugün"; else if (days < 30) rel = days + " gün önce";
    else if (days < 365) rel = Math.floor(days / 30) + " ay önce"; else rel = Math.floor(days / 365) + "+ yıl önce";
    let dstr = ""; try { dstr = new Date(ms).toLocaleDateString("tr-TR"); } catch (e) {}
    return `Son mesaj: ${rel}${dstr ? " (" + dstr + ")" : ""}`;
  }

  const DM_FILTERS = [["all", "Tümü"], ["90", "3+ ay eski"], ["180", "6+ ay eski"], ["365", "1+ yıl eski"], ["nofollow", "Takip etmediklerinle"], ["group", "Grup sohbetleri"]];

  function dmVisible() {
    let list = S.dmThreads.slice();
    const f = S.dmFilter, now = Date.now();
    if (f === "90" || f === "180" || f === "365") {
      const cut = now - parseInt(f, 10) * 86400000;
      list = list.filter((t) => !t.act || t.act < cut);
    } else if (f === "nofollow") {
      list = list.filter((t) => !t.group && t.users[0] && !S.followingIds.has(String(t.users[0].pk)));
    } else if (f === "group") {
      list = list.filter((t) => t.group);
    }
    if (S.dmQuery) {
      const q = S.dmQuery.toLowerCase();
      list = list.filter((t) => (t.title || "").toLowerCase().includes(q) || t.users.some((u) => (u.username || "").toLowerCase().includes(q)));
    }
    return list.sort((a, b) => (a.act || 0) - (b.act || 0)); // en eski üstte
  }

  const threadName = (t) => t ? (t.group ? (t.title || "Grup") : "@" + ((t.users[0] || {}).username || t.title || t.id)) : "?";

  const threadFromRaw = (t) => {
    if (!t || !t.thread_id) return null;
    const users = (t.users || []).map((u) => ({ pk: String(u.pk), username: u.username, pic: u.profile_pic_url }));
    const act = t.last_activity_at ? Math.floor(t.last_activity_at / 1000) : 0;
    return { id: t.thread_id, users, group: users.length > 1, act, title: t.thread_title || users.map((u) => u.username).join(", ") };
  };

  // Gelen kutusunda belirli bir kişiyi (pk) BULANA KADAR tarar, bulunca durur (tümünü taramaz).
  async function findThreadInInbox(targetPk, onProgress) {
    let cursor = "", guard = 0;
    const base = "https://www.instagram.com/api/v1/direct_v2/inbox/?persistentBadging=true&limit=20&thread_message_limit=1";
    while (true) {
      if (S.stopFlag) break;
      if (++guard > 80) break;
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}&direction=older` : base;
      let res;
      try { res = await api(url); } catch (e) { await sleep(1500); continue; }
      if (res.status === 429) { await sleep(30000); continue; }
      if (!res.ok) break;
      let d; try { d = await res.json(); } catch (e) { break; }
      const inbox = d.inbox || {};
      for (const t of (inbox.threads || [])) {
        const users = t.users || [];
        if (users.length === 1 && String(users[0].pk) === String(targetPk)) return threadFromRaw(t);
      }
      onProgress && onProgress(guard);
      cursor = inbox.oldest_cursor;
      if (!inbox.has_older || !cursor) break;
      await sleep(rand(400, 800));
    }
    return null;
  }

  // Kullanıcı adından o kişiyle sohbeti bul. Önce hızlı uç, olmazsa kutuda ara.
  async function fetchThreadByUser(username, onProgress) {
    const acc = await resolveUser(username); // {id, username, ...}
    // 1) Hızlı yol: get_by_participants (bazı hesaplarda 404 döner → yut, yedeğe geç)
    try {
      const url = `https://www.instagram.com/api/v1/direct_v2/threads/get_by_participants/?recipient_users=${encodeURIComponent("[" + acc.id + "]")}`;
      const res = await api(url);
      if (res.ok) {
        const d = await res.json();
        const th = threadFromRaw(d.thread);
        if (th) return { acc, thread: th };
      }
    } catch (e) { /* yedek yola geç */ }
    // 2) Yedek: gelen kutusunda o kişiyi bulana kadar tara (bulunca durur)
    onProgress && onProgress(0);
    const th = await findThreadInInbox(acc.id, onProgress);
    return { acc, thread: th };
  }

  async function dmFindPerson() {
    if (guardBusy()) return;
    const uname = (($("igd-dm-find") || {}).value || "").trim().replace(/^@/, "");
    if (!uname) { toast("Bir kullanıcı adı yaz.", true); return; }
    S.dmBusy = true; S.stopFlag = false;
    startJob({ title: `@${uname} ile sohbet aranıyor` });
    let summary = "";
    try {
      const { acc, thread } = await fetchThreadByUser(uname, (p) => { if (p) setStatus(`Gelen kutusunda aranıyor: ${p}. sayfa...`); });
      if (!thread) { summary = `@${acc.username} ile mevcut bir sohbet bulunamadı (ya da çok eski).`; return; }
      if (!S.dmThreads.some((x) => x.id === thread.id)) S.dmThreads.unshift(thread);
      S.dmQuery = acc.username;
      const q = $("igd-dm-q"); if (q) q.value = acc.username;
      summary = `@${acc.username} sohbeti getirildi — listeden işlem yapabilirsin.`;
    } catch (e) {
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally { S.dmBusy = false; S.stopFlag = false; jobFinish(summary); render(); }
  }

  async function deleteDMs() {
    if (guardBusy()) return;
    const ids = [...S.dmSel].filter((id) => S.dmThreads.some((t) => t.id === id));
    if (!ids.length) { toast("En az bir sohbet seç.", true); return; }

    const ok = await askConfirm({
      title: `${ids.length} sohbet kalıcı olarak silinecek`,
      html: `<p><b>Bu işlem geri alınamaz.</b> Silinen yazışmalar gelen kutundan tamamen kaybolur.</p>`,
      names: ids.map((id) => threadName(S.dmThreads.find((t) => t.id === id)).replace(/^@/, "")),
      estimate: ids.length * 5,
      danger: true, okLabel: `Sil (${ids.length})`, typeWord: "SIL",
    });
    if (!ok || guardBusy()) return;

    S.dmBusy = true; S.stopFlag = false; S.paused = false;
    startJob({ title: "Sohbetler siliniyor", total: ids.length, pausable: true });
    let done = 0, okN = 0, fail = 0, had404 = false;
    try {
      for (const id of ids) {
        await waitIfPaused();
        if (S.stopFlag) { jobLog("⏹ Kullanıcı durdurdu.", "warn"); break; }
        const name = threadName(S.dmThreads.find((x) => x.id === id));
        try {
          await hideThread(id);
          okN++; jobLog(`✓ ${name} silindi`, "ok");
          S.dmThreads = S.dmThreads.filter((x) => x.id !== id);
          S.dmSel.delete(id);
        } catch (e) { fail++; if (/404/.test(e.message)) had404 = true; jobLog(`✗ ${name} silinemedi (${e.message})`, "err"); }
        done++;
        jobProgress(done, ids.length, okN, fail);
        if (done < ids.length && !S.stopFlag) {
          await pSleep(rand(1500, 3000));
          if (done % 10 === 0 && !S.stopFlag) { jobLog("⏳ Güvenlik molası ~20 sn...", "warn"); await pSleep(20000); }
        }
      }
      if (had404) {
        jobLog("ℹ️ Instagram web'in bu sürümünde sohbeti tümden silme (hide) ucu kapalı görünüyor. Alternatif: sohbet satırındaki “↩︎ Mesajlarım” ile KENDİ mesajlarını geri çekebilirsin — bu, mesajları iki taraftan da kaldırır. Sohbeti tümüyle silmek için Instagram uygulamasını kullan.", "warn");
        toast("Sohbet silme web'de kapalı; '↩︎ Mesajlarım' ile mesajları geri çekebilirsin.", true);
      }
    } finally {
      S.dmBusy = false; S.stopFlag = false; S.paused = false;
      jobFinish(`Bitti — silinen ${okN}, hata ${fail}.`);
      saveCache();
      render();
    }
  }

  // --- Yedek (dışa aktarma): geri çekmeden önce mesajları dosyaya kaydet ---
  function sanitizeName(s) { return String(s).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 50); }
  function buildBackup(who, items) {
    const sorted = items.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
    let out = `Instagram DM yedeği — ${who}\n`;
    out += `Dışa aktarma: ${fmtDate(Date.now())}\n`;
    out += `Toplam: ${items.length} mesaj (yalnızca senin gönderdiklerin)\n`;
    out += "-".repeat(50) + "\n";
    sorted.forEach((it) => { out += `[${fmtDate(it.ts ? it.ts / 1000 : 0)}] ${it.text ? it.text : "[" + it.type + "]"}\n`; });
    return out;
  }
  function exportBackup(who, items) {
    const name = `instagram-dm-${sanitizeName(who)}-${Date.now()}.txt`;
    return post({ type: "export", name, content: buildBackup(who, items), label: "DM yedeği kaydedildi" }) ? name : null;
  }

  // --- Bir kişiye gönderdiğim mesajları geri çek (iki taraftan da siler) ---
  async function fetchMyMessages(threadId, onProgress) {
    const myId = getCookie("ds_user_id");
    const items = [];
    let cursor = "", guard = 0;
    const base = `https://www.instagram.com/api/v1/direct_v2/threads/${threadId}/?limit=20`;
    while (true) {
      if (S.stopFlag) break;
      if (++guard > 250) break;
      const url = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
      let res;
      try { res = await api(url); } catch (e) { await sleep(2000); continue; }
      if (res.status === 429) { onProgress && onProgress(items.length, "limit — 30 sn"); await sleep(30000); continue; }
      if (!res.ok) { if (guard === 1) throw new Error("Sohbet okunamadı (HTTP " + res.status + ")"); break; }
      let d; try { d = await res.json(); } catch (e) { break; }
      const th = d.thread || {};
      (th.items || []).forEach((it) => {
        if (String(it.user_id) === String(myId) && it.item_type !== "action_log") {
          items.push({ id: it.item_id, type: it.item_type, text: it.text || "", ts: it.timestamp });
        }
      });
      onProgress && onProgress(items.length, "");
      cursor = th.oldest_cursor;
      if (!th.has_older || !cursor) break;
      await sleep(rand(500, 1000));
    }
    return items;
  }

  async function unsendItem(threadId, itemId) {
    const csrf = getCookie("csrftoken");
    const res = await api(`https://www.instagram.com/api/v1/direct_v2/threads/${threadId}/items/${itemId}/delete/`, {
      method: "POST",
      headers: { "x-csrftoken": csrf, "x-instagram-ajax": "1", "content-type": "application/x-www-form-urlencoded" },
      body: "",
    });
    let ok = res.ok;
    try { const j = await res.json(); ok = ok && (j.status === "ok"); } catch (e) {}
    if (!ok) throw new Error("HTTP " + res.status);
    return true;
  }

  async function retractMessages(threadId) {
    if (guardBusy()) return;
    const who = threadName(S.dmThreads.find((x) => x.id === threadId));
    S.dmBusy = true; S.stopFlag = false; S.paused = false;
    startJob({ title: `${who}: gönderdiğin mesajlar aranıyor` });
    let summary = "";
    try {
      const mine = await fetchMyMessages(threadId, (n, m) => setStatus(`${n} mesajın bulundu ${m}`));
      if (S.stopFlag) { summary = "Durduruldu."; return; }
      if (!mine.length) { summary = "Bu sohbette senin gönderdiğin, geri çekilebilir mesaj bulunamadı."; return; }

      const wantBackup = lsGet("igd_dm_backup", "0") === "1";
      setStatus(`${mine.length} mesaj bulundu — onay bekleniyor`);
      const ok = await askConfirm({
        title: `${who}: ${mine.length} mesaj geri çekilecek`,
        html: `<p>Bu sohbette <b>senin gönderdiğin ${mine.length} mesaj</b> geri çekilecek. Mesajlar <b>karşı taraftan da silinir ve geri alınamaz.</b></p>
          <p class="igd-note">Çok sayıda mesajı geri çekmek geçici engele yol açabilir.${wantBackup ? " Başlamadan önce mesajlarının bir yedeği (tarih + metin) Downloads klasörüne kaydedilecek." : " Yedek kapalı — açmak için listedeki “Geri çekmeden önce yedekle” kutusunu işaretle."}</p>`,
        estimate: mine.length * 7,
        danger: true, okLabel: `Geri çek (${mine.length})`, typeWord: "GERİ ÇEK",
      });
      if (!ok) { summary = "İptal edildi."; return; }

      // Geri çekmeden önce yedek al — yalnızca "Yedekle" işaretliyse
      if (wantBackup) {
        const backupName = exportBackup(who, mine);
        if (backupName) {
          jobLog(`💾 Yedek kaydedildi: Downloads/${backupName}`, "done");
          toast(`Yedek kaydedildi: Downloads/${backupName}`);
          await sleep(900);
        } else {
          const go = await askConfirm({ title: "Yedek kaydedilemedi", html: "<p>Mesajların yedeklenemedi. Yine de yedeksiz devam edilsin mi?</p>", danger: true, okLabel: "Yedeksiz devam et" });
          if (!go) { summary = "İptal edildi."; return; }
        }
      }

      jobReset({ title: `${who}: mesajlar geri çekiliyor`, total: mine.length, pausable: true });
      let done = 0, okN = 0, fail = 0;
      for (const it of mine) {
        await waitIfPaused();
        if (S.stopFlag) { jobLog("⏹ Kullanıcı durdurdu.", "warn"); break; }
        try {
          await unsendItem(threadId, it.id);
          okN++; jobLog(`✓ geri çekildi: ${it.text ? '"' + it.text.slice(0, 40) + '"' : "[" + it.type + "]"}`, "ok");
        } catch (e) { fail++; jobLog(`✗ geri çekilemedi (${e.message})`, "err"); }
        done++;
        jobProgress(done, mine.length, okN, fail);
        if (done < mine.length && !S.stopFlag) {
          await pSleep(rand(2000, 4000)); // mesaj geri çekmede daha temkinli
          if (done % 10 === 0 && !S.stopFlag) { jobLog("⏳ Güvenlik molası ~30 sn...", "warn"); await pSleep(30000); }
        }
      }
      summary = `${who}: ${okN} mesaj geri çekildi${fail ? `, ${fail} hata` : ""}.`;
    } catch (e) {
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally { S.dmBusy = false; S.stopFlag = false; S.paused = false; jobFinish(summary); render(); }
  }
