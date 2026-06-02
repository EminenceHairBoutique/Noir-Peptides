// src/utils/format.js
// Shared formatting helpers used across pages and components.

/**
 * Formats a number as a USD dollar amount with no decimal places.
 * e.g. 1234.5 → "$1,235"
 */
export const formatMoney = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Formats a byte count as a human-readable file size string.
 * e.g. 1536 → "2 KB", 2097152 → "2.0 MB"
 */
export const formatBytes = (bytes = 0) => {
  const n = Number(bytes || 0);
  if (n <= 0) return "0 KB";
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};
