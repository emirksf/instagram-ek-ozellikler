(function () {
  "use strict";

  // Panel yalnızca Instagram'ın ana çerçevesinde çalışır (SocialBlade / profil pencereleri hariç).
  if (window.top !== window) return;
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  if (window.__igd) { window.__igd.open(); return; }

  const APP_ID = "936619743392459";
  const WL_KEY = "igd_whitelist_v2";

  // ---------------------------------------------------------------- state
  const S = {
    following: [],
    followers: [],
    followingIds: new Set(),
    followerIds: new Set(),
    section: "analysis",    // kenar çubuğunda seçili sayfa
    cat: "non",             // liste sayfalarında seçili sekme
    catBySec: { analysis: "non", followers: "fans" },
    selected: new Set(),
    lastSelIdx: -1,         // Shift+tık aralık seçimi için son tıklanan satır
    whitelist: loadWhitelist(),
    query: "",
    acctFilter: "all",      // all | private | public | verified | noverified
    sortBy: {},             // sekme → sıralama anahtarı
    running: false,        // takip alt sistemi (analiz/takipçi taraması/toplu takip işlemi)
    dmBusy: false,         // DM alt sistemi (yükle/bul/sil/geri çek/etkileşim)
    pfBusy: false,         // profil izleme (Getir)
    stopFlag: false,
    paused: false,
    job: null,             // işlem tepsisinde gösterilen iş
    statusText: "Hazır.",
    scanned: false,
    detecting: false,       // geri-takip analizi sürüyor mu (sonuç henüz güvenilir değil)
    followersFull: false,   // tüm takipçi listesi çekildi mi (hayranlar sekmesi için)
    followersLoading: false, // takipçi taraması akış hâlinde mi (canlı göster)
    followerCount: null,    // profildeki gerçek takipçi sayısı
    followingCount: null,
    cacheTime: 0,
    followingScanTime: 0,   // takip listesi ne zaman tarandı
    followersScanTime: 0,   // takipçiler ne zaman tarandı
    dmScanTime: 0,          // DM kutusu ne zaman tarandı
    dmMap: {},              // pk -> son DM etkileşimi (ms)
    dmThreads: [],          // {id, users:[{pk,username,pic}], group, act(ms)}
    dmScanned: false,
    idleDays: 0,            // Etkileşimsizler süzgeci (0=tümü, -1=hiç DM yok)
    dmSel: new Set(),       // DM'lerim'de seçili thread id'leri
    dmLastIdx: -1,
    dmFilter: "all",
    dmQuery: "",
    _botVerifyTried: false, // şüpheli sekmesinde sayıları bir kez otomatik getir
    pfUser: null,           // Profil izleme: bakılan hesap
    pfFollowing: null,      // o hesabın takip listesi
    pfReverse: false,       // en önce takip edilenler önce
    vis: [],                // son çizilen görünür liste (sanal liste bunu kullanır)
  };

  // Liste sekmeleri. sec: hangi kenar çubuğu sayfasında, src: hangi veri kaynağına muhtaç.
  const CATS = {
    non:    { sec: "analysis",  src: "following", label: "Geri takip etmeyenler", action: "unfollow", empty: "Herkes seni geri takip ediyor 🎉" },
    mutual: { sec: "analysis",  src: "following", label: "Karşılıklı",            action: "unfollow", empty: "Karşılıklı takip bulunamadı." },
    idle:   { sec: "analysis",  src: "dm",        label: "Etkileşimsizler",       action: "unfollow", empty: "Bu süzgece uyan kimse yok." },
    all:    { sec: "analysis",  src: "following", label: "Takip ettiklerin",      action: "unfollow", empty: "Liste boş." },
    fans:   { sec: "followers", src: "followers", label: "Hayranların",           action: "follow",   empty: "Seni tek taraflı takip eden yok." },
    bots:   { sec: "followers", src: "followers", label: "Şüpheli/Bot",           action: "remove",   empty: "Şüpheli takipçi bulunamadı 🎉" },
  };

  // Toplu işlem fiilleri — her yerde aynı kelimeler
  const ACTIONS = {
    unfollow: { btn: "Takibi bırak",     done: "takibi bırakıldı",          title: "Takip bırakılıyor",          kind: "destroy" },
    follow:   { btn: "Takip et",         done: "takip edildi",              title: "Takip ediliyor",             kind: "create" },
    remove:   { btn: "Takipçimden çıkar", done: "takipçilerinden çıkarıldı", title: "Takipçilerinden çıkarılıyor", kind: "remove_follower" },
  };

  // ---------------------------------------------------------------- utils
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a;
  const $ = (id) => document.getElementById(id);
  const fmtN = (n) => (typeof n === "number" ? n.toLocaleString("tr-TR") : String(n));

  function getCookie(name) {
    const p = ("; " + document.cookie).split("; " + name + "=");
    if (p.length === 2) return p.pop().split(";").shift();
    return undefined;
  }
  const isLoggedIn = () => !!getCookie("ds_user_id");
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function post(msg) { try { window.webkit.messageHandlers.igd.postMessage(msg); return true; } catch (e) { return false; } }

  function loadWhitelist() {
    try { return new Set(JSON.parse(localStorage.getItem(WL_KEY) || "[]").map(String)); }
    catch (e) { return new Set(); }
  }
  function saveWhitelist() { lsSet(WL_KEY, JSON.stringify([...S.whitelist])); }

  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign(
      { "x-ig-app-id": APP_ID, "x-requested-with": "XMLHttpRequest" },
      opts.headers || {}
    );
    opts.credentials = "include";
    return fetch(url, opts);
  }

  // Aynı anda tek ağ işlemi: hem hız limitine karşı güvenli hem durdur/duraklat tek işe bağlı.
  const isBusy = () => S.running || S.dmBusy || S.pfBusy;
  function guardBusy() {
    if (!isBusy()) return false;
    toast("Bir işlem sürüyor — alttaki tepsiden bitmesini bekle ya da durdur.", true);
    return true;
  }

  // Duraklatılabilir bekleme: duraklatılmışken süre işlemez, Durdur'da hemen çıkar.
  async function waitIfPaused() { while (S.paused && !S.stopFlag) await sleep(250); }
  async function pSleep(ms) {
    let left = ms;
    while (left > 0 && !S.stopFlag) {
      await waitIfPaused();
      const step = Math.min(250, left);
      await sleep(step); left -= step;
    }
  }

  // --- Tarama sonucunu kalıcı sakla (sayfa yenilense/gezilse de kaybolmasın) ---
  const CACHE_KEY = "igd_scan_cache_v2";
  const slim = (u) => ({ pk: u.pk, username: u.username, full_name: u.full_name,
    is_private: u.is_private, is_verified: u.is_verified, profile_pic_url: u.profile_pic_url,
    has_anonymous_profile_picture: u.has_anonymous_profile_picture, _info: u._info });
  const slimNoPic = (u) => ({ pk: u.pk, username: u.username, full_name: u.full_name,
    is_private: u.is_private, is_verified: u.is_verified,
    has_anonymous_profile_picture: u.has_anonymous_profile_picture, _info: u._info });

  const slimThread = (t) => t;
  const slimThreadNoPic = (t) => ({ id: t.id, group: t.group, act: t.act, title: t.title,
    users: t.users.map((u) => ({ pk: u.pk, username: u.username })) });

  function buildCache(mapper, tmapper) {
    return {
      t: Date.now(),
      following: S.following.map(mapper),
      followers: S.followersFull ? S.followers.map(mapper) : [],
      fb: [...S.followerIds],          // geri takip eden id'ler (show_many'den)
      full: S.followersFull,
      fc: S.followerCount, gc: S.followingCount,
      dm: S.dmMap, dmS: S.dmScanned, dmT: S.dmThreads.map(tmapper),
      tGf: S.followingScanTime, tFo: S.followersScanTime, tDm: S.dmScanTime,
    };
  }
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(buildCache(slim, slimThread))); }
    catch (e) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(buildCache(slimNoPic, slimThreadNoPic))); } catch (e2) {}
    }
  }
  function loadCache() {
    try {
      const d = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!d || !Array.isArray(d.following)) return false;
      S.following = d.following;
      S.followers = Array.isArray(d.followers) ? d.followers : [];
      S.followingIds = new Set(d.following.map((u) => String(u.pk)));
      S.followerIds = new Set((d.fb || []).map(String));
      S.followersFull = !!d.full;
      S.followerCount = d.fc != null ? d.fc : null;
      S.followingCount = d.gc != null ? d.gc : null;
      S.dmMap = d.dm || {};
      S.dmThreads = Array.isArray(d.dmT) ? d.dmT : [];
      S.dmScanned = !!d.dmS;
      S.followingScanTime = d.tGf || d.t || 0;
      S.followersScanTime = d.tFo || 0;
      S.dmScanTime = d.tDm || 0;
      S.scanned = true;
      S.cacheTime = d.t || 0;
      return true;
    } catch (e) { return false; }
  }
  function ageStr(t) {
    if (!t) return "";
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "az önce";
    if (m < 60) return m + " dk önce";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " saat önce";
    return Math.floor(h / 24) + " gün önce";
  }
  function durStr(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + " sn";
    const m = Math.round(sec / 60);
    if (m < 60) return m + " dk";
    return Math.floor(m / 60) + " sa " + (m % 60) + " dk";
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(ms) {
    if (!ms) return "?";
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  // Tam takipçi taramaları arasında "kim ayrıldı" karşılaştırması için anlık görüntü (pk->username).
  const FULLSNAP_KEY = "igd_followers_fullsnap";
  function loadFullSnap() { return lsJSON(FULLSNAP_KEY, null); }
  function saveFullSnap(map) { lsSet(FULLSNAP_KEY, JSON.stringify(map)); }
