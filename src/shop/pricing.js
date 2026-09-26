// ---------------------------------------------------------------------------
// Pricing engine: the commercial source of truth for the hat builder.
//
// This module is PURE. No React, no window, no document, no imports at all,
// so the same file can run inside a serverless function and recompute an
// order from scratch instead of trusting whatever the browser posts.
//
// Split of responsibilities:
//   pricing.js  ids, human labels, prices, shipping rules, validation
//   catalog.js  the presentation layer (layer files, z-order, blends)
// catalog.js imports from here, never the other way around.
//
// ALL AMOUNTS ARE INTEGER CENTS. Never store money as a float.
//
// THE HAT (builder v2). A base plus optional stacked accessories:
//
//   step       rule                          config fields
//   base       exactly one, required         baseId
//   feather    none or one                   featherId
//   cord       none or one; Suede Stitching  cordId, cordColor, stitchingNote
//              also takes a color and an
//              optional free text note
//   brim bud   none, or a size then a color  budSize, budColor
//   matches    none or one color             matchesColor
//   size       required                      size
//
// "none" is a real value for every optional step, so a config always says
// what was chosen, including "nothing".
// ---------------------------------------------------------------------------

export const CURRENCY = "USD";

// --- the burned brand, switched off -----------------------------------------
// The branded mark (and the custom word) is off for now: no step in the
// builder, not accepted in an order, not charged. Its options, validation
// and artwork are all kept below and in catalog.js / HatStack.jsx; flip this
// to true to bring the step back exactly as it was.
export const BRANDS_ENABLED = false;

// --- prices ---------------------------------------------------------------
// The base hat is $140, confirmed by the owner, and the same for every felt
// color: the color never changes the price.
export const BASE_PRICE = 14000;
export const BASE_OPTIONS = [
  { id: "ivory", name: "Ivory", price: BASE_PRICE },
  { id: "black", name: "Black", price: BASE_PRICE },
  { id: "chocolate", name: "Chocolate", price: BASE_PRICE },
  { id: "pink", name: "Dusty Pink", price: BASE_PRICE },
  { id: "wine", name: "Wine", price: BASE_PRICE },
  { id: "turquoise", name: "Turquoise", price: BASE_PRICE },
];

// NAMES. `name` is the creative catalog name every customer sees (builder,
// cart, Stripe Checkout, the customer email). `plain` is what the piece
// physically is, shown in brackets next to the name ONLY in the owner's work
// order email, so she can pick the right piece without memorizing names.
// Rename freely; never change an `id` (ids live in carts, links and orders).

export const FEATHER_OPTIONS = [
  { id: "none", name: "No feather", price: 0 },
  { id: "natural", name: "Prairie Pheasant", plain: "natural pheasant feather band", price: 5000 },
  { id: "bronze", name: "Midnight Outlaw", plain: "bronze pheasant feather band", price: 5000 },
  { id: "guinea", name: "Dusty Trail", plain: "guinea fowl feather band", price: 5000 },
  { id: "magenta", name: "Pink Outlaw", plain: "magenta mix feather band", price: 5000 },
  { id: "polka", name: "Polka Dot Posse", plain: "black polka dot feather band", price: 5000 },
  { id: "turquoise", name: "Turquoise Queen", plain: "feather band with turquoise concho", price: 5000 },
];

export const STITCHING_COLORS = [
  { id: "raspberry", name: "Raspberry Rodeo", plain: "raspberry" },
  { id: "sage", name: "Sagebrush", plain: "sage" },
  { id: "cognac", name: "Cognac Saddle", plain: "cognac" },
  { id: "rust", name: "Desert Rust", plain: "rust" },
  { id: "navy", name: "Midnight Navy", plain: "navy" },
  { id: "teal", name: "Turquoise Creek", plain: "teal" },
];

// Free text under the stitching colors ("Want a different shade? Tell us").
export const STITCHING_NOTE_MAX_LEN = 120;

export const CORD_OPTIONS = [
  { id: "none", name: "No cord", price: 0 },
  { id: "stitching", name: "Saddle Stitch", plain: "suede stitching", price: 1000, colors: STITCHING_COLORS },
  { id: "leather-rope", name: "Ranch Hand Rope", plain: "leather rope", price: 1000 },
  { id: "barbed-wire", name: "Barbed & Beautiful", plain: "leather barbed wire", price: 1000 },
  { id: "rhinestone", name: "Rhinestone Sass", plain: "rhinestone chain", price: 1500 },
  { id: "turquoise", name: "Turquoise Trail", plain: "turquoise stone", price: 1500 },
];

