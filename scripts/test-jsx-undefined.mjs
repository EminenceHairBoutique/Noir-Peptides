/*
  scripts/test-jsx-undefined.mjs
  Guards against USED-BUT-NOT-IMPORTED JSX components.

  WHY THIS EXISTS: /contact shipped to production rendering the ErrorBoundary
  ("SOMETHING WENT WRONG") because <BusinessIdentity> was used without being
  imported. Nothing caught it — ESLint's no-undef does not analyse JSX element
  names, `eslint-plugin-react` (which has react/jsx-no-undef) is not installed,
  and `vite build` succeeds because the failure is at RUNTIME, not build time.

  This scans every .jsx file under src/ for capitalized JSX element names and
  asserts each one is imported, declared, or a known intrinsic in that file.
  Dependency-free, in the style of scripts/test-guardrail.mjs.

  Run: node scripts/test-jsx-undefined.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

const SRC = path.join(process.cwd(), "src");

// Names that are legal without a local import/declaration.
const ALLOWED = new Set([
  "React", // React.Fragment etc. (React is imported where used as a value)
  "Fragment",
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Strip comments and string/template literals in ONE pass.
 * A regex chain is not sufficient here: a line comment containing "/api/admin/*"
 * makes a block-comment regex swallow the rest of the file (this exact bug hid
 * the imports in AdminHome.jsx during development). Scan character by character
 * so each construct is recognised in context.
 */
function stripNoise(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      out += quote + quote;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Identifiers bound in this module: imports, declarations, params-ish. */
function boundNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s*['"]/g)) {
    const clause = m[1];
    // default + namespace
    for (const d of clause.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=,|$)/g)) names.add(d[1]);
    for (const n of clause.matchAll(/\*\s+as\s+([A-Za-z_$][\w$]*)/g)) names.add(n[1]);
    // named { A, B as C }
    const braces = clause.match(/\{([\s\S]*?)\}/);
    if (braces) {
      for (const part of braces[1].split(",")) {
        const t = part.trim();
        if (!t) continue;
        const as = t.match(/\bas\s+([A-Za-z_$][\w$]*)/);
        names.add(as ? as[1] : t.split(/\s+/)[0]);
      }
    }
  }
  for (const m of src.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][\w$]*)/g)) names.add(m[1]);
  // Destructuring binds capitalized names too, e.g. a component passed as a
  // prop and renamed: function StatCard({ icon: Icon }) { ... <Icon /> }
  for (const m of src.matchAll(/[{,]\s*[A-Za-z_$][\w$]*\s*:\s*([A-Z][\w$]*)/g)) names.add(m[1]);
  // ...and bare capitalized destructured names: const { Foo } = x
  for (const m of src.matchAll(/[{,]\s*([A-Z][\w$]*)\s*[,}=]/g)) names.add(m[1]);
  // lazy(() => import(...)) assigned names are covered by the const rule above.
  return names;
}

/** Capitalized JSX element names actually used in this file. */
function usedComponents(src) {
  const used = new Set();
  for (const m of src.matchAll(/<([A-Z][\w$]*)(?:\.([A-Za-z_$][\w$]*))?[\s/>]/g)) {
    used.add(m[1]); // for <Motion.div/> the ROOT (Motion) is what must be bound
  }
  return used;
}

let failures = 0;
const files = walk(SRC);
const offenders = [];

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const src = stripNoise(raw);
  const bound = boundNames(src);
  for (const name of usedComponents(src)) {
    if (ALLOWED.has(name) || bound.has(name)) continue;
    offenders.push(`${path.relative(process.cwd(), file)}: <${name}> used but not imported/declared`);
    failures++;
  }
}

console.log(`JSX undefined-component scan: ${files.length} .jsx files`);
if (offenders.length) {
  for (const o of offenders) console.error(`  ✗ ${o}`);
  console.error(`\n${failures} undefined JSX component reference(s) — these crash at RUNTIME, not build time.`);
  process.exit(1);
}
console.log(`  ✓ every capitalized JSX element is imported or declared in its file`);
console.log("\nAll JSX component references resolve.");
