// ---------------------------------------------------------------------------
// Pricing engine: the commercial source of truth for the hat builder.
//
// This module is PURE. No React, no window, no document, and no imports but
// plain data (the generated stamp ids), so the same file can run inside a
// serverless function and recompute an order from scratch instead of
// trusting whatever the browser posts.
//
// Split of responsibilities:
//   pricing.js  ids, human labels, prices, shipping rules, validation
//   catalog.js  the presentation layer (layer files, z-order, blends)
// catalog.js imports from here, never the other way around.
//
// ALL AMOUNTS ARE INTEGER CENTS. Never store money as a float.
//
// THE HAT (builder v2). A hat type, a base color, plus optional stacked
// accessories:
//
//   step       rule                          config fields
//   type       wool, suede or straw; only    hatType (missing means wool)
//              enabled types can be ordered
//   base       one color OF THAT TYPE        baseId
//   feather    none or one                   featherId
//   cord       none or one; Suede Stitching  cordId, cordColor, stitchingNote
//              also takes a color and an
//              optional free text note
//   brim bud   none, or a size then a color  budSize, budColor
//   matches    none or one color             matchesColor
//   size       required, a size OF THAT TYPE size
//   engraving  a list of burned stamps and     engraving (missing means [])
//              letters, front and left; see
//              ENGRAVING_ENABLED below
//
// Each hat type (HAT_TYPES below) sets its own base price, colors, sizes,
// which accessories it takes and whether it can be branded.
//
// "none" is a real value for every optional step, so a config always says
// what was chosen, including "nothing".
// ---------------------------------------------------------------------------

import { ENGRAVING_STAMP_IDS } from "./engravingStampIds.js";

export const CURRENCY = "USD";

// --- the burned brand, switched off -----------------------------------------
// The branded mark (and the custom word) is off for now: no step in the
// builder, not accepted in an order, not charged. Its options, validation
// and artwork are all kept below and in catalog.js / HatStack.jsx; flip this
// to true to bring the step back exactly as it was.
export const BRANDS_ENABLED = false;

// --- base colors ----------------------------------------------------------
// The price lives on the hat type (HAT_TYPES), never on a color: within a
// type every color costs the same.
//
// WOOL keeps the original six ids, because they are in carts, links, past
// orders and the Cloudinary layer files; only the visible names changed
// (ivory reads "Silver Belly", pink "Soft Pink", wine "Burgundy"). The list
// order is the order of the tiles in the builder.
export const BASE_PRICE = 14000; // wool, confirmed by the owner
export const BASE_OPTIONS = [
  { id: "ivory", name: "Silver Belly", price: BASE_PRICE },
  { id: "white", name: "White", price: BASE_PRICE },
  { id: "sand", name: "Sand", price: BASE_PRICE },
  { id: "chocolate", name: "Chocolate", price: BASE_PRICE },
  { id: "black", name: "Black", price: BASE_PRICE },
  { id: "navy", name: "Navy", price: BASE_PRICE },
  { id: "baby-blue", name: "Baby Blue", price: BASE_PRICE },
  { id: "turquoise", name: "Turquoise", price: BASE_PRICE },
  { id: "pink", name: "Soft Pink", price: BASE_PRICE },
  { id: "cotton-candy-pink", name: "Cotton Candy Pink", price: BASE_PRICE },
  { id: "red", name: "Red", price: BASE_PRICE },
  { id: "wine", name: "Burgundy", price: BASE_PRICE },
];
export const WOOL_COLORS = BASE_OPTIONS;

// Their artwork is on Cloudinary (catalog.js). Faux Suede is on sale;
// straw stays off until the owner turns it on.
export const SUEDE_COLORS = [
  { id: "cream", name: "Cream" },
  { id: "black", name: "Black" },
  { id: "brown", name: "Brown" },
  { id: "camel", name: "Camel" },
  { id: "tobacco", name: "Tobacco" },
  { id: "burgundy", name: "Burgundy" },
  { id: "navy", name: "Navy" },
  { id: "olive", name: "Olive" },
  { id: "gray", name: "Gray" },
];
export const STRAW_COLORS = [
  { id: "cream", name: "Cream" },
  { id: "black", name: "Black" },
];

