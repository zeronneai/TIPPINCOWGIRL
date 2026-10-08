// Straw on sale, wired like Faux Suede: $80, Cream and Black, S to XL,
// every accessory but matches (no straw-matches layers approved yet), its
// own straw-* layers, and never any engraving or engraving charge.
//
//   npm test
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { ACCESSORY_PUBLIC_IDS, accessoryLayers, baseArtFor, layerKeys, thumbKey } from "../src/shop/catalog.js";
import { reviveLine } from "../src/shop/cartLine.js";
import { encodeOrderMetadata, parseCartFromMetadata } from "../src/shop/orderMetadata.js";
import { buildHatImageUrl, hatRows } from "../src/shop/orderEmail.js";

const STRAW = { hatType: "straw", baseId: "cream", size: "m", quantity: 1 };
const straw = (line) => ({ ...STRAW, ...line });
const layer = (stem) => new URL(`../src/shop/layers/${stem}.png`, import.meta.url);
const thumb = (stem) => new URL(`../src/shop/layers/thumbs/${stem}.jpg`, import.meta.url);
const DEB = [
  { kind: "text", text: "DEB", font: "durango", size: "large", position: "front" },
  { kind: "stamp", stampId: "longhorn", size: "large", position: "front" },
];

// every accessory a straw hat takes, as [patch, price, wool stem]
const pieces = (steps) => [
  ...(steps.includes("feather") ? P.FEATHER_OPTIONS.filter((o) => o.id !== "none").map((o) => [{ featherId: o.id }, o.price, thumbKey.feather(o.id)]) : []),
  ...(steps.includes("cord")
    ? P.CORD_OPTIONS.filter((o) => o.id !== "none").flatMap((o) =>
        o.colors ? o.colors.map((c) => [{ cordId: o.id, cordColor: c.id }, o.price, thumbKey.cord(o.id, c.id)]) : [[{ cordId: o.id }, o.price, thumbKey.cord(o.id)]]
      )
    : []),
  ...(steps.includes("bud") ? P.BUD_SIZES.filter((b) => b.id !== "none").flatMap((b) => b.colors.map((c) => [{ budSize: b.id, budColor: c.id }, b.price, thumbKey.bud(b.id, c.id)])) : []),
  ...(steps.includes("matches") ? P.MATCHES.colors.map((c) => [{ matchesColor: c.id }, P.MATCHES.price, thumbKey.matches(c.id)]) : []),
];

test("Straw is on sale: $80, Cream and Black on the straw bases, S to XL, no branding", () => {
  const t = P.findHatType("straw");
  assert.deepEqual([t.enabled, t.basePrice, t.label, t.brandingAllowed], [true, 8000, "Straw Hat", false]);
  assert.deepEqual(t.colors.map((c) => [c.id, c.name]), [["cream", "Cream"], ["black", "Black"]]);
  assert.deepEqual(t.sizes.map((s) => s.name), ["S", "M", "L", "XL"]);
  assert.match(baseArtFor({ hatType: "straw", baseId: "cream" }).layerImg, /\/base-straw-cream_dgvh8l\.png$/);
  assert.match(baseArtFor({ hatType: "straw", baseId: "black" }).layerImg, /\/base-straw-black_mqmfpv\.png$/);
  assert.deepEqual(P.enabledHatTypes().map((x) => x.id), ["wool", "suede", "straw"]);
});

test("every accessory but matches, at $80 plus the piece, on straw-* layers with the same z-index", () => {
  const t = P.findHatType("straw");
  assert.deepEqual(t.accessories, ["feather", "cord", "bud"]);
  const list = pieces(t.accessories);
  assert.equal(list.length, 27, "31 pieces less the 4 matches colors");
  for (const [patch, price, stem] of list) {
    assert.deepEqual(P.validateConfig(straw(patch)).errors, [], JSON.stringify(patch));
    assert.equal(P.buildOrder([straw(patch)]).subtotal, 8000 + price, JSON.stringify(patch));
    const [l] = accessoryLayers(straw(patch));
    const [w] = accessoryLayers({ ...straw(patch), hatType: "wool", baseId: "ivory" });
    assert.equal(l.key, `straw-${stem}`);
    assert.deepEqual([l.step, l.z], [w.step, w.z]);
    assert.ok(existsSync(layer(`straw-${stem}`)), `layers/straw-${stem}.png`);
    assert.ok(existsSync(thumb(`straw-${stem}`)), `layers/thumbs/straw-${stem}.jpg`);
  }
  assert.equal(layerKeys("straw").cord("stitching", "sage"), "straw-cord-stitching-sage");
});

test("matches stay off straw until switched on, and switching on needs all four layers", () => {
  const errors = P.validateConfig(straw({ matchesColor: "red" })).errors;
  assert.deepEqual(errors.map((e) => e.field), ["matchesColor"]);
  assert.deepEqual(accessoryLayers(straw({ featherId: "natural", matchesColor: "red" })).map((l) => l.key), ["straw-feather-natural"]);
  // the guard for the day "matches" is added to straw's accessories
  if (P.findHatType("straw").accessories.includes("matches")) {
    for (const c of P.MATCHES.colors) {
      assert.ok(existsSync(layer(`straw-matches-${c.id}`)), `layers/straw-matches-${c.id}.png`);
      assert.ok(existsSync(thumb(`straw-matches-${c.id}`)), `layers/thumbs/straw-matches-${c.id}.jpg`);
    }
  }
});

