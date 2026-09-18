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
 * The one and only shipping rule. `quantity` is the TOTAL number of hats in
 * the cart, so two different hats of one each earn free shipping exactly
 * like one hat of two. `subtotal` is accepted (and deliberately unused) so
 * switching back to a money threshold later is a change inside this
 * function and nowhere else.
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
// Per cart line.
export const MAX_QUANTITY = 10;
// Across the whole cart.
export const MAX_CART_QUANTITY = 10;

// --- lookup helpers -------------------------------------------------------
const byId = (options, id) => options.find((o) => o.id === id) || null;

export const findBase = (id) => byId(BASE_OPTIONS, id);
export const findBand = (id) => byId(BAND_OPTIONS, id);
export const findBrand = (id) => byId(BRAND_OPTIONS, id);
export const findSize = (id) => byId(SIZE_OPTIONS, id);

// --- permalinks -----------------------------------------------------------
// Query keys the builder reads and writes. They live here, next to the
// config shape, because the checkout function builds the same permalink
// server-side for the cancel URL and for Stripe metadata; if the two
// drifted, a cancelled checkout would drop the customer on an empty
// builder. One definition, both callers.
// A permalink describes ONE hat design, never a cart: it is for sharing a
// build. Quantity is deliberately absent, because quantity now belongs to a
// cart line and not to the design itself.
export const PARAM_KEYS = {
  base: "b",
  band: "bd",
  brand: "br",
  customText: "bt",
  size: "sz",
};

/**
 * Serialize a config into the builder's query string (no leading "?").
 * The custom text only rides along when the custom brand is selected.
 */
export function buildPermalinkQuery(config) {
  const c = config || {};
  const q = new URLSearchParams();
  if (c.baseId) q.set(PARAM_KEYS.base, c.baseId);
  if (c.bandId) q.set(PARAM_KEYS.band, c.bandId);
  if (c.brandId) q.set(PARAM_KEYS.brand, c.brandId);
  if (findBrand(c.brandId)?.custom && c.customText) q.set(PARAM_KEYS.customText, c.customText);
  if (c.size) q.set(PARAM_KEYS.size, c.size);
  return q.toString();
}

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

/**
 * Validate a whole cart: every line against the catalog, the cart not empty,
 * and the hats across all lines within MAX_CART_QUANTITY. Errors carry the
 * index of the offending line (null for cart-wide problems).
 *
 * @returns {{valid: boolean, errors: Array<{index: number|null, field: string, message: string}>}}
 */
export function validateCart(cart) {
  const errors = [];
  if (!Array.isArray(cart) || cart.length === 0)
    return { valid: false, errors: [{ index: null, field: "cart", message: "Your cart is empty" }] };

  cart.forEach((line, index) => {
    for (const err of validateConfig(line).errors) errors.push({ index, ...err });
  });

  const totalQuantity = countHats(cart);
  if (totalQuantity > MAX_CART_QUANTITY)
    errors.push({
      index: null,
      field: "cart",
      message: `A single order can hold up to ${MAX_CART_QUANTITY} hats`,
    });

  return { valid: errors.length === 0, errors };
}

/** Total hats across every cart line. Safe on any input. */
export function countHats(cart) {
  if (!Array.isArray(cart)) return 0;
  return cart.reduce((sum, line) => sum + normalizeQuantity(line?.quantity), 0);
}

function normalizeQuantity(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= MIN_QUANTITY ? n : MIN_QUANTITY;
}

/** Short human description of one hat, for cart rows and emails. */
export function describeConfig(config) {
  const c = config || {};
  const brand = findBrand(c.brandId);
  const parts = [];
  const base = findBase(c.baseId);
  if (base) parts.push(base.name);
  const band = findBand(c.bandId);
  if (band && band.id !== "none") parts.push(band.name);
  if (brand && brand.id !== "none") {
    const text = brand.custom ? sanitizeBrandText(c.customText).trim().toUpperCase() : "";
    parts.push(brand.custom && text ? `"${text}"` : brand.name);
  }
  const size = findSize(c.size);
  if (size) parts.push(`size ${size.name}`);
  return parts.join(", ");
}

// --- the canonical order --------------------------------------------------
/**
 * Build the canonical order for a CART: an array of lines, each line one hat
 * design with its own quantity.
 *
 *   line = { id, baseId, bandId, brandId, customText, size, quantity }
 *
 * Pure arithmetic: it assumes validateCart already passed and degrades
 * safely otherwise (an unknown id contributes no line and no money, an
 * unusable quantity counts as one), so it can never throw on hostile input.
 * `items` labels are the human strings that go to Stripe and to the owner's
 * email; with more than one hat in the cart each label is prefixed "Hat N - "
 * so a single hat order never reads "Hat 1".
 *
 * @returns {{
 *   items: Array<{label: string, unitPrice: number, quantity: number}>,
 *   lines: Array<{id: string|null, quantity: number, unitSubtotal: number,
 *                 lineSubtotal: number, description: string, config: object}>,
 *   totalQuantity: number, subtotal: number, shipping: number, total: number,
 *   freeShippingApplied: boolean, currency: string
 * }}
 */
export function buildOrder(cart) {
  const input = Array.isArray(cart) ? cart : [];
  const prefixed = input.length > 1;

  const items = [];
  const lines = input.map((rawLine, index) => {
    const c = rawLine || {};
    const quantity = normalizeQuantity(c.quantity);
    const base = findBase(c.baseId);
    const band = findBand(c.bandId);
    const brand = findBrand(c.brandId);
    const customText = brand?.custom ? sanitizeBrandText(c.customText).trim() : null;
    const prefix = prefixed ? `Hat ${index + 1} - ` : "";

    const lineItems = [];
    const addLine = (categoryLabel, option, nameOverride) => {
      if (!option || option.id === "none") return;
      lineItems.push({
        label: `${prefix}${categoryLabel}: ${nameOverride || option.name}`,
        unitPrice: option.price,
        quantity,
      });
    };
    addLine("Base", base);
    addLine("Band", band);
    addLine("Brand", brand, brand?.custom && customText ? `Your word "${customText.toUpperCase()}"` : null);
    items.push(...lineItems);

    const unitSubtotal = lineItems.reduce((sum, it) => sum + it.unitPrice, 0);
    const config = {
      baseId: base?.id ?? null,
      bandId: band?.id ?? null,
      brandId: brand?.id ?? null,
      customText,
      size: findSize(c.size)?.id ?? null,
      quantity,
    };
    return {
      id: c.id ?? null,
      quantity,
      unitSubtotal,
      lineSubtotal: unitSubtotal * quantity,
      description: describeConfig(config),
      config,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const shipping = lines.length ? calculateShipping(totalQuantity, subtotal) : 0;

  return {
    items,
    lines,
    totalQuantity,
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShippingApplied: lines.length > 0 && shipping === 0,
    currency: CURRENCY,
  };
}
