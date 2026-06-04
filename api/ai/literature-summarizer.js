import { aiHandler } from "./_shared.js";

const INSTRUCTIONS = `Task: summarize scientific literature about a research compound for a qualified researcher.
Report: key findings, proposed mechanisms (framed as described in the preclinical/in-vitro literature), study models used, and stated limitations. Distinguish in-vitro from in-vivo (animal) preclinical work. Do NOT extrapolate to human use, efficacy, dosing, or therapeutic benefit. Frame everything as "the literature reports/describes," never as established human outcomes.`;

export default function handler(req, res) {
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
        ? `Summarize the key findings, mechanisms (as described in the literature), and limitations of the following:\n\n${text}`
        : `Summarize what the published preclinical literature describes about: ${topic}`;
      return [{ role: "user", content }];
    },
  });
}
