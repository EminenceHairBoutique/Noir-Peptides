// src/utils/strings.js
// Shared string-normalization helpers used across pages and components.

/**
 * Normalizes a string for comparison: lowercases and strips all non-alphanumeric characters.
 * Allows older URL params like `texture=body-wave` to match `BodyWave`.
 */
export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

/** Returns true when two strings are equal after normalization. */
export const isSame = (a, b) => norm(a) === norm(b);

/**
 * Converts a string to a URL-friendly slug.
 * e.g. "F/W 2025 & Beyond" → "fw-2025-and-beyond"
 */
export const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
