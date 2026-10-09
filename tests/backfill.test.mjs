// scripts/backfill-orders.js with Stripe and Supabase replaced by fakes:
// running it twice never duplicates or resets an order, bad metadata is
// skipped and reported, a dry run writes nothing, and nothing is emailed.
//
//   npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { encodeOrderMetadata } from "../src/shop/orderMetadata.js";
import { buildOrderRecord } from "../src/shop/orderRecord.js";
import { backfill, paidSessions, skipReason } from "../scripts/backfill-orders.js";

const session = (id, cart, extra = {}) => {
  const o = P.buildOrder(cart);
  return {
    id,
    created: 1790000000 + Number(id.replace(/\D/g, "") || 0) * 3600,
    status: "complete",
    payment_status: "paid",
    currency: "usd",
    amount_subtotal: o.subtotal,
    amount_total: o.total,
    total_details: { amount_shipping: o.shipping },
    customer_details: { name: `Customer ${id}`, email: `${id}@example.com` },
    shipping_details: { name: `Customer ${id}`, address: { line1: "1 Main", city: "El Paso", state: "TX", postal_code: "79912", country: "US" } },
    metadata: encodeOrderMetadata(o),
    ...extra,
  };
};

const GOOD = [
  session("cs_1", [{ baseId: "ivory", featherId: "natural", size: "m", quantity: 1 }]),
  session("cs_2", [{ hatType: "suede", baseId: "camel", cordId: "heishi", size: "s-m", quantity: 2 }]),
  session("cs_3", [{ hatType: "straw", baseId: "black", size: "l", quantity: 1 }]),
];
const BAD = [
  session("cs_4", [{ baseId: "ivory", size: "m", quantity: 1 }], { metadata: {} }), // a checkout from somewhere else
  session("cs_5", [{ baseId: "ivory", size: "m", quantity: 1 }], { metadata: { hat_count: "1", hat_1: "v3|garbage" } }),
];
const UNPAID = session("cs_6", [{ baseId: "ivory", size: "m", quantity: 1 }], { payment_status: "unpaid" });

/** Stripe's list: auto paginating, so the script must just iterate it. */
function fakeStripe(sessions) {
  const calls = [];
  return {
    calls,
    checkout: {
      sessions: {
        list(params) {
          calls.push(params);
          return {
            async *[Symbol.asyncIterator]() {
              // three "pages", to be sure every one is read
              for (let i = 0; i < sessions.length; i += 2) for (const s of sessions.slice(i, i + 2)) yield s;
            },
          };
        },
      },
    },
  };
}

/** A tiny stateful stand in for the orders and order_events tables. */
function fakeDb() {
  const orders = new Map();
  const events = [];
  let n = 0;
  return {
    orders,
    events,
    from(table) {
      let pending = null;
      const q = {
        upsert(row, opts) {
          assert.deepEqual(opts, { onConflict: "stripe_session_id", ignoreDuplicates: true });
          pending = row;
          return q;
        },
        async select() {
          if (orders.has(pending.stripe_session_id)) return { data: [], error: null }; // DO NOTHING
          const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
          orders.set(pending.stripe_session_id, { id, ...pending, status: "new", tracking_number: null, internal_notes: null });
          return { data: [{ id }], error: null };
        },
        async insert(row) {
          assert.equal(table, "order_events");
          events.push(row);
          return { error: null };
        },
      };
      return q;
    },
  };
}

test("only paid sessions, through every page Stripe returns", async () => {
  const stripe = fakeStripe([...GOOD, UNPAID, ...BAD]);
  const ids = [];
  for await (const s of paidSessions(stripe)) ids.push(s.id);
  assert.deepEqual(ids, ["cs_1", "cs_2", "cs_3", "cs_4", "cs_5"]);
  assert.deepEqual(stripe.calls, [{ limit: 100, status: "complete" }]);
});

