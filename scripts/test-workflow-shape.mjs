/*
  scripts/test-workflow-shape.mjs   (opt cycle 12 follow-up — scorecards 4.2 / 4.12 / 4.13)
  Structural gates on every workflow, for the class of defect that made the
  live probe unable to pass: a `steps.<id>` reference only resolves inside the
  JOB that declares that id. Across a job boundary it reads as the empty
  string — so `if: steps.verdict.outcome != 'success'` in a second job is
  always true, and the step it guards always runs. The same class: a `needs:`
  naming a job that does not exist.

  The checker is exported so the test can prove BOTH poles (H-018): it flags
  the shape that shipped, and it stays quiet on the shapes that are correct —
  including a full-line comment that mentions the old expression.

  No YAML dependency (the repo has none): the workflows here are conventional
  two-space YAML, and the checker only needs job blocks, step ids and
  `steps.<id>` / `needs:` references.

  Run: node scripts/test-workflow-shape.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

const JOB_HEADER = /^ {2}([A-Za-z0-9_-]+):\s*$/;
const STEP_ID = /^\s*(?:-\s+)?id:\s*["']?([A-Za-z0-9_-]+)["']?\s*$/; // `id:` or `- id:`
const STEP_REF = /steps\.([A-Za-z0-9_-]+)\./g;

/** Split a workflow into { name, lines } job blocks (lines keep their numbers). */
export function jobBlocks(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return [];
  const blocks = [];
  let cur = null;
  for (let i = start + 1; i < lines.length; i++) {
    const m = JOB_HEADER.exec(lines[i]);
    if (m) {
      cur = { name: m[1], lines: [] };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^\S/.test(lines[i])) break; // back to column 0: out of `jobs:`
    cur.lines.push({ n: i + 1, text: lines[i] });
  }
  return blocks;
}

/** Findings (strings) for one workflow; empty means the shape is sound. */
export function checkWorkflow(text, file = "workflow") {
  const blocks = jobBlocks(text);
  const jobNames = new Set(blocks.map((b) => b.name));
  const findings = [];
  for (const block of blocks) {
    const code = block.lines.filter((l) => !/^\s*#/.test(l.text)); // full-line comments are not code
    const ids = new Set();
    for (const l of code) {
      const m = STEP_ID.exec(l.text);
      if (m) ids.add(m[1]);
    }
    for (const l of code) {
      STEP_REF.lastIndex = 0;
      let m;
      while ((m = STEP_REF.exec(l.text))) {
        if (!ids.has(m[1])) {
          findings.push(`${file}:${l.n} job "${block.name}" reads steps.${m[1]} — no step with that id in this job (a steps.<id> reference never crosses a job boundary; it reads as "")`);
        }
      }
    }
    for (const l of code) {
      const m = /^\s*needs:\s*(.+?)\s*$/.exec(l.text);
      if (!m) continue;
      const targets = m[1].startsWith("[")
        ? m[1].replace(/[[\]]/g, "").split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
        : [m[1].replace(/^["']|["']$/g, "")];
      for (const t of targets) {
        if (!jobNames.has(t)) findings.push(`${file}:${l.n} job "${block.name}" needs "${t}" — no such job`);
      }
    }
  }
  return findings;
}

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };

console.log("The checker catches the shape that shipped (and only it):");
{
  // Exactly the live-probe shape before this fix: the id is in the first job.
  const shipped = [
    "jobs:", "  probe:", "    steps:", "      - name: Fold", "        id: verdict",
    "        run: node scripts/live-probe.mjs --finalize", "  publish:", "    needs: probe", "    steps:",
    "      - name: Fail the run when the probe is not green", "        if: steps.verdict.outcome != 'success'", "        run: exit 1",
  ].join("\n");
  const found = checkWorkflow(shipped, "shipped.yml");
  ok(found.length === 1 && /job "publish" reads steps\.verdict/.test(found[0]), `the cross-job reference is flagged (${found[0] || "nothing flagged"})`);

  const sameJob = ["jobs:", "  probe:", "    steps:", "      - id: verdict", "        run: x", "      - if: steps.verdict.outcome != 'success'", "        run: exit 1"].join("\n");
  ok(checkWorkflow(sameJob, "same.yml").length === 0, "a reference inside the declaring job is not flagged");

  const commented = ["jobs:", "  probe:", "    steps:", "      - id: verdict", "        run: x", "  publish:", "    needs: probe", "    steps:", "      # the old guard read steps.verdict.outcome and could never pass", "      - run: node gate.mjs"].join("\n");
  ok(checkWorkflow(commented, "comment.yml").length === 0, "a full-line comment naming the old expression is not flagged");

  const badNeeds = ["jobs:", "  probe:", "    steps:", "      - run: x", "  publish:", "    needs: prob", "    steps:", "      - run: y"].join("\n");
  ok(checkWorkflow(badNeeds, "needs.yml").some((f) => /needs "prob"/.test(f)), "a needs: naming no job is flagged");

  const arrayNeeds = ["jobs:", "  a:", "    steps:", "      - run: x", "  b:", "    steps:", "      - run: y", "  c:", "    needs: [a, b]", "    steps:", "      - run: z"].join("\n");
  ok(checkWorkflow(arrayNeeds, "arr.yml").length === 0, "an inline-array needs: of declared jobs is not flagged");
}

console.log("\nEvery workflow in this repository:");
{
  const dir = ".github/workflows";
  const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
  ok(files.length >= 4, `${files.length} workflow file(s) scanned (${files.join(", ")})`);
  let total = 0;
  for (const f of files) {
    const found = checkWorkflow(fs.readFileSync(path.join(dir, f), "utf8"), `${dir}/${f}`);
    total += found.length;
    for (const line of found) console.error(`      ${line}`);
  }
  ok(total === 0, `no cross-job steps.<id> reference and no dangling needs: (${total} finding(s))`);
  // The live probe's gate must stay a real gate: the publish job runs it.
  const probe = fs.readFileSync(path.join(dir, "live-probe.yml"), "utf8");
  ok(/--gate evidence\/live-probe\.json/.test(probe), "live-probe.yml gates the run on the published record (--gate)");
}

if (failures) { console.error(`\n${failures} workflow-shape check(s) FAILED`); process.exit(1); }
console.log("\nAll workflow-shape checks passed.");
