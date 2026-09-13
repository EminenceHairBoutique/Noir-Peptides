# evidence

Machine-written by the Evidence and Live-probe workflows (opt cycle 9).

- `ci/<sha>.json`, `ci/latest.json` — one summary per CI run of the evidence workflow.
- `live/<utc-stamp>.json`, `live/latest.json` — one record per live probe of the production site (newest 60 kept).

Read with `node scripts/evidence-latest.mjs` from any code branch. Never edit by hand.
