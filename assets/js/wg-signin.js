/* Sign-in screen (/signin/). It signs her in through the payment server with window.WGAccess (wg-access.js).
   On localhost it runs a demo with no server unless the address has ?live=1. Demo rules: the email code is
   123456, an email with "two" in it (or ?programs=2) holds two programs, shared program codes work as they do
   live, and FBP-7K2M-Q9XP is the one personal code. Any other code gets the "could not match" message. */
(function () {
  // Program covers are named after the program, except The Wife Material Blueprint, whose file is wife-material-cover.webp.
  function coverOf(program) { return "/assets/img/products/" + (program === "wife-material-blueprint" ? "wife-material" : program) + "-cover.webp"; }
  var main = document.getElementById("signin");
  if (!main) return;
  var params = new URLSearchParams(location.search);
  // Phase 8 (the program pages are closed): one screen, Option B, no preview bar. The switch is PHASE8 in wg-access.js.
  var PHASE8 = !!(window.WGAccess && WGAccess.PHASE8);
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // Everywhere but localhost the screen is Option B. Options A and C stay viewable on localhost with ?option=a or ?option=c.
  var option = PHASE8 || !local ? "b" : /^[abc]$/.test(params.get("option") || "") ? params.get("option") : "b";
  var live = (!local || params.get("live") === "1") && !!window.WGAccess;
  main.setAttribute("data-option", option);

  var bar = document.getElementById("signinOptions");
  if (!PHASE8 && local && bar && !params.get("clean")) {
    bar.hidden = false;
    bar.querySelectorAll("a").forEach(function (a) { if (a.getAttribute("href").indexOf("option=" + option) > -1) a.classList.add("is-on"); });
  }
  // A locked program page sends ?program=<slug>, and the screen then names that program.
  var locked = /^[a-z0-9-]+$/.test(params.get("program") || "");
  document.querySelectorAll("[data-show]").forEach(function (el) {
    el.hidden = el.getAttribute("data-show").split(" ").indexOf(option) < 0;
  });
  var banner = document.querySelector(".signin-program");
  var bannerReady = false; // the banner waits for the program's name, so it never flashes the wrong program
  if (banner) banner.hidden = true;
  document.querySelectorAll("[data-locked]").forEach(function (el) { el.hidden = !locked; });
  if (locked && banner && window.WGAccess) {
    WGAccess.program(params.get("program")).then(function (h) {
      if (!h) return;
      document.getElementById("programName").textContent = h.name;
      banner.querySelector("img").src = coverOf(h.program);
      var see = document.querySelector("[data-locked] a"); if (see) see.href = "/programs/" + params.get("program");
      bannerReady = true; banner.hidden = false;
    });
  }
  if (PHASE8) {
    var hint = document.querySelector("#stepCode .signin-hint");
    if (hint) hint.textContent = "It is in your first email from us. Capital letters and spaces do not matter.";
  }

  var title = document.getElementById("signinTitle"), lead = document.getElementById("signinLead");
  if (locked) {
    title.textContent = "Sign in to read it";
    lead.textContent = "This program opens for the person who bought it. Type the email you used when you paid, and we will send you a 6-digit code.";
  }

  var steps = { email: document.getElementById("stepEmail"), otp: document.getElementById("stepOtp"), code: document.getElementById("stepCode"), done: document.getElementById("stepDone") };
  function show(name) {
    Object.keys(steps).forEach(function (k) { steps[k].hidden = k !== name; });
    var tabs = document.querySelectorAll(".signin-tabs button");
    tabs.forEach(function (t) { t.classList.toggle("is-on", t.getAttribute("data-tab") === name || (name === "otp" && t.getAttribute("data-tab") === "email")); });
    title.hidden = name === "done";
    var help = document.querySelector(".signin-help"); if (help) help.hidden = name === "done";
    lead.hidden = name !== "email";
    if (name === "otp") title.textContent = "Check your email";
    else if (name === "code") title.textContent = option === "b" ? (locked ? "Sign in to read it" : "Open your programs") : "Add a program";
    else if (name === "email") title.textContent = locked ? "Sign in to read it" : "Open your programs";
    var tabsEl = document.querySelector(".signin-tabs"); if (tabsEl && option === "b") tabsEl.hidden = name === "done" || name === "otp";
    var prog = document.querySelector(".signin-program"); if (prog && locked) prog.hidden = name === "done" || !bannerReady;
    var first = steps[name].querySelector("input"); if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function err(id, msg) { var e = document.getElementById(id); e.textContent = msg || ""; e.hidden = !msg; }
  function busy(form, on, label) { var b = form.querySelector(".signin-btn"); b.disabled = on; if (label) b.textContent = label; }

  document.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-go")); }); });
  document.querySelectorAll(".signin-tabs button").forEach(function (b) { b.addEventListener("click", function () { show(b.getAttribute("data-tab")); }); });

  var email = "";
  steps.email.addEventListener("submit", function (e) {
    e.preventDefault();
    email = document.getElementById("siEmail").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("emailError", "Please enter your full email address and try again.");
    err("emailError"); busy(steps.email, true, "Sending...");
    // The server answers the same for every email, so no one can learn whether an address bought a program.
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
        err("otpError"); done();
      }, 600);
    }
    WGAccess.check(email, v).then(function (j) {
      busy(steps.otp, false, "Open my programs");
      if (j.status === 429) return err("otpError", "We need to pause code checks on this phone for a few minutes. Please try again then.");
      if (!j.ok) return wrong(j.tries_left || 0);
      err("otpError");
      if (!j.programs.length) return err("otpError", "We could not find a program for " + email + ". Use the email you paid with, or reply to your purchase email and we will help.");
      done(j.programs);
    }).catch(function () { busy(steps.otp, false, "Open my programs"); err("otpError", "We could not check that. Check your internet connection and try again."); });
  });
  document.getElementById("resend").addEventListener("click", function () {
    err("otpError", ""); tries = 0; this.textContent = "New code sent"; var b = this;
    if (live) WGAccess.signin(email).then(function (j) { if (j.status === 429) err("otpError", "We need to wait 15 minutes before sending another code. Please try again then."); }).catch(function () {});
    setTimeout(function () { b.textContent = "Send a new code"; }, 2500);
  });

  steps.code.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = document.getElementById("siCode").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (v.length < 6) return err("codeError", "That code looks too short. Check it and try again.");
    busy(steps.code, true, "Checking...");
    // The demo checks shared codes for real (they never leave the phone) and takes FBP-7K2M-Q9XP as the only personal code.
    var check = live ? WGAccess.addCode(v) : v.length === 11 ? new Promise(function (ok) { setTimeout(function () {
      ok(v === "FBP7K2MQ9XP" ? { ok: true, programs: [{ url: PROGRAMS[0][0], program: PROGRAMS[0][1], name: PROGRAMS[0][2] }] } : { ok: false });
    }, 600); }) : window.WGAccess ? WGAccess.addCode(v) : Promise.resolve({ ok: false });
    check.then(function (j) {
      busy(steps.code, false, "Add my program");
      if (j.ok && j.programs.length) { err("codeError"); return done(j.programs); }
      var why = { revoked: "This code is no longer active. Reply to your purchase email if you think this is a mistake.",
        device_limit: "This code is already open on " + (j.device_limit || 3) + " devices. Reply to your purchase email and we will help.",
        slow_down: "We need to pause code checks on this phone for a few minutes. Please try again then." };
      err("codeError", why[j.reason] || "We could not match that code. Check your purchase email and try again.");
    }).catch(function () { busy(steps.code, false, "Add my program"); err("codeError", "We could not check that. Check your internet connection and try again."); });
  });

  // Demo: an email with "two" in it (or ?programs=2) holds two programs bought at different times.
  var PROGRAMS = [
    ["/programs/first-baby-playbook/thank-you", "first-baby-playbook", "The First Baby Playbook"],
    ["/programs/postpartum-reset/thank-you", "postpartum-reset", "The 6-Week Postpartum Reset"],
  ];
  // programs: [{url, program, name}] from WGAccess; the demo uses PROGRAMS.
  function done(programs) {
    var two = /two/i.test(email) || params.get("programs") === "2";
    var list = programs || PROGRAMS.slice(0, two ? 2 : 1).map(function (p) { return { url: p[0], program: p[1], name: p[2] }; });
    var ul = document.getElementById("doneList");
    ul.innerHTML = "";
    list.forEach(function (p) {
      var li = document.createElement("li"), a = document.createElement("a"), img = document.createElement("img");
      a.href = p.url; img.src = coverOf(p.program); img.alt = ""; img.width = 40; img.height = 53;
      a.appendChild(img); a.appendChild(document.createTextNode(p.name)); li.appendChild(a); ul.appendChild(li);
    });
    show("done");
  }

  // The one-tap link in the email a Selar buyer gets when her sale reaches us (?link=). The token leaves the address
  // at once, so a shared screenshot or bookmark never carries it. One program opens straight away.
  var token = params.get("link") || "";
  if (/^[0-9a-f]{64}$/.test(token) || (local && token === "demo")) {
    params.delete("link");
    try { history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params.toString() : "")); } catch (e) {}
    show("email");
    title.textContent = "Opening your program";
    lead.textContent = "One moment.";
    steps.email.hidden = true;
    var opened = live ? WGAccess.link(token) : new Promise(function (ok) { setTimeout(function () { ok({ ok: true, programs: null }); }, 600); });
    opened.then(function (j) {
      if (j.ok && j.programs && j.programs.length === 1) return location.replace(j.programs[0].url);
      if (j.ok) return done(j.programs);
      show("email");
      err("emailError", "This link has been used or has run out. Type the email you paid with and we will send you a code.");
    }).catch(function () { show("email"); err("emailError", "We could not open the link. Check your internet connection, or type your email and we will send you a code."); });
    return;
  }

  var preview = local && params.get("step");
  if (preview === "otp") { document.getElementById("sentTo").textContent = "ada.buyer@gmail.com"; show("otp"); }
  else if (preview === "code") show("code");
  else if (preview === "done") done();
  else show("email");
})();
