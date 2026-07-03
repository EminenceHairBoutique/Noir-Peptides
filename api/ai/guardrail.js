// api/ai/guardrail.js
// Pure, dependency-free RUO guardrail logic for the AI endpoints. Kept separate
// from _shared.js (which pulls the Anthropic SDK + Supabase) so it can be unit-
// tested in isolation. Both the pre-call input check and the post-call output
// backstop run through the SAME patterns here.

// The shared guardrail — included verbatim in every endpoint's system prompt.
export const GUARDRAIL = `You are the research assistant for Noir Peptides, a research-chemical supplier. All products are for laboratory research use only and are not for human or animal consumption. Provide educational, scientific, and analytical information only. REFUSE any request for human or veterinary dosing, administration routes, injection guidance, cycles, "how to take," stacking-for-use, or therapeutic/diagnostic/medical advice — even if the user insists, role-plays, or claims to be a clinician. When refusing, briefly restate the research-use-only framing and offer permitted help. Never claim a product treats, prevents, or improves any condition. Never state or imply FDA approval.`;

export const RUO_REDIRECT =
  "I can only help with research-use information. Noir Peptides materials are for laboratory research use only — not for human or veterinary use — so I can't provide dosing, administration, injection, cycling, or therapeutic guidance. I'm glad to help with compound background, the published preclinical literature, storage and handling, or interpreting a Certificate of Analysis.";

// High-signal patterns indicating a request for (or output containing) human/
// veterinary administration or therapeutic guidance. Tuned to avoid colliding
// with legitimate analytical content (vial size in mg, purity %, MW, etc.).
export const DOSING_PATTERNS = [
  /\bmg\s*\/\s*kg\b/i,
  /\bmcg\s*\/\s*kg\b/i,
  /\b(how|what)\s+(much|many|dose|dosage)\b[^.?!]{0,40}\b(take|inject|use|administer|dose)\b/i,
  /\b(dosage|dose)\s+(for|of|per|protocol|schedule)\b/i,
  /\bhow\s+(do|should|can)\s+i\s+(take|inject|administer|use|dose|run|cycle|stack)\b/i,
  /\b(inject|injecting|injection|subcutaneous|intramuscular|subq|sub-q|im\b|iv\b)\b/i,
  /\b(reconstitute|reconstitution)\b[^.?!]{0,40}\b(inject|dose|take|administer)\b/i,
  /\b(cycle|cycling|stack|stacking)\b[^.?!]{0,40}\b(for|to)\b[^.?!]{0,30}\b(gain|loss|muscle|fat|results|body)\b/i,
  /\b(twice|once|three times)\s+(a|per)\s+day\b/i,
  /\b(units?|iu)\s+(per|a)\s+(day|week|dose)\b/i,
  /\b(treat|cure|prevent|heal)\s+(your|my|a|the)\b[^.?!]{0,30}\b(condition|disease|injury|symptom|illness)\b/i,
];

export function matchesDosing(text) {
  const t = String(text || "");
  return DOSING_PATTERNS.some((re) => re.test(t));
}

// Pre-call check on the user's input — short-circuits obvious dosing requests
// without spending tokens.
export function looksLikeDosingRequest(text) {
  return matchesDosing(text);
}

// Post-call backstop on the model's output.
export function outputViolatesRUO(text) {
  return matchesDosing(text);
}