// NAMES. `name` is the creative catalog name every customer sees (builder,
// cart, Stripe Checkout, the customer email). `plain` is what the piece
// physically is, shown in brackets next to the name ONLY in the owner's work
// order email, so she can pick the right piece without memorizing names.
// Rename freely; never change an `id` (ids live in carts, links and orders).

export const FEATHER_OPTIONS = [
  { id: "none", name: "No feather", price: 0 },
  { id: "natural", name: "Prairie Pheasant", plain: "feather band with feather rosette", price: 5000 },
  { id: "bronze", name: "Midnight Outlaw", plain: "bronze pheasant feather band", price: 5000 },
  { id: "guinea", name: "Dusty Trail", plain: "guinea fowl feather band", price: 5000 },
  { id: "magenta", name: "Pink Outlaw", plain: "magenta mix feather band", price: 5000 },
  { id: "polka", name: "Polka Dot Posse", plain: "black polka dot feather band", price: 5000 },
  { id: "turquoise", name: "Turquoise Queen", plain: "feather band with turquoise concho", price: 5000 },
  { id: "cream", name: "Snow Quail", plain: "cream and white feather band", price: 5000 },
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
  { id: "rhinestone", name: "Rhinestone Sass", plain: "double row crystal band", price: 1500 },
  { id: "turquoise", name: "Turquoise Trail", plain: "turquoise seed bead strands with silver chain", price: 1500 },
  { id: "concho-turquoise", name: "Turquoise Concho", plain: "silver concho chain with turquoise stones", price: 1500 },
  { id: "concho-silver", name: "Silver Sundance", plain: "stamped silver square concho chain", price: 1500 },
  { id: "heishi", name: "Desert Heishi", plain: "earth tone heishi bead strand", price: 1500 },
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

// --- engraving: burned stamps and letters, switched off ----------------------
// Replaces the brand above (which stays off and untouched). A hat carries a
// list of elements, each burned at one position:
//
//   { kind: "stamp", stampId, size, position }
//   { kind: "text",  text, font, size, position }
//
// Several elements at one position sit in a row, in the order they were
// added ("DEB" then a Longhorn on the front). Only types with
// brandingAllowed take it (wool and suede; never straw).
//
// PRICE (Deborah's rule). Every stamp is one brand, every letter or digit is
// one brand, spaces are not. Up to FREE_BRAND_COUNT brands is free; past
// that, one flat ENGRAVING_FEE per hat, however many more fit.
//
// ON. Turning ENGRAVING_ENABLED off again hides the step (except under
// ?preview=engraving) and makes the server refuse any hat that carries it.
export const ENGRAVING_ENABLED = true;
export const FREE_BRAND_COUNT = 4;
export const ENGRAVING_FEE = 1000; // per hat, once, past the free brands
// A safety cap for the server; what really limits a row is its width, which
// only the browser can measure (catalog.js, engravingMeasure.js).
export const MAX_ELEMENTS_PER_POSITION = 12;
export const ENGRAVING_TEXT_MAX_LEN = 12;

// `left` is the WEARER's left: the side the three quarter view shows.
export const ENGRAVING_POSITIONS = [
  { id: "front", name: "Front", code: "f" },
  { id: "left", name: "Left", code: "l" },
];
export const ENGRAVING_SIZES = [
  { id: "small", name: "Small", code: "s" },
  { id: "large", name: "Large", code: "l" },
];
// The fonts only carry A to Z, 0 to 9 and space (lowercase maps to capitals
// inside the font). Files and metrics are in catalog.js.
export const ENGRAVING_FONTS = [
  { id: "original", name: "Original", code: "o" },
  { id: "soft", name: "Soft", code: "s" },
  { id: "copperplate", name: "Copperplate", code: "c" },
  { id: "durango", name: "Durango", code: "d" },
];
// Ids only: names, files and sizes live in engravingStamps.js, which the
// browser loads with the Brand it step (see engravingText.js for the words).
const isStampId = (id) => ENGRAVING_STAMP_IDS.includes(id);

const ENGRAVING_TEXT_RAW = /^[A-Za-z0-9 ]+$/;

/** Engraving text as it is stored: capitals, digits, single spaces, trimmed. */
export function cleanEngravingText(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/ +/g, " ")
    .trim()
    .slice(0, ENGRAVING_TEXT_MAX_LEN)
    .trim();
}

