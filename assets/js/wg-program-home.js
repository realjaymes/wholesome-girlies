/* The program home (programs/<slug>/thank-you): written by scripts/build-program-homes.py.
   1. "My programs" in the header, shown when this phone holds two or more program homes.
   2. "Saved" next to each tool she has saved entries in.
   3. The reading card: "Up next", the progress bar and "Continue reading", from the reader page and her saved place.
   The app home (/app/) loads this file too, for WGReading and the Saved marks. */
(function (w, d) {
  function get(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }

  // 1. My programs: the MIA dropdown pattern. Hover opens it on a computer, a tap toggles it on a phone,
  // it closes 300ms after the pointer leaves, on a tap outside, and on Escape.
  var dd = d.getElementById('phProgsDd');
  if (dd) {
    var seen = {}, progs = [];
    ['relationships', 'fertility', 'pregnancy', 'pp', 'parenting'].forEach(function (k) {
      try { var v = JSON.parse(get('wg_' + k + '_home') || 'null'); if (v && v.u && !seen[v.u]) { seen[v.u] = 1; progs.push(v); } } catch (e) {}
    });
    if (progs.length > 1) {
      var btn = d.getElementById('phProgsBtn'), box = d.getElementById('phProgs'), timer = null;
      var here = location.pathname.replace(/\.html$/, '');
      dd.hidden = false;
      progs.forEach(function (p) {
        var a = d.createElement('a'), mine = p.u.replace(/\.html$/, '') === here;
        a.href = p.u; a.setAttribute('role', 'menuitem'); a.textContent = p.l + (mine ? ' (you are here)' : '');
        if (mine) a.setAttribute('aria-current', 'page');
        box.appendChild(a);
      });
      var setOpen = function (on) { clearTimeout(timer); dd.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); };
      if (!w.matchMedia('(hover: none)').matches) {
        dd.addEventListener('mouseenter', function () { setOpen(true); });
        dd.addEventListener('mouseleave', function () { timer = setTimeout(function () { setOpen(false); }, 300); });
      }
      btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!dd.classList.contains('is-open')); });
      d.addEventListener('click', function (e) { if (!dd.contains(e.target)) setOpen(false); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dd.classList.contains('is-open')) { setOpen(false); btn.focus(); } });
    }
  }

  // 2. Saved marks. A key ending in "_" is a prefix (one entry per day or per baby).
  var all = null;
  function has(key) {
    if (key.slice(-1) !== '_') return !!get(key);
    if (!all) { all = []; try { for (var i = 0; i < w.localStorage.length; i++) all.push(w.localStorage.key(i)); } catch (e) {} }
    return all.some(function (k) { return k.indexOf(key) === 0; });
  }
  [].forEach.call(d.querySelectorAll('.ph-tool[data-key]'), function (a) {
    if (has(a.getAttribute('data-key'))) a.querySelector('.ph-saved').hidden = false;
  });

  // 3. Reading progress. WGReading.load(reader, key) reads the reader page and her saved place, and gives
  // what to show: label, title, count, percent, the button text and where it goes. The app home uses it too.
  w.WGReading = {
    load: function (reader, key) {
      var st = { done: {}, last: '' };
      try { var sv = JSON.parse(get(key)); if (sv && sv.done) st = sv; } catch (e) {}
      return fetch(reader).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var ls = [].map.call(doc.querySelectorAll('.rd-lesson'), function (l) {
          var part = l.closest('.rd-part'), h = part && part.querySelector('h2');
          return { id: l.id, t: l.getAttribute('data-title'), p: h ? h.textContent : '' };
        });
        if (!ls.length) return null;
        var n = ls.filter(function (l) { return st.done[l.id]; }).length;
        var from = Math.max(0, ls.map(function (l) { return l.id; }).indexOf(st.last)), next = ls[0];
        for (var i = 0; i < ls.length; i++) { var c = ls[(from + i) % ls.length]; if (!st.done[c.id]) { next = c; break; } }
        var out = { n: n, total: ls.length, pct: 100 * n / ls.length, count: n ? n + ' of ' + ls.length + ' lessons done' : 'Not started yet' };
        if (n === ls.length) { out.label = 'You have read it all'; out.title = 'Come back to any lesson when you need it.'; out.btn = 'Read it again'; out.href = reader; }
        else if (n || st.last) { out.label = 'Up next \u00b7 ' + next.p; out.title = next.t; out.btn = 'Continue reading'; out.href = reader + '#' + next.id; }
        else { out.title = ls.length + ' short lessons. Your place is saved on this phone.'; out.btn = 'Start reading'; out.href = reader; }
        return out;
      });
    }
  };
  var card = d.getElementById('phRead'), reader = card && card.getAttribute('data-reader');
  if (!reader || !w.fetch) return;
  w.WGReading.load(reader, card.getAttribute('data-read-key')).then(function (r) {
    if (!r) return;
    d.getElementById('phBar').style.width = r.pct + '%';
    d.getElementById('phCount').textContent = r.count;
    if (r.label) d.getElementById('phLabel').textContent = r.label;
    d.getElementById('phTitle').textContent = r.title;
    var go = d.getElementById('phGo'); go.innerHTML = r.btn + ' &rarr;'; go.href = r.href;
  }).catch(function () {});
})(window, document);
