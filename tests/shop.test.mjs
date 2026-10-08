// Shop tests: hat types, prices, validation, permalinks, the cart, the Stripe
// metadata, both emails and the real checkout handler.
//
//   npm test
//
// Node's own test runner, no dependencies. The checkout handler runs for
// real with the "stripe" package replaced by a recorder (mock.module), so
// these tests never touch the network or need a key.

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { BASES, accessoryLayers, baseArtFor, basesFor, sizeGuideRows } from "../src/shop/catalog.js";
import { reviveLine } from "../src/shop/cartLine.js";
import { encodeOrderMetadata, parseCartFromMetadata, METADATA_VALUE_MAX } from "../src/shop/orderMetadata.js";
import { buildHatImageUrl, buildOrderEmail, hatRows } from "../src/shop/orderEmail.js";
import { buildCustomerEmail } from "../src/shop/customerEmail.js";

const fields = (c) => P.validateConfig({ size: "m", quantity: 1, ...c }).errors.map((e) => e.field);
const order = (...lines) => P.buildOrder(lines.map((l) => ({ size: "m", quantity: 1, ...l })));

// No type is off sale today; the disabled-type rules are tested by taking
// straw off for the length of one test.
const offSale = (id, fn) => {
  const t = P.findHatType(id);
  const was = t.enabled;
  t.enabled = false;
  const done = () => (t.enabled = was);
  try {
    const r = fn();
    if (r && typeof r.then === "function") return r.finally(done);
    done();
    return r;
  } catch (e) {
    done();
    throw e;
  }
};

// ---- hat types ---------------------------------------------------------------
test("three hat types with their price, sizes, branding, accessories and switch", () => {
  const t = Object.fromEntries(P.HAT_TYPES.map((x) => [x.id, x]));
  assert.deepEqual(Object.keys(t), ["wool", "suede", "straw"]);
  assert.deepEqual([t.wool.basePrice, t.suede.basePrice, t.straw.basePrice], [14000, 8000, 8000]);
  assert.deepEqual(t.wool.sizes.map((s) => s.id), ["s", "m", "l", "xl"]);
  assert.deepEqual(t.straw.sizes.map((s) => s.id), ["s", "m", "l", "xl"]);
  assert.deepEqual(t.suede.sizes.map((s) => [s.id, s.name]), [["s-m", "S/M"], ["l-xl", "L/XL"]]);
  assert.deepEqual([t.wool.brandingAllowed, t.suede.brandingAllowed, t.straw.brandingAllowed], [true, true, false]);
  assert.deepEqual(t.wool.accessories, ["feather", "cord", "bud", "matches"]);
  assert.deepEqual(t.suede.accessories, ["feather", "cord", "bud", "matches"]);
  assert.deepEqual(t.straw.accessories, ["feather", "cord", "bud"], "every accessory but matches, for now");
  assert.deepEqual([t.wool.enabled, t.suede.enabled, t.straw.enabled], [true, true, true]);
  assert.deepEqual(P.enabledHatTypes().map((x) => x.id), ["wool", "suede", "straw"]);
});

