// src/config/business.js
// Central business-identity config. Competitors lead with phone, address, a
// satisfaction guarantee, and a daily shipping cutoff; the rendering for all of
// them is built now so launch day is a config edit, not a code change.
//
// EVERY FIELD IS null BY DEFAULT. The renderers show an element ONLY when its
// value is set, so with this file untouched the Footer and /contact output are
// byte-identical to today. NEVER fill these with placeholder or example data —
// a fake phone number or address is worse than none (it misroutes real people
// and is a trust/compliance liability). Fill each field only with the real,
// verified value on launch day.
export const BUSINESS = {
  // E.164 or display format, e.g. "+1 (555) 010-0143". Competitor benchmark:
  // a visible support phone number on every page.
  phone: null,

  // Array of address lines, e.g. ["Noir Peptides", "123 Research Way", "City, ST 00000"].
  // Null = no physical address shown.
  addressLines: null,

  // Integer number of days for the satisfaction guarantee. Competitor
  // benchmark: 30-day guarantee. Null = no guarantee surfaced anywhere
  // (including /legal/returns).
  guaranteeDays: null,

  // Daily order cutoff for same-day handling, e.g. "2:00 PM". Competitor
  // benchmark: 2 PM ET cutoff. Null = no cutoff shown.
  shipCutoff: null,

  // Timezone label paired with shipCutoff. Has no effect unless shipCutoff is
  // set. Defaults to ET (the benchmark), but is only ever rendered alongside a
  // real cutoff value.
  shipCutoffTz: "ET",

  // Days the cutoff applies to, rendered only alongside a real shipCutoff.
  shipCutoffDays: "Monday–Friday",

  // Day-by-day business hours. NULL by default. When set, use an array of
  // { day, opens, closes } — or { day, closed: true } for a closed day, e.g.
  //   [{ day: "Monday", opens: "9:00 AM", closes: "5:00 PM" },
  //    { day: "Saturday", closed: true }]
  // Never invent hours: an unset value renders no hours table at all.
  hours: null,

  // Fulfilment statements. Both are FACTUAL descriptions of how orders are
  // packed and how the charge appears — set them only once true of the real
  // operation. Null renders nothing.
  //   discreetPackaging: e.g. "Ships in plain, unbranded outer packaging."
  //   billingDescriptor: the literal descriptor shown on a card statement.
  discreetPackaging: null,
  billingDescriptor: null,
};

// Helpers so consumers never render an empty/placeholder element. Each returns
// null when the underlying value is absent.
export const hasPhone = () => typeof BUSINESS.phone === "string" && BUSINESS.phone.trim() !== "";
export const hasAddress = () =>
  Array.isArray(BUSINESS.addressLines) && BUSINESS.addressLines.filter((l) => String(l || "").trim()).length > 0;
export const hasGuarantee = () => Number.isFinite(BUSINESS.guaranteeDays) && BUSINESS.guaranteeDays > 0;
export const hasShipCutoff = () => typeof BUSINESS.shipCutoff === "string" && BUSINESS.shipCutoff.trim() !== "";
export const hasHours = () =>
  Array.isArray(BUSINESS.hours) && BUSINESS.hours.filter((h) => h && h.day).length > 0;
export const hasDiscreetPackaging = () =>
  typeof BUSINESS.discreetPackaging === "string" && BUSINESS.discreetPackaging.trim() !== "";
export const hasBillingDescriptor = () =>
  typeof BUSINESS.billingDescriptor === "string" && BUSINESS.billingDescriptor.trim() !== "";

/** Same-day dispatch statement, or null when no cutoff is configured. */
export const shipCutoffStatement = () =>
  hasShipCutoff()
    ? `Orders placed before ${BUSINESS.shipCutoff} ${BUSINESS.shipCutoffTz}${
        BUSINESS.shipCutoffDays ? ` ${BUSINESS.shipCutoffDays}` : ""
      } ship the same business day.`
    : null;

// A phone href stripped to dialable characters, or null.
export const phoneHref = () => (hasPhone() ? `tel:${BUSINESS.phone.replace(/[^\d+]/g, "")}` : null);