function normalizeEngravingElement(e) {
  if (!e || typeof e !== "object") return null;
  const position = byId(ENGRAVING_POSITIONS, e.position)?.id;
  const size = byId(ENGRAVING_SIZES, e.size)?.id;
  if (!position || !size) return null;
  if (e.kind === "stamp") {
    return isStampId(e.stampId) ? { kind: "stamp", stampId: e.stampId, size, position } : null;
  }
  if (e.kind === "text") {
    const text = typeof e.text === "string" ? cleanEngravingText(e.text) : "";
    const font = byId(ENGRAVING_FONTS, e.font)?.id;
    return text && font ? { kind: "text", text, font, size, position } : null;
  }
  return null;
}

/**
 * The canonical engraving of a hat: known elements only, the front row
 * first and then the left row, each in the order added and capped at
 * MAX_ELEMENTS_PER_POSITION. A type that cannot be branded gets [].
 * Lenient like normalizeConfig; validateConfig is the strict check.
 */
export function normalizeEngraving(raw, type = null) {
  const t = type || findHatType(DEFAULT_HAT_TYPE);
  if (!t.brandingAllowed || !Array.isArray(raw)) return [];
  const all = raw.map(normalizeEngravingElement).filter(Boolean);
  return ENGRAVING_POSITIONS.flatMap((p) => all.filter((e) => e.position === p.id).slice(0, MAX_ELEMENTS_PER_POSITION));
}

/** Brands on a hat: one per stamp, one per letter or digit; spaces are free. */
export function brandCount(engraving) {
  return (Array.isArray(engraving) ? engraving : []).reduce(
    (n, e) => n + (e?.kind === "stamp" ? 1 : e?.kind === "text" ? String(e.text ?? "").replace(/ /g, "").length : 0),
    0
  );
}

/** The engraving charge for one hat: free up to FREE_BRAND_COUNT, then one flat fee. */
export function engravingPrice(engraving) {
  return brandCount(engraving) > FREE_BRAND_COUNT ? ENGRAVING_FEE : 0;
}

// THE ENGRAVING CODE, one string shared by the permalink (?e=) and the
// Stripe metadata (hat_N_engr). The front row, "*", the left row; inside a
// row, elements joined by "_":
//
//   stamp  <size>s.<stampId>          ls.longhorn
//   text   <size>t.<font>.<TEXT>      lt.d.DEB
//
//   "lt.d.DEB_ls.longhorn*ss.horseshoe"
//
// size: s small, l large; font: o original, s soft, c copperplate,
// d durango. Every character here is one URLSearchParams leaves alone, and
// a space in a text travels as "+". The longest possible code (12 of the
// longest stamp id on each side) is under Stripe's 500 characters.
export function encodeEngraving(engraving) {
  const list = Array.isArray(engraving) ? engraving : [];
  const code = (e) => {
    const size = byId(ENGRAVING_SIZES, e.size).code;
    return e.kind === "stamp" ? `${size}s.${e.stampId}` : `${size}t.${byId(ENGRAVING_FONTS, e.font).code}.${e.text}`;
  };
  const row = (pos) => list.filter((e) => e.position === pos).map(code).join("_");
  const out = ENGRAVING_POSITIONS.map((p) => row(p.id)).join("*");
  return out === "*" ? "" : out;
}

/** Read an engraving code back. Unreadable pieces are reported, never guessed. */
export function parseEngraving(code) {
  const engraving = [];
  const problems = [];
  const text = String(code ?? "").trim();
  if (!text) return { engraving, problems };
  const rows = text.split("*");
  if (rows.length > ENGRAVING_POSITIONS.length) problems.push(`Unreadable engraving: ${text}`);
  rows.slice(0, ENGRAVING_POSITIONS.length).forEach((row, i) => {
    const position = ENGRAVING_POSITIONS[i].id;
    for (const token of row ? row.split("_") : []) {
      const m = token.match(/^([sl])([st])\.(.+)$/);
      const size = m && ENGRAVING_SIZES.find((z) => z.code === m[1])?.id;
      let el = null;
      if (m && m[2] === "s") el = normalizeEngravingElement({ kind: "stamp", stampId: m[3], size, position });
      else if (m) {
        const [fontCode, ...rest] = m[3].split(".");
        const font = ENGRAVING_FONTS.find((f) => f.code === fontCode)?.id;
        el = normalizeEngravingElement({ kind: "text", text: rest.join("."), font, size, position });
      }
      if (el) engraving.push(el);
      else problems.push(`Unreadable engraving piece: ${token}`);
    }
  });
  return { engraving, problems };
}

