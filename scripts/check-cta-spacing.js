// Measures the vertical spacing around every call-to-action button on the site and the app, and fails when a gap
// is off the shared tokens (--cta-above, --cta-below, --cta-stack in assets/css/styles.css) by more than 2px.
//
//   text above a button      --cta-above   (the gap from the block above to the button)
//   text below a button      --cta-below   (the gap from the button to the small line under it)
//   between buttons          --cta-stack   (stacked buttons, and buttons side by side in a row)
//
// Pages: every page the site serves at 390 wide (phone), the app and tool pages again in the states that show cards
// (signed out, the First 100 offer open, paused full, no count, a buyer, a member, a streak sheet), and a spot check at 1280.
// Needs the site running and puppeteer-core:
//   NODE_PATH=/tmp/wgog/node_modules WG_PORT=8007 node scripts/check-cta-spacing.js
// Options: WG_SAMPLE=5 measures every 5th page (the pre-push hook does, for speed; the states always run in full); WG_ALL=1 also measures every result page (default: one result page per tool); WG_TOL=2 changes the 2px allowance;
// CTA_REPORT=1 prints the table and always exits 0 (used to take the before numbers).
const fs = require('fs');
const path = require('path');
const T = require('./lib-wgtest.js');
const { wait, plus, open } = T;

const ROOT = path.join(__dirname, '..');
const TOL = +(process.env.WG_TOL || 2);
const REPORT_ONLY = !!process.env.CTA_REPORT;

// ── every page the site serves ──
function pages() {
  const urls = [];
  const seenResult = new Set();
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.name.startsWith('.') || f.name.startsWith('_') || ['node_modules', 'functions', 'scripts', 'assets', 'lab', 'manifests'].includes(f.name)) continue;
      const full = path.join(dir, f.name);
      if (f.isDirectory()) { walk(full); continue; }
      if (!f.name.endsWith('.html')) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (/^(branding-options|logo-options|offline|404)\.html$/.test(rel)) continue;
      let url = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
      const m = /^(.*\/result)\//.exec(url);
      if (m && !process.env.WG_ALL) { if (seenResult.has(m[1])) continue; seenResult.add(m[1]); }
      urls.push(url);
    }
  })(ROOT);
  return urls.sort();
}

// ── seeds, the same shapes the existing tests use ──
const st = (cap, taken) => ({ ok: true, taken, cap, left: cap - taken, open: cap - taken > 0 });
const OPEN = { '/first1000/status': st(100, 23), '/subscribe': { ok: true } };
const FULL = { '/first1000/status': st(100, 100), '/subscribe': { ok: true } };
const NOCOUNT = { '/first1000/status': { ok: false }, '/subscribe': { ok: true } };
const FLAG = { u: '/programs/first-pregnancy-plan/thank-you', l: 'Home' };
const BUYER = { wg_pregnancy_home: FLAG };
const account = (extra) => Object.assign({ email: 'ada@example.com', name: '', programs: [], member: undefined }, extra);
const signed = (acc) => ({ seed: { wg_session_v1: JSON.stringify({ token: 'tok123' }), wg_account_v1: { v: 1, at: Date.now(), account: acc, saved: [] } }, route: { '/account': { ok: true, account: acc, state: {} } } });
const memberAcc = account({ member: { stage: 'pregnancy', ends: plus(200) + 'T00:00:00Z', steps: {}, invite: 'ABC' } });
const MEM = signed(memberAcc);
const SBUYER = signed(account({ programs: [{ slug: 'first-pregnancy-plan', home: 'https://wholesomegirlies.xyz/programs/first-pregnancy-plan/thank-you' }] }));
const STREAK = (o) => ({ wg_streak_v1: Object.assign({ v: 1, count: 0, best: 0, last_day: '', rest_used_week: null, milestones: [] }, o) });
const UI = (o) => ({ wg_streak_ui_v1: Object.assign({ v: 1, rule: plus(-3), first: plus(-3), days: [] }, o) });
const join = (...rs) => Object.assign({}, ...rs);

