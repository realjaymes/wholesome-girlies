/* The program home (programs/<slug>/thank-you): written by scripts/build-program-homes.py.
   1. "My programs" in the header, shown when this phone holds two or more program homes.
   2. "Saved" next to each tool she has saved entries in.
   3. The reading card: "Up next", the progress ring and "Continue reading", from the reader page and her saved place.
   4. The tool icons: each .ph-ico names its drawing in data-ico.
   The app home (/app/) loads this file too, for WGReading, WGIcons and the Saved marks. The site remembers a buyer
   elsewhere (the header menu, the programs blocks and the resume pill) through wg-app.js. */
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

  // 4. Tool icons, drawn as lines in the ink colour. WGIcons.draw(root) fills every empty .ph-ico under root.
  var ICO = {
    check: '<path d="M4 12.5l5 5L20 6.5"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>', pen: '<path d="M5 19l1-4L16 5l3 3L9 18z"/><path d="M14 7l3 3"/>',
    list: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4 7l1 1 2-2M4 12l1 1 2-2M4 17l1 1 2-2"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>', chart: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', leaf: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    bubble: '<circle cx="12" cy="11" r="7"/><path d="M12 8.5a1.8 1.8 0 1 1 1.6 2.6c-.9.3-1.6.9-1.6 1.9M12 15.5h.01"/>',
    book: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6v13c-2.5-1.5-5.5-1.5-8-.5z"/><path d="M20 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z"/>'
  };
  w.WGIcons = {
    draw: function (root) {
      [].forEach.call((root || d).querySelectorAll('.ph-ico:empty'), function (s) {
        s.innerHTML = '<svg viewBox="0 0 24 24">' + (ICO[s.getAttribute('data-ico')] || ICO.leaf) + '</svg>';
      });
    }
  };
  w.WGIcons.draw();

  // The ring around "11/30 lessons" on the reading card.
  w.WGRing = function (ring, r) {
    ring.style.setProperty('--pct', r.pct);
    ring.firstChild.innerHTML = r.n ? r.n + '/' + r.total + '<small>lessons</small>' : '0<small>started</small>';
  };

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
        out.part = next.p; out.lesson = next.t; out.started = !!(n || st.last) && n < ls.length;
        return out;
      });
    }
  };
  var card = d.getElementById('phRead'), reader = card && card.getAttribute('data-reader');
  if (!reader || !w.fetch) return;
  w.WGReading.load(reader, card.getAttribute('data-read-key')).then(function (r) {
    if (!r) return;
    w.WGRing(d.getElementById('phRing'), r);
    d.getElementById('phCount').textContent = r.count;
    if (r.label) d.getElementById('phLabel').textContent = r.label;
    d.getElementById('phTitle').textContent = r.title;
    var go = d.getElementById('phGo'); go.innerHTML = r.btn + ' &rarr;'; go.href = r.href;
  }).catch(function () {});
})(window, document);