// --- sizes -----------------------------------------------------------------
// Head measured all the way around, just above the eyebrows and ears.
// `us` is the US hat size; suede comes in doubled sizes, which have none.
export const STANDARD_SIZES = [
  { id: "s", name: "S", us: "6 7/8", inches: "21 to 21 7/8 in", cm: "54 to 55 cm" },
  { id: "m", name: "M", us: "7 1/8", inches: "22 to 22 3/4 in", cm: "56 to 57 cm" },
  { id: "l", name: "L", us: "7 3/8", inches: "22 7/8 to 23 1/2 in", cm: "58 to 59 cm" },
  { id: "xl", name: "XL", us: "7 5/8", inches: "23 5/8 to 24 1/4 in", cm: "60 to 61 cm" },
];
export const SUEDE_SIZES = [
  { id: "s-m", name: "S/M", us: null, inches: "21 to 22 3/4 in", cm: "54 to 57 cm" },
  { id: "l-xl", name: "L/XL", us: null, inches: "22 7/8 to 24 1/4 in", cm: "58 to 61 cm" },
];
// Wool's sizes, kept under the old name for the code that predates types.
export const SIZE_OPTIONS = STANDARD_SIZES;

// --- hat types ---------------------------------------------------------------
// The accessory steps, by the same keys catalog.js stacks them under.
export const ACCESSORY_STEPS = ["feather", "cord", "bud", "matches"];

export const DEFAULT_HAT_TYPE = "wool";

// `enabled` is the switch: a disabled type is fully defined but cannot be
// picked in the builder or ordered (validateConfig refuses it). Wool and
// Faux Suede are on sale; straw stays off until the owner puts it on sale. The builder can show
// them under ?preview=types, but only to look at: the server still refuses
// any order for a disabled type.
export const HAT_TYPES = [
  {
    id: "wool",
    name: "Wool",
    label: "Wool Hat",
    basePrice: BASE_PRICE,
    sizes: STANDARD_SIZES,
    colors: WOOL_COLORS,
    brandingAllowed: true,
    accessories: ACCESSORY_STEPS,
    enabled: true,
  },
  {
    id: "suede",
    name: "Faux Suede",
    label: "Faux Suede Hat",
    basePrice: 8000,
    sizes: SUEDE_SIZES,
    colors: SUEDE_COLORS,
    brandingAllowed: true,
    // every wool accessory, drawn from its own suede-* layers (catalog.js)
    accessories: ACCESSORY_STEPS,
    enabled: true,
  },
  {
    id: "straw",
    name: "Straw",
    label: "Straw Hat",
    basePrice: 8000,
    sizes: STANDARD_SIZES,
    colors: STRAW_COLORS,
    brandingAllowed: false,
    accessories: [],
    enabled: false,
  },
];

/** The types a customer can pick right now. */
export const enabledHatTypes = () => HAT_TYPES.filter((t) => t.enabled);

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

export const findHatType = (id) => byId(HAT_TYPES, id);
/** A config's type: missing means wool (carts, links and orders from before types). */
export const hatTypeOf = (c) => findHatType(c?.hatType ?? DEFAULT_HAT_TYPE);
/** A base color within a type (wool when no type is given). */
export const findBase = (id, typeId = DEFAULT_HAT_TYPE) => byId(findHatType(typeId)?.colors || [], id);
export const findFeather = (id) => byId(FEATHER_OPTIONS, id);
export const findCord = (id) => byId(CORD_OPTIONS, id);
export const findBudSize = (id) => byId(BUD_SIZES, id);
export const findMatchesColor = (id) => byId(MATCHES.colors, id);
export const findBrand = (id) => byId(BRAND_OPTIONS, id);
/** A size within a type (wool when no type is given). */
export const findSize = (id, typeId = DEFAULT_HAT_TYPE) => byId(findHatType(typeId)?.sizes || [], id);

