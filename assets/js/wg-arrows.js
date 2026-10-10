/* The Wholesome Girlies arrow (CLAUDE.md section 7). Swaps the text arrows (→ ← ›) on links and buttons for an inline SVG arrow,
   styled by wg-arrows.css, and keeps doing it for text that scripts write later. Without JavaScript the text arrows stay. */
(function () {
  document.documentElement.setAttribute('data-arrow', 'a');
  var NS = 'http://www.w3.org/2000/svg';
  function icon(kind) {
    var s = document.createElement('span');
    s.className = 'wga' + (kind === 'back' ? ' wga--back' : '') + (kind === 'chev' ? ' wga--chev' : '');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 12 12" focusable="false"><path d="M2.4 9.6 L9.6 2.4 M3.2 2.4 H9.6 V8.8"/></svg>';
    return s;
  }
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|TITLE|NOSCRIPT)$/;
  function inTarget(n) {
    for (var e = n.parentNode; e && e.nodeType === 1; e = e.parentNode) {
      if (e.classList.contains('wga') || e.classList.contains('ts-arrow') || SKIP.test(e.tagName)) return false;
      if (e.tagName === 'A' || e.tagName === 'BUTTON' || e.classList.contains('arrow') || e.classList.contains('ph-chev')) return true;
      if (e.tagName === 'P' || e.tagName === 'LI' || e.tagName === 'SECTION') return false;
    }
    return false;
  }
  function run(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), hits = [], n;
    while ((n = w.nextNode())) { if (/[→←›]/.test(n.nodeValue) && inTarget(n)) hits.push(n); }
    hits.forEach(function (t) {
      var v = t.nodeValue, p = t.parentNode, a;
      if ((a = /^(\s*)›\s*$/.exec(v))) { p.replaceChild(icon('chev'), t); return; }
      if ((a = /^([\s\S]*?)\s*→\s*$/.exec(v))) { p.insertBefore(document.createTextNode(a[1]), t); p.insertBefore(icon('fwd'), t); p.removeChild(t); return; }
      if ((a = /^\s*←\s*([\s\S]*)$/.exec(v))) { p.insertBefore(icon('back'), t); p.insertBefore(document.createTextNode(a[1]), t); p.removeChild(t); }
    });
  }
  var queued = false;
  function queue() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; run(document.body); }); }
  run(document.body);
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
