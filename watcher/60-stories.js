
  // ================================================================ Hikayeme bakanlar: periyodik kontrol
  // Dakikada bir "vakit geldi mi?" bakar; böylece sayfa yenilense de aralık son kontrolden sayılır.
  let stTimer = null, stBusy = false;

  async function stCheck() {
    const now = Date.now();
    lsSet(ST.last, String(now));
    let active;
    try { active = await fetchMyStories(); }
    catch (e) { lsSet(ST.err, e.message); stChanged(); return; }
    lsSet(ST.err, "");

    const mode = stMode(), sel = new Set(stSel());
    const targets = active.filter((s) => mode === "all" || sel.has(s.pk));
    const activePk = new Set(active.map((s) => s.pk));
    const again = [];
    let err = "";
    await withLock(K.stories, async () => {
      const d = await stLoad();
      for (const meta of targets) {
        const rec = d.stories[meta.pk] || (d.stories[meta.pk] = storyRecord(meta));
        if (meta.thumb) rec.thumb = meta.thumb;
        let res;
        try { res = await fetchStoryViewers(meta.pk); }
        catch (e) { err = e.message; continue; }
        if (res.gone) { rec.gone = true; continue; }
        const ev = storyApply(rec, res, now);
        ev.forEach((e) => { d.log.push(e); if (e.k === "again") again.push(e); });
        await sleep(rand(1200, 2200));
      }
      // Süresi dolan hikayeler: kaydı kalır, bir daha kontrol edilmez
      for (const pk in d.stories) {
        const rec = d.stories[pk];
        if (!rec.gone && !activePk.has(pk) && rec.polls) { rec.gone = true; d.log.push({ t: now, s: pk, k: "gone" }); }
      }
      stPrune(d, now);
      await DB.set(K.stories, d);
    });
    if (err) lsSet(ST.err, err);

    if (again.length && lsGet(ST.notify, "0") === "1") {
      const body = again.slice(0, 6).map((e) => `@${e.u} (${e.n}. kez)`).join(", ") + (again.length > 6 ? ` +${again.length - 6}` : "");
      post({ type: "notify", title: again.length === 1 ? `@${again[0].u} hikayene tekrar baktı 👀` : `${again.length} kişi hikayene tekrar baktı 👀`, body, panel: "stories" });
    }
    // Seçili hikayelerin hepsinin süresi dolduysa takibin sürmesinin anlamı yok
    if (mode === "sel" && sel.size && ![...sel].some((pk) => activePk.has(pk))) {
      stStop();
      post({ type: "notify", title: "Hikaye takibi durdu", body: "Seçtiğin hikayelerin süresi doldu. Kayıtlar Hikayeme bakanlar sayfasında duruyor.", panel: "stories" });
    }
    stChanged();
  }

  // Panel açıksa sayfayı tazelesin
  function stChanged() { try { window.dispatchEvent(new CustomEvent("igd-stories")); } catch (e) {} }

  async function stRun() {
    if (stBusy) return;
    stBusy = true;
    try { await stCheck(); } catch (e) { lsSet(ST.err, String(e && e.message || e)); } finally { stBusy = false; }
  }
  function stTick() {
    if (!stOn() || stBusy || panelBusy()) return; // panel meşgulse bir sonraki dakikaya
    const last = parseInt(lsGet(ST.last, "0"), 10) || 0;
    if (Date.now() - last >= stIntervalMin() * 60000) stRun();
  }
  function stEnsureTimer() {
    if (stOn() && !stTimer) stTimer = setInterval(stTick, 60000);
    if (!stOn() && stTimer) { clearInterval(stTimer); stTimer = null; }
  }
  function stStart() {
    lsSet(ST.on, "1");
    stEnsureTimer();
    return stRun(); // ilk kontrol hemen: o anki izleyiciler temel alınır
  }
  function stStop() {
    lsSet(ST.on, "0");
    stEnsureTimer();
    stChanged();
  }

  const baseBusy = window.__igdWatch.busy;
  Object.assign(window.__igdWatch, {
    busy: () => baseBusy() || stBusy,
    st: {
      start: stStart,
      stop: stStop,
      checkNow: stRun,
      busy: () => stBusy,
      nextAt: () => (stOn() ? (parseInt(lsGet(ST.last, "0"), 10) || 0) + stIntervalMin() * 60000 : 0),
    },
  });

  stEnsureTimer();
  stTick();