/** The color option of a cord (stitching only), or null. */
export const findCordColor = (cordId, colorId) => byId(findCord(cordId)?.colors || [], colorId);
/** The color option of a bud size, or null. */
export const findBudColor = (sizeId, colorId) => byId(findBudSize(sizeId)?.colors || [], colorId);

const orNone = (v) => (v === undefined || v === null || v === "" ? "none" : v);

// The fields of one hat design, exactly as the browser posts them and the
// server reads them. One list, both sides, so they cannot drift apart. Money
// is never among them.
export const CONFIG_FIELDS = [
  "hatType",
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
  "engraving",
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
  // Missing type means wool. An unknown type also lands on wool here, so this
  // never throws; validateConfig is what refuses it before any charge.
  const type = hatTypeOf(c) || findHatType(DEFAULT_HAT_TYPE);
  // A step the type does not take is always "none", whatever was sent.
  const takes = (step) => type.accessories.includes(step);
  const base = findBase(c.baseId, type.id);

  const feather = (takes("feather") && findFeather(orNone(c.featherId))) || findFeather("none");

  const cord = (takes("cord") && findCord(orNone(c.cordId))) || findCord("none");
  const cordColor = cord.colors ? findCordColor(cord.id, c.cordColor)?.id ?? null : null;
  const stitchingNote = cord.id === "stitching" ? sanitizeNote(c.stitchingNote) || null : null;

  const bud = (takes("bud") && findBudSize(orNone(c.budSize))) || findBudSize("none");
  const budColor = bud.id === "none" ? null : findBudColor(bud.id, c.budColor)?.id ?? null;

  const matchesColor = takes("matches") ? findMatchesColor(c.matchesColor)?.id ?? "none" : "none";

  const brand =
    BRANDS_ENABLED && type.brandingAllowed ? findBrand(orNone(c.brandId)) || findBrand("none") : findBrand("none");
  const customText = brand.custom ? sanitizeBrandText(c.customText).trim() || null : null;

  return {
    hatType: type.id,
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
    size: findSize(c.size, type.id)?.id ?? null,
    engraving: normalizeEngraving(c.engraving, type),
  };
}

// --- permalinks -----------------------------------------------------------
// Query keys the builder reads and writes, and the server uses for the
// "See this hat" link in the work order email. A permalink describes ONE
// hat design, never a cart, so quantity is deliberately absent.
export const PARAM_KEYS = {
  hatType: "t", // written only when the type is not wool
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
  engraving: "e", // the engraving code (encodeEngraving), only when there is one
};

// Keys from earlier builders. Links carrying them still open; the builder
// reads what it understands and drops these from the address bar.
export const LEGACY_PARAM_KEYS = ["bd", "charm", "ch", "q", ...(BRANDS_ENABLED ? [] : ["br", "bt"])];

/** Serialize a config into the builder's query string (no leading "?"). */
export function buildPermalinkQuery(config) {
  const c = normalizeConfig(config);
  const q = new URLSearchParams();
  // Wool is the default, so a wool link looks exactly as it did before types.
  if (c.hatType !== DEFAULT_HAT_TYPE) q.set(PARAM_KEYS.hatType, c.hatType);
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
  if (c.engraving.length) q.set(PARAM_KEYS.engraving, encodeEngraving(c.engraving));
  if (c.size) q.set(PARAM_KEYS.size, c.size);
  return q.toString();
}

/**
 * Read a permalink back into a config. Tolerant by design: an old link with
 * a band, a charm or a brand still opens, anything this catalog does not
 * know is simply ignored, and an unknown base falls back to the default.
 * A color that does not belong to its size or cord falls back to that
 * size's or cord's first color, so a hand edited link never shows nothing.
 *
 * No `t` means wool, so every link made before hat types opens unchanged.
 * A type that is unknown or not enabled yet also opens as wool: a link must
 * never put the builder in a state the customer cannot order. The
 * exceptions are the private previews: `previewTypes` (?preview=types) may
 * open a disabled type, and `previewEngraving` (?preview=engraving) reads
 * the engraving while ENGRAVING_ENABLED is off. No `e` means no engraving.
 */
