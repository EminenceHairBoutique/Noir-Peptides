// src/components/BackInStockForm.jsx — notify-me capture for out-of-stock /
// preorder variants. Posts to /api/back-in-stock (server-validated).
import React, { useState } from "react";
import { BellRing } from "lucide-react";

export default function BackInStockForm({ productId, variantId }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setStatus("");
    setBusy(true);
    try {
      const res = await fetch("/api/back-in-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productId, variantId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save your request.");
      setStatus("We'll email you when this vial size is back.");
      setEmail("");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-se-concrete p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="w-4 h-4 text-se-gold" />
        <span className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-gold">
          Notify me when available
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="bis-email" className="sr-only">
          Email for back-in-stock notification
        </label>
        <input
          id="bis-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@lab.org"
          className="flex-1 min-h-[44px] px-4 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold"
        />
        <button type="submit" disabled={busy} className={`btn-outline ${busy ? "opacity-50" : ""}`}>
          {busy ? "…" : "Notify me"}
        </button>
      </div>
      {status && <p className="text-[11px] font-accent text-se-gold mt-2">{status}</p>}
    </form>
  );
}
