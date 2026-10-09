/* One question at a time on the quizzes and games.
   A .tool-app with data-steps="<question selector>" shows its questions one by one: a count and progress bar on top,
   tap an answer and the next question slides in, Back steps back. The result button shows once the last question is
   answered. Without JavaScript every question shows, as before. A "Start over" button inside the tool goes back to
   question 1. Load it with defer after the page's own script, because some quizzes build their questions in script. */
(function (w, d) {
  var CSS =
    '.st-head{display:flex;align-items:center;gap:12px;margin:0 0 16px}' +
    '.st-count{flex:none;font-weight:800;font-size:.9rem}' +
    '.st-bar{flex:1;height:12px;border-radius:8px;background:#fff;border:1.5px solid var(--ink,#33322A);overflow:hidden}' +
    '.st-bar span{display:block;height:100%;width:0;background:var(--s,#6E7A3F);transition:width .3s ease}' +
    '.st-q{display:none}.st-q.st-on{display:block;animation:stIn .28s ease}' +
    '@keyframes stIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.st-q.st-on{animation:none}.st-bar span{transition:none}}' +
    '.st-q .qtext{display:block;font-size:1.12rem;line-height:1.4;margin:0 0 14px;min-height:3.2em}' +
    '.st-nav{display:flex;align-items:center;margin:16px 0 0}' +
    '.st-back{background:none;border:0;font:inherit;font-weight:800;color:var(--ink,#33322A);cursor:pointer;padding:8px 0}' +
    '.st-back[disabled]{visibility:hidden}' +
    '.st-hide{display:none!important}' +
    '.rq.st-q .rq-opts{flex-direction:column;align-items:stretch}.rq.st-q .rq-opts label{text-align:center;padding:12px}';

  function start(app) {
    var qs = [].slice.call(d.querySelectorAll(app.getAttribute('data-steps')));
    var go = app.querySelector('.btn-primary');
    if (qs.length < 2 || !go) return;
    if (!d.getElementById('wg-steps-css')) {
      var css = d.createElement('style'); css.id = 'wg-steps-css'; css.textContent = CSS; d.head.appendChild(css);
    }
    var goRow = go.parentNode !== app ? go.parentNode : go;
    var i = 0, total = qs.length;
    qs.forEach(function (q) {
      q.classList.add('st-q');
      var t = q.querySelector('.qtext');
      if (t) t.textContent = t.textContent.replace(/^\d+\.\s*/, '');
    });
    var head = d.createElement('div');
    head.className = 'st-head';
    head.innerHTML = '<span class="st-count" aria-live="polite"></span><span class="st-bar" aria-hidden="true"><span></span></span>';
    qs[0].parentNode.insertBefore(head, qs[0]);
    var nav = d.createElement('div');
    nav.className = 'st-nav';
    nav.innerHTML = '<button type="button" class="st-back">&larr; Back</button>';
    goRow.parentNode.insertBefore(nav, goRow);
    var back = nav.querySelector('.st-back');

    function answered(q) { return !!q.querySelector('input:checked'); }
    function show(k, scroll) {
      i = Math.max(0, Math.min(total - 1, k));
      qs.forEach(function (q, n) { q.classList.toggle('st-on', n === i); });
      head.querySelector('.st-count').textContent = 'Question ' + (i + 1) + ' of ' + total;
      head.querySelector('.st-bar span').style.width = ((i + (answered(qs[i]) ? 1 : 0)) / total * 100) + '%';
      back.disabled = i === 0;
      goRow.classList.toggle('st-hide', !(i === total - 1 && answered(qs[i])));
      if (scroll) {
        var top = head.getBoundingClientRect().top + w.scrollY - 110;
        if (Math.abs(w.scrollY - top) > 60) w.scrollTo({ top: top, behavior: 'smooth' });
      }
    }
    app.addEventListener('change', function (e) {
      var q = e.target.closest && e.target.closest('.st-q');
      if (!q || qs.indexOf(q) !== i) return;
      show(i);
      var from = i;
      if (from < total - 1) setTimeout(function () { if (i === from) show(from + 1, true); }, 380);
    });
    back.addEventListener('click', function () { show(i - 1, true); });
    app.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b && /start over/i.test(b.textContent)) setTimeout(function () { show(0, true); }, 0);
    });
    show(0);
  }

  function init() { [].forEach.call(d.querySelectorAll('.tool-app[data-steps]'), start); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
