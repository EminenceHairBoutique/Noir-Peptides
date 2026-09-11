/*
  scripts/test-assert-prerender-data.mjs   (Sept-11 T2)
  Feeds scripts/assert-prerender-data.mjs shell and populated HTML fixtures
  under fake env and proves:
    - env present + shell output → throws, naming the route and what is missing;
    - env present + populated output → passes;
    - env absent → skipped (today's shell behaviour is preserved);
    - hasDbEnv honours both the VITE_ and plain variable names.

  Run: node scripts/test-assert-prerender-data.mjs   (wired into npm run test:unit)
*/
import { assertPrerenderData, hasDbEnv, missingFor, rootOf } from "./assert-prerender-data.mjs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const throwsWith = (fn, needle) => {
  try {
    fn();
    return false;
  } catch (e) {
    return String(e.message).includes(needle);
  }
};

const ENV_ON = { VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" };
const ENV_OFF = {};

// Fixtures: the shapes the generator really emits, wrapped in a page skeleton.
const page = (body) => `<!doctype html><html><head><title>t</title></head><body><div id="root">${body}</div><script src="/a.js"></script></body></html>`;
const TEST_RESULTS_SHELL = page(
  "<main><h1>Test Results &amp; Certificates of Analysis</h1><p>intro</p><p><strong>For research use only.</strong></p></main>"
);
const TEST_RESULTS_FULL = page(
  "<main><h1>Test Results</h1>" +
    '<section aria-label="Certificate library summary"><div><strong>3</strong> products with published certificates</div></section>' +
    "<h2>BPC-157</h2><table><caption>c</caption><thead><tr><th>Lot</th></tr></thead><tbody><tr><th scope=\"row\">L1</th><td>99.1%</td></tr></tbody></table>" +
    "<p><strong>For research use only.</strong></p></main>"
);
const TEST_RESULTS_COUNTERS_ONLY = page(
  '<main><h1>Test Results</h1><section aria-label="Certificate library summary"><div><strong>0</strong></div></section></main>'
);
const DOCUMENTS_SHELL = page("<main><h1>Document Library</h1><h2>Safety Data Sheets</h2><p>Published Safety Data Sheets are listed here.</p></main>");
const DOCUMENTS_EMPTY_LIST = page('<main><h1>Document Library</h1><section id="sds-list" data-sds-count="0"><p>No Safety Data Sheets are published yet.</p></section></main>');
const DOCUMENTS_FULL = page('<main><h1>Document Library</h1><section id="sds-list" data-sds-count="2"><ul><li>a</li><li>b</li></ul></section></main>');

console.log("hasDbEnv:");
ok(hasDbEnv(ENV_ON) === true, "VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → present");
ok(hasDbEnv({ SUPABASE_URL: "u", SUPABASE_ANON_KEY: "k" }) === true, "plain SUPABASE_URL + SUPABASE_ANON_KEY → present");
ok(hasDbEnv({ VITE_SUPABASE_URL: "u" }) === false, "URL without a key → absent");
ok(hasDbEnv({ VITE_SUPABASE_ANON_KEY: "k" }) === false, "key without a URL → absent");
ok(hasDbEnv({ VITE_SUPABASE_URL: "  ", VITE_SUPABASE_ANON_KEY: "k" }) === false, "whitespace URL → absent");
ok(hasDbEnv(ENV_OFF) === false, "empty env → absent");

console.log("\nrootOf / missingFor:");
ok(rootOf("<html><body>no root</body></html>") === "", "no #root → empty string (never throws)");
ok(missingFor("/test-results", TEST_RESULTS_SHELL).join("+") === "counters block+at least one certificate row", "shell /test-results is missing both markers");
ok(missingFor("/test-results", TEST_RESULTS_COUNTERS_ONLY).join("+") === "at least one certificate row", "counters without rows → rows missing");
ok(missingFor("/test-results", TEST_RESULTS_FULL).length === 0, "populated /test-results → nothing missing");
ok(missingFor("/documents", DOCUMENTS_SHELL).join("+") === "SDS list container", "shell /documents is missing the container");
ok(missingFor("/documents", DOCUMENTS_EMPTY_LIST).length === 0, "an EMPTY SDS list still satisfies the container rule (no sheets published is honest)");
ok(missingFor("/documents", DOCUMENTS_FULL).length === 0, "populated /documents → nothing missing");
ok(throwsWith(() => missingFor("/shop", ""), "unknown route"), "unknown route is a programming error, not a silent pass");

console.log("\nassertPrerenderData — env present + shell → FAIL naming the route:");
ok(
  throwsWith(() => assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_SHELL, "/documents": DOCUMENTS_FULL }, env: ENV_ON }), "/test-results: missing counters block + at least one certificate row"),
  "shell /test-results fails and names the route + what is missing"
);
ok(
  throwsWith(() => assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_FULL, "/documents": DOCUMENTS_SHELL }, env: ENV_ON }), "/documents: missing SDS list container"),
  "shell /documents fails and names the route"
);
ok(
  throwsWith(() => assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_SHELL, "/documents": DOCUMENTS_SHELL }, env: ENV_ON }), "/documents"),
  "both shells → both routes reported in one failure"
);
ok(
  throwsWith(() => assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_FULL }, env: ENV_ON }), "/documents: not emitted"),
  "a missing page is reported, not skipped"
);
ok(
  throwsWith(() => assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_SHELL, "/documents": DOCUMENTS_FULL }, env: ENV_ON }), "Supabase credentials were present"),
  "the message explains WHY a shell is a failure"
);

console.log("\nassertPrerenderData — env present + real data → pass:");
{
  const r = assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_FULL, "/documents": DOCUMENTS_EMPTY_LIST }, env: ENV_ON });
  ok(r.ok === true && r.skipped === false, "passes");
  ok(r.checked.join(",") === "/test-results,/documents", "both routes were checked");
}

console.log("\nassertPrerenderData — env absent → today's shell behaviour is kept:");
{
  const r = assertPrerenderData({ pages: { "/test-results": TEST_RESULTS_SHELL, "/documents": DOCUMENTS_SHELL }, env: ENV_OFF });
  ok(r.ok === true && r.skipped === true, "shells pass when there is no env (skipped, not failed)");
  ok(r.checked.length === 0, "nothing is checked without env");
}

if (failures) {
  console.error(`\n${failures} assert-prerender-data check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll assert-prerender-data checks passed.");
