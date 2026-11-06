// Tests "One next action for every woman" (vault: Site & App note 07, the site-wide surface table). It seeds each state a woman can be in
// (visitor, engaged, known, buyer, bundle owner, campaign member, buyer and member, lapsed member), loads each surface, and checks that the
// surface shows exactly the action in the table, never two offers, never an offer for a program she owns, no price, and that the analytics
// call (next_action_shown) carries the right surface, state and action. It also checks the offer slot falls back to the paid program when
// the campaign is paused or full, that quiet pages show no offer to anyone, and that every page the rule book classifies is in the table.
// The payment server is answered locally and the analytics hosts are blocked, so dataLayer pushes are recorded in window.__dl (lib-wgtest.js).
// Needs the site on :8008 (python3 serve.py 8008) or WG_PORT.
//   WG_PORT=8008 NODE_PATH=/tmp/wgog/node_modules node scripts/test-next.js
const fs = require('fs'), path = require('path');
const T = require('./lib-wgtest.js');
const { ok, wait, open, text, out, errs } = T;

const ROOT = path.join(__dirname, '..');
const ends = (d) => new Date(Date.now() + d * 864e5).toISOString();
const PREG = { u: '/programs/first-pregnancy-plan/thank-you', l: 'Pregnancy home' };
const TTC = { u: '/programs/trying-to-conceive-blueprint/thank-you', l: 'Conception home' };
const BUNDLE = { u: '/programs/complete-motherhood-journey/thank-you', l: 'Complete Motherhood Journey' };
const gift = (flag, e) => Object.assign({}, flag, { gift: true, ends: e });
const acct = (programs, member) => ({ wg_session_v1: 'tok', wg_account_v1: { v: 1, at: Date.now(), account: { email: 'ada@example.com', name: 'Ada', programs, member: member || undefined }, saved: [] } });
const picked = { wg_streak_ui_v1: { v: 1, stage: 'pregnancy' } };
const E20 = ends(20), PAST = ends(-3);
const member = (e) => Object.assign({ wg_pregnancy_home: gift(PREG, e) }, acct([{ slug: 'first-pregnancy-plan', home: PREG.u, ends: e }], { stage: 'pregnancy', ends: e, steps: { claim: ends(-2) } }));
const STATES = {
  visitor: picked,
  engaged: { wg_stage_pregnancy_v1: { v: 1, due: T.plus(120) } },
  known: { wg_stage_pregnancy_v1: { v: 1, due: T.plus(120) }, wg_capture_v1: { v: 1, lists: ['games'], bar: 0 } },
  buyer: { wg_pregnancy_home: PREG },
  bundle: { wg_fertility_home: BUNDLE, wg_pregnancy_home: BUNDLE, wg_pp_home: BUNDLE, wg_parenting_home: BUNDLE },
  member: member(E20),
  both: (() => { const m = member(E20); m.wg_fertility_home = TTC; m.wg_account_v1.account.programs.push({ slug: 'trying-to-conceive-blueprint', home: TTC.u }); return m; })(),
  lapsed: member(PAST)
};
const OWNERS = ['member', 'buyer', 'bundle', 'both'];
const st = (cap, taken) => ({ ok: true, taken, cap, left: cap - taken, open: cap - taken > 0 });
const MODES = { open: st(100, 40), paused: { ok: true, taken: 40, cap: 100, left: 60, open: false }, full: st(100, 100) };
const PRE = '(function(){window.__dl=[];var dl=window.dataLayer=window.dataLayer||[];var o=dl.push.bind(dl);dl.push=function(){for(var i=0;i<arguments.length;i++)window.__dl.push(arguments[i]);return o.apply(dl,arguments);};})();';