const TOOL = '/pregnancy/tools/hospital-bag-checklist';
const STATES = [ // [label, url, seed, route, wait, width]
  ['tool: offer open', TOOL, {}, OPEN],
  ['tool: paused full', TOOL, {}, FULL],
  ['tool: no count (paid card)', TOOL, {}, NOCOUNT],
  ['tool: buyer', TOOL, BUYER, OPEN],
  ['tool: member', TOOL, MEM.seed, join(OPEN, MEM.route)],
  ['tool: streak milestone sheet', TOOL, join(STREAK({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) })), OPEN],
  ['tool: streak sheet, member', TOOL, join(STREAK({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) }), MEM.seed), join(OPEN, MEM.route)],
  ['tool: streak sheet, buyer', TOOL, join(STREAK({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) }), BUYER), OPEN],
  ['tool: stage date saved', '/pregnancy/tools/due-date-calculator', { wg_stage_pregnancy_v1: { v: 1, due: plus(10) } }, OPEN, 1500],
  ['relationships tool: offer open', '/relationships/tools/is-he-husband-material', {}, OPEN],
  ['app: signed out, offer open', '/app/', {}, OPEN, 1800],
  ['app: paused full', '/app/', {}, FULL, 1800],
  ['app: no count', '/app/', {}, NOCOUNT, 1800],
  ['app: buyer', '/app/', BUYER, OPEN, 1800],
  ['app: member', '/app/', MEM.seed, join(OPEN, MEM.route), 1800],
  ['app: signed-in buyer', '/app/', SBUYER.seed, join(OPEN, SBUYER.route), 1800],
  ['app: installed, streak card', '/app/?preview=installed', STREAK({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), OPEN, 1500],
  ['app: installed, streak ended', '/app/?preview=installed', STREAK({ count: 8, best: 8, last_day: plus(-5) }), OPEN, 1500],
  ['app: installed, no streak', '/app/?preview=installed', {}, OPEN, 1500],
  ['app: installed, rule card', '/app/?preview=installed', join(STREAK({ count: 6, best: 6, last_day: plus(-1) }), { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) } }, UI({ days: [1, 2, 3, 4, 5, 6] })), OPEN, 1500],
  ['app: stage date, pregnant', '/app/', { wg_stage_pregnancy_v1: { v: 1, due: plus(120) } }, OPEN, 1800],
  ['app: stage card, buyer', '/app/', join({ wg_stage_pregnancy_v1: { v: 1, due: plus(10) } }, BUYER), OPEN, 1800],
  ['app: install offer now', '/app/', { wg_install_test_v1: { v: 1, g: 'now', s: 'x' } }, OPEN, 1800],
  ['first: offer open', '/first/', {}, OPEN, 1800],
  ['first: paused full', '/first/', {}, FULL, 1800],
  ['first: one place left', '/first/', {}, { '/first1000/status': st(100, 99), '/subscribe': { ok: true } }, 1800],
  ['first: no count', '/first/', {}, NOCOUNT, 1800],
  ['first: stage preselected', '/first/?stage=pregnancy', {}, OPEN, 1800],
  ['first: waiting list joined', '/first/', { wg_capture_v1: { v: 1, lists: ['f1k_waitlist'], bar: 0 } }, FULL, 1800],
  ['first: welcome', '/first/welcome', {}, OPEN, 1200],
  ['first: feedback, member', '/first/feedback', MEM.seed, join(OPEN, MEM.route), 1800],
  ['program home: buyer', '/programs/first-pregnancy-plan/thank-you', join(BUYER, { wg_read_ok: 1 }), OPEN, 1500],
  ['program reader: buyer', '/programs/first-pregnancy-plan/read', BUYER, OPEN, 1500],
  ['tools hub: played', '/tools/', { wg_played_v1: {} }, OPEN, 1200],
  ['tools hub: streak', '/tools/', STREAK({ count: 4, best: 4, last_day: plus(-1), milestones: [3] }), OPEN, 1200],
  ['signin: member', '/signin/', MEM.seed, join(OPEN, MEM.route), 1200],
  ['wide app: offer open', '/app/', {}, OPEN, 1800, 1280],
  ['wide app: member', '/app/', MEM.seed, join(OPEN, MEM.route), 1800, 1280],
  ['wide tool: offer open', TOOL, {}, OPEN, 900, 1280],
  ['wide first: offer open', '/first/', {}, OPEN, 1800, 1280],
  ['wide tool: streak sheet', TOOL, join(STREAK({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) })), OPEN, 900, 1280],
];
const WIDE_PAGES = ['/', '/tools/', '/pregnancy/guides/', '/programs/first-pregnancy-plan', '/about/', '/signin/', '/relationships/tools/is-he-husband-material'];

