/* Her account on the app home (/app/): the row at the end of the app, the account sheet (name, email, sign out), the
 * "Make the app yours" sheet that makes a plain account on the first open of the installed app, and the card that asks an
 * iPhone to sign in once inside the app. It uses window.WGAccess (wg-access.js). Everything goes in with textContent or .value.
 *
 *   wg_acct_skip_v1  "1" once she skips "Make the app yours", so it never asks again
 *   wg:notify-optin  dispatched on document when she taps "Allow notifications instead". This file renders nothing for it; the
 *                    notification build listens for it.
 * Events: account_created (a plain account was made from the first-open sheet), with the surface only.
 */
(function (w, d) {
  'use strict';
  if (!w.WGAccess) return;
  var SKIP = 'wg_acct_skip_v1';
  function $(id) { return d.getElementById(id); }
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function get(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { w.localStorage.setItem(k, v); } catch (e) {} }

  // ── the row ──
  // Signed out it is "Sign in to your programs", a link to /signin/. Signed in it is her account row; a tap opens her account.
  function row() {
    var host = $('appAdd'); if (!host) return;
    var t = host.querySelector('.ab-title'), s = host.querySelector('.ab-sub');
    if (WGAccess.signedIn()) {
      t.textContent = 'Signed in as ' + (WGAccess.email() || 'your account');
      s.textContent = 'Your programs, name and progress · Sign out';
      host.setAttribute('href', '#account');
    } else {
      t.textContent = 'Sign in to your programs';
      s.textContent = 'Use the email you paid or signed up with';
      host.setAttribute('href', '/signin/');
    }
    var back = $('appBackupSub'); if (back) back.textContent = WGAccess.signedIn() ? 'Your tool entries' : 'Your name and your entries';
    var nameBox = $('appNameBlock'); if (nameBox) nameBox.hidden = WGAccess.signedIn();
    var a = $('appBackupAcct'), v = $('appBackupVisitor'); if (a) a.hidden = !WGAccess.signedIn(); if (v) v.hidden = WGAccess.signedIn();
    var card = $('appSigninCard'); if (card && WGAccess.signedIn()) card.hidden = true;
  }

  // ── sheets ──
  var open = null;
  function sheet(build) {
    close();
    var o = el('div', 'wg-acct-sheet'), inn = el('div', 'in'); inn.setAttribute('role', 'dialog'); inn.setAttribute('aria-modal', 'true');
    o.appendChild(inn); build(inn, function () { close(); });
    o.addEventListener('click', function (e) { if (e.target === o && o._dismiss) o._dismiss(); else if (e.target === o) close(); });
    d.body.appendChild(o); open = o; return o;
  }
  function close() { if (open) { open.remove(); open = null; } }

  // The account sheet: change her name, see her email, sign out of this phone. Signing out never deletes her tool entries.
  function accountSheet() {
    sheet(function (inn) {
      inn.appendChild(el('h3', '', 'Your account'));
      inn.appendChild(el('p', 'who', WGAccess.email()));
      var l = el('label', '', 'Your first name'); l.setAttribute('for', 'wgAcctName'); inn.appendChild(l);
      var input = el('input'); input.type = 'text'; input.id = 'wgAcctName'; input.maxLength = 30; input.autocomplete = 'given-name'; input.value = WGAccess.name(); inn.appendChild(input);
      var msg = el('p', 'small', ''); msg.setAttribute('role', 'status');
      var save = el('button', 'btn btn-primary', 'Save my name'); save.type = 'button';
      save.addEventListener('click', function () {
        if (!input.value.trim()) { msg.textContent = 'Type your first name.'; return; }
        WGAccess.setName(input.value).then(function (ok) { msg.textContent = ok ? 'Your name is saved to your account.' : 'We could not save that. Try again.'; if (ok) d.dispatchEvent(new CustomEvent('wg:name')); });
      });
      inn.appendChild(save); inn.appendChild(msg);
      var out = el('button', 'btn btn-ghost', 'Sign out of this phone'); out.type = 'button';
      out.addEventListener('click', function () { out.disabled = true; WGAccess.signout().then(function () { location.reload(); }); });
      inn.appendChild(out);
      inn.appendChild(el('p', 'small', 'Signing out never deletes your tool entries. They stay on this phone.'));
      var cl = el('button', 'link', 'Close'); cl.type = 'button'; cl.addEventListener('click', close); var c = el('p', 'center'); c.appendChild(cl); inn.appendChild(c);
    });
  }

  // "Make the app yours": a plain account with no program. Name and email, then the 6-digit code.
  function makeItYours() {
    var o = sheet(function (inn) {
      var step = 1, email = '';
      function s1() {
        inn.textContent = '';
        inn.appendChild(el('h3', '', 'Make the app yours'));
        inn.appendChild(el('p', '', 'Save your streak, saved tools and reading place to an account, so they come back if you lose or change your phone.'));
        var f = el('form'); f.noValidate = true;
        var l1 = el('label', '', 'Your first name'); l1.setAttribute('for', 'wgMyName');
        var n = el('input'); n.type = 'text'; n.id = 'wgMyName'; n.maxLength = 30; n.autocomplete = 'given-name'; n.placeholder = 'e.g. Ada';
        var l2 = el('label', '', 'Your email'); l2.setAttribute('for', 'wgMyEmail');
        var e = el('input'); e.type = 'email'; e.id = 'wgMyEmail'; e.autocomplete = 'email'; e.inputMode = 'email'; e.placeholder = 'you@example.com';
        var er = el('p', 'err'); er.hidden = true;
        var go = el('button', 'btn btn-primary', 'Save my progress'); go.type = 'submit';
        var notify = el('button', 'btn btn-ghost', 'Allow notifications instead'); notify.type = 'button';
        var skip = el('p', 'center'); var sk = el('button', 'link', 'Skip for now'); sk.type = 'button'; skip.appendChild(sk);
        var fine = el('p', 'small center'); fine.appendChild(d.createTextNode('We use your email to sign you in. What you type into tools stays on your phone. '));
        var pl = el('a', '', 'Privacy'); pl.href = '/legal/privacy'; fine.appendChild(pl);
        [l1, n, l2, e, er, go, notify, skip, fine].forEach(function (x) { f.appendChild(x); }); inn.appendChild(f);
        f.addEventListener('submit', function (ev) {
          ev.preventDefault(); email = e.value.trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { er.textContent = 'Please enter your full email address and try again.'; er.hidden = false; return; }
          er.hidden = true; go.disabled = true; go.textContent = 'Sending...';
          WGAccess.signin(email, { name: n.value.trim(), create: true }).then(function (j) {
            go.disabled = false; go.textContent = 'Save my progress';
            if (j.status === 429) { er.textContent = 'We need to wait 15 minutes before sending another code. Please try again then.'; er.hidden = false; return; }
            if (!j.ok) { er.textContent = 'We could not send that. Check your email address and try again.'; er.hidden = false; return; }
            s2(n.value.trim());
          }).catch(function () { go.disabled = false; go.textContent = 'Save my progress'; er.textContent = 'We could not check that. Check your internet connection and try again.'; er.hidden = false; });
        });
        sk.addEventListener('click', function () { set(SKIP, '1'); close(); });
        notify.addEventListener('click', function () { set(SKIP, '1'); d.dispatchEvent(new CustomEvent('wg:notify-optin', { detail: { surface: 'make_it_yours' } })); close(); });
        setTimeout(function () { n.focus(); }, 30);
      }
      function s2(name) {
        inn.textContent = '';
        inn.appendChild(el('h3', '', 'Check your email'));
        var p = el('p'); p.appendChild(d.createTextNode('We sent a 6-digit code to ')); p.appendChild(el('b', 'who', email)); p.appendChild(d.createTextNode('. It works for 10 minutes.')); inn.appendChild(p);
        var f = el('form'); f.noValidate = true;
        var l = el('label', '', 'Your code'); l.setAttribute('for', 'wgMyCode');
        var c = el('input', 'otp'); c.type = 'text'; c.id = 'wgMyCode'; c.inputMode = 'numeric'; c.autocomplete = 'one-time-code'; c.maxLength = 6; c.placeholder = '000000';
        var er = el('p', 'err'); er.hidden = true;
        var go = el('button', 'btn btn-primary', 'Open my account'); go.type = 'submit';
        var back = el('p', 'center small'); var b = el('button', 'link', 'Use a different email'); b.type = 'button'; back.appendChild(b);
        [l, c, er, go, back].forEach(function (x) { f.appendChild(x); }); inn.appendChild(f);
        b.addEventListener('click', s1);
        f.addEventListener('submit', function (ev) {
          ev.preventDefault(); var v = c.value.replace(/\D/g, '');
          if (v.length !== 6) { er.textContent = 'The code should have 6 numbers. Check it and try again.'; er.hidden = false; return; }
          go.disabled = true; go.textContent = 'Checking...';
          WGAccess.check(email, v).then(function (j) {
            go.disabled = false; go.textContent = 'Open my account';
            if (!j.ok) { er.textContent = 'We could not match that code. Check the newest email from us and try again.'; er.hidden = false; return; }
            set(SKIP, '1'); WGAccess.push('account_created', { account_surface: 'app_first_open' });
            s3();
          }).catch(function () { go.disabled = false; go.textContent = 'Open my account'; er.textContent = 'We could not check that. Check your internet connection and try again.'; er.hidden = false; });
        });
        setTimeout(function () { c.focus(); }, 30);
      }
      function s3() {
        inn.textContent = '';
        inn.appendChild(el('h3', '', 'You are in'));
        inn.appendChild(el('p', '', 'Your name, streak, saved tools and reading place are saved to your account now. They follow you to any phone you sign in on.'));
        var done = el('button', 'btn btn-primary', 'Back to the app'); done.type = 'button'; done.addEventListener('click', function () { location.reload(); }); inn.appendChild(done);
      }
      s1();
    });
    o._dismiss = function () { set(SKIP, '1'); close(); };
  }

  d.addEventListener('DOMContentLoaded', function () {
    var host = $('appAdd');
    if (host) host.addEventListener('click', function (e) { if (WGAccess.signedIn()) { e.preventDefault(); accountSheet(); } });
    row();
    d.addEventListener('wg:account', row);
    var standalone = w.WGApp && WGApp.standalone;
    var hint = ''; try { hint = w.sessionStorage.getItem('wg_home_hint') || ''; } catch (e) {}
    // The installed iPhone app keeps its own storage, so a program signed in to in Safari is not open inside it yet.
    var card = $('appSigninCard');
    if (card && !WGAccess.signedIn() && standalone && WGApp.ios && hint) card.hidden = false;
    // First open of the installed app, signed out, not skipped: the plain account.
    else if (standalone && !WGAccess.signedIn() && !get(SKIP) && w.APP_FIRST_OPEN) setTimeout(makeItYours, 900);
  });
  w.WGAccountUI = { accountSheet: accountSheet, makeItYours: makeItYours };
})(window, document);
