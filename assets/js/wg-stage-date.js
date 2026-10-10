/* Wholesome Girlies: stage dates and saved tool entries (CLAUDE.md section 10, "Saved tools").
 *
 * A stage date is entered once and every tool in that stage opens already filled in. Everything lives in this
 * phone's localStorage. Nothing is sent anywhere, and no saved value ever goes to the dataLayer, a URL or a share line.
 *
 * Keys (all start with wg_, so the consent guard, the install bar and the app's backup code already cover them):
 *   wg_stage_fertility_v1   {"v":1,"lmp":"YYYY-MM-DD","cycle":28,"starts":["YYYY-MM-DD", ...]}
 *   wg_stage_pregnancy_v1   {"v":1,"due":"YYYY-MM-DD"}
 *   wg_stage_postpartum_v1  {"v":1,"delivery":"YYYY-MM-DD","type":"vaginal"|"csection"}
 *   wg_vax_dob              "YYYY-MM-DD"  (the Vaccination Tracker's own key, reused as the parenting date; never rename it)
 * A change to a format bumps the _v number and migrates the old value in read().
 *
 * Bad, old or impossible values are ignored (never thrown on), and a blocked localStorage means nothing saves.
 * Each stage has a forget control (mount) that removes the date for every tool in the stage.
 */
