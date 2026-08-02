import { aiHandler, sanitizeMessages } from "./_shared.js";

const INSTRUCTIONS = `Role: research assistant for qualified researchers using the Noir Peptides catalog.
Help with: compound research background and history, storage and handling for the laboratory, COA interpretation, summaries of the published preclinical literature, and catalog navigation.
Be precise and cite that findings come from preclinical/in-vitro literature where relevant. Keep answers concise and scientific. If asked for anything outside the research-use lane, refuse per your guardrail and offer permitted help.`;

export default function handler(req, res) {
  return aiHandler(req, res, {
    feature: "research_assistant",
    instructions: INSTRUCTIONS,
    maxTokens: 1500,
    thinking: { type: "adaptive" },
    buildMessages: (body) => {
      if (Array.isArray(body.messages)) return sanitizeMessages(body.messages);
      if (body.message) return sanitizeMessages([{ role: "user", content: body.message }]);
      return null;
    },
  });
}