// The brim bud is chosen size first, then color. The colors differ by size.
export const BUD_SIZES = [
  { id: "none", name: "No brim bud", price: 0, colors: [] },
  {
    id: "small",
    name: "Petite Bud",
    plain: "small brim bud",
    price: 2500,
    colors: [
      { id: "orange", name: "Sunset Poppy", plain: "orange" },
      { id: "yellow", name: "Wildflower", plain: "yellow" },
      { id: "teal", name: "Sage & Sky", plain: "teal" },
    ],
  },
  {
    id: "large",
    name: "Full Bloom",
    plain: "large brim bud",
    price: 3500,
    colors: [
      { id: "teal", name: "Turquoise Sky", plain: "teal" },
      { id: "red", name: "Scarlet Rodeo", plain: "red" },
      { id: "purple", name: "Lavender Sunset", plain: "purple" },
      { id: "yellow", name: "Desert Gold", plain: "yellow" },
    ],
  },
];

// One accessory, four colors. The step is called "Strike It Up"; the colors
// keep plain names on purpose.
export const MATCHES = {
  name: "Strike It Up",
  plain: "matches",
  price: 500,
  colors: [
    { id: "red", name: "Red", plain: "red" },
    { id: "black", name: "Black", plain: "black" },
    { id: "turquoise", name: "Turquoise", plain: "turquoise" },
    { id: "pink", name: "Pink", plain: "pink" },
  ],
};

// Kept for when BRANDS_ENABLED comes back on.
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

