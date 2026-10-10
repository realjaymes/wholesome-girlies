// Share a quiz or checker result. Written by scripts/make-result-pages.py from scripts/results.json; do not edit by hand.
// Tool pages call wgShowResult("<result>") after scoring (or wgShowResult(null) to hide it), and carry an
// empty <div id="wg-result-share"></div> inside the result panel. The share link points at the result page,
// /<stage>/tools/<tool>/result/<result>, whose link preview is the result card. Her answers never leave the page.
// Her name (WGApp.name(), saved on her phone only) leads the headline on her own screen when it starts "I am" or "I'm".
// It goes on the Status picture only when she ticks "Put my name on my result card" (off every time): the picture is
// drawn on her phone, and the share link and the share text never carry it.
(function () {
  var DATA = {"ready-for-love-quiz": {"path": "/relationships/tools/ready-for-love-quiz", "share": "I got \"{title}\" on the Ready for Love quiz 👀 Eight questions on what you want, your standards and what you are healing from. Take it and send me yours.", "results": {"grounded": {"title": "Clear on my standards, and ready."}, "close": {"title": "Close. A little clarity and I'm there."}, "pour-into-you": {"title": "Pouring into me first."}}}, "green-red-flags-checker": {"path": "/relationships/tools/green-red-flags-checker", "share": "I checked the green and red flags. My read: \"{title}\" 👀 Tick what you are actually seeing in him and get your own read.", "results": {"healthy": {"title": "This is looking healthy."}, "watch": {"title": "Mostly good. A couple of things to watch."}, "red-outweighs": {"title": "The red is outweighing the green."}, "mixed": {"title": "A real mix. Read it carefully."}}}, "situationship-checker": {"path": "/relationships/tools/situationship-checker", "share": "I took the Situationship checker. Verdict: \"{title}\" 😅 Six questions to see if it is a relationship or a situationship. Take it and send me yours.", "results": {"going-somewhere": {"title": "This is going somewhere."}, "undefined": {"title": "Undefined. I deserve a straight answer."}, "choose-you": {"title": "Situationship. I'm choosing me."}}}, "red-flag-radar": {"path": "/relationships/tools/red-flag-radar", "share": "I got \"{title}\" on the Red Flag Radar 🚩 He goes quiet for three days. Every ex was crazy. Green flag, let's talk or red flag? Make your calls and send me yours.", "results": {"sharp": {"title": "My radar is sharp."}, "soft": {"title": "I give him the benefit of the doubt."}, "strict": {"title": "I cut first and ask questions later."}, "warming-up": {"title": "My radar is still warming up."}}}, "is-he-husband-material": {"path": "/relationships/tools/is-he-husband-material", "share": "I got \"{title}\" on Is He Husband Material? 👀 Does his word match what he does? Can he say sorry? Check your man and send me your result.", "results": {"showing-it": {"title": "He's giving husband material."}, "promising": {"title": "Promising, with questions to ask."}, "not-yet": {"title": "Not husband material yet."}}}, "girls-girl-quiz": {"path": "/relationships/tools/girls-girl-quiz", "share": "I got \"{title}\" on the Are You a Girl's Girl? quiz 👀 Ten friendship situations, from aso ebi money to a 1am breakup call. Take it and send me your result.", "results": {"certified": {"title": "I am a certified girl's girl."}, "ride-or-die": {"title": "I am a ride-or-die girl's girl."}, "lowkey": {"title": "I am a lowkey girl's girl."}, "own-time": {"title": "I am a girl's girl on my own time."}, "pick-me": {"title": "I am a pick-me, and I know it."}}}, "3am-group-chat": {"path": "/postpartum/tools/3am-group-chat", "share": "I made a 3am chat card 😂 \"{title}\" Pick your 3am thought, get a friend's reply and send it to a new mum.", "results": {"card": {"title": "Even at 3am, my girls reply."}}}, "delulu-or-clear-eyed": {"path": "/relationships/tools/delulu-or-clear-eyed", "share": "I got \"{title}\" on the Delulu or Clear-Eyed? quiz 👀 Ten talking-stage situations. Take it and send me yours.", "results": {"certified-delulu": {"title": "I am certified delulu."}, "hopeful": {"title": "I am hopeful, with one eye open."}, "clear-eyed": {"title": "I am clear-eyed and still soft."}, "case-closed": {"title": "I am very clear-eyed. Case closed."}}}, "how-do-you-love": {"path": "/relationships/tools/how-do-you-love", "share": "I got \"{title}\" on the How Do You Love? quiz 👀 Ten everyday relationship moments. Take it and send me yours.", "results": {"reassurer": {"title": "I love like a reassurer."}, "space-keeper": {"title": "I love like a space-keeper."}, "steady-one": {"title": "I love like the steady one."}, "all-in": {"title": "I love like the all-in one."}}}, "how-well-do-you-know-me": {"path": "/postpartum/tools/how-well-do-you-know-me", "share": "I got \"{title}\" on How Well Do You Know Me? 👀 One of you answers ten questions, the other guesses. Play with your spouse and send me your score.", "results": {"back-of-my-hand": {"title": "I know my spouse like the back of my hand."}, "well-with-surprises": {"title": "I know my spouse well. They can still surprise me."}, "half-and-half": {"title": "Half right. My spouse still has stories for me."}, "ask-more": {"title": "My spouse still has plenty to tell me."}}}, "milestone-guess": {"path": "/parenting/tools/milestone-guess", "share": "I got \"{title}\" on Milestone Guess 👶 Guess the age for eight baby milestones and see the real ranges. Play and send me your score.", "results": {"spot-on": {"title": "I know when babies reach their milestones."}, "close": {"title": "I was close on most baby milestones."}, "own-clock": {"title": "Every baby has their own clock, and now I know the ranges."}}}, "mum-wrapped": {"path": "/postpartum/tools/mum-wrapped", "share": "I got \"{title}\" on Mum Wrapped. My first six weeks with a baby, counted in cards. Try it and send me yours.", "results": {"night-shift-legend": {"title": "I ran the night shift."}, "milk-bar-manager": {"title": "I kept the milk bar open."}, "visitor-hostess": {"title": "I hosted the visitors and survived."}, "cold-tea-queen": {"title": "My tea went cold and I kept going."}, "one-tap-at-a-time": {"title": "I took six weeks one tap at a time."}}}, "new-parent-bingo": {"path": "/parenting/tools/new-parent-bingo", "share": "I got \"{title}\" on New Parent Bingo 👀 Tick the newborn moments you have lived through, like checking the baby was breathing three times in one night. Play it and send me your score.", "results": {"just-landed": {"title": "We're still new at this."}, "a-few-nights-in": {"title": "We've lived a few of these."}, "deep-in-it": {"title": "We're deep in the newborn days."}, "full-bingo": {"title": "We've lived almost all of it."}}}, "old-wives-tales-baby": {"path": "/parenting/tools/old-wives-tales-baby", "share": "I got \"{title}\" on Old Wives' Tales: Baby Edition 👀 Ten baby tales, True or False, each with a source. Play and send me your score.", "results": {"sharp": {"title": "I know my baby facts from my baby tales."}, "half": {"title": "I knew half. I'm glad I checked the rest."}, "raised": {"title": "I grew up on these baby tales. Now I check first."}}}, "old-wives-tales-pregnancy": {"path": "/pregnancy/tools/old-wives-tales-pregnancy", "share": "I got \"{title}\" on Old Wives' Tales: Pregnancy Edition 👀 Ten pregnancy tales, True or False, each with a source. Play and send me your score.", "results": {"sharp": {"title": "I know my facts from my old wives' tales."}, "half": {"title": "I knew half. The other half surprised me."}, "raised": {"title": "I grew up on these tales. Now I have the sources."}}}, "omugwo-your-mum-or-his-mum": {"path": "/postpartum/tools/omugwo-your-mum-or-his-mum", "share": "I got \"{title}\" on the Omugwo: Your Mum or His Mum? quiz 👀 Nine omugwo dilemmas. Take it and send me yours.", "results": {"team-my-mum": {"title": "I am Team My Mum."}, "team-his-mum": {"title": "I am Team His Mum."}, "team-both": {"title": "I am Team Both."}, "team-just-us": {"title": "I am Team Just Us, thank you."}}}, "pregnancy-cravings-tier-list": {"path": "/pregnancy/tools/pregnancy-cravings-tier-list", "share": "My cravings tier list is done 👀 \"{title}\" Rank suya, agege bread, puff-puff and more, then send me yours.", "results": {"street": {"title": "My S tier is pure roadside."}, "sweet": {"title": "My S tier is all sugar."}, "pot": {"title": "My S tier comes from the pot."}, "mixed": {"title": "My S tier has no rules."}}}, "put-a-finger-down-dating": {"path": "/relationships/tools/put-a-finger-down-dating", "share": "Put a finger down: \"{title}\" 😅 Ten lines on talking stages, aunties and the ex who texts “hey stranger”. How many fingers do you have left? Send me yours.", "results": {"none-left": {"title": "I have no fingers left."}, "last-fingers": {"title": "I'm down to my last fingers."}, "half-a-hand": {"title": "I'm down to half a hand."}, "mostly-up": {"title": "Most of my fingers are still up."}, "all-up": {"title": "Nearly all my fingers are still up."}}}, "visitors-bingo": {"path": "/postpartum/tools/visitors-bingo", "share": "I got \"{title}\" on Visitors Bingo 👀 Tick everything your visitors said after the birth, from “He looks exactly like his father” to “Is she eating?”. Play it and send me your score.", "results": {"first-guests": {"title": "My first visitors are still on the way."}, "a-few-visits-in": {"title": "My house has had its share of visitors."}, "open-house": {"title": "My living room has been an open house."}, "full-house": {"title": "I've hosted nearly every visitor."}}}, "what-kind-of-mum": {"path": "/pregnancy/tools/what-kind-of-mum", "share": "I got \"{title}\" on the What Kind of Mum Will You Be? quiz 👀 Nine pregnancy moments. Take it and send me yours.", "results": {"planner": {"title": "I am the planner mum."}, "soft-life": {"title": "I am the soft-life mum."}, "hype": {"title": "I am the hype mum."}, "naija-strict": {"title": "I am the Naija-strict mum."}}}, "which-nigerian-parent": {"path": "/parenting/tools/which-nigerian-parent", "share": "I got \"{title}\" on the Which Nigerian Parent Are You? quiz 😂 Nine everyday moments. Take it and send me yours.", "results": {"remote-control": {"title": "I am the remote control parent."}, "ask-your-father": {"title": "I am the \"go and ask your father\" parent."}, "long-speech": {"title": "I am the long speech parent."}, "soft-landing": {"title": "I am the soft landing parent."}}}};
  var V = "20261010b";
  function tool() { var m = location.pathname.match(/\/tools\/([^\/?#.]+)/); return m && m[1]; }
  function push(ev, id) { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: ev, share_item: id, share_surface: "result" }); }
  function herName() { try { return (window.WGApp && window.WGApp.name && window.WGApp.name()) || ""; } catch (e) { return ""; } }
  function style() {
    if (document.getElementById("wg-name-style")) return;
    var st = document.createElement("style"); st.id = "wg-name-style";
    st.textContent = ".wg-namecard{display:grid;grid-template-columns:104px 1fr;gap:14px;align-items:start;margin:14px 0 0}.wg-namecard img{display:block;width:104px;height:auto;border:2px solid var(--ink,#33322A);border-radius:12px;background:var(--cream,#FBF8EF)}.wg-namecheck{display:flex;gap:8px;align-items:flex-start;font-weight:800;font-size:.95rem;line-height:1.3;cursor:pointer}.wg-namecheck input{width:20px;height:20px;margin-top:1px;accent-color:var(--terracotta,#6E7A3F);flex:none}";
    document.head.appendChild(st);
  }
  // Her own screen: "I am a certified girl's girl." becomes "Ada, you are a certified girl's girl."
  function lead(box, n) {
    var res = box.closest(".result") || box.parentNode, h = res && res.querySelector(".big");
    if (!h || !n) return;
    var m = /^I(?: am|'m) (.*)$/.exec(h.textContent.trim());
    if (m) h.textContent = n + ", you are " + m[1];
  }
  // The Status picture with "MY RESULT" changed to "<NAME>'S RESULT", drawn here on her phone.
  function drawCard(src, n) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () {
        var go = function () {
          try {
            var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
            var x = c.getContext("2d"); x.drawImage(im, 0, 0);
            var k = c.width / 1080, bg = x.getImageData(Math.round(40 * k), Math.round(268 * k), 1, 1).data;
            var reg = x.getImageData(Math.round(80 * k), Math.round(250 * k), Math.round(200 * k), Math.round(36 * k)).data, ink = [bg[0], bg[1], bg[2]], far = 0;
            for (var i = 0; i < reg.length; i += 4) { var dd = Math.abs(reg[i] - bg[0]) + Math.abs(reg[i + 1] - bg[1]) + Math.abs(reg[i + 2] - bg[2]); if (dd > far) { far = dd; ink = [reg[i], reg[i + 1], reg[i + 2]]; } }
            x.fillStyle = "rgb(" + bg[0] + "," + bg[1] + "," + bg[2] + ")"; x.fillRect(Math.round(70 * k), Math.round(238 * k), Math.round(240 * k), Math.round(60 * k));
            var label = (n + "'s result").toUpperCase(), size = 30 * k, gap = 2.2 * k, wide;
            do { x.font = "800 " + size + "px 'Nunito Sans', system-ui, sans-serif"; wide = x.measureText(label).width + gap * label.length; size -= 1; } while (wide > 880 * k && size > 14 * k);
            x.fillStyle = "rgb(" + ink[0] + "," + ink[1] + "," + ink[2] + ")"; x.textBaseline = "alphabetic";
            var px = 80 * k; for (var j = 0; j < label.length; j++) { x.fillText(label[j], px, 282 * k); px += x.measureText(label[j]).width + gap; }
            c.toBlob(function (b) { b ? resolve(b) : reject(new Error("blob")); }, "image/jpeg", 0.92);
          } catch (e) { reject(e); }
        };
        if (document.fonts && document.fonts.load) document.fonts.load("800 30px 'Nunito Sans'").then(go, go); else go();
      };
      im.onerror = reject; im.src = src;
    });
  }
  window.wgShowResult = function (type) {
    var box = document.getElementById("wg-result-share"), t = DATA[tool()];
    if (!box || !t) return;
    var r = type && t.results[type];
    box.innerHTML = "";
    box.hidden = !r;
    if (!r) return;
    var id = tool() + ":" + type, img = "/assets/img/results/" + tool() + "/" + type + "-status.jpg?v=" + V, n = herName();
    lead(box, n);
    box.innerHTML = '<p class="sub">Share your result</p><div class="wg-share" data-share-size="sm"></div>' +
      (n ? '<div class="wg-namecard"><img alt="" width="104" height="185" data-pic src="' + img + '"><div><label class="wg-namecheck"><input type="checkbox" data-tick> <span>Put my name on my result card</span></label>' +
        '<p class="muted" style="font-size:.85rem;margin:6px 0 0;">Off unless you tick it. The link never carries your name. The picture is made on your phone.</p></div></div>' +
        '<p style="margin:14px 0 0;"><a class="btn btn-ghost" style="background:#fff;" data-save href="' + img + '" download="wholesome-girlies-' + type + '.jpg">Save for your Status</a></p>' :
      '<p style="margin:12px 0 0;"><a class="btn btn-ghost" style="background:#fff;" data-save href="' + img + '" download="wholesome-girlies-' + type + '.jpg">Save for your Status</a></p>') +
      '<p class="muted" style="font-size:.85rem;margin:8px 0 0;">The link and the picture show your result only, never your answers.</p>';
    var s = box.querySelector(".wg-share");
    s.setAttribute("data-share-id", id);
    s.setAttribute("data-share-surface", "result");
    s.setAttribute("data-share-path", t.path + "/result/" + type);
    s.setAttribute("data-share-text", t.share.replace("{title}", r.title.replace(/\.$/, "")));
    if (window.wgShareInit) window.wgShareInit();
    var tick = box.querySelector("[data-tick]"), pic = box.querySelector("[data-pic]"), made = "", mine = null;
    if (n) style();
    if (tick) tick.addEventListener("change", function () {
      if (made) { URL.revokeObjectURL(made); made = ""; }
      if (!tick.checked) { pic.src = img; return; }
      drawCard(img, n).then(function (b) { if (tick.checked) { made = URL.createObjectURL(b); pic.src = made; } }, function () {});
    });
    var file = function () {
      return (tick && tick.checked ? drawCard(img, n) : fetch(img).then(function (res) { return res.blob(); })).then(function (b) {
        return new File([b], "wholesome-girlies-" + type + ".jpg", { type: "image/jpeg" });
      });
    };
    box.querySelector("[data-save]").addEventListener("click", function (e) {
      push("result_save", id);
      var named = !!(tick && tick.checked), phone = navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent);
      if (!named && !phone) return;
      e.preventDefault();
      file().then(function (f) {
        if (phone && navigator.canShare({ files: [f] })) return navigator.share({ files: [f] });
        if (!named) { location.href = img; return; }
        var u = URL.createObjectURL(f), a = document.createElement("a"); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      }).catch(function () {});
    });
  };
})();