test("colors per type, in builder order; the original wool ids are kept", () => {
  const ids = (id) => P.findHatType(id).colors.map((c) => c.id);
  const names = (id) => P.findHatType(id).colors.map((c) => c.name);
  assert.deepEqual(names("wool"), ["Silver Belly", "White", "Sand", "Chocolate", "Black", "Navy", "Baby Blue", "Turquoise", "Soft Pink", "Cotton Candy Pink", "Red", "Burgundy"]);
  assert.deepEqual(ids("wool"), ["ivory", "white", "sand", "chocolate", "black", "navy", "baby-blue", "turquoise", "pink", "cotton-candy-pink", "red", "wine"]);
  for (const id of ["ivory", "black", "chocolate", "pink", "wine", "turquoise"]) assert.ok(ids("wool").includes(id), id);
  assert.deepEqual(names("suede"), ["Cream", "Black", "Brown", "Camel", "Tobacco", "Burgundy", "Navy", "Olive", "Gray"]);
  assert.deepEqual(ids("suede"), ["cream", "black", "brown", "camel", "tobacco", "burgundy", "navy", "olive", "gray"]);
  assert.deepEqual(names("straw"), ["Cream", "Black"]);
  assert.deepEqual(ids("straw"), ["cream", "black"]);
  assert.deepEqual(P.HAT_TYPES.filter((t) => t.enabled).map((t) => t.id), ["wool", "suede", "straw"], "all three on sale");
  const all = P.HAT_TYPES.flatMap((t) => t.colors.map((c) => c.name));
  for (const old of ["Ivory", "Dusty Pink", "Wine"]) assert.ok(!all.includes(old), `old label ${old} still shown`);
});

test("price per type: the type sets the base price, never the color", () => {
  assert.equal(order({ baseId: "ivory" }).subtotal, 14000);
  assert.equal(order({ hatType: "wool", baseId: "wine" }).subtotal, 14000);
  // suede and straw are $80
  assert.equal(order({ hatType: "suede", baseId: "camel", size: "s-m" }).subtotal, 8000);
  assert.equal(order({ hatType: "straw", baseId: "cream" }).subtotal, 8000);
  assert.equal(new Set(P.findHatType("wool").colors.map((c) => order({ baseId: c.id }).subtotal)).size, 1);
  const full = order({ baseId: "black", featherId: "magenta", cordId: "rhinestone", budSize: "large", budColor: "teal", matchesColor: "red" });
  assert.deepEqual([full.subtotal, full.shipping, full.total], [24500, 1200, 25700]);
  assert.equal(full.items[0].label, "Wool Hat: Black");
});

test("buildOrder ignores any price the browser puts on a line", () => {
  const forged = order({ baseId: "ivory", featherId: "natural", price: 1, unitPrice: 1, basePrice: 1, subtotal: 1, total: 1 });
  assert.equal(forged.subtotal, 19000);
  assert.ok(forged.items.every((i) => i.unitPrice > 1));
});

test("shipping rule untouched", () => {
  assert.deepEqual([P.SHIPPING_FLAT, P.FREE_SHIPPING_MIN_QTY], [1200, 2]);
  assert.equal(order({ baseId: "ivory", quantity: 2 }).shipping, 0);
});

// ---- validation ---------------------------------------------------------------
test("rejects an unknown type and a disabled type", () => {
  assert.deepEqual(fields({ hatType: "leather", baseId: "ivory" }), ["hatType"]);
  assert.deepEqual(fields({ hatType: "suede", baseId: "camel", size: "s-m" }), [], "suede is on sale");
  assert.deepEqual(fields({ hatType: "straw", baseId: "cream" }), [], "straw is on sale");
  offSale("straw", () => assert.ok(fields({ hatType: "straw", baseId: "cream" }).includes("hatType"), "a type off sale is refused"));
});

test("rejects a size or a color from another type", () => {
  assert.deepEqual(fields({ baseId: "ivory", size: "s-m" }), ["size"]); // suede size on wool
  assert.deepEqual(fields({ baseId: "camel" }), ["baseId"]); // suede color on wool
  assert.ok(fields({ hatType: "suede", baseId: "camel", size: "m" }).includes("size")); // wool size on suede
  assert.ok(fields({ hatType: "straw", baseId: "ivory" }).includes("baseId")); // wool color on straw
});