export function parsePermalink(search, defaults = { baseId: "ivory" }, { previewTypes = false, previewEngraving = false } = {}) {
  let q;
  try {
    q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || ""));
  } catch {
    q = new URLSearchParams();
  }
  const get = (k) => q.get(PARAM_KEYS[k]);

  const requested = findHatType(get("hatType"));
  const type = requested && (requested.enabled || previewTypes) ? requested : findHatType(DEFAULT_HAT_TYPE);
  const defaultBase = type.id === DEFAULT_HAT_TYPE ? defaults.baseId : type.colors[0].id;

  const cordId = findCord(get("cord"))?.id ?? "none";
  const cord = findCord(cordId);
  const budSize = findBudSize(get("budSize"))?.id ?? "none";
  const bud = findBudSize(budSize);

  return normalizeConfig({
    hatType: type.id,
    baseId: findBase(get("base"), type.id)?.id ?? defaultBase,
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
    engraving: ENGRAVING_ENABLED || previewEngraving ? parseEngraving(get("engraving")).engraving : [],
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

  // The type first: everything after it is checked against what THAT type
  // offers. A line with no type at all is wool (it predates types).
  const type = hatTypeOf(c);
  if (!type) push("hatType", `Unknown hat type: ${show(c.hatType)}`);
  else if (!type.enabled) push("hatType", `The ${type.label} is not available yet`);
  const typeId = type?.id ?? DEFAULT_HAT_TYPE;

  if (!findBase(c.baseId, typeId))
    push("baseId", type ? `${show(c.baseId)} is not a ${type.label} color` : `Unknown base: ${show(c.baseId)}`);

  // An accessory the type does not take is refused, never quietly dropped:
  // dropping it would charge for a different hat than the one on screen.
  if (type) {
    const sent = { feather: c.featherId, cord: c.cordId, bud: c.budSize, matches: c.matchesColor };
    const field = { feather: "featherId", cord: "cordId", bud: "budSize", matches: "matchesColor" };
    for (const step of ACCESSORY_STEPS)
      if (orNone(sent[step]) !== "none" && !type.accessories.includes(step))
        push(field[step], `A ${type.label} does not take a ${step === "bud" ? "brim bud" : step}`);
  }

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
    else if (brand.id !== "none" && type && !type.brandingAllowed) push("brandId", `A ${type.label} cannot be branded`);
    if (brand?.custom) {
      const text = typeof c.customText === "string" ? c.customText.trim() : "";
      if (!text) push("customText", "Custom text is required for the Your word brand");
      else if (text.length > BRAND_TEXT_MAX_LEN)
        push("customText", `Custom text must be ${BRAND_TEXT_MAX_LEN} characters or fewer`);
      else if (!BRAND_TEXT_ALLOWED.test(text)) push("customText", "Custom text has characters we cannot brand");
    }
  }

  validateEngraving(c.engraving, type, push);

  if (!findSize(c.size, typeId))
    push("size", type ? `${show(c.size)} is not a ${type.label} size` : `Unknown size: ${show(c.size)}`);

  const qty = c.quantity;
  if (!Number.isInteger(qty) || qty < MIN_QUANTITY || qty > MAX_QUANTITY)
    push("quantity", `Quantity must be a whole number between ${MIN_QUANTITY} and ${MAX_QUANTITY}`);

  return { valid: errors.length === 0, errors };
}

/**
 * The engraving, strictly. Missing or empty is fine. Anything else is
 * refused while ENGRAVING_ENABLED is off, whatever the page that sent it
 * (a preview included), and each piece is checked either way so the
 * message says what is wrong. Never trimmed into something chargeable.
 */
