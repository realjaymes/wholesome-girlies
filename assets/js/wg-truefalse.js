/* Sourced true or false, and sourced guessing, one claim per screen.
   A page defines window.WG_TF before this script runs:
     {
       root: "#tf-app",                     // the .tool-app that holds #tf-stage and the .result panel
       items: [ ... ],                      // see below
       max: 10,                             // top score (items x points)
       pickResult: function (score, max) { return "<result type>"; },
       results: { "<type>": ["band", "headline", "summary"] },
       onResult: function (type) {}         // the page calls wgShowResult(type) here
     }
   A true-or-false item: { q, a: "true" | "false" | "depends", why, src: [{ n, u }] }
   A guess item:         { q, opts: [{ t, p }], ans, why, src: [{ n, u }] }   (p = points, 0 to 2)
   She taps an answer, the answer and its source show straight away, then Next. Nothing is saved or sent. */
(function (w, d) {
  var CSS =
    '.tf-head{display:flex;align-items:center;gap:12px;margin:0 0 16px}' +
    '.tf-count{flex:none;font-weight:800;font-size:.9rem}' +
    '.tf-bar{flex:1;height:12px;border-radius:8px;background:#fff;border:1.5px solid var(--ink,#33322A);overflow:hidden}' +
    '.tf-bar span{display:block;height:100%;width:0;background:var(--s,#6E7A3F);transition:width .3s ease}' +
    '.tf-card{border:2px solid var(--ink,#33322A);border-radius:var(--radius,16px);background:var(--s-t,#F3EFE4);padding:20px 18px;box-shadow:3px 3px 0 var(--ink,#33322A)}' +
    '.tf-tag{display:inline-block;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px}' +
    '.tf-claim{font-size:1.2rem;line-height:1.4;font-weight:800;margin:0}' +
    '.tf-opts{display:flex;flex-direction:column;gap:10px;margin:16px 0 0}' +
    '.tf-opts button{font:inherit;font-weight:800;text-align:center;border:2px solid var(--ink,#33322A);background:#fff;border-radius:var(--radius-sm,10px);padding:13px 14px;cursor:pointer;color:var(--ink,#33322A);box-shadow:2px 2px 0 var(--ink,#33322A)}' +
    '.tf-opts button:hover{background:var(--s-t,#F3EFE4)}' +
    '.tf-opts button:focus-visible{outline:3px solid var(--s,#6E7A3F);outline-offset:3px}' +
    '.tf-opts button[disabled]{cursor:default;box-shadow:none;opacity:.55}' +
    '.tf-opts button.tf-picked{opacity:1;background:var(--s-t,#F3EFE4)}' +
    '.tf-reveal{margin:16px 0 0;padding:16px 18px;border:2px solid var(--ink,#33322A);border-radius:var(--radius-sm,10px);background:#fff}' +
    '.tf-reveal:focus{outline:none}' +
    '.tf-flag{font-weight:800;margin:0 0 4px}' +
    '.tf-flag.tf-yes{color:var(--terracotta-dark,#4F5A2B)}' +
    '.tf-flag.tf-no{color:var(--sage,#9A4A2E)}' +
    '.tf-ans{font-size:1.1rem;font-weight:800;margin:0 0 8px}' +
    '.tf-why{margin:0 0 10px}' +
    '.tf-src{font-size:.92rem;margin:0}' +
    '.tf-src a{font-weight:700;text-decoration:underline}' +
    '.tf-next{margin:14px 0 0}' +
    '#tf-review{list-style:none;padding:0;margin:8px 0 0}' +
    '#tf-review li{padding:12px 0;border-bottom:1px solid var(--line,#E4DFD0)}' +
    '#tf-review p{margin:4px 0 0}' +
    '#tf-review .tf-pick{font-size:.9rem;font-weight:800}' +
    '.tf-score{font-weight:800;margin:0 0 4px}' +
    '@media (prefers-reduced-motion:reduce){.tf-bar span{transition:none}}';

  var LABEL = { "true": "True", "false": "False", depends: "It depends" };

  function el(tag, cls, text) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function sources(list, lead) {
    var p = el("p", "tf-src");
    p.appendChild(d.createTextNode(lead || (list.length > 1 ? "Sources: " : "Source: ")));
    list.forEach(function (s, i) {
      if (i) p.appendChild(d.createTextNode("; "));
      var a = el("a", null, s.n);
      a.href = s.u; a.target = "_blank"; a.rel = "noopener";
      p.appendChild(a);
    });
    return p;
  }

  function start(cfg) {
    var root = d.querySelector(cfg.root || "#tf-app");
    var stage = root && root.querySelector("#tf-stage");
    var res = d.getElementById("res");
    if (!root || !stage || !cfg.items || !cfg.items.length) return;
    if (!d.getElementById("wg-tf-css")) {
      var css = el("style"); css.id = "wg-tf-css"; css.textContent = CSS; d.head.appendChild(css);
    }
    var items = cfg.items, total = items.length, i = 0, score = 0, picks = [], locked = false;
    var guess = !!items[0].opts;

    function choicesOf(it) {
      if (it.opts) return it.opts.map(function (o) { return { t: o.t, p: o.p }; });
      return ["true", "false", "depends"].map(function (k) { return { t: LABEL[k], p: k === it.a ? 1 : 0 }; });
    }

    function render() {
      var it = items[i], ch = choicesOf(it);
      locked = false;
      stage.innerHTML = "";
      var head = el("div", "tf-head");
      var cnt = el("span", "tf-count", (guess ? "Milestone " : "Claim ") + (i + 1) + " of " + total);
      cnt.setAttribute("aria-live", "polite");
      var bar = el("span", "tf-bar"); bar.setAttribute("aria-hidden", "true");
      var fill = el("span"); fill.style.width = (i / total * 100) + "%"; bar.appendChild(fill);
      head.appendChild(cnt); head.appendChild(bar); stage.appendChild(head);

      var card = el("div", "tf-card");
      card.appendChild(el("p", "tf-tag", guess ? "Guess the age" : "True or false?"));
      card.appendChild(el("p", "tf-claim", it.q));
      var opts = el("div", "tf-opts");
      opts.setAttribute("role", "group");
      opts.setAttribute("aria-label", guess ? "Pick an age" : "Pick an answer");
      ch.forEach(function (c, k) {
        var b = el("button", null, c.t); b.type = "button";
        b.addEventListener("click", function () { answer(k, ch, opts, card, fill); });
        opts.appendChild(b);
      });
      card.appendChild(opts);
      stage.appendChild(card);
    }

    function answer(k, ch, opts, card, fill) {
      if (locked) return;
      locked = true;
      var it = items[i], c = ch[k], got = c.p;
      score += got;
      picks.push({ t: c.t, p: got });
      [].forEach.call(opts.children, function (b, n) {
        b.disabled = true;
        if (n === k) b.classList.add("tf-picked");
      });
      fill.style.width = ((i + 1) / total * 100) + "%";

      var rv = el("div", "tf-reveal"); rv.tabIndex = -1;
      var full = guess ? 2 : 1;
      var flag = guess
        ? (got === full ? "Spot on. 2 of 2 points." : got ? "Close. " + got + " of 2 points." : "Not this time. 0 of 2 points.")
        : (got ? "You got it." : "Not quite.");
      rv.appendChild(el("p", "tf-flag " + (got ? "tf-yes" : "tf-no"), flag));
      rv.appendChild(el("p", "tf-ans", guess ? it.ans : "The answer: " + LABEL[it.a] + "."));
      rv.appendChild(el("p", "tf-why", it.why));
      rv.appendChild(sources(it.src));
      var last = i === total - 1;
      var nx = el("button", "btn btn-primary tf-next", last ? "See my result" : (guess ? "Next milestone" : "Next claim"));
      nx.type = "button";
      nx.addEventListener("click", function () { if (last) finish(); else { i++; render(); scrollTop(); } });
      rv.appendChild(nx);
      card.appendChild(rv);
      rv.focus({ preventScroll: true });
      var r = rv.getBoundingClientRect();
      if (r.bottom > w.innerHeight - 10) w.scrollBy({ top: r.bottom - w.innerHeight + 24, behavior: "smooth" });
    }

    function scrollTop() {
      var t = root.getBoundingClientRect().top + w.scrollY - 90;
      if (Math.abs(w.scrollY - t) > 60) w.scrollTo({ top: t, behavior: "smooth" });
    }

    function finish() {
      var type = cfg.pickResult(score, cfg.max || total), r = cfg.results[type];
      stage.hidden = true;
      d.getElementById("band").textContent = r[0];
      d.getElementById("headline").textContent = r[1];
      d.getElementById("summary").textContent = r[2];
      d.getElementById("tf-score").textContent = guess
        ? "Your guesses scored " + score + " out of " + (cfg.max || total * 2) + " points."
        : "You got " + score + " of " + total + " right.";
      var ul = d.getElementById("tf-review");
      ul.innerHTML = "";
      items.forEach(function (it, n) {
        var li = el("li");
        li.appendChild(el("strong", null, it.q));
        li.appendChild(el("p", "tf-pick", "You picked: " + picks[n].t + (guess ? "" : ". Answer: " + LABEL[it.a] + ".")));
        li.appendChild(el("p", "muted", guess ? it.ans : it.why));
        li.appendChild(sources(it.src));
        ul.appendChild(li);
      });
      if (typeof cfg.onResult === "function") cfg.onResult(type);
      res.classList.add("show");
      res.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function again() {
      i = 0; score = 0; picks = [];
      res.classList.remove("show");
      stage.hidden = false;
      if (typeof cfg.onResult === "function") cfg.onResult(null);
      render();
      scrollTop();
    }

    var rb = d.getElementById("tf-again");
    if (rb) rb.addEventListener("click", again);
    render();
  }

  function init() { if (w.WG_TF) start(w.WG_TF); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init); else init();
})(window, document);