// The table (note 07). `offerAt` is the action an unowned stage shows to a woman in this state, for the campaign mode.
const offerAt = (state, mode) => (['visitor', 'engaged', 'known'].includes(state) ? (mode === 'open' ? 'offer_f1k' : 'offer_paid') : 'offer_paid');
const PAGES = {
  // surface: [url, stage of the page]
  tool_end: ['/pregnancy/tools/due-date-calculator', 'pregnancy'],
  stage_hub_own: ['/pregnancy/', 'pregnancy'],
  stage_hub_other: ['/postpartum/', 'postpartum'],
  home_hero: ['/', ''],
  app_home: ['/app/', '']
};
function expect(page, state, mode) {
  const own = ['member', 'buyer', 'bundle', 'both'].includes(state);
  if (page === 'tool_end' || page === 'stage_hub_own') return state === 'lapsed' ? 'keep_program' : own ? 'open_program' : offerAt(state, mode);
  if (page === 'stage_hub_other') return state === 'member' ? '' : state === 'bundle' ? 'open_program' : offerAt(state, mode);
  if (page === 'home_hero') return state === 'lapsed' ? 'keep_program' : own ? 'next_lesson' : offerAt(state, mode);
  if (page === 'app_home') return state === 'lapsed' ? 'keep_program' : state === 'member' ? 'todays_step' : own ? 'next_lesson' : offerAt(state, mode);
  if (page === 'streak_sheet') return state === 'lapsed' ? 'keep_program' : own ? 'next_lesson' : offerAt(state, mode);
  return '';
}
const SURFACE = { tool_end: 'tool_end', stage_hub_own: 'stage_hub', stage_hub_other: 'stage_hub', home_hero: 'home_hero', app_home: 'app_home', streak_sheet: 'streak_sheet' };

async function look(page) {
  return page.evaluate(() => {
    const dl = (window.__dl || []);
    const tracked = [].slice.call(document.querySelectorAll('[data-wgn-track]')).filter((e) => !e.closest('[hidden]'));
    const cards = [].slice.call(document.querySelectorAll('.wgn-offer')).filter((e) => !e.closest('[hidden]'));
    return {
      tracked: tracked.map((e) => e.getAttribute('data-wgn-track')),
      cards: cards.map((e) => e.getAttribute('data-wgn')),
      cardText: cards.concat(tracked).map((e) => e.innerText).join(' | '),
      owned: cards.some((e) => (e.getAttribute('data-wgn') === 'f1k' || e.getAttribute('data-wgn') === 'paid') && e.getAttribute('data-wgn-stage') === 'pregnancy'),
      shown: dl.filter((x) => x.event === 'next_action_shown'),
      variant: dl.filter((x) => x.event === 'wg_variant'),
      programCta: document.querySelectorAll('.program-cta').length
    };
  });
}

