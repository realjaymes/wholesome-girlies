/* Reading progress, auto-built section navigation, and share icons.
 * Reads the page's own <h2> elements, so a rewritten page gains its
 * contents list without any extra markup. Pages with fewer than two
 * headings get the share icons only. Load on every guide and tool. */
(function () {
  "use strict";
  var MIN_SECTIONS = 2;

  function slug(t) {
    return t.toLowerCase().trim()
      .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
  }

  /* Sharing runs on every guide and tool, with or without a contents panel.
     Up to three places: the sticky rail on wide screens (share at any point
     while reading), a row near the top (under the byline, or under the tool),
     and a slim row at the end above the program card. On guides with a rail
     the top row shows on phones only; on tools it always shows, because the
     rail waits for the written section and the tool comes first. A tool with
     no written guide under it gets the row under the tool only, because an
     end row would sit straight below it and repeat it.
     The share line is written per page in <meta name="wg:share">; an optional
     <meta name="wg:share-label"> softens the prompt on loss and private pages.
     Icons come from wg-share.js. */
  function addShare(main, rail, isTool, hasGuide) {
    var h1 = main.querySelector("h1");
    if (!h1) return;
    var meta = function (n) { var m = document.querySelector('meta[name="' + n + '"]'); return m ? m.content : ""; };
    var line = meta("wg:share") || h1.textContent.trim();
    var prompt = meta("wg:share-label") || (isTool ? "Know someone who'd use this?" : "Know someone who should read this?");
    var path = location.pathname.replace(/\.html$/, "");
    var makeShare = function (where, size) {
      var t = document.createElement("div");
      t.className = "wg-share";
      t.setAttribute("data-share-id", path.split("/").pop());
      t.setAttribute("data-share-surface", (isTool ? "tool_" : "article_") + where);
      t.setAttribute("data-share-path", path);
      t.setAttribute("data-share-text", line);
      if (size) t.setAttribute("data-share-size", size);
      return t;
    };
    var labelEl = function (text, css) {
      var p = document.createElement("p");
      p.textContent = text;
      p.style.cssText = css;
      return p;
    };

    if (rail) {
      var railShare = document.createElement("div");
      railShare.className = "toc-share";
      railShare.style.cssText = "flex:none;margin-top:16px;";
      railShare.appendChild(labelEl("Share this", "margin:0 0 8px;font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--plum-soft);"));
      railShare.appendChild(makeShare("rail", "sm"));
      rail.insertBefore(railShare, rail.querySelector(".toc-cta"));
    }

    var after = main.querySelector(".byline") || main.querySelector(".tool-app");
    if (after) {
      var top = document.createElement("div");
      top.className = "wg-share-top";
      top.style.cssText = "margin-top:14px;";
      if (isTool) top.appendChild(labelEl(prompt, "margin:0 0 8px;font-size:.9rem;font-weight:700;color:var(--plum);"));
      top.appendChild(makeShare("top", "sm"));
      after.parentNode.insertBefore(top, after.nextSibling);
      if (rail && !isTool) {
        var hideTop = document.createElement("style");
        hideTop.textContent = "@media (min-width:1180px){.wg-share-top{display:none}}";
        document.head.appendChild(hideTop);
      }
    }

    var anchor = main.querySelector(".program-cta");
    if (anchor && (hasGuide || !after)) {
      /* a slim row, not a card, so it never competes with the program card below */
      var end = document.createElement("div");
      end.className = "wg-share-end";
      end.style.cssText = "margin:28px 0 22px;padding:16px 0 10px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);";
      end.appendChild(labelEl(prompt, "margin:0 0 10px;font-size:.95rem;font-weight:700;color:var(--plum);"));
      end.appendChild(makeShare("end"));
      anchor.parentNode.insertBefore(end, anchor);
    }

    var s = document.createElement("script");
    s.src = "/assets/js/wg-share.js?v=20261006c";
    document.body.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.querySelector("main");
    if (!main) return;

    var heads = Array.prototype.filter.call(main.querySelectorAll("h2"), function (h) {
      return h.textContent.trim().length > 1;
    });
    var isTool = /\/tools\//.test(window.location.pathname);
    /* a written guide = headings outside the tool and the program card */
    var hasGuide = !isTool || heads.some(function (h) { return !h.closest(".tool-app, .program-cta"); });
    if (heads.length < MIN_SECTIONS) { addShare(main, null, isTool, hasGuide); return; }

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

    /* On a tool the calculator is the page, so the navigation starts at
       the written answer below it rather than beside the tool. */
    var label = isTool ? "On this page" : "In this guide";

    /* inline, for phones: after the opening paragraph of a guide, or just
       above the written section of a tool so the tool stays first */
    var intro = isTool ? null : (main.querySelector(".tool-hero ~ section p") ||
      main.querySelector("section:nth-of-type(2) p, .wrap.narrow p"));
    var startAt = isTool ? heads[0] : intro;
    var det = document.createElement("details");
    det.className = "toc-inline";
    var sum = document.createElement("summary");
    sum.textContent = label;
    det.appendChild(sum);
    det.appendChild(list());
    if (isTool) {
      heads[0].parentNode.insertBefore(det, heads[0]);
    } else if (intro && intro.parentNode) {
      intro.parentNode.insertBefore(det, intro.nextSibling);
    }

    /* rail, for wide screens */
    var rail = document.createElement("nav");
    rail.className = "toc-rail";
    rail.setAttribute("aria-label", "Sections in this guide");
    var h4 = document.createElement("h4");
    h4.textContent = label;
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
      /* buyers: member-cta.js has already pointed the button at their
         thank-you home, so mirror its wording instead of a "Start" offer */
      var member = /\/thank-you(\.html)?$/.test(href);
      var offer = member
        ? ["Your space", cta.textContent.replace(/\s*→\s*$/, "").trim()]
        : OFFERS[href.replace(/\/$/, "")] ||
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

    addShare(main, rail, isTool, hasGuide);

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
      var waiting = false;
      if (startAt) {
        var top = Math.max(120, Math.round(startAt.getBoundingClientRect().top));
        rail.style.top = top + "px";
        /* keep its settled height while it slides up, like any content
           arriving from below, rather than squeezing the list */
        rail.style.maxHeight = (window.innerHeight - 180) + "px";
        /* on a tool, stay out of sight until the written section arrives */
        waiting = top > window.innerHeight - 220;
      }

      /* step aside before the dark footer slides under the rail */
      var footerNear = footer &&
        footer.getBoundingClientRect().top < rail.getBoundingClientRect().bottom + 32;
      rail.classList.toggle("is-clear", waiting || !!footerNear);
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
