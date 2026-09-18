// ---------------------------------------------------------------------------
// Pricing engine: the commercial source of truth for the hat builder.
//
// This module is PURE. No React, no window, no document, no imports at all,
// so the same file can run inside a serverless function and recompute an
// order from scratch instead of trusting whatever the browser posts.
//
// Split of responsibilities:
//   pricing.js  ids, human labels, prices, shipping rules, validation
//   catalog.js  the presentation layer (layer images, z-order, blends)
// catalog.js imports from here, never the other way around.
//
// ALL AMOUNTS ARE INTEGER CENTS. Never store money as a float.
// ---------------------------------------------------------------------------

export const CURRENCY = "USD";

// --- prices ---------------------------------------------------------------
// TODO(prices): these are the placeholder tiers the site has been running
// with; they were moved here verbatim from catalog.js and NOT re-priced.
// Swap in the owner's real price list when it arrives; this block is the
// only place any amount needs to change.
export const BASE_OPTIONS = [
  { id: "ivory", name: "Ivory", price: 9800 },
  { id: "black", name: "Black", price: 10500 },
  { id: "chocolate", name: "Chocolate", price: 9800 },
  { id: "pink", name: "Dusty Pink", price: 10500 },
  { id: "wine", name: "Wine", price: 10500 },
  { id: "turquoise", name: "Turquoise", price: 9800 },
];

export const BAND_OPTIONS = [
  { id: "none", name: "No band", price: 0 },
  { id: "lace-pearls", name: "Lace & Pearls", price: 1600 },
  { id: "ribbons", name: "Braided Ribbons", price: 1400 },
  { id: "leather", name: "Leather & Buckle", price: 1200 },
  { id: "feathers", name: "Feather", price: 1400 },
  { id: "turquoise", name: "Turquoise Stone", price: 1800 },
];

export const BRAND_OPTIONS = [
  { id: "none", name: "No brand", price: 0 },
  { id: "star", name: "Star", price: 1200 },
  { id: "longhorn", name: "Longhorn", price: 1200 },
  { id: "cactus", name: "Cactus", price: 1200 },
  { id: "heart", name: "Heart", price: 1200 },
  { id: "custom", name: "Your word", price: 1200, custom: true },
];

export const SIZE_OPTIONS = [
  { id: "s", name: "S", cm: "54 to 55 cm" },
  { id: "m", name: "M", cm: "56 to 57 cm" },
  { id: "l", name: "L", cm: "58 to 59 cm" },
  { id: "xl", name: "XL", cm: "60 to 61 cm" },
];

// --- shipping -------------------------------------------------------------
// Flat rate carried over from the previous SHIPPING.flat ($12).
// TODO(shipping): confirm the real rate with the carrier before charging.
export const SHIPPING_FLAT = 1200;

// Shipping is free from this many hats up.
export const FREE_SHIPPING_MIN_QTY = 2;

/**
 * The one and only shipping rule. Today it is quantity based; `subtotal` is
 * accepted (and deliberately unused) so switching back to a money threshold
 * later is a change inside this function and nowhere else.
 */
export function calculateShipping(quantity, subtotal) {
  void subtotal;
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 1) return SHIPPING_FLAT;
  return qty >= FREE_SHIPPING_MIN_QTY ? 0 : SHIPPING_FLAT;
}

// --- custom brand text ----------------------------------------------------
export const BRAND_TEXT_MAX_LEN = 6;
// Letters, digits, space and a few marks that survive a branding iron.
export const BRAND_TEXT_ALLOWED = /^[A-Za-z0-9 '&.!-]*$/;

/** Strip disallowed characters and clamp the length. Safe on any input. */
export function sanitizeBrandText(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9 '&.!-]/g, "")
    .slice(0, BRAND_TEXT_MAX_LEN);
}

// --- order limits ---------------------------------------------------------
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

// --- lookup helpers -------------------------------------------------------
const byId = (options, id) => options.find((o) => o.id === id) || null;

export const findBase = (id) => byId(BASE_OPTIONS, id);
export const findBand = (id) => byId(BAND_OPTIONS, id);
export const findBrand = (id) => byId(BRAND_OPTIONS, id);
export const findSize = (id) => byId(SIZE_OPTIONS, id);

/** Format integer cents for display, e.g. 9800 -> "$98". */
export function formatCents(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);
}

