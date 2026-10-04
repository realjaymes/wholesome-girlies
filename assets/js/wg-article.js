/* Reading progress + auto-built section navigation.
 * Reads the article's own <h2> elements, so a rewritten page gains its
 * contents list without any extra markup. Does nothing on short pages. */
(function () {
  "use strict";
  var MIN_SECTIONS = 3;

  function slug(t) {
    return t.toLowerCase().trim()
      .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector("main");
    if (!main) return;

    var heads = Array.prototype.filter.call(main.querySelectorAll("h2"), function (h) {
      return h.textContent.trim().length > 1;
    });
    if (heads.length < MIN_SECTIONS) return;

    var used = {};
    heads.forEach(function (h) {
      if (h.id) return;
      var s = slug(h.textContent) || "section";
      used[s] = (used[s] || 0) + 1;
      h.id = used[s] > 1 ? s + "-" + used[s] : s;
    });

    /* progress bar */
    var bar = document.createElement("div");
    bar.className = "read-progress";
    bar.setAttribute("role", "presentation");
    document.body.appendChild(bar);

    /* the list, built once and used in both places */
    function list(ordered) {
      var ol = document.createElement("ol");
      heads.forEach(function (h) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent.trim();
        li.appendChild(a);
        ol.appendChild(li);
      });
      return ol;
    }

    /* inline, for phones: after the opening paragraph */
    var intro = main.querySelector(".tool-hero ~ section p") ||
      main.querySelector("section:nth-of-type(2) p, .wrap.narrow p");
    if (intro && intro.parentNode) {
      var det = document.createElement("details");
      det.className = "toc-inline";
      var sum = document.createElement("summary");
      sum.textContent = "In this guide";
      det.appendChild(sum);
      det.appendChild(list());
      intro.parentNode.insertBefore(det, intro.nextSibling);
    }

    /* rail, for wide screens */
    var rail = document.createElement("nav");
    rail.className = "toc-rail";
    rail.setAttribute("aria-label", "Sections in this guide");
    var h4 = document.createElement("h4");
    h4.textContent = "In this guide";
    rail.appendChild(h4);
    rail.appendChild(list());

    /* the guide's own program button, pinned under the headings so it
       travels with the reader instead of waiting at the end */
    var OFFERS = {
      "/programs/trying-to-conceive-blueprint": ["Trying to conceive?", "Start the TTC Blueprint"],
      "/programs/first-pregnancy-plan": ["Pregnant for the first time?", "Start the Pregnancy Plan"],
      "/programs/postpartum-reset": ["Just had your baby?", "Start the Postpartum Reset"],
      "/programs/first-baby-playbook": ["New baby at home?", "Start the First Baby Playbook"],
      "/programs/wife-material-blueprint": ["Dating for marriage?", "Start the Wife Material Blueprint"]
    };
    var cta = main.querySelector(".program-cta a.btn");
    var ctaName = main.querySelector(".program-cta h3");
    if (cta) {
      var href = cta.getAttribute("href");
      var offer = OFFERS[href.replace(/\/$/, "")] ||
        [null, "Start " + (ctaName ? ctaName.textContent.trim() : "the program")];
      var box = document.createElement("div");
      box.className = "toc-cta";
      if (offer[0]) {
        var hook = document.createElement("p");
        hook.textContent = offer[0];
        box.appendChild(hook);
      }
      var btn = document.createElement("a");
      btn.className = "btn btn-primary";
      btn.href = href;
      btn.textContent = offer[1];
      box.appendChild(btn);
      rail.appendChild(box);
    }
    document.body.appendChild(rail);
    var links = rail.querySelectorAll("ol a");
    var footer = document.querySelector(".site-footer");

    function onScroll() {
      var start = main.offsetTop;
      var len = main.offsetHeight - window.innerHeight;
      var done = len > 0 ? (window.pageYOffset - start) / len : 1;
      bar.style.width = Math.max(0, Math.min(1, done)) * 100 + "%";

      var here = 0;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= 120) here = i;
      }
      for (var j = 0; j < links.length; j++) {
        links[j].classList.toggle("is-current", j === here);
      }

      /* start level with the article's opening paragraph, then hold at
         the same 120px the section highlight reads from */
      if (intro) {
        var top = Math.max(120, Math.round(intro.getBoundingClientRect().top));
        rail.style.top = top + "px";
        rail.style.maxHeight = (window.innerHeight - top - 60) + "px";
      }

      /* step aside before the dark footer slides under the rail */
      if (footer) {
        rail.classList.toggle("is-clear",
          footer.getBoundingClientRect().top < rail.getBoundingClientRect().bottom + 32);
      }
    }

    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { onScroll(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  });
})();
