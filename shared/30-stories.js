
  // ================================================================ ORTAK: Hikayeme bakanlar (veri)
  // Instagram kimin kaç kez baktığını vermez; izleyici listesini "en son bakan en üstte" sırasıyla verir.
  // Her kontrolde listeyi bir öncekiyle karşılaştırıp sırası öne geçenleri "tekrar baktı" sayarız.
  // Bakışın ne zaman olduğu da iki kontrol arasındaki zaman aralığı olarak kaydedilir.
  const ST = {
    on: "igd_st_on",          // takip açık mı ("1"/"0")
    mode: "igd_st_mode",      // all = tüm aktif hikayeler | sel = yalnızca seçilenler
    sel: "igd_st_sel",        // seçili hikaye kimlikleri (JSON dizi)
    int: "igd_st_int",        // kontrol aralığı (dakika)
    notify: "igd_st_notify",  // tekrar bakanlar için bildirim
    last: "igd_st_last",      // son kontrol (epoch ms)
    err: "igd_st_err",        // son hata metni (boşsa sorun yok)
  };
  const ST_LOG_MAX = 5000;
  const ST_KEEP_DAYS = 30;          // süresi dolan hikayelerin kayıtları bu kadar gün saklanır
  const ST_ORDER_RELIABLE = 50;     // bundan çok izleyicide Instagram sırası kronolojik olmayabilir
  const stOn = () => lsGet(ST.on, "0") === "1";
  const stMode = () => (lsGet(ST.mode, "all") === "sel" ? "sel" : "all");
  const stSel = () => lsJSON(ST.sel, []).map(String);
  const stIntervalMin = () => Math.max(10, Math.min(180, parseInt(lsGet(ST.int, "30"), 10) || 30));

  // Medya kimlikleri 2^53'ten büyük: sayı olarak okunursa bozulur, "pk_kullanıcı" metninden alınır.
  const stMediaPk = (it) => (typeof it.id === "string" && it.id ? it.id.split("_")[0] : String(it.pk));

  // Aktif hikayelerim. Döner: [{pk, taken, exp, video, thumb, count}] — hata fırlatır.
  async function fetchMyStories() {
    const uid = getCookie("ds_user_id");
    if (!uid) throw new Error("Instagram oturumu açık değil.");
    const tries = [
      [`https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${uid}`, (d) => (d.reels && d.reels[uid] && d.reels[uid].items) || (d.reels_media && d.reels_media[0] && d.reels_media[0].items)],
      [`https://www.instagram.com/api/v1/feed/user/${uid}/story/`, (d) => d.reel && d.reel.items],
    ];
    let lastErr = "";
    for (const [url, pick] of tries) {
      let res;
      try { res = await api(url); } catch (e) { lastErr = "bağlantı hatası"; continue; }
      if (res.status === 401 || res.status === 403) throw new Error("İstek reddedildi (oturum veya geçici limit).");
      if (!res.ok) { lastErr = "HTTP " + res.status; continue; }
      let d; try { d = await res.json(); } catch (e) { lastErr = "yanıt okunamadı"; continue; }
      const items = pick(d) || [];
      return items.map((it) => {
        const c = (it.image_versions2 && it.image_versions2.candidates) || [];
        return {
          pk: stMediaPk(it),
          taken: (it.taken_at || 0) * 1000,
          exp: (it.expiring_at || (it.taken_at ? it.taken_at + 86400 : 0)) * 1000,
          video: it.media_type === 2,
          thumb: (c[c.length - 1] || c[0] || {}).url || "",
          count: typeof it.total_viewer_count === "number" ? it.total_viewer_count : (it.viewer_count || 0),
        };
      });
    }
    throw new Error("Hikayeler okunamadı (" + lastErr + ").");
  }

  // Bir hikayenin izleyicileri, Instagram'ın verdiği sırayla (en son bakan en üstte).
  // Döner: {users:[{pk,u,n,p}], total} ya da {gone:true} (hikaye artık yok).
  async function fetchStoryViewers(pk) {
    const users = []; let maxId = "", total = 0, pages = 0, waits = 0;
    while (pages < 30) {
      const url = `https://www.instagram.com/api/v1/media/${pk}/list_reel_media_viewer/` + (maxId ? `?max_id=${encodeURIComponent(maxId)}` : "");
      let res;
      try { res = await api(url); } catch (e) { if (++waits > 3) throw new Error("bağlantı hatası"); await sleep(3000); continue; }
      if (res.status === 401 || res.status === 403) throw new Error("İstek reddedildi (oturum veya geçici limit).");
      if (res.status === 429) { if (++waits > 3) throw new Error("hız limiti"); await sleep(30000); continue; }
      if (res.status === 400 || res.status === 404) { if (!pages) return { gone: true }; break; }
      if (!res.ok) throw new Error("İzleyiciler okunamadı (HTTP " + res.status + ").");
      let d; try { d = await res.json(); } catch (e) { throw new Error("İzleyici yanıtı okunamadı."); }
      (d.users || []).forEach((u) => users.push({ pk: String(u.pk_id || u.pk), u: u.username, n: u.full_name || "", p: u.profile_pic_url || "" }));
      total = d.total_viewer_count || d.user_count || total;
      pages++; maxId = d.next_max_id;
      if (!maxId) break;
      await sleep(rand(700, 1300));
    }
    return { users, total: Math.max(total, users.length) };
  }

  // İki kontrol arası: kim yeni baktı, kim tekrar baktı? (sıralar: en son bakan en üstte)
  // (1) Yeni bir izleyicinin üstünde duran eski izleyici ondan sonra — yani son kontrolden sonra — bakmıştır.
  // (2) Eski izleyicilerin kendi aralarındaki sıra bozulduysa öne geçenler tekrar bakmıştır.
  // Aynı aralıkta birden çok tekrar tek sayılır; en üstteki kişinin tekrarı tek başına görünmez → sayılar alt sınırdır.
  function storyDiff(prevOrder, curOrder) {
    const prevIdx = new Map(prevOrder.map((pk, i) => [pk, i]));
    const fresh = curOrder.filter((pk) => !prevIdx.has(pk));
    const again = new Set();
    let lastNew = -1;
    curOrder.forEach((pk, i) => { if (!prevIdx.has(pk)) lastNew = i; });
    for (let i = 0; i < lastNew; i++) if (prevIdx.has(curOrder[i])) again.add(curOrder[i]);
    const old = curOrder.filter((pk) => prevIdx.has(pk));
    let k = old.length - 1;
    while (k > 0 && prevIdx.get(old[k - 1]) < prevIdx.get(old[k])) k--;
    for (let i = 0; i < k; i++) again.add(old[i]);
    return { fresh, again: [...again] };
  }

  // Bir kontrolün sonucunu hikaye kaydına işler; günlüğe yazılacak olayları döndürür.
  // İzleyici kaydı: {u, n, p, views, first, firstTo, last, lastTo} — bakış [first, firstTo] aralığında oldu.
  function storyApply(rec, res, now) {
    const order = res.users.map((v) => v.pk);
    const ev = [];
    const base = !rec.lastPoll;
    const from = rec.lastPoll || rec.taken || now;
    const d = base ? { fresh: order, again: [] } : storyDiff(rec.order || [], order);
    const isAgain = new Set(d.again), wasListed = new Set(rec.order || []);
    res.users.forEach((v) => {
      const cur = rec.viewers[v.pk];
      if (cur) { cur.u = v.u; cur.n = v.n; if (v.p) cur.p = v.p; }
      if (!cur) {
        rec.viewers[v.pk] = { u: v.u, n: v.n, p: v.p, views: 1, first: from, firstTo: now, last: from, lastTo: now };
        if (!base) ev.push({ t: now, s: rec.pk, k: "new", pk: v.pk, u: v.u, from, n: 1 });
      } else if (isAgain.has(v.pk) || !wasListed.has(v.pk)) {
        // listeden düşüp geri gelen de yeniden bakmış sayılır
        cur.views++; cur.last = from; cur.lastTo = now;
        ev.push({ t: now, s: rec.pk, k: "again", pk: v.pk, u: v.u, from, n: cur.views });
      }
    });
    if (base) ev.push({ t: now, s: rec.pk, k: "base", n: order.length });
    rec.order = order;
    rec.total = res.total;
    if (res.total > ST_ORDER_RELIABLE) rec.unreliable = true;
    rec.polls = (rec.polls || 0) + 1;
    rec.lastPoll = now;
    return ev;
  }

  function storyRecord(meta) {
    return { pk: meta.pk, taken: meta.taken, exp: meta.exp, video: meta.video, thumb: meta.thumb,
      order: [], viewers: {}, total: 0, polls: 0, lastPoll: 0, gone: false, unreliable: false };
  }
  async function stLoad() {
    const d = await DB.get(K.stories);
    return d && d.stories ? d : { v: 1, stories: {}, log: [] };
  }
  function stPrune(d, now) {
    const cut = now - ST_KEEP_DAYS * 86400000;
    for (const pk in d.stories) if ((d.stories[pk].exp || d.stories[pk].taken || 0) < cut) delete d.stories[pk];
    if (d.log.length > ST_LOG_MAX) d.log.splice(0, d.log.length - ST_LOG_MAX);
  }
