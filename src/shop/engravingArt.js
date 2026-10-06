// ---------------------------------------------------------------------------
// How the burned stamps and letters LOOK and where they sit. What they are
// and what they cost is in pricing.js. All lengths in inches unless noted.
//
// Kept out of catalog.js on purpose: this file (and the stamp list it
// imports) is loaded only when a hat is engraved or the Brand it step is
// opened, so the public builder's main bundle never carries it.
// ---------------------------------------------------------------------------

import { ENGRAVING_STAMPS } from "./engravingStamps.js";

export const ENGRAVING_FONT_FILES = {
  original: { family: "TippinOriginal", url: "/engraving/fonts/TippinOriginal.woff2" },
  soft: { family: "TippinSoft", url: "/engraving/fonts/TippinSoft.woff2" },
  copperplate: { family: "TippinCopperplate", url: "/engraving/fonts/TippinCopperplate.woff2" },
  durango: { family: "TippinDurango", url: "/engraving/fonts/TippinDurango.woff2" },
};

// Height of a capital letter, per size.
export const ENGRAVING_LETTER_HEIGHT = { small: 0.35, large: 0.5 };
// Space between two elements in a row.
export const ENGRAVING_GAP = 0.1;

/** A stamp's box in inches, {w, h}, or null. See engravingStamps.js. */
export const stampInches = (stampId, size) => ENGRAVING_STAMPS.find((s) => s.id === stampId)?.[size] ?? null;
export const findStampArt = (stampId) => ENGRAVING_STAMPS.find((s) => s.id === stampId) || null;
export { ENGRAVING_STAMPS };

// Calibrated with ?preview=engraving&calibrate=1. To tune again, paste the
// JSON from "Copy anchors" over these two.
//
// The widest row each position takes, per hat type.
export const ENGRAVING_MAX_WIDTH = {
  wool: { front: 4, left: 2.5 },
  suede: { front: 4, left: 2.5 },
};

// Where each row sits on the 1600 canvas, per type and position: its center
// (x, y), how many canvas pixels make an inch there, and a rotate (degrees),
// skewX (degrees) and scaleX that bend a flat row onto the curve of the
// crown. `left` is the wearer's left, the side the three quarter view shows.
export const ENGRAVING_ANCHORS = {
  wool: {
    front: { x: 589, y: 674, pxPerInch: 100, rotate: 2.5, skewX: -10.5, scaleX: 0.92 },
    left: { x: 1026, y: 692, pxPerInch: 110, rotate: -21.5, skewX: -11.5, scaleX: 0.55 },
  },
  suede: {
    front: { x: 665, y: 552, pxPerInch: 100, rotate: 0.5, skewX: -5.5, scaleX: 0.89 },
    left: { x: 1078, y: 580, pxPerInch: 109, rotate: -16, skewX: -6, scaleX: 0.49 },
  },
};

// The burn: very dark brown, multiplied into the felt, slightly soft, not
// fully opaque, so it reads as burned rather than printed. On dark bases it
// is subtle, as a real burn is.
export const ENGRAVING_STYLE = { color: "#3A2414", blurPx: 0.6, opacity: 0.85, blend: "multiply" };
