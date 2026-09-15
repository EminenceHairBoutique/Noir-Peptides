/*
  scripts/test-workflow-shape.mjs   (opt cycle 12 follow-up — scorecards 4.2 / 4.12 / 4.13)
  Structural gates on every workflow, for the class of defect that made the
  live probe unable to pass: a `steps.<id>` reference only resolves inside the
  JOB that declares that id. Across a job boundary it reads as the empty
  string — so `if: steps.verdict.outcome != 'success'` in a second job is
  always true, and the step it guards always runs. Same class: a `needs:`
  naming a job that does not exist.

  The parser is deliberate about the ways a line-based scanner goes blind,
  because the FIRST draft of this file shipped every one of them (found by an
  adversarial review of the very commit that added it):
    - job keys at any indentation, quoted or not — a four-space workflow used
      to yield zero jobs, and zero jobs read as "clean" (a gate that cannot
      fail, the H-018 shape this file exists to prevent);
    - a file that declares `jobs:` and yields NO job is a finding, never a
      pass, and the repository sweep pins the job names it expects;
    - block scalars (`run: |`, `script: |`) are not YAML: `steps.x.` or
      `id: x` inside a shell heredoc must neither raise a finding nor mask
      one;
    - trailing `# comments` are stripped before parsing (an `id: build # …`
      used to un-register the step and flag every honest reference to it);
    - an `id:` counts only as a direct key of a step, so a `with:` input or
      an `env:` entry named `id` cannot register a phantom step;
    - `needs:` in all three YAML shapes: scalar, inline list, block list.

  No new dependency: the repo carries no YAML parser, and this needs only the
  block structure, not a full loader.

  Run: node scripts/test-workflow-shape.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const indentOf = (line) => line.length - line.trimStart().length;

/** Remove a trailing `# comment` that is not inside quotes. */
export function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, "");
  }
  return line.replace(/\s+$/, "");
}

/**
 * Lines of a workflow, comment-stripped, with block-scalar bodies marked
 * `raw` — their content is shell or text, not YAML, and must not be parsed.
 */
