import { aiHandler } from "./_shared.js";

const INSTRUCTIONS = `Task: explain a Certificate of Analysis (COA) for a research material in plain language for a qualified researcher.
Cover, when present: purity % and what the HPLC trace indicates, mass spectrometry (observed vs. theoretical mass), endotoxin / LAL results, identity confirmation, and batch/lot metadata. Explain what each metric means analytically and how to read it. Do NOT provide any use, dosing, reconstitution-for-use, or administration guidance. If the COA text is missing a field, say so rather than inventing values.`;

export default function handler(req, res) {
  return aiHandler(req, res, {
    feature: "coa_analyzer",
    instructions: INSTRUCTIONS,
    maxTokens: 1600,
    thinking: { type: "adaptive" },
    buildMessages: (body) => {
      const coa = String(body.coaText || body.coa || "").slice(0, 12000).trim();
      if (!coa) return null;
      const question = String(body.question || "").slice(0, 1000).trim();
      const content =
        `Interpret the following Certificate of Analysis for a research material.` +
        (question ? ` Focus on: ${question}` : "") +
        `\n\n--- COA ---\n${coa}\n--- END COA ---`;
      return [{ role: "user", content }];
    },
  });
}