test("rejects accessories the type does not take", () => {
  // straw takes everything but matches (for now)
  assert.deepEqual(fields({ hatType: "straw", baseId: "cream", featherId: "natural", cordId: "rhinestone", budSize: "small", budColor: "teal", matchesColor: "red" }), ["matchesColor"]);
  const t = P.findHatType("straw");
  const was = t.accessories;
  t.accessories = [];
  try {
    const f = fields({ hatType: "straw", baseId: "cream", featherId: "natural", cordId: "rhinestone", budSize: "small", budColor: "teal", matchesColor: "red" });
    for (const field of ["featherId", "cordId", "budSize", "matchesColor"]) assert.ok(f.includes(field), field);
  } finally {
    t.accessories = was;
  }
  assert.deepEqual(fields({ baseId: "ivory", featherId: "natural", cordId: "rhinestone" }), []); // wool takes them
});

test("a line with no hatType is wool and valid", () => {
  assert.deepEqual(fields({ baseId: "ivory" }), []);
  assert.equal(P.normalizeConfig({ baseId: "ivory" }).hatType, "wool");
});

test("validateCart reports the offending line by index", () => {
  const r = P.validateCart([{ baseId: "ivory", size: "m", quantity: 1 }, { hatType: "straw", baseId: "cream", size: "m", quantity: 1, matchesColor: "red" }]);
  assert.equal(r.valid, false);
  assert.ok(r.errors.every((e) => e.index === 1));
});

// ---- the cart in localStorage --------------------------------------------------------
test("an old cart line with no hatType revives as wool", () => {
  const old = { id: "row1", baseId: "wine", featherId: "polka", cordId: "none", budSize: "none", matchesColor: "none", size: "l", quantity: 2 };
  const line = reviveLine(old);
  assert.equal(line.hatType, "wool");
  assert.deepEqual([line.id, line.baseId, line.size, line.quantity], ["row1", "wine", "l", 2]);
  assert.equal(reviveLine({ ...old, hatType: "suede" }), null, "a disabled type is dropped");
});

// ---- permalinks ----------------------------------------------------------------------
test("permalinks: wool links look as before, other types add t", () => {
  assert.equal(P.buildPermalinkQuery({ baseId: "pink", size: "s" }), "b=pink&sz=s");
  assert.equal(P.buildPermalinkQuery({ hatType: "suede", baseId: "navy", size: "l-xl" }), "t=suede&b=navy&sz=l-xl");
});

test("an old permalink with no type opens as wool", () => {
  const c = P.parsePermalink("b=wine&f=natural&sz=l");
  assert.deepEqual([c.hatType, c.baseId, c.featherId, c.size], ["wool", "wine", "natural", "l"]);
  // older still: band, brand, charm
  assert.deepEqual(P.parsePermalink("b=chocolate&bd=leather&br=star&charm=boot&sz=m").hatType, "wool");
});

test("a permalink to a disabled or unknown type opens as wool; suede and straw open as themselves", () => {
  const suede = P.parsePermalink("t=suede&b=camel&sz=s-m");
  assert.deepEqual([suede.hatType, suede.baseId, suede.size], ["suede", "camel", "s-m"]);
  const straw = P.parsePermalink("t=straw&b=black&sz=l");
  assert.deepEqual([straw.hatType, straw.baseId, straw.size], ["straw", "black", "l"]);
  const unknown = P.parsePermalink("t=velvet&b=ivory");
  assert.deepEqual([unknown.hatType, unknown.baseId], ["wool", "ivory"]);
  offSale("straw", () => {
    const c = P.parsePermalink("t=straw&b=cream");
    assert.equal(c.hatType, "wool");
    assert.ok(P.findBase(c.baseId, "wool"));
  });
});

