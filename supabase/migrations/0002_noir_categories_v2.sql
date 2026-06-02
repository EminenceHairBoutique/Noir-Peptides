-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — Category taxonomy v2 (ADDITIVE / NON-DESTRUCTIVE)
--
-- Adds the `receptor-signaling-research` category and renames two category
-- slugs to their final values. No columns or tables are dropped. Existing
-- products are remapped to the corrected slugs in place.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Upsert the final 7-category taxonomy ──────────────────────────────
insert into public.product_categories (slug, name, description, sort_order) values
  ('tissue-research',            'Tissue Research',            'Peptide reference materials used in controlled laboratory research related to tissue-model pathways.', 1),
  ('gh-axis-research',           'GH-Axis Research',           'Research materials studied in relation to growth-hormone-axis signaling models.', 2),
  ('neurochemical-research',     'Neurochemical Research',     'Peptide materials used in laboratory models related to neurochemical signaling.', 3),
  ('metabolic-pathway-research', 'Metabolic Pathway Research', 'Research compounds studied in controlled models of metabolic signaling.', 4),
  ('cellular-aging-research',    'Cellular Aging Research',    'Materials used in laboratory models involving cellular maintenance and aging-related pathways.', 5),
  ('receptor-signaling-research','Receptor Signaling Research','Reference materials studied in controlled laboratory models involving receptor signaling.', 6),
  ('reference-materials',        'Reference Materials',        'Batch-documented peptide materials for qualified research use.', 7)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order;

-- ── 2. Remap any products on the old slugs (non-destructive) ─────────────
update public.products set category_slug = 'neurochemical-research'
  where category_slug = 'neuro-research';
update public.products set category_slug = 'metabolic-pathway-research'
  where category_slug = 'metabolic-research';

-- ── 3. Deprecate (do not delete) the superseded category rows ────────────
-- Keep rows for referential history; mark them out of the active taxonomy.
update public.product_categories set sort_order = 999
  where slug in ('neuro-research', 'metabolic-research');

-- ── 4. Seed the new receptor-signaling reference material ────────────────
insert into public.products
  (id, slug, name, subtitle, category_slug, price, vial_size_mg, purity_percent,
   peptide_sequence, molecular_weight, form, storage_temp, cas_number,
   batch_number, research_use_only, stock_status, short_description, description,
   featured, is_new)
values
  ('np-kisspeptin10-5mg','kisspeptin-10-5mg','Kisspeptin-10 5mg','Receptor-ligand research peptide','receptor-signaling-research',52,5,98.0,
   'YNWNSFGLRF-NH2','1302.49 g/mol','lyophilized_powder','-20°C','374675-21-5','NP-KP10-0260',true,'in_stock',
   'Lyophilized decapeptide reference material for in vitro receptor-signaling research.',
   'Kisspeptin-10 5mg is a lyophilized peptide reference material supplied for in vitro laboratory research. Each batch is documented with available analytical information, including purity, molecular weight, storage requirements, and batch-specific documentation where available.',
   false,true)
on conflict (id) do update set
  category_slug     = excluded.category_slug,
  name              = excluded.name,
  subtitle          = excluded.subtitle,
  short_description = excluded.short_description,
  description       = excluded.description,
  research_use_only = true,
  updated_at        = now();

-- NOTE: GLP-1 analogs (Semaglutide, Tirzepatide, Retatrutide, Cagrilintide,
-- Mazdutide, and similar) remain intentionally NOT seeded pending legal +
-- payment-processing review.
