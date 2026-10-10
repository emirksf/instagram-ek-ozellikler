
  // ================================================================ TOPLU İŞLEM KUYRUĞU (kalıcı)
  // Seçilen kişiler bir kuyruğa yazılır ve sırayla işlenir. Kuyruk IndexedDB'de durur:
  //  - uygulama kapanırsa kaldığı yerden devam edilebilir,
  //  - günlük sınır dolunca bekler ve sınır açılınca (uygulama açıksa) kendiliğinden sürer,
  //  - Instagram art arda reddederse ("feedback_required" ya da 3 ardışık hata) hesabı korumak için durur.
  // Kuyruk durumları: run (çalışıyor) · paused (kullanıcı durdurdu / yarım kaldı) · wait (günlük sınır) · blocked (Instagram reddetti)
  const SEC_PER_FRIENDSHIP = 16; // 3,5–6,5 sn bekleme + her 6 kişide 45–80 sn mola + istek
  const MAX_CONSECUTIVE_FAILS = 3;
  let queueTimer = null;

  async function saveQueue() {
    try { if (S.queue) await DB.set(K.queue, S.queue); else await DB.del(K.queue); } catch (e) {}
  }
  const queueLeft = (q) => (q ? q.items.length - q.idx : 0);

  // names: {pk: kullanıcı adı} — listede artık olmayan (ör. geçmişten geri alınan) kişiler için
  async function bulkAction(action, pks, names) {
    if (guardBusy()) return;
    if (queueLeft(S.queue) > 0) { toast("Kuyrukta yarım kalan bir işlem var — alttaki tepsiden devam ettir ya da iptal et.", true); return; }
    const A = ACTIONS[action];
    const list = pks.map(String).filter((pk) => action !== "unfollow" || !S.whitelist.has(pk));
    const skipped = pks.length - list.length;
    if (!list.length) { toast("İşlenecek kişi yok (korunanlar hariç tutuldu).", true); return; }
    const items = list.map((pk) => ({ pk, u: (names && names[pk]) || (findUser(pk) || {}).username || pk }));
    const lim = dailyLimit(), left = dailyLeft();
    let limitHtml = "";
    let estimate = items.length * SEC_PER_FRIENDSHIP;
    if (lim && items.length > left) {
      const later = items.length - left;
      const days = Math.ceil(later / lim);
      limitHtml = `<p><b>Günlük sınır:</b> son 24 saatte ${lim - left}/${lim} işlem yapıldı. ${left ? `İlk <b>${left}</b> kişi şimdi işlenir; kalan` : "Bugün hakkın kalmadı;"} <b>${later}</b> kişi sınır açıldıkça (24 saatte en fazla ${lim}) ~${days} günde işlenir. Uygulama açık kaldıkça kendiliğinden sürer.</p>`;
      estimate = left * SEC_PER_FRIENDSHIP;
    } else if (lim) {
      limitHtml = `<p class="igd-note">Günlük sınır: ${lim} · son 24 saatte kalan hak: ${left}. Sınırı Ayarlar'dan değiştirebilirsin.</p>`;
    }
    const ok = await askConfirm({
      title: `${items.length} kişi — ${A.btn}`,
      html: `<p>Aşağıdaki ${items.length} hesap için <b>${esc(A.btn)}</b> işlemi yapılacak.${skipped ? ` Korunan <b>${skipped}</b> hesap hariç tutuldu.` : ""}</p>
        ${limitHtml}
        <p class="igd-note">Hesabını korumak için aralarda otomatik bekleme yapılır. Instagram art arda reddederse işlem kendiliğinden durur. Bu sırada uygulamayı kullanmaya devam edebilir, istediğin an duraklatıp durdurabilirsin.</p>`,
      names: items.map((x) => x.u),
      estimate: estimate || undefined,
      danger: action !== "follow",
      okLabel: `${A.btn} (${items.length})`,
    });
    if (!ok || guardBusy()) return;
    S.queue = { id: Date.now(), uid: getCookie("ds_user_id"), action, items, idx: 0, ok: 0, fail: 0, created: Date.now(), state: "run" };
    await saveQueue();
    runQueue();
  }

  async function runQueue() {
    const q = S.queue;
    if (!q || isBusy()) return;
    clearTimeout(queueTimer);
    // Kuyruk, kurulduğu Instagram hesabına aittir; başka hesapla oturum açıksa çalışmaz
    if (q.uid && q.uid !== getCookie("ds_user_id")) {
      q.state = "paused"; await saveQueue(); renderTray();
      toast("Kuyruk başka bir Instagram hesabında oluşturulmuş; o hesapla oturum açınca devam edebilirsin.", true);
      return;
    }
    // İzleyici o an ağır bir kontrol yapıyorsa bir dakika sonra yeniden dene (sessizce takılı kalmasın)
    if (watcherBusy()) { q.state = "wait"; q.resumeAt = Date.now() + 60000; await saveQueue(); scheduleQueue(); renderTray(); return; }
    if (q.idx >= q.items.length) { S.queue = null; await saveQueue(); renderTray(); return; }
    if (dailyLeft() <= 0) { q.state = "wait"; q.resumeAt = nextSlotAt(); await saveQueue(); scheduleQueue(); renderTray(); return; }
    const A = ACTIONS[q.action];
    S.running = true; S.stopFlag = false; S.paused = false;
    q.state = "run"; await saveQueue();
    startJob({ title: A.title, total: q.items.length, pausable: true });
    jobProgress(q.idx, q.items.length, q.ok, q.fail);
    let consecutive = 0, end = "done", lastErr = "";
    try {
      while (q.idx < q.items.length) {
        await waitIfPaused();
        if (S.stopFlag) { end = "paused"; jobLog("⏹ Kullanıcı durdurdu.", "warn"); break; }
        if (dailyLeft() <= 0) { end = "wait"; break; }
        const it = q.items[q.idx];
        // Kuyruk kurulduktan sonra korunmaya alınan kişiyi atla
        if (q.action === "unfollow" && S.whitelist.has(it.pk)) {
          jobLog(`↷ @${it.u} korunduğu için atlandı`, "info");
          q.idx++; await saveQueue(); continue;
        }
        // Geçmişten geri alınan takipte kişi listede olmayabilir → asgari kayıtla takip ettiklerine ekle
        const user = findUser(it.pk) || (q.action === "follow" ? { pk: it.pk, username: it.u, full_name: "" } : undefined);
        let okk = false, err = "";
        try { await friendship(A.kind, it.pk); okk = true; } catch (e) { err = e.message; }
        const entry = { t: Date.now(), a: q.action, pk: it.pk, u: it.u, ok: okk };
        if (!okk) entry.e = err;
        S.hist.push(entry);
        histAdd([entry]).catch(() => {});
        if (okk) {
          q.ok++; consecutive = 0;
          jobLog(`✓ @${it.u} ${A.done}`, "ok");
          applyLocalChange(q.action, it.pk, user);
          S.selected.delete(it.pk);
        } else {
          q.fail++; consecutive++; lastErr = err;
          jobLog(`✗ @${it.u} başarısız (${err})`, "err");
        }
        q.idx++;
        await saveQueue();
        jobProgress(q.idx, q.items.length, q.ok, q.fail);
        if (q.idx % 3 === 0) render();
        if (/feedback_required|spam/i.test(err) || consecutive >= MAX_CONSECUTIVE_FAILS) { end = "blocked"; break; }
        if (q.idx < q.items.length && !S.stopFlag) {
          await pSleep(rand(3500, 6500));
          if (q.idx % 6 === 0 && !S.stopFlag) {
            const secs = rand(45, 80);
            jobLog(`⏳ Güvenlik molası ~${secs} sn`, "warn");
            setStatus(`Güvenlik molası ~${secs} sn`);
            await pSleep(secs * 1000);
          }
        }
      }
    } finally {
      S.running = false; S.stopFlag = false; S.paused = false;
      if (q.idx >= q.items.length) end = "done";
      const rem = queueLeft(q);
      let summary;
      if (end === "done") {
        summary = `Bitti — başarılı ${q.ok}, hata ${q.fail}.`;
        S.queue = null;
      } else if (end === "wait") {
        q.state = "wait"; q.resumeAt = nextSlotAt();
        summary = `Günlük sınır doldu — ${rem} kişi kuyrukta, ${fmtClock(q.resumeAt)} itibarıyla kendiliğinden devam edecek.`;
      } else if (end === "blocked") {
        q.state = "blocked";
        summary = `Instagram işlemleri reddediyor — hesabını korumak için durduruldu (${rem} kişi kuyrukta).`;
        jobLog(`Son hata: ${lastErr}. Instagram geçici kısıtlama uygulamış olabilir. En az birkaç saat, tercihen 24 saat bekleyip tepsiden “Devam et” ile sürdür.`, "warn");
        post({ type: "notify", title: "Toplu işlem durduruldu", body: "Instagram işlemleri art arda reddetti; hesabını korumak için kuyruk durduruldu.", panel: S.section });
      } else {
        q.state = "paused";
        summary = `Durduruldu — ${rem} kişi kuyrukta. Tepsiden devam edebilir ya da iptal edebilirsin.`;
      }
      await saveQueue();
      jobFinish(summary);
      await saveCache();
      render();
      scheduleQueue();
    }
  }

  // Günlük sınır bekleyen kuyruğu, hak açılınca kendiliğinden sürdür (uygulama açık olduğu sürece).
  function scheduleQueue() {
    clearTimeout(queueTimer);
    const q = S.queue;
    if (!q || q.state !== "wait") return;
    const ms = Math.max(5000, (q.resumeAt || 0) - Date.now());
    queueTimer = setTimeout(() => {
      if (!S.queue || S.queue.state !== "wait") return;
      if (isBusy() || watcherBusy()) { S.queue.resumeAt = Date.now() + 60000; scheduleQueue(); return; }
      runQueue();
    }, Math.min(ms, 2147483000));
  }

  async function resumeQueue() {
    const q = S.queue; if (!q) return;
    if (q.state === "blocked") {
      const ok = await askConfirm({
        title: "Kuyruk sürdürülsün mü?",
        html: "<p>Instagram bu kuyruktaki işlemleri art arda reddetmişti. Kısıtlama sürüyorsa yeniden denemek hesabını daha uzun süre kısıtlatabilir.</p><p class=\"igd-note\">Önerilen: son denemeden sonra en az 24 saat beklemek.</p>",
        danger: true, okLabel: "Yine de devam et",
      });
      if (!ok) return;
    }
    if (guardBusy()) return;
    if (dailyLeft() <= 0) { toast(`Günlük sınır dolu — ${fmtClock(nextSlotAt())} itibarıyla devam edebilir.`, true); return; }
    runQueue();
  }

  async function cancelQueue() {
    const q = S.queue; if (!q) return;
    if (S.running) { toast("Kuyruk şu an çalışıyor — önce tepsiden durdur.", true); return; }
    clearTimeout(queueTimer); // onay penceresi açıkken kendiliğinden yeniden başlamasın
    const ok = await askConfirm({
      title: "Kuyruk iptal edilsin mi?",
      html: `<p>Kalan <b>${queueLeft(q)}</b> kişi işlenmeyecek. Şimdiye kadar yapılanlar geri alınmaz (İşlem Geçmişi'nden tek tek geri alabilirsin).</p>`,
      danger: true, okLabel: "Kuyruğu iptal et",
    });
    if (!ok) { scheduleQueue(); return; }
    if (S.running) { toast("Kuyruk bu arada başladı — önce tepsiden durdur.", true); return; }
    clearTimeout(queueTimer);
    S.queue = null; await saveQueue();
    renderTray(); render();
  }

  // Açılışta: yarım kalan kuyruk "çalışıyor" görünüyorsa duraklatılmış say (kendiliğinden yeniden başlatma yok);
  // günlük sınır bekleyen kuyruk ise sınır açılınca sürer.
  async function loadQueue() {
    try { S.queue = (await DB.get(K.queue)) || null; } catch (e) { S.queue = null; }
    if (!S.queue) return;
    if (queueLeft(S.queue) <= 0) { S.queue = null; await saveQueue(); return; }
    if (S.queue.state === "run") { S.queue.state = "paused"; await saveQueue(); }
    scheduleQueue();
  }
