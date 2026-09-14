/* boot.js — paint-first loader (opt cycle 11, scorecard 4.7).
   The prerendered page is on screen before the app's JavaScript is even
   requested: this script waits for the first painted frame, then appends the
   module preloads and the entry module that the build listed on its own tag.
   It is an EXTERNAL script on purpose — the build's CSP gate treats any inline
   <script> as a policy regression — and it never stalls hydration: a timer
   fires if the frame callbacks do not (background tab, no rAF). */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var entry = me.getAttribute("data-entry") || "";
  var preload = (me.getAttribute("data-preload") || "").split(",").filter(Boolean);
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var head = document.head;
    for (var i = 0; i < preload.length; i++) {
      var link = document.createElement("link");
      link.rel = "modulepreload";
      link.crossOrigin = "";
      link.href = preload[i];
      head.appendChild(link);
    }
    if (entry) {
      var script = document.createElement("script");
      script.type = "module";
      script.crossOrigin = "";
      script.src = entry;
      head.appendChild(script);
    }
  }
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(function () { requestAnimationFrame(start); });
  }
  setTimeout(start, 1500);
})();
