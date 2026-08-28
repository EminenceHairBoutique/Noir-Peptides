// api/payment-rails.js
// Server-derived payment rail availability (audit P1.2).
//
// THE PROBLEM: the client hardcoded its rail list. Crypto was ALWAYS rendered —
// and rendered as the recommended primary option — even when BTCPay was
// unconfigured, in which case the customer picked it, clicked pay, and got a
// 503. Card availability was inferred from a VITE_ publishable key baked in at
// BUILD time, which can disagree with the server's actual runtime config.
//
// THE RULE: the server owns what is payable. This endpoint reports which rails
// are genuinely configured RIGHT NOW, plus the real crypto discount, so the
// client renders truth instead of a guess.
//
// Deliberately exposes only booleans and a discount percentage — never key
// material, hostnames, or store ids. Public + cached briefly: it is read on
// every checkout and its answer changes only when the owner changes env.
import { jsonResponse as json } from "./_utils/body.js";
import { stripeLiveDisabled, warnIfStripeLiveDisabled } from "../lib/payments/providers.js";

function stripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  // Stripe live-key interlock: a live key without the risk ack omits the card
  // rail here too, so the checkout UI never offers a processor the create
  // endpoint would refuse.
  if (stripeLiveDisabled()) {
    warnIfStripeLiveDisabled();
    return false;
  }
  return true;
}

function btcpayConfigured() {
  return Boolean(
    process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const cryptoOn = btcpayConfigured();
  const cardOn = stripeConfigured();

  const rails = [];
  if (cryptoOn) {
    rails.push({
      id: "crypto",
      label: "Pay with crypto",
      note: `BTC / ETH / USDC · save ${Number(process.env.BTCPAY_CRYPTO_DISCOUNT_PCT || 5)}% · no account needed`,
      endpoint: "/api/btcpay/create-invoice",
      primary: true,
    });
  }
  if (cardOn) {
    rails.push({
      id: "card",
      label: "Pay with card",
      note: "Visa · Mastercard · Amex — secured by Stripe",
      endpoint: "/api/create-checkout-session",
      // Card is primary only when crypto isn't available.
      primary: !cryptoOn,
    });
  }

  // Short cache: checkout reads this every time, but the answer only changes
  // when the owner edits environment variables and redeploys.
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return json(res, 200, {
    rails,
    cryptoDiscountPct: cryptoOn ? Number(process.env.BTCPAY_CRYPTO_DISCOUNT_PCT || 5) : 0,
    // True when NOTHING is payable — the client shows a maintenance state
    // instead of a checkout button that cannot succeed.
    unavailable: rails.length === 0,
  });
}