test("no engraving and no engraving charge on straw, anywhere", () => {
  // the model: dropped, and refused if sent
  assert.deepEqual(P.normalizeConfig(straw({ engraving: DEB })).engraving, []);
  assert.deepEqual(
    P.validateConfig(straw({ engraving: DEB })).errors.map((e) => e.message),
    ["A Straw Hat cannot be branded"]
  );
  // the price: a forged engraving adds nothing, and no Branding line exists
  const o = P.buildOrder([straw({ engraving: DEB, featherId: "cream" })]);
  assert.equal(o.subtotal, 13000);
  assert.ok(!o.items.some((i) => /Branding/.test(i.label)));
  // the cart: a stored straw line with an engraving is dropped, never revived
  assert.equal(reviveLine({ ...straw({ engraving: DEB }), id: "x" }), null);
  // a permalink: the engraving code is ignored for straw
  assert.deepEqual(P.parsePermalink("t=straw&b=black&e=lt.d.DEB&sz=l").engraving, []);
  // the metadata never carries one
  assert.ok(!("hat_1_engr" in encodeOrderMetadata(P.buildOrder([straw({ engraving: DEB })]))));
});

test("switching type: same ids kept, what straw does not take dropped, sizes and colors checked", () => {
  const wool = { hatType: "wool", baseId: "black", featherId: "guinea", cordId: "stitching", cordColor: "sage", budSize: "large", budColor: "yellow", matchesColor: "pink", size: "m", engraving: DEB };
  const toStraw = P.normalizeConfig({ ...wool, hatType: "straw" });
  assert.deepEqual(
    [toStraw.baseId, toStraw.featherId, toStraw.cordId, toStraw.cordColor, toStraw.budSize, toStraw.budColor, toStraw.matchesColor, toStraw.size, toStraw.engraving],
    ["black", "guinea", "stitching", "sage", "large", "yellow", "none", "m", []]
  );
  const suede = P.normalizeConfig({ ...wool, hatType: "suede", size: "s-m" });
  const suedeToStraw = P.normalizeConfig({ ...suede, hatType: "straw" });
  assert.equal(suedeToStraw.size, null, "S/M is not a straw size: she picks again");
  assert.equal(P.normalizeConfig({ ...wool, baseId: "ivory", hatType: "straw" }).baseId, null, "ivory is not a straw color (the builder picks Cream)");
  const back = P.normalizeConfig({ ...toStraw, hatType: "suede" });
  assert.deepEqual([back.featherId, back.budColor, back.matchesColor], ["guinea", "yellow", "none"], "what was dropped stays dropped");
});

test("a straw permalink with accessories round trips", () => {
  const q = "t=straw&b=black&f=guinea&c=stitching&cc=sage&bs=large&bc=yellow&sz=xl";
  const c = P.parsePermalink(q);
  assert.deepEqual([c.hatType, c.baseId, c.featherId, c.cordColor, c.budColor, c.size], ["straw", "black", "guinea", "sage", "yellow", "xl"]);
  assert.equal(P.buildPermalinkQuery(c), q);
  assert.equal(P.buildPermalinkQuery(P.parsePermalink(`${q}&m=red`)), q, "matches dropped from a straw link");
});

test("the order: Stripe items, metadata, work order and picture use straw", () => {
  const hat = straw({ baseId: "black", featherId: "guinea", cordId: "heishi", size: "l" });
  const o = P.buildOrder([hat]);
  assert.deepEqual(o.items.map((i) => [i.label, i.unitPrice]), [
    ["Straw Hat: Black", 8000],
    ["Feather: Dusty Trail", 5000],
    ["Cord: Desert Heishi", 1500],
  ]);
  assert.deepEqual([o.subtotal, o.shipping, o.total], [14500, 1200, 15700]);
  const md = encodeOrderMetadata(o);
  assert.equal(md.hat_1, "v3|straw|black|guinea|heishi||none||none|none||L|1");
  const back = parseCartFromMetadata(md);
  assert.deepEqual(back.problems, []);
  const rows = Object.fromEntries(hatRows(back.cart[0]));
  assert.deepEqual([rows.Hat, rows.Color, rows.Size, rows.Feather], ["Straw Hat", "Black", "L (US 7 3/8)", "Dusty Trail (guinea fowl feather band)"]);
  assert.ok(!("Branding" in rows));
  assert.equal(
    buildHatImageUrl(straw({ baseId: "black" })),
    "https://res.cloudinary.com/dsprn0ew4/image/upload/w_240,c_fit,f_auto,q_auto/v1791319050/base-straw-black_mqmfpv.png"
  );
  ACCESSORY_PUBLIC_IDS["straw-feather-guinea"] = "acc/straw-feather-guinea";
  ACCESSORY_PUBLIC_IDS["straw-cord-heishi"] = "acc/straw-cord-heishi";
  try {
    assert.ok(buildHatImageUrl(hat).includes("l_acc:straw-feather-guinea/fl_layer_apply/l_acc:straw-cord-heishi/fl_layer_apply"));
  } finally {
    delete ACCESSORY_PUBLIC_IDS["straw-feather-guinea"];
    delete ACCESSORY_PUBLIC_IDS["straw-cord-heishi"];
  }
});
