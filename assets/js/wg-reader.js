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
      var inPart = [].slice.call(cur.parentNode.querySelectorAll('.rd-lesson')), k = 0;
      inPart.forEach(function (l) { if (st.done[l.getAttribute('data-id')]) k++; });
      cur.parentNode.querySelector('.rd-part-meta').textContent = inPart.length > 1 ? 'Lesson ' + (inPart.indexOf(cur) + 1) + ' of ' + inPart.length : '';
      cur.parentNode.querySelector('.rd-part-head .rd-part-bar span').style.width = (100 * k / inPart.length) + '%';
      st.last = id; save();
    }
    paint();
    w.scrollTo(0, 0);
  }

  var plan = d.createElement('button');
  plan.type = 'button'; plan.className = 'rd-plan'; plan.textContent = 'Your plan';
  plan.addEventListener('click', function () { history.pushState(null, '', w.location.pathname + w.location.search); show(''); });
  d.querySelector('.rd-header-row').appendChild(plan);
  w.addEventListener('hashchange', function () { show(w.location.hash.slice(1)); });
  show(w.location.hash.slice(1));
})(window, document);
