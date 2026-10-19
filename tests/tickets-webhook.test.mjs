// The Stripe webhook with a ticket checkout: it records the ticket (folio),
// emails the buyer and Deborah, and never treats it as a hat order.
// Its own file so the mocked modules load before anything imports them.
//
//   npm test
import assert from "node:assert/strict";
import { mock, test } from "node:test";

test("a paid ticket is marked paid with its folio, emailed, and never stored as a hat order", async () => {
  const sent = [];
  const rpcs = [];
  const tables = [];
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
          this.emails = { send: async (m) => (sent.push({ to: m.to, subject: m.subject }), { error: null }) };
        }
      },
    },
  });
  mock.module("@supabase/supabase-js", {
    namedExports: {
      createClient: () => ({
        rpc: async (name, args) => {
          rpcs.push({ name, args });
          if (name === "mark_event_ticket_paid")
            return {
              data: [{ id: "t-1", event_id: "bring-your-boo-2026", status: "paid", folio: "BOO-004", name: "Ana Ruiz", guest_name: "Leo", quantity: 2, email: "ana@example.com", phone: "915", amount_cents: 2000, stripe_session_id: "cs_test_ticket_1" }],
              error: null,
            };
          if (name === "event_tickets_remaining") return { data: 12, error: null };
          return { data: null, error: null };
        },
        from: (table) => {
          tables.push(table);
          const q = { upsert: () => q, insert: async () => ({ error: null }), select: async () => ({ data: [], error: null }) };
          return q;
        },
      }),
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
  const session = {
    id: "cs_test_ticket_1",
    payment_status: "paid",
    amount_total: 2000,
    payment_intent: "pi_123",
    customer_details: { email: "ana@example.com" },
    metadata: { kind: "event_ticket", event_id: "bring-your-boo-2026", ticket_id: "t-1" },
  };
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  await handler({ method: "POST", headers: { "stripe-signature": "t=1,v1=x" }, rawBody: Buffer.from(JSON.stringify({ type: "checkout.session.completed", data: { object: session } })) }, res);

  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { received: true, ticket: "BOO-004", emailed: true, notified: true });
  assert.deepEqual(rpcs[0], { name: "mark_event_ticket_paid", args: { p_ticket_id: "t-1", p_session_id: "cs_test_ticket_1", p_payment_intent: "pi_123", p_amount_cents: 2000, p_folio_prefix: "BOO" } });
  assert.ok(!tables.includes("orders"), "no hat order row");
  assert.deepEqual(sent.map((m) => m.to), ["ana@example.com", "orders@example.com"]);
  assert.match(sent[0].subject, /^Your ticket BOO-004/);
  assert.match(sent[1].subject, /^New ticket BOO-004/);
});
