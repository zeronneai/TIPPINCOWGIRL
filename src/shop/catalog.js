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
// Every layer is a 1600x1600 transparent PNG drawn on the same canvas, so
// they stack at the same position with no per layer offsets or scaling.
// The contact shadows are baked into each PNG as translucent black.
//
// STACKING CONTRACT (do not reorder):
//
//   base     z=10  normal   Cloudinary
//   brand    z=15  multiply Cloudinary   OFF (BRANDS_ENABLED), burned into
//                                        the felt, so under everything else
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

// Base artwork exists for WOOL only. Suede and straw are defined in
// pricing.js but disabled until their images exist; baseArtFor() returns
// null for them so a suede "black" can never be drawn with the wool felt.
export const BASES = withArt(BASE_OPTIONS, {
  ivory: "v1789658517/base-ivory_bcsh3a.png",
  black: "v1789658517/base-black_rfptm8.png",
  chocolate: "v1789658517/base-chocolate_osknft.png",
  pink: "v1789658517/base-pink_jqkfio.png",
  wine: "v1789658517/base-wine_zssnd7.png",
  turquoise: "v1789658518/base-turquoise_x0zmnn.png",
});

/** The Cloudinary base layer for a config, or null when its type has no art yet. */
export const baseArtFor = (config) =>
  (config?.hatType ?? DEFAULT_HAT_TYPE) === DEFAULT_HAT_TYPE ? findIn(BASES, config?.baseId) : null;

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
  const add = (step, key) => out.push({ step, key, z: Z_INDEX[step], blend: BLEND[step] });
  if (c.featherId !== "none") add("feather", `feather-${c.featherId}`);
  if (c.cordId === "stitching" && c.cordColor) add("cord", `cord-stitching-${c.cordColor}`);
  else if (c.cordId !== "none" && c.cordId !== "stitching") add("cord", `cord-${c.cordId}`);
  if (c.budSize !== "none" && c.budColor) add("bud", `bud-${c.budSize}-${c.budColor}`);
  if (c.matchesColor !== "none") add("matches", `matches-${c.matchesColor}`);
  return out;
}

/** The file stem that draws one option on its own, for its thumbnail. */
export const thumbKey = {
  feather: (id) => `feather-${id}`,
  cord: (id, color) => (id === "stitching" ? `cord-stitching-${color}` : `cord-${id}`),
  bud: (size, color) => `bud-${size}-${color}`,
  matches: (color) => `matches-${color}`,
};

// Where the accessory layers live on Cloudinary, for the order emails. The
// emails flatten the hat with Cloudinary overlays, so a layer that is not
// on Cloudinary cannot be drawn there.
//
// TODO(email-image): EMPTY until the 27 PNGs in src/shop/layers/ are
// uploaded to Cloudinary. Fill it as { "feather-natural": "<public id>", ... }.
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
