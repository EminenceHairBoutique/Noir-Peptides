/*
  scripts/evidence-publish.mjs   (opt cycle 9 — addendum B1/B2, owner decision 1)
  Pushes one compact evidence file to the orphan `evidence` branch:
      <kind>/<id>.json  and  <kind>/latest.json
  kind = "ci" (id = commit sha) or "live" (id = UTC stamp; pruned to the newest
  60). The branch carries only these JSON files and a README; code branches
  never carry evidence. A push by GITHUB_TOKEN triggers no workflow, so no loop.
  Concurrent runs: fetch + rebase + retry, three times.

  Usage: node scripts/evidence-publish.mjs <ci|live> <file.json> [--dry-run] [--remote origin]
*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const kind = args[0];
const file = args[1];
const dry = args.includes("--dry-run");
const remote = args.includes("--remote") ? args[args.indexOf("--remote") + 1] : "origin";
const BRANCH = process.env.EVIDENCE_BRANCH || "evidence";
const KEEP_LIVE = 60;
if (!["ci", "live"].includes(kind) || !file || !fs.existsSync(file)) {
  console.error("usage: node scripts/evidence-publish.mjs <ci|live> <file.json> [--dry-run] [--remote origin]");
  process.exit(2);
}
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
const id = kind === "ci" ? String(payload.sha || process.env.GITHUB_SHA || "unknown").slice(0, 40) : (payload.generated_at || new Date().toISOString()).replace(/[:.]/g, "-");
const verdict = payload.verdict || "?";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (cwd, ...a) => { try { return git(cwd, ...a); } catch { return null; } };
const repo = git(process.cwd(), "rev-parse", "--show-toplevel");
const wt = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-wt-"));
const README = `# evidence\n\nMachine-written by the Evidence and Live-probe workflows (opt cycle 9).\n\n- \`ci/<sha>.json\`, \`ci/latest.json\` — one summary per CI run of the evidence workflow.\n- \`live/<utc-stamp>.json\`, \`live/latest.json\` — one record per live probe of the production site (newest ${KEEP_LIVE} kept).\n\nRead with \`node scripts/evidence-latest.mjs\` from any code branch. Never edit by hand.\n`;

function checkout() {
  fs.rmSync(wt, { recursive: true, force: true });
  const has = tryGit(repo, "fetch", "--quiet", remote, `${BRANCH}:refs/remotes/${remote}/${BRANCH}`) !== null && tryGit(repo, "rev-parse", "--verify", "--quiet", `refs/remotes/${remote}/${BRANCH}`);
  if (has) {
    git(repo, "worktree", "add", "--detach", "--quiet", wt, `refs/remotes/${remote}/${BRANCH}`);
  } else {
    git(repo, "worktree", "add", "--detach", "--quiet", wt, "HEAD");
    git(wt, "checkout", "--quiet", "--orphan", `${BRANCH}-wt`);
    git(wt, "rm", "-rfq", "--", ".");
    for (const f of fs.readdirSync(wt)) if (f !== ".git") fs.rmSync(path.join(wt, f), { recursive: true, force: true });
  }
  return !!has;
}
function write() {
  const d = path.join(wt, kind);
  fs.mkdirSync(d, { recursive: true });
  const body = JSON.stringify(payload, null, 2) + "\n";
  fs.writeFileSync(path.join(d, `${id}.json`), body);
  fs.writeFileSync(path.join(d, "latest.json"), body);
  if (kind === "live") {
    const old = fs.readdirSync(d).filter((f) => f !== "latest.json" && f.endsWith(".json")).sort();
    for (const f of old.slice(0, Math.max(0, old.length - KEEP_LIVE))) fs.rmSync(path.join(d, f));
  }
  if (!fs.existsSync(path.join(wt, "README.md"))) fs.writeFileSync(path.join(wt, "README.md"), README);
}
function commitAndPush() {
  git(wt, "add", "-A");
  if (tryGit(wt, "diff", "--cached", "--quiet") !== null) { console.log("evidence: nothing new to publish (identical to the branch)"); return "same"; }
  git(wt, "-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit", "--quiet", "-m", `evidence(${kind}): ${id} ${verdict} [skip ci]`);
  if (dry) { console.log(`evidence: DRY RUN — would push ${kind}/${id}.json (+latest) to ${remote}/${BRANCH}`); console.log(git(wt, "show", "--stat", "--oneline", "HEAD")); return true; }
  try { git(wt, "push", "--quiet", remote, `HEAD:refs/heads/${BRANCH}`); return true; } catch (e) { console.log(`evidence: push rejected (${String(e.stderr || e.message).split("\n")[0]}); retrying`); return false; }
}

let ok = false;
for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
  const existed = checkout();
  write();
  ok = commitAndPush();
  if (!ok && !existed) break;
}
tryGit(repo, "worktree", "remove", "--force", wt);
tryGit(repo, "branch", "-D", `${BRANCH}-wt`);
fs.rmSync(wt, { recursive: true, force: true });
if (!ok) { console.error("evidence: could not publish after 3 attempts"); process.exit(1); }
if (ok !== "same") console.log(`evidence: published ${kind}/${id}.json (${verdict}) → ${remote}/${BRANCH}${dry ? " (dry run)" : ""}`);