// ---- size guide -----------------------------------------------------------------------
test("size guide per type with US size, inches and cm", () => {
  const plain = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? v : v.replace(/\u00a0/g, " ")])));
  assert.ok(sizeGuideRows("wool")[0].inches.includes("21\u00a07/8\u00a0in"), "a fraction never wraps away from its number");
  assert.deepEqual(plain(sizeGuideRows("wool")), [
    { id: "s", size: "S", us: "6 7/8", inches: "21 to 21 7/8 in", cm: "54 to 55 cm" },
    { id: "m", size: "M", us: "7 1/8", inches: "22 to 22 3/4 in", cm: "56 to 57 cm" },
    { id: "l", size: "L", us: "7 3/8", inches: "22 7/8 to 23 1/2 in", cm: "58 to 59 cm" },
    { id: "xl", size: "XL", us: "7 5/8", inches: "23 5/8 to 24 1/4 in", cm: "60 to 61 cm" },
  ]);
  assert.deepEqual(plain(sizeGuideRows("suede")), [
    { id: "s-m", size: "S/M", us: null, inches: "21 to 22 3/4 in", cm: "54 to 57 cm" },
    { id: "l-xl", size: "L/XL", us: null, inches: "22 7/8 to 24 1/4 in", cm: "58 to 61 cm" },
  ]);
});

// ---- artwork -------------------------------------------------------------------------
const CLD = "https://res.cloudinary.com/dsprn0ew4/image/upload";
const ART = {
  wool: {
    // the original six: ids and URLs must never change
    ivory: "v1789658517/base-ivory_bcsh3a", black: "v1789658517/base-black_rfptm8", chocolate: "v1789658517/base-chocolate_osknft",
    pink: "v1789658517/base-pink_jqkfio", wine: "v1789658517/base-wine_zssnd7", turquoise: "v1789658518/base-turquoise_x0zmnn",
    "baby-blue": "v1791321778/base-baby-blue_jxadxz", "cotton-candy-pink": "v1791321777/base-cotton-candy-pink_weeofk",
    red: "v1791321777/base-red_huaglj", navy: "v1791321777/base-navy_jnbmth", sand: "v1791321777/base-sand_cfjvob", white: "v1791321777/base-white_kgytui",
  },
  suede: {
    cream: "v1791319050/base-suede-cream_mymyyv", black: "v1791319051/base-suede-black_lrtlj0", brown: "v1791319051/base-suede-brown_bpdmr2",
    camel: "v1791319051/base-suede-camel_q3dftk", tobacco: "v1791319050/base-suede-tobacco_tx7v8o", burgundy: "v1791319051/base-suede-burgundy_fwpzrj",
    navy: "v1791319050/base-suede-navy_inyjzi", olive: "v1791319050/base-suede-olive_jjfona", gray: "v1791319050/base-suede-gray_vgc9ho",
  },
  straw: { cream: "v1791319051/base-straw-cream_dgvh8l", black: "v1791319050/base-straw-black_mqmfpv" },
};

test("every color of every type has its own base, in the site's URL format", () => {
  for (const t of P.HAT_TYPES) {
    assert.deepEqual(basesFor(t.id).map((b) => b.id), t.colors.map((c) => c.id), t.id);
    for (const c of t.colors) {
      const art = baseArtFor({ hatType: t.id, baseId: c.id });
      assert.equal(art.layerImg, `${CLD}/f_auto,q_auto,w_1600/${ART[t.id][c.id]}.png`, `${t.id} ${c.id}`);
      assert.equal(art.publicId, ART[t.id][c.id].split("/")[1]);
    }
  }
  assert.equal(BASES, basesFor("wool"));
  // a suede black is its own file, never the wool felt
  assert.notEqual(baseArtFor({ hatType: "suede", baseId: "black" }).layerImg, baseArtFor({ baseId: "black" }).layerImg);
  assert.equal(baseArtFor({ hatType: "velvet", baseId: "black" }), null);
  assert.deepEqual(accessoryLayers({ hatType: "straw", baseId: "cream", featherId: "natural", matchesColor: "red" }).map((l) => l.key), ["straw-feather-natural"], "straw layers; no matches on straw");
});

test("the order email draws the new wool bases", () => {
  assert.equal(
    buildHatImageUrl({ baseId: "cotton-candy-pink", size: "m" }),
    `${CLD}/w_240,c_fit,f_auto,q_auto/v1791321777/base-cotton-candy-pink_weeofk.png`,
  );
  assert.equal(buildHatImageUrl({ baseId: "ivory", size: "m" }), `${CLD}/w_240,c_fit,f_auto,q_auto/v1789658517/base-ivory_bcsh3a.png`);
});

