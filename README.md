# Noir Peptides

Noir Peptides is a research-grade peptide e-commerce site built with React 19,
Vite, Tailwind CSS v4, Supabase, Stripe, and Vercel.

> **Compliance:** All products are sold as reference materials for in vitro
> laboratory research only. **Not for human or veterinary use.** Not intended
> to diagnose, treat, cure, or prevent any disease. The site contains no
> dosing, administration, or therapeutic-claim language by design.

## Brand

- Position: Clinical authority meets dark luxury laboratory.
- Tagline: **Precision. Purity. Performance.**
- Sub-tagline: **For Research Purposes Only.**

## Core stack

- React 19
- Vite 6
- Tailwind CSS v4 (CSS `@theme` design tokens in `src/index.css`)
- React Router 7
- Supabase (auth / orders)
- Stripe Checkout
- Vercel serverless functions
- Resend (transactional email)
- Playwright

## Research catalog domains

- Tissue Research
- GH-Axis Research
- Neurochemical Research
- Metabolic Research
- Cellular Aging Research
- Reference Materials

## Local development

```bash
npm install
npm run dev      # vite + local API
npm run build    # vite build + static SEO generation
npm run lint
```

Catalog data lives in `src/data/products.js`. An additive Supabase migration
for a database-backed catalog is in `supabase/migrations/`.
