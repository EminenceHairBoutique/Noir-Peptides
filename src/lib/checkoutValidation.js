// src/lib/checkoutValidation.js
// Pure, dependency-free validation for the two-step checkout Step 1. No React,
// no DOM — so it unit-tests in plain Node and the component and tests share one
// source of truth. Every function returns a map of { field: "message" } for
// the fields it owns; an empty object means valid.

import { US_STATE_CODES } from "./usStates.js";
import { RESEARCH_ENTITIES, RESEARCH_PROTOCOLS, SHIPPING_METHODS } from "../config/checkout.js";
import { CHECKOUT_ATTESTATION_IDS } from "../config/checkoutAttestations.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const SHIPPING_IDS = new Set(SHIPPING_METHODS.map((m) => m.id));

const req = (v) => typeof v === "string" && v.trim().length > 0;

export function validateContact(c = {}) {
  const e = {};
  if (!req(c.firstName)) e.firstName = "First name is required.";
  if (!req(c.lastName)) e.lastName = "Last name is required.";
  if (!req(c.email)) e.email = "Email is required.";
  else if (!EMAIL_RE.test(c.email.trim())) e.email = "Enter a valid email address.";
  // phone optional; if present, must look like a phone
  if (req(c.phone) && c.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number.";
  return e;
}

export function validateAddress(a = {}, prefix = "") {
  const e = {};
  const k = (name) => `${prefix}${name}`;
  // institution, contactName, line2, phone are optional
  if (!req(a.line1)) e[k("line1")] = "Street address is required.";
  if (!req(a.city)) e[k("city")] = "Town / city is required.";
  if (!req(a.state)) e[k("state")] = "State is required.";
  else if (!US_STATE_CODES.has(a.state)) e[k("state")] = "Select a valid US state.";
  if (!req(a.zip)) e[k("zip")] = "ZIP is required.";
  else if (!ZIP_RE.test(a.zip.trim())) e[k("zip")] = "Enter a valid ZIP (12345 or 12345-6789).";
  return e;
}

export function validateResearch(r = {}) {
  const e = {};
  if (!req(r.entity)) e.entity = "Select a research entity.";
  else if (!RESEARCH_ENTITIES.includes(r.entity)) e.entity = "Select a valid research entity.";
  if (!req(r.protocol)) e.protocol = "Select an intended research use.";
  else if (!RESEARCH_PROTOCOLS.includes(r.protocol)) e.protocol = "Select a valid research use.";
  return e;
}

export function validateShippingMethod(id) {
  return SHIPPING_IDS.has(id) ? {} : { shippingMethod: "Select a shipping method." };
}

/**
 * Attestations: a map { id: boolean }. ALL required ids must be true.
 * Returns { attestations: msg } if any is missing.
 */
export function validateAttestations(att = {}) {
  const allChecked = CHECKOUT_ATTESTATION_IDS.every((id) => att[id] === true);
  return allChecked ? {} : { attestations: "All three certifications are required." };
}

/**
 * Whole Step-1 validation. `state` shape:
 *   { contact, shipping, billingDifferent, billing, research, shippingMethod, attestations }
 * Returns the merged error map (empty = ready to advance).
 */
export function validateStep1(state = {}) {
  return {
    ...validateContact(state.contact),
    ...validateAddress(state.shipping),
    ...(state.billingDifferent ? validateAddress(state.billing, "billing_") : {}),
    ...validateResearch(state.research),
    ...validateShippingMethod(state.shippingMethod),
    ...validateAttestations(state.attestations),
  };
}

export function isStep1Valid(state) {
  return Object.keys(validateStep1(state)).length === 0;
}