(function (w, d) {
  'use strict';
  var KEY = { fertility: 'wg_stage_fertility_v1', pregnancy: 'wg_stage_pregnancy_v1', postpartum: 'wg_stage_postpartum_v1', parenting: 'wg_vax_dob' };
  var DAY = 864e5;

  // ── storage, always wrapped ─────────────────────────────────────────────
  function store() { try { return w.localStorage; } catch (e) { return null; } }
  function rawGet(k) { try { var s = store(); return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function rawSet(k, v) { try { var s = store(); if (!s) return false; s.setItem(k, v); return true; } catch (e) { return false; } }
  function rawDel(k) { try { var s = store(); if (s) s.removeItem(k); } catch (e) {} }
  function json(k) { try { var o = JSON.parse(rawGet(k)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; } }

  // ── dates (local calendar days, so a time zone never moves a date) ──────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function parse(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), dd = +s.slice(8, 10), dt = new Date(y, m - 1, dd);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== dd || y < 2000 || y > 2100) return null;
    return dt;
  }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function addDays(dt, n) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); }
  function between(dt, a, b) { return dt && dt >= a && dt <= b; } // a and b are Dates
  function daysBetween(a, b) { return Math.round((a - b) / DAY); } // whole days a minus b
  function nice(dt) { return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); }

  // ── fertility ───────────────────────────────────────────────────────────
  function readFertility() {
    var o = json(KEY.fertility), t = today(), out = { lmp: '', cycle: 0, starts: [] };
    if (!o || o.v !== 1) return out;
    var seen = {};
    (Array.isArray(o.starts) ? o.starts : []).forEach(function (s) {
      var dt = parse(s);
      if (between(dt, addDays(t, -730), t) && !seen[s]) { seen[s] = 1; out.starts.push(s); }
    });
    out.starts.sort();
    out.starts = out.starts.slice(-24);
    if (between(parse(o.lmp), addDays(t, -400), t)) out.lmp = o.lmp;
    var c = +o.cycle;
    if (c >= 21 && c <= 40 && c === Math.floor(c)) out.cycle = c;
    return out;
  }
  function writeFertility(f) {
    if (!f.lmp && !f.cycle && !f.starts.length) { rawDel(KEY.fertility); return refresh(); }
    var ok = rawSet(KEY.fertility, JSON.stringify({ v: 1, lmp: f.lmp || '', cycle: f.cycle || 0, starts: f.starts }));
    refresh();
    return ok;
  }
  var fertility = {
    read: readFertility,
    setLmp: function (s) {
      if (!between(parse(s), addDays(today(), -400), today())) return false;
      var f = readFertility(); f.lmp = s; return writeFertility(f);
    },
    setCycle: function (n) {
      n = +n; if (!(n >= 21 && n <= 40)) return false;
      var f = readFertility(); f.cycle = Math.floor(n); return writeFertility(f);
    },
    // Adds a real period start to her history and makes it the last period.
    logStart: function (s) {
      if (!between(parse(s), addDays(today(), -730), today())) return false;
      var f = readFertility();
      if (f.starts.indexOf(s) < 0) { f.starts.push(s); f.starts.sort(); f.starts = f.starts.slice(-24); }
      if (!f.lmp || s > f.lmp) f.lmp = s;
      return writeFertility(f);
    },
    removeStart: function (s) {
      var f = readFertility();
      f.starts = f.starts.filter(function (x) { return x !== s; });
      if (f.lmp === s) f.lmp = f.starts.length ? f.starts[f.starts.length - 1] : '';
      return writeFertility(f);
    },
    // Her own average from the gaps between her last logged starts (up to 6 gaps; a gap under 18 or over 60 days
    // means a missed log, so it is skipped). With 2 or more usable gaps the average replaces the number she typed.
    effectiveCycle: function () {
      var f = readFertility(), gaps = [];
      for (var i = Math.max(1, f.starts.length - 6); i < f.starts.length; i++) {
        var g = daysBetween(parse(f.starts[i]), parse(f.starts[i - 1]));
        if (g >= 18 && g <= 60) gaps.push(g);
      }
      if (gaps.length >= 2) {
        var sum = gaps.reduce(function (a, b) { return a + b; }, 0);
        return { days: Math.round(sum / gaps.length), source: 'average', n: gaps.length };
      }
      return { days: f.cycle || 28, source: 'chosen', n: gaps.length };
    }
  };

  // ── pregnancy ───────────────────────────────────────────────────────────
  var pregnancy = {
    read: function () {
      var o = json(KEY.pregnancy), t = today();
      if (!o || o.v !== 1 || !between(parse(o.due), addDays(t, -300), addDays(t, 300))) return null;
      return { due: o.due };
    },
    setDue: function (s) {
      var t = today();
      if (!between(parse(s), addDays(t, -300), addDays(t, 300))) return false;
      var ok = rawSet(KEY.pregnancy, JSON.stringify({ v: 1, due: s })); refresh(); return ok;
    }
  };

  // ── postpartum ──────────────────────────────────────────────────────────
  var postpartum = {
    read: function () {
      var o = json(KEY.postpartum), t = today();
      if (!o || o.v !== 1 || !between(parse(o.delivery), addDays(t, -365), t)) return null;
      return { delivery: o.delivery, type: o.type === 'csection' || o.type === 'vaginal' ? o.type : '' };
    },
    set: function (s, type) {
      var t = today();
      if (!between(parse(s), addDays(t, -365), t)) return false;
      var ok = rawSet(KEY.postpartum, JSON.stringify({ v: 1, delivery: s, type: type === 'csection' ? 'csection' : 'vaginal' }));
      refresh(); return ok;
    }
  };

  // ── parenting: the Vaccination Tracker's date of birth, as plain text ───
  var parenting = {
    read: function () {
      var s = rawGet(KEY.parenting), t = today();
      return between(parse(s), addDays(t, -2200), t) ? { dob: s } : null;
    },
    setDob: function (s) {
      if (!s) { rawDel(KEY.parenting); refresh(); return true; }
      var t = today();
      if (!between(parse(s), addDays(t, -2200), t)) return false;
      var ok = rawSet(KEY.parenting, s); refresh(); return ok;
    },
    // Whole months old, or -1 when there is no usable date of birth.
    ageMonths: function () {
      var p = parenting.read(); if (!p) return -1;
      var b = parse(p.dob), t = today(), m = (t.getFullYear() - b.getFullYear()) * 12 + t.getMonth() - b.getMonth();
      if (t.getDate() < b.getDate()) m--;
      return Math.max(0, m);
    }
  };

  var STAGES = { fertility: fertility, pregnancy: pregnancy, postpartum: postpartum, parenting: parenting };

  function has(stage) {
    var s = STAGES[stage]; if (!s) return false;
    if (stage === 'fertility') { var f = readFertility(); return !!(f.lmp || f.cycle || f.starts.length); }
    return !!s.read();
  }
  function clear(stage) { if (KEY[stage]) rawDel(KEY[stage]); refresh(); }

  // ── the forget control ──────────────────────────────────────────────────
  var mounted = [];
  function style() {
    if (d.getElementById('wg-saved-style')) return;
    var s = d.createElement('style'); s.id = 'wg-saved-style';
    s.textContent = '.wg-saved{margin-top:20px;padding-top:14px;border-top:1px dashed var(--line,#ddd9c4)}' +
      '.wg-saved p{margin:0 0 8px;font-size:.92rem}.wg-saved .wg-saved-sum{font-weight:800}' +
      '.wg-saved .btn{padding:10px 18px}.wg-saved .wg-saved-note{color:var(--plum-soft,#66645a);margin:8px 0 0}' +
      '.wg-saved .wg-saved-done{font-weight:800}@media print{.wg-saved{display:none!important}}';
    d.head.appendChild(s);
  }
  // cfg: has() -> bool, summary() -> text, clear() -> removes the data, onClear() -> page resets, label, note, done
  function mount(el, cfg) {
    if (!el || !cfg) return;
    style();
    el.className = 'wg-saved';
    el.hidden = true;
    var item = { el: el, cfg: cfg, said: false };
    el.innerHTML = '<p class="wg-saved-sum" hidden></p><button type="button" class="btn btn-ghost" hidden></button><p class="wg-saved-note" hidden></p><p class="wg-saved-done" role="status" aria-live="polite" hidden></p>';
    el.querySelector('button').addEventListener('click', function () {
      cfg.clear();
      if (cfg.onClear) { try { cfg.onClear(); } catch (e) {} }
      item.said = true;
      refresh();
    });
    mounted.push(item);
    paint(item);
  }
  function paint(item) {
    var el = item.el, cfg = item.cfg, on = false;
    try { on = !!cfg.has(); } catch (e) {}
    var sum = el.querySelector('.wg-saved-sum'), btn = el.querySelector('button'), note = el.querySelector('.wg-saved-note'), done = el.querySelector('.wg-saved-done');
    if (on) item.said = false;
    sum.hidden = btn.hidden = note.hidden = !on;
    done.hidden = on || !item.said;
    if (on) {
      var t = ''; try { t = cfg.summary ? cfg.summary() : ''; } catch (e) {}
      sum.textContent = t; sum.hidden = !t;
      btn.textContent = cfg.label; note.textContent = cfg.note;
    } else if (item.said) done.textContent = cfg.done;
    el.hidden = !(on || item.said);
  }
  function refresh() { mounted.forEach(paint); }

  // Presets for the four stages. Forgetting a stage date clears it for every tool in the stage.
  var UI = {
    fertility: { label: 'Forget my dates', note: 'This removes your period dates from every fertility tool on this phone.', done: 'Your period dates are removed from this phone.' },
    pregnancy: { label: 'Forget my due date', note: 'This removes your due date from every pregnancy tool on this phone.', done: 'Your due date is removed from this phone.' },
    postpartum: { label: 'Forget my dates', note: 'This removes your delivery date from every postpartum tool on this phone.', done: 'Your delivery date is removed from this phone.' },
    parenting: { label: 'Forget my baby’s date of birth', note: 'This removes it from every baby tool on this phone, including the Vaccination Tracker.', done: 'Your baby’s date of birth is removed from this phone.' }
  };
  function mountStage(el, stage, summary, onClear) {
    var u = UI[stage];
    mount(el, {
      has: function () { return has(stage); }, summary: summary, clear: function () { clear(stage); }, onClear: onClear,
      label: u.label, note: u.note, done: u.done
    });
  }

  w.WGStage = {
    KEY: KEY, fertility: fertility, pregnancy: pregnancy, postpartum: postpartum, parenting: parenting,
    canSave: function () { return !!store(); },
    has: has, clear: clear, mount: mount, mountStage: mountStage, refresh: refresh,
    // shared helpers for the tools
    iso: iso, parse: parse, today: today, addDays: addDays, nice: nice, daysBetween: daysBetween,
    get: rawGet, set: rawSet, del: rawDel, json: json
  };
})(window, document);
