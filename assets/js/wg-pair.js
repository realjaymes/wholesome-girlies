/* The pair engine: one script for the games where two people answer the same questions.
   Player A answers and gets a link to send. Player B opens it and answers the same questions (kind "same") or guesses
   A's answers (kind "guess"), then B sees the comparison. Nothing is stored on any server.

   The link carries only A's answers to this game's questions, packed as one character per answer, in the URL
   fragment (#p=...), which browsers never send to a server. It also carries the answer-set choice the game offers
   (for example girl names, boy names or both) and a first name only if she types one. Never dates, health data or
   results from other tools. B's reply link adds B's answers as #p=...&b=... so A can open the comparison too.
   The page's head script moves the fragment out of the address bar before any tag loads (the page address is
   reported by analytics), keeping it in window.__wgPair, with a copy in sessionStorage so a reload keeps B's place.

   Usage (see pregnancy/tools/baby-name-battle.html for a full example):
     WGPair.start({
       root: "#pair-stage", id: "baby-name-battle", code: "bn", kind: "same" | "guess",
       path: "/pregnancy/tools/baby-name-battle", fallbackName: "Your partner",
       settings: { label, help, options: ["Girl names", ...] } | null,
       questions: function (settingIndex) { return [{ q, a, b, section, opts: ["text" | { t, sub, open }] }]; },
       copy: { introA, carries, startLabel, nameLabel, doneTitle, doneLead, shareMessage, introBTitle(name), introBLead,
               finishLabel (B), finishLabelA (A, default "Get my link"), compareTitle, sameNote, replyLabel, replyMessage(ctx), resetLabel },
       result: function (score, total) -> { type, band, title, summary }   (guess kind only)
       renderCompare: function (ctx, box) (optional custom comparison)
     });
   Guess questions carry q.a (asked of A, "your") and q.b (asked of B, with {name}). Same questions carry q.q. */
