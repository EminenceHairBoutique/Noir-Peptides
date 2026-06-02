import dotenv from "dotenv";

// Load .env.local first, then .env (so .env.local wins)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import express from "express";
import cors from "cors";

import createCheckoutSession from "./api/create-checkout-session.js";
import stripeWebhook from "./api/stripe-webhook.js";
import concierge from "./api/concierge.js";

const app = express();

app.use(cors());

// ❌ DO NOT use express.json() globally before webhook

// ✅ Webhook route — RAW body
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// ✅ Checkout session route — JSON body
app.post(
  "/api/create-checkout-session",
  express.json(),
  createCheckoutSession
);

// ✅ Concierge requests — JSON body
app.post(
  "/api/concierge",
  express.json(),
  concierge
);

app.listen(3000, () => {
  console.log("✅ Local API running on http://localhost:3000");
});
