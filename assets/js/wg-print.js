// Print layout for printable tools (styles live in wg-print.css, loaded media="print").
// Adds a branded header and a QR footer that only show on paper, and sends print_click to GA4.
// The QR for each tool is a static file in /assets/img/qr/<slug>.svg (scripts/make-print-qr.js).
(function () {
  function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function init() {
    var main = document.querySelector("main");
    if (!main) return;
    var h1 = main.querySelector("h1");
    var title = h1 ? h1.textContent.trim() : document.title;
    var path = location.pathname.replace(/\.html$/, "").replace(/\/$/, "");
    var slug = path.split("/").pop();

    var head = document.createElement("div");
    head.className = "wg-print-head";
    head.hidden = true;
    head.innerHTML =
      '<div class="wg-print-row"><span class="wg-print-brand">Wholesome Girlies</span><span class="wg-print-date"></span></div>' +
      '<div class="wg-print-title">' + esc(title) + "</div>";
    main.insertBefore(head, main.firstChild);

    var foot = document.createElement("div");
    foot.className = "wg-print-foot";
    foot.hidden = true;
    foot.innerHTML =
      '<div class="wg-print-qr"><img src="/assets/img/qr/' + esc(slug) + '.svg" alt="">' +
      "<span><strong>Make your own " + esc(title) + "</strong><br>Scan the code or visit wholesomegirlies.xyz" + esc(path) + "</span></div>";
    main.appendChild(foot);

    // checklists of short items print in two columns so they fit one page
    function columns() {
      document.querySelectorAll(".tool-app .checklist").forEach(function (ul) {
        var labels = ul.querySelectorAll("label"), total = 0;
        labels.forEach(function (l) { total += l.textContent.length; });
        ul.classList.toggle("wg-print-cols", labels.length > 8 && total / labels.length < 45);
      });
    }
    window.addEventListener("beforeprint", columns);

    function stamp() {
      head.querySelector(".wg-print-date").textContent =
        new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    }
    stamp();
    window.addEventListener("beforeprint", stamp);

    document.querySelectorAll("[data-wg-print]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "print_click", tool: slug });
      });
    });
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
