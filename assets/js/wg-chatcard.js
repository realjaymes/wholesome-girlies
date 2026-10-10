// Chat card engine. Reads its setup from <script type="application/json" id="cc-config"> on the page.
// She picks a thought, a friend's reply is drawn as a WhatsApp-style chat card with canvas, made on her phone.
// Nothing leaves the page. A shared link or result card never carries which thought she picked.
(function () {
  var cfgEl = document.getElementById('cc-config');
  if (!cfgEl) return;
  var cfg = JSON.parse(cfgEl.textContent);
  var list = document.getElementById('cc-list');
  var out = document.getElementById('res');
  var canvas = document.getElementById('cc-canvas');
  var cur = null, replyIdx = 0, times = null;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(mins) { var h = Math.floor(mins / 60) % 12 || 12; return h + ':' + pad(mins % 60) + ' am'; }
  function newTimes() { var base = 2 * 60 + 10 + Math.floor(Math.random() * 150); return [base, base + 1 + Math.floor(Math.random() * 2)]; }

  cfg.thoughts.forEach(function (t, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cc-opt'; b.textContent = t.text;
    b.addEventListener('click', function () { pick(i); });
    list.appendChild(b);
  });

  // Only a few thoughts show at a time so the game fits one phone screen. "Show other thoughts" turns the page.
  var PER = 5, page = 0, pages = Math.ceil(cfg.thoughts.length / PER);
  var more = document.createElement('div'); more.className = 'cc-more';
  var moreCount = document.createElement('span'); moreCount.className = 'cc-count';
  var moreBtn = document.createElement('button'); moreBtn.type = 'button'; moreBtn.className = 'btn btn-ghost'; moreBtn.textContent = 'Show other thoughts';
  moreBtn.style.background = '#fff';
  more.appendChild(moreCount); more.appendChild(moreBtn);
  list.parentNode.insertBefore(more, list.nextSibling);
  function showPage() {
    Array.prototype.forEach.call(list.children, function (c, k) { c.hidden = Math.floor(k / PER) !== page; });
    moreCount.textContent = 'Thoughts ' + (page * PER + 1) + ' to ' + Math.min(cfg.thoughts.length, (page + 1) * PER) + ' of ' + cfg.thoughts.length;
  }
  moreBtn.addEventListener('click', function () { page = (page + 1) % pages; showPage(); });
  if (pages < 2) more.hidden = true;
  showPage();

  function pick(i) {
    cur = i; replyIdx = Math.floor(Math.random() * cfg.thoughts[i].replies.length); times = newTimes();
    Array.prototype.forEach.call(list.children, function (c, k) { c.classList.toggle('sel', k === i); });
    show(true);
  }

  function show(first) {
    var go = function () {
      draw();
      if (first && window.wgShowResult) wgShowResult(cfg.resultType);
      out.classList.add('show');
      if (first) out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function draw() {
    var W = 1080, H = 1350;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d'), sans = '"Nunito Sans", Arial, sans-serif';
    var t = cfg.thoughts[cur], bubbles = t.replies[replyIdx];
    ctx.fillStyle = '#EDE3D3'; ctx.fillRect(0, 0, W, H);
    // faint pattern dots
    ctx.fillStyle = 'rgba(110,122,63,.07)';
    for (var gx = 30; gx < W; gx += 90) for (var gy = 200; gy < H; gy += 90) { ctx.beginPath(); ctx.arc(gx + ((gy / 90) % 2) * 45, gy, 6, 0, 7); ctx.fill(); }
    // header
    ctx.fillStyle = '#6E7A3F'; ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = '#F8E1D6'; ctx.beginPath(); ctx.arc(110, 95, 52, 0, 7); ctx.fill();
    ctx.fillStyle = '#2B2622'; ctx.font = '800 54px ' + sans; ctx.textAlign = 'center'; ctx.fillText(cfg.friendInitial, 110, 114);
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.font = '800 46px ' + sans; ctx.fillText(cfg.friendName, 190, 90);
    ctx.font = '400 32px ' + sans; ctx.fillStyle = '#E3E6CC'; ctx.fillText('online', 190, 134);
    // day pill
    ctx.font = '700 28px ' + sans; var dp = cfg.dayLabel, dw = ctx.measureText(dp).width + 50;
    ctx.fillStyle = '#FBF4E8'; rr(ctx, (W - dw) / 2, 205, dw, 52, 26); ctx.fill();
    ctx.fillStyle = '#6A5F55'; ctx.textAlign = 'center'; ctx.fillText(dp, W / 2, 242);

    var fs = 42, lh = 56, maxBub = 760, y = 300;
    ctx.font = '400 ' + fs + 'px ' + sans;
    function bubble(text, mine, time, tail) {
      ctx.font = '400 ' + fs + 'px ' + sans;
      var lines = wrap(ctx, text, maxBub - 56), w = 0;
      lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
      var meta = time + (mine ? '  ✓✓' : '');
      ctx.font = '400 26px ' + sans; var mw = ctx.measureText(meta).width;
      w = Math.max(w, mw + 0) + 56;
      var h = lines.length * lh + 40 + 30;
      var x = mine ? W - 50 - w : 50;
      ctx.fillStyle = mine ? '#DDE8C0' : '#FFFFFF';
      rr(ctx, x, y, w, h, 28); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#2B2622'; ctx.stroke();
      ctx.fillStyle = '#2B2622'; ctx.textAlign = 'left'; ctx.font = '400 ' + fs + 'px ' + sans;
      lines.forEach(function (l, k) { ctx.fillText(l, x + 28, y + 28 + fs + k * lh - 6); });
      ctx.font = '400 26px ' + sans; ctx.fillStyle = '#8A7F73'; ctx.textAlign = 'right';
      ctx.fillText(meta, x + w - 22, y + h - 16);
      y += h + 22;
    }
    bubble(t.text, true, fmt(times[0]));
    bubbles.forEach(function (b, k) { bubble(b, false, fmt(times[1])); });
    // footer
    ctx.textAlign = 'center'; ctx.fillStyle = '#2B2622'; ctx.font = '800 34px ' + sans;
    ctx.fillText('3am Group Chat', W / 2, H - 92);
    ctx.fillStyle = '#6A5F55'; ctx.font = '700 28px ' + sans;
    ctx.fillText(cfg.footer, W / 2, H - 50);
  }

  document.getElementById('cc-again').addEventListener('click', function () {
    var n = cfg.thoughts[cur].replies.length;
    replyIdx = (replyIdx + 1) % n; times = newTimes(); show(false);
  });
  document.getElementById('cc-new').addEventListener('click', function () {
    cur = null; out.classList.remove('show');
    Array.prototype.forEach.call(list.children, function (c) { c.classList.remove('sel'); });
    if (window.wgShowResult) wgShowResult(null);
    list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('cc-save').addEventListener('click', function () {
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
})();
