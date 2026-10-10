/* Wholesome Girlies installable app (PWA, Level 1). Loaded on every page.
 *
 * 1. Registers /sw.js, which caches pages and files so the tools open without a connection.
 * 2. Offers "add to home screen" at the moments the plan names (06 - Virality Plan, section 8, Rollout):
 *    on a tool after she saves an entry, under a quiz or game result, and on the program thank-you hubs.
 *    Android Chrome gets the browser's own install prompt on our button. iPhone has no prompt, so Safari gets
 *    the real screen recording of the steps (/assets/video/app/) and Chrome, Edge and Firefox get their own
 *    two steps, never a detour to Safari. Instagram, TikTok and Facebook's built-in browsers get "open in your
 *    browser", because nothing installs from inside them. A computer gets a QR code for her phone. The tool
 *    prompt shows at most once a visit, stays away for 14 days after "Not now", and never shows on sales
 *    pages, ad bridges or the pages in QUIET.
 * 3. Gives the /app home its saved-entries backup and restore (window.WGApp).
 *
 * Her entries never leave her phone: the backup is a file she saves, and
 * nothing here sends either anywhere. Analytics events carry where a prompt showed, never what she entered.
 */
(function (w, d) {
  var nav = w.navigator;
  var ua = nav.userAgent || '';
  var path = w.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var standalone = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var iosBrowser = /CriOS/.test(ua) ? 'chrome' : /EdgiOS/.test(ua) ? 'edge' : /FxiOS/.test(ua) ? 'firefox' : 'safari';
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Snapchat|\bLine\//i.test(ua);
  // Preview another phone from a computer: ?preview=iphone, iphone-chrome, android, in-app or computer,
  // or ?preview=installed for the app as it opens from her iPhone home screen.
  var preview = (/[?&]preview=(iphone-chrome|iphone|android|in-app|computer|installed)\b/.exec(w.location.search) || [])[1];
  if (preview) {
    ios = /^iphone|installed/.test(preview); android = preview === 'android' || preview === 'in-app';
    standalone = standalone || preview === 'installed';
    iosBrowser = preview === 'iphone-chrome' ? 'chrome' : 'safari'; inApp = preview === 'in-app';
  }
  var phone = ios || android;
  var QUIET = ['/pregnancy/guides/chemical-miscarriage', '/postpartum/guides/postpartum-warning-signs',
    '/postpartum/tools/mind-check-in', '/fertility/tools/the-wait-check-in'];
  var noPrompt = /^\/go\//.test(path) || /^\/programs\/[^/]+$/.test(path) || QUIET.indexOf(path.replace(/\/$/, '')) > -1;
  var DISMISS = 'wg_app_dismissed';
  var deferred = null;

  if ('serviceWorker' in nav && (w.location.protocol === 'https:' || w.location.hostname === 'localhost' || w.location.hostname === '127.0.0.1')) {
    w.addEventListener('load', function () { nav.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  function push(ev, surface) {
    w.dataLayer = w.dataLayer || [];
    var o = { event: ev, app_platform: ios ? 'ios' : android ? 'android' : 'other', app_in_app_browser: inApp };
    if (surface) o.app_surface = surface;
    w.dataLayer.push(o);
  }
  function session(k, v) { try { if (v === undefined) return w.sessionStorage.getItem(k); w.sessionStorage.setItem(k, v); } catch (e) { return null; } }

  if (standalone && !preview && !session('wgapp_open')) { session('wgapp_open', '1'); push('app_open'); }
  w.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  w.addEventListener('appinstalled', function () { push('app_installed'); closeSheet(); });

  function dismissedRecently() {
    try { var t = +w.localStorage.getItem(DISMISS); return t && Date.now() - t < 14 * 864e5; } catch (e) { return false; }
  }

  // ── Styles, added once ──────────────────────────────────────────────────
  function style() {
    if (d.getElementById('wg-app-css')) return;
    var s = d.createElement('style'); s.id = 'wg-app-css';
    s.textContent =
      '.wg-app-nav{position:fixed;left:0;right:0;bottom:0;z-index:950;display:flex;background:#fff;border-top:2px solid var(--ink,#33322A);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}' +
      '.wg-app-nav a,.wg-app-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 0;background:none;border:0;cursor:pointer;text-decoration:none;font:700 .72rem/1.2 var(--sans,system-ui,sans-serif);color:var(--plum-soft,#66645A)}' +
      '.wg-app-nav svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
      '.wg-app-nav .on{color:var(--ink,#33322A)}' +
      // the open tab sits in a mustard sticker, like the cast line work
      '.wg-app-nav .on svg{background:var(--mustard,#D49A2A);border:2px solid var(--ink,#33322A);border-radius:10px;padding:3px;width:30px;height:30px;box-sizing:border-box;margin:-4px 0}' +
      'body.wg-in-app{padding-bottom:calc(66px + env(safe-area-inset-bottom))}' +
      '.wg-app-foot{max-width:640px;margin:0 auto;padding:0 20px;font-size:.8rem;line-height:1.7;color:#B9C3B2;text-align:center}' +
      '.wg-app-foot a{color:var(--blush,#EAE9D2);white-space:nowrap}' +
      'footer.wg-app-foot-on{padding:16px 0 18px !important}' +
      '.wg-app-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:900;background:#fff;border:1px solid var(--line,#E3E0CF);border-radius:18px;box-shadow:0 10px 30px rgba(51,50,42,.18);padding:14px 16px;display:flex;gap:12px;align-items:center;max-width:560px;margin:0 auto}' +
      '.wg-app-bar img{width:40px;height:40px;border-radius:10px;flex:none}' +
      '.wg-app-bar p{margin:0;font-size:.95rem;line-height:1.35}' +
      '.wg-app-bar .wg-app-btns{display:flex;gap:8px;flex:none;flex-direction:column}' +
      '.wg-app-btn{border:0;border-radius:999px;background:var(--terracotta,#6E7A3F);color:#fff;font-weight:800;padding:9px 16px;cursor:pointer;font-size:.9rem}' +
      '.wg-app-btn.ghost{background:none;color:var(--plum-soft,#66645A);font-weight:700;padding:4px 8px}' +
      '.wg-app-card{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:#fff;border:1px solid var(--line,#E3E0CF);border-radius:16px;padding:14px;margin:18px 0 0;box-shadow:0 6px 18px rgba(51,50,42,.08);text-align:left}' +
      '.wg-app-card img{flex:none;width:44px;height:44px;border-radius:11px}' +
      '.wg-app-card div{flex:999 1 200px;min-width:0}' +
      '.wg-app-card b{display:block;font-size:1rem;line-height:1.3;color:var(--plum,#33322A)}' +
      '.wg-app-card p{margin:2px 0 0;font-size:.88rem;line-height:1.4;color:var(--plum-soft,#66645A)}' +
      '.wg-app-card .wg-app-btn{flex:1 0 auto;padding:11px 22px;font-size:.95rem}' + // beside the text when there is room, its own full line when there is not
      '.wg-app-sheet .clip{display:block;width:190px;max-width:56%;height:auto;aspect-ratio:432/934;border-radius:24px;border:5px solid #23221F;margin:0 auto 16px;background:#23221F}' +
      '.wg-app-sheet .qr{display:block;width:200px;height:200px;margin:0 auto 12px;background:#fff;padding:8px;border-radius:12px}' +
      '.wg-app-sheet{position:fixed;inset:0;z-index:950;background:rgba(51,50,42,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.wg-app-sheet .in{background:#FBF8EF;border-radius:22px 22px 0 0;padding:22px 20px 28px;width:100%;max-width:560px;max-height:88vh;overflow:auto}' +
      '.wg-app-sheet h3{margin:0 0 12px}' +
      '.wg-app-sheet ol{margin:0 0 14px;padding-left:22px}.wg-app-sheet li{margin:8px 0}' +
      '.wg-app-sheet svg{width:18px;height:18px;vertical-align:-3px}' +
      '.wg-app-sheet .note{font-size:.88rem;color:var(--plum-soft,#66645A);margin:10px 0 0}' +
      '.wg-app-inapp{max-width:640px;margin:0 auto;padding:14px 20px;background:#fff;border-bottom:2px solid var(--ink,#33322A)}' +
      '.wg-app-inapp b.t{display:block;font-size:1rem;line-height:1.3}.wg-app-inapp p{margin:6px 0 10px;font-size:.9rem;line-height:1.45;color:var(--plum-soft,#66645A)}' +
      '.wg-app-progs a{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--line,#E3E0CF);border-radius:14px;padding:14px 16px;margin:0 0 10px;font-weight:800;color:var(--plum,#33322A);text-decoration:none}' +
      '.wg-app-progs a::after{content:"\\2192";color:var(--terracotta,#6E7A3F)}';
    d.head.appendChild(s);
  }

  // ── The install action ──────────────────────────────────────────────────
  var SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';
  function sheet(html) {
    style(); closeSheet();
    var el = d.createElement('div'); el.className = 'wg-app-sheet'; el.id = 'wg-app-sheet';
    el.innerHTML = '<div class="in" role="dialog" aria-modal="true" aria-labelledby="wg-app-sheet-t">' + html + '<p style="margin:16px 0 0"><button type="button" class="wg-app-btn ghost" data-close>Close</button></p></div>';
    el.addEventListener('click', function (e) { if (e.target === el || e.target.hasAttribute('data-close')) closeSheet(); });
    d.body.appendChild(el);
    var v = el.querySelector('video');
    if (v) { v.muted = true; var go = v.play(); if (go) go.catch(function () {}); }
    var l = el.querySelector('[data-copy-link]');
    if (l) l.addEventListener('click', function () { copyText(w.location.href, l, 'Link copied'); });
  }
  function closeSheet() { var el = d.getElementById('wg-app-sheet'); if (el) el.remove(); }

  var IN_APP_STEPS = 'Tap the menu at the top of the screen and choose <b>Open in browser</b>. Or copy the link and paste it into Chrome or Safari.';
  var CLIP = '/assets/video/app/install-iphone-safari.mp4?v=20261008a';
  var POSTER = '/assets/img/app/install-iphone-safari.webp?v=20261008a';
  var TITLE = '<h3 id="wg-app-sheet-t">Add Wholesome Girlies to your home screen</h3>';
  var DONE = '<p class="note">Girlies then sits on your home screen and opens full screen, like an app.</p>';
  function install(surface) {
    push('app_install_click', surface);
    // The browser's own install box only on Android: a computer gets the QR code for her phone instead.
    if (deferred && android && !preview) {
      deferred.prompt();
      deferred.userChoice.then(function (c) { push(c && c.outcome === 'accepted' ? 'app_install_accepted' : 'app_install_declined', surface); deferred = null; });
      return;
    }
    if (inApp) {
      sheet('<h3 id="wg-app-sheet-t">Open this page in your browser first</h3>' +
        '<p>Phones can only add Wholesome Girlies to the home screen from Chrome or Safari. ' + IN_APP_STEPS + '</p>' +
        '<p><button type="button" class="wg-app-btn" data-copy-link>Copy the link</button></p>');
      return;
    }
    if (ios && iosBrowser === 'safari') {
      sheet(TITLE + '<video class="clip" src="' + CLIP + '" poster="' + POSTER + '" width="432" height="934" autoplay muted loop playsinline aria-label="Screen recording of the steps on an iPhone"></video>' +
        '<ol><li>Tap <b>&bull;&bull;&bull;</b> next to the address bar, then <b>Share</b>.</li><li>Tap <b>View More</b>, then <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>' +
        '<p class="note">On an older iPhone, the Share button ' + SHARE_ICON + ' sits in the bar at the bottom of the screen.</p>' + DONE);
      return;
    }
    if (ios) {
      sheet(TITLE + (iosBrowser === 'chrome'
        ? '<ol><li>Tap the Share button ' + SHARE_ICON + ' at the top right, next to the address bar.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>'
        : '<ol><li>Tap the menu button, then <b>Share</b>.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>') + DONE);
      return;
    }
    if (android) {
      sheet(TITLE + '<ol><li>Tap the menu (the three dots) in your browser.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.</li></ol>' + DONE);
      return;
    }
    sheet('<h3 id="wg-app-sheet-t">Get Girlies on your phone</h3>' +
      '<img class="qr" src="/assets/img/qr/app.svg" width="200" height="200" alt="QR code for wholesomegirlies.xyz/app">' +
      '<p>Point your phone camera at the code. It opens the app home on your phone, with the steps to add it.</p>' +
      '<p class="note">Or type wholesomegirlies.xyz/app into your phone browser.</p>');
  }

  // ── Where the offer shows ───────────────────────────────────────────────
  function bar(text, surface) {
    if (standalone || noPrompt || !phone || dismissedRecently() || session('wgapp_shown')) return;
    session('wgapp_shown', '1');
    style();
    var el = d.createElement('div'); el.className = 'wg-app-bar'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Add to home screen');
    el.innerHTML = '<img src="/assets/img/icon-192.png" alt=""><p>' + text + '</p><div class="wg-app-btns"><button type="button" class="wg-app-btn" data-add>Add it</button><button type="button" class="wg-app-btn ghost" data-later>Not now</button></div>';
    el.querySelector('[data-add]').addEventListener('click', function () { el.remove(); install(surface); });
    el.querySelector('[data-later]').addEventListener('click', function () {
      el.remove(); push('app_prompt_dismissed', surface);
      try { w.localStorage.setItem(DISMISS, String(Date.now())); } catch (e) {}
    });
    var pl = d.querySelector('.wg-pill'); if (pl) pl.remove();
    d.body.appendChild(el);
    push('app_prompt_shown', surface);
  }
  function card(target, text, surface) {
    if (standalone || noPrompt || !target || target.querySelector('.wg-app-card')) return;
    style();
    var el = d.createElement('div'); el.className = 'wg-app-card';
    el.innerHTML = '<img src="/assets/img/icon-192.png" alt=""><div><b>' + (phone ? 'Get the Girlies app' : 'Get Girlies on your phone') + '</b><p>' + text + '</p></div>' +
      '<button type="button" class="wg-app-btn">' + (phone ? 'Add it' : 'Show me') + '</button>';
    el.querySelector('button').addEventListener('click', function () { install(surface); });
    target.appendChild(el);
    push('app_prompt_shown', surface);
  }

  // 1. On a tool, after she saves an entry (only when her entries are kept on this device).
  // wg_played_v1 (the finished-games marker) is not a saved entry, so it never offers the install bar.
  var TOOL_KEY = /^wg_(?!lead$|app_|consent|played_)(?!.*_home$)/;
  if (/\/tools\//.test(path) && w.Storage) {
    var set = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function (k, v) {
      var r = set.apply(this, arguments);
      try {
        var keep = !w.WGConsent || !w.WGConsent.state || w.WGConsent.state.remember;
        if (this === w.localStorage && TOOL_KEY.test(String(k)) && keep) setTimeout(function () { bar('Add Wholesome Girlies to your home screen. This tool and your saved entries are one tap away.', 'tool_save'); }, 1200);
      } catch (e) {}
      return r;
    };
  }

  d.addEventListener('DOMContentLoaded', function () {
    // 2. Under a quiz or game result that has a share row.
    if (typeof w.wgShowResult === 'function') {
      var show = w.wgShowResult;
      w.wgShowResult = function (type) {
        var r = show.apply(this, arguments);
        if (type) card(d.getElementById('wg-result-share'), 'Keep the newest games one tap away on your home screen.', 'result');
        return r;
      };
    }
    // 3. On a program thank-you hub, under "copy this page's link".
    if (/^\/programs\/[^/]+\/thank-you$/.test(path)) {
      card(d.querySelector('.sales-hero .wrap'), 'Your program home opens from your home screen in one tap.', 'thank_you');
    }
    // 4. On the homepage, after the programs block. The section stays hidden when no card is offered.
    var homeApp = d.getElementById('homeApp');
    if (homeApp) { card(homeApp, 'Every tool one tap from your home screen, and they work without data.', 'home'); homeApp.parentNode.hidden = !homeApp.firstChild; }
    // 5. Inside Instagram, TikTok or Facebook, a program home sits in that app's own storage, so her program and reading
    //    progress would stay behind. A top card asks her to open the page in her real browser.
    if (inApp && !standalone && /^\/programs\/[^/]+\/thank-you$/.test(path)) inAppCard();
    if (standalone) { tabBar(); appFooter(); }
    appWords();
  });
  // Copy that must say "site" or "browser" on the website is wrapped as <span data-app-word="app">site</span>.
  // Inside the installed app the text becomes the attribute value. Safe to run twice; a no-op in a browser tab.
  function appWords(root) {
    if (!standalone) return;
    var list = (root || d).querySelectorAll('[data-app-word]');
    for (var i = 0; i < list.length; i++) {
      var word = list[i].getAttribute('data-app-word');
      if (list[i].textContent !== word) list[i].textContent = word;
    }
  }
  function inAppCard() {
    var main = d.querySelector('main.ph');
    if (!main || d.getElementById('wg-app-inapp')) return;
    style();
    var el = d.createElement('div'); el.id = 'wg-app-inapp'; el.className = 'wg-app-inapp'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Open in your browser');
    el.innerHTML = '<b class="t">Open this page in Chrome or Safari</b><p>You opened this page inside another app, like Instagram or TikTok. Your program and the page you stopped on will stay stuck inside that app. ' + IN_APP_STEPS + '</p>' +
      '<button type="button" class="wg-app-btn" data-copy-link>Copy the link</button>';
    var b = el.querySelector('button');
    b.addEventListener('click', function () { copyText(w.location.href, b, 'Link copied'); });
    main.insertBefore(el, main.firstChild);
    push('app_prompt_shown', 'in_app_home');
  }

  // ── Inside the installed app: a tab bar on every page, and no "Get the app" links ──
  // The installed app has no browser back button or address bar, so without this a page with no menu
  // (the program homes) is a dead end.
  // Every program home she has, once each (the bundle writes four stage keys that point at one home).
  function myPrograms() {
    var out = [], seen = {};
    ['wg_relationships_home', 'wg_fertility_home', 'wg_pregnancy_home', 'wg_pp_home', 'wg_parenting_home'].forEach(function (k) {
      try {
        var v = JSON.parse(w.localStorage.getItem(k) || 'null');
        if (v && v.u && /^\/programs\/[a-z0-9-]+\/thank-you(\.html)?$/.test(v.u)) {
          var u = v.u.replace(/\.html$/, '');
          if (!seen[u]) { seen[u] = 1; out.push({ u: u, l: v.l || 'Your program home' }); }
        }
      } catch (e) {}
    });
    return out;
  }
  function programSheet(progs) {
    style();
    var el = d.createElement('div'); el.className = 'wg-app-sheet';
    el.innerHTML = '<div class="in" role="dialog" aria-label="Your programs"><h3>Your programs</h3><div class="wg-app-progs"></div>' +
      '<button type="button" class="wg-app-btn ghost">Close</button></div>';
    var list = el.querySelector('.wg-app-progs');
    progs.forEach(function (p) { var a = d.createElement('a'); a.href = p.u; a.textContent = p.l; list.appendChild(a); });
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('.ghost')) el.remove(); });
    d.body.appendChild(el);
  }
  var ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    tools: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    program: '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 9h6M9 13h6"/>'
  };
  function tabBar() {
    if (d.getElementById('wg-app-nav')) return;
    style();
    [].forEach.call(d.querySelectorAll('a[href="/app/"]'), function (a) {
      if (/get the app/i.test(a.textContent)) (a.closest('li') || a).style.display = 'none';
    });
    var here = path.replace(/\/$/, '') || '/', progs = myPrograms();
    var items = [['/app/', 'Home', 'home'], ['/tools/', 'Tools', 'tools']];
    // One program opens straight away; two or more open a list of her program homes.
    if (progs.length === 1) items.push([progs[0].u, 'My program', 'program']);
    else if (progs.length > 1) items.push(['#programs', 'My programs', 'program']);
    if (here !== '/app') items.unshift(['', 'Back', 'back']);
    var nav = d.createElement('nav'); nav.id = 'wg-app-nav'; nav.className = 'wg-app-nav'; nav.setAttribute('aria-label', 'App');
    items.forEach(function (it) {
      var el = d.createElement(it[0] ? 'a' : 'button');
      if (it[0] === '#programs') { el.href = '#'; el.addEventListener('click', function (e) { e.preventDefault(); programSheet(progs); }); if (progs.some(function (p) { return p.u === here; })) el.className = 'on'; }
      else if (it[0]) { el.href = it[0]; if (here === it[0].replace(/\/$/, '').replace(/#.*$/, '')) el.className = 'on'; }
      else { el.type = 'button'; el.addEventListener('click', function () { if (w.history.length > 1) w.history.back(); else w.location.href = '/app/'; }); }
      el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[it[2]] + '</svg><span>' + it[1] + '</span>';
      nav.appendChild(el);
    });
    d.body.appendChild(nav); d.body.classList.add('wg-in-app');
  }

  // Inside the app the footer shrinks to what must stay reachable: the not-medical-advice line, the legal pages and
  // "Privacy choices" (consent must be changeable at any time).
  function appFooter() {
    var f = d.querySelector('footer.site-footer');
    if (!f) return;
    [].forEach.call(f.children, function (c) { c.style.display = 'none'; });
    var line = d.createElement('div'); line.className = 'wg-app-foot';
    line.innerHTML = 'Educational, not medical advice. <a href="/legal/disclaimer">Disclaimer</a> &middot; <a href="/legal/privacy">Privacy</a> &middot; ' +
      '<a href="/legal/consumer-health-data">Health data</a> &middot; <a href="#" data-wg-choices>Privacy choices</a>';
    line.querySelector('[data-wg-choices]').addEventListener('click', function (e) { e.preventDefault(); try { w.CookieConsent.showPreferences(); } catch (err) {} });
    f.appendChild(line); f.classList.add('wg-app-foot-on');
  }

  // ── Finished games: a private, per-device marker ──────────────────
  // wg_played_v1 = { "/stage/tools/slug": timestamp }. The app home reads it to see which stage she plays in. It is
  // never sent anywhere, never in analytics, and not a saved entry. A game calls wgPlayed() when she reaches a result.
  var PLAYED = 'wg_played_v1';
  w.wgPlayed = function () {
    try {
      var m = w.location.pathname.match(/^\/(relationships|fertility|pregnancy|postpartum|parenting)\/tools\/([a-z0-9-]+)/);
      if (!m) return;
      var o = {}; try { o = JSON.parse(w.localStorage.getItem(PLAYED) || '{}') || {}; } catch (e) {}
      o['/' + m[1] + '/tools/' + m[2]] = Date.now();
      w.localStorage.setItem(PLAYED, JSON.stringify(o));
    } catch (e) {}
  };
  // Every quiz and checker already calls wgShowResult(type) when it scores, so a finished result counts as played.
  function hookResult() {
    if (typeof w.wgShowResult !== 'function' || w.wgShowResult.wgHooked) return;
    var orig = w.wgShowResult;
    w.wgShowResult = function (type) { if (type) w.wgPlayed(); return orig.apply(this, arguments); };
    w.wgShowResult.wgHooked = true;
  }
  hookResult(); d.addEventListener('DOMContentLoaded', hookResult);

  // ── Saved entries: backup and restore ──────────────────
  function savedKeys() {
    var out = [];
    try { for (var i = 0; i < w.localStorage.length; i++) { var k = w.localStorage.key(i); if (/^wg_/.test(k) && !/^wg_app_/.test(k)) out.push(k); } } catch (e) {}
    return out;
  }
  function pack() {
    var entries = {};
    savedKeys().forEach(function (k) { entries[k] = w.localStorage.getItem(k); });
    return { app: 'wholesome-girlies', v: 1, saved: new Date().toISOString(), entries: entries };
  }
  function unpack(data) {
    if (!data || data.app !== 'wholesome-girlies' || typeof data.entries !== 'object') throw new Error('not a backup');
    var n = 0;
    Object.keys(data.entries).forEach(function (k) {
      if (/^wg_/.test(k) && !/^wg_app_/.test(k) && typeof data.entries[k] === 'string') { w.localStorage.setItem(k, data.entries[k]); n++; }
    });
    return n;
  }
  function copyText(text, btn, done) {
    var ok = function () { if (btn) { btn.textContent = done; } };
    if (nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(text).then(ok, function () { fallback(); }); } else fallback();
    function fallback() {
      var t = d.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      d.body.appendChild(t); t.select(); try { d.execCommand('copy'); ok(); } catch (e) {} t.remove();
    }
  }

  // ── Remembering a buyer on the site ──────────────────────────────────────
  // When this browser holds a program home, the site shows her programs in three places: "My programs" in the site
  // header on every page that has the menu, her programs in the homepage programs block and on /programs/, and a small
  // resume pill at the bottom of the screen. Her place comes from what the reader saved (wg_read_<program>).
  var PROGRAMS = {
    'wife-material-blueprint': ['The Wife Material Blueprint', 'Blueprint', 'relationships'],
    'trying-to-conceive-blueprint': ['The Trying-to-Conceive Blueprint', 'Blueprint', 'fertility'],
    'first-pregnancy-plan': ['The First Pregnancy Plan', 'Plan', 'pregnancy'],
    'postpartum-reset': ['The 6-Week Postpartum Reset', 'Reset', 'postpartum'],
    'first-baby-playbook': ['The First Baby Playbook', 'Playbook', 'parenting'],
    'complete-motherhood-journey': ['The Complete Motherhood Journey', 'Motherhood Journey', '']
  };
  var MOTHERHOOD = ['trying-to-conceive-blueprint', 'first-pregnancy-plan', 'postpartum-reset', 'first-baby-playbook'];
  function readState(slug) {
    try { var v = JSON.parse(w.localStorage.getItem('wg_read_' + slug) || 'null'); return v && v.done ? v : null; } catch (e) { return null; }
  }
  function owned() {
    return myPrograms().map(function (p) {
      var slug = p.u.split('/')[2], base = slug.replace(/-diaspora$/, ''), meta = PROGRAMS[base];
      if (!meta) return null;
      var st = readState(slug) || {}, reader = '/programs/' + slug + '/read';
      var n = st.n || 0, total = st.total || 0, started = !!(n || st.last), finished = total && n >= total;
      return { home: p.u, slug: slug, base: base, name: meta[0], word: meta[1], stage: meta[2], at: st.at || 0, finished: finished, started: started,
        next: started && !finished ? st.next || '' : '', href: started && !finished && st.nextId ? reader + '#' + st.nextId : reader,
        btn: finished ? 'Read it again' : started ? 'Continue reading' : 'Start reading' };
    }).filter(Boolean);
  }
  var escHtml = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function mineStyle() {
    if (d.getElementById('wg-mine-css')) return;
    var css = d.createElement('style'); css.id = 'wg-mine-css';
    css.textContent =
      '.wg-mine{position:relative}' +
      '.wg-mine-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:0;font:inherit;font-weight:700;font-size:.96rem;color:var(--plum,#33322A);cursor:pointer;padding:6px 0}' +
      '.wg-mine-btn:after{content:"";width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-2px) rotate(45deg);transition:transform .2s}' +
      '.wg-mine.open .wg-mine-btn:after{transform:translateY(1px) rotate(-135deg)}' +
      '.wg-mine-menu{display:none;position:absolute;top:calc(100% + 10px);right:-12px;z-index:60;width:300px;background:#fff;border:2px solid var(--ink,#33322A);border-radius:16px;box-shadow:var(--sticker,5px 5px 0 #33322A);padding:8px}' +
      '.wg-mine.open .wg-mine-menu{display:block}' +
      '.wg-mine-item{display:block;padding:10px 12px;border-radius:10px;color:var(--plum,#33322A)!important}.wg-mine-item:hover{background:var(--olive-t,#E3E6CC);text-decoration:none}' +
      '.wg-mine-item b{display:block;font-size:.95rem;line-height:1.3}.wg-mine-item span{display:block;font-size:.84rem;font-weight:600;color:var(--plum-soft,#6b6a60);margin-top:2px}' +
      '.wg-mine-item em{display:block;font-style:normal;font-size:.86rem;font-weight:800;color:var(--terracotta,#a0522d);margin-top:4px}' +
      '.wg-mine-home{display:block;padding:0 12px 10px;font-size:.82rem;font-weight:700;color:var(--plum-soft,#6b6a60)!important}' +
      '.wg-mine-menu .wg-mine-home:not(:last-child){border-bottom:1px solid var(--line,#e5e2d8);margin-bottom:6px}' +
      '@media (max-width:860px){.wg-mine{width:100%}.wg-mine-btn{pointer-events:none;padding:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--plum-soft,#6b6a60)}.wg-mine-btn:after{display:none}' +
      '.wg-mine-menu{display:block;position:static;width:auto;border:1.5px solid var(--ink,#33322A);box-shadow:none;margin-top:6px}}' +
      '.wg-pill{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:55;display:flex;align-items:center;max-width:calc(100% - 32px);background:#fff;border:2px solid var(--ink,#33322A);border-radius:999px;box-shadow:var(--sticker,4px 4px 0 #33322A);animation:wgPill .35s ease}' +
      '.wg-pill{transition:transform .25s ease,opacity .25s ease}.wg-pill.away{transform:translate(-50%,140%);opacity:0;pointer-events:none}' +
      '@keyframes wgPill{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}@media (prefers-reduced-motion:reduce){.wg-pill{animation:none}}' +
      '.wg-pill a{display:flex;align-items:center;gap:10px;padding:8px 6px 8px 8px;font-weight:800;font-size:.95rem;color:var(--plum,#33322A);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wg-pill a:hover{text-decoration:none}' +
      '.wg-pill img{flex:none;width:30px;height:38px;object-fit:cover;border-radius:4px}' +
      '.wg-pill button{flex:none;width:36px;height:36px;margin-right:4px;border:0;background:none;font-size:1.3rem;line-height:1;color:var(--plum-soft,#6b6a60);cursor:pointer;border-radius:50%}.wg-pill button:hover{background:var(--olive-t,#E3E6CC)}' +
      '.wg-own{display:grid;gap:4px;padding:12px 0;border-top:1px solid var(--line,#e5e2d8)}.wg-own:first-of-type{border-top:0}' +
      '.wg-own b{font-family:var(--serif);font-size:1.12rem;font-weight:600}.wg-own span{font-size:.9rem;color:var(--plum-soft,#6b6a60)}.wg-own .btn{justify-self:start;margin-top:6px}' +
      '.card .tag.wg-yours{background:var(--olive,#6E7A3F);color:#fff}';
    d.head.appendChild(css);
  }
  function cover(base) { return '/assets/img/products/' + (base === 'wife-material-blueprint' ? 'wife-material' : base) + '-cover.webp?v=20261009c'; }
  function line(p) { return p.finished ? 'You have read it all' : p.next ? 'Up next: ' + p.next : p.started ? 'Pick up where you stopped' : 'Not started yet'; }
  // 1. "My programs" in the site header, before Programs. On a phone it shows inside the open menu.
  function headerMenu(list) {
    var ul = d.querySelector('.site-header .nav-links'), cta = ul && ul.querySelector('.nav-cta');
    if (!ul || d.querySelector('.wg-mine')) return;
    var li = d.createElement('li'); li.className = 'wg-mine';
    li.innerHTML = '<button type="button" class="wg-mine-btn" aria-expanded="false" aria-haspopup="true">My programs</button><div class="wg-mine-menu">' +
      list.map(function (p) {
        return '<a class="wg-mine-item" href="' + escHtml(p.href) + '"><b>' + escHtml(p.name) + '</b><span>' + escHtml(line(p)) + '</span><em>' + escHtml(p.btn) + ' &rarr;</em></a>' +
          '<a class="wg-mine-home" href="' + escHtml(p.home) + '">Program home</a>';
      }).join('') + '</div>';
    ul.insertBefore(li, cta ? cta.parentNode : null);
    var btn = li.querySelector('button');
    var set = function (on) { li.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!li.classList.contains('open')); });
    d.addEventListener('click', function (e) { if (!li.contains(e.target)) set(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && li.classList.contains('open')) { set(false); btn.focus(); } });
  }
  // 2. The homepage programs block lists her programs, and on /programs/ the cards she owns say "Yours".
  function programBlocks(list) {
    var box = d.querySelector('#program .card');
    if (box) {
      box.innerHTML = '<span class="tag wg-yours">Yours</span><h3>Your programs</h3>' + list.map(function (p) {
        return '<div class="wg-own"><b>' + escHtml(p.name) + '</b><span>' + escHtml(line(p)) + '</span><a class="btn btn-primary" href="' + escHtml(p.href) + '">' + escHtml(p.btn) + ' &rarr;</a></div>';
      }).join('');
      var more = d.querySelector('#program .hero-actions .btn'); if (more) more.textContent = 'See every program';
    }
    if (path.replace(/\/$/, '') !== '/programs') return;
    var bundle = list.filter(function (p) { return p.base === 'complete-motherhood-journey'; })[0];
    [].forEach.call(d.querySelectorAll('a.card[href^="/programs/"], a.btn[href^="/programs/complete-motherhood-journey"]'), function (a) {
      var base = a.getAttribute('href').split('/')[2], mine = list.filter(function (p) { return p.base === base; })[0];
      var viaBundle = !mine && bundle && MOTHERHOOD.indexOf(base) > -1;
      if (!mine && !viaBundle) return;
      var href = mine ? mine.href : '/programs/' + base + (/-diaspora$/.test(bundle.slug) ? '-diaspora' : '') + '/read';
      a.setAttribute('href', href);
      var tag = a.querySelector('.tag'); if (tag) { tag.textContent = viaBundle ? 'Yours, in your Motherhood Journey' : 'Yours'; tag.classList.add('wg-yours'); }
      var arrow = a.querySelector('.arrow'); if (arrow) arrow.innerHTML = (mine ? escHtml(mine.btn) : 'Open it') + ' &rarr;';
      if (a.classList.contains('btn')) a.innerHTML = escHtml(mine.btn) + ' &rarr;';
    });
  }
  // 3. A small resume pill at the bottom: the program she read most recently. Not inside the app (the tab bar has
  //    My program), not on her program home or reader, sales pages, bridges or the quiet pages; hidden for the visit with ×.
  function pill(list) {
    if (standalone || noPrompt || session('wg_pill_off') || /^\/programs\/[^/]+\/(thank-you|read)$/.test(path) || /^\/app\/?$/.test(path)) return;
    var p = list.slice().sort(function (a, b) { return b.at - a.at; }).filter(function (x) { return !x.finished; })[0];
    if (!p) return;
    setTimeout(function () {
      if (d.documentElement.classList.contains('show--consent') || d.querySelector('.wg-app-bar')) return;
      var el = d.createElement('div'); el.className = 'wg-pill'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Your program');
      el.innerHTML = '<a href="' + escHtml(p.href) + '"><img src="' + cover(p.base) + '" alt="">' + (p.started ? 'Continue your ' : 'Start your ') + escHtml(p.word) + ' &rarr;</a>' +
        '<button type="button" aria-label="Hide for now">&times;</button>';
      el.querySelector('button').addEventListener('click', function () { el.remove(); session('wg_pill_off', '1'); push('resume_pill_hidden'); });
      el.querySelector('a').addEventListener('click', function () { push('resume_pill_click'); });
      d.body.appendChild(el);
      // It steps aside while she scrolls down through a page and comes back when she scrolls up, so it never sits
      // on a tool's own buttons while she uses them.
      var lastY = w.scrollY;
      w.addEventListener('scroll', function () {
        var y = w.scrollY;
        if (Math.abs(y - lastY) < 8) return;
        el.classList.toggle('away', y > lastY && y > 120); lastY = y;
      }, { passive: true });
    }, 1200);
  }
  // The "Stages" menu in the site header opens on a tap (its button carries the toggle); a tap elsewhere or Escape closes it.
  d.addEventListener('click', function (e) {
    var open = d.querySelector('.nav-stages.open');
    if (open && !open.contains(e.target)) { open.classList.remove('open'); open.querySelector('button').setAttribute('aria-expanded', 'false'); }
  });
  d.addEventListener('keydown', function (e) {
    var open = d.querySelector('.nav-stages.open');
    if (e.key === 'Escape' && open) { open.classList.remove('open'); var b = open.querySelector('button'); b.setAttribute('aria-expanded', 'false'); b.focus(); }
  });
  d.addEventListener('DOMContentLoaded', function () {
    var list = owned();
    if (!list.length) return;
    mineStyle(); headerMenu(list); programBlocks(list); pill(list);
  });

  w.WGApp = {
    standalone: standalone, ios: ios, android: android, inApp: inApp, phone: phone, iosBrowser: iosBrowser,
    install: install,
    appWords: appWords,
    savedKeys: savedKeys,
    remembering: function () { return !w.WGConsent || !w.WGConsent.state || !!w.WGConsent.state.remember; },
    downloadBackup: function () {
      var blob = new Blob([JSON.stringify(pack(), null, 1)], { type: 'application/json' });
      var a = d.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'wholesome-girlies-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      d.body.appendChild(a); a.click(); a.remove();
      push('app_backup_saved');
    },
    restoreBackup: function (file) {
      return file.text().then(function (t) { var n = unpack(JSON.parse(t)); push('app_backup_restored'); return n; });
    },
    // Rebuilds the installed app's tab bar after a program is added, so My program appears.
    refreshTabs: function () {
      var n = d.getElementById('wg-app-nav');
      if (n) n.remove();
      if (standalone) tabBar();
    },
    keep: function () { if (nav.storage && nav.storage.persist) nav.storage.persist().catch(function () {}); }
  };
})(window, document);
