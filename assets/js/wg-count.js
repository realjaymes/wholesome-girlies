/* The count engine: bingo grids and "put a finger down" lists.
   One shared script. A page sets window.WG_COUNT before loading this file, with an empty <div id="wc-mount"> inside
   its .tool-app and a result panel (#res with #band, #headline, #summary, #wc-stat and #wg-result-share).
   She taps what she has lived through and the count gives a named band. Nothing is stored or sent: her taps stay on
   the page, and a shared link carries the band only.

   window.WG_COUNT = {
     mode:  'bingo' | 'fingers',
     items: [...],          // bingo: 24 squares (the centre square is already ticked); fingers: 10 lines
     centre: 'text',        // bingo only: the centre square, already ticked
     lead:  'text',         // fingers only: the line above the list
     goLabel: 'See my result',
     bands: [ { min: 0, type: 'slug', band: 'label', title: 'first-person headline', summary: 'text' }, ... ],
              // ascending by min. The value is squares ticked (bingo) or fingers left (fingers)
     onResult: function (type) { ... }   // the page calls wgShowResult(type) here
   }
*/
(function (w, d) {
  var CSS =
    '.wc{--wc-line:var(--s,#6E7A3F);--wc-tint:var(--st,#EDF1E3)}' +
    '.wc-status{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;margin:0 0 12px;font-weight:800;font-size:.95rem}' +
    '.wc-status .wc-pill{border:1.5px solid var(--ink,#33322A);border-radius:999px;padding:3px 12px;background:#fff}' +
    '.wc-status .wc-pill b{font-size:1.05rem}' +
    '.wc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:0 0 14px;padding:0;list-style:none}' +
    '.wc-cell{position:relative;min-height:80px;padding:5px 2px;border:2px solid var(--ink,#33322A);border-radius:10px;background:#fff;color:var(--ink,#33322A);font:inherit;font-size:clamp(.58rem,2.45vw,.78rem);line-height:1.2;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow-wrap:break-word;hyphens:manual;transition:background .15s,transform .15s}' +
    '.wc-cell:hover{background:var(--wc-tint)}' +
    '.wc-cell:focus-visible{outline:3px solid var(--ink,#33322A);outline-offset:2px}' +
    '.wc-cell[aria-pressed="true"]{background:var(--s,#6E7A3F);color:var(--s-on,#fff);box-shadow:2px 2px 0 var(--ink,#33322A);transform:translate(-1px,-1px)}' +
    '.wc-cell.wc-free{background:var(--wc-tint);cursor:default;border-style:dashed}' +
    '.wc-cell.wc-free[aria-pressed="true"]{background:var(--wc-tint);color:var(--ink,#33322A);box-shadow:none;transform:none}' +
    '.wc-cell.wc-win{outline:3px solid var(--ink,#33322A);outline-offset:1px;animation:wcPop .35s ease}' +
    '@keyframes wcPop{0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)}}' +
    '.wc-banner{display:none;margin:0 0 12px;padding:8px 12px;border:2px solid var(--ink,#33322A);border-radius:12px;background:var(--wc-tint);font-weight:800;text-align:center}' +
    '.wc-banner.on{display:block}' +
    '.wc-hands{position:sticky;top:70px;z-index:5;display:flex;justify-content:center;align-items:flex-end;gap:22px;padding:10px 6px 8px;margin:0 0 14px;background:#fff;border:2px solid var(--ink,#33322A);border-radius:16px}' +
    '.wc-hand{display:flex;align-items:flex-end;gap:5px;padding-bottom:0}' +
    '.wc-f{width:clamp(16px,5.2vw,26px);height:var(--h);border:2px solid var(--ink,#33322A);border-bottom-width:0;border-radius:14px 14px 0 0;background:var(--s,#6E7A3F);transition:height .35s cubic-bezier(.3,1.5,.5,1),background .25s}' +
    '.wc-f.down{height:14px;background:#ddd9cc}' +
    '.wc-palm{height:14px;border:2px solid var(--ink,#33322A);border-radius:0 0 14px 14px;background:var(--wc-tint);margin-top:-2px}' +
    '.wc-handcol{display:flex;flex-direction:column;align-items:stretch}' +
    '.wc-lead{font-weight:800;font-size:1.05rem;margin:0 0 10px}' +
    '.wc-list{list-style:none;margin:0 0 14px;padding:0;counter-reset:wcl}' +
    '.wc-line{display:flex;align-items:flex-start;gap:10px;width:100%;margin:0 0 8px;padding:12px 14px;border:2px solid var(--ink,#33322A);border-radius:14px;background:#fff;color:var(--ink,#33322A);font:inherit;font-size:1rem;line-height:1.4;text-align:left;cursor:pointer;box-shadow:2px 2px 0 var(--ink,#33322A)}' +
    '.wc-line::before{counter-increment:wcl;content:counter(wcl);flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--ink,#33322A);display:grid;place-items:center;font-weight:800;font-size:.85rem;background:var(--wc-tint)}' +
    '.wc-line[aria-pressed="true"]{background:var(--s,#6E7A3F);color:var(--s-on,#fff);box-shadow:none;transform:translate(2px,2px)}' +
    '.wc-line[aria-pressed="true"]::before{background:#fff;color:var(--ink,#33322A)}' +
    '.wc-line:focus-visible{outline:3px solid var(--ink,#33322A);outline-offset:2px}' +
    '.wc-sthead{display:flex;align-items:center;gap:12px;margin:0 0 12px}' +
    '.wc-stcount{flex:none;font-weight:800;font-size:.9rem}' +
    '.wc-stbar{flex:1;height:12px;border-radius:8px;background:#fff;border:1.5px solid var(--ink,#33322A);overflow:hidden}' +
    '.wc-stbar span{display:block;height:100%;width:0;background:var(--s,#6E7A3F);transition:width .3s ease}' +
    '.wc-card{padding:18px 16px;margin:0 0 10px;border:2px solid var(--ink,#33322A);border-radius:16px;background:#fff;box-shadow:3px 3px 0 var(--ink,#33322A)}' +
    '.wc-card.wc-in{animation:wcIn .28s ease}' +
    '@keyframes wcIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}' +
    '.wc-cardline{font-size:1.15rem;line-height:1.4;font-weight:700;margin:0 0 16px;min-height:3.2em}' +
    '.wc-choices{display:flex;flex-direction:column;gap:10px}' +
    '.wc-choice{padding:13px 14px;border:2px solid var(--ink,#33322A);border-radius:12px;background:#fff;color:var(--ink,#33322A);font:inherit;font-weight:800;cursor:pointer}' +
    '.wc-choice:hover{background:var(--wc-tint)}' +
    '.wc-choice[aria-pressed="true"]{background:var(--s,#6E7A3F);color:var(--s-on,#fff)}' +
    '.wc-choice:focus-visible{outline:3px solid var(--ink,#33322A);outline-offset:2px}' +
    '.wc-back{background:none;border:0;font:inherit;font-weight:800;color:var(--ink,#33322A);cursor:pointer;padding:8px 0;margin:0 0 6px}' +
    '.wc-back[disabled]{visibility:hidden}' +
    '.wc-hide{display:none!important}' +
    '.wc-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
    '.wc-hint{font-size:.9rem;margin:10px 0 0;color:var(--plum-soft,#555)}' +
    '@media (max-width:520px){.tool-app.wc{padding:14px 10px}.wc-hands{gap:12px}.wc-line{padding:11px 12px}}' +
    '@media (prefers-reduced-motion:reduce){.wc-cell,.wc-f,.wc-stbar span{transition:none}.wc-cell.wc-win,.wc-card.wc-in{animation:none}}';

  var FOLD_ORDER = [0, 1, 2, 3, 4, 9, 8, 7, 6, 5];
  var HEIGHTS = [44, 58, 66, 58, 42, 42, 58, 66, 58, 44];

  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function lines5() {
    var L = [], r, c;
    for (r = 0; r < 5; r++) { var row = [], col = []; for (c = 0; c < 5; c++) { row.push(r * 5 + c); col.push(c * 5 + r); } L.push(row, col); }
    L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
    return L;
  }

  function init() {
    var cfg = w.WG_COUNT, mount = d.getElementById('wc-mount');
    if (!cfg || !mount) return;
    if (!d.getElementById('wg-count-css')) { var st = el('style'); st.id = 'wg-count-css'; st.textContent = CSS; d.head.appendChild(st); }
    var app = mount.closest('.tool-app') || mount.parentNode;
    app.classList.add('wc');
    var res = d.getElementById('res'), stat = d.getElementById('wc-stat');
    var bingo = cfg.mode === 'bingo';
    var on = [], status, banner, cells = [], fingers = [], hint, answered = [], step = 0, card, actions, showLine;

    function value() {
      var n = 0; on.forEach(function (v, i) { if (v && !(bingo && i === 12)) n++; });
      return bingo ? n : cfg.items.length - n;
    }
    function doneLines() {
      if (!bingo) return [];
      return lines5().filter(function (l) { return l.every(function (i) { return on[i]; }); });
    }
    function paint() {
      var n = bingo ? value() : cfg.items.length - value();
      if (bingo) {
        var won = doneLines(), mark = {};
        won.forEach(function (l) { l.forEach(function (i) { mark[i] = 1; }); });
        cells.forEach(function (c, i) { c.classList.toggle('wc-win', !!mark[i]); });
        status.innerHTML = '<span class="wc-pill"><b>' + n + '</b> of ' + (cfg.items.length) + ' ticked</span><span class="wc-pill"><b>' + won.length + '</b> ' + (won.length === 1 ? 'line' : 'lines') + '</span>';
        banner.classList.toggle('on', won.length > 0);
        banner.textContent = won.length ? (won.length === 1 ? 'Bingo. You have a full line.' : 'Bingo. ' + won.length + ' full lines.') : '';
      } else {
        status.innerHTML = '<span class="wc-pill"><b>' + (cfg.items.length - n) + '</b> fingers left</span>';
        fingers.forEach(function (f, k) { f.classList.toggle('down', FOLD_ORDER.indexOf(k) < n); });
      }
    }
    function toggle(i, btn) {
      on[i] = !on[i];
      btn.setAttribute('aria-pressed', on[i] ? 'true' : 'false');
      paint();
    }

    status = el('div', 'wc-status'); status.setAttribute('aria-live', 'polite');
    mount.appendChild(status);

    if (bingo) {
      banner = el('div', 'wc-banner'); banner.setAttribute('role', 'status'); mount.appendChild(banner);
      var grid = el('ul', 'wc-grid'), k = 0;
      for (var i = 0; i < 25; i++) {
        var li = el('li'), b = el('button', 'wc-cell'); b.type = 'button';
        if (i === 12) { b.className += ' wc-free'; b.textContent = cfg.centre; b.setAttribute('aria-pressed', 'true'); b.disabled = true; on[i] = true; }
        else { b.textContent = cfg.items[k++]; b.setAttribute('aria-pressed', 'false'); on[i] = false; (function (idx, bt) { bt.addEventListener('click', function () { toggle(idx, bt); }); })(i, b); }
        li.appendChild(b); grid.appendChild(li); cells.push(b);
      }
      mount.appendChild(grid);
    } else {
      var hands = el('div', 'wc-hands'); hands.setAttribute('aria-hidden', 'true');
      [0, 1].forEach(function (h) {
        var col = el('div', 'wc-handcol'), hand = el('div', 'wc-hand');
        for (var f = 0; f < 5; f++) { var fi = h * 5 + f, fe = el('span', 'wc-f'); fe.style.setProperty('--h', HEIGHTS[fi] + 'px'); hand.appendChild(fe); fingers[fi] = fe; }
        col.appendChild(hand); col.appendChild(el('div', 'wc-palm')); hands.appendChild(col);
      });
      mount.appendChild(hands);
      mount.appendChild(el('p', 'wc-lead', cfg.lead));
      // One line per screen: tap a choice and the next line slides in, Back steps back, the result button shows
      // once every line has an answer.
      var sthead = el('div', 'wc-sthead', '<span class="wc-stcount" aria-live="polite"></span><span class="wc-stbar" aria-hidden="true"><span></span></span>');
      card = el('div', 'wc-card');
      var cardLine = el('p', 'wc-cardline'), choices = el('div', 'wc-choices');
      var yes = el('button', 'wc-choice', 'Put a finger down'), no = el('button', 'wc-choice', 'Not me');
      yes.type = no.type = 'button';
      choices.appendChild(yes); choices.appendChild(no); card.appendChild(cardLine); card.appendChild(choices);
      var back = el('button', 'wc-back', '&larr; Back'); back.type = 'button';
      mount.appendChild(sthead); mount.appendChild(card); mount.appendChild(back);
      cfg.items.forEach(function (t, idx) { on[idx] = false; answered[idx] = false; });
      showLine = function (k, scroll) {
        var n = cfg.items.length;
        step = Math.max(0, Math.min(n - 1, k));
        cardLine.textContent = cfg.items[step];
        card.classList.remove('wc-in'); void card.offsetWidth; card.classList.add('wc-in');
        yes.setAttribute('aria-pressed', answered[step] && on[step] ? 'true' : 'false');
        no.setAttribute('aria-pressed', answered[step] && !on[step] ? 'true' : 'false');
        var done = answered.filter(Boolean).length;
        sthead.querySelector('.wc-stcount').textContent = 'Line ' + (step + 1) + ' of ' + n;
        sthead.querySelector('.wc-stbar span').style.width = (done / n * 100) + '%';
        back.disabled = step === 0;
        if (actions) actions.classList.toggle('wc-hide', done < n);
        if (scroll) { var top = sthead.getBoundingClientRect().top + w.scrollY - 260; if (w.scrollY > top) w.scrollTo({ top: top, behavior: 'smooth' }); }
      };
      function pick(v) {
        on[step] = v; answered[step] = true; paint();
        var from = step;
        showLine(step);
        if (from < cfg.items.length - 1) setTimeout(function () { if (step === from) showLine(from + 1, true); }, 380);
      }
      yes.addEventListener('click', function () { pick(true); });
      no.addEventListener('click', function () { pick(false); });
      back.addEventListener('click', function () { showLine(step - 1, true); });
    }

    actions = el('div', 'wc-actions');
    var go = el('button', 'btn btn-primary', cfg.goLabel || 'See my result'); go.type = 'button';
    var reset = el('button', 'btn btn-ghost', 'Start over'); reset.type = 'button'; reset.style.background = '#fff';
    actions.appendChild(go); actions.appendChild(reset); mount.appendChild(actions);
    hint = el('p', 'wc-hint', bingo ? 'Tap a square when it has happened to you. The dotted square in the middle is already ticked.' : 'Tap Put a finger down when it has happened to you, or Not me when it has not. A finger folds down each time.');
    mount.appendChild(hint);

    go.addEventListener('click', function () {
      var v = value(), band = cfg.bands[0];
      cfg.bands.forEach(function (b) { if (v >= b.min) band = b; });
      if (d.getElementById('band')) d.getElementById('band').textContent = band.band;
      if (d.getElementById('headline')) d.getElementById('headline').textContent = band.title;
      if (d.getElementById('summary')) d.getElementById('summary').textContent = band.summary;
      if (stat) {
        if (bingo) { var wl = doneLines().length; stat.textContent = 'You ticked ' + v + ' of ' + cfg.items.length + (wl ? ' and completed ' + wl + (wl === 1 ? ' line.' : ' lines.') : '.'); }
        else stat.textContent = 'You have ' + v + (v === 1 ? ' finger' : ' fingers') + ' left.';
      }
      if (typeof cfg.onResult === 'function') cfg.onResult(band.type);
      if (res) { res.classList.add('show'); res.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
    reset.addEventListener('click', function () {
      cells.forEach(function (c, i) { if (!(bingo && i === 12)) { on[i] = false; c.setAttribute('aria-pressed', 'false'); } });
      if (!bingo) { cfg.items.forEach(function (t, idx) { on[idx] = false; answered[idx] = false; }); showLine(0); }
      paint();
      if (typeof cfg.onResult === 'function') cfg.onResult(null);
      if (res) res.classList.remove('show');
      var top = app.getBoundingClientRect().top + w.scrollY - 90; w.scrollTo({ top: top, behavior: 'smooth' });
    });
    paint();
    if (!bingo) showLine(0);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
