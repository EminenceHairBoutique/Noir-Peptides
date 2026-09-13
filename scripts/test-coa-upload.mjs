/*
  scripts/test-coa-upload.mjs   (opt cycle 10 — addendum C8; scorecards 4.4 / 4.11 / 4.2)
  Executes the REAL api/admin/coa-upload.js and api/coa-file/[name].js
  handlers against the in-memory Supabase + Storage stubs:
    - a JPEG named ".pdf" is rejected by its bytes (415), nothing stored;
    - 4 MB + 1 byte → 413 before anything is buffered;
    - a real PDF → stored under coas/<id>/<sha16>.pdf in the private bucket,
      the row's file_url becomes /api/coa-file/<id>.pdf, no secret leaks;
    - the public route: unpublished → 404; published → 302 to a signed URL
      with no-store; a made-up name → 404; a second upload of the same bytes
      is idempotent.
  Run: node scripts/test-coa-upload.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
const outfile = path.join(process.cwd(), `.coa-upload-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
  } }],
});
const { coaUploadHandler, coaFileHandler, readRawBody, FIXTURES, LOG, STORAGE } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);

function makeRes() { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.end = (p) => { if (p != null) { try { r.payload = JSON.parse(p); } catch { r.payload = p; } } return r; }; return r; }
const upload = async (id, body, extra = {}) => { const r = makeRes(); await coaUploadHandler({ method: "POST", headers: { "x-coa-id": id, "content-type": "application/pdf", ...extra }, body }, r); return r; };
const getFile = async (name) => { const r = makeRes(); await coaFileHandler({ method: "GET", url: `/api/coa-file/${name}`, query: { name }, headers: {} }, r); return r; };
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj <</Type /Catalog>> endobj\n"), Buffer.alloc(2048, 0x20), Buffer.from("\n%%EOF\n")]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), Buffer.alloc(512, 0)]);
FIXTURES.coas.push({ id: 7, product_id: "bpc-157", lot_number: "L-7", is_published: false, file_url: null, file_path: null });
FIXTURES.coas.push({ id: 8, product_id: "bpc-157", lot_number: "L-8", is_published: true, file_url: "https://example.test/old.pdf", file_path: null });

console.log("Upload endpoint:");
{
  let r = await upload("7", Buffer.concat([Buffer.from("hello, not a certificate at all "), Buffer.alloc(64, 0x20)]), { "x-file-name": "cert.pdf" });
  ok(r.statusCode === 415 && /content/.test(r.payload?.error || ""), "text bytes named .pdf are rejected by their bytes (415)");
  ok(!LOG.some((l) => l.op === "upload"), "nothing stored on rejection");
  const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(4 * 1024 * 1024, 0x41)]); // 4 MB + header
  r = await upload("7", big);
  ok(r.statusCode === 413, `4 MB + 1 byte → 413 (got ${r.statusCode})`);
  r = await upload("", PDF);
  ok(r.statusCode === 400, "missing x-coa-id → 400");
  r = await upload("999", PDF);
  ok(r.statusCode === 404, "unknown certificate → 404");
  r = await upload("7", JPEG, { "content-type": "application/pdf", "x-file-name": "cert.pdf" });
  let stored = LOG.filter((l) => l.op === "upload").pop();
  ok(r.statusCode === 200 && /\.jpg$/.test(stored?.path || "") && r.payload?.type === "image/jpeg", "JPEG bytes sent as application/pdf are stored as a JPEG — the bytes decide, not the header");
  r = await upload("7", PDF);
  stored = LOG.filter((l) => l.op === "upload").pop();
  ok(r.statusCode === 200 && stored && /^coas\/7\/[0-9a-f]{16}\.pdf$/.test(stored.path) && stored.contentType === "application/pdf", `PDF stored at coas/7/<sha16>.pdf in the bucket (${stored?.path})`);
  ok(stored && stored.table === "storage:coa-files", "the bucket is coa-files");
  const row = FIXTURES.coas.find((c) => c.id === 7);
  ok(row.file_url === "/api/coa-file/7.pdf" && row.file_path === stored?.path, `row points at the stable same-origin URL (${row.file_url}) and keeps the object path`);
  ok(!JSON.stringify(r.payload).includes("placeholder") && !/token=/.test(JSON.stringify(r.payload)), "response carries no key and no signed URL");
  const objectsBefore = Object.keys(STORAGE["coa-files"]).length;
  r = await upload("7", PDF);
  ok(r.statusCode === 200 && Object.keys(STORAGE["coa-files"]).length === objectsBefore, "re-uploading the same bytes is idempotent (same object path)");
  r = await upload("8", JPEG);
  ok(r.statusCode === 200 && FIXTURES.coas.find((c) => c.id === 8).file_url === "/api/coa-file/8.jpg", "a JPEG certificate becomes /api/coa-file/<id>.jpg");
  const g = makeRes(); await coaUploadHandler({ method: "GET", headers: {} }, g);
  ok(g.statusCode === 405, "GET → 405");
}

console.log("\nPublic file route:");
{
  let r = await getFile("7.pdf");
  ok(r.statusCode === 404, "unpublished certificate → 404 (no hint)");
  r = await getFile("8.jpg");
  ok(r.statusCode === 302 && /\/storage\/v1\/object\/sign\/coa-files\/coas\/8\/[0-9a-f]{16}\.jpg\?token=/.test(r.headers.location || ""), `published → 302 to a signed bucket URL (${(r.headers.location || "").slice(0, 60)}…)`);
  ok(/no-store/.test(r.headers["cache-control"] || ""), "redirect is private, no-store");
  r = await getFile("8.pdf");
  ok(r.statusCode === 302, "the extension in the URL is cosmetic; the row's object path decides");
  r = await getFile("../../etc/passwd");
  ok(r.statusCode === 404, "a non-conforming name → 404");
  FIXTURES.coas.find((c) => c.id === 7).is_published = true;
  r = await getFile("7.pdf");
  ok(r.statusCode === 302, "publishing the certificate opens the file");
  const before = FIXTURES.coas.find((c) => c.id === 8);
  before.file_path = null;
  r = await getFile("8.jpg");
  ok(r.statusCode === 404, "a published row without a stored file → 404 (external links never pass through here)");
}

console.log("\nreadRawBody:");
{
  async function* stream(parts) { for (const p of parts) yield Buffer.from(p); }
  let r = await readRawBody({ body: undefined, [Symbol.asyncIterator]: () => stream(["ab", "cd"]) }, { maxBytes: 10 });
  ok(!r.tooLarge && r.buffer.toString() === "abcd", "concatenates stream chunks");
  let consumed = 0;
  const gen = (async function* () { for (let i = 0; i < 100; i++) { consumed++; yield Buffer.alloc(100, 1); } })();
  r = await readRawBody({ [Symbol.asyncIterator]: () => gen }, { maxBytes: 250 });
  ok(r.tooLarge && consumed <= 3, `stops reading past the cap (consumed ${consumed} of 100 chunks)`);
  r = await readRawBody({ body: Buffer.from("xyz") }, { maxBytes: 2 });
  ok(r.tooLarge, "a pre-parsed Buffer above the cap is too large");
}

if (failures) { console.error(`\n${failures} COA upload check(s) FAILED`); process.exit(1); }
console.log("\nAll COA upload checks passed.");