export function readLines(text) {
  const out = [];
  let rawIndent = null; // block-scalar content is indented deeper than its key
  for (const [i, original] of text.split(/\r?\n/).entries()) {
    const line = original.replace(/\t/g, "  ").replace(/\s+$/, "");
    const n = i + 1;
    if (rawIndent != null) {
      if (line.trim() === "" || indentOf(line) > rawIndent) { out.push({ n, text: line, raw: true }); continue; }
      rawIndent = null;
    }
    const stripped = stripComment(line);
    // `key: |`, `key: >-`, `- key: |` … everything deeper is block-scalar body.
    if (/^\s*(?:-\s+)?[^:#\s][^:]*:\s*[|>][-+\d]*\s*$/.test(stripped)) {
      out.push({ n, text: stripped, raw: false });
      rawIndent = indentOf(stripped);
      continue;
    }
    out.push({ n, text: stripped, raw: false });
  }
  return out;
}

const JOB_KEY = /^(\s*)(["']?)([A-Za-z0-9_.-]+)\2:\s*$/;
const STEP_ID = /^\s*(?:-\s+)?id:\s*(["']?)([A-Za-z0-9_.-]+)\1\s*$/;
const STEP_REF = /steps\.([A-Za-z0-9_-]+)\./g;

/**
 * Parse a workflow into job blocks. `declaresJobs` says the file has a
 * `jobs:` key at all, so "no jobs found" can be told apart from "not a
 * workflow" — the distinction the first draft could not make.
 */
export function parseWorkflow(text) {
  const lines = readLines(text);
  const jobsAt = lines.findIndex((l) => !l.raw && /^jobs:\s*$/.test(l.text));
  if (jobsAt < 0) return { declaresJobs: /^jobs:/m.test(text), jobs: [] };

  // The first deeper non-empty line sets the indentation jobs are written at.
  let jobIndent = null;
  for (let i = jobsAt + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.raw || l.text.trim() === "") continue;
    if (indentOf(l.text) === 0) break;
    jobIndent = indentOf(l.text);
    break;
  }
  if (jobIndent == null) return { declaresJobs: true, jobs: [] };

  const jobs = [];
  let cur = null;
  for (let i = jobsAt + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.raw && l.text.trim() !== "" && indentOf(l.text) === 0) break; // out of `jobs:`
    const m = !l.raw && JOB_KEY.exec(l.text);
    if (m && indentOf(l.text) === jobIndent) {
      cur = { name: m[3], line: l.n, lines: [], stepIds: new Set(), needs: [] };
      jobs.push(cur);
      continue;
    }
    if (cur) cur.lines.push(l);
  }

  for (const job of jobs) {
    let stepsIndent = null; // indent of the `steps:` key
    let stepKeyIndent = null; // indent of the keys of the step being read
    for (let i = 0; i < job.lines.length; i++) {
      const l = job.lines[i];
      if (l.raw || l.text.trim() === "") continue;
      const ind = indentOf(l.text);
      if (/^\s*steps:\s*$/.test(l.text)) { stepsIndent = ind; stepKeyIndent = null; continue; }
      if (stepsIndent != null && ind <= stepsIndent) { stepsIndent = null; stepKeyIndent = null; } // left the steps list
      if (stepsIndent == null) continue;
      const dash = /^(\s*)-\s+\S/.exec(l.text);
      if (dash && ind === stepsIndent + 2) stepKeyIndent = ind + 2; // `- name:` → its keys sit here
      const id = STEP_ID.exec(l.text);
      if (id && (dash ? ind === stepsIndent + 2 : ind === stepKeyIndent)) job.stepIds.add(id[2]);
    }

    for (let i = 0; i < job.lines.length; i++) {
      const l = job.lines[i];
      if (l.raw) continue;
      const m = /^(\s*)needs:\s*(.*)$/.exec(l.text);
      if (!m) continue;
      const value = m[2].trim();
      if (value.startsWith("[")) {
        for (const t of value.replace(/[[\]]/g, "").split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean)) job.needs.push({ target: t, n: l.n });
      } else if (value) {
        job.needs.push({ target: value.replace(/^["']|["']$/g, ""), n: l.n });
      } else {
        for (let j = i + 1; j < job.lines.length; j++) { // block list
          const item = job.lines[j];
          if (item.raw || item.text.trim() === "") continue;
          if (indentOf(item.text) <= indentOf(m[1])) break;
          const li = /^\s*-\s*(["']?)([^"'\s]+)\1\s*$/.exec(item.text);
          if (!li) break;
          job.needs.push({ target: li[2], n: item.n });
        }
      }
    }
  }
  return { declaresJobs: true, jobs };
}

/** Findings (strings) for one workflow; empty means the shape is sound. */
export function checkWorkflow(text, file = "workflow") {
  const { declaresJobs, jobs } = parseWorkflow(text);
  const findings = [];
  if (declaresJobs && jobs.length === 0) {
    findings.push(`${file}: declares jobs: but this checker parsed none — it cannot vouch for this file (unparsed is not clean)`);
    return findings;
  }
  const jobNames = new Set(jobs.map((j) => j.name));
  for (const job of jobs) {
    for (const l of job.lines) {
      if (l.raw) continue; // shell inside run: | is not an expression
      STEP_REF.lastIndex = 0;
      let m;
      while ((m = STEP_REF.exec(l.text))) {
        if (!job.stepIds.has(m[1])) findings.push(`${file}:${l.n} job "${job.name}" reads steps.${m[1]} — no step with that id in this job (a steps.<id> reference never crosses a job boundary; it reads as "")`);
      }
    }
    for (const need of job.needs) {
      if (!jobNames.has(need.target)) findings.push(`${file}:${need.n} job "${job.name}" needs "${need.target}" — no such job`);
    }
  }
  return findings;
}

// ── the suite (skipped when this module is imported) ───────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  let failures = 0;
  const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };
  const wf = (...lines) => lines.join("\n") + "\n";

  console.log("It catches the shape that shipped:");
  {
    const shipped = wf("jobs:", "  probe:", "    steps:", "      - name: Fold", "        id: verdict", "        run: node x.mjs --finalize", "  publish:", "    needs: probe", "    steps:", "      - name: Fail", "        if: steps.verdict.outcome != 'success'", "        run: exit 1");
    const found = checkWorkflow(shipped, "shipped.yml");
    ok(found.length === 1 && /job "publish" reads steps\.verdict/.test(found[0]), `the cross-job reference is flagged (${found[0] || "nothing flagged"})`);
    const real = checkWorkflow(fs.readFileSync("scripts/__fixtures__/live-probe.pre-fix.yml", "utf8"), "pre-fix");
    ok(real.some((f) => /reads steps\.verdict/.test(f)), `and on the real pre-fix live-probe.yml (${real[0] || "nothing flagged"})`);
  }

  console.log("\nIt cannot pass a file it did not parse:");
  {
    const fourSpace = wf("jobs:", "    probe:", "        steps:", "          - id: verdict", "            run: x", "    publish:", "        needs: nosuchjob", "        steps:", "          - if: steps.verdict.outcome != 'success'", "            run: exit 1");
    const found = checkWorkflow(fourSpace, "four.yml");
    ok(found.some((f) => /reads steps\.verdict/.test(f)), "a four-space workflow is parsed, not skipped — its cross-job reference is flagged");
    ok(found.some((f) => /needs "nosuchjob"/.test(f)), "…and its dangling needs: too");
    ok(checkWorkflow(wf("jobs:", "  # only comments below"), "empty.yml").some((f) => /parsed none/.test(f)), "a jobs: block this checker cannot read is a FINDING, never a silent pass");
    ok(checkWorkflow(wf("on: push", "name: x"), "nojobs.yml").length === 0, "a file with no jobs: key is not a finding");
  }

  console.log("\nThe shapes that used to fool it:");
  {
    const quoted = wf("jobs:", "  probe:", "    steps:", "      - id: verdict", "        run: x", '  "publish":', "    needs: probe", "    steps:", "      - if: steps.verdict.outcome != 'success'", "        run: exit 1");
    const found = checkWorkflow(quoted, "quoted.yml");
    ok(found.some((f) => /job "publish" reads steps\.verdict/.test(f)), "a QUOTED job key starts its own job (its cross-job reference is caught)");
    ok(!found.some((f) => /needs "probe"/.test(f)), "…and the quoted job is a valid needs: target (no false positive)");

    const blockNeeds = wf("jobs:", "  a:", "    steps:", "      - run: x", "  b:", "    steps:", "      - run: y", "  c:", "    needs:", "      - a", "      - nosuchjob", "    steps:", "      - run: z");
    const found2 = checkWorkflow(blockNeeds, "blocklist.yml");
    ok(found2.length === 1 && /needs "nosuchjob"/.test(found2[0]), `a BLOCK-LIST needs: is checked item by item (${found2[0] || "nothing flagged"})`);

    const heredoc = wf("jobs:", "  a:", "    steps:", "      - name: write a config", "        run: |", "          cat > cfg.yml <<'YML'", "          id: verdict", "          guard: steps.verdict.outcome", "          YML", "      - if: steps.verdict.outcome != 'success'", "        run: exit 1");
    const found3 = checkWorkflow(heredoc, "heredoc.yml");
    ok(found3.length === 1 && /reads steps\.verdict/.test(found3[0]), `text inside run: | neither registers a phantom id nor raises a finding (${found3[0] || "nothing flagged"})`);

    const withInput = wf("jobs:", "  a:", "    steps:", "      - uses: some/action@v1", "        with:", "          id: verdict", "      - if: steps.verdict.outcome != 'success'", "        run: exit 1");
    ok(checkWorkflow(withInput, "with.yml").some((f) => /reads steps\.verdict/.test(f)), "a `with:` input named id does not register a phantom step id");

    const envId = wf("jobs:", "  a:", "    env:", "      id: verdict", "    steps:", "      - if: steps.verdict.outcome != 'success'", "        run: exit 1");
    ok(checkWorkflow(envId, "env.yml").some((f) => /reads steps\.verdict/.test(f)), "a job-level `env:` key named id does not register one either");

    const comments = wf("jobs:", "  a:", "    steps:", "      - id: build   # the cached build", "        run: x", "      - if: steps.build.outcome == 'success'   # only after a build", "        run: y");
    ok(checkWorkflow(comments, "comments.yml").length === 0, "a trailing # comment on an id: line does not un-register the step (no false positive)");

    const needsComment = wf("jobs:", "  a:", "    steps:", "      - run: x", "  b:", "    needs: a # after a", "    steps:", "      - run: y");
    ok(checkWorkflow(needsComment, "needscomment.yml").length === 0, "a trailing # comment on a needs: line is not part of the job name");

    const hashInString = wf("jobs:", "  a:", "    steps:", "      - id: build", "        run: echo \"a # b\"", "      - if: steps.build.outcome == 'success'", "        run: y");
    ok(checkWorkflow(hashInString, "hash.yml").length === 0, "a # inside a quoted string is not treated as a comment");

    const crlf = "jobs:\r\n  probe:\r\n    steps:\r\n      - id: verdict\r\n        run: x\r\n  publish:\r\n    needs: probe\r\n    steps:\r\n      - if: steps.verdict.outcome != 'success'\r\n        run: exit 1\r\n";
    ok(checkWorkflow(crlf, "crlf.yml").some((f) => /reads steps\.verdict/.test(f)), "CRLF line endings parse the same");
  }

  console.log("\nEvery workflow in this repository:");
  {
    const dir = ".github/workflows";
    const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
    ok(files.length >= 4, `${files.length} workflow file(s) scanned (${files.join(", ")})`);
    let total = 0;
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      const { jobs } = parseWorkflow(text);
      ok(jobs.length >= 1, `${f}: parsed ${jobs.length} job(s) — ${jobs.map((j) => j.name).join(", ") || "NONE"}`);
      const found = checkWorkflow(text, `${dir}/${f}`);
      total += found.length;
      for (const line of found) console.error(`      ${line}`);
    }
    ok(total === 0, `no cross-job steps.<id> reference and no dangling needs: (${total} finding(s))`);
    // Ground truth: if a reformat ever blinds the parser, these go red.
    const names = (f) => parseWorkflow(fs.readFileSync(path.join(dir, f), "utf8")).jobs.map((j) => j.name).join(",");
    ok(names("live-probe.yml") === "probe,publish", `live-probe.yml is exactly probe,publish (${names("live-probe.yml")})`);
    ok(names("evidence.yml") === "evidence,publish", `evidence.yml is exactly evidence,publish (${names("evidence.yml")})`);
    const probe = fs.readFileSync(path.join(dir, "live-probe.yml"), "utf8");
    ok(/--gate evidence\/live-probe\.json/.test(probe), "live-probe.yml gates the run on the published record (--gate)");
  }

  if (failures) { console.error(`\n${failures} workflow-shape check(s) FAILED`); process.exit(1); }
  console.log("\nAll workflow-shape checks passed.");
}
