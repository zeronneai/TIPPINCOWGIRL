// The engraving (burned stamps and letters): the model, the price rule, the
// codes in the permalink and the Stripe metadata, the emails, and the real
// checkout handler charging it on wool and refusing it on straw and on any
// type that is not on sale.
//
//   npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { ENGRAVING_STAMPS } from "../src/shop/engravingStamps.js";
import { ENGRAVING_STAMP_IDS } from "../src/shop/engravingStampIds.js";
import { ENGRAVING_ANCHORS, ENGRAVING_MAX_WIDTH, stampInches } from "../src/shop/engravingArt.js";
import { engravingRows } from "../src/shop/engravingText.js";
import { encodeOrderMetadata, parseCartFromMetadata, METADATA_VALUE_MAX } from "../src/shop/orderMetadata.js";
import { buildOrderEmail, hatRows } from "../src/shop/orderEmail.js";
import { buildCustomerEmail } from "../src/shop/customerEmail.js";
import { BOX_OVERRIDES, buildStampData, renderIdsModule, renderModule } from "../scripts/engraving-data.mjs";

const stamp = (stampId, size = "large", position = "front") => ({ kind: "stamp", stampId, size, position });
const text = (t, font = "durango", size = "large", position = "front") => ({ kind: "text", text: t, font, size, position });
const DEB = [text("DEB"), stamp("longhorn"), stamp("horseshoe", "small", "left")];
const order = (...lines) => P.buildOrder(lines.map((l) => ({ baseId: "ivory", size: "m", quantity: 1, ...l })));
const errorsOf = (c) => P.validateConfig({ baseId: "ivory", size: "m", quantity: 1, ...c }).errors.map((e) => e.message);

// ---- the rule and its constants --------------------------------------------------------
test("constants: on, 4 free brands, $10 once, 12 per position", () => {
  assert.equal(P.ENGRAVING_ENABLED, true);
  assert.equal(P.FREE_BRAND_COUNT, 4);
  assert.equal(P.ENGRAVING_FEE, 1000);
  assert.equal(P.MAX_ELEMENTS_PER_POSITION, 12);
  assert.equal(P.BRANDS_ENABLED, false, "the old brand stays off");
  assert.deepEqual(P.ENGRAVING_FONTS.map((f) => f.id), ["original", "soft", "copperplate", "durango"]);
  assert.deepEqual(
    P.HAT_TYPES.map((t) => [t.id, t.brandingAllowed]),
    [["wool", true], ["suede", true], ["straw", false]]
  );
});

test("brand count: a stamp is one, a letter or digit is one, spaces are free", () => {
  assert.equal(P.brandCount([]), 0);
  assert.equal(P.brandCount([stamp("longhorn")]), 1);
  assert.equal(P.brandCount([text("DEB")]), 3);
  assert.equal(P.brandCount([text("A B C")]), 3);
  assert.equal(P.brandCount([text("TX 1990")]), 6);
  assert.equal(P.brandCount(DEB), 5);
});

test("4 brands are free and never reach Stripe as a $0 line", () => {
  for (const engraving of [[text("DEBS")], [stamp("longhorn"), stamp("cactus"), text("AB")], [text("A B C D")]]) {
    const o = order({ engraving });
    assert.equal(o.subtotal, 14000, JSON.stringify(engraving));
    assert.deepEqual(o.items.map((i) => i.label), ["Wool Hat: Silver Belly"]);
  }
  // the free branding is still part of the hat
  assert.deepEqual(P.hatParts({ baseId: "ivory", engraving: [text("DEBS")] }).at(-1), {
    step: "engraving", label: "Branding", name: "4 free brands", detail: null, plain: null, price: 0,
  });
});

test("5 brands cost $10, once per hat", () => {
  const o = order({ engraving: DEB });
  assert.equal(o.subtotal, 15000);
  assert.deepEqual(o.items.at(-1), { label: "Branding: Unlimited (5 brands)", unitPrice: 1000, quantity: 1 });
  // per hat: two of the same hat pay it twice, a second hat line pays its own
  assert.equal(order({ engraving: DEB, quantity: 2 }).subtotal, 30000);
  const two = order({ engraving: DEB }, { baseId: "wine", engraving: [text("ABCDE", "soft")] });
  assert.equal(two.subtotal, 30000);
  assert.equal(two.items.filter((i) => / - Branding: /.test(i.label)).length, 2);
});

