
  // ================================================================ ORTAK: yardımcılar (panel + izleyici)
  const APP_ID = "936619743392459";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a;
  const fmtN = (n) => (typeof n === "number" ? n.toLocaleString("tr-TR") : String(n));

  function getCookie(name) {
    const p = ("; " + document.cookie).split("; " + name + "=");
    if (p.length === 2) return p.pop().split(";").shift();
    return undefined;
  }
  const isLoggedIn = () => !!getCookie("ds_user_id");

  function api(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign(
      { "x-ig-app-id": APP_ID, "x-requested-with": "XMLHttpRequest" },
      opts.headers || {}
    );
    opts.credentials = "include";
    return fetch(url, opts);
  }

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } }
  function post(msg) { try { window.webkit.messageHandlers.igd.postMessage(msg); return true; } catch (e) { return false; } }

  // Takipçi sayfası çekici (panel taraması, izleyicinin derin taraması ve aylık rapor aynı kodu kullanır).
  // Döner: { users, nextMaxId } — sayfa alınamazsa hata fırlatır; 429'da bekleyip yeniden dener.
  async function fetchFollowersPage(uid, maxId, onWait) {
    const url = `https://www.instagram.com/api/v1/friendships/${uid}/followers/?count=100` + (maxId ? `&max_id=${encodeURIComponent(maxId)}` : "");
    for (let attempt = 0; attempt < 8; attempt++) {
      let res;
      try { res = await api(url); } catch (e) { await sleep(3000); continue; }
      if (res.status === 401 || res.status === 403) throw new Error("İstek reddedildi (oturum veya geçici limit).");
      if (res.status === 429) { onWait && onWait("hız limiti — 30 sn bekleniyor"); await sleep(30000); continue; }
      if (!res.ok) { if (res.status === 400 && maxId) throw new Error("CURSOR"); await sleep(2000); continue; }
      let d; try { d = await res.json(); } catch (e) { await sleep(2000); continue; }
      return { users: d.users || [], nextMaxId: d.next_max_id || null };
    }
    throw new Error("Takipçi listesi alınamadı (tekrarlanan bağlantı hatası).");
  }

  // Tarama tam mı? Instagram büyük hesaplarda listeyi erken bitirebiliyor; profildeki sayının
  // belirgin altında kalan bir liste "tam" sayılmaz ve karşılaştırmalarda kullanılmaz.
  const COMPLETE_RATIO = 0.95;
  function isCompleteList(got, expected) {
    if (!expected) return true; // sayı bilinmiyorsa doğal bitişe güven
    return got >= Math.floor(expected * COMPLETE_RATIO);
  }
