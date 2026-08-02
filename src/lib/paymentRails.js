// src/lib/paymentRails.js
// Build-time mirror of the server payment abstraction: which rails to OFFER at
// checkout. The server is authoritative about what's actually active — a rail
// listed here still fails closed server-side if its processor isn't configured.
// BTCPay (crypto) is the primary/default rail; Stripe (card) shows only when a
// publishable key is present in this build.
export function availableRails() {
  const rails = [
    {
      id: "crypto",
      label: "Pay with crypto",
      note: "BTC / ETH / USDC · save 5% · no account needed",
      endpoint: "/api/btcpay/create-invoice",
      primary: true,
    },
  ];
  if (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    rails.push({
      id: "card",
      label: "Pay with card",
      note: "Visa · Mastercard · Amex — secured by Stripe",
      endpoint: "/api/create-checkout-session",
      primary: false,
    });
  }
  return rails;
}
