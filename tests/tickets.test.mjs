// Ticketed events: the form's rules, /api/tickets (seats, holds, Stripe,
// the ticket page) and the schema. The webhook side is in
// tickets-webhook.test.mjs (it needs mocked modules).
//
//   npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { HOLD_MINUTES, TICKETED_EVENTS, cleanTicketRequest, getTicketedEvent, salesOpen } from "../src/events/ticketed.js";
import { buildTicketEmail, buildTicketNotice, publicTicket } from "../api/_lib/tickets.js";
import handler from "../api/tickets.js";

const EVENT = getTicketedEvent("bring-your-boo-2026");
const BEFORE = Date.parse("2026-10-20T12:00:00-06:00");
const GOOD = { eventId: EVENT.id, name: "  Ana  Ruiz ", email: " Ana@Example.com ", phone: "915 555 0100", guestName: "Leo", quantity: 2, company: "" };

test("the event is what Deborah asked for", () => {
  assert.equal(EVENT.capacity, 20);
  assert.equal(EVENT.priceCents, 1000);
  assert.equal(EVENT.path, "/bringyourboo");
  assert.equal(new Date(EVENT.startsAt).toISOString(), "2026-10-30T00:00:00.000Z", "Oct 29, 6 PM in El Paso");
  assert.equal(new Date(EVENT.endsAt).toISOString(), "2026-10-30T03:00:00.000Z", "9 PM");
  assert.equal(salesOpen(EVENT, BEFORE), true);
  assert.equal(salesOpen(EVENT, Date.parse(EVENT.startsAt)), false, "sales close when it starts");
  assert.equal(new Set(Object.values(TICKETED_EVENTS).map((e) => e.folioPrefix)).size, Object.keys(TICKETED_EVENTS).length);
});

test("the form is cleaned and checked", () => {
  assert.deepEqual(cleanTicketRequest(GOOD, EVENT), {
    ok: true,
    value: { name: "Ana Ruiz", email: "ana@example.com", phone: "915 555 0100", guestName: "Leo", quantity: 2 },
  });
  const errs = (patch) => cleanTicketRequest({ ...GOOD, ...patch }, EVENT).errors;
  assert.deepEqual(Object.keys(errs({ name: "" })), ["name"]);
  assert.deepEqual(Object.keys(errs({ email: "ana@" })), ["email"]);
  assert.deepEqual(Object.keys(errs({ phone: "" })), ["phone"]);
  for (const q of [0, 5, 1.5, "2x", null]) assert.deepEqual(Object.keys(errs({ quantity: q })), ["quantity"], String(q));
  assert.equal(cleanTicketRequest({ ...GOOD, guestName: "" }, EVENT).value.guestName, null);
  assert.deepEqual(cleanTicketRequest({ ...GOOD, company: "bot" }, EVENT), { spam: true });
});

// ---- /api/tickets with stand ins for the database and Stripe ----------------------------------
function fakes({ remaining = 20, reserve = { ticket_id: "t-1", remaining: 18 }, stripeFails = false, row = null, sessionPaid = false } = {}) {
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      if (name === "event_tickets_remaining") return { data: remaining, error: null };
      if (name === "reserve_event_tickets") return { data: [reserve], error: null };
      if (name === "mark_event_ticket_paid") return { data: [{ ...row, status: "paid", folio: "BOO-007" }], error: null };
      return { data: null, error: { message: "unknown rpc" } };
    },
    from: (table) => {
      const q = {
        _patch: null,
        update: (patch) => ((q._patch = patch), q),
        select: () => q,
        eq: (k, v) => {
          if (q._patch) {
            calls.push({ update: table, patch: q._patch, where: [k, v] });
            q._patch = { ...q._patch, done: true };
          }
          return q;
        },
        maybeSingle: async () => ({ data: row, error: null }),
        then: (resolve) => resolve({ error: null }),
      };
      return q;
    },
  };
  const stripe = {
    checkout: {
      sessions: {
        create: async (params) => {
          calls.push({ stripe: "create", params });
          if (stripeFails) throw new Error("stripe down");
          return { id: "cs_test_abcdefghijkl", url: "https://checkout.stripe.com/c/pay/x" };
        },
        retrieve: async (id) => {
          calls.push({ stripe: "retrieve", id });
          return { id, payment_status: sessionPaid ? "paid" : "unpaid", amount_total: 2000, payment_intent: "pi_1", metadata: { kind: "event_ticket", event_id: EVENT.id, ticket_id: "t-1" } };
        },
      },
    },
  };
  return { db, stripe, calls };
}

