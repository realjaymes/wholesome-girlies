// Share a quiz or checker result. Written by scripts/make-result-pages.py from scripts/results.json; do not edit by hand.
// Tool pages call wgShowResult("<result>") after scoring (or wgShowResult(null) to hide it), and carry an
// empty <div id="wg-result-share"></div> inside the result panel. The share link points at the result page,
// /<stage>/tools/<tool>/result/<result>, whose link preview is the result card. Her answers never leave the page.
(function () {
  var DATA = {"ready-for-love-quiz": {"path": "/relationships/tools/ready-for-love-quiz", "share": "I got \"{title}\" on the Ready for Love quiz 👀 Eight questions on what you want, your standards and what you are healing from. Take it and send me yours.", "results": {"grounded": {"title": "Clear on my standards, and ready."}, "close": {"title": "Close. A little clarity and I'm there."}, "pour-into-you": {"title": "Pouring into me first."}}}, "green-red-flags-checker": {"path": "/relationships/tools/green-red-flags-checker", "share": "I checked the green and red flags. My read: \"{title}\" 👀 Tick what you are actually seeing in him and get your own read.", "results": {"healthy": {"title": "This is looking healthy."}, "watch": {"title": "Mostly good. A couple of things to watch."}, "red-outweighs": {"title": "The red is outweighing the green."}, "mixed": {"title": "A real mix. Read it carefully."}}}, "situationship-checker": {"path": "/relationships/tools/situationship-checker", "share": "I took the Situationship checker. Verdict: \"{title}\" 😅 Six questions to see if it is a relationship or a situationship. Take it and send me yours.", "results": {"going-somewhere": {"title": "This is going somewhere."}, "undefined": {"title": "Undefined. I deserve a straight answer."}, "choose-you": {"title": "Situationship. I'm choosing me."}}}, "red-flag-radar": {"path": "/relationships/tools/red-flag-radar", "share": "I got \"{title}\" on the Red Flag Radar 🚩 He goes quiet for three days. Every ex was crazy. Green flag, let's talk or red flag? Make your calls and send me yours.", "results": {"sharp": {"title": "My radar is sharp."}, "soft": {"title": "I give him the benefit of the doubt."}, "strict": {"title": "I cut first and ask questions later."}, "warming-up": {"title": "My radar is still warming up."}}}, "is-he-husband-material": {"path": "/relationships/tools/is-he-husband-material", "share": "I got \"{title}\" on Is He Husband Material? 👀 Does his word match what he does? Can he say sorry? Check your man and send me your result.", "results": {"showing-it": {"title": "He's showing husband material."}, "promising": {"title": "Promising, with questions to ask."}, "not-yet": {"title": "Not husband material yet."}}}};
  var V = "20261008a";
  function tool() { var m = location.pathname.match(/\/tools\/([^\/?#.]+)/); return m && m[1]; }
  function push(ev, id) { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: ev, share_item: id, share_surface: "result" }); }
  window.wgShowResult = function (type) {
    var box = document.getElementById("wg-result-share"), t = DATA[tool()];
    if (!box || !t) return;
    var r = type && t.results[type];
    box.innerHTML = "";
    box.hidden = !r;
    if (!r) return;
    var id = tool() + ":" + type, img = "/assets/img/results/" + tool() + "/" + type + "-status.jpg?v=" + V;
    box.innerHTML = '<p class="sub">Share your result</p><div class="wg-share" data-share-size="sm"></div>' +
      '<p style="margin:12px 0 0;"><a class="btn btn-ghost" href="' + img + '" download="wholesome-girlies-' + type + '.jpg">Save for your Status</a></p>' +
      '<p class="muted" style="font-size:.85rem;margin:8px 0 0;">The link and the picture show your result only, never your answers.</p>';
    var s = box.querySelector(".wg-share");
    s.setAttribute("data-share-id", id);
    s.setAttribute("data-share-surface", "result");
    s.setAttribute("data-share-path", t.path + "/result/" + type);
    s.setAttribute("data-share-text", t.share.replace("{title}", r.title.replace(/\.$/, "")));
    if (window.wgShareInit) window.wgShareInit();
    box.querySelector("a[download]").addEventListener("click", function (e) {
      push("result_save", id);
      if (!(navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent))) return;
      e.preventDefault();
      fetch(img).then(function (res) { return res.blob(); }).then(function (b) {
        var f = new File([b], "wholesome-girlies-" + type + ".jpg", { type: "image/jpeg" });
        if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f] });
        location.href = img;
      }).catch(function () {});
    });
  };
})();
