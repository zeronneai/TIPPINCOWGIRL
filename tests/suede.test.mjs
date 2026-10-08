// Faux Suede on sale: every wool accessory, drawn from its own suede-*
// layers, at $80 plus the pieces. Straw (on sale too) is in straw.test.mjs.
//
//   npm test
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { ACCESSORY_PUBLIC_IDS, LAYER_PREFIX, accessoryLayers, layerKeys, thumbKey } from "../src/shop/catalog.js";
import { encodeOrderMetadata, parseCartFromMetadata } from "../src/shop/orderMetadata.js";
import { buildHatImageUrl, hatRows } from "../src/shop/orderEmail.js";

const SUEDE = { hatType: "suede", baseId: "camel", size: "s-m", quantity: 1 };
const suede = (line) => ({ ...SUEDE, ...line });
const order = (...lines) => P.buildOrder(lines);
const layer = (stem) => new URL(`../src/shop/layers/${stem}.png`, import.meta.url);
const thumb = (stem) => new URL(`../src/shop/layers/thumbs/${stem}.jpg`, import.meta.url);

// every accessory option as a config patch, with its price and its wool stem
const EVERY_PIECE = [
  ...P.FEATHER_OPTIONS.filter((o) => o.id !== "none").map((o) => [{ featherId: o.id }, o.price, thumbKey.feather(o.id)]),
  ...P.CORD_OPTIONS.filter((o) => o.id !== "none").flatMap((o) =>
    o.colors ? o.colors.map((c) => [{ cordId: o.id, cordColor: c.id }, o.price, thumbKey.cord(o.id, c.id)]) : [[{ cordId: o.id }, o.price, thumbKey.cord(o.id)]]
  ),
  ...P.BUD_SIZES.filter((b) => b.id !== "none").flatMap((b) => b.colors.map((c) => [{ budSize: b.id, budColor: c.id }, b.price, thumbKey.bud(b.id, c.id)])),
  ...P.MATCHES.colors.map((c) => [{ matchesColor: c.id }, P.MATCHES.price, thumbKey.matches(c.id)]),
];

test("Faux Suede is on sale: $80, S/M and L/XL, its 9 colors, every accessory, branding", () => {
  const t = P.findHatType("suede");
  assert.deepEqual([t.enabled, t.basePrice, t.label], [true, 8000, "Faux Suede Hat"]);
  assert.deepEqual(t.sizes.map((s) => s.name), ["S/M", "L/XL"]);
  assert.equal(t.colors.length, 9);
  assert.deepEqual(t.accessories, P.findHatType("wool").accessories);
  assert.equal(t.brandingAllowed, true);
  assert.ok(P.enabledHatTypes().some((x) => x.id === "suede"));
});

test("suede takes every accessory and color, at $80 plus the piece", () => {
  assert.equal(EVERY_PIECE.length, 31);
  for (const [patch, price] of EVERY_PIECE) {
    assert.deepEqual(P.validateConfig(suede(patch)).errors, [], JSON.stringify(patch));
    assert.equal(order(suede(patch)).subtotal, 8000 + price, JSON.stringify(patch));
  }
});

test("one of each category on suede", () => {
  const hat = suede({ featherId: "natural", cordId: "stitching", cordColor: "rust", budSize: "large", budColor: "red", matchesColor: "turquoise" });
  assert.deepEqual(P.validateConfig(hat).errors, []);
  const o = order(hat);
  assert.equal(o.subtotal, 8000 + 5000 + 1000 + 3500 + 500);
  assert.deepEqual(o.items.map((i) => [i.label, i.unitPrice]), [
    ["Faux Suede Hat: Camel", 8000],
    ["Feather: Prairie Pheasant", 5000],
    ["Cord: Saddle Stitch, Desert Rust", 1000],
    ["Brim bud: Full Bloom, Scarlet Rodeo", 3500],
    ["Strike It Up: Turquoise", 500],
  ]);
  assert.equal(o.shipping, 1200, "shipping unchanged");
});

test("suede draws its own suede-* layers: same pieces, same z-index", () => {
  const hat = suede({ featherId: "cream", cordId: "stitching", cordColor: "sage", budSize: "small", budColor: "orange", matchesColor: "pink" });
  const wool = { ...hat, hatType: "wool", baseId: "ivory", size: "m" };
  const s = accessoryLayers(hat);
  const w = accessoryLayers(wool);
  assert.deepEqual(s.map((l) => l.key), ["suede-feather-cream", "suede-cord-stitching-sage", "suede-bud-small-orange", "suede-matches-pink"]);
  assert.deepEqual(w.map((l) => l.key), ["feather-cream", "cord-stitching-sage", "bud-small-orange", "matches-pink"], "wool unchanged");
  assert.deepEqual(s.map((l) => [l.step, l.z, l.blend]), w.map((l) => [l.step, l.z, l.blend]));
  assert.equal(layerKeys("suede").cord("stitching", "rust"), "suede-cord-stitching-rust");
  assert.equal(layerKeys("wool").matches("turquoise"), "matches-turquoise");
  assert.deepEqual(LAYER_PREFIX, { wool: "", suede: "suede-", straw: "straw-" });
});

