import { aiHandler, sanitizeMessages } from "./_shared.js";
import { gateFeature } from "../_utils/features.js";

const INSTRUCTIONS = `Role: customer concierge for Noir Peptides — help with support questions, order status guidance, product/catalog navigation, COA availability, shipping/returns policy, and pre-sales research questions.
For order-specific lookups you cannot perform, direct the researcher to their account dashboard or the contact form. Keep a professional, helpful tone. Everything remains within the research-use lane — never provide dosing, administration, or therapeutic guidance.`;

export default function handler(req, res) {
  // Sept-11 T6: public AI is OFF unless FEATURE_AI_PUBLIC is set → 404 envelope.
  if (!gateFeature(res, "aiPublic")) return;
  return aiHandler(req, res, {
    feature: "concierge",
    instructions: INSTRUCTIONS,
    maxTokens: 1200,
    buildMessages: (body) => {
      if (Array.isArray(body.messages)) return sanitizeMessages(body.messages);
      if (body.message) return sanitizeMessages([{ role: "user", content: body.message }]);
      return null;
    },
  });
}