test("a new wool color is valid, at the wool price, and survives the metadata", () => {
  for (const baseId of ["baby-blue", "cotton-candy-pink", "red", "navy", "sand", "white"]) {
    assert.deepEqual(P.validateConfig({ baseId, size: "m", quantity: 1 }).errors, [], baseId);
    assert.equal(order({ baseId }).subtotal, 14000, baseId);
  }
  assert.equal(order({ baseId: "baby-blue", featherId: "natural" }).subtotal, 19000);
  const back = parseCartFromMetadata(encodeOrderMetadata(order({ baseId: "cotton-candy-pink", size: "xl" })));
  assert.deepEqual([back.problems, back.cart[0].hatType, back.cart[0].baseId, back.cart[0].size], [[], "wool", "cotton-candy-pink", "xl"]);
});

test("every suede and straw color is valid now that both are on sale", () => {
  for (const baseId of P.findHatType("suede").colors.map((c) => c.id)) {
    assert.deepEqual(P.validateConfig({ hatType: "suede", baseId, size: "s-m", quantity: 1 }).errors, [], baseId);
  }
  for (const baseId of ["cream", "black"]) {
    assert.deepEqual(P.validateConfig({ hatType: "straw", baseId, size: "m", quantity: 1 }).errors, [], baseId);
  }
});

test("?preview=types opens a disabled type only in the builder's preview", () => offSale("straw", () => {
  const preview = P.parsePermalink("t=straw&b=black&sz=m", undefined, { previewTypes: true });
  assert.deepEqual([preview.hatType, preview.baseId, preview.size], ["straw", "black", "m"]);
  // the same link without the preview, and anything a page could send, stays wool or is refused
  assert.equal(P.parsePermalink("t=straw&b=black&sz=m&preview=types").hatType, "wool");
  assert.equal(P.validateConfig({ ...preview, quantity: 1, preview: "types", previewTypes: true }).valid, false);
  assert.equal(reviveLine({ ...preview, id: "x", quantity: 1, preview: "types" }), null, "never reaches the cart");
}));

// ---- Stripe metadata --------------------------------------------------------------------
test("metadata v3 carries the type and stays inside Stripe's limits", () => {
  const md = encodeOrderMetadata(order({ baseId: "ivory", featherId: "natural", cordId: "stitching", cordColor: "sage", stitchingNote: "a | b" }));
  assert.equal(md.hat_1, "v3|wool|ivory|natural|stitching|sage|none||none|none||M|1");
  assert.equal(md.hat_1_note, "a | b");
  const big = encodeOrderMetadata(P.buildOrder(Array.from({ length: 10 }, () => ({ baseId: "pink", cordId: "stitching", cordColor: "rust", stitchingNote: "x".repeat(500), size: "xl", quantity: 1 }))));
  assert.ok(Object.keys(big).length <= 50);
  assert.ok(Object.values(big).every((v) => v.length <= METADATA_VALUE_MAX));
});

test("metadata reads v3, v2 (as wool) and v1 (as wool)", () => {
  const v3 = parseCartFromMetadata({ hat_count: "1", hat_1: "v3|suede|camel|none|none||none||none|none||S-M|1" });
  assert.deepEqual([v3.problems, v3.cart[0].hatType, v3.cart[0].size], [[], "suede", "s-m"]);
  const v2 = parseCartFromMetadata({ hat_count: "1", hat_1: "v2|wine|polka|none||none||red|none||L|2" });
  assert.deepEqual([v2.problems, v2.cart[0].hatType, v2.cart[0].baseId, v2.cart[0].quantity], [[], "wool", "wine", 2]);
  const v1 = parseCartFromMetadata({ hat_count: "1", hat_1: "chocolate|leather|star||M|1" });
  assert.deepEqual([v1.problems, v1.cart[0].legacy, v1.cart[0].hatType], [[], true, "wool"]);
  const bad = parseCartFromMetadata({ hat_count: "1", hat_1: "v3|velvet|ivory|none|none||none||none|none||M|1" });
  assert.equal(bad.problems.length, 1, "an unknown type is reported, not guessed");
});