test("every suede layer and thumbnail is on disk, named after the wool id", () => {
  for (const [, , stem] of EVERY_PIECE) {
    assert.ok(existsSync(layer(`suede-${stem}`)), `layers/suede-${stem}.png`);
    assert.ok(existsSync(thumb(`suede-${stem}`)), `layers/thumbs/suede-${stem}.jpg`);
  }
  // the matches file came in as "teal"; the id is "turquoise"
  assert.ok(!existsSync(layer("suede-matches-teal")) && !existsSync(thumb("suede-matches-teal")));
});

test("switching type keeps the accessories (same ids); straw drops only the matches", () => {
  const wool = { hatType: "wool", baseId: "black", featherId: "polka", cordId: "stitching", cordColor: "teal", budSize: "small", budColor: "yellow", matchesColor: "red", size: "m" };
  const asSuede = P.normalizeConfig({ ...wool, hatType: "suede" });
  for (const k of ["featherId", "cordId", "cordColor", "budSize", "budColor", "matchesColor"]) assert.equal(asSuede[k], wool[k], k);
  assert.equal(asSuede.baseId, "black", "black is a suede color too");
  assert.equal(asSuede.size, null, "M is not a suede size: she picks S/M or L/XL");
  const back = P.normalizeConfig({ ...asSuede, hatType: "wool" });
  assert.equal(back.featherId, "polka");
  const straw = P.normalizeConfig({ ...wool, hatType: "straw" });
  assert.deepEqual([straw.featherId, straw.cordId, straw.cordColor, straw.budSize, straw.matchesColor], ["polka", "stitching", "teal", "small", "none"]);
});

test("a suede permalink with accessories round trips", () => {
  const q = "t=suede&b=camel&f=natural&c=stitching&cc=sage&bs=large&bc=red&m=turquoise&sz=s-m";
  const c = P.parsePermalink(q);
  assert.deepEqual(
    [c.hatType, c.baseId, c.featherId, c.cordId, c.cordColor, c.budSize, c.budColor, c.matchesColor, c.size],
    ["suede", "camel", "natural", "stitching", "sage", "large", "red", "turquoise", "s-m"]
  );
  assert.equal(P.buildPermalinkQuery(c), q);
  // old wool links are untouched
  assert.equal(P.parsePermalink("b=wine&f=natural&c=rhinestone&sz=l").hatType, "wool");
  assert.equal(P.buildPermalinkQuery(P.parsePermalink("b=wine&f=natural&c=rhinestone&sz=l")), "b=wine&f=natural&c=rhinestone&sz=l");
});


test("the order: metadata, work order rows and the hat picture use suede", () => {
  const hat = suede({ featherId: "cream", cordId: "heishi", size: "l-xl" });
  const md = encodeOrderMetadata(order(hat));
  assert.equal(md.hat_1, "v3|suede|camel|cream|heishi||none||none|none||L-XL|1");
  const back = parseCartFromMetadata(md);
  assert.deepEqual(back.problems, []);
  const rows = Object.fromEntries(hatRows(back.cart[0]));
  assert.deepEqual([rows.Hat, rows.Color, rows.Size, rows.Feather, rows.Cord], [
    "Faux Suede Hat",
    "Camel",
    "L/XL (22 7/8 to 24 1/4 in)",
    "Snow Quail (cream and white feather band)",
    "Desert Heishi (earth tone heishi bead strand)",
  ]);

  // the picture: the suede base, then the suede-* layers once they are on Cloudinary
  assert.equal(
    buildHatImageUrl(suede({})),
    "https://res.cloudinary.com/dsprn0ew4/image/upload/w_240,c_fit,f_auto,q_auto/v1791319051/base-suede-camel_q3dftk.png"
  );
  assert.equal(buildHatImageUrl(hat), null, "no picture until its layers are uploaded, never a wrong one");
  ACCESSORY_PUBLIC_IDS["suede-feather-cream"] = "acc/suede-feather-cream";
  ACCESSORY_PUBLIC_IDS["suede-cord-heishi"] = "acc/suede-cord-heishi";
  ACCESSORY_PUBLIC_IDS["feather-cream"] = "acc/feather-cream";
  try {
    const url = buildHatImageUrl(hat);
    assert.ok(url.includes("l_acc:suede-feather-cream/fl_layer_apply/l_acc:suede-cord-heishi/fl_layer_apply"), url);
    assert.ok(!url.includes("l_acc:feather-cream/"), "never the wool feather on a suede hat");
  } finally {
    for (const k of ["suede-feather-cream", "suede-cord-heishi", "feather-cream"]) delete ACCESSORY_PUBLIC_IDS[k];
  }
});