// --- free text ------------------------------------------------------------
export const BRAND_TEXT_MAX_LEN = 6;
// Letters, digits, space and a few marks that survive a branding iron.
export const BRAND_TEXT_ALLOWED = /^[A-Za-z0-9 '&.!-]*$/;

/** Strip disallowed characters and clamp the length. Safe on any input. */
export function sanitizeBrandText(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9 '&.!-]/g, "")
    .slice(0, BRAND_TEXT_MAX_LEN);
}

/**
 * The stitching note is a customer's own words, so it is cleaned rather than
 * policed: control characters out, whitespace collapsed, clamped to length.
 * Escaping for HTML happens where it is rendered, never here.
 */
export function sanitizeNote(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, STITCHING_NOTE_MAX_LEN);
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
export const findFeather = (id) => byId(FEATHER_OPTIONS, id);
export const findCord = (id) => byId(CORD_OPTIONS, id);
export const findBudSize = (id) => byId(BUD_SIZES, id);
export const findMatchesColor = (id) => byId(MATCHES.colors, id);
export const findBrand = (id) => byId(BRAND_OPTIONS, id);
export const findSize = (id) => byId(SIZE_OPTIONS, id);

/** The color option of a cord (stitching only), or null. */
export const findCordColor = (cordId, colorId) => byId(findCord(cordId)?.colors || [], colorId);
/** The color option of a bud size, or null. */
export const findBudColor = (sizeId, colorId) => byId(findBudSize(sizeId)?.colors || [], colorId);

const orNone = (v) => (v === undefined || v === null || v === "" ? "none" : v);

// The fields of one hat design, exactly as the browser posts them and the
// server reads them. One list, both sides, so they cannot drift apart. Money
// is never among them.
export const CONFIG_FIELDS = [
  "baseId",
  "featherId",
  "cordId",
  "cordColor",
  "stitchingNote",
  "budSize",
  "budColor",
  "matchesColor",
  "brandId",
  "customText",
  "size",
];

// Fields only the FIRST builder sent. They are carried through so the
// server can refuse such a line (see validateConfig) instead of quietly
// charging for a hat without the band the customer designed.
const LEGACY_FIELDS = ["bandId"];

/** Copy only the design fields (plus quantity) out of any object. */
export const pickConfig = (obj, { withQuantity = true } = {}) => {
  const out = {};
  for (const k of CONFIG_FIELDS) out[k] = obj?.[k];
  for (const k of LEGACY_FIELDS) if (obj?.[k] != null) out[k] = obj[k];
  if (withQuantity) out.quantity = obj?.quantity;
  return out;
};

// --- normalizing ----------------------------------------------------------
/**
 * The canonical shape of one hat. Lenient: missing optional steps become
 * "none", anything unknown becomes "none" or null, fields that do not apply
 * (a stitching color on a leather rope, say) are dropped. Never throws.
 * Validation, which is strict, is validateConfig below; this is what an
 * order is priced and stored from once it has passed.
 */
export function normalizeConfig(raw) {
  const c = raw || {};
  const base = findBase(c.baseId);

  const feather = findFeather(orNone(c.featherId)) || findFeather("none");

  const cord = findCord(orNone(c.cordId)) || findCord("none");
  const cordColor = cord.colors ? findCordColor(cord.id, c.cordColor)?.id ?? null : null;
  const stitchingNote = cord.id === "stitching" ? sanitizeNote(c.stitchingNote) || null : null;

  const bud = findBudSize(orNone(c.budSize)) || findBudSize("none");
  const budColor = bud.id === "none" ? null : findBudColor(bud.id, c.budColor)?.id ?? null;

  const matchesColor = findMatchesColor(c.matchesColor)?.id ?? "none";

  const brand = BRANDS_ENABLED ? findBrand(orNone(c.brandId)) || findBrand("none") : findBrand("none");
  const customText = brand.custom ? sanitizeBrandText(c.customText).trim() || null : null;

  return {
    baseId: base?.id ?? null,
    featherId: feather.id,
    cordId: cord.id,
    cordColor,
    stitchingNote,
    budSize: bud.id,
    budColor,
    matchesColor,
    brandId: brand.id,
    customText,
    size: findSize(c.size)?.id ?? null,
  };
}

// --- permalinks -----------------------------------------------------------
// Query keys the builder reads and writes, and the server uses for the
// "See this hat" link in the work order email. A permalink describes ONE
// hat design, never a cart, so quantity is deliberately absent.
export const PARAM_KEYS = {
  base: "b",
  feather: "f",
  cord: "c",
  cordColor: "cc",
  stitchingNote: "sn",
  budSize: "bs",
  budColor: "bc",
  matches: "m",
  brand: "br",
  customText: "bt",
  size: "sz",
};

// Keys from earlier builders. Links carrying them still open; the builder
// reads what it understands and drops these from the address bar.
export const LEGACY_PARAM_KEYS = ["bd", "charm", "ch", "q", ...(BRANDS_ENABLED ? [] : ["br", "bt"])];

/** Serialize a config into the builder's query string (no leading "?"). */
export function buildPermalinkQuery(config) {
  const c = normalizeConfig(config);
  const q = new URLSearchParams();
  if (c.baseId) q.set(PARAM_KEYS.base, c.baseId);
  if (c.featherId !== "none") q.set(PARAM_KEYS.feather, c.featherId);
  if (c.cordId !== "none") {
    q.set(PARAM_KEYS.cord, c.cordId);
    if (c.cordColor) q.set(PARAM_KEYS.cordColor, c.cordColor);
    if (c.stitchingNote) q.set(PARAM_KEYS.stitchingNote, c.stitchingNote);
  }
  if (c.budSize !== "none") {
    q.set(PARAM_KEYS.budSize, c.budSize);
    if (c.budColor) q.set(PARAM_KEYS.budColor, c.budColor);
  }
  if (c.matchesColor !== "none") q.set(PARAM_KEYS.matches, c.matchesColor);
  if (BRANDS_ENABLED && c.brandId !== "none") {
    q.set(PARAM_KEYS.brand, c.brandId);
    if (c.customText) q.set(PARAM_KEYS.customText, c.customText);
  }
  if (c.size) q.set(PARAM_KEYS.size, c.size);
  return q.toString();
}

/**
 * Read a permalink back into a config. Tolerant by design: an old link with
 * a band, a charm or a brand still opens, anything this catalog does not
 * know is simply ignored, and an unknown base falls back to the default.
 * A color that does not belong to its size or cord falls back to that
 * size's or cord's first color, so a hand edited link never shows nothing.
 */
export function parsePermalink(search, defaults = { baseId: "ivory" }) {
  let q;
  try {
    q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ""));
  } catch {
    q = new URLSearchParams();
  }
  const get = (k) => q.get(PARAM_KEYS[k]);

  const cordId = findCord(get("cord"))?.id ?? "none";
  const cord = findCord(cordId);
  const budSize = findBudSize(get("budSize"))?.id ?? "none";
  const bud = findBudSize(budSize);

  return normalizeConfig({
    baseId: findBase(get("base"))?.id ?? defaults.baseId,
    featherId: get("feather"),
    cordId,
    cordColor: cord.colors ? findCordColor(cordId, get("cordColor"))?.id ?? cord.colors[0].id : null,
    stitchingNote: get("stitchingNote"),
    budSize,
    budColor: bud.colors.length ? findBudColor(budSize, get("budColor"))?.id ?? bud.colors[0].id : null,
    matchesColor: get("matches"),
    brandId: BRANDS_ENABLED ? get("brand") : "none",
    customText: BRANDS_ENABLED ? get("customText") : null,
    size: get("size"),
  });
}