// ---- emails --------------------------------------------------------------------------
const sessionFor = (cart) => {
  const o = P.buildOrder(cart);
  return {
    id: "cs_test_types",
    payment_status: "paid",
    amount_subtotal: o.subtotal,
    amount_total: o.total,
    total_details: { amount_shipping: o.shipping },
    customer_details: { name: "Ana Ruiz", email: "ana@example.com" },
    shipping_details: { name: "Ana Ruiz", address: { line1: "1 Main", city: "El Paso", state: "TX", postal_code: "79912", country: "US" } },
    metadata: encodeOrderMetadata(o),
  };
};

test("work order: every hat opens with type, color and size together", () => {
  const rows = hatRows({ hatType: "wool", baseId: "ivory", featherId: "natural", cordId: "barbed-wire", size: "m", quantity: 1 });
  assert.deepEqual(rows.slice(0, 3), [["Hat", "Wool Hat"], ["Color", "Silver Belly"], ["Size", "M (US 7 1/8)"]]);
  assert.ok(rows.some(([k, v]) => k === "Cord" && v === "Barbed & Beautiful (leather barbed wire)"));
  assert.deepEqual(hatRows({ hatType: "suede", baseId: "camel", size: "s-m", quantity: 1 }).slice(0, 3), [
    ["Hat", "Faux Suede Hat"],
    ["Color", "Camel"],
    ["Size", "S/M (21 to 22 3/4 in)"],
  ]);
  // a v2 order (no type) and a v1 order read as wool
  const v2 = parseCartFromMetadata({ hat_count: "1", hat_1: "v2|wine|none|none||none||none|none||L|1" }).cart[0];
  assert.deepEqual(hatRows(v2).slice(0, 3), [["Hat", "Wool Hat"], ["Color", "Burgundy"], ["Size", "L (US 7 3/8)"]]);
  const v1 = parseCartFromMetadata({ hat_count: "1", hat_1: "pink|leather|none||S|1" }).cart[0];
  assert.deepEqual(hatRows(v1).slice(0, 3), [["Hat", "Wool Hat"], ["Color", "Soft Pink"], ["Size", "S (US 6 7/8)"]]);
});

test("work order HTML shows the type and escapes names", () => {
  const { html, text } = buildOrderEmail({ session: sessionFor([{ baseId: "ivory", cordId: "barbed-wire", size: "m", quantity: 1 }]), baseUrl: "https://tippincowgirl.com" });
  assert.ok(html.includes(">Wool Hat<") && html.includes(">Silver Belly<") && html.includes("M (US 7 1/8)"));
  assert.ok(html.includes("Barbed &amp; Beautiful") && !/Barbed & /.test(html));
  assert.ok(text.includes("Hat: Wool Hat") && text.includes("Color: Silver Belly"));
  assert.ok(!/\bIvory\b|Dusty Pink|\bWine\b/.test(html + text), "no old color labels");
});

test("customer email names the type and color", () => {
  const { html } = buildCustomerEmail({ session: sessionFor([{ baseId: "wine", size: "l", quantity: 1 }]) });
  assert.ok(html.includes("Wool Hat, Burgundy"));
  assert.ok(!/\bWine\b/.test(html));
});

test("no em dashes in any generated email", () => {
  const s = sessionFor([{ baseId: "pink", featherId: "natural", size: "s", quantity: 1 }]);
  const o = buildOrderEmail({ session: s, baseUrl: "https://tippincowgirl.com" });
  const c = buildCustomerEmail({ session: s });
  assert.ok(!/[–—]/.test(o.html + o.text + c.html + c.text));
});

