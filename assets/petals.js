/* Wholesome Girlies thank-you celebration — a gentle fall of leaves & petals.
 * Warmer and calmer than confetti, on brand (Olive & Cream, the Sprig motif).
 * Lightweight canvas, no dependencies. Fires once per session per page, on load.
 * Reduced-motion aware. Include on post-purchase pages:
 *   <script src="/assets/petals.js"></script>
 */
(function () {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var KEY = 'wg_petals_' + location.pathname;
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch (e) {}

  function run() {
    // Brand-warm palette: olive, rust, sand, blush, soft peach, warm tan.
    var colors = ['#6E7A3F', '#C0763F', '#DFDCC0', '#EAE9D2', '#E4C6A0', '#C9B292'];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99998';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), W, H;
    function size() {
      W = cv.width = window.innerWidth * dpr;
      H = cv.height = window.innerHeight * dpr;
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
    }
    size();
    window.addEventListener('resize', size);

    // Fewer, softer, slower than confetti — a calm drift, not a burst.
    var N = 46, P = [];
    for (var i = 0; i < N; i++) {
      P.push({
        x: Math.random() * W,
        y: Math.random() * -H * 0.6,
        len: (14 + Math.random() * 14) * dpr,   // leaf length
        wid: (7 + Math.random() * 7) * dpr,     // leaf width
        c: colors[i % colors.length],
        vy: (0.9 + Math.random() * 1.8) * dpr,  // gentle fall
        vx: (-0.6 + Math.random() * 1.2) * dpr,
        rot: Math.random() * 6.28,
        vr: -0.06 + Math.random() * 0.12,       // slow spin
        sway: Math.random() * 6.28,
        swayAmp: (0.6 + Math.random() * 1.2) * dpr,
        alpha: 0.72 + Math.random() * 0.24,
        leaf: Math.random() > 0.35               // most leaves, some round petals
      });
    }

    function drawLeaf(p) {
      var l = p.len / 2, w = p.wid / 2;
      ctx.beginPath();
      ctx.moveTo(0, -l);
      ctx.quadraticCurveTo(w, 0, 0, l);
      ctx.quadraticCurveTo(-w, 0, 0, -l);
      ctx.closePath();
      ctx.fill();
      // faint midrib for a leaf feel
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = 'rgba(51,50,42,0.35)';
      ctx.lineWidth = Math.max(1, 0.6 * dpr);
      ctx.beginPath();
      ctx.moveTo(0, -l * 0.85);
      ctx.lineTo(0, l * 0.85);
      ctx.stroke();
    }

    function drawPetal(p) {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.wid / 2, p.len / 2, 0, 0, 6.2832);
      ctx.fill();
    }

    var start = null, DUR = 5200;
    function frame(ts) {
      if (!start) start = ts;
      var t = ts - start;
      ctx.clearRect(0, 0, W, H);
      var fade = t > DUR - 1200 ? Math.max(0, (DUR - t) / 1200) : 1;
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        p.sway += 0.03;
        p.x += p.vx + Math.sin(p.sway) * p.swayAmp;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade * p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.leaf) drawLeaf(p); else drawPetal(p);
        ctx.restore();
      }
      if (t < DUR) {
        requestAnimationFrame(frame);
      } else {
        cv.remove();
        window.removeEventListener('resize', size);
      }
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