test("30 brands still cost $10", () => {
  const thirty = [text("ABCDEFGHIJKL"), text("MNOPQRSTUVWX", "soft", "small"), ...["cactus", "heart-outline", "arrow"].map((s) => stamp(s, "small")),
    ...["horse", "bison", "wave"].map((s) => stamp(s, "small", "left"))];
  assert.equal(P.brandCount(thirty), 30);
  assert.equal(P.engravingPrice(thirty), 1000);
  assert.equal(order({ engraving: thirty }).subtotal, 15000);
});

test("the browser never sets the engraving price", () => {
  const forged = DEB.map((e) => ({ ...e, price: 0, fee: 0, free: true }));
  const o = order({ engraving: forged, price: 100, engravingPrice: 0, unitPrice: 100, total: 100 });
  assert.equal(o.subtotal, 15000);
  assert.deepEqual(P.normalizeConfig({ engraving: forged }).engraving[0], { kind: "text", text: "DEB", font: "durango", size: "large", position: "front" });
  assert.ok(!("engravingPrice" in P.pickConfig({ engravingPrice: 0, engraving: DEB })));
});

// ---- validation --------------------------------------------------------------------------
test("an engraved wool hat is accepted", () => {
  assert.deepEqual(errorsOf({ engraving: DEB }), []);
  assert.deepEqual(errorsOf({ engraving: [text("ABCDEFGHIJKL"), stamp("olive-branch", "small", "left")] }), []);
  assert.deepEqual(errorsOf({ engraving: [] }), [], "an empty list is no engraving");
  assert.deepEqual(errorsOf({}), [], "missing is no engraving");
});

test("an engraved suede hat is accepted, $80 plus the engraving", () => {
  assert.deepEqual(P.validateConfig({ hatType: "suede", baseId: "camel", size: "s-m", quantity: 1, engraving: DEB }).errors, []);
  assert.equal(P.buildOrder([{ hatType: "suede", baseId: "camel", size: "s-m", quantity: 1, engraving: DEB }]).subtotal, 9000);
  assert.equal(P.buildOrder([{ hatType: "suede", baseId: "camel", size: "s-m", quantity: 1, engraving: [text("DEB")] }]).subtotal, 8000);
});

test("invalid text is refused", () => {
  const msgs = (t) => errorsOf({ engraving: [{ ...text("X"), text: t }] });
  assert.deepEqual(msgs("DEB!"), ["Brand 1: the text can only use A to Z, 0 to 9 and spaces"]);
  assert.deepEqual(msgs("ÑANDÚ"), ["Brand 1: the text can only use A to Z, 0 to 9 and spaces"]);
  assert.deepEqual(msgs("   "), ["Brand 1: the text is empty"]);
  assert.deepEqual(msgs("ABCDEFGHIJKLM"), ["Brand 1: the text must be 12 characters or fewer"]);
  assert.deepEqual(msgs(42), ["Brand 1: the text is empty"]);
  assert.deepEqual(msgs(" deb "), [], "lowercase and outer spaces are fine; it is stored as DEB");
  assert.equal(P.normalizeConfig({ engraving: [text(" d e b ")] }).engraving[0].text, "D E B");
  assert.deepEqual(errorsOf({ engraving: [{ ...text("DEB"), font: "comic" }] }), ['Brand 1: unknown font "comic"']);
});

test("an unknown stamp, size, position or kind is refused", () => {
  assert.deepEqual(errorsOf({ engraving: [stamp("unicorn")] }), ['Brand 1: unknown stamp "unicorn"']);
  assert.deepEqual(errorsOf({ engraving: [stamp("longhorn", "huge")] }), ['Brand 1: unknown size "huge"']);
  assert.deepEqual(errorsOf({ engraving: [stamp("longhorn", "large", "back")] }), ['Brand 1: unknown position "back"']);
  assert.deepEqual(errorsOf({ engraving: [{ kind: "sticker", size: "large", position: "front" }] }), ['Brand 1: unknown kind "sticker"']);
  assert.deepEqual(errorsOf({ engraving: "lt.d.DEB" }), ["Branding must be a list"]);
});

test("a straw hat cannot be engraved, and switching to straw drops it", () => {
  const msgs = P.validateConfig({ hatType: "straw", baseId: "cream", size: "m", quantity: 1, engraving: [stamp("cactus")] }).errors
    .filter((e) => e.field === "engraving").map((e) => e.message);
  assert.ok(msgs.includes("A Straw Hat cannot be branded"), JSON.stringify(msgs));
  assert.deepEqual(P.normalizeConfig({ hatType: "straw", baseId: "cream", engraving: DEB }).engraving, []);
  assert.equal(P.normalizeConfig({ hatType: "suede", baseId: "camel", engraving: DEB }).engraving.length, 3, "suede takes it");
});