test("running it twice inserts once and never resets status, tracking or notes", async () => {
  const db = fakeDb();
  const out = [];
  const first = await backfill({ stripe: fakeStripe([...GOOD, UNPAID]), db, log: (l) => out.push(l) });
  assert.deepEqual([first.inserted, first.existed, first.skipped], [3, 0, 0]);
  assert.equal(db.orders.size, 3);
  assert.equal(out.at(-1), "Done: 3 inserted, 0 already existed, 0 skipped.");

  // the snapshot is the webhook's own, field for field
  assert.deepEqual(
    (({ id, status, tracking_number, internal_notes, ...rest }) => rest)(db.orders.get("cs_2")),
    buildOrderRecord(GOOD[1]).row
  );
  // first history row, dated at the payment and marked as backfilled
  assert.equal(db.events.length, 3);
  assert.deepEqual(db.events[0], {
    order_id: db.orders.get("cs_1").id,
    actor_email: "stripe",
    from_status: null,
    to_status: "new",
    note: "Paid on Stripe (added by the backfill)",
    created_at: new Date(GOOD[0].created * 1000).toISOString(),
  });

  // staff work on an order, then the backfill runs again
  Object.assign(db.orders.get("cs_1"), { status: "shipped", tracking_number: "9400 1", internal_notes: "gift" });
  const again = [];
  const second = await backfill({ stripe: fakeStripe([...GOOD, UNPAID]), db, log: (l) => again.push(l) });
  assert.deepEqual([second.inserted, second.existed, second.skipped], [0, 3, 0]);
  assert.equal(db.orders.size, 3, "no duplicates");
  assert.equal(db.events.length, 3, "no second history row");
  assert.deepEqual(
    [db.orders.get("cs_1").status, db.orders.get("cs_1").tracking_number, db.orders.get("cs_1").internal_notes],
    ["shipped", "9400 1", "gift"]
  );
  assert.equal(again.at(-1), "Done: 0 inserted, 3 already existed, 0 skipped.");
});

test("bad or missing metadata is skipped, reported with its reason, and the run carries on", async () => {
  const db = fakeDb();
  const out = [];
  // bad ones first and in the middle: everything after them must still go in
  const totals = await backfill({ stripe: fakeStripe([BAD[0], GOOD[0], BAD[1], GOOD[1], GOOD[2]]), db, log: (l) => out.push(l) });
  assert.deepEqual([totals.inserted, totals.existed, totals.skipped], [3, 0, 2]);
  assert.deepEqual([...db.orders.keys()], ["cs_1", "cs_2", "cs_3"]);
  assert.ok(out.includes("skipped cs_4: No hat records were found in the session metadata."), out.join("\n"));
  assert.ok(out.some((l) => l.startsWith("skipped cs_5: Hat 1 could not be read")), out.join("\n"));
  assert.equal(out.at(-1), "Done: 3 inserted, 0 already existed, 2 skipped.");

  assert.equal(skipReason(GOOD[0]), null);
  assert.equal(skipReason({ ...GOOD[0], id: undefined }), "no session id");

  // a database refusal is a skip too, and the next session is still tried
  let calls = 0;
  const flaky = fakeDb();
  const from = flaky.from.bind(flaky);
  flaky.from = (table) => {
    const q = from(table);
    if (table === "orders" && ++calls === 1) q.select = async () => ({ data: null, error: { message: "timeout" } });
    return q;
  };
  const log = [];
  const t = await backfill({ stripe: fakeStripe(GOOD), db: flaky, log: (l) => log.push(l) });
  assert.deepEqual([t.inserted, t.skipped], [2, 1]);
  assert.ok(log.includes("skipped cs_1: the database refused it (orders upsert failed: timeout)"), log.join("\n"));
});

test("--dry-run prints the count and one line each, and never touches the database", async () => {
  const untouchable = new Proxy({}, { get: () => assert.fail("the dry run touched the database") });
  const out = [];
  const t = await backfill({ stripe: fakeStripe([...GOOD, BAD[0]]), db: untouchable, dryRun: true, log: (l) => out.push(l) });
  assert.deepEqual([t.wouldInsert, t.skipped, t.inserted], [3, 1, 0]);
  assert.equal(out[1], "Dry run: 3 paid orders would be inserted (any already stored are left untouched), 1 skipped. Nothing was written.");
  assert.equal(out[2], `  ${new Date(GOOD[0].created * 1000).toISOString().slice(0, 10)}  Customer cs_1  $202.00  (cs_1)`);
  assert.equal(out.length, 5);
});

test("it sends no email and prints no key", () => {
  const src = readFileSync(new URL("../scripts/backfill-orders.js", import.meta.url), "utf8");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /resend|orderEmail|customerEmail|emails\.send/i);
  // the only env values used are passed to the clients, never to a log line
  for (const line of code.split("\n").filter((l) => /console\.(log|error|warn)|log\(/.test(l))) {
    assert.doesNotMatch(line, /process\.env\.(STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL)\b(?!\.startsWith)/, line);
  }
});
