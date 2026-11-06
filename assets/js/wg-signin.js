/* Sign-in screen (/signin/). Her email, then a 6-digit code, through window.WGAccess (wg-access.js). There is no code to type
   from a program or a PDF. On localhost it runs a demo with no server unless the address has ?live=1. Demo rules: the email
   code is 123456, an email with "two" in it (or ?programs=2) holds two programs, an email with "plain" in it is a plain account
   with no program, and an email with "ended" in it had a program that is no longer active. */
(function () {
  // Program covers are named after the program, except The Wife Material Blueprint, whose file is wife-material-cover.webp.
  function coverOf(program) { return "/assets/img/products/" + (program === "wife-material-blueprint" ? "wife-material" : program) + "-cover.webp"; }
  var main = document.getElementById("signin");
  if (!main) return;
  var params = new URLSearchParams(location.search);
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var live = (!local || params.get("live") === "1") && !!window.WGAccess;

  // A locked program page sends ?program=<slug> (and ?next=<the page she asked for>), and the screen then names that program.
  var locked = /^[a-z0-9-]+$/.test(params.get("program") || "");
  var slug = locked ? params.get("program") : "";
  var next = /^(\/programs\/[a-z0-9-]+\/(thank-you|read)|\/(first|first-1000)\/(welcome|feedback))$/.test(params.get("next") || "") ? params.get("next") : "";
  var banner = main.querySelector(".signin-card > .signin-program");
  var bannerReady = false; // the banner waits for the program's name, so it never flashes the wrong program
  var programInfo = null;
  if (banner) banner.hidden = true;
  document.querySelectorAll("[data-locked]").forEach(function (el) { el.hidden = !locked; });
  if (locked && window.WGAccess) {
    WGAccess.program(slug).then(function (h) {
      if (!h) return;
      programInfo = h;
      document.getElementById("programName").textContent = h.name;
      banner.querySelector("img").src = coverOf(h.program);
      var see = document.querySelector("[data-locked] a"); if (see) see.href = "/programs/" + h.program;
      bannerReady = true; banner.hidden = false;
    });
  }

  // Inside Instagram, TikTok or Facebook a sign-in stays inside that app, so she is asked to open her own browser first.
  // The words are written here, not in the page, because they name the browser.
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Snapchat|\bLine\//i.test(navigator.userAgent) || params.get("preview") === "in-app";
  if (inApp) {
    var note = document.getElementById("signinInApp");
    note.innerHTML = "<b>Open this in your phone’s browser first.</b>You opened this inside another app, like Instagram or TikTok. If you sign in here, your program stays inside that app. Tap the menu at the top and choose Open in browser, then sign in there.";
    var cp = document.createElement("button"); cp.type = "button"; cp.className = "btn btn-ghost"; cp.textContent = "Copy the link";
    cp.addEventListener("click", function () { try { navigator.clipboard.writeText(location.href).then(function () { cp.textContent = "Link copied"; }); } catch (e) {} });
    note.appendChild(cp); note.hidden = false;
  }

  var title = document.getElementById("signinTitle"), lead = document.getElementById("signinLead");
  var TITLE = locked ? "Sign in to open your program" : "Open your programs";
  var LEAD = locked ? "Type the email you used when you paid, and we will send you a 6-digit code. Just paid? It can take a few minutes for your purchase to reach us."
                    : "Type the email you used when you paid or signed up. We will send you a 6-digit code.";
  title.textContent = TITLE; lead.textContent = LEAD;

  var steps = { email: document.getElementById("stepEmail"), otp: document.getElementById("stepOtp"), done: document.getElementById("stepDone"), ended: document.getElementById("stepEnded") };
  function show(name) {
    Object.keys(steps).forEach(function (k) { steps[k].hidden = k !== name; });
    var both = name === "done" || name === "ended";
    title.hidden = both;
    var help = document.querySelector(".signin-help"); if (help) help.hidden = both;
    lead.hidden = name !== "email";
    if (name === "otp") title.textContent = "Check your email";
    else if (name === "email") title.textContent = TITLE;
    var inapp = document.getElementById("signinInApp"); if (inapp && both) inapp.hidden = true;
    if (banner && locked) banner.hidden = both || !bannerReady;
    var first = steps[name].querySelector("input"); if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function err(id, msg) { var e = document.getElementById(id); e.textContent = msg || ""; e.hidden = !msg; }
  function busy(form, on, label) { var b = form.querySelector(".signin-btn"); b.disabled = on; if (label) b.textContent = label; }

  document.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-go")); }); });

  var email = "";
  steps.email.addEventListener("submit", function (e) {
    e.preventDefault();
    email = document.getElementById("siEmail").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("emailError", "Please enter your full email address and try again.");
    err("emailError"); busy(steps.email, true, "Sending...");
    var sent = function () { busy(steps.email, false, "Send my code"); document.getElementById("sentTo").textContent = email; tries = 0; show("otp"); };
    if (!live) return setTimeout(sent, 700);
    WGAccess.signin(email).then(function (j) {
      if (j.status === 429) { busy(steps.email, false, "Send my code"); return err("emailError", "We need to wait 15 minutes before sending another code. Please try again then."); }
      if (!j.ok) { busy(steps.email, false, "Send my code"); return err("emailError", "Please enter your full email address and try again."); }
      sent();
    }).catch(function () { busy(steps.email, false, "Send my code"); err("emailError", "We could not check that. Check your internet connection and try again."); });
  });

  var tries = 0;
  steps.otp.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = document.getElementById("siOtp").value.replace(/\D/g, "");
    if (v.length !== 6) return err("otpError", "The code should have 6 numbers. Check it and try again.");
    busy(steps.otp, true, "Checking...");
    var wrong = function (left) {
      err("otpError", left > 0 ? "We could not match that code. Check the newest email from us and try again." : "This code has stopped working. Ask for a new code.");
    };
    if (!live) {
      return setTimeout(function () {
        busy(steps.otp, false, "Open my programs");
        if (v !== "123456") { tries++; return wrong(5 - tries); }
        err("otpError"); demoDone();
      }, 600);
    }
    WGAccess.check(email, v).then(function (j) {
      busy(steps.otp, false, "Open my programs");
      if (j.status === 429) return err("otpError", "We need to pause code checks on this phone for a few minutes. Please try again then.");
      if (!j.ok) return wrong(j.tries_left || 0);
      err("otpError");
      finish(j);
    }).catch(function () { busy(steps.otp, false, "Open my programs"); err("otpError", "We could not check that. Check your internet connection and try again."); });
  });
  document.getElementById("resend").addEventListener("click", function () {
    err("otpError", ""); tries = 0; this.textContent = "New code sent"; var b = this;
    if (live) WGAccess.signin(email).then(function (j) { if (j.status === 429) err("otpError", "We need to wait 15 minutes before sending another code. Please try again then."); }).catch(function () {});
    setTimeout(function () { b.textContent = "Send a new code"; }, 2500);
  });

  // ── the demo (localhost, no server) ──
  var PROGRAMS = [
    ["/programs/first-baby-playbook/thank-you", "first-baby-playbook", "The First Baby Playbook"],
    ["/programs/postpartum-reset/thank-you", "postpartum-reset", "The 6-Week Postpartum Reset"]
  ];
  function demoDone() {
    var two = /two/i.test(email) || params.get("programs") === "2", plain = /plain/i.test(email), ended = /ended/i.test(email);
    var list = plain || ended ? [] : PROGRAMS.slice(0, two ? 2 : 1).map(function (p) { return { url: p[0], program: p[1], name: p[2], slug: p[1] }; });
    finish({ ok: true, token: true, programs: list, account: { email: email, name: "Ada", programs: list.map(function (p) { return { slug: p.slug, home: p.url }; }), member: /ended/i.test(email) ? { stage: "parenting", ends: "2026-01-01" } : null } }, true);
  }

  // ── after a right code ──
  // She lands on the program she asked for when she owns it. A plain account sees what her account holds. A refund or
  // ended months shows the not-active screen with the way to buy it.
  function finish(j, demo) {
    var list = j.programs || [], acct = j.account || {};
    if (!list.length && !j.token) return err("otpError", "We could not find a program for " + email + ". Use the email you paid with, or reply to your purchase email and we will help.");
    if (locked && !list.some(function (p) { return p.slug === slug; }) && !(list.some(function (p) { return /^complete-motherhood-journey/.test(p.slug); }) && /^(trying-to-conceive|first-pregnancy|postpartum|first-baby)/.test(slug))) {
      return ended(acct);
    }
    if (live || demo) WGAccess && WGAccess.push && WGAccess.push("app_program_added", {});
    var want = next && list.filter(function (p) { return next.indexOf("/programs/" + p.slug + "/") === 0; })[0];
    if (want) return location.replace(next);
    // The First 1,000 pages (the welcome page and the day 7 feedback form) are for a signed-in account, not for a program.
    if (next && /^\/(first|first-1000)\//.test(next) && j.token && !demo) return location.replace(next);
    if (locked) { var one = list.filter(function (p) { return p.slug === slug; })[0]; if (one) return location.replace(one.url); }
    if (list.length === 1 && !demo) return location.replace(list[0].url);
    done(list, acct);
  }
  function done(list, acct) {
    var ul = document.getElementById("doneList");
    ul.innerHTML = "";
    // A bundle already covers its single programs, so only the bundle is listed.
    var bundle = list.some(function (p) { return /^complete-motherhood-journey/.test(p.slug); });
    list.filter(function (p) { return !bundle || /^complete-motherhood-journey/.test(p.slug) || /^wife-material/.test(p.slug); }).forEach(function (p) {
      var li = document.createElement("li"), a = document.createElement("a"), img = document.createElement("img");
      a.href = p.url; img.src = coverOf(p.program); img.alt = ""; img.width = 40; img.height = 53;
      a.appendChild(img); a.appendChild(document.createTextNode(p.name)); li.appendChild(a); ul.appendChild(li);
    });
    var plain = !list.length;
    document.getElementById("doneLead").textContent = plain ? "Your account saves your name, streak, saved tools and finished games. They follow you to any phone you sign in on."
      : "This phone now has your programs. You stay signed in while you keep using it.";
    document.getElementById("doneNote").hidden = plain;
    document.getElementById("doneApp").hidden = !plain;
    show("done");
  }
  function ended(acct) {
    var m = acct && acct.member, over = m && m.ends && Date.parse(m.ends) < Date.now();
    var h = programInfo, name = h ? h.name : "Your program";
    document.getElementById("endedName").textContent = name;
    document.getElementById("endedTitle").textContent = over ? "Your free months have ended" : "Not active on this account";
    if (h) document.getElementById("endedImg").src = coverOf(h.program);
    var who = acct && acct.name ? ", " + acct.name : "";
    document.getElementById("endedLead").textContent = over
      ? "Thank you for being one of our first members" + who + ". Get the program today to keep it and your place in it. Your tools, games and saved entries are still here."
      : "This program is no longer active for " + (acct && acct.email ? acct.email : "this account") + ". Your tools, games and saved entries are all still here.";
    document.getElementById("endedBuy").textContent = "Get " + (h ? h.name.replace(/^The /, "the ") : "the program") + " →";
    document.getElementById("endedBuy").href = "/programs/" + (h ? h.program : slug.replace(/-diaspora$/, ""));
    show("ended");
  }

  // The one-tap link in the buyer email (?link=). The token leaves the address at once, so a shared screenshot or bookmark
  // never carries it. A program she asked for opens straight away.
  var token = params.get("link") || "";
  if (/^[0-9a-f]{64}$/.test(token) || (local && token === "demo")) {
    params.delete("link");
    try { history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params.toString() : "")); } catch (e) {}
    show("email");
    title.textContent = "Opening your program";
    lead.textContent = "One moment.";
    lead.hidden = false;
    steps.email.hidden = true;
    var opened = live ? WGAccess.link(token) : new Promise(function (ok) { setTimeout(function () { ok({ ok: true, token: true, programs: [{ url: PROGRAMS[0][0], program: PROGRAMS[0][1], name: PROGRAMS[0][2], slug: PROGRAMS[0][1] }], account: {} }); }, 600); });
    opened.then(function (j) {
      if (j.ok) return finish(j, !live);
      show("email");
      err("emailError", "This link has been used or has run out. Type the email you paid with and we will send you a code.");
    }).catch(function () { show("email"); err("emailError", "We could not open the link. Check your internet connection, or type your email and we will send you a code."); });
    return;
  }

  // Already signed in on this phone: say so, with a way to the app.
  var preview = local && params.get("step");
  if (preview === "otp") { document.getElementById("sentTo").textContent = "ada.buyer@gmail.com"; show("otp"); }
  else if (preview === "done") { email = "ada@gmail.com"; demoDone(); }
  else if (preview === "ended") { email = "ended@gmail.com"; slug = slug || "first-baby-playbook"; locked = true; demoDone(); }
  else show("email");
})();
