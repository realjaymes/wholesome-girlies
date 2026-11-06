/* Wholesome Girlies: the First 1,000 landing page. The claim form, one step per screen, plus the page's live counter and "her program" details.
 *
 * It calls only WGAccess.first1000.status() (the counter) and WGAccess.first1000.claim(body) (the claim, which signs her in).
 * The server calls, the token and the first1000_claim event stay in wg-access.js. This file adds the account_created event the
 * old form sent, and one first1000_step event that carries only the step number.
 *
 * Her name, email and number live in this file's memory while she fills the form. They are never put in the URL, never saved to
 * localStorage or sessionStorage, and never sent to the dataLayer. All text is written with textContent or .value.
 *
 * Three looks share this flow (?look=a|b|c on the page, set on <html data-look>):
 *   a  the form sits in the hero card
 *   b  the form opens in a full-screen sheet on a phone and a modal on a computer, from every claim button
 *   c  the page opens on "Which stage are you in?"; her pick shows her program, then the steps
 */
(function (w, d) {
  'use strict';
  var WA = w.WGAccess;
  var html = d.documentElement;
  var LOOK = html.getAttribute('data-look') || 'b';

  var STAGES = [
    { key: 'relationships', who: 'Dating or in love', prog: 'The Wife Material Blueprint', cover: 'wife-material-cover', guide: 'tolu', gw: 392, gh: 620, name: 'Tolu', topic: 'dating' },
    { key: 'fertility', who: 'Trying for a baby', prog: 'The Trying-to-Conceive Blueprint', cover: 'trying-to-conceive-blueprint-cover', guide: 'amaka', gw: 255, gh: 569, name: 'Amaka', topic: 'trying for a baby' },
    { key: 'pregnancy', who: 'I am pregnant', prog: 'The First Pregnancy Plan', cover: 'first-pregnancy-plan-cover', guide: 'zainab', gw: 289, gh: 563, name: 'Zainab', topic: 'pregnancy' },
    { key: 'postpartum', who: 'I just gave birth', prog: 'The 6-Week Postpartum Reset', cover: 'postpartum-reset-cover', guide: 'funmi', gw: 293, gh: 569, name: 'Funmi', topic: 'the weeks after birth' },
    { key: 'parenting', who: 'I am raising children', prog: 'The First Baby Playbook', cover: 'first-baby-playbook-cover', guide: 'funmi', gw: 293, gh: 569, name: 'Funmi', topic: 'raising your baby' }
  ];
  var BY = {}; STAGES.forEach(function (s) { BY[s.key] = s; });
  var COUNTRIES = [
    ['Nigeria', '234'], ['United Kingdom', '44'], ['United States', '1'], ['Canada', '1'], ['Ghana', '233'], ['South Africa', '27'],
    ['Kenya', '254'], ['Ireland', '353'], ['United Arab Emirates', '971'], ['Germany', '49'], ['France', '33'], ['Netherlands', '31'], ['Australia', '61']
  ];
  var CONSENT = 'I agree that Wholesome Girlies keeps my stage and the steps I finish, to give me my program and send me emails about it. What I type into tools stays on my phone.';

  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function cover(s) { return '/assets/img/products/' + s.cover + '.webp'; }
  function guide(s) { return '/assets/img/cast/guides/' + s.guide + '.webp?v=20261009g'; }
  function push(o) { try { (w.dataLayer = w.dataLayer || []).push(o); } catch (e) {} }

  var qp = new URLSearchParams(location.search);
  var S = { stage: BY[qp.get('stage')] ? qp.get('stage') : '', name: '', email: '', country: 0, phone: '', consent: false, stageFixed: false };
  S.stageFixed = !!S.stage;
  var invite = qp.get('invite') || '';
  var full = false;

  /* ---------- her program: hero, programs section, html[data-stage] ---------- */
  function applyStage() {
    var st = BY[S.stage];
    if (st) html.setAttribute('data-stage', st.key); else html.removeAttribute('data-stage');
    html.classList.toggle('fx-has-stage', !!st);
    var her = $('[data-her]'), fan = $('[data-fan]');
    if (her) her.hidden = !st;
    if (fan) fan.hidden = !!st;
    if (st) {
      var c = $('[data-her-cover]'); c.src = cover(st); c.alt = st.prog + ' book cover';
      var g = $('[data-her-guide]'); g.src = guide(st); g.width = st.gw; g.height = st.gh; g.alt = 'Illustration of ' + st.name;
      $('[data-her-bubble]').textContent = 'Hi, I am ' + st.name + '. I will be your guide for ' + st.topic + '.';
    }
    // The programs section: hers first, marked.
    var box = $('[data-progs]');
    if (box) {
      var cards = $$('.fx-prog', box);
      cards.sort(function (a, b) { return order(a) - order(b); });
      function order(c) { var k = c.getAttribute('data-stage'); return k === S.stage ? -1 : STAGES.indexOf(BY[k]); }
      cards.forEach(function (c) {
        var mine = c.getAttribute('data-stage') === S.stage;
        c.classList.toggle('is-hers', mine);
        $('.here', c).hidden = !mine;
        box.appendChild(c);
      });
      syncTabs();
    }
    var line = $('[data-float-text]');
    if (line) line.textContent = st ? st.prog + ', free for a month' : 'Free for a month';
  }

  /* ---------- the programs tabs (look c) ---------- */
  var tabShown = '';
  function buildTabs() {
    var tabs = $('[data-tabs]'); if (!tabs) return;
    STAGES.forEach(function (s) {
      var b = el('button', 'fx-tab fx-st', s.who); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-stage', s.key);
      b.addEventListener('click', function () { tabShown = s.key; syncTabs(); });
      tabs.appendChild(b);
    });
    tabs.hidden = false;
  }
  function syncTabs() {
    var tabs = $('[data-tabs]'); if (!tabs || tabs.hidden) return;
    var on = tabShown || S.stage || STAGES[0].key;
    $$('.fx-tab', tabs).forEach(function (b) { var s = b.getAttribute('data-stage') === on; b.setAttribute('aria-selected', s ? 'true' : 'false'); b.classList.toggle('on', s); });
    $$('.fx-prog').forEach(function (c) { c.classList.toggle('tab-on', c.getAttribute('data-stage') === on); });
  }

  /* ---------- the counter ---------- */
  function counter() {
    WA.first1000.status().then(function (s) {
      if (!s) return;
      var left = s.left, taken = s.taken, open = s.open && left > 0;
      var total = (taken + left) || 1000;
      $$('[data-meter]').forEach(function (m) { m.hidden = false; });
      $$('[data-f1k-bar]').forEach(function (b) { b.style.width = Math.min(100, Math.round(taken / total * 100)) + '%'; });
      $$('[data-f1k-left]').forEach(function (b) { b.textContent = open ? String(left) : ''; });
      $$('[data-f1k-text]').forEach(function (t) { t.textContent = open ? ' of 1,000 places left. ' + taken + ' taken.' : 'All 1,000 places are taken.'; });
      if (!open) { full = true; html.classList.add('fx-full'); var t = $('[data-taken]'); if (t) t.hidden = false; closeSheet(); }
    });
  }

  /* ---------- the flow ---------- */
  var flow = null;   // { root, host, step, steps }
  var busy = false;

  function stepsList() { return S.stageFixed ? ['name', 'email', 'phone'] : ['stage', 'name', 'email', 'phone']; }

  function mount(host) {
    if (!flow) flow = buildFlow();
    host.textContent = ''; host.appendChild(flow.root); flow.host = host;
  }

  function buildFlow() {
    var root = el('form', 'ff'); root.noValidate = true; root.setAttribute('aria-label', 'Claim your place');
    var top = el('div', 'ff-top');
    var back = el('button', 'ff-back', '← Back'); back.type = 'button';
    var prog = el('div', 'ff-prog'); prog.setAttribute('role', 'progressbar'); prog.setAttribute('aria-valuemin', '1');
    var bar = el('i'); prog.appendChild(bar);
    var count = el('span', 'ff-count'); count.setAttribute('aria-live', 'polite');
    top.appendChild(back); top.appendChild(prog); top.appendChild(count);
    var body = el('div', 'ff-body');
    var err = el('div', 'ff-err'); err.setAttribute('role', 'alert'); err.setAttribute('aria-live', 'assertive');
    var next = el('button', 'btn btn-primary ff-next', 'Continue'); next.type = 'submit';
    var fine = el('p', 'fine ff-fine');
    root.appendChild(top); root.appendChild(body); root.appendChild(err); root.appendChild(next); root.appendChild(fine);
    var f = { root: root, top: top, back: back, prog: prog, bar: bar, count: count, body: body, err: err, next: next, fine: fine, step: 0, reveal: false, host: null };
    back.addEventListener('click', function () { goBack(); });
    root.addEventListener('submit', function (e) { e.preventDefault(); advance(); });
    return f;
  }

  function sendStep(n) { push({ event: 'first1000_step', first1000_step: n }); }

  function render(focus) {
    var f = flow, steps = stepsList(), id = steps[f.step], n = f.step + 1;
    f.err.textContent = ''; f.err.hidden = true;
    f.body.textContent = '';
    f.root.setAttribute('data-step', id);
    f.root.classList.toggle('is-reveal', f.reveal);
    f.count.textContent = f.reveal ? 'Your program' : 'Step ' + n + ' of ' + steps.length;
    f.prog.setAttribute('aria-valuemax', String(steps.length)); f.prog.setAttribute('aria-valuenow', String(n));
    f.prog.setAttribute('aria-valuetext', 'Step ' + n + ' of ' + steps.length);
    f.bar.style.width = (f.reveal ? 8 : Math.round(n / steps.length * 100)) + '%';
    f.back.hidden = f.step === 0 && !f.reveal && LOOK !== 'c';
    f.next.hidden = false; f.next.disabled = false;
    f.fine.textContent = 'No payment and no card. One place per email and per phone number.';
    var heading;
    if (f.reveal) heading = drawReveal(f);
    else if (id === 'stage') heading = drawStage(f);
    else if (id === 'name') heading = drawName(f);
    else if (id === 'email') heading = drawEmail(f);
    else heading = drawPhone(f);
    if (focus !== false) {
      var tgt = $('[data-focus]', f.body) || heading;
      if (tgt) { try { tgt.focus({ preventScroll: false }); } catch (e) { tgt.focus(); } }
    }
    if (focus !== false) sendStep(f.reveal ? 1 : n);
  }

  function heading(f, text, sub) {
    var h = el('h2', 'ff-q', text); h.tabIndex = -1; f.body.appendChild(h);
    if (sub) f.body.appendChild(el('p', 'ff-sub', sub));
    return h;
  }

  function herRow(f) {
    var st = BY[S.stage]; if (!st) return;
    var row = el('div', 'ff-her fx-st'); row.setAttribute('data-stage', st.key);
    var im = el('img'); im.src = guide(st); im.width = st.gw; im.height = st.gh; im.alt = 'Illustration of ' + st.name; row.appendChild(im);
    var tx = el('p'); tx.appendChild(el('small', '', 'Your program')); tx.appendChild(el('b', '', st.prog)); row.appendChild(tx);
    var ch = el('button', 'ff-change', 'Change'); ch.type = 'button';
    ch.addEventListener('click', function () { S.stageFixed = false; f.step = 0; f.reveal = false; render(); });
    row.appendChild(ch);
    f.body.appendChild(row);
  }

  function drawStage(f) {
    var h = heading(f, 'Which stage are you in?', 'Pick the one that fits today. You get that stage’s program.');
    var grid = el('div', 'ff-stages'); grid.setAttribute('role', 'radiogroup'); grid.setAttribute('aria-label', 'Your stage');
    STAGES.forEach(function (s) {
      var lab = el('label', 'ff-stage fx-st'); lab.setAttribute('data-stage', s.key);
      var inp = el('input'); inp.type = 'radio'; inp.name = 'stage'; inp.value = s.key; inp.checked = S.stage === s.key;
      var g = el('img', 'g'); g.src = guide(s); g.width = s.gw; g.height = s.gh; g.alt = ''; g.setAttribute('aria-hidden', 'true');
      var tx = el('span', 'tx'); tx.appendChild(el('b', '', s.who)); tx.appendChild(el('small', '', s.prog));
      var cv = el('img', 'c'); cv.src = cover(s); cv.width = 480; cv.height = 600; cv.alt = ''; cv.setAttribute('aria-hidden', 'true');
      lab.appendChild(inp); lab.appendChild(g); lab.appendChild(tx); lab.appendChild(cv);
      inp.addEventListener('click', function () { pickStage(s.key); });
      grid.appendChild(lab);
    });
    f.body.appendChild(grid);
    f.next.hidden = true;
    return h;
  }

  function pickStage(key) {
    S.stage = key; applyStage();
    if (LOOK === 'c') { flow.reveal = true; setTimeout(function () { render(); }, 160); return; }
    setTimeout(function () { flow.step = 1; render(); }, 160);
  }

  function drawReveal(f) {
    var st = BY[S.stage]; f.back.hidden = false;
    var wrap = el('div', 'ff-reveal fx-st'); wrap.setAttribute('data-stage', st.key);
    var im = el('img', 'cv'); im.src = cover(st); im.width = 480; im.height = 600; im.alt = st.prog + ' book cover';
    var tx = el('div', 'tx');
    var h = el('h2', 'ff-q', st.prog); h.tabIndex = -1;
    tx.appendChild(el('p', 'who', 'Your program'));
    tx.appendChild(h);
    tx.appendChild(el('p', 'ff-sub', 'Free for a month, and you can earn up to 12 months by using it.'));
    var g = el('div', 'gd'); var gi = el('img'); gi.src = guide(st); gi.width = st.gw; gi.height = st.gh; gi.alt = 'Illustration of ' + st.name; g.appendChild(gi);
    g.appendChild(el('p', 'fx-bubble', 'Hi, I am ' + st.name + '. I will be your guide for ' + st.topic + '.'));
    wrap.appendChild(im); wrap.appendChild(tx); wrap.appendChild(g);
    f.body.appendChild(wrap);
    f.next.textContent = 'Claim my place →';
    return h;
  }

  function field(f, id, label, type, attrs, hint) {
    var wrap = el('div', 'ff-field');
    var lab = el('label', 'ff-label', label); lab.htmlFor = id;
    var inp = el('input'); inp.id = id; inp.type = type; inp.className = 'ff-input';
    for (var k in attrs) inp.setAttribute(k, attrs[k]);
    inp.setAttribute('data-focus', '1');
    wrap.appendChild(lab); wrap.appendChild(inp);
    if (hint) { var hi = el('p', 'ff-hint', hint); hi.id = id + 'Hint'; wrap.appendChild(hi); inp.setAttribute('aria-describedby', id + 'Hint'); }
    f.body.appendChild(wrap);
    return inp;
  }

  function drawName(f) {
    herRow(f);
    var h = heading(f, 'What should we call you?');
    var inp = field(f, 'fxName', 'Your first name', 'text', { autocomplete: 'given-name', maxlength: '30', autocapitalize: 'words', enterkeyhint: 'next' });
    inp.value = S.name; inp.addEventListener('input', function () { S.name = inp.value; });
    f.next.textContent = 'Continue'; return h;
  }
  function drawEmail(f) {
    herRow(f);
    var h = heading(f, 'What is your email?');
    var inp = field(f, 'fxEmail', 'Your email', 'email', { autocomplete: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'next' }, 'This is how you sign in. One place per email.');
    inp.value = S.email; inp.addEventListener('input', function () { S.email = inp.value; });
    f.next.textContent = 'Continue'; return h;
  }
  function drawPhone(f) {
    herRow(f);
    var h = heading(f, 'And your WhatsApp number?');
    var wrap = el('div', 'ff-field');
    var lab = el('label', 'ff-label', 'WhatsApp number'); lab.htmlFor = 'fxPhone';
    var row = el('div', 'ff-phone');
    var sel = el('select', 'ff-input ff-cc'); sel.id = 'fxCc'; sel.setAttribute('aria-label', 'Country code');
    COUNTRIES.forEach(function (c, i) { var o = el('option', '', c[0] + ' +' + c[1]); o.value = String(i); sel.appendChild(o); });
    sel.value = String(S.country); sel.addEventListener('change', function () { S.country = +sel.value; });
    var inp = el('input', 'ff-input'); inp.id = 'fxPhone'; inp.type = 'tel'; inp.setAttribute('autocomplete', 'tel-national'); inp.setAttribute('inputmode', 'tel'); inp.setAttribute('placeholder', '0812 000 0000'); inp.setAttribute('data-focus', '1');
    inp.value = S.phone; inp.addEventListener('input', function () { S.phone = inp.value; });
    row.appendChild(sel); row.appendChild(inp);
    wrap.appendChild(lab); wrap.appendChild(row);
    var hi = el('p', 'ff-hint', 'One place per phone number.'); hi.id = 'fxPhoneHint'; inp.setAttribute('aria-describedby', 'fxPhoneHint'); wrap.appendChild(hi);
    f.body.appendChild(wrap);
    var cl = el('label', 'ff-consent');
    var cb = el('input'); cb.type = 'checkbox'; cb.id = 'fxConsent'; cb.checked = S.consent; cb.addEventListener('change', function () { S.consent = cb.checked; });
    var sp = el('span'); sp.appendChild(d.createTextNode(CONSENT + ' '));
    var a = el('a', '', 'Health data'); a.href = '/legal/consumer-health-data'; a.target = '_blank'; a.rel = 'noopener'; sp.appendChild(a);
    cl.appendChild(cb); cl.appendChild(sp); f.body.appendChild(cl);
    f.next.textContent = 'Claim my place';
    return h;
  }

  /* ---------- checks and moves ---------- */
  function showErr(msg, where, link) {
    var f = flow; f.err.textContent = ''; f.err.hidden = false;
    f.err.appendChild(d.createTextNode(msg));
    if (link) { f.err.appendChild(d.createTextNode(' ')); f.err.appendChild(link); }
    $$('.ff-input', f.body).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    var t = where && $(where, f.body);
    if (t) { t.setAttribute('aria-invalid', 'true'); try { t.focus(); } catch (e) {} }
  }
  function signInLink(text) { var a = el('a', 'ff-link', text || 'Sign in'); a.href = '/signin/?next=' + encodeURIComponent('/first-1000/'); return a; }

  function nationalDigits() {
    var c = COUNTRIES[S.country], cc = c[1], n = S.phone.replace(/\D/g, '');
    if (n.indexOf('00') === 0) n = n.slice(2);
    if (n.indexOf(cc) === 0 && n.length >= cc.length + 9) n = n.slice(cc.length);
    else if (n.charAt(0) === '0') n = n.slice(1);
    return n;
  }
  function phoneOk() {
    var n = nationalDigits();
    return S.country === 0 ? n.length === 10 : n.length >= 6 && n.length <= 12;
  }

  function check(id) {
    if (id === 'stage') return BY[S.stage] ? '' : 'Pick the stage you are in.';
    if (id === 'name') { var n = S.name.trim().replace(/\s+/g, ' '); S.name = n; return n.length >= 2 ? '' : 'Type your first name.'; }
    if (id === 'email') { S.email = S.email.trim(); return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(S.email) ? '' : 'Check your email. It should look like name@example.com.'; }
    if (id === 'phone') {
      if (!phoneOk()) return S.country === 0 ? 'Check your number. A Nigerian number has 11 digits, like 0812 000 0000.' : 'Check your number. Type it without the country code.';
      if (!S.consent) return 'Tick the box to say you agree, and we will save your place.';
    }
    return '';
  }
  var WHERE = { stage: '.ff-stage input', name: '#fxName', email: '#fxEmail', phone: '#fxPhone' };

  function advance() {
    if (busy) return;
    var f = flow;
    if (f.reveal) { f.reveal = false; f.step = stepsList().indexOf('name'); render(); return; }
    var id = stepsList()[f.step], m = check(id);
    if (m) { var w2 = WHERE[id]; if (id === 'phone' && !phoneOk()) w2 = '#fxPhone'; else if (id === 'phone') w2 = '#fxConsent'; return showErr(m, w2); }
    if (id !== 'phone') { f.step++; render(); return; }
    submit();
  }
  function goBack() {
    var f = flow; if (busy) return;
    if (!f.reveal && f.step === 0 && LOOK === 'c') { f.reveal = true; render(); return; }
    if (f.reveal) { f.reveal = false; f.step = 0; S.stageFixed = false; render(); return; }
    if (f.step > 0) {
      f.step--;
      if (LOOK === 'c' && stepsList()[f.step] === 'stage') { f.reveal = true; }
      render();
    }
  }

  function gotoStep(id) { flow.reveal = false; flow.step = Math.max(0, stepsList().indexOf(id)); render(false); }

  function submit() {
    var f = flow, btn = f.next;
    busy = true; btn.disabled = true; btn.textContent = 'Saving your place...'; f.err.hidden = true;
    var wa = '+' + COUNTRIES[S.country][1] + ' ' + nationalDigits();
    var body = { name: S.name, email: S.email.toLowerCase(), whatsapp: wa, stage: S.stage, consent: true };
    if (invite) body.invite = invite;
    function done() { busy = false; btn.disabled = false; btn.textContent = 'Claim my place'; }
    WA.first1000.claim(body).then(function (j) {
      j = j || {};
      if (j.ok) { try { WA.push('account_created', { account_surface: 'first_1000' }); } catch (e) {} btn.textContent = 'Done. Opening your program...'; location.href = '/first-1000/welcome'; return; }
      done();
      var r = j.error || j.reason || '';
      if (r === 'full' || r === 'closed') { full = true; html.classList.add('fx-full'); var t = $('[data-taken]'); if (t) t.hidden = false; closeSheet(); return; }
      if (r === 'already_claimed' || r === 'exists' || r === 'duplicate') { gotoStep('email'); return showErr('This email already has a place. Sign in with it to open your program.', '#fxEmail', signInLink('Sign in')); }
      if (r === 'sign_in_first') { gotoStep('email'); return showErr('This email already has an account. Sign in with it first, then claim your place.', '#fxEmail', signInLink('Sign in first')); }
      if (r === 'phone_used') { gotoStep('phone'); return showErr('This number already has a place. Use another WhatsApp number, or sign in with the email you used.', '#fxPhone', signInLink('Sign in')); }
      if (r === 'slow_down' || j.status === 429) return showErr('Too many tries from this connection. Wait a few minutes, then try again.');
      if (r === 'invalid') return showErr('Something in your details did not save. Go back, check each answer, and try again.');
      showErr('We could not save your place. Try again in a moment.');
    }).catch(function () {
      done(); showErr('We could not reach Wholesome Girlies. Check your internet connection and try again.');
    });
  }

  /* ---------- the sheet (look b) and the claim buttons ---------- */
  var sheet = null;
  function openSheet() {
    if (full || !sheet) return;
    mount($('[data-flow-host="sheet"]'));
    if (!sheet.open) { if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', ''); }
    html.classList.add('fx-sheet-open');
    render();
  }
  function closeSheet() {
    if (sheet && sheet.open) { try { sheet.close(); } catch (e) { sheet.removeAttribute('open'); } }
    html.classList.remove('fx-sheet-open');
  }

  function claimClick() {
    if (full) return;
    if (LOOK === 'b') { openSheet(); return; }
    var host = $('[data-flow-host="inline"]');
    host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var t = $('[data-focus], .ff-stage input, .ff-next', host);
    setTimeout(function () { try { (t || host).focus({ preventScroll: true }); } catch (e) {} }, 350);
  }

  /* ---------- the floating claim bar (look b, phones) ---------- */
  function floatBar() {
    var bar = $('[data-floatbar]'); if (!bar || LOOK !== 'b' || !('IntersectionObserver' in w)) return;
    var seen = { cta: true, foot: false, final: false };
    function sync() { bar.hidden = full || seen.cta || seen.foot || seen.final || html.classList.contains('fx-sheet-open'); }
    function watch(el2, k) { if (!el2) return; new IntersectionObserver(function (es) { seen[k] = es[0].isIntersecting; sync(); }).observe(el2); }
    watch($('.fx-cta'), 'cta'); watch($('#final'), 'final'); watch($('footer.site-footer, .wg-app-foot'), 'foot');
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  function init() {
    if (!WA) { return; }
    sheet = $('#fxSheet');
    applyStage();
    if (LOOK === 'c') buildTabs();
    $$('[data-claim]').forEach(function (b) { b.addEventListener('click', claimClick); });
    $$('[data-sheet-close]').forEach(function (b) { b.addEventListener('click', closeSheet); });
    if (sheet) {
      sheet.addEventListener('close', function () { html.classList.remove('fx-sheet-open'); });
      sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    }
    if (LOOK !== 'b') {
      mount($('[data-flow-host="inline"]'));
      if (LOOK === 'c' && S.stage) flow.reveal = true;
      render(false);
    }
    floatBar();
    counter();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
