// Tier list engine. Reads its setup from <script type="application/json" id="tl-config"> on the page.
// She taps (or drags) items into tiers, then makes a shareable image on her phone with canvas.
// Nothing leaves the page. A shared link or result card never carries her tiers.
(function () {
  var cfgEl = document.getElementById('tl-config');
  if (!cfgEl) return;
  var cfg = JSON.parse(cfgEl.textContent);
  var place = {};            // item id -> tier id, or absent when still in the tray
  var selected = null;
  var byId = {};
  cfg.items.forEach(function (it) { byId[it.id] = it; });

  var tray = document.getElementById('tl-tray');
  var board = document.getElementById('tl-board');
  var status = document.getElementById('tl-status');
  var makeBtn = document.getElementById('tl-make');
  var resetBtn = document.getElementById('tl-reset');
  var res = document.getElementById('res');
  var canvas = document.getElementById('tl-canvas');
  var saveBtn = document.getElementById('tl-save');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function chip(it) {
    var b = el('button', 'tl-chip' + (selected === it.id ? ' sel' : ''), it.label);
    b.type = 'button';
    b.setAttribute('data-id', it.id);
    b.setAttribute('aria-pressed', selected === it.id ? 'true' : 'false');
    b.draggable = true;
    b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', it.id); selected = it.id; });
    b.addEventListener('click', function (e) { e.stopPropagation(); selected = (selected === it.id) ? null : it.id; render(); });
    return b;
  }

  function placeItem(id, tier) {
    if (!id) return;
    if (tier) place[id] = tier; else delete place[id];
    selected = null;
    render();
  }

  function render() {
    var keep = tray.scrollLeft;
    tray.innerHTML = '';
    cfg.items.forEach(function (it) { if (!place[it.id]) tray.appendChild(chip(it)); });
    if (!tray.children.length) tray.appendChild(el('span', 'muted tl-empty', 'All placed. Tap one to move it.'));
    tray.scrollLeft = keep;
    board.innerHTML = '';
    cfg.tiers.forEach(function (t) {
      var row = el('div', 'tl-row tl-' + t.id);
      var lab = el('button', 'tl-label'); lab.type = 'button';
      lab.appendChild(el('strong', null, t.label));
      if (t.note) lab.appendChild(el('span', null, t.note));
      lab.setAttribute('aria-label', 'Put the selected craving in ' + t.label);
      var zone = el('div', 'tl-zone');
      cfg.items.forEach(function (it) { if (place[it.id] === t.id) zone.appendChild(chip(it)); });
      function drop() { if (selected) placeItem(selected, t.id); }
      row.addEventListener('click', drop);
      row.addEventListener('dragover', function (e) { e.preventDefault(); });
      row.addEventListener('drop', function (e) { e.preventDefault(); var id = e.dataTransfer.getData('text/plain'); if (id) placeItem(id, t.id); });
      row.appendChild(lab); row.appendChild(zone);
      board.appendChild(row);
    });
    var placed = Object.keys(place).length;
    if (selected) status.textContent = byId[selected].label + ' is picked. Tap a tier to place it, or tap here to put it back.';
    else status.textContent = placed + ' of ' + cfg.items.length + ' placed. Tap a craving, then tap a tier.';
    makeBtn.disabled = false;
  }

  tray.addEventListener('click', function () { if (selected && place[selected]) placeItem(selected, null); });
  tray.addEventListener('dragover', function (e) { e.preventDefault(); });
  tray.addEventListener('drop', function (e) { e.preventDefault(); var id = e.dataTransfer.getData('text/plain'); if (id) placeItem(id, null); });
  status.addEventListener('click', function () { if (selected && place[selected]) placeItem(selected, null); });
  resetBtn.addEventListener('click', function () { place = {}; selected = null; res.classList.remove('show'); if (window.wgShowResult) wgShowResult(null); render(); });

  function topTier() { return cfg.tiers[0].id; }

  function resultType() {
    var counts = {}, total = 0;
    cfg.items.forEach(function (it) { if (place[it.id] === topTier()) { counts[it.cat] = (counts[it.cat] || 0) + 1; total++; } });
    if (total >= cfg.manyInTop) return cfg.mixed;
    var best = null, bestN = 0, tie = false;
    Object.keys(counts).forEach(function (k) {
      if (counts[k] > bestN) { best = k; bestN = counts[k]; tie = false; } else if (counts[k] === bestN) { tie = true; }
    });
    return (!best || tie) ? cfg.mixed : best;
  }

  // ---- canvas ----
  var W = 1080, H = 1920;
  function wrapPills(ctx, labels, maxW, font, padX, gap) {
    ctx.font = font;
    var lines = [[]], x = 0;
    labels.forEach(function (l) {
      var w = ctx.measureText(l).width + padX * 2;
      if (x + w > maxW && lines[lines.length - 1].length) { lines.push([]); x = 0; }
      lines[lines.length - 1].push({ l: l, w: w });
      x += w + gap;
    });
    return lines;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function draw(type) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var sans = '"Nunito Sans", Arial, sans-serif', serif = '"DM Serif Display", Georgia, serif';
    ctx.fillStyle = '#FBF4E8'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6E7A3F'; ctx.fillRect(0, 0, W, 12);
    ctx.fillStyle = '#2B2622'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 30px ' + sans; ctx.fillText('WHOLESOME GIRLIES', W / 2, 96);
    ctx.font = '64px ' + serif; ctx.fillText(cfg.title, W / 2, 190);
    ctx.font = '700 36px ' + sans; ctx.fillStyle = '#6A5F55';
    ctx.fillText(cfg.results[type].title, W / 2, 252);
    var left = 60, labW = 170, areaX = left + labW + 14, areaW = W - areaX - 60;
    var top = 300, bottom = H - 190, avail = bottom - top - (cfg.tiers.length - 1) * 14;
    var fs = 44, rows;
    for (; fs >= 24; fs -= 2) {
      var pillH = fs + 34, gap = 12;
      rows = cfg.tiers.map(function (t) {
        var labels = cfg.items.filter(function (it) { return place[it.id] === t.id; }).map(function (it) { return it.label; });
        var lines = wrapPills(ctx, labels, areaW - 24, '700 ' + fs + 'px ' + sans, 22, gap);
        return { t: t, lines: lines, h: Math.max(pillH + 24, lines.length * (pillH + gap) + 12) };
      });
      var tot = rows.reduce(function (a, r) { return a + r.h; }, 0);
      if (tot <= avail) break;
    }
    var y = top, pillH2 = fs + 34;
    rows.forEach(function (r) {
      ctx.fillStyle = r.t.color; rr(ctx, left, y, labW, r.h, 22); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#2B2622'; ctx.stroke();
      ctx.fillStyle = r.t.ink || '#2B2622'; ctx.textAlign = 'center';
      ctx.font = (r.t.label.length > 2 ? '700 46px ' : '64px ') + serif;
      ctx.fillText(r.t.label, left + labW / 2, y + r.h / 2 + 18);
      ctx.fillStyle = '#FFFFFF'; rr(ctx, areaX, y, areaW, r.h, 22); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#2B2622'; ctx.stroke();
      var py = y + 14;
      r.lines.forEach(function (line) {
        var px = areaX + 14;
        line.forEach(function (p) {
          ctx.fillStyle = r.t.tint; rr(ctx, px, py, p.w, pillH2, pillH2 / 2); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = '#2B2622'; ctx.stroke();
          ctx.fillStyle = '#2B2622'; ctx.textAlign = 'left'; ctx.font = '700 ' + fs + 'px ' + sans;
          ctx.fillText(p.l, px + 22, py + pillH2 / 2 + fs * 0.35);
          px += p.w + 12;
        });
        py += pillH2 + 12;
      });
      y += r.h + 14;
    });
    ctx.textAlign = 'center'; ctx.fillStyle = '#2B2622'; ctx.font = '700 34px ' + sans;
    ctx.fillText(cfg.cta, W / 2, H - 112);
    ctx.fillStyle = '#6A5F55'; ctx.font = '700 30px ' + sans;
    ctx.fillText(cfg.footer, W / 2, H - 66);
  }

  function make() {
    var counts = Object.keys(place).length;
    if (counts < cfg.minPlaced || !cfg.items.some(function (it) { return place[it.id] === topTier(); })) {
      alert('Place at least ' + cfg.minPlaced + ' cravings and put one in ' + cfg.tiers[0].label + ' to see your tier list.');
      return;
    }
    var type = resultType(), r = cfg.results[type];
    document.getElementById('band').textContent = r.band;
    document.getElementById('headline').textContent = r.title;
    document.getElementById('summary').textContent = r.summary;
    var go = function () {
      draw(type);
      if (window.wgShowResult) wgShowResult(type);
      res.classList.add('show');
      res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }
  makeBtn.addEventListener('click', make);

  saveBtn.addEventListener('click', function () {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var file = new File([blob], cfg.filename + '.png', { type: 'image/png' });
      if (navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = cfg.filename + '.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        });
        return;
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = cfg.filename + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, 'image/png');
  });

  render();
})();