(function (w, d) {
  "use strict";
  var SITE = "https://wholesomegirlies.xyz";
  var CSS =
    ".wp{display:block}" +
    ".wp h2.wp-title{margin:0 0 8px;font-size:1.45rem}" +
    ".wp-lead{margin:0 0 10px;font-size:.95rem;line-height:1.45}" +
    ".wp-note{border:2px solid var(--ink,#33322A);background:var(--s-t,#F6F2E3);border-radius:var(--radius-sm,10px);padding:10px 12px;margin:10px 0;font-size:.88rem;line-height:1.4}" +
    ".wp-warn{border-color:var(--sage,#B5532E);background:#F6ECE3}" +
    ".wp-field{display:block;margin:10px 0}" +
    ".wp-field>span{display:block;font-weight:800;margin-bottom:4px}" +
    ".wp-field input[type=text]{width:100%;max-width:340px;font:inherit;padding:10px 12px;border:2px solid var(--ink,#33322A);border-radius:var(--radius-sm,10px);background:#fff}" +
    ".wp-field small{display:block;margin-top:4px;font-size:.82rem;line-height:1.35;color:var(--muted,#6b6a5e)}" +
    ".wp-head{display:flex;align-items:center;gap:12px;margin:0 0 16px}" +
    ".wp-count{flex:none;font-weight:800;font-size:.9rem}" +
    ".wp-bar{flex:1;height:12px;border-radius:8px;background:#fff;border:1.5px solid var(--ink,#33322A);overflow:hidden}" +
    ".wp-bar span{display:block;height:100%;width:0;background:var(--s,#6E7A3F);transition:width .3s ease}" +
    ".wp-q{animation:wpIn .28s ease}" +
    "@keyframes wpIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}" +
    "@media (prefers-reduced-motion:reduce){.wp-q{animation:none}.wp-bar span{transition:none}}" +
    ".wp-sec{font-size:.8rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin:0 0 6px;color:var(--terracotta-dark,#55602F)}" +
    ".wp-q .qtext{display:block;font-weight:800;font-size:1.12rem;line-height:1.4;margin:0 0 14px;outline:0}" +
    ".wp-opts{display:flex;flex-direction:column;gap:8px}" +
    ".wp-opts label{position:relative;display:block;border:1px solid var(--line,#DFDCC0);background:#fff;border-radius:var(--radius-sm,10px);padding:12px 14px;font-weight:400;cursor:pointer;text-align:center}" +
    ".wp-opts label:has(input:checked){font-weight:700;background:var(--s-t,#F6F2E3);border-color:var(--ink,#33322A)}" +
    ".wp-opts input{position:absolute;opacity:0;width:1px;height:1px}" +
    ".wp-opts label:has(input:focus-visible){outline:2px solid var(--terracotta,#6E7A3F);outline-offset:3px}" +
    ".wp-opts small{display:block;font-weight:400;color:var(--muted,#6b6a5e);margin-top:2px}" +
    ".wp-nav{display:flex;align-items:center;margin:14px 0 0}" +
    ".wp-back{background:none;border:0;font:inherit;font-weight:800;color:var(--ink,#33322A);cursor:pointer;padding:8px 0}" +
    ".wp-back[disabled]{visibility:hidden}" +
    ".wp-chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 0}" +
    ".wp-chips label{position:relative;border:1px solid var(--line,#DFDCC0);background:#fff;border-radius:999px;padding:8px 16px;cursor:pointer}" +
    ".wp-chips label:has(input:checked){font-weight:700;background:var(--s-t,#F6F2E3);border-color:var(--ink,#33322A)}" +
    ".wp-chips input{position:absolute;opacity:0;width:1px;height:1px}" +
    ".wp-chips label:has(input:focus-visible){outline:2px solid var(--terracotta,#6E7A3F);outline-offset:3px}" +
    ".wp-wa{display:inline-flex;align-items:center;gap:10px;margin:6px 0 4px}" +
    ".wp-wa svg{width:20px;height:20px;fill:currentColor}" +
    ".wp-sub{font-weight:800;margin:20px 0 6px;color:var(--terracotta-dark,#55602F)}" +
    ".wp-actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 0}" +
    ".wp-score{font-family:'DM Serif Display',serif;font-size:2.6rem;line-height:1;margin:6px 0 4px}" +
    ".wp-sum{font-weight:700;margin:0 0 6px}" +
    ".wp-list{list-style:none;padding:0;margin:8px 0 0}" +
    ".wp-list li{padding:12px 0;border-bottom:1px solid var(--line,#DFDCC0)}" +
    ".wp-list .wp-qq{font-weight:800;margin:0 0 6px}" +
    ".wp-row{display:flex;flex-wrap:wrap;gap:4px 14px;margin:2px 0}" +
    ".wp-who{font-weight:800}" +
    ".wp-tag{display:inline-block;font-size:.8rem;font-weight:800;border:2px solid var(--ink,#33322A);border-radius:999px;padding:2px 10px;margin-top:6px}" +
    ".wp-tag.ok{background:var(--olive-t,#E4E8D0)}.wp-tag.talk{background:var(--mustard-t,#F7E8B8)}.wp-tag.no{background:var(--rust-t,#F3D9CF)}" +
    ".wp-names{display:grid;grid-template-columns:1fr;gap:10px;margin:8px 0 0}" +
    ".wp-name{border:2px solid var(--ink,#33322A);border-radius:var(--radius-sm,10px);background:#fff;padding:10px 14px}" +
    ".wp-name b{font-size:1.1rem}.wp-name small{display:block;color:var(--muted,#6b6a5e)}" +
    ".wp-vs{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    "@media (max-width:380px){.wp-vs{grid-template-columns:1fr}}" +
    ".wp-copy{display:block;width:100%;font:inherit;font-size:.85rem;padding:8px 10px;border:1.5px solid var(--line,#DFDCC0);border-radius:8px;background:#fff;margin:6px 0}";

  var WA = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function enc(s) { return encodeURIComponent(s); }
  function push(ev, o) {
    w.dataLayer = w.dataLayer || [];
    var e = { event: ev };
    for (var k in o) e[k] = o[k];
    w.dataLayer.push(e);
  }
  function cleanName(s) {
    return String(s || "").replace(/[^\p{L}' \-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  }
  function fill(t, name) { return String(t).replace(/\{name\}/g, name); }
  function qOpt(o) { return typeof o === "string" ? { t: o } : o; }

  function Game(cfg) {
    this.cfg = cfg;
    this.box = d.querySelector(cfg.root);
    if (!this.box) return;
    this.kind = cfg.kind;
    this.copy = cfg.copy || {};
    this.setting = null;
    this.nameA = "";
    this.nameB = "";
    this.aAns = null;
    this.bAns = null;
    this.mine = [];
    this.role = "A";
    this.notice = "";
    this.parseLink();
    this.route();
  }

  var P = Game.prototype;

  // ---- the link: #p=<code>.<setting>.<answers>.<name>  and optionally  &b=<same shape> ----
  P.pack = function (setting, ans, name) {
    return this.cfg.code + "1." + (setting == null ? "_" : setting) + "." + ans.map(function (a) { return a == null ? "_" : a.toString(36); }).join("") + "." + enc(cleanName(name));
  };
  P.unpack = function (s, expectSetting) {
    if (!s) return null;
    var m = String(s).match(/^([a-z]+)1\.([0-9_])\.([0-9a-z_]*)\.?([^&]*)$/);
    if (!m || m[1] !== this.cfg.code) return null;
    var setting = m[2] === "_" ? null : parseInt(m[2], 10);
    if (expectSetting !== undefined && setting !== expectSetting) return null;
    if (this.cfg.settings && (setting == null || setting >= this.cfg.settings.options.length)) return null;
    var qs = this.cfg.questions(setting);
    if (m[3].length !== qs.length) return null;
    var ans = [];
    for (var i = 0; i < qs.length; i++) {
      var v = parseInt(m[3].charAt(i), 36);
      if (isNaN(v) || v >= qs[i].opts.length) return null;
      ans.push(v);
    }
    var name = "";
    try { name = cleanName(decodeURIComponent(m[4] || "")); } catch (e) {}
    return { setting: setting, ans: ans, name: name };
  };
  P.parseLink = function () {
    var raw = w.__wgPair || "";
    if (!raw && /^#(p|b)=/.test(location.hash)) raw = location.hash;
    raw = raw.replace(/^#/, "");
    if (!raw) return;
    var parts = {};
    raw.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1);
    });
    var A = this.unpack(parts.p);
    if (!A) { this.notice = "That link did not open properly. You can start your own below."; return; }
    this.setting = A.setting;
    this.aAns = A.ans;
    this.nameA = A.name;
    this.role = "B";
    if (parts.b) {
      var B = this.unpack(parts.b, A.setting);
      if (B) { this.bAns = B.ans; this.nameB = B.name; this.role = "V"; }
    }
  };

  // ---- routing ----
  P.route = function () {
    if (!d.getElementById("wg-pair-css")) {
      var st = el("style"); st.id = "wg-pair-css"; st.textContent = CSS; d.head.appendChild(st);
    }
    this.box.classList.add("wp");
    if (this.role === "V") return this.compare();
    if (this.role === "B") return this.introB();
    this.introA();
  };
  P.clear = function () {
    this.box.innerHTML = "";
    var res = d.getElementById("res");
    if (res) { res.classList.remove("show"); }
    if (w.wgShowResult && res) w.wgShowResult(null);
  };
  P.top = function () {
    var r = this.box.getBoundingClientRect();
    if (r.top < 0 || r.top > w.innerHeight * 0.6) w.scrollTo({ top: Math.max(0, r.top + w.scrollY - 90), behavior: "smooth" });
  };
  P.aName = function () { return this.nameA || this.cfg.fallbackName || "Your partner"; };
  P.questions = function () { return this.cfg.questions(this.setting); };

  // ---- intro screens ----
  P.nameField = function (label, value, onInput) {
    var f = el("label", "wp-field");
    f.appendChild(el("span", null, label));
    var i = el("input"); i.type = "text"; i.maxLength = 16; i.autocomplete = "off"; i.value = value || "";
    i.addEventListener("input", function () { onInput(cleanName(i.value)); });
    f.appendChild(i);
    return f;
  };
  P.introA = function () {
    var g = this, c = this.copy;
    this.clear();
    if (this.notice) this.box.appendChild(el("p", "wp-note wp-warn", this.notice));
    this.box.appendChild(el("p", "wp-lead", c.introA));
    var cfgS = this.cfg.settings;
    if (cfgS) {
      var wrap = el("div", "wp-field");
      wrap.appendChild(el("span", null, cfgS.label));
      var chips = el("div", "wp-chips"); chips.setAttribute("role", "radiogroup");
      cfgS.options.forEach(function (o, i) {
        var l = el("label"), inp = el("input"); inp.type = "radio"; inp.name = "wp-setting"; inp.value = i;
        if (g.setting === i || (g.setting == null && i === (cfgS.def || 0))) inp.checked = true;
        l.appendChild(inp); l.appendChild(el("span", null, o)); chips.appendChild(l);
      });
      wrap.appendChild(chips);
      if (cfgS.help) wrap.appendChild(el("small", null, cfgS.help));
      this.box.appendChild(wrap);
    }
    var nf = this.nameField(c.nameLabel || "Your first name (optional)", this.nameA, function (v) { g.nameA = v; });
    nf.appendChild(el("small", null, c.nameHelp || "Only if you want it on your partner's screen. Leave it empty and it says \"" + (this.cfg.fallbackName || "Your partner") + "\"."));
    this.box.appendChild(nf);
    this.box.appendChild(el("p", "wp-note", c.carries));
    var go = el("button", "btn btn-primary", c.startLabel || "Start"); go.type = "button";
    go.addEventListener("click", function () {
      if (cfgS) {
        var sel = g.box.querySelector("input[name=wp-setting]:checked");
        g.setting = sel ? parseInt(sel.value, 10) : (cfgS.def || 0);
      }
      g.mine = [];
      g.ask("A");
      push("pair_start", { tool_name: g.cfg.id, pair_role: "a" });
    });
    this.box.appendChild(go);
  };
  P.introB = function () {
    var g = this, c = this.copy, name = this.aName();
    this.clear();
    if (this.notice) this.box.appendChild(el("p", "wp-note wp-warn", this.notice));
    this.box.appendChild(el("h2", "wp-title", c.introBTitle ? c.introBTitle(name) : name + " answered. Your turn."));
    this.box.appendChild(el("p", "wp-lead", c.introBLead));
    this.box.appendChild(this.nameField(c.nameLabelB || "Your first name (optional)", this.nameB, function (v) { g.nameB = v; }));
    this.box.appendChild(el("p", "wp-note", c.carriesB || c.carries));
    var go = el("button", "btn btn-primary", c.startLabelB || "Start"); go.type = "button";
    go.addEventListener("click", function () { g.mine = []; g.ask("B"); push("pair_start", { tool_name: g.cfg.id, pair_role: "b" }); });
    this.box.appendChild(go);
    var own = el("p", "muted"); own.style.marginTop = "14px";
    var a = el("a", null, c.ownLabel || "Start your own instead"); a.href = "#"; a.addEventListener("click", function (e) { e.preventDefault(); g.startOwn(); });
    own.appendChild(a); this.box.appendChild(own);
  };
  P.startOwn = function () {
    this.role = "A"; this.aAns = null; this.bAns = null; this.setting = null; this.nameA = ""; this.nameB = ""; this.notice = "";
    w.__wgPair = "";
    try { sessionStorage.removeItem("wg_pair_" + this.cfg.id); } catch (e) {}
    this.introA();
    this.top();
  };

  // ---- the questions, one at a time ----
  P.ask = function (who) {
    var g = this, qs = this.questions(), i = 0, name = this.aName();
    this.mine = new Array(qs.length);
    function text(q) {
      if (g.kind === "guess") return who === "A" ? q.a : fill(q.b, name);
      return q.q;
    }
    function show(k, scroll) {
      i = Math.max(0, Math.min(qs.length - 1, k));
      g.clear();
      var q = qs[i];
      var head = el("div", "wp-head");
      var cnt = el("span", "wp-count", "Question " + (i + 1) + " of " + qs.length); cnt.setAttribute("aria-live", "polite");
      var bar = el("span", "wp-bar"); bar.setAttribute("aria-hidden", "true");
      var fillBar = el("span"); fillBar.style.width = ((i + (g.mine[i] != null ? 1 : 0)) / qs.length * 100) + "%"; bar.appendChild(fillBar);
      head.appendChild(cnt); head.appendChild(bar); g.box.appendChild(head);
      var wrap = el("div", "wp-q");
      if (q.section) wrap.appendChild(el("p", "wp-sec", q.section));
      var qt = el("span", "qtext", text(q)); qt.tabIndex = -1; wrap.appendChild(qt);
      var opts = el("div", "wp-opts"); opts.setAttribute("role", "radiogroup");
      q.opts.forEach(function (o, n) {
        o = qOpt(o);
        var l = el("label"), inp = el("input"); inp.type = "radio"; inp.name = "wp-q"; inp.value = n;
        if (g.mine[i] === n) inp.checked = true;
        l.appendChild(inp);
        l.appendChild(el("span", null, o.t));
        if (o.sub) l.appendChild(el("small", null, o.sub));
        opts.appendChild(l);
      });
      wrap.appendChild(opts); g.box.appendChild(wrap);
      var nav = el("div", "wp-nav");
      var back = el("button", "wp-back", "← Back"); back.type = "button"; back.disabled = i === 0;
      back.addEventListener("click", function () { show(i - 1, true); });
      nav.appendChild(back); g.box.appendChild(nav);
      var fin = el("button", "btn btn-primary", (who === "A" ? (g.copy.finishLabelA || "Get my link") : g.copy.finishLabel) || "Finish"); fin.type = "button";
      fin.style.display = (i === qs.length - 1 && g.mine[i] != null) ? "" : "none";
      fin.addEventListener("click", function () { g.finish(who); });
      g.box.appendChild(fin);
      opts.addEventListener("change", function (e) {
        var n = parseInt(e.target.value, 10);
        g.mine[i] = n;
        fillBar.style.width = ((i + 1) / qs.length * 100) + "%";
        if (i < qs.length - 1) {
          var from = i;
          setTimeout(function () { if (i === from) show(from + 1, true); }, 380);
        } else fin.style.display = "";
      });
      if (scroll) { g.top(); try { qt.focus({ preventScroll: true }); } catch (e) {} }
    }
    show(0, true);
  };

  P.finish = function (who) {
    if (w.wgPlayed) w.wgPlayed();
    if (who === "A") {
      this.aAns = this.mine.slice();
      this.share();
      push("tool_complete", { tool_name: this.cfg.id, pair_role: "a" });
    } else {
      this.bAns = this.mine.slice();
      this.role = "B-done";
      push("partner_complete", { tool_name: this.cfg.id, pair_role: "b" });
      this.compare();
    }
    this.top();
  };

  // ---- A: the link to send ----
  P.hash = function (withB) {
    var h = "#p=" + this.pack(this.setting, this.aAns, this.nameA);
    if (withB) h += "&b=" + this.pack(this.setting, this.bAns, this.nameB);
    return h;
  };
  P.url = function (ref, withB) { return SITE + this.cfg.path + "?ref=" + ref + this.hash(withB); };
  P.shareBlock = function (message, withB, surface) {
    var g = this, frag = this.hash(withB), id = this.cfg.id;
    var wrap = el("div");
    var wa = el("a", "btn btn-primary wp-wa");
    wa.href = "https://wa.me/?text=" + enc(message + "\n" + this.url("wa", withB));
    wa.target = "_blank"; wa.rel = "noopener";
    wa.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + WA + '"/></svg>';
    wa.appendChild(el("span", null, withB ? (this.copy.replyLabel || "Send it back on WhatsApp") : (this.copy.sendLabel || "Send to my partner on WhatsApp")));
    wa.addEventListener("click", function () { push("share_click", { share_channel: "whatsapp", share_item: id, share_surface: surface }); });
    wrap.appendChild(wa);
    wrap.appendChild(el("p", "wp-sub", "Or send it another way"));
    var s = el("div", "wg-share");
    s.setAttribute("data-share-id", id); s.setAttribute("data-share-surface", surface);
    s.setAttribute("data-share-path", this.cfg.path); s.setAttribute("data-share-text", message);
    s.setAttribute("data-share-size", "sm");
    wrap.appendChild(s);
    function patch() {
      if (!w.wgShareInit || !s.isConnected) { if ((patch.n = (patch.n || 0) + 1) < 60) setTimeout(patch, 100); return; }
      w.wgShareInit();
      [].forEach.call(s.querySelectorAll("a.wg-share-btn"), function (a) {
        a.href = a.href.replace(/(ref%3D(?:wa|x|fb|th|li))(?=&|$)/, "$1" + enc(frag));
      });
    }
    setTimeout(patch, 0);
    s.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button.wg-share-btn");
      if (!b) return;
      var label = b.getAttribute("aria-label");
      if (label !== "Copy link" && label !== "Share to Instagram") return;
      e.stopImmediatePropagation(); e.preventDefault();
      var ch = label === "Copy link" ? "copy" : "instagram";
      push("share_click", { share_channel: ch, share_item: id, share_surface: surface });
      var full = g.url(ch === "copy" ? "link" : "ig", withB);
      var msg = s.querySelector(".wg-share-msg");
      function say(t) { if (msg) { msg.textContent = t; setTimeout(function () { msg.textContent = ""; }, 3500); } }
      if (ch === "instagram" && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        navigator.share({ text: message, url: full }).catch(function (err) {
          if (err && err.name === "AbortError") return;
          copyText(full, function () { say("Link copied. Paste it into your Instagram Story or a DM."); });
        });
        return;
      }
      copyText(full, function () { say(ch === "copy" ? "Link copied." : "Link copied. Paste it into your Instagram Story or a DM."); });
    }, true);
    return wrap;
  };
  function copyText(text, ok) {
    function fallback() {
      var ta = el("textarea"); ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      d.body.appendChild(ta); ta.select();
      var done = false;
      try { done = d.execCommand("copy"); } catch (e) {}
      d.body.removeChild(ta);
      if (done) ok(); else w.prompt("Copy this link", text);
    }
    if (navigator.clipboard && w.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }
  P.share = function () {
    var g = this, c = this.copy;
    this.clear();
    this.box.appendChild(el("h2", "wp-title", c.doneTitle));
    this.box.appendChild(el("p", "wp-lead", c.doneLead));
    this.box.appendChild(this.shareBlock(c.shareMessage, false, "pair-link"));
    this.box.appendChild(el("p", "wp-note", c.carries));
    var acts = el("div", "wp-actions");
    var again = el("button", "btn btn-ghost", c.resetLabel || "Start over"); again.type = "button";
    again.style.background = "#fff";
    again.addEventListener("click", function () { g.startOwn(); });
    acts.appendChild(again); this.box.appendChild(acts);
  };

  // ---- the comparison ----
  P.compare = function () {
    var g = this, c = this.copy, qs = this.questions();
    this.clear();
    var viewer = this.role === "V";
    var nA = viewer ? (this.nameA || "You") : this.aName();
    var nB = viewer ? (this.nameB || this.cfg.fallbackB || this.cfg.fallbackName || "Your partner") : (this.nameB || "You");
    var ctx = { qs: qs, a: this.aAns, b: this.bAns, nameA: nA, nameB: nB, setting: this.setting, viewer: viewer };
    this.box.appendChild(el("h2", "wp-title", c.compareTitle || "Here is how it came out"));
    var body = el("div"); this.box.appendChild(body);
    if (this.cfg.renderCompare) this.cfg.renderCompare(ctx, body, { el: el });
    else if (this.kind === "guess") this.renderGuess(ctx, body);
    else this.renderSame(ctx, body);
    if (this.kind === "guess") this.showResult(ctx);
    // send it back
    if (!viewer && c.replyMessage) {
      var rep = el("div");
      var msg = typeof c.replyMessage === "function" ? c.replyMessage({ score: ctx.score, total: qs.length, nameA: this.nameA, nameB: this.nameB }) : c.replyMessage;
      var withB = this.cfg.reply !== "score";
      if (withB) {
        rep.appendChild(el("p", "wp-sub", c.replyTitle || "Send it back so " + this.aName() + " can see too"));
        rep.appendChild(this.shareBlock(msg, true, "pair-reply"));
      } else {
        rep.appendChild(el("p", "wp-sub", c.replyTitle || "Tell " + this.aName() + " how you did"));
        var wa = el("a", "btn btn-primary wp-wa");
        wa.href = "https://wa.me/?text=" + enc(msg + "\n" + SITE + this.cfg.path + "?ref=wa");
        wa.target = "_blank"; wa.rel = "noopener";
        wa.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + WA + '"/></svg>';
        wa.appendChild(el("span", null, c.replyLabel || "Send my score on WhatsApp"));
        wa.addEventListener("click", function () { push("share_click", { share_channel: "whatsapp", share_item: g.cfg.id, share_surface: "pair-score" }); });
        rep.appendChild(wa);
        rep.appendChild(el("p", "muted", "This message has your score only. It carries none of the answers."));
      }
      this.box.appendChild(rep);
    }
    var acts = el("div", "wp-actions");
    var own = el("button", "btn btn-ghost", c.ownLabel2 || "Make my own"); own.type = "button"; own.style.background = "#fff";
    own.addEventListener("click", function () { g.startOwn(); });
    acts.appendChild(own); this.box.appendChild(acts);
  };
  P.renderSame = function (ctx, body) {
    var g = this, c = this.copy, agree = 0;
    var list = el("ul", "wp-list");
    var lastSec = null;
    ctx.qs.forEach(function (q, i) {
      var oa = qOpt(q.opts[ctx.a[i]]), ob = qOpt(q.opts[ctx.b[i]]);
      var same = ctx.a[i] === ctx.b[i] && !oa.open;
      if (same) agree++;
      var li = el("li");
      if (q.section && q.section !== lastSec) { li.appendChild(el("p", "wp-sec", q.section)); lastSec = q.section; }
      li.appendChild(el("p", "wp-qq", q.q));
      var r1 = el("p", "wp-row"); r1.appendChild(el("span", "wp-who", ctx.nameA + ":")); r1.appendChild(el("span", null, oa.t)); li.appendChild(r1);
      var r2 = el("p", "wp-row"); r2.appendChild(el("span", "wp-who", ctx.nameB + ":")); r2.appendChild(el("span", null, ob.t)); li.appendChild(r2);
      li.appendChild(el("span", "wp-tag " + (same ? "ok" : "talk"), same ? (c.agreeLabel || "You agree") : (c.talkLabel || "Talk about this")));
      list.appendChild(li);
    });
    ctx.agree = agree;
    var total = ctx.qs.length;
    body.appendChild(el("p", "wp-score", agree + " of " + total));
    body.appendChild(el("p", "wp-sum", agree === total ? (c.allSame || "You gave the same answer to every question.") : "You agree on " + agree + ". Talk about the other " + (total - agree) + "."));
    if (c.sameNote) body.appendChild(el("p", "wp-note", c.sameNote));
    body.appendChild(list);
  };
  P.renderGuess = function (ctx, body) {
    var score = 0, list = el("ul", "wp-list");
    ctx.qs.forEach(function (q, i) {
      var right = ctx.a[i] === ctx.b[i];
      if (right) score++;
      var li = el("li");
      li.appendChild(el("p", "wp-qq", fill(q.b, ctx.nameA)));
      var r1 = el("p", "wp-row"); r1.appendChild(el("span", "wp-who", ctx.nameA + " said:")); r1.appendChild(el("span", null, qOpt(q.opts[ctx.a[i]]).t)); li.appendChild(r1);
      var r2 = el("p", "wp-row"); r2.appendChild(el("span", "wp-who", (ctx.viewer ? ctx.nameB : "You") + " guessed:")); r2.appendChild(el("span", null, qOpt(q.opts[ctx.b[i]]).t)); li.appendChild(r2);
      li.appendChild(el("span", "wp-tag " + (right ? "ok" : "no"), right ? "Right" : "Not this time"));
      list.appendChild(li);
    });
    ctx.score = score;
    body.appendChild(el("p", "wp-score", score + " / " + ctx.qs.length));
    body.appendChild(list);
  };
  P.showResult = function (ctx) {
    var res = d.getElementById("res");
    if (!res || !this.cfg.result) return;
    var r = this.cfg.result(ctx.score, ctx.qs.length, ctx);
    d.getElementById("band").textContent = r.band;
    d.getElementById("headline").textContent = r.title;
    d.getElementById("summary").textContent = r.summary;
    res.classList.add("show");
    if (w.wgShowResult) w.wgShowResult(r.type);
  };

  w.WGPair = {
    start: function (cfg) { return new Game(cfg); },
    el: el, cleanName: cleanName
  };
})(window, document);