test("no more than 12 per position", () => {
  const thirteen = Array.from({ length: 13 }, () => stamp("cactus", "small"));
  assert.ok(errorsOf({ engraving: thirteen }).includes("The front can carry up to 12 brands"));
  assert.ok(errorsOf({ engraving: Array.from({ length: 25 }, () => stamp("cactus")) }).includes("A hat can carry up to 24 brands"));
  assert.equal(P.normalizeEngraving(thirteen).length, 12);
});

// ---- the shared code: permalink and metadata ------------------------------------------------
test("old permalinks with no engraving work as before", () => {
  assert.equal(P.buildPermalinkQuery({ baseId: "wine", featherId: "natural", size: "l" }), "b=wine&f=natural&sz=l");
  for (const q of ["b=wine&f=natural&sz=l", "b=chocolate&bd=leather&br=star&charm=boot&sz=m", ""]) {
    assert.deepEqual(P.parsePermalink(q).engraving, [], q);
    assert.deepEqual(P.parsePermalink(q, undefined, { previewEngraving: true }).engraving, [], q);
  }
});

test("the engraving code in the permalink, read without any preview", () => {
  const q = P.buildPermalinkQuery({ baseId: "ivory", size: "m", engraving: [...DEB, text("A B", "soft", "small", "left")] });
  assert.equal(q, "b=ivory&e=lt.d.DEB_ls.longhorn*ss.horseshoe_st.s.A+B&sz=m");
  const back = P.parsePermalink(q);
  assert.deepEqual(back.engraving, P.normalizeEngraving([...DEB, text("A B", "soft", "small", "left")]));
  assert.equal(P.parsePermalink(`t=straw&${q}`).engraving.length, 4, "a straw link (straw is off) opens as wool, engraving kept");
  // a hand edited code keeps what it can read
  assert.deepEqual(P.parseEngraving("ls.longhorn_xx.nope*").engraving, [stamp("longhorn")]);
  assert.deepEqual(P.parseEngraving("ls.longhorn_xx.nope*").problems, ["Unreadable engraving piece: xx.nope"]);
});

test("Stripe metadata carries the engraving in its own key, within 500 characters", () => {
  const md = encodeOrderMetadata(order({ engraving: DEB }, { baseId: "wine" }));
  assert.equal(md.hat_1_engr, "lt.d.DEB_ls.longhorn*ss.horseshoe");
  assert.equal(md.hat_1, "v3|wool|ivory|none|none||none||none|none||M|1", "the hat record is unchanged");
  assert.ok(!("hat_2_engr" in md));
  const back = parseCartFromMetadata(md);
  assert.deepEqual(back.problems, []);
  assert.deepEqual(back.cart[0].engraving, P.normalizeEngraving(DEB));
  assert.deepEqual(back.cart[1].engraving, []);

  // the longest stamp id, 12 large on each side
  const longest = ENGRAVING_STAMPS.reduce((a, s) => (s.id.length > a.length ? s.id : a), "");
  const worst = [...Array(12).fill(stamp(longest)), ...Array(12).fill(stamp(longest, "large", "left"))];
  const code = encodeOrderMetadata(order({ engraving: worst })).hat_1_engr;
  assert.ok(code.length <= METADATA_VALUE_MAX, `${code.length} characters`);
  assert.equal(parseCartFromMetadata({ hat_count: "1", hat_1: "v3|wool|ivory|none|none||none||none|none||M|1", hat_1_engr: code }).cart[0].engraving.length, 24);
  // 10 hats, every one with a note and an engraving, stays under 50 keys
  const full = encodeOrderMetadata(order(...Array.from({ length: 10 }, () => ({ cordId: "stitching", cordColor: "sage", stitchingNote: "lighter", engraving: DEB }))));
  assert.ok(Object.keys(full).length <= 50, `${Object.keys(full).length} keys`);
});

