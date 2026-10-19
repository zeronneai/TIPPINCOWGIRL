// The checkout endpoint with a promo code, Stripe and Supabase replaced by
// fakes. Its own file: the Supabase mock has to be in place before anything
// imports api/_lib/orders.js.
import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { PROMO_MESSAGES } from "../src/shop/promos.js";

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

test("checkout applies the coupon only for an eligible email, and locks the email", async () => {
  const calls = [];
  const rows = [
    { code: "GIVEAWAY10", email: "ana@mail.com", redeemed_at: null },
    { code: "GIVEAWAY10", email: "used@mail.com", redeemed_at: "2026-10-20T00:00:00Z" },
  ];
  mock.module("@supabase/supabase-js", { namedExports: { createClient: () => fakeDb(rows) } });
  mock.module("stripe", {
    defaultExport: class Stripe {
      constructor() {
        this.checkout = { sessions: { create: async (p) => (calls.push(p), { id: "cs_test_p", url: "https://checkout.stripe.com/p" }) } };
      }
    },
  });
  process.env.STRIPE_SECRET_KEY = "sk_test_recorder";
  process.env.PUBLIC_BASE_URL = "https://tippincowgirl.com";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  const { default: handler } = await import("../api/create-checkout-session.js");
  const post = async (promo) => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    const body = { cart: [{ baseId: "ivory", size: "m", quantity: 1 }], ...(promo ? { promo } : {}) };
    await handler({ method: "POST", headers: { host: "tippincowgirl.com", "content-length": String(JSON.stringify(body).length) }, body }, res);
    return res;
  };

  let r = await post(null);
  assert.equal(r.code, 200);
  assert.equal(calls[0].discounts, undefined, "no code, no discount");
  assert.equal(calls[0].metadata.promo, undefined);

  r = await post({ code: "giveaway10", email: "ANA@mail.com" });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.deepEqual(calls[1].discounts, [{ coupon: "GIVEAWAY10" }]);
  assert.equal(calls[1].customer_email, "ana@mail.com");
  assert.equal(calls[1].metadata.promo, "GIVEAWAY10");
  assert.equal(calls[1].metadata.promo_email, "ana@mail.com");
  assert.ok(Object.keys(calls[1].metadata).length <= 50);

  for (const [promo, reason] of [
    [{ code: "GIVEAWAY10", email: "stranger@mail.com" }, "not_eligible"],
    [{ code: "GIVEAWAY10", email: "used@mail.com" }, "used"],
    [{ code: "HALFOFF", email: "ana@mail.com" }, "unknown"],
    [{ code: "GIVEAWAY10", email: "" }, "bad_email"],
  ]) {
    const before = calls.length;
    r = await post(promo);
    assert.equal(r.code, 400, reason);
    assert.equal(r.body.promoReason, reason);
    assert.equal(r.body.promoError, PROMO_MESSAGES[reason]);
    assert.equal(calls.length, before, "Stripe is never called for a refused code");
  }
});

