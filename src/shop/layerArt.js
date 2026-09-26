// ---------------------------------------------------------------------------
// URLs for the accessory artwork in src/shop/layers/. BROWSER ONLY.
//
// import.meta.glob is a Vite feature: at build time it becomes a table of
// hashed asset URLs, and each PNG is only downloaded when something asks for
// it. It does not exist in a Vercel function, which is why this lives apart
// from catalog.js (the order emails import catalog.js on the server).
// ---------------------------------------------------------------------------

const LAYERS = import.meta.glob("./layers/*.png", { eager: true, query: "?url", import: "default" });
const THUMBS = import.meta.glob("./layers/thumbs/*.jpg", { eager: true, query: "?url", import: "default" });

/** Full size 1600px layer for a file stem, e.g. "feather-natural". */
export const layerUrl = (key) => LAYERS[`./layers/${key}.png`] || null;

/** 400px thumbnail for a file stem. */
export const thumbUrl = (key) => THUMBS[`./layers/thumbs/${key}.jpg`] || null;

// Start downloading a layer before it is picked (hover, touch, focus), so
// the swap on the stage is instant. The browser cache does the rest.
const warmed = new Set();
export function preloadLayer(key) {
  const url = layerUrl(key);
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}
