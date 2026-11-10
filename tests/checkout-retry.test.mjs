// Checkout keeps working if Stripe refuses the abandoned cart extras
// (promotions consent, 60 minute expiry): it retries once without them.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

test("checkout retries without the cart reminder settings when Stripe refuses them", async () => {
  const calls = [];
  mock.module("stripe", {
    defaultExport: class Stripe {
      constructor() {
        this.checkout = {
          sessions: {
            create: async (params) => {
              calls.push(params);
              if (params.consent_collection) {
                const e = new Error("You cannot collect consent to promotional communications for this account.");
                e.param = "consent_collection[promotions]";
                e.code = "parameter_invalid";
                throw e;
              }
              return { id: "cs_test_retry", url: "https://checkout.stripe.com/retry" };
            },
          },
        };
      }
    },
  });
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_x", PUBLIC_BASE_URL: "https://tippincowgirl.com" });
  const { default: handler, isReminderExtraError } = await import("../api/create-checkout-session.js");
  const body = { cart: [{ baseId: "wine", size: "m", quantity: 1 }] };
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  const errs = mock.method(console, "error", () => {});
  try {
    await handler({ method: "POST", url: "/api/create-checkout-session", query: {}, headers: { host: "tippincowgirl.com", referer: "https://tippincowgirl.com/", "content-length": String(JSON.stringify(body).length) }, body }, res);
  } finally {
    errs.mock.restore();
  }
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(res.body.url, "https://checkout.stripe.com/retry");
  assert.equal(calls.length, 2);
  assert.ok(calls[0].consent_collection && calls[0].expires_at);
  assert.equal(calls[1].consent_collection, undefined);
  assert.equal(calls[1].expires_at, undefined);
  assert.equal(calls[1].line_items.length, calls[0].line_items.length, "same order the second time");
  assert.equal(isReminderExtraError({ param: "expires_at", message: "x" }), true);
  assert.equal(isReminderExtraError({ param: "line_items[0]", message: "Invalid amount" }), false);
});