async function call({ method = "POST", body = GOOD, query, deps }) {
  const res = {
    code: 0,
    body: null,
    headers: {},
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  await handler({ method, headers: { host: "tippincowgirl.com" }, body, query }, res, { now: BEFORE, ...deps });
  return res;
}

test("GET ?event= answers the seats left and whether sales are open", async () => {
  const f = fakes({ remaining: 7 });
  const r = await call({ method: "GET", query: { event: EVENT.id }, deps: f });
  assert.deepEqual([r.code, r.body], [200, { capacity: 20, remaining: 7, open: true }]);
  assert.deepEqual(f.calls[0], { rpc: "event_tickets_remaining", args: { p_event_id: EVENT.id, p_capacity: 20 } });
  assert.equal((await call({ method: "GET", query: { event: "nope" }, deps: f })).code, 404);
  assert.equal(r.headers["Cache-Control"], "no-store");
});

test("POST holds the seats, then starts Checkout priced from the config, never from the body", async () => {
  const f = fakes();
  const r = await call({ body: { ...GOOD, priceCents: 1, unit_amount: 1 }, deps: f });
  assert.equal(r.code, 200);
  assert.equal(r.body.url, "https://checkout.stripe.com/c/pay/x");
  const reserve = f.calls.find((c) => c.rpc === "reserve_event_tickets");
  assert.deepEqual(reserve.args, {
    p_event_id: EVENT.id,
    p_capacity: 20,
    p_quantity: 2,
    p_name: "Ana Ruiz",
    p_email: "ana@example.com",
    p_phone: "915 555 0100",
    p_guest_name: "Leo",
    p_amount_cents: 2000,
    p_hold_minutes: HOLD_MINUTES,
  });
  const { params } = f.calls.find((c) => c.stripe === "create");
  assert.deepEqual(params.line_items, [{ quantity: 2, price_data: { currency: "usd", unit_amount: 1000, product_data: { name: EVENT.stripeName } } }]);
  assert.deepEqual(params.metadata, { kind: "event_ticket", event_id: EVENT.id, ticket_id: "t-1" });
  assert.equal(params.customer_email, "ana@example.com");
  assert.equal(params.success_url, "https://tippincowgirl.com/bringyourboo/ticket?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(params.cancel_url, "https://tippincowgirl.com/bringyourboo?cancelled=1");
  const minutes = (params.expires_at - BEFORE / 1000) / 60;
  assert.ok(minutes >= 30 && minutes < HOLD_MINUTES, `checkout expires before the hold (${minutes} min)`);
  assert.deepEqual(f.calls.find((c) => c.update), { update: "event_tickets", patch: { stripe_session_id: "cs_test_abcdefghijkl" }, where: ["id", "t-1"] });
});

test("POST: sold out or not enough seats is a 409 with the seats left, and Stripe is never called", async () => {
  let f = fakes({ reserve: { ticket_id: null, remaining: 1 } });
  let r = await call({ deps: f });
  assert.deepEqual([r.code, r.body.remaining, r.body.error], [409, 1, "Only 1 spot is left."]);
  assert.ok(!f.calls.some((c) => c.stripe));
  f = fakes({ reserve: { ticket_id: null, remaining: 0 } });
  r = await call({ deps: f });
  assert.deepEqual([r.code, r.body.error], [409, "This event is sold out."]);
});

test("POST: a Stripe failure frees the hold at once", async () => {
  const f = fakes({ stripeFails: true });
  const logs = console.error;
  console.error = () => {};
  try {
    const r = await call({ deps: f });
    assert.equal(r.code, 502);
    assert.deepEqual(f.calls.find((c) => c.update)?.patch, { status: "cancelled" });
  } finally {
    console.error = logs;
  }
});

test("POST: closed sales, bad forms, bots and missing config", async () => {
  const f = fakes();
  assert.equal((await call({ deps: { ...f, now: Date.parse(EVENT.startsAt) } })).code, 410);
  const bad = await call({ body: { ...GOOD, email: "x" }, deps: f });
  assert.deepEqual([bad.code, Object.keys(bad.body.errors)], [400, ["email"]]);
  const bot = await call({ body: { ...GOOD, company: "Acme" }, deps: f });
  assert.deepEqual([bot.code, bot.body], [200, { ok: true }]);
  assert.ok(!f.calls.some((c) => c.rpc === "reserve_event_tickets"), "nothing held for bots or bad forms");
  const errs = console.error;
  console.error = () => {};
  try {
    assert.equal((await call({ deps: { db: null, stripe: f.stripe } })).code, 503);
  } finally {
    console.error = errs;
  }
});

test("GET ?session_id= shows the ticket, and asks Stripe when the webhook is late", async () => {
  const row = { id: "t-1", event_id: EVENT.id, status: "pending", folio: null, name: "Ana Ruiz", guest_name: "Leo", quantity: 2, amount_cents: 2000, internal_notes: "secret", email: "ana@example.com" };
  let f = fakes({ row, sessionPaid: true });
  let r = await call({ method: "GET", query: { session_id: "cs_test_abcdefghijkl" }, deps: f });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.ticket, { folio: "BOO-007", status: "paid", name: "Ana Ruiz", guestName: "Leo", quantity: 2, amountCents: 2000, eventId: EVENT.id, eventTitle: "Bring Your Boo: Boots, Brims & Bubbly" });
  assert.ok(!("internal_notes" in r.body.ticket) && !("email" in r.body.ticket), "nothing private in the public view");
  const paid = f.calls.find((c) => c.rpc === "mark_event_ticket_paid");
  assert.deepEqual(paid.args, { p_ticket_id: "t-1", p_session_id: "cs_test_abcdefghijkl", p_payment_intent: "pi_1", p_amount_cents: 2000, p_folio_prefix: "BOO" });

  f = fakes({ row, sessionPaid: false });
  r = await call({ method: "GET", query: { session_id: "cs_test_abcdefghijkl" }, deps: f });
  assert.equal(r.body.ticket.status, "pending");
  assert.ok(!f.calls.some((c) => c.rpc === "mark_event_ticket_paid"));

  assert.equal((await call({ method: "GET", query: { session_id: "../etc" }, deps: f })).code, 400);
  assert.equal((await call({ method: "GET", query: { session_id: "cs_test_abcdefghijkl" }, deps: fakes({ row: null }) })).code, 404);
});

test("the ticket email and Deborah's notice carry the folio and the details", () => {
  const row = { event_id: EVENT.id, folio: "BOO-003", name: "Ana <b>Ruiz</b>", guest_name: "Leo", quantity: 2, email: "ana@example.com", phone: "915", amount_cents: 2000, stripe_session_id: "cs_test_abcdefghijkl" };
  const mail = buildTicketEmail(row, { baseUrl: "https://tippincowgirl.com" });
  assert.equal(mail.subject, "Your ticket BOO-003: Bring Your Boo, Thursday, October 29");
  assert.match(mail.text, /Ticket: BOO-003/);
  assert.match(mail.text, /Admits: 2 guests \(with Leo\)/);
  assert.match(mail.text, /https:\/\/tippincowgirl\.com\/bringyourboo\/ticket\?session_id=cs_test_abcdefghijkl/);
  assert.match(mail.html, /Ana &lt;b&gt;Ruiz&lt;\/b&gt;/, "names are escaped");
  assert.doesNotMatch(mail.html + mail.text, /—/, "no em dashes");
  const notice = buildTicketNotice(row, { remaining: 12 });
  assert.match(notice.subject, /BOO-003/);
  assert.match(notice.text, /Seats left: 12 of 20/);
  assert.equal(publicTicket(null), null);
});

test("schema: the tickets table, staff rules and the two functions", () => {
  const SQL = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const part = SQL.slice(SQL.indexOf("Ticketed events (Bring Your Boo"))
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  assert.match(part, /create table if not exists public\.event_tickets/);
  assert.match(part, /alter table public\.event_tickets enable row level security;/);
  assert.match(part, /revoke all on public\.event_tickets from anon;/);
  assert.match(part, /grant update \(status, checked_in_at, internal_notes\) on public\.event_tickets to authenticated;/);
  assert.doesNotMatch(part, /grant (insert|delete|all)/);
  assert.match(part, /Only a Stripe payment can mark a ticket paid/);
  assert.match(part, /pg_advisory_xact_lock\(hashtext\('event_tickets:' \|\| p_event_id\)\)/);
  assert.match(part, /status = 'paid' or \(status = 'pending' and hold_expires_at > now\(\)\)/);
  for (const fn of ["reserve_event_tickets", "event_tickets_remaining", "mark_event_ticket_paid"]) {
    assert.match(part, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`));
    assert.match(part, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`));
  }
  assert.equal((part.match(/create policy/g) || []).length, (part.match(/drop policy if exists/g) || []).length);
  assert.equal((part.match(/create trigger/g) || []).length, (part.match(/drop trigger if exists/g) || []).length);
});
