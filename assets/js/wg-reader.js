/* Program reader. Saves which lessons she has finished, on her phone only, under wg_read_<program>. The page opens
   on her plan (each part a card with its own progress bar) and a lesson opens one at a time by its #id.
   Built pages come from scripts/build-program-reader.py. */
(function (w, d) {
  var main = d.querySelector('.rd');
  if (!main) return;
  var KEY = 'wg_read_' + main.getAttribute('data-program');
  // A single program's reader links back to its own home, unless her Complete Motherhood Journey holds this stage:
  // then the back link goes to the bundle home, where all four toolkits live.
  var flag = main.getAttribute('data-flag'), homeLink = d.querySelector('.rd-home');
  if (flag && homeLink) {
    try {
      var held = JSON.parse(w.localStorage.getItem(flag) || 'null');
      if (held && /^\/programs\/complete-motherhood-journey/.test(held.u)) {
        homeLink.href = held.u; homeLink.innerHTML = '&larr; Motherhood Journey home';
        // She owns the bundle, so the "Want it all, for less?" line (with the MOTHER code) never shows to her.
        [].forEach.call(d.querySelectorAll('.rd p a[href^="/programs/complete-motherhood-journey"]'), function (a) { var p = a.closest('p'); if (p) p.remove(); });
      }
    } catch (e) {}
  }
  var body = d.body;
  var st = { done: {}, last: '' };
  try { var saved = JSON.parse(w.localStorage.getItem(KEY)); if (saved && saved.done) st = saved; } catch (e) {}
  // Besides what she finished, it keeps when she last read, the lesson up next and the total, so other pages
  // (the site header, the resume pill) can show her place without loading the reader.
  function save() {
    try {
      var nx = upNext(), n = ids.filter(function (id) { return st.done[id]; }).length;
      st.at = Date.now(); st.total = ids.length; st.n = n; st.next = n < ids.length ? title(nx) : ''; st.nextId = n < ids.length ? nx : '';
      w.localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
  }

  var lessons = [].slice.call(d.querySelectorAll('.rd-lesson'));
  var parts = [].slice.call(d.querySelectorAll('.rd-part'));
  // Each lesson's id moves to data-id, so opening #lesson never makes the browser jump to the middle of the page.
  var byId = {};
  var ids = lessons.map(function (l) { var id = l.id; byId[id] = l; l.setAttribute('data-id', id); l.removeAttribute('id'); return id; });
  function lesson(id) { return byId[id] || null; }
  function title(id) { var l = lesson(id); return l ? l.getAttribute('data-title') : ''; }
  function partTitle(id) { var l = lesson(id); return l ? l.parentNode.querySelector('h2').textContent : ''; }
  function upNext() {
    var from = Math.max(0, ids.indexOf(st.last));
    for (var i = 0; i < ids.length; i++) { var id = ids[(from + i) % ids.length]; if (!st.done[id]) return id; }
    return ids[0];
  }

  [].forEach.call(d.querySelectorAll('.rd-toc-title'), function (t) {
    var bar = d.createElement('div'); bar.className = 'rd-part-bar'; bar.innerHTML = '<span></span>';
    t.parentNode.insertBefore(bar, t.nextSibling);
  });

  function paint() {
    var n = ids.filter(function (id) { return st.done[id]; }).length, pct = (100 * n / ids.length) + '%';
    d.querySelector('.rd-bar span').style.width = pct;
    d.querySelector('.rd-total-bar span').style.width = pct;
    d.querySelector('.rd-done-count').textContent = n;
    [].forEach.call(d.querySelectorAll('[data-lesson]'), function (el) {
      var done = !!st.done[el.getAttribute('data-lesson')];
      el.classList.toggle('rd-is-done', done);
      if (el.classList.contains('rd-done')) el.textContent = done ? 'Done ✓' : 'Done, next lesson';
    });
    [].forEach.call(d.querySelectorAll('.rd-toc-part'), function (p) {
      var links = p.querySelectorAll('a[data-lesson]'), k = 0;
      [].forEach.call(links, function (a) { if (st.done[a.getAttribute('data-lesson')]) k++; });
      p.querySelector('.rd-count').textContent = k + ' of ' + links.length;
      p.querySelector('.rd-part-bar span').style.width = (100 * k / links.length) + '%';
      p.classList.toggle('rd-part-done', k === links.length);
    });
    var next = upNext(), go = d.querySelector('.rd-continue'), started = n || st.last;
    go.setAttribute('href', '#' + next);
    go.querySelector('.rd-cta-long').innerHTML = n === ids.length ? 'Read it again &rarr;' : started ? 'Continue: ' + title(next) + ' &rarr;' : 'Start reading &rarr;';
    go.querySelector('.rd-cta-short').innerHTML = n === ids.length ? 'Read it again &rarr;' : started ? 'Continue reading &rarr;' : 'Start reading &rarr;';
    d.querySelector('.rd-next-title').textContent = title(next);
    d.querySelector('.rd-next-part').textContent = ' · ' + partTitle(next);
  }

  function mark(id) {
    var on = !st.done[id];
    if (on) st.done[id] = 1; else delete st.done[id];
    save(); paint();
    (w.dataLayer = w.dataLayer || []).push({ event: 'reader_lesson', reader_program: main.getAttribute('data-program'),
      reader_lesson: id, reader_state: on ? 'done' : 'undone', reader_done_count: Object.keys(st.done).length });
    var i = ids.indexOf(id);
    if (on) w.location.hash = i < ids.length - 1 ? ids[i + 1] : '';
    if (on) afterDone(id);
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('.rd-done');
    if (b) mark(b.getAttribute('data-lesson'));
  });

  var pager = d.querySelector('.rd-pager');
  function show(id) {
    var reading = ids.indexOf(id) > -1;
    body.classList.toggle('rd-reading', reading);
    if (reading) {
      var cur = lesson(id);
      lessons.forEach(function (l) { l.hidden = l !== cur; });
      parts.forEach(function (p) { p.hidden = !p.contains(cur); var intro = p.querySelector('.rd-intro'); if (intro) intro.hidden = p.querySelector('.rd-lesson') !== cur; });
      var i = ids.indexOf(id), prev = pager.querySelector('.rd-prev'), next = pager.querySelector('.rd-next');
      prev.hidden = i === 0; next.hidden = i === ids.length - 1;
      if (i > 0) { prev.href = '#' + ids[i - 1]; prev.querySelector('span').textContent = title(ids[i - 1]); }
      if (i < ids.length - 1) next.href = '#' + ids[i + 1];
      cur.parentNode.appendChild(pager);
      memberLine(cur, id);
      var inPart = [].slice.call(cur.parentNode.querySelectorAll('.rd-lesson')), k = 0;
      inPart.forEach(function (l) { if (st.done[l.getAttribute('data-id')]) k++; });
      cur.parentNode.querySelector('.rd-part-meta').textContent = inPart.length > 1 ? 'Lesson ' + (inPart.indexOf(cur) + 1) + ' of ' + inPart.length : '';
      cur.parentNode.querySelector('.rd-part-head .rd-part-bar span').style.width = (100 * k / inPart.length) + '%';
      st.last = id; save();
    }
    paint();
    w.scrollTo(0, 0);
  }

  // ── Who she is, for the member line and the next step ─────────────────────
  var PROG = main.getAttribute('data-name') || 'your program';
  var SLUG = main.getAttribute('data-program') || '', BASE = SLUG.replace(/-diaspora$/, ''), DIA = /-diaspora$/.test(SLUG) ? '-diaspora' : '';
  var MOTHERHOOD = ['trying-to-conceive-blueprint', 'first-pregnancy-plan', 'postpartum-reset', 'first-baby-playbook'];
  function heldBases() { // the program homes on her phone, as [{base}]
    var out = [];
    ['wg_relationships_home', 'wg_fertility_home', 'wg_pregnancy_home', 'wg_pp_home', 'wg_parenting_home'].forEach(function (k) {
      try { var v = JSON.parse(w.localStorage.getItem(k) || 'null'), m = v && v.u && v.u.match(/^\/programs\/([a-z0-9-]+)\//); if (m) out.push(m[1].replace(/-diaspora$/, '')); } catch (e) {}
    });
    return out;
  }
  function bundleOwner() { return heldBases().indexOf('complete-motherhood-journey') > -1; }
  function owns(base) { var h = heldBases(); return h.indexOf(base) > -1 || (MOTHERHOOD.indexOf(base) > -1 && h.indexOf('complete-motherhood-journey') > -1); }
  function herName() { try { return (w.WGApp && w.WGApp.name && w.WGApp.name()) || ''; } catch (e) { return ''; } }
  function doneCount() { return ids.filter(function (id) { return st.done[id]; }).length; }
  function push(o) { (w.dataLayer = w.dataLayer || []).push(o); }
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // The member offer on the last lesson: a buyer of a single motherhood program (never a Complete Motherhood Journey owner)
  // who is halfway or more sees that MOTHER is 35% off, never a price, with the bundle named as a link. It replaces the
  // manuscript's own "Want it all, for less?" line for her.
  function memberLine(cur, id) {
    [].forEach.call(d.querySelectorAll('.rd-member'), function (e) { e.remove(); });
    if (id !== ids[ids.length - 1] || MOTHERHOOD.indexOf(BASE) < 0 || !owns(BASE) || bundleOwner() || doneCount() / ids.length < 0.5) return;
    var home = '/programs/complete-motherhood-journey' + DIA, p = el('p', 'rd-member');
    p.appendChild(d.createTextNode('Continue with '));
    var a = el('a'); a.href = home; a.appendChild(el('b', '', 'The Complete Motherhood Journey')); p.appendChild(a);
    p.appendChild(d.createTextNode(' and use code MOTHER to get 35% off. '));
    var go = el('a', 'rd-member-go'); go.href = home + '?coupon=MOTHER'; go.innerHTML = '<b>See the complete journey &rarr;</b>'; p.appendChild(go);
    var end = cur.querySelector('.rd-end');
    if (end) end.parentNode.insertBefore(p, end.nextSibling); else cur.appendChild(p);
    [].forEach.call(cur.querySelectorAll('p'), function (q) { if (q !== p && /^Want it all, for less\?/.test(q.textContent.trim())) q.hidden = true; });
  }

  // ── After "Done": the end of a part, and the end of the program ─────────
  function afterDone(id) {
    var n = doneCount();
    if (n === ids.length) { push({ event: 'reader_complete', reader_program: SLUG.replace(/-diaspora$/, '') }); finishSheet(); return; }
    var part = lesson(id).parentNode, inPart = [].slice.call(part.querySelectorAll('.rd-lesson'));
    st.pe = st.pe || {};
    if (inPart.length > 1 && !st.pe[part.id] && inPart.every(function (l) { return st.done[l.getAttribute('data-id')]; })) {
      st.pe[part.id] = 1; save();
      var o = sheet(); o.box.appendChild(el('h2', '', 'Well done, you finished this part'));
      o.box.appendChild(el('p', '', 'Your next part is ready whenever you want to continue.'));
      var go = el('button', 'btn btn-primary btn-lg'); go.type = 'button'; go.innerHTML = 'Keep reading &rarr;'; go.addEventListener('click', o.close); o.box.appendChild(go); go.focus();
    }
  }
  function sheet() {
    var old = d.querySelector('.rd-sheet'); if (old) old.remove();
    var ov = el('div', 'rd-sheet'), box = el('div', 'rd-sheet-in'), x = el('button', 'rd-sheet-x', '×');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    var close = function () { ov.remove(); d.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    x.addEventListener('click', close); ov.addEventListener('click', function (e) { if (e.target === ov) close(); }); d.addEventListener('keydown', esc);
    box.appendChild(x); ov.appendChild(box); d.body.appendChild(ov);
    return { ov: ov, box: box, close: close };
  }

  // The finish sheet (James's pick, option E): the ring, a next step, a card to share, the feedback row and two links.
  // Nothing on it names her program, her stage or that she finished in anything she shares.
  var NEXT = {
    'wife-material-blueprint': ['trying-to-conceive-blueprint', 'The Trying-to-Conceive Blueprint', 'When you get there, this blueprint helps you understand your cycle, prepare useful questions and move through the waiting one step at a time.', 'See The Trying-to-Conceive Blueprint'],
    'trying-to-conceive-blueprint': ['first-pregnancy-plan', 'The First Pregnancy Plan', 'When you get there, this plan helps you understand each stage of a first pregnancy and prepare useful questions.', 'See The First Pregnancy Plan'],
    'first-pregnancy-plan': ['postpartum-reset', 'The 6-Week Postpartum Reset', 'When you get there, this reset helps you plan for your first six weeks after birth, including recovery, support and daily care.', 'See The 6-Week Postpartum Reset'],
    'postpartum-reset': ['first-baby-playbook', 'The First Baby Playbook', 'This playbook helps you find your way through feeding, sleep, milestones and everyday life with your first baby.', 'See The First Baby Playbook'],
    'first-baby-playbook': ['', 'Parenting tools', 'Keep going with practical Parenting tools for routines, feeding, milestones, appointments and the everyday questions that come up.', 'Explore the Parenting tools']
  };
  var SHARE = 'Try the games and tools on Wholesome Girlies for women’s health, motherhood and relationships. You may find something useful for you or someone you know.';
  function finishSheet() {
    var name = herName(), o = sheet(), box = o.box, n = name ? ', ' + name : '';
    var ring = el('div', 'rd-ring'); ring.appendChild(el('span', '', '100%')); box.appendChild(ring);
    box.appendChild(el('h2', '', 'You did it' + n + '!'));
    box.appendChild(el('p', '', 'You finished every lesson in ' + PROG + '. Take a moment' + n + '. This one is yours.'));
    var nx = NEXT[BASE];
    if (nx && !(nx[0] && owns(nx[0])) && !bundleOwner() || (nx && !nx[0])) {
      var nc = el('div', 'rd-next-card'); nc.appendChild(el('b', '', nx[1])); nc.appendChild(el('p', '', nx[2]));
      var na = el('a', 'btn btn-primary'); na.href = nx[0] ? '/programs/' + nx[0] + DIA : '/tools/?stage=parenting'; na.innerHTML = ''; na.appendChild(d.createTextNode(nx[3] + ' →')); nc.appendChild(na); box.appendChild(nc);
    }
    var share = el('button', 'rd-share'); share.type = 'button';
    share.innerHTML = '<span class="rd-mini" aria-hidden="true">🌿</span><span><b>Share a card with a friend</b><span>Invite her to try the games and tools. What you read stays private.</span></span>';
    box.appendChild(share);
    var fb = el('div', 'rd-fb'); fb.appendChild(el('p', '', 'We would love to hear how it went for you' + n + '.'));
    var row = el('div', 'rd-fb-row'), group = main.getAttribute('data-community');
    if (group) { var g = el('a', 'btn btn-ghost', 'Tell the community'); g.href = group; g.target = '_blank'; g.rel = 'noopener'; row.appendChild(g); }
    var m = el('a', 'btn btn-ghost', 'Send us an email'); m.href = 'mailto:care@wholesomegirlies.xyz?subject=' + encodeURIComponent('How ' + PROG + ' went'); row.appendChild(m);
    fb.appendChild(row); box.appendChild(fb);
    var links = el('div', 'rd-sheet-links'), home = d.querySelector('.rd-home');
    var h = el('a', '', 'Go to my program home'); h.href = home ? home.getAttribute('href') : '/programs/'; links.appendChild(h);
    var again = el('a', '', 'Read it again'); again.href = '#'; again.addEventListener('click', function (e) { e.preventDefault(); o.close(); }); links.appendChild(again);
    box.appendChild(links);
    share.addEventListener('click', function () { cardView(o, function () { o.close(); finishSheet(); }); });
    petals();
  }
  function petals() {
    try { w.sessionStorage.removeItem('wg_petals_' + w.location.pathname); } catch (e) {}
    var s = d.createElement('script'); s.src = '/assets/petals.js?v=20261012a'; d.body.appendChild(s);
  }

  // The card is drawn here on her phone with a canvas, like the result card's name option, and the name goes on it only when she
  // ticks the box (off every time). The link goes to the homepage and the text is the generic line above.
  function cardView(o, back) {
    var name = herName(), box = o.box;
    while (box.firstChild) box.removeChild(box.firstChild);
    var x = el('button', 'rd-sheet-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', o.close); box.appendChild(x);
    var prev = el('canvas', 'rd-card'); prev.width = 540; prev.height = 675; box.appendChild(prev);
    var tick = null;
    if (name) { var lab = el('label', 'rd-tick-name'); tick = el('input'); tick.type = 'checkbox'; lab.appendChild(tick); lab.appendChild(d.createTextNode(' Put my name on the card.')); box.appendChild(lab); }
    var paint = function (cv) { drawCard(cv, tick && tick.checked ? name : ''); };
    paint(prev); if (tick) tick.addEventListener('change', function () { paint(prev); });
    var sh = el('button', 'btn btn-primary btn-lg', 'Share my card'); sh.type = 'button';
    var sv = el('button', 'btn btn-ghost', 'Save my card'); sv.type = 'button';
    box.appendChild(sh); box.appendChild(sv);
    var file = function () {
      return new Promise(function (res) {
        var cv = el('canvas'); cv.width = 1080; cv.height = 1350; drawCard(cv, tick && tick.checked ? name : '');
        cv.toBlob(function (b) { res(b ? new File([b], 'wholesome-girlies-card.png', { type: 'image/png' }) : null); }, 'image/png');
      });
    };
    sh.addEventListener('click', function () {
      push({ event: 'share_click', share_channel: 'card', share_item: 'reader-finish', share_surface: 'reader' });
      file().then(function (f) {
        if (f && w.navigator.canShare && w.navigator.canShare({ files: [f] })) return w.navigator.share({ files: [f], text: SHARE, url: 'https://wholesomegirlies.xyz/' });
        if (f) download(f);
      }).catch(function () {});
    });
    sv.addEventListener('click', function () { push({ event: 'result_save', share_item: 'reader-finish' }); file().then(function (f) { if (f) download(f); }); });
    box.appendChild(el('p', 'rd-sheet-note', 'Or share with your friends using an option below.'));
    var wsh = el('div', 'wg-share'); wsh.setAttribute('data-share-id', 'reader-finish'); wsh.setAttribute('data-share-surface', 'reader'); wsh.setAttribute('data-share-path', '/');
    wsh.setAttribute('data-share-text', SHARE); wsh.setAttribute('data-share-align', 'center'); wsh.setAttribute('data-share-size', 'sm'); box.appendChild(wsh);
    if (w.wgShareInit) w.wgShareInit();
    box.appendChild(el('p', 'rd-sheet-note', SHARE));
    var b = el('button', 'rd-back', '← Back'); b.type = 'button'; b.addEventListener('click', back); box.appendChild(b);
  }
  function download(f) {
    var u = URL.createObjectURL(f), a = d.createElement('a'); a.href = u; a.download = f.name; d.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function drawCard(cv, name) {
    var k = cv.width / 1080, x = cv.getContext('2d'), ink = '#33322A';
    x.fillStyle = '#E3E6CC'; x.fillRect(0, 0, cv.width, cv.height);
    x.lineWidth = 10 * k; x.strokeStyle = ink; x.strokeRect(5 * k, 5 * k, cv.width - 10 * k, cv.height - 10 * k);
    // a small sprig
    x.save(); x.translate(160 * k, 330 * k); x.strokeStyle = ink; x.fillStyle = '#6E7A3F'; x.lineWidth = 6 * k;
    x.beginPath(); x.moveTo(0, 120 * k); x.quadraticCurveTo(10 * k, 40 * k, 70 * k, -20 * k); x.stroke();
    [[18, 70, -40], [34, 40, 30], [50, 10, -40]].forEach(function (l) { x.beginPath(); x.ellipse(l[0] * k + (l[2] > 0 ? 40 : -40) * k, l[1] * k, 40 * k, 18 * k, l[2] * Math.PI / 180, 0, 7); x.fill(); x.stroke(); });
    x.restore();
    var big = name ? 'Something useful from ' + name : 'Something useful for every woman';
    x.fillStyle = ink; x.textBaseline = 'alphabetic';
    var serif = "'DM Serif Display', Georgia, serif", sans = "'Nunito Sans', system-ui, sans-serif";
    wrap(x, big, 110 * k, 560 * k, 860 * k, 108 * k, '400 ' + 96 * k + 'px ' + serif);
    wrap(x, 'Try the games and tools on Wholesome Girlies.', 110 * k, 940 * k, 860 * k, 56 * k, '700 ' + 44 * k + 'px ' + sans);
    x.font = '800 ' + 34 * k + 'px ' + sans; x.textAlign = 'center'; x.fillText('WHOLESOMEGIRLIES.XYZ', cv.width / 2, cv.height - 80 * k); x.textAlign = 'left';
  }
  function wrap(x, text, px, py, maxW, lh, font) {
    x.font = font; var words = text.split(' '), line = '', y = py;
    words.forEach(function (wd) {
      var t = line ? line + ' ' + wd : wd;
      if (x.measureText(t).width > maxW && line) { x.fillText(line, px, y); line = wd; y += lh; } else line = t;
    });
    if (line) x.fillText(line, px, y);
  }

  var plan = d.createElement('button');
  plan.type = 'button'; plan.className = 'rd-plan'; plan.textContent = 'Your plan';
  plan.addEventListener('click', function () { history.pushState(null, '', w.location.pathname + w.location.search); show(''); });
  d.querySelector('.rd-header-row').appendChild(plan);
  w.addEventListener('hashchange', function () { show(w.location.hash.slice(1)); });
  show(w.location.hash.slice(1));
})(window, document);