(async () => {
  try {
    await T.launch();
    // 1. the table is complete: every page the rule book classifies is a row in the table, and every row has all five columns
    {
      const t = await open({}, '/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open } });
      const rows = await t.page.evaluate(() => window.WGNext.SURFACES);
      const walk = (dir, acc) => { for (const f of fs.readdirSync(dir)) { if (/^(node_modules|_lab|lab|\.git|assets|functions)$/.test(f)) continue; const p = path.join(dir, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p, acc); else if (f.endsWith('.html')) acc.push(p); } return acc; };
      const pages = walk(ROOT, []).map((p) => ({ url: '/' + path.relative(ROOT, p).replace(/\.html$/, '').replace(/\/index$/, '/'), card: /class="[^"]*program-cta/.test(fs.readFileSync(p, 'utf8')) }));
      const surf = await t.page.evaluate((ps) => ps.map((p) => window.WGNext.surfaceOf(p.url, p.card)), pages);
      const missing = [...new Set(surf.filter((s) => s && !rows[s]))];
      ok('every surface the rule book classifies is a row in the table', missing.length === 0, missing.join(','));
      const bad = pages.filter((p, i) => p.card && !surf[i]).map((p) => p.url);
      ok('every page with an end card is classified (so it is in the table)', bad.length === 0, bad.slice(0, 3).join(','));
      ok('every row has the five columns V, M, B, O and L', Object.keys(rows).every((k) => ['V', 'M', 'B', 'O', 'L'].every((c) => rows[k][c])), '');
      ok('the table has the surface rows of note 07', ['home-hero', 'header-programs', 'stage-hub', 'end-card', 'streak-sheet', 'app-home', 'programs-page', 'sales-page', 'program-home', 'signin-locked', 'campaign-page', 'emails'].every((k) => rows[k]), Object.keys(rows).join(','));
      const v = await look(t.page);
      ok('every page view sets the user property ux = next', v.variant.length >= 1 && v.variant[0].ux === 'next', JSON.stringify(v.variant[0]));
      await t.close();
    }

    // 2. each state on each surface: exactly the cell's action, one offer at most, nothing owned offered, no price, the right event
    for (const mode of ['open']) {
      for (const state of Object.keys(STATES)) {
        for (const pg of Object.keys(PAGES)) {
          const [url] = PAGES[pg];
          const t = await open(STATES[state], url, { block: true, pre: PRE, route: { '/first1000/status': MODES[mode] }, wait: 1800 });
          const v = await look(t.page), want = expect(pg, state, mode), surface = SURFACE[pg], mine = v.tracked.filter((x) => x.split('|')[0] === surface);
          const label = `${state} on ${pg}`;
          if (pg === 'home_hero' && !want) { await t.close(); continue; }
          ok(`${label}: shows ${want || 'no offer'}`, want ? (mine.length === 1 && mine[0] === surface + '|' + want) : mine.length === 0, JSON.stringify(v.tracked));
          ok(`${label}: never two offers`, v.cards.length <= 1, v.cards.join(','));
          const sh = v.shown.filter((x) => x.surface === surface);
          ok(`${label}: next_action_shown carries the surface, state and action`, want ? (sh.length === 1 && sh[0].state === state && sh[0].action === want) : sh.length === 0, JSON.stringify(sh));
          if (OWNERS.includes(state) && pg !== 'stage_hub_other' && pg !== 'stage_hub_own' && pg !== 'tool_end') ok(`${label}: no offer for a program she owns`, !v.owned, '');
          if (['tool_end', 'stage_hub_own'].includes(pg) && state !== 'lapsed' && OWNERS.includes(state)) ok(`${label}: no offer for a program she owns`, !v.owned && v.cards.every((c) => c === 'own'), v.cards.join(','));
          ok(`${label}: no price on the card`, !/[₦$]\s?\d|pay once|from ₦/i.test(v.cardText), v.cardText.slice(0, 120));
          await t.close();
        }
      }
    }

    // 3. buyers never see the campaign; the slot falls back to the paid program when the campaign is paused or full
    for (const mode of ['paused', 'full']) {
      for (const state of ['visitor', 'known']) {
        const t = await open(STATES[state], '/app/', { block: true, pre: PRE, route: { '/first1000/status': MODES[mode] }, wait: 1800 });
        const v = await look(t.page);
        ok(`${state}, campaign ${mode}: the app home offers the paid program`, v.tracked.join() === 'app_home|offer_paid' && v.cards.join() === 'paid', JSON.stringify(v.tracked));
        await t.close();
      }
    }
    for (const state of ['buyer', 'both', 'bundle', 'lapsed']) {
      const t = await open(STATES[state], '/postpartum/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1800 });
      const v = await look(t.page);
      ok(`${state}: another stage's hub never offers the campaign`, !v.cards.includes('f1k'), v.cards.join());
      await t.close();
    }

    // 4. the 7 day streak sheet: the main action by state; sharing is outlined when something else is main
    for (const state of Object.keys(STATES)) {
      const t = await open(STATES[state], '/app/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      await t.page.evaluate(() => window.WGStreak.sheet(7));
      await wait(900);
      const v = await look(t.page), want = expect('streak_sheet', state, 'open');
      const sh = v.shown.filter((x) => x.surface === 'streak_sheet');
      ok(`${state} on the 7 day sheet: shows ${want}`, sh.length === 1 && sh[0].action === want && sh[0].state === state, JSON.stringify(sh));
      const share = await t.page.$eval('.wgs-tail .btn', (e) => e.className).catch(() => '');
      ok(`${state} on the 7 day sheet: sharing is outlined under the main action`, /btn-ghost/.test(share), share);
      const keep = await t.page.$eval('.wgs-link', (e) => e.tagName + ':' + e.textContent).catch(() => '');
      ok(`${state} on the 7 day sheet: "Keep going" is a text link`, keep === 'BUTTON:Keep going', keep);
      await t.close();
    }
    {
      const t = await open(STATES.visitor, '/app/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      await t.page.evaluate(() => window.WGStreak.sheet(3));
      await wait(500);
      const v = await look(t.page);
      ok('the 3 day sheet offers nothing', !v.shown.some((x) => x.surface === 'streak_sheet'), JSON.stringify(v.shown));
      await t.close();
    }

    // 5. quiet pages show no offer to anyone
    for (const state of Object.keys(STATES)) {
      const t = await open(STATES[state], '/pregnancy/guides/chemical-miscarriage', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      const v = await look(t.page);
      ok(`${state}: the miscarriage guide shows no offer`, v.cards.length === 0 && v.tracked.length === 0 && v.programCta === 0 && !v.shown.length, JSON.stringify(v));
      await t.close();
    }

    // 6. the other surfaces
    {
      let t = await open(STATES.visitor, '/programs/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      let v = await look(t.page);
      ok('visitor on /programs/: one offer card on top', v.cards.length === 1, v.cards.join()); await t.close();
      t = await open(STATES.buyer, '/programs/first-pregnancy-plan', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      v = await look(t.page);
      const btn = await t.page.$$eval('a.btn-primary', (a) => a.map((x) => x.textContent.trim()).filter((x) => /Open my program/.test(x)).length);
      ok('buyer on her own sales page: "Open my program" replaces the buy buttons', btn >= 1 && v.tracked.some((x) => x === 'program_page|open_program'), JSON.stringify(v.tracked)); await t.close();
      t = await open(STATES.visitor, '/programs/first-pregnancy-plan', { block: true, pre: PRE, wait: 1200 });
      v = await look(t.page);
      ok('visitor on a sales page: the sales page stays', v.tracked.length === 0, JSON.stringify(v.tracked)); await t.close();
      t = await open(STATES.member, '/first/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      v = await look(t.page);
      ok('member on the campaign page: the claim button becomes her program', v.tracked.includes('campaign_page|have_place'), JSON.stringify(v.tracked)); await t.close();
      t = await open(STATES.lapsed, '/first/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      v = await look(t.page);
      ok('lapsed member on the campaign page: the keep link', v.tracked.includes('campaign_page|keep_program'), JSON.stringify(v.tracked)); await t.close();
    }

    // 7. the app home asks for a name only in the capture, with her email; a saved name stays
    {
      let t = await open(STATES.engaged, '/app/', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      ok('the app home has no name ask card', !(await t.page.$('#appAsk')), '');
      ok('an engaged woman sees the save-your-tools row', !!(await t.page.$('.wgh-save')), '');
      await t.page.click('.wgh-save summary'); await wait(400);
      const f = await t.page.$$eval('.wga-inline input', (i) => i.map((x) => x.type));
      ok('the capture asks for a first name together with her email', f.join() === 'text,email', f.join());
      const tx = await text(t.page, '.wga-inline');
      ok('the capture says "Save your tools on any phone"', /Save your tools on any phone/.test(tx), tx.slice(0, 80)); await t.close();
      t = await open(Object.assign({}, STATES.engaged, { wg_name_v1: { v: 1, name: 'Ada', asked: true } }), '/app/', { block: true, pre: PRE, wait: 1500 });
      ok('a name already saved still shows', /Ada/.test(await text(t.page, '#appTitle')), await text(t.page, '#appTitle')); await t.close();
    }

    // 8. measurement: journey steps fire once per phone, and a click is reported
    {
      const t = await open(STATES.visitor, '/pregnancy/tools/due-date-calculator', { block: true, pre: PRE, route: { '/first1000/status': MODES.open }, wait: 1500 });
      await t.page.evaluate(() => { document.dispatchEvent(new CustomEvent('wg:finish')); document.dispatchEvent(new CustomEvent('wg:finish')); });
      await wait(200);
      const j = await t.page.evaluate(() => window.__dl.filter((x) => x.event === 'journey_step'));
      ok('journey_step engaged fires once, with a source', j.filter((x) => x.step === 'engaged').length === 1 && !!j[0].source, JSON.stringify(j));
      await t.page.evaluate(() => { const a = document.querySelector('[data-wgn-track] a.btn'); a.addEventListener('click', (e) => e.preventDefault(), true); a.click(); });
      const c = await t.page.evaluate(() => window.__dl.filter((x) => x.event === 'next_action_click'));
      ok('next_action_click carries the surface, state and action', c.length === 1 && c[0].surface === 'tool_end' && c[0].state === 'visitor' && c[0].action === 'offer_f1k', JSON.stringify(c)); await t.close();
      const b = await open(STATES.buyer, '/app/', { block: true, pre: PRE, wait: 1500 });
      const k = await b.page.evaluate(() => window.__dl.filter((x) => x.event === 'journey_step').map((x) => x.step + ':' + x.source));
      ok('a buyer is known and an owner, once', k.includes('known:purchase') && k.includes('owner:purchase'), k.join()); await b.close();
    }

    ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) {
    ok('the run finished', false, e.stack || e.message);
  } finally {
    try { await T.getBrowser().close(); } catch (e) {}
    console.log(out.join('\n'));
    const bad = out.filter((l) => l.startsWith('FAIL')).length;
    console.log(`\n${out.length - bad} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }
})();
