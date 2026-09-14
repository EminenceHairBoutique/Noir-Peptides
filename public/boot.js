/* boot.js — paint-first loader (opt cycle 11, scorecard 4.7).
   The prerendered page is on screen before the app's JavaScript is even
   requested: this script waits for the first contentful paint, then appends
   the module preloads and the entry module that the build listed on its own
   tag. It is an EXTERNAL script on purpose — the build's CSP gate treats any
   inline <script> as a policy regression — and it never stalls hydration: a
   timer fires if no paint is ever reported (background tab, no rAF).

   Opt cycle 12: the trigger is the paint-timing entry itself, not two
   animation frames. Two frames raced the first paint by a few milliseconds;
   whenever the bundle's request began just before the paint, Lighthouse's
   simulation charged the whole bundle to first paint and the LCP median
   flipped between 1.5 s and 2.8 s from run to run (cycle-12 lane, same
   build). The entry is delivered only after the frame is on screen, so the
   request now starts after the paint every time. Frames remain the fallback
   where paint timing is unsupported. */
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
  var afterPaint = false;
  try {
    var types = typeof PerformanceObserver === "function" ? PerformanceObserver.supportedEntryTypes : null;
    if (types && types.indexOf("paint") !== -1) {
      var po = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var j = 0; j < entries.length; j++) {
          if (entries[j].name === "first-contentful-paint") {
            po.disconnect();
            start();
            return;
          }
        }
      });
      po.observe({ type: "paint", buffered: true });
      afterPaint = true;
    }
  } catch (e) {
    afterPaint = false;
  }
  if (!afterPaint && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(function () { requestAnimationFrame(start); });
  }
  setTimeout(start, 1500);
})();
