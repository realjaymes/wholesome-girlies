/* Wholesome Girlies installable app (PWA, Level 1). Loaded on every page.
 *
 * 1. Registers /sw.js, which caches pages and files so the tools open without a connection.
 * 2. Offers "add to home screen" at the moments the plan names (06 - Virality Plan, section 8, Rollout):
 *    on a tool after she saves an entry, under a quiz or game result, and on the program thank-you hubs.
 *    Android Chrome gets the browser's own install prompt on our button; iPhone gets three steps, because
 *    Safari has no prompt; Instagram, TikTok and Facebook's built-in browsers get "open in Chrome or Safari",
 *    because nothing installs from inside them. The tool prompt shows at most once a visit, stays away for
 *    14 days after "Not now", and never shows on sales pages, ad bridges or the pages in QUIET.
 * 3. Gives the /app home its saved-entries backup, restore and iPhone move (window.WGApp).
 *
 * Her entries never leave her phone: the backup is a file she saves, the move is a code she copies, and
 * nothing here sends either anywhere. Analytics events carry where a prompt showed, never what she entered.
 */
(function (w, d) {
  var nav = w.navigator;
  var ua = nav.userAgent || '';
  var path = w.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var standalone = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Snapchat|\bLine\//i.test(ua);
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

  if (standalone && !session('wgapp_open')) { session('wgapp_open', '1'); push('app_open'); }
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
      '.wg-app-bar{position:fixed;left:12px;right:12px;bottom:12px;z-index:900;background:#fff;border:1px solid var(--line,#E3E0CF);border-radius:18px;box-shadow:0 10px 30px rgba(51,50,42,.18);padding:14px 16px;display:flex;gap:12px;align-items:center;max-width:560px;margin:0 auto}' +
      '.wg-app-bar img{width:40px;height:40px;border-radius:10px;flex:none}' +
      '.wg-app-bar p{margin:0;font-size:.95rem;line-height:1.35}' +
      '.wg-app-bar .wg-app-btns{display:flex;gap:8px;flex:none;flex-direction:column}' +
      '.wg-app-btn{border:0;border-radius:999px;background:var(--terracotta,#C0763F);color:#fff;font-weight:800;padding:9px 16px;cursor:pointer;font-size:.9rem}' +
      '.wg-app-btn.ghost{background:none;color:var(--plum-soft,#66645A);font-weight:700;padding:4px 8px}' +
      '.wg-app-line{margin:14px 0 0;font-size:.95rem}' +
      '.wg-app-line button{background:none;border:0;padding:0;color:var(--terracotta-dark,#9A5A2C);font-weight:800;text-decoration:underline;cursor:pointer;font-size:inherit}' +
      '.wg-app-sheet{position:fixed;inset:0;z-index:950;background:rgba(51,50,42,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.wg-app-sheet .in{background:#FBF8EF;border-radius:22px 22px 0 0;padding:22px 20px 28px;width:100%;max-width:560px;max-height:88vh;overflow:auto}' +
      '.wg-app-sheet h3{margin:0 0 12px}' +
      '.wg-app-sheet ol{margin:0 0 14px;padding-left:22px}.wg-app-sheet li{margin:8px 0}' +
      '.wg-app-sheet svg{width:18px;height:18px;vertical-align:-3px}' +
      '.wg-app-sheet .note{font-size:.88rem;color:var(--plum-soft,#66645A);margin:10px 0 0}';
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
    var b = el.querySelector('[data-copy-entries]');
    if (b) b.addEventListener('click', function () { copyEntries(b); });
    var l = el.querySelector('[data-copy-link]');
    if (l) l.addEventListener('click', function () { copyText(w.location.href, l, 'Link copied'); });
  }
  function closeSheet() { var el = d.getElementById('wg-app-sheet'); if (el) el.remove(); }

  function install(surface) {
    push('app_install_click', surface);
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) { push(c && c.outcome === 'accepted' ? 'app_install_accepted' : 'app_install_declined', surface); deferred = null; });
      return;
    }
    if (inApp) {
      sheet('<h3 id="wg-app-sheet-t">Open this page in your browser first</h3>' +
        '<p>Phones can only add Wholesome Girlies to the home screen from Chrome or Safari. Tap the menu at the top of this screen and choose <b>Open in browser</b>, or copy the link and paste it there.</p>' +
        '<p><button type="button" class="wg-app-btn" data-copy-link>Copy the link</button></p>');
      return;
    }
    if (ios) {
      var has = savedKeys().length > 0;
      sheet('<h3 id="wg-app-sheet-t">Add Wholesome Girlies to your home screen</h3>' +
        (has ? '<p><b>First, copy your saved entries.</b> On iPhone the app keeps its own storage, so your entries move across with a code.</p><p><button type="button" class="wg-app-btn" data-copy-entries>Copy my saved entries</button></p>' : '') +
        '<ol><li>Tap the Share button ' + SHARE_ICON + ' at the bottom of Safari.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. Girlies is now on your home screen.</li></ol>' +
        (has ? '<p class="note">Then open Girlies from your home screen, go to the app home and tap <b>Paste my saved entries</b>.</p>' : ''));
      return;
    }
    sheet('<h3 id="wg-app-sheet-t">Add Wholesome Girlies to your home screen</h3>' +
      '<ol><li>Open your browser menu (the three dots at the top).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Tap <b>Install</b> or <b>Add</b>.</li></ol>');
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
    d.body.appendChild(el);
    push('app_prompt_shown', surface);
  }
  function line(target, text, surface) {
    if (standalone || noPrompt || !target || target.querySelector('.wg-app-line')) return;
    style();
    var p = d.createElement('p'); p.className = 'wg-app-line';
    p.innerHTML = text + ' <button type="button">Add Wholesome Girlies to your home screen</button>';
    p.querySelector('button').addEventListener('click', function () { install(surface); });
    target.appendChild(p);
    push('app_prompt_shown', surface);
  }

  // 1. On a tool, after she saves an entry (only when her entries are kept on this device).
  var TOOL_KEY = /^wg_(?!lead$|app_|consent)(?!.*_home$)/;
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
        if (type) line(d.getElementById('wg-result-share'), 'Keep the newest games one tap away on your home screen.', 'result');
        return r;
      };
    }
    // 3. On a program thank-you hub, under "copy this page's link".
    if (/^\/programs\/[^/]+\/thank-you$/.test(path)) {
      line(d.querySelector('.sales-hero .wrap'), 'Your program home opens from there in one tap.', 'thank_you');
    }
  });

  // ── Saved entries: backup, restore and the iPhone move ──────────────────
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
  function toCode(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
  function fromCode(c) { return JSON.parse(decodeURIComponent(escape(atob(String(c).replace(/\s+/g, ''))))); }
  function copyText(text, btn, done) {
    var ok = function () { if (btn) { btn.textContent = done; } };
    if (nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(text).then(ok, function () { fallback(); }); } else fallback();
    function fallback() {
      var t = d.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      d.body.appendChild(t); t.select(); try { d.execCommand('copy'); ok(); } catch (e) {} t.remove();
    }
  }
  function copyEntries(btn) { copyText(toCode(pack()), btn, 'Your entries are copied. Now add the app.'); push('app_entries_copied'); }

  w.WGApp = {
    standalone: standalone, ios: ios, android: android, inApp: inApp,
    install: install,
    savedKeys: savedKeys,
    remembering: function () { return !w.WGConsent || !w.WGConsent.state || !!w.WGConsent.state.remember; },
    copyEntries: copyEntries,
    pasteEntries: function (code) { var n = unpack(fromCode(code)); push('app_entries_pasted'); return n; },
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
    keep: function () { if (nav.storage && nav.storage.persist) nav.storage.persist().catch(function () {}); }
  };
})(window, document);
