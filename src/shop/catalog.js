// ---------------------------------------------------------------------------
// Shop catalog: the PRESENTATION layer of the hat builder.
//
// Ids, human labels and every price live in pricing.js (a pure module the
// server can import too). This file says how each option LOOKS: which layer
// file draws it and where it sits in the stack. Never redeclare a price here.
//
// SERVER SAFE. The order emails import this file inside a Vercel function,
// so it may only hold plain data: no import.meta.glob, no asset imports.
// The accessory PNGs live in src/shop/layers/ and are turned into URLs by
// layerArt.js, which only the browser loads.
//
// A layer's file is named after its option id (feather-cream.png for the
// feather `cream`, cord-concho-silver.png for the cord `concho-silver`), with
// its thumbnail under the same name in layers/thumbs/, so adding an
// accessory is its entry in pricing.js plus those two files; nothing here
// lists them one by one (see accessoryLayers and layerKeys below).
//
// Each hat type draws the same pieces on its own crown, so a type can have
// its own set of files: the same names with the type's prefix from
// LAYER_PREFIX (suede-feather-cream.png). Same id, price and z-index; only
// the picture differs.
//
// Every layer is a 1600x1600 transparent PNG drawn on the same canvas, so
// they stack at the same position with no per layer offsets or scaling.
// The contact shadows are baked into each PNG as translucent black.
//
// STACKING CONTRACT (do not reorder):
//
//   base     z=10  normal   Cloudinary
//   brand    z=15  multiply Cloudinary   OFF (BRANDS_ENABLED), burned into
//                                        the felt, so under everything else
//   engrave  z=15  multiply drawn in the browser (EngravingLayer.jsx) from
//                           public/engraving/: the same burned slot the old
//                           brand used, which it replaces. Its look and
//                           anchors are in engravingArt.js, loaded on demand
//   feather  z=20  normal   layers/feather-*.png
//   cord     z=30  normal   layers/cord-*.png     OVER the feather, on purpose
//   bud      z=40  normal   layers/bud-{small|large}-*.png
//   matches  z=50  normal   layers/matches-*.png
// ---------------------------------------------------------------------------

import {
  BASE_OPTIONS,
  BRANDS_ENABLED,
  BRAND_OPTIONS,
  BRAND_TEXT_MAX_LEN,
  DEFAULT_HAT_TYPE,
  SIZE_OPTIONS,
  STRAW_COLORS,
  SUEDE_COLORS,
  findHatType,
  normalizeConfig,
} from "./pricing.js";

export const CANVAS = { w: 1600, h: 1600 };

export const Z_INDEX = { base: 10, brand: 15, feather: 20, cord: 30, bud: 40, matches: 50 };
export const BLEND = { base: "normal", brand: "multiply", feather: "normal", cord: "normal", bud: "normal", matches: "normal" };