// --- validation -----------------------------------------------------------
/**
 * Check a configuration against the catalog. Call this on the server before
 * charging anything, and in the UI before opening checkout.
 *
 * @returns {{valid: boolean, errors: Array<{field: string, message: string}>}}
 */
export function validateConfig(config) {
  const errors = [];
  const c = config || {};
  const push = (field, message) => errors.push({ field, message });

  if (!findBase(c.baseId)) push("baseId", `Unknown base: ${JSON.stringify(c.baseId ?? null)}`);
  if (!findBand(c.bandId)) push("bandId", `Unknown band: ${JSON.stringify(c.bandId ?? null)}`);

  const brand = findBrand(c.brandId);
  if (!brand) push("brandId", `Unknown brand: ${JSON.stringify(c.brandId ?? null)}`);

  if (!findSize(c.size)) push("size", `Unknown size: ${JSON.stringify(c.size ?? null)}`);

  // Custom text only matters when the custom brand is selected; on any other
  // brand a stray value is ignored rather than rejected (buildOrder drops it).
  if (brand?.custom) {
    const text = typeof c.customText === "string" ? c.customText.trim() : "";
    if (!text) push("customText", "Custom text is required for the Your word brand");
    else if (text.length > BRAND_TEXT_MAX_LEN)
      push("customText", `Custom text must be ${BRAND_TEXT_MAX_LEN} characters or fewer`);
    else if (!BRAND_TEXT_ALLOWED.test(text))
      push("customText", "Custom text has characters we cannot brand");
  }

  const qty = c.quantity;
  if (!Number.isInteger(qty) || qty < MIN_QUANTITY || qty > MAX_QUANTITY)
    push("quantity", `Quantity must be a whole number between ${MIN_QUANTITY} and ${MAX_QUANTITY}`);

  return { valid: errors.length === 0, errors };
}

// --- the canonical order --------------------------------------------------
/**
 * Build the canonical order for a configuration. Pure arithmetic: it assumes
 * validateConfig already passed, and degrades safely otherwise (an unknown
 * id simply contributes no line and no money, an unusable quantity counts as
 * one), so it can never throw on hostile input. Labels are the human strings
 * that go to Stripe and to the owner's email.
 *
 * @returns {{
 *   items: Array<{label: string, unitPrice: number, quantity: number}>,
 *   unitSubtotal: number, subtotal: number, shipping: number, total: number,
 *   freeShippingApplied: boolean, currency: string,
 *   config: {baseId: string, bandId: string, brandId: string,
 *            customText: string|null, size: string|null, quantity: number}
 * }}
 */
export function buildOrder(config) {
  const c = config || {};
  const rawQty = Number(c.quantity);
  const quantity = Number.isInteger(rawQty) && rawQty >= MIN_QUANTITY ? rawQty : MIN_QUANTITY;

  const base = findBase(c.baseId);
  const band = findBand(c.bandId);
  const brand = findBrand(c.brandId);
  const customText = brand?.custom ? sanitizeBrandText(c.customText).trim() : null;

  const items = [];
  const addLine = (categoryLabel, option, nameOverride) => {
    if (!option || option.id === "none") return;
    items.push({
      label: `${categoryLabel}: ${nameOverride || option.name}`,
      unitPrice: option.price,
      quantity,
    });
  };
  addLine("Base", base);
  addLine("Band", band);
  addLine("Brand", brand, brand?.custom && customText ? `Your word "${customText.toUpperCase()}"` : null);

  const unitSubtotal = items.reduce((sum, it) => sum + it.unitPrice, 0);
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const shipping = calculateShipping(quantity, subtotal);

  return {
    items,
    unitSubtotal,
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShippingApplied: shipping === 0,
    currency: CURRENCY,
    config: {
      baseId: base?.id ?? null,
      bandId: band?.id ?? null,
      brandId: brand?.id ?? null,
      customText,
      size: findSize(c.size)?.id ?? null,
      quantity,
    },
  };
}
