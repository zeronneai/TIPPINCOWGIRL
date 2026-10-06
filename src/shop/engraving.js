// ---------------------------------------------------------------------------
// Engraving in the browser: the fonts, the stamp shapes, and how wide a row
// is. BROWSER ONLY (FontFace, canvas, fetch, DOMParser); the server never
// measures, it only caps the count and the text length (pricing.js).
//
// Nothing loads until something asks for it, so the public site, which never
// shows an engraving, never fetches a font or a stamp.
//
// Text width is measured on a canvas with the real font, then scaled so a
// capital letter is exactly the size's letter height (engravingArt.js). Stamps
// are measured from the generated stamp list, no fetch needed.
// ---------------------------------------------------------------------------

import { useEffect, useSyncExternalStore } from "react";
import { ENGRAVING_FONT_FILES, ENGRAVING_GAP, ENGRAVING_LETTER_HEIGHT, ENGRAVING_MAX_WIDTH, findStampArt, stampInches } from "./engravingArt.js";

// ---- a tiny store: anything that loads bumps the version --------------------
let version = 0;
const listeners = new Set();
const bump = () => {
  version += 1;
  listeners.forEach((f) => f());
};
const subscribe = (f) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

// ---- fonts ------------------------------------------------------------------
const fonts = {}; // id -> "loading" | "failed" | { capRatio }
let ctx = null;
const canvas = () => (ctx ||= document.createElement("canvas").getContext("2d"));

/** Start loading an engraving font (once). */
export function loadEngravingFont(id) {
  const file = ENGRAVING_FONT_FILES[id];
  if (!file || fonts[id] || typeof FontFace === "undefined") return;
  fonts[id] = "loading";
  new FontFace(file.family, `url(${file.url}) format("woff2")`)
    .load()
    .then((face) => {
      document.fonts.add(face);
      // capital height as a share of the font size, from the real glyph
      const c = canvas();
      c.font = `100px "${file.family}"`;
      const cap = c.measureText("H").actualBoundingBoxAscent;
      fonts[id] = { capRatio: cap > 0 ? cap / 100 : 0.7 };
      bump();
    })
    .catch(() => {
      fonts[id] = "failed";
      bump();
    });
}
export const loadAllEngravingFonts = () => Object.keys(ENGRAVING_FONT_FILES).forEach(loadEngravingFont);
export const fontReady = (id) => typeof fonts[id] === "object";

/**
 * A text's drawn size in inches at its letter height: {w, h, fontSize},
 * fontSize being the CSS font size (in inches) that makes a capital `h`
 * tall. Null until its font has loaded.
 */
export function textInches(text, fontId, size) {
  const f = fonts[fontId];
  const h = ENGRAVING_LETTER_HEIGHT[size];
  if (typeof f !== "object" || !h) return null;
  const c = canvas();
  c.font = `100px "${ENGRAVING_FONT_FILES[fontId].family}"`;
  const em = c.measureText(text).width / 100;
  const fontSize = h / f.capRatio;
  return { w: em * fontSize, h, fontSize };
}

// ---- stamps -----------------------------------------------------------------
const stamps = {}; // id -> "loading" | "failed" | { vb: [x, y, w, h], paths: [{ d, fillRule }] }

/** Start fetching a stamp's SVG (once) and keep its path for drawing in a color. */
export function loadStamp(id) {
  const art = findStampArt(id);
  if (!art || stamps[id]) return;
  stamps[id] = "loading";
  fetch(art.file)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((text) => {
      const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
      const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
      const paths = [...svg.querySelectorAll("path")].map((p) => ({ d: p.getAttribute("d"), fillRule: p.getAttribute("fill-rule") || "nonzero" }));
      stamps[id] = vb.length === 4 && paths.length ? { vb, paths } : "failed";
      bump();
    })
    .catch(() => {
      stamps[id] = "failed";
      bump();
    });
}
export const stampShape = (id) => (typeof stamps[id] === "object" ? stamps[id] : null);

// ---- rows ---------------------------------------------------------------------
/** One element's drawn size in inches, or null while its font is loading. */
export function elementInches(e) {
  if (e.kind === "stamp") return stampInches(e.stampId, e.size);
  return textInches(e.text, e.font, e.size);
}

/** A row's width in inches: its elements plus ENGRAVING_GAP between them. Null if one is not measurable yet. */
export function rowInches(elements) {
  let w = 0;
  for (const e of elements) {
    const s = elementInches(e);
    if (!s) return null;
    w += s.w;
  }
  return w + ENGRAVING_GAP * Math.max(0, elements.length - 1);
}

/**
 * Whether `element` fits at the end of its position's row on this hat.
 * Null while a font it needs is still loading (the builder waits).
 */
export function fitsRow(engraving, element, typeId, maxWidths = ENGRAVING_MAX_WIDTH) {
  const row = [...engraving.filter((e) => e.position === element.position), element];
  const w = rowInches(row);
  if (w == null) return null;
  const max = maxWidths[typeId]?.[element.position];
  return max != null && w <= max + 1e-9;
}

/** Load whatever an engraving needs and re-render when it arrives. */
export function useEngravingAssets(engraving) {
  const list = Array.isArray(engraving) ? engraving : [];
  const key = list.map((e) => (e.kind === "stamp" ? `s:${e.stampId}` : `f:${e.font}`)).join(",");
  useEffect(() => {
    for (const e of list) {
      if (e.kind === "stamp") loadStamp(e.stampId);
      else loadEngravingFont(e.font);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/** Re-render when any font or stamp arrives. */
export const useEngravingVersion = () => useSyncExternalStore(subscribe, () => version, () => 0);