test("orders written before engraving read as no engraving", () => {
  const v3 = parseCartFromMetadata({ hat_count: "1", hat_1: "v3|wool|ivory|natural|none||none||none|none||M|1" });
  const v2 = parseCartFromMetadata({ hat_count: "1", hat_1: "v2|wine|polka|none||none||red|none||L|2" });
  assert.deepEqual([v3.problems, v3.cart[0].engraving, v2.problems, v2.cart[0].engraving], [[], [], [], []]);
  const bad = parseCartFromMetadata({ hat_count: "1", hat_1: "v3|wool|ivory|none|none||none||none|none||M|1", hat_1_engr: "ls.unicorn" });
  assert.deepEqual(bad.problems, ["Hat 1: Unreadable engraving piece: ls.unicorn"]);
});

// ---- the emails ------------------------------------------------------------------------------
const sessionFor = (cart) => {
  const o = P.buildOrder(cart);
  return {
    id: "cs_test_engraving",
    payment_status: "paid",
    amount_subtotal: o.subtotal,
    amount_total: o.total,
    total_details: { amount_shipping: o.shipping },
    customer_details: { name: "Ana Ruiz", email: "ana@example.com" },
    shipping_details: { name: "Ana Ruiz", address: { line1: "1 Main", city: "El Paso", state: "TX", postal_code: "79912", country: "US" } },
    metadata: encodeOrderMetadata(o),
  };
};

test("Deborah's work order lists the engraving by position", () => {
  const rows = hatRows({ ...P.normalizeConfig({ baseId: "ivory", size: "m", engraving: DEB }), quantity: 1 });
  assert.deepEqual(rows.slice(3, 6), [
    ["Front", "DEB (Durango, large) + Longhorn (large)"],
    ["Left", "Horseshoe (small)"],
    ["Branding", "5 brands, unlimited +$10"],
  ]);
  assert.deepEqual(engravingRows([text("DEB")]).at(-1), ["Branding", "3 brands, free"]);
  assert.deepEqual(engravingRows([stamp("cactus")]).at(-1), ["Branding", "1 brand, free"]);

  const { html, text: plain } = buildOrderEmail({ session: sessionFor([{ baseId: "ivory", size: "m", quantity: 1, engraving: DEB }]), baseUrl: "https://tippincowgirl.com" });
  assert.ok(plain.includes("Front: DEB (Durango, large) + Longhorn (large)"), plain);
  assert.ok(plain.includes("Left: Horseshoe (small)") && plain.includes("Branding: 5 brands, unlimited +$10"));
  assert.ok(html.includes("DEB (Durango, large) + Longhorn (large)"));
  const customer = buildCustomerEmail({ session: sessionFor([{ baseId: "ivory", size: "m", quantity: 1, engraving: DEB }]), baseUrl: "https://tippincowgirl.com" });
  assert.ok(customer.text.includes("DEB (Durango, large) + Longhorn (large)"));
  assert.ok(!/[–—]/.test(html + plain + customer.html + customer.text), "no em or en dashes");
});

// ---- the stamp data -----------------------------------------------------------------------------
test("the generated stamp list matches public/engraving", () => {
  const json = JSON.parse(readFileSync(new URL("../public/engraving/stamps.json", import.meta.url), "utf8"));
  assert.equal(ENGRAVING_STAMPS.length, 30);
  assert.deepEqual(ENGRAVING_STAMPS.map((s) => [s.id, s.name]), json.stamps.map((s) => [s.id, s.label]));
  assert.equal(readFileSync(new URL("../src/shop/engravingStamps.js", import.meta.url), "utf8"), renderModule(buildStampData()), "run node scripts/engraving-data.mjs");
  assert.equal(readFileSync(new URL("../src/shop/engravingStampIds.js", import.meta.url), "utf8"), renderIdsModule(buildStampData()), "run node scripts/engraving-data.mjs");
  assert.deepEqual(ENGRAVING_STAMP_IDS, ENGRAVING_STAMPS.map((s) => s.id));
  for (const s of ENGRAVING_STAMPS)
    for (const size of ["small", "large"]) {
      if (BOX_OVERRIDES[s.id]) continue;
      assert.equal(Math.max(s[size].w, s[size].h), Math.max(...json.stamps.find((j) => j.id === s.id).sizeInches[size]), `${s.id} ${size}`);
    }
});

test("Olive Branch has its square box: 1.1 in large, 0.9 in small", () => {
  assert.deepEqual(stampInches("olive-branch", "large"), { w: 1.1, h: 1.1 });
  assert.deepEqual(stampInches("olive-branch", "small"), { w: 0.9, h: 0.9 });
  assert.deepEqual(Object.keys(BOX_OVERRIDES), ["olive-branch"], "the only exception");
  // the sheet is untouched: the exception lives in the script
  const json = JSON.parse(readFileSync(new URL("../public/engraving/stamps.json", import.meta.url), "utf8"));
  assert.deepEqual(json.stamps.find((s) => s.id === "olive-branch").sizeInches, { large: [1.5, 0.5], small: [1.2, 0.4] });
});

