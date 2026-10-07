// The accessory catalog: the four pieces added for wool, the three layers
// replaced in place, and that nothing that existed before changed.
//
//   npm test
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { accessoryLayers, thumbKey } from "../src/shop/catalog.js";
import { encodeOrderMetadata, parseCartFromMetadata } from "../src/shop/orderMetadata.js";
import { hatRows } from "../src/shop/orderEmail.js";

const order = (line) => P.buildOrder([{ baseId: "ivory", size: "m", quantity: 1, ...line }]);
const layer = (stem) => new URL(`../src/shop/layers/${stem}.png`, import.meta.url);
const thumb = (stem) => new URL(`../src/shop/layers/thumbs/${stem}.jpg`, import.meta.url);

test("everything that existed keeps its id, name and price, in order; the new pieces come last", () => {
  const rows = (list) => list.map((o) => [o.id, o.name, o.price]);
  assert.deepEqual(rows(P.FEATHER_OPTIONS), [
    ["none", "No feather", 0],
    ["natural", "Prairie Pheasant", 5000],
    ["bronze", "Midnight Outlaw", 5000],
    ["guinea", "Dusty Trail", 5000],
    ["magenta", "Pink Outlaw", 5000],
    ["polka", "Polka Dot Posse", 5000],
    ["turquoise", "Turquoise Queen", 5000],
    ["cream", "Snow Quail", 5000],
  ]);
  assert.deepEqual(rows(P.CORD_OPTIONS), [
    ["none", "No cord", 0],
    ["stitching", "Saddle Stitch", 1000],
    ["leather-rope", "Ranch Hand Rope", 1000],
    ["barbed-wire", "Barbed & Beautiful", 1000],
    ["rhinestone", "Rhinestone Sass", 1500],
    ["turquoise", "Turquoise Trail", 1500],
    ["concho-turquoise", "Turquoise Concho", 1500],
    ["concho-silver", "Silver Sundance", 1500],
    ["heishi", "Desert Heishi", 1500],
  ]);
});

test("the owner's plain descriptions", () => {
  const plain = (list, id) => list.find((o) => o.id === id).plain;
  assert.equal(plain(P.FEATHER_OPTIONS, "natural"), "feather band with feather rosette");
  assert.equal(plain(P.FEATHER_OPTIONS, "cream"), "cream and white feather band");
  assert.equal(plain(P.CORD_OPTIONS, "rhinestone"), "double row crystal band");
  assert.equal(plain(P.CORD_OPTIONS, "turquoise"), "turquoise seed bead strands with silver chain");
  assert.equal(plain(P.CORD_OPTIONS, "concho-turquoise"), "silver concho chain with turquoise stones");
  assert.equal(plain(P.CORD_OPTIONS, "concho-silver"), "stamped silver square concho chain");
  assert.equal(plain(P.CORD_OPTIONS, "heishi"), "earth tone heishi bead strand");
});

test("the four new pieces are valid on wool at their price", () => {
  for (const [line, subtotal, label] of [
    [{ featherId: "cream" }, 19000, "Feather: Snow Quail"],
    [{ cordId: "concho-turquoise" }, 15500, "Cord: Turquoise Concho"],
    [{ cordId: "concho-silver" }, 15500, "Cord: Silver Sundance"],
    [{ cordId: "heishi" }, 15500, "Cord: Desert Heishi"],
  ]) {
    assert.deepEqual(P.validateConfig({ baseId: "ivory", size: "m", quantity: 1, ...line }).errors, [], JSON.stringify(line));
    const o = order(line);
    assert.equal(o.subtotal, subtotal, JSON.stringify(line));
    assert.equal(o.items[1].label, label);
  }
  assert.equal(order({ featherId: "cream", cordId: "heishi" }).subtotal, 20500);
});

test("the four new pieces are refused on suede and straw", () => {
  for (const [hatType, baseId, size] of [["suede", "camel", "s-m"], ["straw", "cream", "m"]]) {
    for (const [line, field] of [[{ featherId: "cream" }, "featherId"], [{ cordId: "concho-turquoise" }, "cordId"], [{ cordId: "concho-silver" }, "cordId"], [{ cordId: "heishi" }, "cordId"]]) {
      const errors = P.validateConfig({ hatType, baseId, size, quantity: 1, ...line }).errors;
      assert.ok(errors.some((e) => e.field === field && /does not take/.test(e.message)), `${hatType} ${JSON.stringify(line)}: ${JSON.stringify(errors)}`);
    }
    assert.deepEqual(P.findHatType(hatType).accessories, [], `${hatType} still takes nothing`);
    assert.equal(P.findHatType(hatType).enabled, false);
  }
});

