// ---------------------------------------------------------------------------
// One cart line, without React: its id, its quantity clamp, and its revival
// against the CURRENT catalog when a cart is read back from localStorage.
// Pure, so tests/ can run it in Node; cart.jsx uses it unchanged.
// ---------------------------------------------------------------------------

import { MAX_QUANTITY, MIN_QUANTITY, normalizeConfig, validateConfig } from "./pricing.js";

/** Local row identifier. Never a Stripe id: it only exists to edit and remove. */
export function newLineId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through to the manual id */
  }
  return `line_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const clampQuantity = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, n));
};

/**
 * Normalize one stored line against the CURRENT catalog. Returns null when
 * the line references anything that no longer exists, so a cart saved before
 * an option was retired simply loses that row instead of breaking the page.
 */
export function reviveLine(raw) {
  if (!raw || typeof raw !== "object") return null;
  // Strict first: a stored value that is present but unknown (a retired
  // color, say) drops the row instead of silently becoming "none".
  // A row saved before hat types has no hatType: it is wool, and
  // normalizeConfig writes "wool" into it from here on.
  const candidate = { ...raw, quantity: clampQuantity(raw.quantity) };
  if (!validateConfig(candidate).valid) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newLineId(),
    ...normalizeConfig(candidate),
    quantity: candidate.quantity,
  };
}

