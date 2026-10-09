// The Stripe webhook with the staff portal's database: it stores the order
// (idempotently) and still sends both emails, whatever the database does.
// Its own file so the mocked modules load before anything imports them.
//
//   npm test
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { encodeOrderMetadata } from "../src/shop/orderMetadata.js";

const CART = [
  { baseId: "ivory", featherId: "natural", size: "m", quantity: 1 },
  { hatType: "straw", baseId: "black", cordId: "heishi", size: "l", quantity: 2 },
];
const sessionFor = (cart) => {
  const o = P.buildOrder(cart);
  return {
    id: "cs_test_portal_1",
    created: 1791500000,
    payment_status: "paid",
    currency: "usd",
    amount_subtotal: o.subtotal,
    amount_total: o.total,
    total_details: { amount_shipping: o.shipping },
    customer_details: { name: "Ana Ruiz", email: "ana@example.com" },
    shipping_details: { name: "Ana Ruiz", address: { line1: "1 Main", city: "El Paso", state: "TX", postal_code: "79912", country: "US" } },
    metadata: encodeOrderMetadata(o),
  };
};

// ---- the webhook ------------------------------------------------------------------------------
test("the webhook stores the order and still sends both emails, whatever the database does", async () => {
  const sent = [];
  const stored = [];
  let dbMode = "ok";
  mock.module("stripe", {
    defaultExport: class Stripe {
      constructor() {
        this.webhooks = { constructEvent: (raw) => JSON.parse(raw.toString("utf8")) };
      }
    },
  });
  mock.module("resend", {
    namedExports: {
      Resend: class {
        constructor() {
          this.emails = { send: async (m) => (sent.push(m.to), { error: null }) };
        }
      },
    },
  });
  mock.module("@supabase/supabase-js", {
    namedExports: {
      createClient: (url, key) => {
        assert.equal(key, "service-role-test");
        return {
          from: (table) => {
            const q = {
              upsert: (row, opts) => (stored.push({ table, row, opts }), q),
              insert: async (row) => (stored.push({ table, row }), { error: null }),
              select: async () => {
                if (dbMode === "down") return { data: null, error: { message: "connection refused" } };
                return { data: dbMode === "dup" ? [] : [{ id: "22222222-2222-2222-2222-222222222222" }], error: null };
              },
            };
            return q;
          },
        };
      },
    },
  });
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    RESEND_API_KEY: "re_x",
    ORDER_NOTIFICATION_EMAIL: "orders@example.com",
    PUBLIC_BASE_URL: "https://tippincowgirl.com",
    SUPABASE_URL: "https://demo.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  });
  const { default: handler } = await import("../api/stripe-webhook.js");
  const deliver = async () => {
    const event = { type: "checkout.session.completed", data: { object: sessionFor(CART) } };
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await handler({ method: "POST", headers: { "stripe-signature": "t=1,v1=x" }, rawBody: Buffer.from(JSON.stringify(event)) }, res);
    return res;
  };
  const logs = mock.method(console, "error", () => {});
  const warns = mock.method(console, "warn", () => {});
  try {
    let r = await deliver();
    assert.deepEqual([r.code, r.body.stored, r.body.emailed, r.body.confirmed], [200, true, true, true]);
    assert.equal(stored[0].table, "orders");
    assert.equal(stored[0].row.stripe_session_id, "cs_test_portal_1");
    assert.equal(stored[0].row.total, 38000);
    assert.deepEqual(sent, ["orders@example.com", "ana@example.com"]);

    // Stripe delivers the same event again: no new order, no new history
    dbMode = "dup";
    stored.length = 0;
    r = await deliver();
    assert.equal(r.code, 200);
    assert.deepEqual(stored.map((s) => s.table), ["orders"], "upsert only, no second history row");

    // the database is down: logged, and the emails still go out
    dbMode = "down";
    sent.length = 0;
    r = await deliver();
    assert.deepEqual([r.code, r.body.stored, r.body.emailed], [200, false, true]);
    assert.deepEqual(sent, ["orders@example.com", "ana@example.com"]);
    assert.ok(logs.mock.calls.some((c) => /could not store order cs_test_portal_1/.test(String(c.arguments[0]))));

    // not configured: skipped with a warning, emails as before
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    sent.length = 0;
    r = await deliver();
    assert.deepEqual([r.code, r.body.stored, r.body.emailed], [200, false, true]);
    assert.ok(warns.mock.calls.some((c) => /order cs_test_portal_1 was not stored/.test(String(c.arguments[0]))));
  } finally {
    logs.mock.restore();
    warns.mock.restore();
  }
});