export const CLOUDINARY_CLOUD = "dsprn0ew4";
const CLD = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload`;
const layer = (file) => `${CLD}/f_auto,q_auto,w_1600/${file}`;

// The Cloudinary public id of a stored file: the version prefix and the
// extension are addressing, not identity, and an overlay reference wants
// neither. "v1789658517/base-ivory_bcsh3a.png" becomes "base-ivory_bcsh3a".
export const publicIdOf = (file) =>
  String(file || "")
    .replace(/^v\d+\//, "")
    .replace(/\.[a-z0-9]+$/i, "");

// Attach Cloudinary artwork to priced options, matched by id.
// `layerImg` is the plain delivery URL the builder stacks with CSS;
// `layerFile` and `publicId` let the server flatten the same layers into one
// image for the order emails.
const withArt = (options, art) =>
  options.map((o) => ({
    ...o,
    layerImg: art[o.id] ? layer(art[o.id]) : null,
    layerFile: art[o.id] || null,
    publicId: art[o.id] ? publicIdOf(art[o.id]) : null,
  }));

// One art map per hat type, because color ids repeat across types: a suede
// "black" is its own file and must never be drawn with the wool felt.
// Every base is a 1600x1600 transparent PNG centered on the same canvas.
export const BASES = withArt(BASE_OPTIONS, {
  ivory: "v1789658517/base-ivory_bcsh3a.png",
  white: "v1791321777/base-white_kgytui.png",
  sand: "v1791321777/base-sand_cfjvob.png",
  chocolate: "v1789658517/base-chocolate_osknft.png",
  black: "v1789658517/base-black_rfptm8.png",
  navy: "v1791321777/base-navy_jnbmth.png",
  "baby-blue": "v1791321778/base-baby-blue_jxadxz.png",
  turquoise: "v1789658518/base-turquoise_x0zmnn.png",
  pink: "v1789658517/base-pink_jqkfio.png",
  "cotton-candy-pink": "v1791321777/base-cotton-candy-pink_weeofk.png",
  red: "v1791321777/base-red_huaglj.png",
  wine: "v1789658517/base-wine_zssnd7.png",
});

export const SUEDE_BASES = withArt(SUEDE_COLORS, {
  cream: "v1791319050/base-suede-cream_mymyyv.png",
  black: "v1791319051/base-suede-black_lrtlj0.png",
  brown: "v1791319051/base-suede-brown_bpdmr2.png",
  camel: "v1791319051/base-suede-camel_q3dftk.png",
  tobacco: "v1791319050/base-suede-tobacco_tx7v8o.png",
  burgundy: "v1791319051/base-suede-burgundy_fwpzrj.png",
  navy: "v1791319050/base-suede-navy_inyjzi.png",
  olive: "v1791319050/base-suede-olive_jjfona.png",
  gray: "v1791319050/base-suede-gray_vgc9ho.png",
});

export const STRAW_BASES = withArt(STRAW_COLORS, {
  cream: "v1791319051/base-straw-cream_dgvh8l.png",
  black: "v1791319050/base-straw-black_mqmfpv.png",
});

const BASES_BY_TYPE = { wool: BASES, suede: SUEDE_BASES, straw: STRAW_BASES };

/** Every base of a hat type, with its art. */
export const basesFor = (typeId = DEFAULT_HAT_TYPE) => BASES_BY_TYPE[typeId] || [];

/** The Cloudinary base layer for a config, or null when there is none. */
export const baseArtFor = (config) => findIn(basesFor(config?.hatType ?? DEFAULT_HAT_TYPE), config?.baseId);

// ---- accessories -----------------------------------------------------------
/**
 * The accessory layers a config needs, bottom to top, as file stems in
 * src/shop/layers/ ("cord-stitching-raspberry" for
 * layers/cord-stitching-raspberry.png and thumbs/cord-stitching-raspberry.jpg).
 * Pure strings, so the server can reason about them too.
 *
 * @returns Array<{step, key, z, blend}>
 */
export function accessoryLayers(config) {
  const c = normalizeConfig(config);
  const out = [];
  const prefix = LAYER_PREFIX[c.hatType] ?? "";
  const add = (step, key) => out.push({ step, key: `${prefix}${key}`, z: Z_INDEX[step], blend: BLEND[step] });
  if (c.featherId !== "none") add("feather", `feather-${c.featherId}`);
  if (c.cordId === "stitching" && c.cordColor) add("cord", `cord-stitching-${c.cordColor}`);
  else if (c.cordId !== "none" && c.cordId !== "stitching") add("cord", `cord-${c.cordId}`);
  if (c.budSize !== "none" && c.budColor) add("bud", `bud-${c.budSize}-${c.budColor}`);
  if (c.matchesColor !== "none") add("matches", `matches-${c.matchesColor}`);
  return out;
}

// The file prefix of each hat type's accessory layers. Wool has none (its
// files predate types); a type missing here would draw the wool files.
export const LAYER_PREFIX = { wool: "", suede: "suede-" };

/** The file stem that draws one option on its own, for its thumbnail (wool). */
export const thumbKey = {
  feather: (id) => `feather-${id}`,
  cord: (id, color) => (id === "stitching" ? `cord-stitching-${color}` : `cord-${id}`),
  bud: (size, color) => `bud-${size}-${color}`,
  matches: (color) => `matches-${color}`,
};

/** thumbKey for a hat type: the same stems with that type's prefix. */
export const layerKeys = (typeId = DEFAULT_HAT_TYPE) => {
  const prefix = LAYER_PREFIX[typeId] ?? "";
  return Object.fromEntries(Object.entries(thumbKey).map(([step, f]) => [step, (...a) => `${prefix}${f(...a)}`]));
};

// Where the accessory layers live on Cloudinary, for the order emails. The
// emails flatten the hat with Cloudinary overlays, so a layer that is not
// on Cloudinary cannot be drawn there.
//
// TODO(email-image): EMPTY until the PNGs in src/shop/layers/ (wool and
// suede-*) are uploaded to Cloudinary. Fill it by layer key, prefix
// included: { "feather-natural": "<public id>", "suede-feather-natural": ... }.
// Until every layer a hat uses is listed, the emails show no picture for that
// hat rather than a picture missing pieces, which would not match what the
// customer ordered. Base only hats still get their picture.
export const ACCESSORY_PUBLIC_IDS = {};

// ---- the burned brand (off) -------------------------------------------------
// Kept intact for when BRANDS_ENABLED returns. The `custom` option has no
// layer image on purpose: its word is drawn in the browser (BRAND_TEXT).
// TODO(product): on base-black and base-wine the burn reads very subtle;
// confirm with the owner whether she brands dark hats before re-enabling.
export const BRANDS = withArt(BRAND_OPTIONS, {
  star: "v1789658518/brand-star_kr0hkr.png",
  longhorn: "v1789658518/brand-longhorn_vuz5du.png",
  cactus: "v1789658516/brand-cactus_j5grph.png",
  heart: "v1789658517/brand-heart_ya1it4.png",
});
export { BRANDS_ENABLED };

// Placement of the browser drawn custom word, in canvas (1600) coordinates.
export const BRAND_TEXT = {
  maxLen: BRAND_TEXT_MAX_LEN,
  cx: 800,
  cy: 745,
  rotate: -5,
  skewX: -4,
  fontSize: 150,
  maxWidth: 430,
  color: "#4a2a12", // dark burn
  haloColor: "#8a5a30", // lighter scorch halo, blurred
};

export const SIZES = SIZE_OPTIONS;

// The size guide, one table per hat type, built from the sizes in pricing.js
// so the guide and the size buttons can never disagree.
export const SIZE_GUIDE = {
  title: "Find your size",
  howTo: [
    "Take a soft measuring tape (or a piece of string you can measure after).",
    "Wrap it around your head just above your eyebrows and ears, where a hat naturally sits.",
    "Keep it snug but comfortable, not tight. Note the number in inches or centimeters.",
    "Between two sizes? Go with the larger one. Felt settles in as you wear it.",
  ],
};

// A measurement must never wrap in the middle: "21 7/8 in" split over two
// lines reads as "21" and "7/8", which is a different size. Join a number to
// its fraction and to its unit with non breaking spaces.
const keepTogether = (text) =>
  text == null ? text : String(text).replace(/(\d) (\d+\/\d+)/g, "$1\u00a0$2").replace(/ (in|cm)$/, "\u00a0$1");

/** Rows for a type's size table: size, US size (or null), head in inches and cm. */
export const sizeGuideRows = (typeId = DEFAULT_HAT_TYPE) =>
  (findHatType(typeId)?.sizes || []).map((s) => ({
    id: s.id,
    size: s.name,
    us: keepTogether(s.us),
    inches: keepTogether(s.inches),
    cm: keepTogether(s.cm),
  }));

export const findIn = (options, id) => options.find((o) => o.id === id) || null;
