// scripts/_stub-email.mjs — lib/email.js stand-in for handler tests that need
// to observe (not send) transactional mail. EMAIL.configured mirrors "is
// RESEND_API_KEY set": when false every sender returns null exactly like the
// real module; when true the call is recorded and a fake id returned.
export const EMAIL = { configured: false, sent: [], failNext: 0 };
async function record(kind, args) {
  if (!EMAIL.configured) return null;
  if (EMAIL.failNext > 0) { EMAIL.failNext -= 1; throw new Error("stub transport failure"); }
  EMAIL.sent.push({ kind, ...args });
  return { id: `stub-${EMAIL.sent.length}` };
}
export const sendBackInStockEmail = (args) => record("back_in_stock", args);
export const sendOrderConfirmationEmail = (args) => record("order_confirmation", args);
export const sendOrderStatusEmail = (args) => record("order_status", args);
export const sendConciergeRequestEmail = (args) => record("concierge", args);
export const sendAttestationReceiptEmail = (args) => record("attestation_receipt", args);
