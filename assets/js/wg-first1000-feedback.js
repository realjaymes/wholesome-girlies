/* Wholesome Girlies: the day 7 feedback form for the First 1,000 (/first-1000/feedback).
 * Six questions, one per screen, in the same stepper as the claim form (the ff-* classes in wg-first1000-landing.css).
 * It needs a signed-in First 1,000 member: no session goes to /signin/?next=/first-1000/feedback, a signed-in woman who
 * is not a member gets a short note. The answers go to WGAccess.first1000.feedback(), which posts to the payment server
 * (POST /member/feedback). The server keeps the first answers only and adds the feedback step (2 months) once.
 * What she types stays in this file's memory until she sends it: never in the address, localStorage or the dataLayer.
 * The one analytics event is member_feedback (sent by WGAccess), with no answers in it.
 *
 * Every word on the page is in QUESTIONS and TEXT below, so a change is one line.
 */
(function (w, d) {
  'use strict';
  var WA = w.WGAccess;
  var html = d.documentElement;
  var card = d.getElementById('fbCard');
  if (!card || !WA) return;

  var STAGE_OF = { relationships: 1, fertility: 1, pregnancy: 1, postpartum: 1, parenting: 1 };
  var TEXT = {
    load: 'One moment...',
    noMemberTitle: 'This page is for First 1,000 members',
    noMemberLine: 'You are signed in, but this account does not hold a First 1,000 place.',
    noMemberLink: 'See the First 1,000',
    sentTitle: 'You have already sent your feedback. Thank you.',
    doneTitle: 'Thank you.',
    doneAdded: '2 months added to your program.',
    doneSaved: 'Your answers are saved.',
    app: 'Open the app',
    program: 'Back to your program',
    send: 'Send my feedback',
    next: 'Continue',
    skip: 'Skip',
    sendErr: 'We could not send your answers. Check your connection and try again.',
    needOne: 'Pick one answer to go on.',
    count: 'Question '
  };
  // key, type, question, options [value, label]
  var QUESTIONS = [
    { key: 'useful', type: 'scale', q: 'How useful has your program been so far?', low: 'Not useful', high: 'Very useful' },
    { key: 'used', type: 'multi', q: 'What have you used most?', opts: [['lessons', 'The lessons'], ['tools', 'The tools'], ['games', 'The games'], ['today', 'Today’s card'], ['telegram', 'The Telegram group']] },
    { key: 'better', type: 'text', q: 'What one thing would make it more useful?', max: 500, note: 'Please don’t share health details here.' },
    { key: 'keep', type: 'single', q: 'Would you keep paying for it after your free months?', opts: [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']] },
    { key: 'fair', type: 'single', q: 'What would feel fair?', opts: [[1000, '₦1,000 a month'], [2500, '₦2,500 a month'], [5000, '₦5,000 a month'], ['once', 'Pay once'], ['other', 'Other']] },
    { key: 'talk', type: 'single', q: 'Would you talk to us for 20 minutes?', opts: [[true, 'Yes'], [false, 'No']], sub: 'We would call or video chat on WhatsApp at a time that suits you.' }
  ];

  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(v) {
    var t = new Date(v); if (isNaN(t)) return '';
    return t.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][t.getMonth()];
  }
  function isDone(m, k) { var s = m && m.steps; return !!(s && (Array.isArray(s) ? s.indexOf(k) >= 0 : s[k])); }
  function clear() { card.textContent = ''; }

  var A = {};        // her answers, by key
  var step = 0, flow = null, busy = false;

  // ── the screens that are not a question ──
  function note(title, line, linkText, href) {
    clear();
    card.appendChild(el('h2', 'fb-title', title));
    if (line) card.appendChild(el('p', 'fb-line', line));
    if (linkText) { var a = el('a', 'btn btn-primary', linkText); a.href = href; card.appendChild(a); }
  }
  function programHref() {
    var a = WA.account(), p = a && a.programs && a.programs[0];
    return p && p.home ? p.home : '/app/';
  }
  function doneScreen(added) {
    clear();
    var m = WA.member();
    var tick = el('span', 'fb-tick', '✓'); tick.setAttribute('aria-hidden', 'true'); card.appendChild(tick);
    var h = el('h2', 'fb-title', TEXT.doneTitle + ' ' + (added ? TEXT.doneAdded : TEXT.doneSaved)); h.tabIndex = -1; card.appendChild(h);
    if (added && m && m.ends) card.appendChild(el('p', 'fb-line', 'Your free access now runs until ' + fmtDate(m.ends) + '.'));
    var row = el('div', 'fb-row');
    var app = el('a', 'btn btn-primary', TEXT.app); app.href = '/app/'; row.appendChild(app);
    var prog = el('a', 'btn btn-ghost', TEXT.program); prog.href = programHref(); row.appendChild(prog);
    card.appendChild(row);
    try { h.focus(); } catch (e) {}
  }

  // ── the stepper ──
  function buildFlow() {
    var root = el('form', 'ff fb-form'); root.noValidate = true; root.setAttribute('aria-label', 'Tell us what you think');
    var top = el('div', 'ff-top');
    var back = el('button', 'ff-back', '← Back'); back.type = 'button';
    var prog = el('div', 'ff-prog'); prog.setAttribute('role', 'progressbar'); prog.setAttribute('aria-valuemin', '1');
    var bar = el('i'); prog.appendChild(bar);
    var count = el('span', 'ff-count'); count.setAttribute('aria-live', 'polite');
    top.appendChild(back); top.appendChild(prog); top.appendChild(count);
    var body = el('div', 'ff-body');
    var err = el('div', 'ff-err'); err.setAttribute('role', 'alert'); err.hidden = true;
    var next = el('button', 'btn btn-primary ff-next', TEXT.next); next.type = 'submit';
    root.appendChild(top); root.appendChild(body); root.appendChild(err); root.appendChild(next);
    back.addEventListener('click', function () { if (step > 0) { step--; render(); } });
    root.addEventListener('submit', function (e) { e.preventDefault(); advance(); });
    return { root: root, back: back, prog: prog, bar: bar, count: count, body: body, err: err, next: next };
  }

  function showErr(msg) { flow.err.textContent = msg; flow.err.hidden = false; }

  function render(focus) {
    var q = QUESTIONS[step], n = step + 1, total = QUESTIONS.length;
    flow.err.hidden = true; flow.err.textContent = '';
    flow.body.textContent = '';
    flow.root.setAttribute('data-step', q.key);
    flow.count.textContent = TEXT.count + n + ' of ' + total;
    flow.prog.setAttribute('aria-valuemax', String(total)); flow.prog.setAttribute('aria-valuenow', String(n));
    flow.prog.setAttribute('aria-valuetext', TEXT.count + n + ' of ' + total);
    flow.bar.style.width = Math.round(n / total * 100) + '%';
    flow.back.hidden = step === 0;
    flow.next.hidden = false; flow.next.disabled = false;
    flow.next.textContent = n === total ? TEXT.send : TEXT.next;
    var h = el('h3', 'ff-q', q.q); h.tabIndex = -1; flow.body.appendChild(h);
    if (q.sub) flow.body.appendChild(el('p', 'ff-sub', q.sub));
    if (q.type === 'scale') drawScale(q);
    else if (q.type === 'multi') drawChoices(q, true);
    else if (q.type === 'single') drawChoices(q, false);
    else drawText(q);
    if (focus !== false) { try { h.focus(); } catch (e) {} }
  }

  function same(a, b) { return String(a) === String(b); }

  // 1 to 5, a tap each, with the ends named. Picking one goes on.
  function drawScale(q) {
    flow.next.hidden = A[q.key] === undefined;
    var row = el('div', 'fb-scale'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', q.q);
    for (var i = 1; i <= 5; i++) (function (v) {
      var lab = el('label', 'fb-dot');
      var inp = el('input'); inp.type = 'radio'; inp.name = q.key; inp.value = String(v); inp.checked = A[q.key] === v;
      var t = el('span', '', String(v));
      lab.appendChild(inp); lab.appendChild(t);
      inp.addEventListener('click', function () { A[q.key] = v; setTimeout(function () { step++; render(); }, 160); });
      row.appendChild(lab);
    })(i);
    flow.body.appendChild(row);
    var ends = el('div', 'fb-ends'); ends.appendChild(el('span', '', q.low)); ends.appendChild(el('span', '', q.high));
    flow.body.appendChild(ends);
  }

  function drawChoices(q, multi) {
    var list = el('div', 'fb-opts'); list.setAttribute('role', multi ? 'group' : 'radiogroup'); list.setAttribute('aria-label', q.q);
    var last = step === QUESTIONS.length - 1;
    q.opts.forEach(function (o) {
      var lab = el('label', 'fb-opt');
      var inp = el('input'); inp.type = multi ? 'checkbox' : 'radio'; inp.name = q.key; inp.value = String(o[0]);
      inp.checked = multi ? (A[q.key] || []).indexOf(o[0]) >= 0 : same(A[q.key], o[0]) && A[q.key] !== undefined;
      lab.appendChild(inp); lab.appendChild(el('span', '', o[1]));
      inp.addEventListener('change', function () {
        if (multi) {
          var cur = A[q.key] || [], at = cur.indexOf(o[0]);
          if (inp.checked && at < 0) cur.push(o[0]); else if (!inp.checked && at >= 0) cur.splice(at, 1);
          A[q.key] = cur;
        } else {
          A[q.key] = o[0];
          flow.err.hidden = true;
          if (!last) setTimeout(function () { step++; render(); }, 160);
        }
      });
      list.appendChild(lab);
    });
    flow.body.appendChild(list);
    // A single choice goes on by itself, except on the last question, which ends with the send button.
    if (!multi && !last) flow.next.hidden = A[q.key] === undefined;
  }

  function drawText(q) {
    var wrap = el('div', 'ff-field');
    var ta = el('textarea', 'ff-input fb-text'); ta.id = 'fbBetter'; ta.rows = 5; ta.maxLength = q.max; ta.setAttribute('aria-describedby', 'fbBetterNote');
    ta.setAttribute('aria-label', q.q);
    ta.value = A[q.key] || '';
    var cnt = el('p', 'ff-hint fb-count', '');
    function upd() { cnt.textContent = ta.value.length + ' of ' + q.max; }
    ta.addEventListener('input', function () { A[q.key] = ta.value; upd(); });
    upd();
    wrap.appendChild(ta);
    var nt = el('p', 'ff-hint', q.note); nt.id = 'fbBetterNote'; wrap.appendChild(nt);
    wrap.appendChild(cnt);
    flow.body.appendChild(wrap);
    flow.next.textContent = TEXT.next;
  }

  function advance() {
    if (busy) return;
    var q = QUESTIONS[step];
    if (q.type === 'single' && A[q.key] === undefined) return showErr(TEXT.needOne);
    if (q.type === 'scale' && A[q.key] === undefined) return showErr(TEXT.needOne);
    if (step < QUESTIONS.length - 1) { step++; return render(); }
    submit();
  }

  function payload() {
    var out = {};
    QUESTIONS.forEach(function (q) {
      var v = A[q.key];
      if (q.type === 'multi') out[q.key] = (v || []).slice();
      else if (q.type === 'text') { v = (v || '').trim().slice(0, q.max); if (v) out[q.key] = v; }
      else if (v !== undefined) out[q.key] = v;
    });
    return out;
  }

  function submit() {
    busy = true; flow.next.disabled = true; flow.next.textContent = 'Sending...'; flow.err.hidden = true;
    var before = isDone(WA.member(), 'feedback_d7');
    WA.first1000.feedback(payload()).then(function (j) {
      busy = false;
      if (j && j.ok) { var added = !before && isDone(WA.member(), 'feedback_d7'); return doneScreen(added); }
      flow.next.disabled = false; flow.next.textContent = TEXT.send;
      if (j && j.status === 401) { return gotoSignin(); }
      showErr(TEXT.sendErr);
    }).catch(function () { busy = false; flow.next.disabled = false; flow.next.textContent = TEXT.send; showErr(TEXT.sendErr); });
  }

  function gotoSignin() { w.location.replace('/signin/?next=/first-1000/feedback'); }

  // ── start ──
  function start() {
    if (!WA.signedIn()) return gotoSignin();
    var go = function () {
      var m = WA.member();
      if (!m) return note(TEXT.noMemberTitle, TEXT.noMemberLine, TEXT.noMemberLink, '/first-1000');
      if (STAGE_OF[m.stage]) html.setAttribute('data-stage', m.stage);
      if (isDone(m, 'feedback_d7')) return note(TEXT.sentTitle, '', TEXT.app, '/app/');
      flow = buildFlow(); clear(); card.appendChild(flow.root); render(false);
    };
    // The phone's copy of her account may be old, so read it again before deciding. A failed read falls back to the copy.
    WA.sync(true).then(function () { if (!WA.signedIn()) return gotoSignin(); go(); }, go);
  }

  d.addEventListener('DOMContentLoaded', start);
})(window, document);
