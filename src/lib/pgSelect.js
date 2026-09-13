// src/lib/pgSelect.js
// Deploy-order safety for selects that name columns added by a migration.
//
// The code deploy and the SQL migration are separate acts, and code usually
// lands first. PostgREST answers a select naming an unknown column with an
// error, and our data layers treat "error" as "no data" — for `products` that
// means silently swapping the live catalog for the bundled build-time one
// (stale stock, stale prices) until someone runs the migration. That failure is
// invisible, which is what makes it dangerous.
//
// `selectDegrading` runs the rich select first and, ONLY when the failure is
// specifically an undefined-column error, retries with the pre-migration column
// list. Every other error (network, RLS, timeout) is returned untouched so the
// existing handling still sees it. Once the migration is applied the first
// attempt succeeds and the fallback never runs.

/** PostgREST/Postgres undefined_column. */
const UNDEFINED_COLUMN = "42703";

export function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code === UNDEFINED_COLUMN) return true;
  // PostgREST does not always forward the SQLSTATE for embedded-resource
  // failures ("could not find a relationship..."), so match its message too.
  const msg = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find a relationship") ||
    msg.includes("unknown column")
  );
}

/**
 * @param {(columns: string) => Promise<{data: any, error: any}>} run
 *        Builds and awaits the query for a given column list.
 * @param {...string} columnLists  column lists from the newest migration's
 *        down to the base set that is guaranteed to exist; each is tried in
 *        turn and the first that is not an undefined-column error is returned
 *        (opt cycle 9: three steps — 0036, 0033, base).
 */
export async function selectDegrading(run, ...columnLists) {
  let result = null;
  for (const cols of columnLists) {
    result = await run(cols);
    if (!isMissingColumnError(result?.error)) return result;
    if (import.meta?.env?.DEV) {
      // Loud in dev, silent in prod: this means a migration is pending.
      console.warn("[pgSelect] falling back to an older column list — pending migration?", result.error);
    }
  }
  return result;
}
