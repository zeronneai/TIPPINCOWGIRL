// Abandoned cart reminder: who gets it, what it says, and the webhook path
// for checkout.session.expired (Stripe and Resend replaced by fakes).
// Its own file so the mocked modules load before anything imports them.
import assert from "node:assert/strict";
import { mock, test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { encodeOrderMetadata } from "../src/shop/orderMetadata.js";
import { CART_REMINDER_SUBJECT, buildCartReminderEmail, shouldSendCartReminder } from "../src/shop/cartReminderEmail.js";

const HAT = { baseId: "cotton-candy-pink", featherId: "magenta", cordId: "rhinestone", size: "m", quantity: 1 };
const expired = (over = {}) => ({
  id: "cs_test_gone_1",
  object: "checkout.session",
  created: 1791500000,
  status: "expired",
  payment_status: "unpaid",
  customer_details: { name: "Ana Ruiz", email: "ana@example.com" },
  consent: { promotions: "opt_in" },
  metadata: encodeOrderMetadata(P.buildOrder([HAT])),
  ...over,
});

test("who gets a reminder: email, consent, a hat, not paid", () => {
  assert.deepEqual(shouldSendCartReminder(expired()), { ok: true });
  assert.equal(shouldSendCartReminder(expired({ consent: { promotions: "opt_out" } })).reason, "no email consent");
  assert.equal(shouldSendCartReminder(expired({ consent: null })).reason, "no email consent");
  assert.equal(shouldSendCartReminder(expired({ customer_details: {} })).reason, "no email");
  assert.equal(shouldSendCartReminder(expired({ payment_status: "paid" })).reason, "already paid");
  assert.equal(shouldSendCartReminder(expired({ metadata: {} })).reason, "no hats in the session");
});

test("the email: greeting, the hat, a link that rebuilds it, no dashes", () => {
  const m = buildCartReminderEmail({ session: expired(), baseUrl: "https://tippincowgirl.com" });
  assert.equal(m.subject, CART_REMINDER_SUBJECT);
  for (const out of [m.html, m.text]) {
    assert.ok(out.includes("Hi Ana,"));
    assert.ok(out.includes("Rhinestone Sass"));
    const link = `https://tippincowgirl.com/?${P.buildPermalinkQuery(HAT)}`;
    assert.ok(out.includes(out === m.html ? link.replace(/&/g, "&amp;") : link), "permalink to the same hat");
    assert.ok(/unsubscribe/i.test(out));
    assert.ok(!/[–—]/.test(out));
  }
  assert.ok(m.html.includes("FINISH MY HAT"));
  const two = buildCartReminderEmail({ session: expired({ metadata: encodeOrderMetadata(P.buildOrder([HAT, { ...HAT, baseId: "black" }])) }) });
  assert.ok(two.html.includes("Hat 2 of 2") && two.html.includes("FINISH MY HATS"));
  assert.equal(buildCartReminderEmail({ session: expired({ metadata: {} }) }), null);
});

test("the webhook sends one reminder on checkout.session.expired, and skips when it should", async () => {
  const sent = [];
  let newer = [];
  mock.module("stripe", {
    defaultExport: class Stripe {
      constructor() {
        this.webhooks = { constructEvent: (raw) => JSON.parse(raw.toString("utf8")) };
        this.checkout = { sessions: { list: async () => ({ data: newer }) } };
      }
    },
  });
  mock.module("resend", {
    namedExports: {
      Resend: class {
        constructor() {
          this.emails = { send: async (m) => (sent.push(m), { error: null }) };
        }
      },
    },
  });
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    RESEND_API_KEY: "re_x",
    ORDER_NOTIFICATION_EMAIL: "orders@example.com",
    PUBLIC_BASE_URL: "https://tippincowgirl.com",
  });
  const { default: handler } = await import("../api/stripe-webhook.js");
  const deliver = async (session) => {
    const event = { type: "checkout.session.expired", data: { object: session } };
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await handler({ method: "POST", headers: { "stripe-signature": "t=1,v1=x" }, rawBody: Buffer.from(JSON.stringify(event)) }, res);
    return res;
  };

  let r = await deliver(expired());
  assert.deepEqual([r.code, r.body.reminder], [200, true]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "ana@example.com");
  assert.equal(sent[0].replyTo, "orders@example.com");
  assert.equal(sent[0].subject, CART_REMINDER_SUBJECT);

  // no consent: nothing sent
  r = await deliver(expired({ consent: { promotions: "opt_out" } }));
  assert.deepEqual([r.code, r.body.reminder, r.body.reason], [200, false, "no email consent"]);

  // she started a newer checkout (came back, or bought): nothing sent
  newer = [{ id: "cs_test_new", created: 1791500600 }];
  r = await deliver(expired());
  assert.deepEqual([r.body.reminder, r.body.reason], [false, "newer checkout"]);

  // an event ticket is never a hat reminder
  newer = [];
  r = await deliver(expired({ metadata: { kind: "event_ticket", ticket_id: "t1", event_id: "bring-your-boo-2026" } }));
  assert.equal(r.body.reminder, false);
  assert.equal(sent.length, 1);
});
