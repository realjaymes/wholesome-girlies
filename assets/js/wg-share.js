// Share icons for any page: WhatsApp, X, Facebook, Threads, LinkedIn, Instagram, copy link.
// Markup:
//   <div class="wg-share" data-share-id="red-flags-in-a-man" data-share-surface="article"
//        data-share-path="/relationships/guides/red-flags-in-a-man"
//        data-share-text="The share line, written for this page"></div>
// Optional: data-share-x (shorter text for X and Threads), data-share-size="sm" (smaller icons),
// data-share-align="center".
// Links always point at a public page (never a thank-you hub) with ?ref=<channel>, so share
// landings can be counted by channel. The text names the page, not the sender's situation:
// passing on a fertility plan should not announce that she is trying.
// Instagram has no web share link: on phones it opens the share sheet (Instagram is in it),
// on desktop it copies the link and says so.
(function () {
  var SITE = "https://wholesomegirlies.xyz";
  var ICONS = {
      "whatsapp": "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
      "x": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
      "threads": "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z",
      "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
      "instagram": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
      "linkedin": "M4.98 3.5a2.48 2.48 0 110 4.96 2.48 2.48 0 010-4.96zM3 8.98h3.96V21H3zM9.5 8.98h3.8v1.64h.05c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.08V21h-3.96v-5.45c0-1.3-.03-2.98-1.82-2.98-1.83 0-2.11 1.42-2.11 2.89V21H9.5z"
  };
  var LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  function css() {
    if (document.getElementById("wg-share-css")) return;
    var st = document.createElement("style");
    st.id = "wg-share-css";
    st.textContent =
      ".wg-share-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;position:relative}" +
      ".wg-share-row.is-center{justify-content:center}" +
      ".wg-share-btn{width:40px;height:40px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;" +
      "background:var(--white,#fff);border:1.5px solid var(--sand,#DFDCC0);color:var(--plum,#33322A);cursor:pointer;padding:0;transition:.15s ease}" +
      ".wg-share-btn svg{width:18px;height:18px}" +
      ".wg-share-btn:not(.is-link) svg{fill:currentColor}" +
      ".wg-share-btn:hover,.wg-share-btn:focus-visible{background:var(--terracotta,#6E7A3F);border-color:var(--terracotta,#6E7A3F);color:#fff;text-decoration:none}" +
      ".wg-share-row.is-sm .wg-share-btn{width:34px;height:34px}.wg-share-row.is-sm .wg-share-btn svg{width:15px;height:15px}" +
      ".wg-share-msg{font-size:.82rem;font-weight:700;color:var(--terracotta-dark,#55602F);flex-basis:100%;min-height:1.2em;margin:0}" +
      ".wg-share-row.is-center .wg-share-msg{text-align:center}";
    document.head.appendChild(st);
  }

  function track(el, channel) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "share_click",
      share_channel: channel,
      share_item: el.getAttribute("data-share-id") || "",
      share_surface: el.getAttribute("data-share-surface") || ""
    });
  }

  function copyText(text, ok) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, function () { fallback(text, ok); });
    } else fallback(text, ok);
  }
  function fallback(text, ok) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta); ta.select();
    var done = false;
    try { done = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    if (done) ok(); else window.prompt("Copy this link", text);
  }

  function build(el) {
    var path = el.getAttribute("data-share-path") || "/";
    var text = el.getAttribute("data-share-text") || "";
    var shortText = el.getAttribute("data-share-x") || text;
    function url(ref) { return SITE + path + "?ref=" + ref; }
    function enc(s) { return encodeURIComponent(s); }

    var row = document.createElement("div");
    row.className = "wg-share-row" +
      (el.getAttribute("data-share-size") === "sm" ? " is-sm" : "") +
      (el.getAttribute("data-share-align") === "center" ? " is-center" : "");
    var msg = document.createElement("p");
    msg.className = "wg-share-msg";
    msg.setAttribute("aria-live", "polite");
    var timer;
    function say(t) { msg.textContent = t; clearTimeout(timer); timer = setTimeout(function () { msg.textContent = ""; }, 3500); }

    function add(channel, label, svg, href, onClick) {
      var b = document.createElement(href ? "a" : "button");
      b.className = "wg-share-btn" + (channel === "copy" ? " is-link" : "");
      b.setAttribute("aria-label", label);
      b.title = label;
      b.innerHTML = svg;
      if (href) { b.href = href; b.target = "_blank"; b.rel = "noopener"; }
      else b.type = "button";
      b.addEventListener("click", function (e) { track(el, channel); if (onClick) onClick(e, b); });
      row.appendChild(b);
    }
    function icon(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + p + '"/></svg>'; }

    add("whatsapp", "Send on WhatsApp", icon(ICONS.whatsapp), "https://wa.me/?text=" + enc(text + "\n" + url("wa")));
    add("x", "Post on X", icon(ICONS.x), "https://x.com/intent/post?text=" + enc(shortText) + "&url=" + enc(url("x")) + "&via=wgirlieshq");
    add("facebook", "Share on Facebook", icon(ICONS.facebook), "https://www.facebook.com/sharer/sharer.php?u=" + enc(url("fb")));
    add("threads", "Post on Threads", icon(ICONS.threads), "https://www.threads.net/intent/post?text=" + enc(shortText + " " + url("th")));
    add("linkedin", "Share on LinkedIn", icon(ICONS.linkedin), "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(url("li")));
    add("instagram", "Share to Instagram", icon(ICONS.instagram), null, function () {
      var link = url("ig");
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        navigator.share({ text: text, url: link }).catch(function () {});
      } else {
        copyText(link, function () { say("Link copied. Paste it into your Instagram Story or a DM."); });
      }
    });
    add("copy", "Copy link", LINK, null, function (e, b) {
      copyText(url("link"), function () {
        b.innerHTML = CHECK;
        say("Link copied.");
        setTimeout(function () { b.innerHTML = LINK; }, 2000);
      });
    });

    row.appendChild(msg);
    el.appendChild(row);
  }

  function init() { css(); document.querySelectorAll(".wg-share").forEach(function (el) { if (!el.firstChild) build(el); }); }
  window.wgShareInit = init;
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
