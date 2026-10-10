
  // ================================================================ ARAYÜZ ÇEKİRDEĞİ
  // --- Simge seti (çizgi SVG, currentColor — her cihazda aynı görünür) ---
  const ICONS = {
    analysis: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    block: '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
    play: '<path d="M5 3l14 9-14 9V3z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    chevup: '<path d="m18 15-6-6-6 6"/>',
    chevdown: '<path d="m6 9 6 6 6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    arrowleft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  };
  function ic(name, size) {
    size = size || 16;
    return `<svg class="igd-ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
  }

  // --- Stil ---
  const CSS = `
  :root{
    --igd-bg:#0e0e10; --igd-header:#141417; --igd-panel:#111114; --igd-card:#1a1a1f; --igd-bar:#141417;
    --igd-text:#f2f2f5; --igd-muted:#8a8a92; --igd-muted2:#c9c9d1;
    --igd-border:#26262b; --igd-border2:#2c2c33; --igd-border3:#33333a;
    --igd-input:#17171b; --igd-btn:#1d1d21; --igd-hover:#2a2a30; --igd-ihover:#17171b; --igd-sel:#211521;
    --igd-tagb:#3a3a42; --igd-tagt:#9a9aa2; --igd-empty:#7a7a82; --igd-itext:#fff; --igd-ava:#2a2a31;
    --igd-ov:rgba(0,0,0,.65); --igd-wl:#141a14; --igd-prog:#26262b;
    --igd-dbg:#3a1414; --igd-dbd:#7a1d1d; --igd-dtx:#ff9d9d; --igd-dhv:#4a1919;
    --igd-red:#e5484d; --igd-redhv:#f05a5f; --igd-ok:#5fc46a;
    --igd-shadow:0 8px 30px rgba(0,0,0,.5);
    --igd-blk-bg:#5a1414; --igd-blk-bd:#8a1111; --igd-blk-tx:#ffd0d0; --igd-blk-hv:#6e1818;
    --igd-toast-bg:#26262b; --igd-toast-tx:#fff;
    --igd-log-ok:#7ed081; --igd-log-err:#ff9d9d; --igd-log-warn:#ffd166; --igd-log-done:#7fd0ff; --igd-log-info:#c9c9d1;
    --igd-focus:#e0559a; --igd-accent:#d62976;
  }
  :root.igd-light{
    --igd-bg:#ffffff; --igd-header:#f5f5f7; --igd-panel:#f6f6f8; --igd-card:#ffffff; --igd-bar:#f5f5f7;
    --igd-text:#16161a; --igd-muted:#6b6b73; --igd-muted2:#3f3f47;
    --igd-border:#e3e3e7; --igd-border2:#dcdce2; --igd-border3:#d0d0d8;
    --igd-input:#f0f0f3; --igd-btn:#ececf0; --igd-hover:#e2e2e8; --igd-ihover:#f4f4f7; --igd-sel:#fbeef5;
    --igd-tagb:#cfcfd6; --igd-tagt:#6b6b73; --igd-empty:#8a8a92; --igd-itext:#16161a; --igd-ava:#e2e2e8;
    --igd-ov:rgba(0,0,0,.4); --igd-wl:#e9f6e9; --igd-prog:#e3e3e7;
    --igd-dbg:#ffe3e3; --igd-dbd:#e39a9a; --igd-dtx:#b02525; --igd-dhv:#ffd4d4;
    --igd-red:#d32f2f; --igd-redhv:#b71c1c; --igd-ok:#2e8b3a;
    --igd-shadow:0 8px 30px rgba(0,0,0,.18);
    --igd-blk-bg:#c62828; --igd-blk-bd:#a31f1f; --igd-blk-tx:#fff; --igd-blk-hv:#b02323;
    --igd-toast-bg:#ffffff; --igd-toast-tx:#16161a;
    --igd-log-ok:#1f7a2c; --igd-log-err:#b02525; --igd-log-warn:#8a5a00; --igd-log-done:#1565a8; --igd-log-info:#3f3f47;
    --igd-focus:#c2185b; --igd-accent:#c2185b;
  }
  #igd-root,#igd-fab,.igd-modal,.igd-toast{font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-size:14px;}
  #igd-root{position:fixed;inset:0;z-index:2147483640;display:flex;background:var(--igd-bg);color:var(--igd-text);}
  #igd-root *,.igd-modal *{box-sizing:border-box;margin:0;}
  #igd-root a,.igd-modal a{color:inherit;text-decoration:none;}
  #igd-root a:hover{text-decoration:underline;}
  .igd-ic{flex:0 0 auto;vertical-align:-3px;}
  .igd-grad{background:linear-gradient(90deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5);}
  .igd-sp{flex:1;}

  /* Kenar çubuğu */
  .igd-side{width:216px;flex:0 0 216px;display:flex;flex-direction:column;gap:2px;padding:14px 10px;background:var(--igd-header);border-right:1px solid var(--igd-border);}
  .igd-brandrow{display:flex;align-items:center;gap:10px;padding:2px 8px 16px;}
  .igd-logo{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;flex:0 0 auto;}
  .igd-brand b{font-size:13px;display:block;line-height:1.25;}
  .igd-brand small{color:var(--igd-muted);font-size:11px;}
  .igd-nav{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:10px;border:none;background:none;color:var(--igd-muted2);font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left;}
  .igd-nav:hover{background:var(--igd-hover);color:var(--igd-text);}
  .igd-nav.on{background:var(--igd-card);color:var(--igd-text);box-shadow:inset 3px 0 0 var(--igd-accent),0 1px 0 var(--igd-border);}
  .igd-nav .dot{margin-left:auto;width:8px;height:8px;border-radius:50%;background:var(--igd-accent);animation:igd-pulse 1.4s ease-in-out infinite;}
  @keyframes igd-pulse{50%{opacity:.35;}}
  .igd-navsep{height:1px;background:var(--igd-border);margin:8px 6px;}

  /* Ana alan */
  .igd-main{flex:1;min-width:0;display:flex;flex-direction:column;position:relative;}
  .igd-pagehdr{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--igd-border);}
  .igd-pagehdr h1{font-size:18px;font-weight:700;line-height:1.2;}
  .igd-pagehdr small{display:block;color:var(--igd-muted);font-size:12px;margin-top:2px;}
  .igd-page{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto;}
  .igd-page>*{flex:0 0 auto;}
  .igd-page>.igd-list,.igd-page>.igd-scroll{flex:1 1 auto;min-height:260px;}
  .igd-scroll{flex:1;min-height:0;overflow:auto;}
  .igd-loginbar{display:flex;align-items:center;gap:10px;padding:10px 20px;background:var(--igd-dbg);color:var(--igd-dtx);border-bottom:1px solid var(--igd-dbd);font-size:13px;}

  /* Veri kaynakları */
  .igd-sources{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;padding:12px 20px 0;}
  .igd-src{display:flex;flex-direction:column;gap:3px;min-width:0;background:var(--igd-card);border:1px solid var(--igd-border2);border-radius:12px;padding:9px 12px;}
  .igd-src.none{border-style:dashed;}
  .igd-src .r1{display:flex;align-items:center;gap:7px;font-weight:700;font-size:13px;}
  .igd-src .r1 .igd-btn{margin-left:auto;}
  .igd-src .r2{font-size:12px;color:var(--igd-muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .igd-src .r3{font-size:11px;color:var(--igd-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .igd-src.none .r2{color:var(--igd-muted);}
  .igd-src.partial .r2{color:var(--igd-log-warn);}

  /* İstatistik kartları (tıklanabilir) */
  .igd-stats{display:flex;gap:10px;padding:12px 20px 0;overflow-x:auto;}
  .igd-stat{flex:1;min-width:112px;text-align:left;font:inherit;color:var(--igd-text);background:var(--igd-card);border:1px solid var(--igd-border2);border-radius:12px;padding:9px 13px;cursor:pointer;}
  .igd-stat:hover{border-color:var(--igd-border3);background:var(--igd-ihover);}
  .igd-stat .n{font-size:21px;font-weight:700;line-height:1.2;}
  .igd-stat .l{font-size:11px;color:var(--igd-muted);margin-top:1px;}
  .igd-stat.accent{border-color:var(--igd-accent);}
  .igd-stat.accent .n{background:linear-gradient(90deg,#fa7e1e,#d62976,#962fbf);-webkit-background-clip:text;background-clip:text;color:transparent;}
  .igd-stat.lock .n{font-size:13px;color:var(--igd-accent);display:flex;align-items:center;gap:6px;padding:4px 0 3px;}
  .igd-stat.on{box-shadow:0 0 0 2px var(--igd-accent) inset;}

  .igd-tabs{display:flex;gap:8px;padding:12px 20px 0;flex-wrap:wrap;}
  .igd-tab{font:inherit;padding:7px 14px;border-radius:999px;border:1px solid var(--igd-border2);background:var(--igd-input);color:var(--igd-muted2);cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;}
  .igd-tab .c{opacity:.75;font-weight:500;display:inline-flex;align-items:center;}
  .igd-tab.on{color:#fff;border-color:transparent;background:linear-gradient(90deg,#d62976,#962fbf);}

  .igd-toolbar{display:flex;align-items:center;gap:8px;padding:12px 20px;flex-wrap:wrap;}
  .igd-search{flex:1;min-width:170px;display:flex;align-items:center;gap:8px;background:var(--igd-input);border:1px solid var(--igd-border2);border-radius:10px;padding:7px 11px;color:var(--igd-muted);}
  .igd-search input{flex:1;min-width:0;background:none;border:none;color:var(--igd-itext);outline:none;font:inherit;font-size:14px;}
  .igd-chk{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:var(--igd-muted2);font-size:13px;}
  .igd-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;border:1px solid var(--igd-border3);background:var(--igd-btn);color:var(--igd-text);border-radius:10px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;}
  .igd-btn:hover{background:var(--igd-hover);}
  .igd-btn:disabled{opacity:.4;cursor:not-allowed;}
  .igd-btn[hidden]{display:none;}
  .igd-btn.sm{padding:5px 10px;font-size:12px;border-radius:8px;}
  .igd-btn.primary{border-color:transparent;color:#fff;background:linear-gradient(90deg,#4f5bd5,#962fbf);}
  .igd-btn.primary:hover{filter:brightness(1.08);}
  .igd-btn.danger{border-color:var(--igd-dbd);background:var(--igd-dbg);color:var(--igd-dtx);}
  .igd-btn.danger:hover{background:var(--igd-dhv);}
  .igd-btn.solid{border-color:transparent;background:var(--igd-red);color:#fff;}
  .igd-btn.solid:hover{background:var(--igd-redhv);}
  .igd-btn.ghost{border-color:transparent;background:none;color:var(--igd-muted2);}
  .igd-btn.ghost:hover{background:var(--igd-hover);color:var(--igd-text);}
  #igd-sort{max-width:210px;}
  .igd-sel,.igd-num,.igd-input{font:inherit;background:var(--igd-input);border:1px solid var(--igd-border2);color:var(--igd-itext);border-radius:10px;padding:7px 10px;font-size:13px;}
  .igd-num{width:72px;}

  /* Liste başlığı + sanal liste */
  .igd-listhead{padding:0 20px;}
  .igd-bar2{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 14px;margin-bottom:8px;border-radius:10px;background:var(--igd-input);border:1px solid var(--igd-border2);color:var(--igd-muted2);font-size:13px;}
  .igd-bar2.warn{color:var(--igd-log-warn);}
  .igd-selbar{display:flex;align-items:center;gap:12px;padding:6px 14px;color:var(--igd-muted2);font-size:13px;border-bottom:1px solid var(--igd-border);}
  .igd-list{flex:1;min-height:0;overflow:auto;padding:4px 6px 16px 6px;margin:0 14px;}
  .igd-vspace{position:relative;}
  .igd-item{display:flex;align-items:center;gap:12px;height:68px;padding:0 10px;border-radius:12px;user-select:none;cursor:default;}
  .igd-item:hover{background:var(--igd-ihover);}
  .igd-item.sel{background:var(--igd-sel);}
  .igd-item.wl{background:var(--igd-wl);}
  .igd-item.nosel .igd-cb{opacity:.35;}
  .igd-ava{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--igd-ava);flex:0 0 auto;}
  .igd-meta{flex:1;min-width:0;}
  .igd-name{display:flex;align-items:center;gap:6px;font-weight:600;white-space:nowrap;overflow:hidden;}
  .igd-name a{overflow:hidden;text-overflow:ellipsis;}
  .igd-name .badge{color:#3897f0;display:inline-flex;}
  .igd-full{font-size:12px;color:var(--igd-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;}
  .igd-full b{color:var(--igd-text);font-weight:600;}
  .igd-tag{font-size:10px;padding:1px 7px;border-radius:8px;border:1px solid var(--igd-tagb);color:var(--igd-tagt);white-space:nowrap;flex:0 0 auto;}
  .igd-tag.priv{border-color:#51bb42;color:#4a9e3d;}
  .igd-tag.wl{border-color:#2f7d31;color:#3d9e40;background:var(--igd-wl);}
  .igd-tag.dm{border-color:#3a4a6a;color:#5b83d6;}
  .igd-tag.dm.old{border-color:#a5691d;color:#c47a1e;}
  .igd-tag.dm.never{border-color:var(--igd-dbd);color:var(--igd-dtx);}
  .igd-tag.bot{border-color:#a5691d;color:#c47a1e;}
  .igd-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;}
  .igd-mini{display:inline-flex;align-items:center;gap:5px;font:inherit;border:1px solid var(--igd-border3);background:var(--igd-btn);color:var(--igd-text);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;font-weight:600;white-space:nowrap;}
  .igd-mini:hover{background:var(--igd-hover);}
  .igd-mini.icon{padding:6px 7px;}
  .igd-mini.act{border-color:var(--igd-dbd);background:var(--igd-dbg);color:var(--igd-dtx);}
  .igd-mini.act:hover{background:var(--igd-dhv);}
  .igd-mini.block{border-color:var(--igd-blk-bd);background:var(--igd-blk-bg);color:var(--igd-blk-tx);}
  .igd-mini.block:hover{background:var(--igd-blk-hv);}
  .igd-mini.follow{border-color:transparent;background:linear-gradient(90deg,#4f5bd5,#962fbf);color:#fff;}
  .igd-mini.on{background:var(--igd-wl);border-color:#2f7d31;color:#3d9e40;}
  .igd-cb{width:18px;height:18px;flex:0 0 auto;accent-color:var(--igd-accent);cursor:pointer;}
  .igd-secbar{padding:14px 14px 8px;font-weight:700;font-size:14px;color:var(--igd-text);border-top:1px solid var(--igd-border);margin-top:6px;}
  .igd-secbar:first-child{border-top:none;margin-top:0;}
  .igd-dmdate{font-size:12px;color:var(--igd-muted);margin-top:2px;}

  /* Boş / kilitli durum kartı — tüm sayfalarda tek bileşen */
  .igd-empty-card{max-width:560px;margin:28px auto;padding:26px 28px;text-align:center;border:1px dashed var(--igd-border3);border-radius:16px;background:var(--igd-card);color:var(--igd-muted2);line-height:1.6;}
  .igd-empty-card .eic{width:48px;height:48px;margin:0 auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--igd-input);color:var(--igd-accent);}
  .igd-empty-card h3{font-size:16px;font-weight:700;color:var(--igd-text);margin-bottom:6px;}
  .igd-empty-card p{font-size:13px;margin:6px 0;}
  .igd-empty-card .acts{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:14px;}
  .igd-empty-card .note{font-size:12px;color:var(--igd-muted);margin-top:12px;}
  .igd-empty-card.compact{margin:12px auto;padding:16px 20px;}
  .igd-spin{display:inline-block;width:14px;height:14px;border:2px solid var(--igd-border3);border-top-color:var(--igd-accent);border-radius:50%;animation:igd-spin .8s linear infinite;vertical-align:-2px;}
  @keyframes igd-spin{to{transform:rotate(360deg);}}

  /* İşlem tepsisi — ekranı kilitlemez */
  .igd-tray{position:relative;flex:0 0 auto;border-top:1px solid var(--igd-border);background:var(--igd-bar);}
  .igd-tray-row{display:flex;align-items:center;gap:12px;padding:10px 20px;min-height:48px;}
  .igd-tray-idle{color:var(--igd-muted2);font-size:13px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .igd-tray-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;}
  .igd-tray-t{display:flex;align-items:baseline;gap:8px;font-size:13px;min-width:0;}
  .igd-tray-t b{white-space:nowrap;}
  .igd-tray-t span{color:var(--igd-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .igd-tray-m{font-size:12px;color:var(--igd-muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .igd-prog{height:6px;border-radius:3px;background:var(--igd-prog);overflow:hidden;}
  .igd-prog>i{display:block;height:100%;width:0;transition:width .25s;}
  .igd-prog.ind>i{width:30%;animation:igd-ind 1.3s ease-in-out infinite;}
  @keyframes igd-ind{0%{transform:translateX(-100%);}100%{transform:translateX(340%);}}
  .igd-tray.paused .igd-prog>i{filter:grayscale(1);opacity:.6;}
  .igd-tray-log{max-height:220px;overflow:auto;padding:8px 20px 10px;border-bottom:1px solid var(--igd-border);font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;}
  .igd-tray-log div{padding:2px 0;}

  /* Grafik (takipçi sayısı) */
  .igd-chartbox{position:relative;background:var(--igd-card);border:1px solid var(--igd-border2);border-radius:14px;padding:14px 16px 10px;margin:12px 0;}
  .igd-chartbox .hero{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px;}
  .igd-chartbox .hero b{font-size:24px;}
  .igd-chartbox .hero .d{font-size:13px;font-weight:600;}
  .igd-chartbox .hero .d.up{color:var(--igd-ok);} .igd-chartbox .hero .d.down{color:var(--igd-dtx);}
  .igd-chart{width:100%;height:200px;display:block;}
  .igd-chart .grid{stroke:var(--igd-border);stroke-width:1;}
  .igd-chart .ax{fill:var(--igd-muted);font-size:11px;}
  .igd-chart .ln{fill:none;stroke:var(--igd-focus);stroke-width:2;stroke-linejoin:round;stroke-linecap:round;}
  .igd-chart .xh{stroke:var(--igd-muted);stroke-width:1;stroke-dasharray:3 3;}
  .igd-chart .dot{fill:var(--igd-focus);stroke:var(--igd-card);stroke-width:2;}
  .igd-tip{position:absolute;pointer-events:none;background:var(--igd-header);border:1px solid var(--igd-border3);border-radius:8px;padding:6px 9px;font-size:12px;box-shadow:var(--igd-shadow);white-space:nowrap;}
  .igd-tip b{display:block;font-size:13px;}
  .igd-chartbox details{margin-top:6px;font-size:12px;color:var(--igd-muted2);}
  .igd-chartbox table{border-collapse:collapse;margin-top:6px;}
  .igd-chartbox td,.igd-chartbox th{padding:3px 12px 3px 0;text-align:left;font-variant-numeric:tabular-nums;}

  /* Diyaloglar */
  .igd-modal{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:var(--igd-ov);}
  .igd-card{width:min(560px,92vw);max-height:90vh;display:flex;flex-direction:column;background:var(--igd-header);color:var(--igd-text);border:1px solid var(--igd-border2);border-radius:16px;overflow:hidden;box-shadow:var(--igd-shadow);}
  .igd-card h3{padding:16px 20px;font-size:15px;border-bottom:1px solid var(--igd-border);display:flex;align-items:center;gap:8px;}
  .igd-card.danger h3{color:var(--igd-dtx);}
  .igd-dlg-body{padding:14px 20px;overflow:auto;line-height:1.55;font-size:13px;color:var(--igd-muted2);}
  .igd-dlg-body p{margin:0 0 8px;}
  .igd-dlg-body p b{color:var(--igd-text);}
  .igd-names{display:flex;flex-wrap:wrap;gap:6px;max-height:150px;overflow:auto;padding:10px;margin:6px 0 10px;background:var(--igd-input);border:1px solid var(--igd-border2);border-radius:10px;}
  .igd-names span{font-size:12px;padding:2px 8px;border-radius:8px;background:var(--igd-btn);color:var(--igd-text);}
  .igd-names span.more{background:none;color:var(--igd-muted);}
  .igd-est{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--igd-muted2);margin:4px 0 8px;}
  .igd-typein{display:flex;flex-direction:column;gap:6px;margin-top:8px;}
  .igd-typein input{font:inherit;font-size:14px;letter-spacing:.06em;background:var(--igd-input);border:1px solid var(--igd-border3);color:var(--igd-itext);border-radius:10px;padding:9px 12px;outline:none;}
  .igd-typein input.ok{border-color:var(--igd-red);}
  .igd-pfoot{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--igd-border);}
  .igd-nform{display:flex;flex-direction:column;gap:14px;}
  .igd-nform .igd-chk{gap:10px;}
  .igd-note{font-size:12px;color:var(--igd-muted);line-height:1.55;}

  /* Ayarlar */
  .igd-settings{max-width:760px;padding:16px 20px 40px;display:flex;flex-direction:column;gap:14px;}
  .igd-panel{background:var(--igd-card);border:1px solid var(--igd-border2);border-radius:14px;padding:16px 18px;}
  .igd-panel h2{font-size:15px;display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .igd-panel .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;}
  .igd-panel ul{padding-left:18px;color:var(--igd-muted2);font-size:13px;line-height:1.6;}
  .igd-panel li{margin:6px 0;}
  .igd-seg{display:inline-flex;border:1px solid var(--igd-border3);border-radius:10px;overflow:hidden;}
  .igd-seg button{font:inherit;font-size:13px;font-weight:600;padding:7px 14px;border:none;background:var(--igd-btn);color:var(--igd-muted2);cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
  .igd-seg button.on{background:var(--igd-accent);color:#fff;}
  .igd-chips{display:flex;flex-wrap:wrap;gap:6px;}

  /* Tanıtım */
  .igd-onb{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:var(--igd-bg);padding:20px;}
  .igd-onb-card{width:min(600px,100%);background:var(--igd-card);border:1px solid var(--igd-border2);border-radius:20px;padding:28px 32px;box-shadow:var(--igd-shadow);}
  .igd-onb-steps{display:flex;gap:6px;margin-bottom:18px;}
  .igd-onb-steps i{flex:1;height:4px;border-radius:2px;background:var(--igd-prog);}
  .igd-onb-steps i.on{background:var(--igd-accent);}
  .igd-onb-card h2{font-size:21px;margin-bottom:8px;}
  .igd-onb-card p{color:var(--igd-muted2);line-height:1.6;margin:8px 0;}
  .igd-onb-card ul{padding-left:0;list-style:none;margin:14px 0;display:flex;flex-direction:column;gap:10px;}
  .igd-onb-card li{display:flex;gap:10px;align-items:flex-start;color:var(--igd-muted2);font-size:13px;line-height:1.5;}
  .igd-onb-card li .igd-ic{color:var(--igd-accent);margin-top:2px;}
  .igd-onb-card li b{color:var(--igd-text);}
  .igd-onb-foot{display:flex;align-items:center;gap:10px;margin-top:22px;}
  .igd-okline{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:var(--igd-wl);color:var(--igd-ok);font-weight:600;font-size:13px;margin-top:12px;}

  /* Instagram görünümünden panele dönüş */
  #igd-fab{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483645;display:none;align-items:center;gap:8px;padding:8px 16px;border:none;border-radius:999px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;background:linear-gradient(90deg,#d62976,#962fbf);box-shadow:0 6px 20px rgba(0,0,0,.25);}
  #igd-fab:hover{filter:brightness(1.08);}

  .igd-toast{position:fixed;bottom:76px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:min(640px,92vw);
    background:var(--igd-toast-bg);color:var(--igd-toast-tx);border:1px solid var(--igd-border3);padding:12px 20px;border-radius:12px;
    line-height:1.45;white-space:pre-line;cursor:pointer;box-shadow:var(--igd-shadow);}
  .igd-toast.err{background:var(--igd-dbg);color:var(--igd-dtx);border-color:var(--igd-dbd);}

  /* Klavye odağı (yalnızca klavyeyle gezinirken görünür) */
  #igd-root :focus-visible:not(.igd-search input),.igd-modal :focus-visible:not(.igd-typein input),#igd-fab:focus-visible{outline:2px solid var(--igd-focus);outline-offset:2px;}
  .igd-search:focus-within,.igd-typein input:focus{border-color:var(--igd-focus);}

  @media (max-width:980px){
    .igd-side{width:64px;flex-basis:64px;padding:14px 8px;}
    .igd-side .lbl,.igd-brand{display:none;}
    .igd-nav{justify-content:center;padding:10px;}
    .igd-sources{grid-template-columns:1fr;}
    .igd-src .r3{display:none;}
  }
  `;

  // --- Tema ---
  const isLight = () => lsGet("igd_theme", "dark") === "light";
  function applyTheme() {
    document.documentElement.classList.toggle("igd-light", isLight());
    const b = $("igd-themebtn");
    if (b) b.innerHTML = `${ic(isLight() ? "moon" : "sun")}<span class="lbl">${isLight() ? "Koyu tema" : "Açık tema"}</span>`;
  }
  function setTheme(light) { lsSet("igd_theme", light ? "light" : "dark"); applyTheme(); if (S.section === "settings") render(); }

  // --- Bildirim mesajı: okuma süresi metne göre, tıkla-kapat, üstüne gelince bekle ---
  let toastT;
  function toast(msg, err) {
    let t = document.querySelector(".igd-toast");
    if (!t) { t = document.createElement("div"); document.body.appendChild(t); }
    t.className = "igd-toast" + (err ? " err" : "");
    t.setAttribute("role", err ? "alert" : "status");
    t.title = "Kapatmak için tıkla";
    t.textContent = msg;
    const ms = Math.min(15000, Math.max(3200, 1500 + String(msg).length * 60));
    const arm = (d) => { clearTimeout(toastT); toastT = setTimeout(() => t.remove(), d); };
    t.onclick = () => { clearTimeout(toastT); t.remove(); };
    t.onmouseenter = () => clearTimeout(toastT);
    t.onmouseleave = () => arm(2500);
    arm(ms);
  }

  // --- Boş / kilitli durum kartı ---
  // actions: [{label, cta, primary}] — cta, liste tıklama yöneticisinde işlenen eylem anahtarıdır.
  function emptyCard(o) {
    const acts = (o.actions || []).map((a) =>
      `<button class="igd-btn ${a.primary ? "primary" : ""}" data-cta="${esc(a.cta)}">${a.icon ? ic(a.icon) : ""}${esc(a.label)}</button>`).join("");
    return `<div class="igd-empty-card ${o.compact ? "compact" : ""}">
      ${o.icon ? `<div class="eic">${o.spin ? '<span class="igd-spin"></span>' : ic(o.icon, 22)}</div>` : ""}
      ${o.title ? `<h3>${esc(o.title)}</h3>` : ""}
      ${o.html || ""}
      ${acts ? `<div class="acts">${acts}</div>` : ""}
      ${o.note ? `<div class="note">${o.note}</div>` : ""}
    </div>`;
  }

  // --- Uygulama içi diyalog (native confirm/prompt yerine) ---
  let dlgFinish = null;
  function closeDialog(v) { if (dlgFinish) dlgFinish(v); }
  function openDialog(o) {
    closeDialog(null);
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const ov = document.createElement("div");
      ov.className = "igd-modal"; ov.id = "igd-dialog";
      ov.innerHTML = `<div class="igd-card ${o.danger ? "danger" : ""}" role="${o.danger ? "alertdialog" : "dialog"}" aria-modal="true" aria-labelledby="igd-dlg-t">
        <h3 id="igd-dlg-t">${o.danger ? ic("alert") : ""}${esc(o.title)}</h3>
        <div class="igd-dlg-body">${o.body || ""}</div>
        <div class="igd-pfoot">${o.buttons.map((b, i) => `<button class="igd-btn ${b.kind || ""}" data-bi="${i}">${esc(b.label)}</button>`).join("")}</div>
      </div>`;
      document.body.appendChild(ov);
      const card = ov.firstElementChild;
      const finish = (v) => {
        if (dlgFinish !== finish) return;
        dlgFinish = null; ov.remove();
        try { if (prevFocus && prevFocus.isConnected) prevFocus.focus(); } catch (e) {}
        resolve(v);
      };
      dlgFinish = finish;
      card.querySelectorAll("[data-bi]").forEach((btn) => btn.onclick = () => {
        const b = o.buttons[+btn.dataset.bi];
        let v = b.value;
        if (b.handler) { v = b.handler(card); if (v === false) return; }
        finish(v === undefined ? null : v);
      });
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) finish(null); });
      // Odak diyalog içinde kalsın
      card.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const f = [...card.querySelectorAll("button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex='-1'])")];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      if (o.onMount) o.onMount(card, finish);
      const focusIdx = o.buttons.findIndex((b) => b.focus);
      const target = card.querySelector("input:not([type=checkbox])") || card.querySelector(`[data-bi="${focusIdx >= 0 ? focusIdx : o.buttons.length - 1}"]`);
      if (target) target.focus();
    });
  }

  // Onay: isim önizlemesi, süre tahmini, tehlikeli işlemde kırmızı düğme ve isteğe bağlı yazarak teyit.
  function askConfirm(o) {
    const LIMIT = 60;
    let body = o.html || "";
    if (o.names && o.names.length) {
      body += `<div class="igd-names" aria-label="Etkilenecek hesaplar">${o.names.slice(0, LIMIT).map((n) => `<span>@${esc(String(n).replace(/^@/, ""))}</span>`).join("")}${o.names.length > LIMIT ? `<span class="more">+${o.names.length - LIMIT} daha</span>` : ""}</div>`;
    }
    if (o.estimate) body += `<div class="igd-est">${ic("refresh", 13)} Tahmini süre: ~${esc(durStr(o.estimate))}</div>`;
    if (o.typeWord) body += `<label class="igd-typein">Onaylamak için <b>${esc(o.typeWord)}</b> yaz:<input id="igd-typein" autocomplete="off" spellcheck="false" aria-label="Onay kelimesi: ${esc(o.typeWord)}"/></label>`;
    const okIdx = 1;
    return openDialog({
      title: o.title, body, danger: !!o.danger,
      buttons: [
        { label: o.cancelLabel || "Vazgeç", value: false, focus: !!o.danger && !o.typeWord },
        { label: o.okLabel || "Devam", kind: o.danger ? "solid" : "primary", value: true },
      ],
      onMount: (card) => {
        if (!o.typeWord) return;
        const inp = card.querySelector("#igd-typein"), okBtn = card.querySelector(`[data-bi="${okIdx}"]`);
        const norm = (s) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR").replace(/İ/g, "I");
        const want = norm(o.typeWord);
        const check = () => { const good = norm(inp.value) === want; okBtn.disabled = !good; inp.classList.toggle("ok", good); return good; };
        check();
        inp.oninput = check;
        inp.onkeydown = (e) => { if (e.key === "Enter" && check()) okBtn.click(); };
      },
    }).then((v) => v === true);
  }

  // --- İşlem tepsisi (ilerleme, duraklat/durdur, kalan süre, günlük) ---
  function startJob(o) {
    S.paused = false;
    S.job = { title: o.title, src: o.src || "", total: o.total || 0, done: 0, ok: null, fail: 0, t0: Date.now(),
      pausedMs: 0, pauseAt: 0, log: [], text: "", finished: false, pausable: !!o.pausable, stoppable: o.stoppable !== false, showLog: false };
    renderTray(); renderSideState();
  }
  function jobReset(o) {
    const j = S.job; if (!j) return startJob(o);
    Object.assign(j, { title: o.title, total: o.total || 0, done: 0, ok: null, fail: 0, t0: Date.now(), pausedMs: 0, pauseAt: 0, pausable: !!o.pausable, text: "" });
    renderTray();
  }
  function setStatus(t) {
    if (S.job && !S.job.finished) S.job.text = t; else S.statusText = t;
    renderTray();
  }
  function jobProgress(done, total, ok, fail) {
    const j = S.job; if (!j || j.finished) return;
    j.done = done; if (total) j.total = total;
    if (ok != null) { j.ok = ok; j.fail = fail || 0; }
    renderTray();
  }
  function jobLog(text, kind) {
    const j = S.job; if (!j) return;
    j.log.push({ text, kind });
    if (j.log.length > 600) j.log.shift();
    const box = $("igd-tray-log");
    if (box && !box.hidden) { box.appendChild(logLine(text, kind)); box.scrollTop = box.scrollHeight; }
    renderTray();
  }
  function logLine(text, kind) {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.color = `var(--igd-log-${["ok", "err", "warn", "done", "info"].includes(kind) ? kind : "info"})`;
    return d;
  }
  function jobFinish(summary) {
    const j = S.job;
    S.paused = false;
    S.statusText = summary || "Hazır.";
    if (!j) { renderTray(); return; }
    j.finished = true; j.summary = summary; j.text = ""; j.tEnd = Date.now();
    const took = j.tEnd - j.t0;
    // Uzun işler bitince native bildirim (pencere arkadayken de haber versin)
    if (took > 120000) post({ type: "notify", title: "İşlem bitti", body: `${j.title}: ${summary || ""}`, panel: S.section });
    // Günlüğü olmayan kısa işler (taramalar) tepside yer kaplamasın
    if (!j.log.length) S.job = null;
    renderTray(); renderSideState();
  }
  function togglePause() {
    const j = S.job; if (!j || !j.pausable || j.finished) return;
    S.paused = !S.paused;
    if (S.paused) j.pauseAt = Date.now();
    else { j.pausedMs += Date.now() - j.pauseAt; j.pauseAt = 0; }
    renderTray();
  }
  function stopJob() {
    if (!S.job || S.job.finished) return;
    S.stopFlag = true;
    if (S.paused) togglePause();
    S.job.text = "Durduruluyor...";
    renderTray();
  }
  function jobEta(j) {
    if (!j.total || !j.done || j.done >= j.total) return "";
    const active = Date.now() - j.t0 - j.pausedMs - (j.pauseAt ? Date.now() - j.pauseAt : 0);
    return "~" + durStr(active / j.done * (j.total - j.done) / 1000) + " kaldı";
  }

  // Tepsi iskeleti yalnızca durum değişince kurulur; ilerlemede yalnız metinler güncellenir (odak kaybolmaz).
  function renderTray() {
    const el = $("igd-tray"); if (!el) return;
    const j = S.job;
    const q = S.queue && queueLeft(S.queue) > 0 ? S.queue : null;
    const mode = !j ? (q ? "queue" : "idle") : j.finished ? "done" : "run";
    if (mode === "queue") { renderQueueRow(el, q); return; }
    const key = mode + (j ? "|" + j.pausable + "|" + j.stoppable + "|" + j.t0 : "");
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      if (mode === "idle") {
        el.innerHTML = `<div class="igd-tray-row"><span class="igd-tray-idle" id="igd-tray-idle" role="status"></span></div>`;
      } else {
        el.innerHTML = `
          <div class="igd-tray-log" id="igd-tray-log" hidden></div>
          <div class="igd-tray-row">
            <div class="igd-tray-main" role="status" aria-live="polite">
              <div class="igd-tray-t"><b id="igd-tray-title"></b><span id="igd-tray-text"></span></div>
              ${mode === "run" ? `<div class="igd-prog" id="igd-tray-prog"><i class="igd-grad"></i></div>` : ""}
              <div class="igd-tray-m" id="igd-tray-meta"></div>
            </div>
            ${mode === "run" && j.pausable ? `<button class="igd-btn sm" id="igd-tray-pause"></button>` : ""}
            ${mode === "run" && j.stoppable ? `<button class="igd-btn sm danger" id="igd-tray-stop">${ic("stop", 13)} Durdur</button>` : ""}
            <button class="igd-btn sm ghost" id="igd-tray-logbtn" aria-expanded="false"></button>
            ${mode === "done" ? `<button class="igd-btn sm" id="igd-tray-close">${ic("x", 13)} Kapat</button>` : ""}
          </div>`;
        const lb = $("igd-tray-logbtn");
        lb.onclick = () => { j.showLog = !j.showLog; renderTray(); };
        const pb = $("igd-tray-pause"); if (pb) pb.onclick = togglePause;
        const sb_ = $("igd-tray-stop"); if (sb_) sb_.onclick = stopJob;
        const cb = $("igd-tray-close"); if (cb) cb.onclick = () => { S.job = null; renderTray(); };
      }
    }
    if (mode === "idle") { $("igd-tray-idle").textContent = S.statusText || "Hazır."; el.classList.remove("paused"); return; }

    el.classList.toggle("paused", S.paused && mode === "run");
    $("igd-tray-title").textContent = j.title;
    $("igd-tray-text").textContent = mode === "done" ? j.summary || "" : (S.paused ? "Duraklatıldı" : j.text || "");
    const prog = $("igd-tray-prog");
    if (prog) {
      const det = j.total > 0;
      prog.classList.toggle("ind", !det);
      prog.firstElementChild.style.width = det ? Math.round(Math.min(1, j.done / j.total) * 100) + "%" : "";
    }
    const parts = [];
    if (j.total) parts.push(`${fmtN(j.done)} / ${fmtN(j.total)}`);
    if (j.ok != null) parts.push(`başarılı ${j.ok} · hata ${j.fail}`);
    if (mode === "run" && !S.paused) { const eta = jobEta(j); if (eta) parts.push(eta); }
    if (mode === "done") parts.push(`süre ${durStr((j.tEnd - j.t0 - j.pausedMs) / 1000)}`);
    $("igd-tray-meta").textContent = parts.join("  ·  ");
    const pb = $("igd-tray-pause");
    if (pb) pb.innerHTML = S.paused ? `${ic("play", 13)} Devam et` : `${ic("pause", 13)} Duraklat`;
    const lb = $("igd-tray-logbtn");
    lb.hidden = !j.log.length;
    lb.innerHTML = `${ic(j.showLog ? "chevdown" : "chevup", 13)} Günlük (${j.log.length})`;
    lb.setAttribute("aria-expanded", String(j.showLog));
    const box = $("igd-tray-log");
    if (j.showLog && box.hidden) {
      box.hidden = false; box.innerHTML = "";
      j.log.forEach((l) => box.appendChild(logLine(l.text, l.kind)));
      box.scrollTop = box.scrollHeight;
    } else if (!j.showLog) box.hidden = true;
  }

  // Bekleyen / yarım kalan kuyruk satırı
  function renderQueueRow(el, q) {
    el.dataset.key = "queue|" + q.state + "|" + q.idx;
    el.classList.remove("paused");
    const A = ACTIONS[q.action];
    const stateTxt = q.state === "wait" ? `Günlük sınır doldu — ${fmtClock(q.resumeAt || nextSlotAt())} itibarıyla kendiliğinden devam edecek`
      : q.state === "blocked" ? "Instagram işlemleri reddetti — beklemen önerilir"
      : "Yarım kaldı";
    const pct = Math.round(q.idx / q.items.length * 100);
    el.innerHTML = `<div class="igd-tray-row">
      <div class="igd-tray-main" role="status">
        <div class="igd-tray-t"><b>Kuyruk: ${esc(A.btn)}</b><span>${esc(stateTxt)}</span></div>
        <div class="igd-prog"><i class="igd-grad" style="width:${pct}%"></i></div>
        <div class="igd-tray-m">${fmtN(q.idx)} / ${fmtN(q.items.length)} · başarılı ${q.ok} · hata ${q.fail} · kalan ${fmtN(queueLeft(q))}</div>
      </div>
      <button class="igd-btn sm primary" id="igd-q-resume" ${isBusy() ? "disabled" : ""}>${ic("play", 13)} ${q.state === "wait" ? "Şimdi dene" : "Devam et"}</button>
      <button class="igd-btn sm danger" id="igd-q-cancel">${ic("x", 13)} İptal</button>
    </div>`;
    $("igd-q-resume").onclick = resumeQueue;
    $("igd-q-cancel").onclick = cancelQueue;
  }

  // --- Sanal liste: yalnızca görünen ~20 satırı çizer (30 bin takipçide de akıcı) ---
  const ROW_H = 68;
  function mountVList(box, items, rowHtml, rowH) {
    let v = box._v;
    if (!v) {
      v = box._v = { start: -1, end: -1, raf: 0 };
      box.innerHTML = `<div class="igd-vspace"><div class="igd-vwin"></div></div>`;
      box.onscroll = () => { if (!v.raf) v.raf = requestAnimationFrame(() => { v.raf = 0; drawVList(box, false); }); };
    }
    v.items = items; v.rowHtml = rowHtml; v.rowH = rowH || ROW_H;
    box.firstElementChild.style.height = items.length * v.rowH + "px";
    drawVList(box, true);
  }
  function drawVList(box, force) {
    const v = box._v; if (!v) return;
    const top = box.scrollTop, h = box.clientHeight || 700;
    const start = Math.max(0, Math.floor(top / v.rowH) - 6);
    const end = Math.min(v.items.length, Math.ceil((top + h) / v.rowH) + 6);
    if (!force && start === v.start && end === v.end) return;
    v.start = start; v.end = end;
    const win = box.firstElementChild.firstElementChild;
    win.style.transform = `translateY(${start * v.rowH}px)`;
    let html = "";
    for (let i = start; i < end; i++) html += v.rowHtml(v.items[i], i);
    win.innerHTML = html;
  }
  function setListContent(box, html) { box._v = null; box.onscroll = null; box.innerHTML = html; }

  // Esc yalnızca geçici katmanları kapatır: diyalog → tepsi günlüğü. Panelin kendisi kapanmaz.
  function onEscape(e) {
    if (e.key !== "Escape") return;
    if ($("igd-dialog")) { e.preventDefault(); e.stopPropagation(); closeDialog(null); return; }
    if (S.job && S.job.showLog && $("igd-root") && $("igd-root").style.display !== "none") {
      e.preventDefault(); S.job.showLog = false; renderTray();
    }
  }
