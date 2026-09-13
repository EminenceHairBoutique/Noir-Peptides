import { aiHandler } from "./_shared.js";
import { gateFeature } from "../_utils/features.js";

const INSTRUCTIONS = `Task: summarize scientific literature about a research compound for a qualified researcher.
Report: the study models and analytical methods used, what each study measured, the stated limitations, and how the material was characterized (identity, purity method). Distinguish in-vitro from in-vivo (animal) preclinical work. Do NOT describe physiological effects or how a compound acts — in any subject, experimental or otherwise — and do NOT extrapolate to human use, efficacy, dosing, or therapeutic benefit. Frame everything as "the literature reports/describes," never as established outcomes.`;

export default function handler(req, res) {
  // Sept-11 T6: public AI is OFF unless FEATURE_AI_PUBLIC is set → 404 envelope.
  if (!gateFeature(res, "aiPublic")) return;
  return aiHandler(req, res, {
    feature: "literature_summarizer",
    instructions: INSTRUCTIONS,
    maxTokens: 1600,
    thinking: { type: "adaptive" },
    buildMessages: (body) => {
      const text = String(body.text || body.abstract || "").slice(0, 14000).trim();
      const topic = String(body.topic || body.compound || "").slice(0, 200).trim();
      if (!text && !topic) return null;
      const content = text
        ? `Summarize the study models, analytical methods, what was measured, and the stated limitations of the following — without describing physiological effects or how the compound acts:\n\n${text}`
        : `Summarize what the published preclinical literature describes about: ${topic}`;
      return [{ role: "user", content }];
    },
  });
}