test("the calibrated anchors and widths", () => {
  assert.deepEqual(ENGRAVING_ANCHORS, {
    wool: {
      front: { x: 589, y: 674, pxPerInch: 100, rotate: 2.5, skewX: -10.5, scaleX: 0.92 },
      left: { x: 1026, y: 692, pxPerInch: 110, rotate: -21.5, skewX: -11.5, scaleX: 0.55 },
    },
    suede: {
      front: { x: 665, y: 552, pxPerInch: 100, rotate: 0.5, skewX: -5.5, scaleX: 0.89 },
      left: { x: 1078, y: 580, pxPerInch: 109, rotate: -16, skewX: -6, scaleX: 0.49 },
    },
  });
  assert.deepEqual(ENGRAVING_MAX_WIDTH, { wool: { front: 4, left: 2.5 }, suede: { front: 4, left: 2.5 } });
});

// ---- the real checkout handler ----------------------------------------------------------------------
test("checkout charges the engraving on wool and suede, and refuses straw, without Stripe for a refused hat", async () => {
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
  const post = async (cart, url = "/api/create-checkout-session", extra = {}) => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    const body = { cart, ...extra };
    const query = Object.fromEntries(new URL(url, "https://tippincowgirl.com").searchParams);
    await handler({ method: "POST", url, query, headers: { host: "tippincowgirl.com", referer: "https://tippincowgirl.com/", "content-length": String(JSON.stringify(body).length) }, body }, res);
    return res;
  };
  const charged = (p) => p.line_items.reduce((s, l) => s + l.price_data.unit_amount * l.quantity, 0);

  // 5 brands on wool: $140 + $10, the browser's own prices ignored
  let r = await post([{ baseId: "ivory", size: "m", quantity: 1, engraving: DEB.map((e) => ({ ...e, price: 0 })), price: 100, engravingPrice: 0 }]);
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(charged(calls[0]), 15000);
  assert.deepEqual(calls[0].line_items.map((l) => [l.price_data.product_data.name, l.price_data.unit_amount]), [
    ["Wool Hat: Silver Belly", 14000],
    ["Branding: Unlimited (5 brands)", 1000],
  ]);
  assert.equal(calls[0].metadata.hat_1_engr, "lt.d.DEB_ls.longhorn*ss.horseshoe");
  assert.equal(calls[0].metadata.order_total, "16200", "plus $12 shipping for one hat");

  // 4 brands: free, and no $0 line reaches Stripe
  r = await post([{ baseId: "ivory", size: "m", quantity: 1, engraving: [text("DEBS")] }]);
  assert.equal(r.code, 200);
  assert.equal(charged(calls[1]), 14000);
  assert.equal(calls[1].line_items.length, 1);
  assert.equal(calls[1].metadata.hat_1_engr, "lt.d.DEBS*");

  // suede is on sale: its engraving is charged like wool's, on the suede price
  r = await post([{ hatType: "suede", baseId: "camel", size: "s-m", quantity: 1, engraving: DEB }]);
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.deepEqual(calls[2].line_items.map((l) => [l.price_data.product_data.name, l.price_data.unit_amount]), [
    ["Faux Suede Hat: Camel", 8000],
    ["Branding: Unlimited (5 brands)", 1000],
  ]);
  assert.equal(calls[2].metadata.hat_1_engr, "lt.d.DEB_ls.longhorn*ss.horseshoe");

  // straw cannot be branded, and is not on sale: refused, preview or not
  calls.length = 0;
  r = await post([{ hatType: "straw", baseId: "cream", size: "m", quantity: 1, engraving: [stamp("cactus")] }], "/api/create-checkout-session?preview=types,engraving", { preview: "types,engraving" });
  assert.equal(r.code, 400);
  assert.ok(r.body.errors.some((e) => e.field === "engraving" && e.message === "A Straw Hat cannot be branded"));
  assert.ok(r.body.errors.some((e) => e.field === "hatType" && e.index === 0), "straw is refused for its type too");
  // a bad piece is refused too
  r = await post([{ baseId: "ivory", size: "m", quantity: 1, engraving: [stamp("unicorn")] }]);
  assert.equal(r.code, 400);
  assert.equal(calls.length, 0, "Stripe is never called for a refused hat");
});