/** Format integer cents for display, e.g. 14000 -> "$140". */
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
 * Check a configuration against the catalog. The server runs this before
 * charging anything. Missing optional steps count as "none"; a value that
 * is PRESENT but unknown is an error, never silently dropped, because that
 * would charge for a different hat than the one on screen.
 *
 * @returns {{valid: boolean, errors: Array<{field: string, message: string}>}}
 */
export function validateConfig(config) {
  const errors = [];
  const c = config || {};
  const push = (field, message) => errors.push({ field, message });
  const show = (v) => JSON.stringify(v ?? null);

  if (!findBase(c.baseId)) push("baseId", `Unknown base: ${show(c.baseId)}`);

  if (!findFeather(orNone(c.featherId))) push("featherId", `Unknown feather: ${show(c.featherId)}`);

  const cord = findCord(orNone(c.cordId));
  if (!cord) push("cordId", `Unknown cord: ${show(c.cordId)}`);
  else if (cord.colors && !findCordColor(cord.id, c.cordColor))
    push("cordColor", "Pick a stitching color");
  if (c.stitchingNote != null && typeof c.stitchingNote !== "string")
    push("stitchingNote", "The stitching note must be text");

  const bud = findBudSize(orNone(c.budSize));
  if (!bud) push("budSize", `Unknown brim bud size: ${show(c.budSize)}`);
  else if (bud.id !== "none" && !findBudColor(bud.id, c.budColor))
    push("budColor", `Pick a color for the ${bud.name.toLowerCase()} brim bud`);

  const matches = orNone(c.matchesColor);
  if (matches !== "none" && !findMatchesColor(matches)) push("matchesColor", `Unknown matches color: ${show(c.matchesColor)}`);

  // A line from the first builder (a tab left open across the switch, say)
  // still names a band. Dropping it silently would charge for, and make, a
  // different hat from the one she designed, so the line is refused and she
  // is asked to build it again.
  if (c.bandId != null && c.bandId !== "none")
    push("bandId", "This hat was designed in an earlier version of the builder. Please build it again.");

  // Same reasoning while the brand is off: a brand in an order is refused,
  // never quietly left off the hat.
  if (!BRANDS_ENABLED && c.brandId != null && c.brandId !== "none")
    push("brandId", "Branding is not available right now. Please build this hat again.");

  if (BRANDS_ENABLED) {
    const brand = findBrand(orNone(c.brandId));
    if (!brand) push("brandId", `Unknown brand: ${show(c.brandId)}`);
    if (brand?.custom) {
      const text = typeof c.customText === "string" ? c.customText.trim() : "";
      if (!text) push("customText", "Custom text is required for the Your word brand");
      else if (text.length > BRAND_TEXT_MAX_LEN)
        push("customText", `Custom text must be ${BRAND_TEXT_MAX_LEN} characters or fewer`);
      else if (!BRAND_TEXT_ALLOWED.test(text)) push("customText", "Custom text has characters we cannot brand");
    }
  }

  if (!findSize(c.size)) push("size", `Unknown size: ${show(c.size)}`);

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

// --- the pieces of one hat, in stacking order -------------------------------
/**
 * Every priced piece of a normalized config, in the order the hat is built.
 * One place turns a config into labelled, priced parts; buildOrder, the
 * one line description and both emails all read from it.
 *
 * @returns Array<{step, label, name, detail, plain, price}>
 *   step    "base" | "feather" | "cord" | "bud" | "matches" | "brand"
 *   label   category heading, e.g. "Brim bud"
 *   name    the chosen option's catalog name, e.g. "Full Bloom"
 *   detail  its color's catalog name when it has one, e.g. "Turquoise Sky"
 *   plain   what the piece physically is, for the owner, e.g.
 *           "large brim bud, teal" (null for the base)
 */
export function hatParts(config) {
  const c = normalizeConfig(config);
  const parts = [];
  const base = findBase(c.baseId);
  if (base) parts.push({ step: "base", label: "Base", name: base.name, detail: null, plain: null, price: base.price });

  if (c.featherId !== "none") {
    const f = findFeather(c.featherId);
    parts.push({ step: "feather", label: "Feather", name: f.name, detail: null, plain: f.plain, price: f.price });
  }
  if (c.cordId !== "none") {
    const cord = findCord(c.cordId);
    const color = findCordColor(c.cordId, c.cordColor);
    const plain = color ? `${cord.plain}, ${color.plain}` : cord.plain;
    parts.push({ step: "cord", label: "Cord", name: cord.name, detail: color?.name ?? null, plain, price: cord.price });
  }
  if (c.budSize !== "none") {
    const bud = findBudSize(c.budSize);
    const color = findBudColor(c.budSize, c.budColor);
    const plain = color ? `${bud.plain}, ${color.plain}` : bud.plain;
    parts.push({ step: "bud", label: "Brim bud", name: bud.name, detail: color?.name ?? null, plain, price: bud.price });
  }
  if (c.matchesColor !== "none") {
    const color = findMatchesColor(c.matchesColor);
    // one accessory in four colors, so the color IS the choice:
    // "Strike It Up: Red"
    parts.push({ step: "matches", label: MATCHES.name, name: color.name, detail: null, plain: `${color.plain} ${MATCHES.plain}`, price: MATCHES.price });
  }
  if (BRANDS_ENABLED && c.brandId !== "none") {
    const brand = findBrand(c.brandId);
    const name = brand.custom && c.customText ? `Your word "${c.customText.toUpperCase()}"` : brand.name;
    parts.push({ step: "brand", label: "Brand", name, detail: null, plain: null, price: brand.price });
  }
  return parts;
}

/** "Name, Color" or just "Name". */
const partText = (p) => (p.detail ? `${p.name}, ${p.detail}` : p.name);

/**
 * Short human description of one hat, for cart rows and image alt text:
 * "Ivory, Prairie Pheasant, Saddle Stitch in Raspberry Rodeo, Full Bloom in
 * Turquoise Sky, Strike It Up in Red, size M". Catalog names are kept exactly
 * as written, never lowercased.
 */
export function describeConfig(config) {
  const c = normalizeConfig(config);
  const words = hatParts(c).map((p) => {
    if (p.step === "matches") return `${p.label} in ${p.name}`;
    return p.detail ? `${p.name} in ${p.detail}` : p.name;
  });
  const size = findSize(c.size);
  if (size) words.push(`size ${size.name}`);
  return words.join(", ");
}

// --- the canonical order --------------------------------------------------
/**
 * Build the canonical order for a CART: an array of lines, each line one hat
 * design with its own quantity.
 *
 * Pure arithmetic: it assumes validateCart already passed and degrades
 * safely otherwise (an unknown id contributes no line and no money, an
 * unusable quantity counts as one), so it can never throw on hostile input.
 * `items` labels are the human strings that go to Stripe; with more than one
 * hat in the cart each label is prefixed "Hat N - " so a single hat order
 * never reads "Hat 1".
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
    const quantity = normalizeQuantity(rawLine?.quantity);
    const config = { ...normalizeConfig(rawLine), quantity };
    const prefix = prefixed ? `Hat ${index + 1} - ` : "";

    const lineItems = hatParts(config).map((p) => ({
      label: `${prefix}${p.label}: ${partText(p)}`,
      unitPrice: p.price,
      quantity,
    }));
    items.push(...lineItems);

    const unitSubtotal = lineItems.reduce((sum, it) => sum + it.unitPrice, 0);
    return {
      id: rawLine?.id ?? null,
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