test("every accessory has its layer and thumbnail, named after its id", () => {
  const stems = [
    ...P.FEATHER_OPTIONS.filter((o) => o.id !== "none").map((o) => thumbKey.feather(o.id)),
    ...P.CORD_OPTIONS.filter((o) => o.id !== "none").flatMap((o) => (o.colors ? o.colors.map((c) => thumbKey.cord(o.id, c.id)) : [thumbKey.cord(o.id)])),
    ...P.BUD_SIZES.flatMap((b) => b.colors.map((c) => thumbKey.bud(b.id, c.id))),
    ...P.MATCHES.colors.map((c) => thumbKey.matches(c.id)),
  ];
  assert.equal(stems.length, 31, "27 before, 4 new");
  for (const s of stems) {
    assert.ok(existsSync(layer(s)), `layers/${s}.png`);
    assert.ok(existsSync(thumb(s)), `layers/thumbs/${s}.jpg`);
  }
  assert.deepEqual(
    accessoryLayers({ baseId: "ivory", featherId: "cream", cordId: "concho-silver" }).map((l) => [l.key, l.z]),
    [["feather-cream", 20], ["cord-concho-silver", 30]]
  );
  assert.deepEqual(accessoryLayers({ baseId: "ivory", cordId: "heishi" }).map((l) => l.key), ["cord-heishi"]);
});

test("the work order names them with their description", () => {
  const rows = (line) => Object.fromEntries(hatRows({ ...P.normalizeConfig({ baseId: "ivory", size: "m", ...line }), quantity: 1 }));
  assert.equal(rows({ featherId: "natural" }).Feather, "Prairie Pheasant (feather band with feather rosette)");
  assert.equal(rows({ featherId: "cream" }).Feather, "Snow Quail (cream and white feather band)");
  assert.equal(rows({ cordId: "rhinestone" }).Cord, "Rhinestone Sass (double row crystal band)");
  assert.equal(rows({ cordId: "turquoise" }).Cord, "Turquoise Trail (turquoise seed bead strands with silver chain)");
  assert.equal(rows({ cordId: "concho-turquoise" }).Cord, "Turquoise Concho (silver concho chain with turquoise stones)");
  assert.equal(rows({ cordId: "concho-silver" }).Cord, "Silver Sundance (stamped silver square concho chain)");
  assert.equal(rows({ cordId: "heishi" }).Cord, "Desert Heishi (earth tone heishi bead strand)");
});

test("the new ids travel through the Stripe metadata", () => {
  const md = encodeOrderMetadata(order({ featherId: "cream", cordId: "concho-turquoise" }));
  assert.equal(md.hat_1, "v3|wool|ivory|cream|concho-turquoise||none||none|none||M|1");
  const back = parseCartFromMetadata(md);
  assert.deepEqual([back.problems, back.cart[0].featherId, back.cart[0].cordId], [[], "cream", "concho-turquoise"]);
});

test("permalinks: old ones open as before, new pieces round trip", () => {
  const old = P.parsePermalink("b=wine&f=natural&c=rhinestone&sz=l");
  assert.deepEqual([old.featherId, old.cordId, old.size], ["natural", "rhinestone", "l"]);
  assert.equal(P.buildPermalinkQuery(old), "b=wine&f=natural&c=rhinestone&sz=l");
  const turq = P.parsePermalink("b=pink&c=turquoise&bs=large&bc=red&m=black&sz=s");
  assert.deepEqual([turq.cordId, turq.budSize, turq.budColor, turq.matchesColor], ["turquoise", "large", "red", "black"]);
  assert.equal(P.parsePermalink("b=chocolate&bd=leather&br=star&charm=boot&sz=m").baseId, "chocolate", "older still");
  const q = P.buildPermalinkQuery({ baseId: "ivory", featherId: "cream", cordId: "concho-silver", size: "m" });
  assert.equal(q, "b=ivory&f=cream&c=concho-silver&sz=m");
  const back = P.parsePermalink(q);
  assert.deepEqual([back.featherId, back.cordId], ["cream", "concho-silver"]);
  assert.equal(P.parsePermalink("t=suede&f=cream&c=heishi").featherId, "cream", "a suede link (suede is off) opens as wool, pieces kept");
});
