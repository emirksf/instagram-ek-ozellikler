
  // ================================================================ PANEL: durum ve temel yardımcılar
  const WL_KEY = "igd_whitelist_v2";
  const APP_VER = window.igdNative && window.igdNative.version ? window.igdNative.version.replace(/^(\d+\.\d+)\.0$/, "$1") : "geliştirme";
  // İzleyicinin arka planda sürdüğü yer (pencere kapatılınca)
  const BG_WHERE = window.igdNative && window.igdNative.platform === "win32" ? "sistem tepsisinde" : "menü çubuğunda";

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
    running: false,        // takip alt sistemi (taramalar / toplu takip işlemi)
    dmBusy: false,         // DM alt sistemi
    pfBusy: false,         // profil izleme
    stopFlag: false,
    paused: false,
    job: null,             // işlem tepsisinde gösterilen iş
    statusText: "Hazır.",
    loaded: false,          // IndexedDB'den yükleme bitti mi
    scanned: false,
    detecting: false,       // geri-takip analizi sürüyor mu (sonuç henüz güvenilir değil)
    followersFull: false,   // takipçi listesi TAM mı (Instagram kısaltmadıysa ve durdurulmadıysa)
    followersTrunc: false,  // tarama sonuna kadar gitti ama Instagram listeyi kısalttı
    followersLoading: false, // takipçi taraması akış hâlinde mi (canlı göster)
    followerCount: null,    // profildeki gerçek takipçi sayısı
    followingCount: null,
    cacheTime: 0,
    followingScanTime: 0,
    followersScanTime: 0,
    dmScanTime: 0,
    dmMap: {},              // pk -> son DM etkileşimi (ms)
    dmThreads: [],          // {id, users:[{pk,username,pic}], group, act(ms)}
    dmScanned: false,
    idleDays: 0,            // Etkileşimsizler süzgeci (0=tümü, -1=hiç DM yok)
    dmSel: new Set(),
    dmLastIdx: -1,
    dmFilter: "all",
    dmQuery: "",
    _botVerifyTried: false,
    pfUser: null,
    pfFollowing: null,
    pfReverse: false,
    vis: [],                // son çizilen görünür liste (sanal liste bunu kullanır)
    hist: [],               // işlem geçmişi (IndexedDB'den yüklenir)
    queue: null,            // kalıcı toplu işlem kuyruğu
    likes: null,            // {t, posts, likers:Set, totalLikes, gotLikes} — hayalet takipçiler
    series: [],             // takipçi sayısı geçmişi
    histQuery: "", histFilter: "all",
    protectHintHidden: lsGet("igd_protect_hint_hidden", "0") === "1",
  };

  // Liste sekmeleri. sec: hangi kenar çubuğu sayfasında, src: hangi veri kaynağına muhtaç.
  const CATS = {
    non:    { sec: "analysis",  src: "following", label: "Geri takip etmeyenler", action: "unfollow", empty: "Herkes seni geri takip ediyor 🎉" },
    mutual: { sec: "analysis",  src: "following", label: "Karşılıklı",            action: "unfollow", empty: "Karşılıklı takip bulunamadı." },
    idle:   { sec: "analysis",  src: "dm",        label: "Etkileşimsizler",       action: "unfollow", empty: "Bu süzgece uyan kimse yok." },
    all:    { sec: "analysis",  src: "following", label: "Takip ettiklerin",      action: "unfollow", empty: "Liste boş." },
    fans:   { sec: "followers", src: "followers", label: "Hayranların",           action: "follow",   empty: "Seni tek taraflı takip eden yok." },
    bots:   { sec: "followers", src: "followers", label: "Şüpheli/Bot",           action: "remove",   empty: "Şüpheli takipçi bulunamadı 🎉" },
    ghosts: { sec: "followers", src: "likes",     label: "Hayaletler",            action: "remove",   empty: "Son gönderilerini beğenmeyen takipçi yok 🎉" },
  };

  // Toplu işlem fiilleri — her yerde aynı kelimeler
  const ACTIONS = {
    unfollow: { btn: "Takibi bırak",      done: "takibi bırakıldı",          title: "Takip bırakılıyor",           kind: "destroy" },
    follow:   { btn: "Takip et",          done: "takip edildi",              title: "Takip ediliyor",              kind: "create" },
    remove:   { btn: "Takipçimden çıkar", done: "takipçilerinden çıkarıldı", title: "Takipçilerinden çıkarılıyor", kind: "remove_follower" },
  };
  const HIST_LABELS = { unfollow: "Takibi bırakıldı", follow: "Takip edildi", remove: "Takipçiden çıkarıldı", dmdelete: "Sohbet silindi", unsend: "Mesaj geri çekildi" };

  const $ = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function loadWhitelist() {
    try { return new Set(JSON.parse(localStorage.getItem(WL_KEY) || "[]").map(String)); }
    catch (e) { return new Set(); }
  }
  function saveWhitelist() { lsSet(WL_KEY, JSON.stringify([...S.whitelist])); }

  // Aynı anda tek ağır ağ işi: panel işleri birbirini, izleyicinin ağır işleri de paneli bekletir.
  const isBusy = () => S.running || S.dmBusy || S.pfBusy;
  function guardBusy() {
    if (isBusy()) { toast("Bir işlem sürüyor — alttaki tepsiden bitmesini bekle ya da durdur.", true); return true; }
    if (watcherBusy()) { toast("Arka plan izleyicisi şu an bir kontrol yapıyor; birkaç dakika sonra tekrar dene.", true); return true; }
    return false;
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

  // --- Tarama sonuçları (IndexedDB) ---
  // Profil resmi adresleri birkaç günde geçersizleştiği ve çok yer kapladığı için takipçilerde saklanmaz.
  const slim = (u) => ({ pk: u.pk, username: u.username, full_name: u.full_name,
    is_private: u.is_private, is_verified: u.is_verified, profile_pic_url: u.profile_pic_url,
    has_anonymous_profile_picture: u.has_anonymous_profile_picture, _info: u._info });
  const slimNoPic = (u) => ({ pk: u.pk, username: u.username, full_name: u.full_name,
    is_private: u.is_private, is_verified: u.is_verified,
    has_anonymous_profile_picture: u.has_anonymous_profile_picture, _info: u._info });

  function buildCache() {
    return {
      v: 3, t: Date.now(), needRescan: !!S.needRescan,
      following: S.following.map(slim),
      followers: S.followers.map(slimNoPic),   // kısmi liste de saklanır (bayraklarla)
      fb: [...S.followerIds],
      full: S.followersFull, trunc: S.followersTrunc,
      fc: S.followerCount, gc: S.followingCount,
      dm: S.dmMap, dmS: S.dmScanned, dmT: S.dmThreads,
      tGf: S.followingScanTime, tFo: S.followersScanTime, tDm: S.dmScanTime,
    };
  }
  let saveWarned = false;
  async function saveCache() {
    try { await DB.set(K.cache, buildCache()); saveWarned = false; }
    catch (e) {
      if (!saveWarned) { saveWarned = true; toast("Tarama sonuçları kaydedilemedi: " + (e && e.message || e) + "\nUygulama kapanınca bu sonuçlar kaybolabilir.", true); }
    }
  }
  async function loadCache() {
    try {
      const d = await DB.get(K.cache);
      if (!d || !Array.isArray(d.following)) return false;
      S.following = d.following;
      S.followers = Array.isArray(d.followers) ? d.followers : [];
      S.followingIds = new Set(d.following.map((u) => String(u.pk)));
      S.followerIds = new Set((d.fb || []).map(String));
      // v2 kayıtlarında takipçiler yalnızca tamken saklanıyordu; tamlık ölçütü sonradan geldi
      S.followersFull = !!d.full && S.followers.length > 0 && (d.v >= 3 || isCompleteList(S.followers.length, d.fc));
      S.followersTrunc = !!d.trunc || (!!d.full && !S.followersFull && S.followers.length > 0);
      // Eski sürüm tam takipçi taramasında geri-takip kümesini o listeden kuruyordu; liste eksikse küme de eksik
      // → seni takip edenler "geri takip etmiyor" görünebilir. Takip listesi yeniden taranana kadar o sekmeleri kilitle.
      S.needRescan = !!d.needRescan || (!(d.v >= 3) && !!d.full && !S.followersFull && S.followers.length > 0);
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
    if (m < 2880) return Math.floor(m / 60) + " sa " + (m % 60) + " dk";
    return Math.round(m / 1440) + " gün";
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(ms) {
    if (!ms) return "?";
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function fmtClock(ms) { const d = new Date(ms); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

  // --- Günlük sınır (Ayarlar'dan değişir; 0 = sınırsız) ---
  const dailyLimit = () => Math.max(0, parseInt(lsGet("igd_daily_limit", "150"), 10) || 0);
  function dailyLeft() {
    const lim = dailyLimit(); if (!lim) return Infinity;
    return Math.max(0, lim - dailyUsed(S.hist).length);
  }
  // Sınır dolunca bir sonraki işlem hakkının açılacağı an
  function nextSlotAt() {
    const used = dailyUsed(S.hist).map((e) => e.t).sort((a, b) => a - b);
    const lim = dailyLimit();
    if (!lim || used.length < lim) return Date.now();
    return used[used.length - lim] + 86400000 + 60000;
  }