function validateEngraving(engraving, type, push) {
  if (engraving == null || (Array.isArray(engraving) && engraving.length === 0)) return;
  if (!Array.isArray(engraving)) {
    push("engraving", "Branding must be a list");
    return;
  }
  if (!ENGRAVING_ENABLED) push("engraving", "Branding is not available yet");
  if (type && !type.brandingAllowed) push("engraving", `A ${type.label} cannot be branded`);
  const max = MAX_ELEMENTS_PER_POSITION * ENGRAVING_POSITIONS.length;
  if (engraving.length > max) {
    push("engraving", `A hat can carry up to ${max} brands`);
    return;
  }
  const perPosition = {};
  engraving.forEach((e, i) => {
    const at = `Brand ${i + 1}`;
    if (!e || typeof e !== "object" || Array.isArray(e)) return push("engraving", `${at} is not readable`);
    if (!byId(ENGRAVING_POSITIONS, e.position)) push("engraving", `${at}: unknown position ${JSON.stringify(e.position ?? null)}`);
    else perPosition[e.position] = (perPosition[e.position] || 0) + 1;
    if (!byId(ENGRAVING_SIZES, e.size)) push("engraving", `${at}: unknown size ${JSON.stringify(e.size ?? null)}`);
    if (e.kind === "stamp") {
      if (!isStampId(e.stampId)) push("engraving", `${at}: unknown stamp ${JSON.stringify(e.stampId ?? null)}`);
    } else if (e.kind === "text") {
      const text = typeof e.text === "string" ? e.text.trim() : "";
      if (!text) push("engraving", `${at}: the text is empty`);
      else if (!ENGRAVING_TEXT_RAW.test(text)) push("engraving", `${at}: the text can only use A to Z, 0 to 9 and spaces`);
      else if (text.length > ENGRAVING_TEXT_MAX_LEN)
        push("engraving", `${at}: the text must be ${ENGRAVING_TEXT_MAX_LEN} characters or fewer`);
      if (!byId(ENGRAVING_FONTS, e.font)) push("engraving", `${at}: unknown font ${JSON.stringify(e.font ?? null)}`);
    } else push("engraving", `${at}: unknown kind ${JSON.stringify(e.kind ?? null)}`);
  });
  for (const p of ENGRAVING_POSITIONS)
    if ((perPosition[p.id] || 0) > MAX_ELEMENTS_PER_POSITION)
      push("engraving", `The ${p.name.toLowerCase()} can carry up to ${MAX_ELEMENTS_PER_POSITION} brands`);
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
 *   step    "base" | "feather" | "cord" | "bud" | "matches" | "brand" |
 *           "engraving"
 *   label   category heading, e.g. "Brim bud"
 *   name    the chosen option's catalog name, e.g. "Full Bloom"
 *   detail  its color's catalog name when it has one, e.g. "Turquoise Sky"
 *   plain   what the piece physically is, for the owner, e.g.
 *           "large brim bud, teal" (null for the base)
 */
export function hatParts(config) {
  const c = normalizeConfig(config);
  const parts = [];
  const type = findHatType(c.hatType);
  const base = findBase(c.baseId, c.hatType);
  // The price is the TYPE's, never the color's: "Wool Hat: Silver Belly".
  if (base) parts.push({ step: "base", label: type.label, name: base.name, detail: null, plain: null, price: type.basePrice });

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
  if (c.engraving.length) {
    // One part for the whole engraving: the price is per hat, not per piece.
    // The emails list the pieces with engravingRows() (engravingText.js).
    const n = brandCount(c.engraving);
    const price = engravingPrice(c.engraving);
    const name = price ? `Unlimited (${n} brands)` : `${n} free brand${n === 1 ? "" : "s"}`;
    parts.push({ step: "engraving", label: "Branding", name, detail: null, plain: null, price });
  }
  return parts;
}

/** "Name, Color" or just "Name". */
const partText = (p) => (p.detail ? `${p.name}, ${p.detail}` : p.name);

/**
 * Short human description of one hat, for cart rows and image alt text:
 * "Silver Belly Wool Hat, Prairie Pheasant, Saddle Stitch in Raspberry Rodeo,
 * Full Bloom in Turquoise Sky, Strike It Up in Red, size M". Catalog names
 * are kept exactly as written, never lowercased.
 */
export function describeConfig(config) {
  const c = normalizeConfig(config);
  const words = hatParts(c).map((p) => {
    if (p.step === "base") return `${p.name} ${p.label}`;
    if (p.step === "matches") return `${p.label} in ${p.name}`;
    if (p.step === "engraving") {
      const n = brandCount(c.engraving);
      return `${n} brand${n === 1 ? "" : "s"}`;
    }
    return p.detail ? `${p.name} in ${p.detail}` : p.name;
  });
  const size = findSize(c.size, c.hatType);
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

    // Free branding is listed on the hat (emails, cart) but never sent to
    // Stripe as a $0 line; past the free brands it is its own line.
    const lineItems = hatParts(config)
      .filter((p) => p.step !== "engraving" || p.price > 0)
      .map((p) => ({
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
