// src/components/ProductReviews.jsx
// Claim-safe reviews: quality / packaging / COA / shipping / service only.
// Reads published reviews via RLS; submits through /api/reviews (server screens
// for human-use/efficacy claims and sets verified-purchase).
import React, { useEffect, useState, useCallback } from "react";
import { Star, BadgeCheck } from "lucide-react";
import { getReviews } from "../lib/catalog";
import { supabase } from "../lib/supabaseClient";

const ASPECTS = ["quality", "packaging", "coa", "shipping", "service"];

function Stars({ value = 0, onSelect }) {
  return (
    <span className="inline-flex flex-wrap gap-0.5 max-w-full" role={onSelect ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            className={`w-4 h-4 ${filled ? "text-se-gold fill-se-gold" : "text-se-steel"}`}
          />
        );
        return onSelect ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === Math.round(value)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onSelect(n)}
            className="min-h-[44px] min-w-[28px] shrink flex items-center justify-center"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export default function ProductReviews({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [aspect, setAspect] = useState("quality");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (productId) getReviews(productId).then(setReviews);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length
      : 0;

  async function submit(e) {
    e.preventDefault();
    setStatus("");
    setSubmitting(true);
    try {
      let token = null;
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token || null;
      }
      if (!token) throw new Error("Please sign in to leave a review.");
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, rating, aspect, title, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not submit review.");
      setTitle("");
      setBody("");
      setStatus("Thanks — your review was posted.");
      load();
    } catch (err) {
      setStatus(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section-pad border-t border-se-concrete">
      <div className="content-wide max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-xl tracking-[0.04em] text-se-bone">
            REVIEWS
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <Stars value={avg} />
              <span className="text-[12px] font-accent text-se-steel">
                {avg.toFixed(1)} · {reviews.length}
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-se-steel/80 font-accent mb-8 leading-relaxed">
          Reviews describe quality, packaging, COA verification, shipping, and
          service only — not human or animal use, results, or dosing.
        </p>

        {/* Submit form */}
        <form onSubmit={submit} className="glass-panel p-6 mb-10 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">
              Your rating
            </span>
            <Stars value={rating} onSelect={setRating} />
          </div>
          <div>
            <label htmlFor="rv-aspect" className="sr-only">
              Aspect
            </label>
            <select
              id="rv-aspect"
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent focus:outline-none focus:border-se-gold"
            >
              {ASPECTS.map((a) => (
                <option key={a} value={a}>
                  {a[0].toUpperCase() + a.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={120}
            className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Comments on quality, packaging, COA, shipping, or service…"
            maxLength={2000}
            rows={3}
            className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold"
          />
          {status && (
            <p className="text-[12px] font-accent text-se-gold">{status}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`btn-outline ${submitting ? "opacity-50" : ""}`}
          >
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </form>

        {/* List */}
        {reviews.length === 0 ? (
          <p className="text-[13px] text-se-bone/45 font-accent">
            No reviews yet. Be the first to review the quality and documentation.
          </p>
        ) : (
          <div className="space-y-5">
            {reviews.map((r, i) => (
              <div key={i} className="border-b border-se-concrete/50 pb-5">
                <div className="flex items-center gap-3 mb-1">
                  <Stars value={r.rating} />
                  {r.aspect && (
                    <span className="text-[10px] font-accent uppercase tracking-[0.14em] text-se-steel">
                      {r.aspect}
                    </span>
                  )}
                  {r.verified_purchase && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-accent text-se-gold">
                      <BadgeCheck className="w-3.5 h-3.5" /> Verified
                    </span>
                  )}
                </div>
                {r.title && (
                  <p className="text-[13px] font-accent text-se-bone">{r.title}</p>
                )}
                {r.body && (
                  <p className="text-[13px] text-se-bone/60 font-accent mt-1 leading-relaxed">
                    {r.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
