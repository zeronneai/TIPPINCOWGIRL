// ---------------------------------------------------------------------------
// Shop catalog: the PRESENTATION layer of the hat builder.
//
// Ids, human labels and every price live in pricing.js (a pure module the
// server can import too). This file attaches the artwork to them: one layer
// image per option, plus the stacking contract below. Never redeclare a
// price here.
//
// Layers are real product PNGs on Cloudinary: 1600x1600, transparent, all
// aligned to the same canvas. They stack at the same position with no
// per-layer offsets or scaling. Stacking contract (do not change):
//
//   base   z=10   blend normal
//   brand  z=20   blend multiply   (the burn goes UNDER the band, like the
//   band   z=30   blend normal      real hat: felt is branded first)
//
// The brand MUST stay multiply: in normal blend it reads as a light sticker
// on dark felts, which is physically impossible for a burn; multiply darkens
// the felt like a real scorch and works across all 6 colors.
// ---------------------------------------------------------------------------

import {
  BAND_OPTIONS,
  BASE_OPTIONS,
  BRAND_OPTIONS,
  BRAND_TEXT_MAX_LEN,
  SIZE_OPTIONS,
} from "./pricing.js";

export const CANVAS = { w: 1600, h: 1600 };

// Stacking order + blend per category on the stage (see contract above).
export const Z_INDEX = { base: 10, brand: 20, band: 30 };
export const BLEND = { base: "normal", brand: "multiply", band: "normal" };

const CLD = "https://res.cloudinary.com/dsprn0ew4/image/upload";
const layer = (file) => `${CLD}/f_auto,q_auto,w_1600/${file}`;

// Attach artwork to the priced options, matched by id. Prices and labels
// come straight from pricing.js; this only adds layerImg.
const withArt = (options, art) =>
  options.map((o) => ({ ...o, layerImg: art[o.id] ? layer(art[o.id]) : null }));

export const BASES = withArt(BASE_OPTIONS, {
  ivory: "v1789658517/base-ivory_bcsh3a.png",
  black: "v1789658517/base-black_rfptm8.png",
  chocolate: "v1789658517/base-chocolate_osknft.png",
  pink: "v1789658517/base-pink_jqkfio.png",
  wine: "v1789658517/base-wine_zssnd7.png",
  turquoise: "v1789658518/base-turquoise_x0zmnn.png",
});

export const BANDS = withArt(BAND_OPTIONS, {
  "lace-pearls": "v1789658518/band-lace-pearls_ngwbo7.png",
  ribbons: "v1789658519/band-ribbons_abqrdi.png",
  leather: "v1789658518/band-leather_ts7jie.png",
  feathers: "v1789658518/band-feathers_tkxmk9.png",
  turquoise: "v1789658518/band-turquoise_neaits.png",
});

// Fire-branded marks on the crown. The `custom` option (flagged in
// pricing.js) has no layer image on purpose: its text is drawn in the
// browser at the same spot and blend as the branded marks (see BRAND_TEXT).
//
// TODO(product): on base-black and base-wine the burn reads very subtle.
// That is faithful to a real brown scorch on dark felt, but it may confuse
// buyers. Pending confirmation from the owner on whether she brands dark
// hats at all; if not, disable the brand step for those two bases.
export const BRANDS = withArt(BRAND_OPTIONS, {
  star: "v1789658518/brand-star_kr0hkr.png",
  longhorn: "v1789658518/brand-longhorn_vuz5du.png",
  cactus: "v1789658516/brand-cactus_j5grph.png",
  heart: "v1789658517/brand-heart_ya1it4.png",
});

// Placement of the browser-drawn custom text, in canvas (1600) coordinates.
// Calibrated against the brand-text-sample reference render; tweak here, not
// in the component. maxWidth caps the run so 6 characters still sit on the
// crown; rotate/skew follow the crown's curve.
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

export const SIZE_GUIDE = {
  title: "Find your size",
  howTo: [
    "Take a soft measuring tape (or a piece of string you can measure after).",
    "Wrap it around your head just above your eyebrows and ears, where a hat naturally sits.",
    "Keep it snug but comfortable, not tight. Note the number in centimeters.",
    "Between two sizes? Go with the larger one. Felt settles in as you wear it.",
  ],
  rows: [
    { size: "S", cm: "54 to 55 cm", inches: "21.3 to 21.7 in" },
    { size: "M", cm: "56 to 57 cm", inches: "22.0 to 22.4 in" },
    { size: "L", cm: "58 to 59 cm", inches: "22.8 to 23.2 in" },
    { size: "XL", cm: "60 to 61 cm", inches: "23.6 to 24.0 in" },
  ],
};

export const CATEGORIES = [
  { key: "base", label: "Base", options: BASES, required: true },
  { key: "band", label: "Band", options: BANDS },
  { key: "brand", label: "Brand", options: BRANDS },
];

export const findIn = (options, id) => options.find((o) => o.id === id) || null;
