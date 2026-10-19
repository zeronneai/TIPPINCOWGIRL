// Promo codes: the shared helpers, the allow list checks, the checkout
// endpoint (Stripe and Supabase replaced by fakes) and how a discount shows
// up in the order record and both emails.
import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { PROMOS, PROMO_MESSAGES, discountOf, findPromo, normalizeEmail, normalizePromoCode } from "../src/shop/promos.js";
import { readPromoCsv } from "../scripts/import-promo-list.js";

// ---- a tiny in-memory stand-in for the Supabase query builder ----------------------
function fakeDb(rows) {
  const table = rows;
  const client = {
    from() {
      const q = { filters: [], patch: null };
      const match = (r) => q.filters.every(([k, v, op]) => (op === "is" ? (r[k] ?? null) === v : r[k] === v));
      const api = {
        select() {
          return api;
        },
        eq(k, v) {
          q.filters.push([k, v, "eq"]);
          return api;
        },
        is(k, v) {
          q.filters.push([k, v, "is"]);
          return api;
        },
        update(patch) {
          q.patch = patch;
          return api;
        },
        async maybeSingle() {
          return { data: table.find(match) || null, error: null };
        },
        then(resolve) {
          const hit = table.filter(match);
          if (q.patch) hit.forEach((r) => Object.assign(r, q.patch));
          return resolve({ data: hit.map((r) => ({ email: r.email })), error: null });
        },
      };
      return api;
    },
  };
  return client;
}

test("codes and emails are normalized; only known codes are found", () => {
  assert.equal(normalizePromoCode("  giveaway10 "), "GIVEAWAY10");
  assert.equal(normalizePromoCode("give away10"), "GIVEAWAY10");
  assert.equal(normalizeEmail(" Ana@Mail.COM "), "ana@mail.com");
  assert.equal(findPromo("giveaway10")?.coupon, "GIVEAWAY10");
  assert.equal(findPromo("FREEHATS"), null);
  assert.ok(PROMOS.GIVEAWAY10);
});

test("discountOf reads what Stripe applied", () => {
  assert.deepEqual(discountOf({ total_details: { amount_discount: 2250 }, metadata: { promo: "GIVEAWAY10" } }), { amount: 2250, code: "GIVEAWAY10" });
  assert.deepEqual(discountOf({ total_details: { amount_discount: 0 }, metadata: {} }), { amount: 0, code: null });
  assert.deepEqual(discountOf({}), { amount: 0, code: null });
});

test("checkPromo: unknown code, bad email, not on the list, used, ok, no database", async () => {
  const { checkPromo } = await import("../api/_lib/promos.js");
  const db = fakeDb([
    { code: "GIVEAWAY10", email: "ana@mail.com", redeemed_at: null },
    { code: "GIVEAWAY10", email: "used@mail.com", redeemed_at: "2026-10-20T00:00:00Z" },
  ]);
  assert.equal((await checkPromo("NOPE", "ana@mail.com", db)).reason, "unknown");
  assert.equal((await checkPromo("GIVEAWAY10", "not an email", db)).reason, "bad_email");
  assert.equal((await checkPromo("GIVEAWAY10", "stranger@mail.com", db)).reason, "not_eligible");
  assert.equal((await checkPromo("GIVEAWAY10", "used@mail.com", db)).reason, "used");
  const ok = await checkPromo("giveaway10", " ANA@mail.com ", db);
  assert.equal(ok.ok, true);
  assert.equal(ok.email, "ana@mail.com");
  assert.equal((await checkPromo("GIVEAWAY10", "ana@mail.com", null)).reason, "unavailable");
});

test("markPromoRedeemed marks once and only an unused row", async () => {
  const { markPromoRedeemed } = await import("../api/_lib/promos.js");
  const rows = [{ code: "GIVEAWAY10", email: "ana@mail.com", redeemed_at: null }];
  const db = fakeDb(rows);
  const session = { id: "cs_test_1", metadata: { promo: "GIVEAWAY10", promo_email: "ana@mail.com" } };
  assert.deepEqual(await markPromoRedeemed(session, db), { marked: true });
  assert.ok(rows[0].redeemed_at);
  assert.equal(rows[0].redeemed_session, "cs_test_1");
  const again = await markPromoRedeemed({ ...session, id: "cs_test_2" }, db);
  assert.equal(again.marked, false);
  assert.equal(rows[0].redeemed_session, "cs_test_1", "a retry or second use never moves it");
  assert.equal((await markPromoRedeemed({ id: "x", metadata: {} }, db)).marked, false);
});

test("the giveaway CSV: email column found by name, duplicates and bad rows skipped", () => {
  const csv = 'Timestamp,Full Name,Email Address,Phone\n1,Ana,ANA@mail.com,1\n2,Bea,bea@mail.com,2\n3,Ana again,ana@mail.com ,3\n4,No mail,,4\n';
  const { rows, skipped } = readPromoCsv(csv);
  assert.deepEqual(rows, [{ email: "ana@mail.com", name: "Ana" }, { email: "bea@mail.com", name: "Bea" }]);
  assert.deepEqual(skipped.map((s) => s.line), [4, 5]);
  assert.match(readPromoCsv("name,phone\nA,1\n").error, /email/);
});

test("a discount shows in the order record and in both emails; none means no line", async () => {
  const { buildOrderRecord } = await import("../src/shop/orderRecord.js");
  const { buildOrderEmail } = await import("../src/shop/orderEmail.js");
  const { buildCustomerEmail } = await import("../src/shop/customerEmail.js");
  const { buildOrder } = await import("../src/shop/pricing.js");
  const { encodeOrderMetadata } = await import("../src/shop/orderMetadata.js");
  const order = buildOrder([{ baseId: "ivory", size: "m", quantity: 1 }]);
  const base = {
    id: "cs_test_d",
    amount_subtotal: order.subtotal,
    customer_details: { name: "Ana", email: "ana@mail.com", address: { line1: "1 Main", city: "El Paso", state: "TX", postal_code: "79912", country: "US" } },
    metadata: encodeOrderMetadata(order),
  };
  const withDiscount = {
    ...base,
    amount_total: order.subtotal - 1400 + order.shipping,
    total_details: { amount_shipping: order.shipping, amount_discount: 1400 },
    metadata: { ...base.metadata, promo: "GIVEAWAY10", promo_email: "ana@mail.com" },
  };
  const { row } = buildOrderRecord(withDiscount);
  assert.equal(row.discount, 1400);
  assert.equal(row.promo_code, "GIVEAWAY10");
  const plain = buildOrderRecord({ ...base, amount_total: order.total, total_details: { amount_shipping: order.shipping } }).row;
  assert.ok(!("discount" in plain) && !("promo_code" in plain), "an order without a promo writes no new columns");

  const o = buildOrderEmail({ session: withDiscount, baseUrl: "https://tippincowgirl.com" });
  const c = buildCustomerEmail({ session: withDiscount });
  for (const out of [o.html, o.text, c.html, c.text]) {
    assert.ok(out.includes("Discount (GIVEAWAY10)"), "discount line present");
    assert.ok(out.includes("-$14"), "discount amount present");
  }
  const o2 = buildOrderEmail({ session: { ...base, amount_total: order.total, total_details: { amount_shipping: order.shipping } }, baseUrl: "" });
  assert.ok(!o2.text.includes("Discount"));
  assert.ok(!/[–—]/.test(o.html + o.text + c.html + c.text));
});
