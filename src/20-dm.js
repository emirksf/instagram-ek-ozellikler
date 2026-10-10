
  // ================================================================ DM'lerim: veri ve işlemler
  // Instagram 10 Ekim 2026'da web'deki direct_v2 REST uçlarını kaldırdı (404, HTML yanıt). Okumalar artık
  // Instagram'ın GraphQL sorgularıyla yapılıyor; yeni yol, tanılama raporuyla yanıt yapısı görülünce eklenecek.
  const DM_GONE_MSG = "Instagram web'deki DM erişimini değiştirdi (eski uç artık yok). DM kutusu şu an bu uygulamayla okunamıyor; kayıtlı DM verin kullanılmaya devam ediyor.";
  const dmGone = () => !!parseInt(lsGet("igd_dm_gone", "0"), 10);
  function markDmGone() { if (!dmGone()) lsSet("igd_dm_gone", String(Date.now())); }
  const dmGoneErr = (res) => { if (res.status === 404) { markDmGone(); return new Error(DM_GONE_MSG); } return null; };

  // ================================================================ DM: GraphQL istemcisi
  // Sorgu kimlikleri (doc_id) Instagram'ın web istemcisinden alındı (tanılama raporu, 10 Ekim 2026).
  // Instagram bunları değiştirirse capture/00-capture.js, DM kutusu Instagram görünümünde bir kez açıldığında
  // güncel kimlikleri kendiliğinden öğrenir (igd_gql_docs). Oturum anahtarları yalnızca bellekteki şablondan gelir.
  const GQL_DEFAULTS = {
    PolarisDirectInboxQuery: { doc_id: "27909866362025854", vars: {
      __relay_internal__pv__IGDIsProfessionalAccountGKrelayprovider: true,
      __relay_internal__pv__IGDPinnedThreadsRenderEnabledGKrelayprovider: true,
      __relay_internal__pv__IGDMaxUnreadMessagesCountrelayprovider: 9,
      __relay_internal__pv__IGDThreadListActionsEnabledGKrelayprovider: true } },
    IGDThreadListProfessionalOffMsysPaginationQuery: { doc_id: "28415566141432177", vars: {
      system_folder: "INBOX",
      __relay_internal__pv__IGDPinnedThreadsRenderEnabledGKrelayprovider: true,
      __relay_internal__pv__IGDMaxUnreadMessagesCountrelayprovider: 9,
      __relay_internal__pv__IGDThreadListActionsEnabledGKrelayprovider: true } },
  };
  const GQL_HINT = "Instagram görünümüne geçip DM kutunu bir kez açarsan uygulama Instagram'ın güncel sorgu kimliklerini öğrenir; sonra yeniden dene.";
  const gqlDocs = () => Object.assign({}, GQL_DEFAULTS, lsJSON("igd_gql_docs", {}));
  function gqlErr(msg, unavailable) { const e = new Error(msg); if (unavailable) e.gqlUnavailable = true; return e; }
  function uuid4() {
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // İstek şablonu: Instagram'ın kendi son GraphQL isteği (bellekte). Yoksa sayfadaki anahtarlardan asgari şablon kurulur.
  async function gqlTemplate() {
    for (let i = 0; i < 20 && !window.__igdGql; i++) await sleep(250);
    if (window.__igdGql) return { params: new URLSearchParams(window.__igdGql.params), headers: window.__igdGql.headers || {} };
    const html = document.documentElement.innerHTML;
    const dtsg = (html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/) || [])[1];
    const lsd = (html.match(/"LSD",\[\],\{"token":"([^"]+)"/) || [])[1];
    if (!dtsg || !lsd) throw gqlErr("Instagram oturum anahtarları bulunamadı. Instagram görünümünde sayfayı bir kez yenileyip tekrar dene.", true);
    let sum = 0; for (const ch of dtsg) sum += ch.charCodeAt(0);
    return { params: new URLSearchParams({ __a: "1", __user: "0", __comet_req: "7", fb_dtsg: dtsg, lsd, jazoest: "2" + sum }), headers: {} };
  }

  async function gql(name, vars) {
    const doc = gqlDocs()[name];
    if (!doc) throw gqlErr(`Instagram sorgusu bilinmiyor (${name}). ${GQL_HINT}`, true);
    const tpl = await gqlTemplate();
    const p = tpl.params;
    ["fb_api_analytics_tags", "qpl_active_flow_ids", "__crn"].forEach((k) => p.delete(k));
    p.set("fb_api_caller_class", "RelayModern");
    p.set("fb_api_req_friendly_name", name);
    p.set("server_timestamps", "true");
    p.set("variables", JSON.stringify(vars));
    p.set("doc_id", doc.doc_id);
    const headers = {
      "content-type": "application/x-www-form-urlencoded",
      "x-fb-friendly-name": name,
      "x-ig-app-id": tpl.headers["x-ig-app-id"] || APP_ID,
      "x-fb-lsd": p.get("lsd") || tpl.headers["x-fb-lsd"] || "",
      "x-asbd-id": tpl.headers["x-asbd-id"] || "359341",
      "x-csrftoken": getCookie("csrftoken") || "",
    };
    const doFetch = window.__igdNativeFetch || fetch;
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      try { res = await doFetch("https://www.instagram.com/api/graphql", { method: "POST", headers, body: p.toString(), credentials: "include" }); }
      catch (e) { await sleep(2000); continue; }
      if (res.status === 429) { setStatus("hız limiti — 30 sn bekleniyor"); await sleep(30000); continue; }
      break;
    }
    if (!res) throw new Error("Instagram'a bağlanılamadı.");
    if (res.status === 404) throw gqlErr(`Instagram DM sorgusu bulunamadı (HTTP 404). ${GQL_HINT}`, true);
    if (!res.ok) throw new Error(`Instagram DM sorgusu reddedildi (HTTP ${res.status}).`);
    const text = (await res.text()).replace(/^for \(;;\);/, "");
    const first = text.split(/\r?\n/).find((l) => l.trim().startsWith("{"));
    let j; try { j = JSON.parse(first); } catch (e) { throw gqlErr(`Instagram DM yanıtı okunamadı. ${GQL_HINT}`, true); }
    if (!j.data && j.errors && j.errors.length) throw gqlErr(`Instagram DM sorgusu hata verdi: ${j.errors[0].message || j.errors[0].summary || "bilinmeyen"}. ${GQL_HINT}`, true);
    return j;
  }

  // Sohbet düğümünü uygulamanın sohbet biçimine çevir (eski REST biçimiyle aynı alanlar)
  function threadFromGql(n) {
    const t = n && (n.as_ig_direct_thread || n);
    if (!t || !t.thread_id) return null;
    const users = (t.users || []).map((u) => ({ pk: String(u.pk || u.id), username: u.username, pic: u.profile_pic_url }));
    const group = t.is_group === true || users.length > 1;
    const act = parseInt(t.last_activity_timestamp_ms, 10) || 0;
    return { id: String(t.thread_id), fbid: String(t.thread_fbid || ""), folder: t.folder || null, users, group, act,
      title: t.thread_title || users.map((u) => u.username).join(", ") };
  }

  async function fetchDMThreadsGql(onProgress) {
    const map = {}, threads = [], seen = new Set(), folders = new Set();
    const add = (node) => {
      const th = threadFromGql(node); if (!th || seen.has(th.id)) return;
      seen.add(th.id); threads.push(th);
      if (th.folder) folders.add(th.folder);
      if (!th.group && th.users.length === 1) { const pk = th.users[0].pk; if (!map[pk] || th.act > map[pk]) map[pk] = th.act; }
    };
    const docs = gqlDocs();
    const deviceId = lsGet("igd_dm_device", "") || (lsSet("igd_dm_device", uuid4()), lsGet("igd_dm_device", ""));
    const first = await gql("PolarisDirectInboxQuery", Object.assign({}, docs.PolarisDirectInboxQuery.vars, { device_id_for_iris_subscription: deviceId }));
    const mb = first.data && first.data.get_slide_mailbox_for_iris_subscription;
    if (!mb) throw gqlErr(`Instagram DM yanıtı beklenen biçimde değil. ${GQL_HINT}`, true);
    const main = mb.threads_by_system_folder_and_ig_inbox_folder;
    [main, mb.threads_by_folder].forEach((c) => ((c && c.edges) || []).forEach((e) => add(e.node)));
    (mb.pinned_threads_v2 || []).forEach(add);
    let pages = 1;
    onProgress && onProgress(pages, threads.length, "");

    // Sayfalama: Instagram'ın öğrenilmiş sayfalama sorgusu (profesyonel hesapta klasör bazlı)
    const pagName = Object.keys(docs).find((k) => /^IGDThreadList\w*PaginationQuery$/.test(k) && lsJSON("igd_gql_docs", {})[k]) || "IGDThreadListProfessionalOffMsysPaginationQuery";
    const pag = docs[pagName];
    const learnedFolder = pag.vars && pag.vars.ig_inbox_folder;
    const order = [...new Set([learnedFolder, ...folders].filter(Boolean))];
    if (!order.length) order.push(null);
    let partial = false;
    for (const folder of order) {
      let cursor = folder === order[0] && main && main.page_info ? main.page_info.end_cursor : null;
      let hasNext = folder === order[0] && main && main.page_info ? !!main.page_info.has_next_page : true;
      let count = 20, guard = 0;
      while (hasNext && !S.stopFlag && ++guard <= 100) {
        const vars = Object.assign({}, pag.vars, { count, cursor, id: mb.id });
        if (folder) vars.ig_inbox_folder = folder;
        let r;
        try { r = await gql(pagName, vars); }
        catch (e) {
          // Instagram büyük sayfayı reddederse kendi kullandığı sayfa boyutuna dön
          if (count !== (pag.vars.count || 9)) { count = pag.vars.count || 9; continue; }
          if (folder !== order[0]) break; // tahmin edilen ikinci klasör yoksa sorun değil
          partial = true; jobLog(`DM listesinin devamı alınamadı: ${e.message}`, "warn"); break;
        }
        const conn = r.data && r.data.fetch__SlideMailbox && r.data.fetch__SlideMailbox.threads_by_system_folder_and_ig_inbox_folder;
        if (!conn) { partial = true; break; }
        (conn.edges || []).forEach((e) => add(e.node));
        pages++;
        onProgress && onProgress(pages, threads.length, "");
        cursor = conn.page_info && conn.page_info.end_cursor;
        hasNext = !!(conn.page_info && conn.page_info.has_next_page && cursor);
        await sleep(rand(500, 1000));
      }
    }
    // Güvenlik kontrolü: DM kişileri takip listesindeki kimliklerle eşleşmeli (Instagram kimlik biçimini değiştirirse uyar)
    const dmPks = Object.keys(map);
    if (S.following.length > 50 && dmPks.length > 20 && !dmPks.some((pk) => S.followingIds.has(pk))) {
      jobLog("Uyarı: DM'deki kişiler takip listendeki hiçbir kimlikle eşleşmedi; Etkileşimsizler sekmesi yanıltıcı olabilir.", "warn");
    }
    if (partial) jobLog(`DM listesi kısmi (${threads.length} sohbet). ${GQL_HINT}`, "warn");
    return { map, threads };
  }

  // --- Uyumluluk tanılaması (capture/00-capture.js ile birlikte çalışır) ---
  const capActive = () => lsGet("igd_dmcap", "0") === "1" && Date.now() - parseInt(lsGet("igd_dmcap_t", "0"), 10) < 30 * 60000;
  const capEntries = () => lsJSON("igd_dmcap_data", []);
  async function startDmCapture() {
    const ok = await askConfirm({
      title: "DM uyumluluk tanılaması",
      html: `<p>Instagram'ın DM kutunu açarken yaptığı isteklerin <b>yalnızca yapısını</b> kaydeder: sorgu adı, sorgu kimliği, alan adları ve veri türleri. Bu rapor yeni DM okuma yolunu doğru yazmak için gerekiyor.</p>
        <p><b>Kaydedilmeyenler:</b> kişi adları, mesajlar, kimlik numaraları, oturum anahtarları ve çerezler. Rapor yalnızca bu Mac'te, Downloads klasörüne kaydedilir; hiçbir yere gönderilmez.</p>
        <p class="igd-note">Devam edersen Instagram DM kutun açılır. Görmek istediğin işlemi Instagram'da bir kez yap (ör. bir sohbete gir, bir mesajı geri çek), sonra üstteki “Denetim paneline dön” ile buraya gelip “Raporu kaydet”e bas. Tanılama 30 dakika sonra kendiliğinden kapanır.</p>`,
      okLabel: "Başlat ve DM kutusunu aç",
    });
    if (!ok) return;
    lsSet("igd_dmcap", "1"); lsSet("igd_dmcap_t", String(Date.now()));
    try { localStorage.removeItem("igd_dmcap_data"); } catch (e) {}
    setView("ig");
    location.href = "https://www.instagram.com/direct/inbox/"; // tam yükleme: tanılama sayfa başında devreye girer
  }
  function saveDmCapture() {
    const entries = capEntries();
    if (!entries.length) { toast("Henüz yakalanan istek yok — Instagram görünümünde DM kutunu açıp birkaç sohbete tıkla.", true); return; }
    const name = `instagram-dm-tanilama-${stampNow()}.json`;
    saveTextFile(name, JSON.stringify({ app: "instadenetim-dm-tanilama", v: 1, t: Date.now(), surum: "4.1", entries }, null, 2),
      "DM tanılama raporu kaydedildi", `Tanılama raporu Downloads/${name} dosyasına kaydedildi ✓ (${entries.length} istek)`);
  }
  function stopDmCapture() {
    lsSet("igd_dmcap", "0");
    try { localStorage.removeItem("igd_dmcap_data"); } catch (e) {}
    toast("Tanılama kapatıldı; bir sonraki sayfa yüklemesinde tamamen devre dışı kalır.");
    render();
  }
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
    if (!ok) throw new Error(res.status === 404 ? "HTTP 404 (Instagram web'de sohbet silmeyi kaldırdı)" : "HTTP " + res.status);
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

  // Kişiyle sohbeti bul. Instagram'ın eski uçları (get_by_participants / inbox) web'de kalktığı için
  // önce yüklü DM listesinde aranır; liste yoksa DM kutusu taranır.
  async function dmFindPerson() {
    const uname = (($("igd-dm-find") || {}).value || "").trim().replace(/^@/, "").toLowerCase();
    if (!uname) { toast("Bir kullanıcı adı yaz.", true); return; }
    if (!S.dmThreads.length) { toast("Önce DM kutusunu tara; sonra kişiyi yüklü listede bulurum.", true); return; }
    const hit = S.dmThreads.find((t) => !t.group && t.users.some((u) => (u.username || "").toLowerCase() === uname));
    if (!hit) { toast(`@${uname} ile yüklü sohbet bulunamadı. DM kutusunu yenileyip tekrar dene.`, true); return; }
    S.dmQuery = uname;
    const q = $("igd-dm-q"); if (q) q.value = uname;
    render();
    toast(`@${uname} sohbeti listede gösteriliyor.`);
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
    let done = 0, okN = 0, fail = 0, had404 = false, consecutive = 0;
    const hist = [];
    try {
      for (const id of ids) {
        await waitIfPaused();
        if (S.stopFlag) { jobLog("⏹ Kullanıcı durdurdu.", "warn"); break; }
        const name = threadName(S.dmThreads.find((x) => x.id === id));
        try {
          await hideThread(id);
          okN++; consecutive = 0; jobLog(`✓ ${name} silindi`, "ok");
          hist.push({ t: Date.now(), a: "dmdelete", pk: id, u: name.replace(/^@/, ""), ok: true });
          S.dmThreads = S.dmThreads.filter((x) => x.id !== id);
          S.dmSel.delete(id);
        } catch (e) {
          fail++; consecutive++; if (/404/.test(e.message)) had404 = true;
          jobLog(`✗ ${name} silinemedi (${e.message})`, "err");
        }
        done++;
        jobProgress(done, ids.length, okN, fail);
        if (consecutive >= 3) { jobLog("Art arda 3 hata — hesabını korumak için durduruldu.", "warn"); break; }
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
      if (hist.length) { hist.forEach((h) => S.hist.push(h)); histAdd(hist).catch(() => {}); }
      jobFinish(`Bitti — silinen ${okN}, hata ${fail}${done < ids.length ? `, ${ids.length - done} sohbet işlenmedi` : ""}.`);
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
      if (!res.ok) { if (guard === 1) throw dmGoneErr(res) || new Error("Sohbet okunamadı (HTTP " + res.status + ")"); break; }
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
      let done = 0, okN = 0, fail = 0, consecutive = 0;
      for (const it of mine) {
        await waitIfPaused();
        if (S.stopFlag) { jobLog("⏹ Kullanıcı durdurdu.", "warn"); break; }
        try {
          await unsendItem(threadId, it.id);
          okN++; consecutive = 0; jobLog(`✓ geri çekildi: ${it.text ? '"' + it.text.slice(0, 40) + '"' : "[" + it.type + "]"}`, "ok");
        } catch (e) { fail++; consecutive++; jobLog(`✗ geri çekilemedi (${e.message})`, "err"); }
        done++;
        jobProgress(done, mine.length, okN, fail);
        if (consecutive >= 3) { jobLog("Art arda 3 hata — hesabını korumak için durduruldu.", "warn"); break; }
        if (done < mine.length && !S.stopFlag) {
          await pSleep(rand(2000, 4000)); // mesaj geri çekmede daha temkinli
          if (done % 10 === 0 && !S.stopFlag) { jobLog("⏳ Güvenlik molası ~30 sn...", "warn"); await pSleep(30000); }
        }
      }
      summary = `${who}: ${okN} mesaj geri çekildi${fail ? `, ${fail} hata` : ""}.`;
      if (okN) {
        const h = { t: Date.now(), a: "unsend", pk: threadId, u: who.replace(/^@/, "") + ` (${okN} mesaj)`, ok: true };
        S.hist.push(h); histAdd([h]).catch(() => {});
      }
    } catch (e) {
      summary = "Hata: " + e.message; toast(e.message, true);
    } finally { S.dmBusy = false; S.stopFlag = false; S.paused = false; jobFinish(summary); render(); }
  }