// ── the measurement, run inside the page ──
function measureInPage() {
  const CTA = '.btn, a.btn, button.btn, .wg-app-btn, .signin-btn, .fx-cta, .wg-mine-btn, .app-btns > *, .wg-app-btns > *, .tl-btns > *, .hub-ctas > *';
  const SKIP = 'header, nav, footer, .sticky-cta, #wg-app-nav, .wg-pill, .wgc-x, [class*="cm__"], [class*="pm__"], [id*="cm"], .nav-cta, .nav-stages-btn, [aria-hidden="true"]';
  const cs = (e) => getComputedStyle(e);
  const rectOf = (e) => e.getBoundingClientRect();
  const shown = (e) => { const r = rectOf(e); const c = cs(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.opacity !== '0'; };
  const isBox = (e) => { const c = cs(e); return ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(c['border' + s + 'Width']) > 0 && c['border' + s + 'Style'] !== 'none') || (c.backgroundColor !== 'rgba(0, 0, 0, 0)' && c.backgroundColor !== 'transparent') || c.boxShadow !== 'none'; };
  const flat = (s) => s.replace(/\s+/g, '');
  const ctaOnly = (c) => {
    if (c.matches(CTA)) return true;
    const inner = [...c.querySelectorAll(CTA)].filter(shown);
    return inner.length > 0 && !hasField(c) && flat(c.innerText || '') === flat(inner.map((x) => x.innerText).join(''));
  };
  const hasField = (c) => !!(c.matches('input, select, textarea, label') || c.querySelector('input:not([type=hidden]), select, textarea'));
  const SKIPTAG = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|LINK|META)$/;
  const present = (n) => {
    if (n.nodeType === 8) return null;
    if (n.nodeType === 3) {
      if (!n.textContent.trim()) return null;
      const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
      return b.height ? { top: b.top, bottom: b.bottom, left: b.left, right: b.right, text: true } : null;
    }
    if (n.nodeType !== 1 || SKIPTAG.test(n.tagName) || n.tagName === 'BR') return null;
    const c = cs(n);
    if (c.position === 'absolute' || c.position === 'fixed' || c.display === 'none') return null;
    if (!shown(n)) return null;
    const r = rectOf(n);
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, el: n };
  };
  const label = (u) => {
    for (let p = u.parentElement; p && p !== document.body; p = p.parentElement) {
      const cl = [...p.classList].filter((x) => !/^(container|wrap|inner|content|row|col)$/.test(x));
      if (cl.length && (isBox(p) || p.id || /card|cta|sheet|hero|wgs|wgi|wgc|fx-/.test(p.className))) return (p.tagName === 'SECTION' ? 'section' : '') + '.' + cl[0];
    }
    for (let p = u.parentElement; p && p !== document.body; p = p.parentElement) if (p.classList.length) return '.' + p.classList[0];
    return 'body';
  };
  const out = [];
  const units = new Set();
  [...document.querySelectorAll(CTA)].forEach((el) => {
    if (!shown(el) || el.closest(SKIP) || el.disabled && false) return;
    // climb to the wrapper that holds only buttons (a row of buttons, a wrapping paragraph)
    let u = el;
    while (u.parentElement && u.parentElement !== document.body) {
      const p = u.parentElement;
      if (isBox(p) || p.matches('section, main, article, form, li')) break;
      if ([...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) break;
      if ([...p.children].some((c) => c !== u && shown(c) && !ctaOnly(c) && cs(c).position !== 'absolute')) break;
      u = p;
    }
    if (units.has(u)) return;
    units.add(u);
    const r = rectOf(u);
    const comp = label(u);
    const name = (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    // the neighbour before
    let n = u.previousSibling, prev = null, hid = false;
    while (n && !(prev = present(n))) { if (n.nodeType === 1 && !SKIPTAG.test(n.tagName)) hid = true; n = n.previousSibling; }
    if (hid) prev = null; // a hidden block sits between: the space belongs to the section, not to the button
    if (prev && prev.el && (prev.el.matches('section, header, footer, hr, nav, main') || (isBox(prev.el) && !hasField(prev.el) && !ctaOnly(prev.el)))) prev = null;
    if (prev) {
      const overlapY = prev.top < r.bottom - 1 && prev.bottom > r.top + 1;
      if (overlapY) {
        const g = r.left - prev.right; if (g >= -1 && prev.el && ctaOnly(prev.el)) out.push({ kind: 'row', gap: Math.round(g * 10) / 10, comp, name });
        // side by side, both should start at the same height; a margin on one of them pushes it down
        if (g >= -1 && prev.el && ctaOnly(prev.el) && Math.abs(r.top - prev.top) > 2 && Math.abs(r.bottom - prev.bottom) > 2 && Math.abs((r.bottom - r.top) - (prev.bottom - prev.top)) < 2) out.push({ kind: 'misaligned', gap: Math.round(Math.abs(r.top - prev.top) * 10) / 10, comp, name });
      }
      else {
        const g = r.top - prev.bottom;
        if (g >= -1 && prev.el && ctaOnly(prev.el)) out.push({ kind: 'stack', gap: Math.round(g * 10) / 10, comp, name });
        else if (g >= -1) out.push({ kind: (prev.el && hasField(prev.el)) ? 'field' : 'above', gap: Math.round(g * 10) / 10, comp, name });
      }
    }
    // the neighbour after (a following button is counted from that button's side)
    let m = u.nextSibling, next = null, hid2 = false;
    while (m && !(next = present(m))) { if (m.nodeType === 1 && !SKIPTAG.test(m.tagName)) hid2 = true; m = m.nextSibling; }
    if (hid2) next = null;
    if (next && next.el && (next.el.matches('section, header, footer, hr, nav, main') || (isBox(next.el) && !ctaOnly(next.el)))) next = null;
    if (next && !(next.el && ctaOnly(next.el))) {
      const overlapY = next.top < r.bottom - 1 && next.bottom > r.top + 1;
      const g = next.top - r.bottom;
      if (!overlapY && g >= -1) out.push({ kind: 'below', gap: Math.round(g * 10) / 10, comp, name });
    }
  });
  const root = cs(document.documentElement);
  const tok = {};
  ['--cta-above', '--cta-below', '--cta-stack'].forEach((k) => { const v = parseFloat(root.getPropertyValue(k)); tok[k] = isNaN(v) ? null : v; });
  return { found: out, tok };
}

const FAR = 64; // a gap this big is a section break, not text next to a button
const TOKEN_OF = { above: '--cta-above', below: '--cta-below', stack: '--cta-stack', row: '--cta-stack', field: '--cta-above', misaligned: '--cta-zero' };

(async () => {
  try { await fetch(T.B + '/'); } catch (e) { console.log('check-cta-spacing: the site is not running on ' + T.B + ', skipped (start python3 serve.py <port> and set WG_PORT).'); process.exit(0); }
  const rows = [], bad = [], errors = [];
  let tokens = null, measured = 0;
  await T.launch();
  const jobs = [];
  pages().filter((u, i) => i % (+process.env.WG_SAMPLE || 1) === 0 && (!process.env.WG_ONLY || u.includes(process.env.WG_ONLY))).forEach((u) => jobs.push({ state: 'sweep: offer open', url: u, seed: {}, route: OPEN, wait: 700, width: 390 }));
  if (!process.env.WG_ONLY) STATES.forEach(([state, url, seed, route, w, width]) => jobs.push({ state, url, seed, route, wait: w || 900, width: width || 390 }));
  if (!process.env.WG_ONLY) WIDE_PAGES.forEach((u) => jobs.push({ state: 'wide sweep: offer open', url: u, seed: {}, route: OPEN, wait: 700, width: 1280 }));
  for (const j of jobs) {
    let t;
    try {
      t = await open(j.seed, j.url, { route: j.route, wait: j.wait, width: j.width });
      const res = await t.page.evaluate(measureInPage);
      measured++;
      if (!tokens && res.tok['--cta-above'] != null) tokens = res.tok;
      res.found.forEach((f) => { f.page = j.url; f.state = j.state + (j.width > 600 ? '' : ''); rows.push(f); });
    } catch (e) { errors.push(j.url + ' (' + j.state + '): ' + e.message); }
    finally { if (t) await t.close().catch(() => {}); }
  }
  try { await T.getBrowser().close(); } catch (e) {}

  // ── the table, grouped by component ──
  const groups = {};
  rows.forEach((r) => { const k = r.kind + '  ' + r.comp; (groups[k] = groups[k] || []).push(r); });
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  console.log(`Measured ${measured} page states, ${rows.length} gaps. Tokens: ${tokens ? JSON.stringify(tokens) : 'none yet'}`);
  console.log('\nkind   component                          n    min  med  max   values (count)');
  Object.keys(groups).sort().forEach((k) => {
    const g = groups[k].filter((r) => r.gap <= FAR);
    if (!g.length) return;
    const vals = {}; g.forEach((r) => { const v = Math.round(r.gap); vals[v] = (vals[v] || 0) + 1; });
    const gaps = g.map((r) => r.gap);
    const [kind, comp] = [k.split('  ')[0], k.split('  ').slice(1).join('  ')];
    console.log(kind.padEnd(6) + ' ' + comp.slice(0, 32).padEnd(33) + String(g.length).padStart(4) + '  ' + String(Math.min(...gaps)).padStart(4) + ' ' + String(med(gaps)).padStart(4) + ' ' + String(Math.max(...gaps)).padStart(4) + '   ' + Object.keys(vals).map(Number).sort((a, b) => a - b).map((v) => v + 'px(' + vals[v] + ')').join(' '));
  });
  (process.env.CTA_DUMP || '').split(';').filter(Boolean).forEach((spec) => { // CTA_DUMP="above .card;below .tool-app" lists the buttons behind rows of the table
    const [dk, ...dc] = spec.split(' '); const seen = {};
    rows.filter((r) => r.kind === dk && r.comp === dc.join(' ') && r.gap <= FAR).forEach((r) => { const k = r.gap + 'px  "' + r.name + '"'; (seen[k] = seen[k] || []).push(r.page + ' [' + r.state + ']'); });
    console.log('\n== ' + spec); Object.keys(seen).forEach((k) => console.log('  ' + k + '  x' + seen[k].length + '  e.g. ' + seen[k][0]));
  });
  const byKind = {};
  rows.filter((r) => r.gap <= FAR).forEach((r) => { const v = Math.round(r.gap); byKind[r.kind] = byKind[r.kind] || {}; byKind[r.kind][v] = (byKind[r.kind][v] || 0) + 1; });
  console.log('\nMost common gap per kind:');
  Object.keys(byKind).forEach((k) => console.log('  ' + k.padEnd(6) + Object.entries(byKind[k]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v, c]) => v + 'px x' + c).join(', ')));
  if (errors.length) { console.log('\nPages that could not be measured:'); errors.forEach((e) => console.log('  ' + e)); }

  // ── the check ──
  if (!tokens) { console.log('\nNo --cta-* tokens found on :root, so nothing to enforce.'); process.exit(REPORT_ONLY ? 0 : 1); }
  rows.forEach((r) => {
    if (r.gap > FAR) return;
    const want = r.kind === 'misaligned' ? 0 : tokens[TOKEN_OF[r.kind]];
    if (want == null || Math.abs(r.gap - want) > TOL) bad.push({ ...r, want });
  });
  if (REPORT_ONLY) process.exit(0);
  if (bad.length || errors.length) {
    const seen = new Set();
    console.log(`\nFAIL  ${bad.length} gap(s) off the tokens by more than ${TOL}px:`);
    bad.forEach((b) => { const k = [b.page, b.state, b.comp, b.kind, b.gap].join('|'); if (seen.has(k)) return; seen.add(k); console.log(`  ${b.page}  [${b.state}]  ${b.comp}  ${b.kind} gap ${b.gap}px, wanted ${b.want}px  ("${b.name}")`); });
    process.exit(1);
  }
  console.log(`\nPASS  every CTA gap is within ${TOL}px of the tokens (${rows.filter((r) => r.gap <= FAR).length} gaps, ${measured} page states).`);
})();
