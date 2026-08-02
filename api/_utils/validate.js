/**
 * api/_utils/validate.js
 * Tiny dependency-free request-body validator for the serverless endpoints.
 *
 * Chosen over Zod deliberately: the codebase is plain JS, the validation needs
 * are simple (presence / type / enum / email / array / length), and skipping a
 * runtime dependency keeps serverless cold-starts lean.
 *
 * Usage:
 *   const { ok, errors, value } = validateBody(req.body, {
 *     email:    { type: "string", required: true, email: true, max: 320 },
 *     quantity: { type: "number", min: 1, max: 99 },
 *     action:   { type: "string", enum: ["approve", "reject"] },
 *     items:    { type: "array", required: true, minLength: 1 },
 *   });
 *   if (!ok) return res.status(400).json({ error: "Invalid request", details: errors });
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkField(name, value, rule) {
  const errors = [];
  const present = value !== undefined && value !== null && value !== "";

  if (!present) {
    if (rule.required) errors.push(`${name} is required`);
    return { errors, value: rule.default !== undefined ? rule.default : value };
  }

  const type = rule.type;
  if (type === "string" && typeof value !== "string") errors.push(`${name} must be a string`);
  if (type === "number" && typeof value !== "number") errors.push(`${name} must be a number`);
  if (type === "boolean" && typeof value !== "boolean") errors.push(`${name} must be a boolean`);
  if (type === "array" && !Array.isArray(value)) errors.push(`${name} must be an array`);
  if (type === "object" && (typeof value !== "object" || Array.isArray(value)))
    errors.push(`${name} must be an object`);

  if (typeof value === "string") {
    if (rule.email && !EMAIL_RE.test(value.trim())) errors.push(`${name} must be a valid email`);
    if (rule.max != null && value.length > rule.max) errors.push(`${name} is too long`);
    if (rule.min != null && value.trim().length < rule.min) errors.push(`${name} is too short`);
    if (rule.enum && !rule.enum.includes(value)) errors.push(`${name} is invalid`);
  }

  if (typeof value === "number") {
    if (rule.min != null && value < rule.min) errors.push(`${name} must be >= ${rule.min}`);
    if (rule.max != null && value > rule.max) errors.push(`${name} must be <= ${rule.max}`);
  }

  if (Array.isArray(value)) {
    if (rule.minLength != null && value.length < rule.minLength)
      errors.push(`${name} must have at least ${rule.minLength} item(s)`);
    if (rule.maxLength != null && value.length > rule.maxLength)
      errors.push(`${name} has too many items`);
  }

  return { errors, value };
}

/**
 * @param {object} body
 * @param {Record<string, object>} schema
 * @returns {{ ok: boolean, errors: string[], value: object }}
 */
export function validateBody(body, schema) {
  const src = body && typeof body === "object" ? body : {};
  const errors = [];
  const value = {};

  for (const [name, rule] of Object.entries(schema)) {
    const res = checkField(name, src[name], rule);
    errors.push(...res.errors);
    if (res.value !== undefined) value[name] = res.value;
  }

  return { ok: errors.length === 0, errors, value };
}