// ---- the real checkout handler, with Stripe replaced by a recorder ----------------------
test("checkout recomputes every amount on the server and refuses disabled types", async () => {
  const calls = [];
  mock.module("stripe", {
    defaultExport: class Stripe {
      constructor() {
        this.checkout = { sessions: { create: async (params) => (calls.push(params), { id: "cs_test_x", url: "https://checkout.stripe.com/x" }) } };
      }
    },
  });
  process.env.STRIPE_SECRET_KEY = "sk_test_recorder";
  process.env.PUBLIC_BASE_URL = "https://tippincowgirl.com";
  const { default: handler } = await import("../api/create-checkout-session.js");
  const post = async (cart, { url = "/api/create-checkout-session", extra = {} } = {}) => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    const body = { cart, ...extra };
    const query = Object.fromEntries(new URL(url, "https://tippincowgirl.com").searchParams);
    await handler({ method: "POST", url, query, headers: { host: "tippincowgirl.com", referer: `https://tippincowgirl.com/${url.includes("?") ? url.slice(url.indexOf("?")) : ""}`, "content-length": String(JSON.stringify(body).length) }, body }, res);
    return res;
  };
  const charged = (p) => p.line_items.reduce((s, l) => s + l.price_data.unit_amount * l.quantity, 0);

  // a forged browser claims $1 for everything, and sends no hatType at all
  let r = await post([{ baseId: "wine", featherId: "magenta", cordId: "rhinestone", budSize: "large", budColor: "purple", matchesColor: "black", size: "m", quantity: 1, price: 100, unitPrice: 100, total: 100, basePrice: 100 }]);
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(charged(calls[0]), 24500);
  assert.equal(calls[0].line_items[0].price_data.unit_amount, 14000);
  assert.equal(calls[0].line_items[0].price_data.product_data.name, "Wool Hat: Burgundy");
  assert.equal(calls[0].metadata.order_total, "25700");
  assert.ok(calls[0].metadata.hat_1.startsWith("v3|wool|wine|"));

  // a forged browser asks for a type that is off sale (straw, taken off for this test)
  calls.length = 0;
  r = await offSale("straw", () => post([{ hatType: "straw", baseId: "cream", size: "m", quantity: 1, price: 100 }]));
  assert.equal(r.code, 400);
  assert.ok(r.body.errors.some((e) => e.field === "hatType" && e.index === 0));
  assert.equal(calls.length, 0, "Stripe is never called");

  // an accessory straw cannot take (matches, for now)
  r = await post([{ hatType: "straw", baseId: "cream", matchesColor: "red", size: "m", quantity: 1 }]);
  assert.equal(r.code, 400);
  assert.ok(r.body.errors.some((e) => e.field === "matchesColor"));
  assert.equal(calls.length, 0);

  // ?preview=types has no effect on the server: not in the URL, not in the body, not on the line
  r = await offSale("straw", () =>
    post([{ hatType: "straw", baseId: "cream", size: "m", quantity: 1, preview: "types", previewTypes: true }], {
      url: "/api/create-checkout-session?preview=types",
      extra: { preview: "types", previewTypes: true },
    })
  );
  assert.equal(r.code, 400);
  assert.ok(r.body.errors.some((e) => e.field === "hatType" && e.index === 0));
  assert.equal(calls.length, 0, "Stripe is never called for a disabled type");

  // a new wool color is charged the wool price, computed here
  r = await post([{ baseId: "cotton-candy-pink", size: "m", quantity: 1, price: 100 }], { url: "/api/create-checkout-session?preview=types" });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(calls[0].line_items[0].price_data.unit_amount, 14000);
  assert.equal(calls[0].line_items[0].price_data.product_data.name, "Wool Hat: Cotton Candy Pink");
  assert.ok(calls[0].metadata.hat_1.startsWith("v3|wool|cotton-candy-pink|"));
});
