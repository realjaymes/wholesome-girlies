/* Wrapped-style card story and Status card.
   WGWrapped.open({ cards: [...], summary: {...}, opener: element, onClose: fn }) opens a full-screen story. Tap the right
   side (or press the right arrow) for the next card, the left side for the previous one. The last card shows a picture of her
   summary, drawn on her phone with a canvas, with buttons to save it for her Status or share it. Nothing is sent anywhere.

   A card is { tone: 'peach|mustard|olive|rust|denim', kicker: '', big: '', num: 1234, tpl: '{n} feeds', line: '' }.
   When num is set, the big text counts up to it using tpl ({n} becomes the number). Otherwise big is shown as it is.
   summary is { title, type, cells: [{ value, label }], foot, example: bool, url, filename }.
   The engine never reads storage. The page works out the numbers and hands over only counts. */
(function (w, d) {
  var TONES = {
    peach: ['#F8E1D6', '#E39A7B'], mustard: ['#F6E4BC', '#D49A2A'], olive: ['#E3E6CC', '#6E7A3F'],
    rust: ['#F4DCCB', '#C0763F'], denim: ['#DCE6F2', '#6F93BF']
  };
  var INK = '#33322A';
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CSS =
    '.wgw{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:var(--wgw-bg,#F8E1D6);color:' + INK + ';font-family:"Nunito Sans",system-ui,sans-serif;overscroll-behavior:contain;touch-action:manipulation}' +
    '.wgw *{box-sizing:border-box}' +
    '.wgw-bars{display:flex;gap:4px;padding:max(14px,env(safe-area-inset-top)) 14px 0;position:relative;z-index:3}' +
    '.wgw-bars span{flex:1;height:5px;border-radius:5px;background:rgba(51,50,42,.2);overflow:hidden}' +
    '.wgw-bars span.on{background:' + INK + '}' +
    '.wgw-x{position:absolute;top:max(26px,calc(env(safe-area-inset-top) + 14px));right:10px;z-index:4;width:44px;height:44px;border-radius:50%;border:2px solid ' + INK + ';background:#fff;font:800 1.4rem/1 "Nunito Sans",sans-serif;color:' + INK + ';cursor:pointer;box-shadow:3px 3px 0 ' + INK + '}' +
    '.wgw-card{flex:1;display:flex;flex-direction:column;justify-content:center;padding:70px 28px 90px;text-align:center;max-width:620px;width:100%;margin:0 auto;position:relative;z-index:1;animation:wgwIn .32s ease}' +
    '@keyframes wgwIn{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:none}}' +
    '.wgw-kicker{display:inline-block;align-self:center;font-weight:800;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;background:var(--wgw-ac,#E39A7B);border:2px solid ' + INK + ';border-radius:999px;padding:6px 14px;margin:0 0 22px;box-shadow:3px 3px 0 ' + INK + '}' +
    '.wgw-big{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:clamp(2.7rem,15vw,5.2rem);line-height:1.02;margin:0 0 18px;overflow-wrap:anywhere}' +
    '.wgw-line{font-size:clamp(1.05rem,4.6vw,1.35rem);line-height:1.45;font-weight:700;margin:0 auto;max-width:28ch}' +
    '.wgw-hit{position:absolute;top:0;bottom:0;z-index:2;border:0;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.wgw-prev{left:0;width:32%}.wgw-next{right:0;width:68%}' +
    '.wgw-hint{position:absolute;left:0;right:0;bottom:max(22px,env(safe-area-inset-bottom));text-align:center;font-weight:800;font-size:.85rem;opacity:.65;z-index:1;pointer-events:none}' +
    '.wgw-sum{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:58px 18px max(28px,env(safe-area-inset-bottom));text-align:center;position:relative;z-index:3;animation:wgwIn .32s ease}' +
    '.wgw-sum canvas{display:block;width:min(100%,calc((100dvh - 250px) * .5625));max-width:360px;height:auto;margin:0 auto 18px;border:2px solid ' + INK + ';border-radius:14px;box-shadow:5px 5px 0 ' + INK + ';background:#fff}' +
    '.wgw-acts{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:420px;margin:0 auto}' +
    '.wgw-btn{font:800 1rem/1 "Nunito Sans",sans-serif;padding:14px 20px;border-radius:999px;border:2px solid ' + INK + ';background:#fff;color:' + INK + ';cursor:pointer;box-shadow:3px 3px 0 ' + INK + '}' +
    '.wgw-btn.main{background:var(--wgw-ac,#E39A7B)}' +
    '.wgw-note{font-size:.85rem;font-weight:700;margin:14px auto 0;max-width:34ch;opacity:.8}' +
    '@media (prefers-reduced-motion:reduce){.wgw-card,.wgw-sum{animation:none}}';

  var state = null;

  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(n) { try { return Number(n).toLocaleString('en-NG'); } catch (e) { return String(n); } }
  function tone(name) { return TONES[name] || TONES.peach; }

  function ensureCss() {
    if (d.getElementById('wg-wrapped-css')) return;
    var s = d.createElement('style'); s.id = 'wg-wrapped-css'; s.textContent = CSS; d.head.appendChild(s);
  }

  /* ---------- the Status card, drawn on her phone ---------- */
  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (wd) {
      var t = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function rr(ctx, x, y, wd, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + wd, y, x + wd, y + h, r); ctx.arcTo(x + wd, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + wd, y, r); ctx.closePath();
  }
  function sticker(ctx, x, y, wd, h, r, fill, off) {
    ctx.fillStyle = INK; rr(ctx, x + off, y + off, wd, h, r); ctx.fill();
    ctx.fillStyle = fill; rr(ctx, x, y, wd, h, r); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = INK; rr(ctx, x, y, wd, h, r); ctx.stroke();
  }

  function draw(canvas, sum, toneName) {
    var W = 1080, H = 1920, c = tone(toneName), ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    var SERIF = '"DM Serif Display", Georgia, serif', SANS = '"Nunito Sans", system-ui, sans-serif';
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var y = 120;
    if (sum.example) {
      sticker(ctx, 140, 80, 800, 92, 46, '#F6E4BC', 8);
      ctx.fillStyle = INK; ctx.font = '800 38px ' + SANS; ctx.fillText('EXAMPLE NUMBERS, NOT MINE', W / 2, 140);
      y = 270;
    } else { y = 180; }
    sticker(ctx, 360, y - 56, 360, 78, 39, c[1], 8);
    ctx.fillStyle = INK; ctx.font = '800 34px ' + SANS; ctx.fillText('MUM WRAPPED', W / 2, y - 6);
    y += 120;
    ctx.font = '112px ' + SERIF; ctx.fillStyle = INK;
    wrap(ctx, sum.title || 'My first six weeks, Wrapped.', 860).forEach(function (ln) { ctx.fillText(ln, W / 2, y); y += 118; });
    y += 6;
    if (sum.type) {
      ctx.font = '800 52px ' + SANS; ctx.fillStyle = INK;
      wrap(ctx, sum.type, 860).forEach(function (ln) { ctx.fillText(ln, W / 2, y); y += 66; });
    }
    y += 40;
    var cells = (sum.cells || []).slice(0, 6), cw = 440, ch = 230, gx = 40, gy = 36;
    var rows = Math.ceil(cells.length / 2);
    var startX = (W - (cw * 2 + gx)) / 2;
    cells.forEach(function (cell, i) {
      var cx = startX + (i % 2) * (cw + gx), cy = y + Math.floor(i / 2) * (ch + gy);
      var alone = cells.length % 2 === 1 && i === cells.length - 1;
      var bx = alone ? (W - cw) / 2 : cx;
      sticker(ctx, bx, cy, cw, ch, 28, '#fff', 8);
      ctx.fillStyle = INK; ctx.font = '96px ' + SERIF;
      var v = String(cell.value), size = 96;
      while (ctx.measureText(v).width > cw - 40 && size > 48) { size -= 4; ctx.font = size + 'px ' + SERIF; }
      ctx.fillText(v, bx + cw / 2, cy + 112);
      ctx.font = '800 36px ' + SANS; ctx.fillStyle = INK;
      var lab = wrap(ctx, cell.label, cw - 50);
      lab.slice(0, 2).forEach(function (ln, k) { ctx.fillText(ln, bx + cw / 2, cy + 168 + k * 42); });
    });
    y += rows * (ch + gy) + 30;
    if (sum.foot) {
      ctx.font = '800 44px ' + SANS; ctx.fillStyle = INK;
      wrap(ctx, sum.foot, 820).forEach(function (ln) { ctx.fillText(ln, W / 2, y); y += 56; });
    }
    ctx.font = '800 40px ' + SANS; ctx.fillStyle = INK;
    ctx.fillText('Wholesome Girlies', W / 2, H - 120);
    ctx.font = '700 32px ' + SANS; ctx.globalAlpha = .75;
    ctx.fillText(sum.url || 'wholesomegirlies.xyz', W / 2, H - 70);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 14; ctx.strokeStyle = INK; rr(ctx, 14, 14, W - 28, H - 28, 40); ctx.stroke();
  }

  function toBlob(canvas, cb) {
    if (canvas.toBlob) canvas.toBlob(cb, 'image/png');
    else cb(null);
  }

  function renderSummary(st) {
    var sum = st.summary, c = tone(st.lastTone);
    var box = el('div', 'wgw-sum');
    var canvas = d.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Your first six weeks, Wrapped. ' + (sum.type || '') + ' ' + (sum.cells || []).map(function (x) { return x.value + ' ' + x.label; }).join(', '));
    box.appendChild(canvas);
    var acts = el('div', 'wgw-acts');
    var save = el('button', 'wgw-btn main', 'Save for your Status'); save.type = 'button';
    var back = el('button', 'wgw-btn', 'Back'); back.type = 'button';
    var done = el('button', 'wgw-btn', 'Close'); done.type = 'button';
    acts.appendChild(save); acts.appendChild(back); acts.appendChild(done);
    box.appendChild(acts);
    box.appendChild(el('p', 'wgw-note', sum.example
      ? 'These are example numbers, so this picture is marked as an example.'
      : 'This picture shows counts only. It never shows a name, a date or anything about your health. It is made on your phone and not sent anywhere.'));
    var name = (sum.filename || 'mum-wrapped') + '.png';
    var ready = (w.document.fonts && w.document.fonts.load)
      ? Promise.all([w.document.fonts.load('112px "DM Serif Display"'), w.document.fonts.load('800 36px "Nunito Sans"')]).catch(function () {})
      : Promise.resolve();
    ready.then(function () { draw(canvas, sum, st.lastTone); });
    save.addEventListener('click', function () {
      toBlob(canvas, function (blob) {
        if (!blob) { w.open(canvas.toDataURL('image/png'), '_blank'); return; }
        var touch = /Android|iPhone|iPad/i.test(navigator.userAgent);
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) {}
        if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file] }).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            var a = d.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
            d.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          });
          return;
        }
        var a = d.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        d.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      });
    });
    back.addEventListener('click', function () { go(st, st.i - 1); });
    done.addEventListener('click', close);
    return box;
  }

  /* ---------- the story ---------- */
  function countUp(node, card) {
    var target = card.num, tpl = card.tpl || '{n}';
    if (reduce || target < 12) { node.textContent = tpl.replace('{n}', fmt(target)); return; }
    var t0 = null, dur = 900;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = tpl.replace('{n}', fmt(Math.round(target * e)));
      if (p < 1) st_raf = w.requestAnimationFrame(step);
    }
    var st_raf = w.requestAnimationFrame(step);
  }

  function go(st, k) {
    if (k < 0) k = 0;
    if (k >= st.cards.length) { close(); return; }
    st.i = k;
    var card = st.cards[k], c = tone(card.tone);
    st.root.style.setProperty('--wgw-bg', c[0]);
    st.root.style.setProperty('--wgw-ac', c[1]);
    if (card.kind !== 'summary') st.lastTone = card.tone;
    [].forEach.call(st.bars.children, function (b, n) { b.classList.toggle('on', n <= k); });
    if (st.stage && st.stage.parentNode) st.stage.parentNode.removeChild(st.stage);
    var stage;
    if (card.kind === 'summary') {
      stage = renderSummary(st);
      st.hitPrev.style.display = st.hitNext.style.display = 'none';
      st.hint.style.display = 'none';
    } else {
      stage = el('div', 'wgw-card');
      if (card.kicker) stage.appendChild(el('span', 'wgw-kicker', card.kicker));
      var big = el('h2', 'wgw-big');
      if (card.num != null) countUp(big, card); else big.textContent = card.big || '';
      if (card.big || card.num != null) stage.appendChild(big);
      if (card.line) stage.appendChild(el('p', 'wgw-line', card.line));
      st.hitPrev.style.display = st.hitNext.style.display = '';
      st.hint.style.display = '';
      st.hint.textContent = k === 0 ? 'Tap to start' : 'Tap to continue';
    }
    st.root.insertBefore(stage, st.hitPrev);
    st.stage = stage;
    if (typeof st.onShow === 'function') st.onShow(card, k);
  }

  function onKey(e) {
    if (!state) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      if (e.target && /BUTTON|A|INPUT/.test(e.target.tagName) && e.key !== 'ArrowRight') return;
      if (state.cards[state.i].kind !== 'summary') { e.preventDefault(); go(state, state.i + 1); }
    } else if (e.key === 'ArrowLeft') { go(state, state.i - 1); }
    else if (e.key === 'Tab') {
      var f = [].slice.call(state.root.querySelectorAll('button')).filter(function (b) { return b.offsetParent !== null && !b.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function open(opts) {
    ensureCss();
    if (state) close();
    var cards = (opts.cards || []).slice();
    cards.push({ kind: 'summary', tone: opts.summaryTone || 'peach' });
    var root = el('div', 'wgw');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Mum Wrapped');
    var bars = el('div', 'wgw-bars');
    cards.forEach(function () { bars.appendChild(d.createElement('span')); });
    var x = el('button', 'wgw-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close Mum Wrapped');
    var hitPrev = el('button', 'wgw-hit wgw-prev'); hitPrev.type = 'button'; hitPrev.setAttribute('aria-label', 'Previous card');
    var hitNext = el('button', 'wgw-hit wgw-next'); hitNext.type = 'button'; hitNext.setAttribute('aria-label', 'Next card');
    var hint = el('div', 'wgw-hint', 'Tap to start');
    root.appendChild(bars); root.appendChild(x); root.appendChild(hitPrev); root.appendChild(hitNext); root.appendChild(hint);
    state = { root: root, bars: bars, cards: cards, summary: opts.summary || {}, i: 0, hitPrev: hitPrev, hitNext: hitNext, hint: hint,
      opener: opts.opener || d.activeElement, onClose: opts.onClose, onShow: opts.onShow, lastTone: cards[0].tone || 'peach', prevOverflow: d.body.style.overflow };
    d.body.style.overflow = 'hidden';
    d.body.appendChild(root);
    var st = state;
    x.addEventListener('click', close);
    hitPrev.addEventListener('click', function () { go(st, st.i - 1); });
    hitNext.addEventListener('click', function () { go(st, st.i + 1); });
    d.addEventListener('keydown', onKey);
    go(st, 0);
    hitNext.focus();
  }

  function close() {
    if (!state) return;
    var st = state; state = null;
    d.removeEventListener('keydown', onKey);
    if (st.root.parentNode) st.root.parentNode.removeChild(st.root);
    d.body.style.overflow = st.prevOverflow || '';
    if (st.opener && st.opener.focus) { try { st.opener.focus(); } catch (e) {} }
    if (typeof st.onClose === 'function') st.onClose();
  }

  w.WGWrapped = { open: open, close: close, draw: draw };
})(window, document);
