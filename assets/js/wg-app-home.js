/* Wholesome Girlies: the app home (/app/), one main action for every woman. Loaded only on /app/, after wg-next.js, wg-first1000.js,
 * wg-account.js and wg-streak.js. The rule book (WGNext) works out who she is; this file draws the page for that state. Vault: Site & App
 * note 07, "App home by state".
 *
 *   #appMain      her one main action, by state:
 *                   visitor, engaged, known   the one offer card (the First 100 while places are left, else the paid program), or nothing
 *                                             when she has no stage yet (the stage picker sits in the today row)
 *                   campaign member           the step card: her next way to earn a month
 *                   buyer, bundle, both       the lesson card: "Lesson N of T is next."
 *                   lapsed member             the keep card
 *   #appProgram   a member's compact "continue reading" row, or a buyer-and-member's second program line
 *   #appToday     the streak row (wg-streak.js), under the main action, never an offer
 *   #appSave      "Save your tools on any phone" for a woman who has used the app but left no email
 *   #appCommunity the private group row for a buyer
 *   #appFirst     "See every way to earn months" for a member
 * No price is shown on the app home. Everything goes in with textContent.
 */
(function (w, d) {
  'use strict';
  var seq = 0;
  function $(id) { return d.getElementById(id); }
  function mk(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function clear(id) { var b = $(id); if (!b) return null; b.textContent = ''; b.hidden = true; return b; }
  function show(b, node, action) { if (!b || !node) return; b.appendChild(node); b.hidden = false; if (action && w.WGNext) w.WGNext.mark(node, 'app_home', action); }
  function style() {
    if ($('wgh-css')) return;
    var s = mk('style'); s.id = 'wgh-css';
    s.textContent = '.wgh-step{text-align:left}.wgh-step .eyebrow{margin:0 0 8px}.wgh-step h2{margin:0 0 12px;font-size:1.3rem;line-height:1.25}.wgh-step .btn{display:flex;width:100%;justify-content:center;box-sizing:border-box;margin:0}' +
      '.wgh-row{display:flex;gap:12px;align-items:center;padding:10px 12px;border:2px solid var(--ink,#33322A);border-radius:14px;background:#fff;text-decoration:none;color:inherit}.wgh-row:hover{text-decoration:none}' +
      '.wgh-row img{width:36px;height:45px;border-radius:4px;border:2px solid var(--ink,#33322A);object-fit:cover;flex:none}.wgh-row b{display:block}.wgh-row small{display:block;color:var(--muted,#6b6b60);font-size:.85rem}' +
      '.wgh-note{margin:10px 0 0;font-size:.92rem}.wgh-more summary{cursor:pointer;font-weight:800;text-decoration:underline;margin:4px 0}.wgh-more .f1k-app{margin-top:10px}' +
      '.wgh-save summary{display:flex;gap:12px;align-items:center;cursor:pointer;list-style:none;padding:10px 12px;border:2px solid var(--ink,#33322A);border-radius:14px;background:#fff}.wgh-save summary::-webkit-details-marker{display:none}.wgh-save summary b{display:block}.wgh-save summary small{display:block;color:var(--muted,#6b6b60);font-size:.85rem}.wgh-save[open] summary{margin-bottom:10px}' +
      '#appMain .card{margin:0 0 18px}#appProgram{margin:0 0 18px}#appToday{margin:0 0 6px}';
    d.head.appendChild(s);
  }

  // Which of her programs the lesson card follows: the stage the streak follows, her bought program before a free one.
  function lessonEntry(S) {
    var pl = w.WGStreak ? w.WGStreak.plan() : null, list = pl ? pl.wh.entries : [];
    if (!list.length) return null;
    var here = list.filter(function (e) { return e.stage === pl.stage; });
    var pick = function (a) { return a.filter(function (e) { return !e.member; })[0] || a[0]; };
    return pick(here) || pick(list.filter(function (e) { return !e.member; })) || list[0];
  }
  function nameOf(N, e) {
    var DATA = N.data(), slug = e.prog.replace(/-diaspora$/, ''), p = DATA.programs[slug];
    return p ? p.name : 'your program';
  }
  function readerOf(e) { return '/programs/' + e.prog + '/read'; }

  function stepCard(eyebrow, line, btnText, href, extra) {
    var c = mk('section', 'card f1k-app wgh-step'); c.setAttribute('data-wgh', 'step');
    c.appendChild(mk('p', 'eyebrow', eyebrow)); c.appendChild(mk('h2', '', line));
    var a = mk('a', 'btn btn-primary'); a.href = href; a.appendChild(d.createTextNode(btnText + ' →'));
    if (extra) extra(a);
    c.appendChild(a); return c;
  }

  function render(S, saved) {
    var N = w.WGNext; if (!N || !S) return;
    var run = ++seq; style();
    var main = clear('appMain'), prog = clear('appProgram'), save = clear('appSave'), comm = clear('appCommunity'), first = clear('appFirst');
    var lead = $('appLead'), col = S.col, name = S.name;
    if (w.WGStreak && w.WGStreak.render) w.WGStreak.render();
    var standalone = w.WGApp && w.WGApp.standalone;
    var say = function (t) { if (lead && !standalone) lead.textContent = t; };
    var ends = S.account && S.account.member && S.account.member.ends && w.WGFirst1000 ? w.WGFirst1000.fmtDate(S.account.member.ends) : '';

    if (S.pending) { say('Getting your programs ready.'); return; }

    if (col === 'V') {
      var stage = N.stage(), f = stage ? N.offer(stage) : null;
      say(name === 'known' ? 'We have your email. Your tools are here on any phone you sign in on.' : name === 'engaged' ? 'Your saved tools are here.' : stage ? 'You can change your stage any time.' : 'Pick your stage to see your card for today.');
      if (f && f.kind !== 'none') { var c = N.card(f, { surface: 'app-home' }); if (c) show(main, c, N.actionOf(f)); }
      if (name === 'engaged' && !S.signedIn && w.WGAccountUI && save) {
        var det = mk('details', 'wgh-save'); var sm = mk('summary');
        var tx = mk('span'); tx.appendChild(mk('b', '', 'Save your tools on any phone')); tx.appendChild(mk('small', '', 'Add your name and your email.')); sm.appendChild(tx); det.appendChild(sm);
        var host = mk('div'); det.appendChild(host);
        det.addEventListener('toggle', function () { if (det.open && !host.firstChild) w.WGAccountUI.capture(host); });
        show(save, det);
      }
    } else if (col === 'M') {
      say(ends ? 'Your program is free until ' + ends + '.' : 'Your program is free for now.');
      var F = w.WGFirst1000, m = w.WGAccess && w.WGAccess.member ? w.WGAccess.member() : null, st = F && m ? F.todayStep(m) : null;
      if (st && main) {
        show(main, stepCard('Today’s step', st.line, st.btn, st.href, function (a) {
          if (st.action === 'install') a.addEventListener('click', function (e) { var ib = $('appInstallBox'); if (w.WGApp && !w.WGApp.standalone && ib && ib.scrollIntoView) { e.preventDefault(); ib.scrollIntoView({ behavior: 'smooth' }); } });
          else if (/^https?:/.test(st.href)) { a.target = '_blank'; a.rel = 'noopener'; }
        }), 'todays_step');
      }
      var e = lessonEntry(S);
      if (e && prog && w.WGReading) {
        w.WGReading.load(readerOf(e), 'wg_read_' + e.prog).then(function (r) {
          if (run !== seq || !r) return;
          var a = mk('a', 'wgh-row'); a.href = r.href; a.setAttribute('data-wgh', 'continue');
          var cover = N.data().programs[e.prog.replace(/-diaspora$/, '')]; if (cover && cover.cover) { var im = mk('img'); im.src = cover.cover + '?v=20261009c'; im.alt = ''; im.width = 36; im.height = 45; a.appendChild(im); }
          var t = mk('span'); t.appendChild(mk('b', '', nameOf(N, e))); t.appendChild(mk('small', '', r.finished ? 'You finished it. Read it again' : 'Lesson ' + (r.n + 1) + ' of ' + r.total + (r.n ? ' is next. Continue reading' : ' is open. Start reading')));
          a.appendChild(t); show(prog, a);
        }).catch(function () {});
      }
      if (first && w.WGFirst1000) {
        var more = mk('details', 'wgh-more'); more.appendChild(mk('summary', '', 'See every way to earn months'));
        var inner = mk('div'); more.appendChild(inner);
        more.addEventListener('toggle', function () { if (more.open && !inner.firstChild) w.WGFirst1000.stepsCard(inner); });
        show(first, more);
      }
    } else if (col === 'B' || col === 'O') {
      var pe = lessonEntry(S);
      say('');
      if (pe && main && w.WGReading) {
        w.WGReading.load(readerOf(pe), 'wg_read_' + pe.prog).then(function (r) {
          if (run !== seq || !r) return;
          var pname = col === 'O' ? 'The Complete Motherhood Journey' : nameOf(N, pe);
          var line = r.finished ? 'You finished your program.' : r.n ? 'Lesson ' + (r.n + 1) + ' of ' + r.total + ' is next.' : 'Lesson 1 of ' + r.total + ' is ready.';
          show(main, stepCard('Your program: ' + pname, line, r.finished ? 'Read it again' : 'Continue reading', r.href), 'next_lesson');
        }).catch(function () {});
      }
      if (name === 'both' && prog) {
        var mem = Object.keys(S.own).map(function (k) { return S.own[k]; }).filter(function (x) { return x.gift; })[0];
        if (mem) {
          var p = mk('p', 'muted wgh-note', 'Your second program, ' + N.data().programs[mem.base].name + ', is free' + (mem.ends ? ' until ' + (w.WGFirst1000 ? w.WGFirst1000.fmtDate(mem.ends) : '') : '') + '.');
          p.setAttribute('data-wgh', 'second'); show(prog, p);
        }
      }
      if (pe && comm) {
        var home = '/programs/' + pe.prog + '/thank-you';
        var h2 = mk('h2', '', 'Community'), ca = mk('a', 'wgh-row'); ca.href = home; ca.setAttribute('data-wgh', 'community');
        var ct = mk('span'); ct.appendChild(mk('b', '', 'Your private group')); ct.appendChild(mk('small', '', 'The women on your program, and a professional to ask.')); ca.appendChild(ct);
        comm.appendChild(h2); comm.appendChild(ca); comm.hidden = false;
      }
    } else if (col === 'L') {
      var ls = Object.keys(S.lapsed)[0], lf = ls ? N.offer(ls) : null;
      say('');
      if (lf && lf.kind !== 'none') { var kc = N.card(lf, { surface: 'app-home' }); if (kc) show(main, kc, 'keep_program'); }
    }
    if (w.WGIdeas) w.WGIdeas.appHome();
  }
  w.WGAppHome = { render: render };
})(window, document);
