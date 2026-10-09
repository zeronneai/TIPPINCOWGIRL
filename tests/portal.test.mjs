// The staff portal, phase 1: the order row the webhook stores, its
// idempotency, the webhook still emailing whatever the database does, the
// security rules in supabase/schema.sql, and the demo seed's guards.
//
//   npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";

import * as P from "../src/shop/pricing.js";
import { encodeOrderMetadata } from "../src/shop/orderMetadata.js";
import { ORDER_STATUSES, buildOrderRecord } from "../src/shop/orderRecord.js";
import { saveOrder } from "../api/_lib/orders.js";
import { DEMO_EMAIL_SUFFIX, DEMO_ORDERS, demoSession } from "../scripts/seed-demo-orders.js";

const DEB = [
  { kind: "text", text: "DEB", font: "durango", size: "large", position: "front" },
  { kind: "stamp", stampId: "longhorn", size: "large", position: "front" },
  { kind: "stamp", stampId: "horseshoe", size: "small", position: "left" },
];
const CART = [
  { baseId: "ivory", featherId: "natural", cordId: "stitching", cordColor: "rust", size: "m", quantity: 1, engraving: DEB },
  { hatType: "straw", baseId: "black", cordId: "heishi", size: "l", quantity: 2 },
];
const sessionFor = (cart, extra = {}) => {
  const o = P.buildOrder(cart);
  return {
    id: "cs_test_portal_1",
    created: 1791500000,
    payment_status: "paid",
    currency: "usd",
    amount_subtotal: o.subtotal,
    amount_total: o.total,
    total_details: { amount_shipping: o.shipping },
    customer_details: { name: "Ana Ruiz", email: "ana@example.com", phone: "+19155550100" },
    shipping_details: { name: "Ana Ruiz", address: { line1: "1 Main", line2: null, city: "El Paso", state: "TX", postal_code: "79912", country: "US" } },
    metadata: encodeOrderMetadata(o),
    ...extra,
  };
};

// ---- the row ------------------------------------------------------------------------------
test("the order row: customer, address, Stripe's totals, every hat in full", () => {
  const { row, problems } = buildOrderRecord(sessionFor(CART));
  assert.deepEqual(problems, []);
  assert.equal(row.stripe_session_id, "cs_test_portal_1");
  assert.equal(row.created_at, new Date(1791500000 * 1000).toISOString());
  assert.deepEqual([row.customer_name, row.customer_email], ["Ana Ruiz", "ana@example.com"]);
  assert.deepEqual(row.shipping_address, { name: "Ana Ruiz", line1: "1 Main", line2: null, city: "El Paso", state: "TX", postal_code: "79912", country: "US", phone: "+19155550100" });
  assert.deepEqual([row.subtotal, row.shipping, row.total, row.currency, row.hat_count], [40000, 0, 40000, "usd", 3]);
  for (const k of ["status", "tracking_number", "internal_notes"]) assert.ok(!(k in row), `${k} is the staff's, never written by Stripe`);

  const [wool, straw] = row.hats;
  assert.deepEqual([wool.hat_type, wool.hat_label, wool.color, wool.size, wool.size_label, wool.quantity], ["wool", "Wool Hat", "Silver Belly", "m", "M", 1]);
  assert.deepEqual(wool.accessories.map((a) => [a.label, a.name, a.detail]), [["Feather", "Prairie Pheasant", null], ["Cord", "Saddle Stitch", "Desert Rust"]]);
  assert.deepEqual(wool.engraving, DEB);
  assert.deepEqual(wool.engraving_rows, [["Front", "DEB (Durango, large) + Longhorn (large)"], ["Left", "Horseshoe (small)"], ["Branding", "5 brands, unlimited +$10"]]);
  assert.equal(wool.brand_count, 5);
  assert.deepEqual(wool.layers, {
    base: "v1789658517/base-ivory_bcsh3a.png",
    accessories: [{ step: "feather", key: "feather-natural", z: 20 }, { step: "cord", key: "cord-stitching-rust", z: 30 }],
  });
  assert.deepEqual([wool.unit_price, wool.line_total], [21000, 21000], "$140 + $50 + $10 + $10 branding, from the catalog");
  assert.deepEqual(wool.config, P.normalizeConfig(CART[0]), "the config HatStack redraws from");
  assert.deepEqual([straw.hat_type, straw.layers.accessories[0].key, straw.quantity, straw.unit_price, straw.line_total], ["straw", "straw-cord-heishi", 2, 9500, 19000]);
});

test("money comes from what Stripe charged, never from anything else", () => {
  // a session whose metadata claims other numbers: the session's own amounts win
  const s = sessionFor(CART);
  s.metadata = { ...s.metadata, subtotal: "100", shipping: "0", order_total: "100" };
  const { row } = buildOrderRecord({ ...s, amount_subtotal: 40000, amount_total: 41200, total_details: { amount_shipping: 1200 } });
  assert.deepEqual([row.subtotal, row.shipping, row.total], [40000, 1200, 41200]);
  // the per hat price is the catalog's, whatever a line might have claimed
  const forged = sessionFor([{ ...CART[0], price: 100, unitPrice: 100 }]);
  assert.equal(buildOrderRecord(forged).row.hats[0].unit_price, 21000);
});

test("older sessions and shapes still make a row", () => {
  const collected = buildOrderRecord({ ...sessionFor(CART), shipping_details: undefined, collected_information: { shipping_details: { name: "Ana", address: { city: "Austin" } } } });
  assert.equal(collected.row.shipping_address.city, "Austin");
  const v1 = buildOrderRecord({ id: "cs_v1", amount_total: 15200, metadata: { hat_count: "1", hat_1: "chocolate|leather|star||M|1" } });
  assert.deepEqual([v1.row.hats[0].legacy, v1.row.hats[0].color, v1.row.hats[0].config, v1.row.hat_count], [true, "Chocolate", null, 1]);
  assert.deepEqual(buildOrderRecord({ id: "cs_empty" }).problems, ["No hat records were found in the session metadata."]);
});

// ---- idempotent save --------------------------------------------------------------------------
function fakeDb({ existing = false, failWith = null } = {}) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      const q = {
        upsert(row, opts) {
          calls.push({ table, op: "upsert", row, opts });
          return q;
        },
        insert(row) {
          calls.push({ table, op: "insert", row });
          return Promise.resolve({ error: null });
        },
        select() {
          if (failWith) return Promise.resolve({ data: null, error: { message: failWith } });
          return Promise.resolve({ data: existing ? [] : [{ id: "11111111-1111-1111-1111-111111111111" }], error: null });
        },
      };
      return q;
    },
  };
  return db;
}

test("saving is idempotent on stripe_session_id and never resets the staff's fields", async () => {
  const db = fakeDb();
  const first = await saveOrder(sessionFor(CART), db);
  assert.deepEqual([first.saved, first.inserted, first.id], [true, true, "11111111-1111-1111-1111-111111111111"]);
  const up = db.calls.find((c) => c.op === "upsert");
  assert.equal(up.table, "orders");
  assert.deepEqual(up.opts, { onConflict: "stripe_session_id", ignoreDuplicates: true }, "ON CONFLICT DO NOTHING");
  const ev = db.calls.find((c) => c.op === "insert");
  assert.deepEqual([ev.table, ev.row.to_status, ev.row.from_status, ev.row.actor_email], ["order_events", "new", null, "stripe"]);

  // a Stripe retry: nothing inserted, no second history row
  const again = fakeDb({ existing: true });
  const second = await saveOrder(sessionFor(CART), again);
  assert.deepEqual([second.saved, second.inserted], [true, false]);
  assert.equal(again.calls.filter((c) => c.op === "insert").length, 0);

  await assert.rejects(saveOrder(sessionFor(CART), fakeDb({ failWith: "boom" })), /orders upsert failed: boom/);
  assert.deepEqual(await saveOrder(sessionFor(CART), null), { saved: false }, "not configured: skipped");
});

// ---- the security rules ------------------------------------------------------------------------
const SQL = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const code = SQL.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").toLowerCase();

test("schema: three tables, RLS on, the statuses match the app", () => {
  for (const t of ["orders", "order_events", "staff"]) {
    assert.match(code, new RegExp(`create table if not exists public\\.${t} \\(`), t);
    assert.match(code, new RegExp(`alter table public\\.${t} enable row level security;`), `${t} RLS`);
  }
  assert.match(code, /stripe_session_id text not null unique/);
  assert.match(code, /user_id uuid primary key references auth\.users/);
  assert.match(code, /role\s+text not null default 'staff' check \(role in \('owner', 'staff'\)\)/);
  const statuses = code.match(/check \(status in \(([^)]*)\)\)/)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(statuses, ORDER_STATUSES);
  assert.match(code, /status\s+text not null default 'new'/);
});

test("schema: nobody inserts or deletes from the browser; staff update three columns", () => {
  // no policy that lets a browser session insert or delete, anywhere
  assert.doesNotMatch(code, /for (insert|delete|all)\b/);
  // every policy is for signed in users and goes through is_staff() or their own staff row
  const policies = [...code.matchAll(/create policy "[^"]+" on public\.(\w+)\s+for (\w+) to (\w+) using \(([^)]*\)?)\)/g)];
  assert.equal(policies.length, 4);
  for (const [, , , role] of policies) assert.equal(role, "authenticated");
  assert.deepEqual(policies.map((p) => `${p[1]}:${p[2]}`), ["orders:select", "orders:update", "order_events:select", "staff:select"]);
  // grants: nothing for anon; authenticated loses insert/update/delete, then gets three columns back
  assert.match(code, /revoke all on public\.orders, public\.order_events, public\.staff from anon;/);
  for (const t of ["orders", "order_events", "staff"]) assert.match(code, new RegExp(`revoke insert, update, delete, truncate on public\\.${t} from authenticated;`));
  assert.match(code, /grant update \(status, tracking_number, internal_notes\) on public\.orders to authenticated;/);
  assert.doesNotMatch(code, /grant (insert|delete|all)/);
  // the status function checks staff and asks for tracking before shipped
  assert.match(code, /if not public\.is_staff\(\) then/);
  assert.match(code, /a tracking number is required to mark an order shipped/);
  // and every status change is logged by a trigger
  assert.match(code, /after update of status on public\.orders/);
});

// ---- no secrets in the browser -----------------------------------------------------------------
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(`${dir}/${n}`).isDirectory() ? walk(`${dir}/${n}`) : [`${dir}/${n}`]));
test("the service role key is never read by client code", () => {
  const files = walk(new URL("../src", import.meta.url).pathname).filter((f) => /\.(js|jsx)$/.test(f));
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
    const body = lines.join("\n");
    assert.doesNotMatch(body, /SERVICE_ROLE|service_role/, f);
    assert.doesNotMatch(body, /process\.env/, `${f} reads process.env`);
  }
  const client = readFileSync(new URL("../src/admin/supabase.js", import.meta.url), "utf8");
  assert.match(client, /import\.meta\.env\.VITE_SUPABASE_URL/);
  assert.match(client, /import\.meta\.env\.VITE_SUPABASE_ANON_KEY/);
});

// ---- demo seed ---------------------------------------------------------------------------------
test("demo seed: six valid orders, one per status, all @demo.tippin", () => {
  assert.equal(DEMO_ORDERS.length, 6);
  assert.deepEqual(DEMO_ORDERS.map((d) => d.status).sort(), [...ORDER_STATUSES].sort());
  for (const [i, d] of DEMO_ORDERS.entries()) {
    assert.ok(d.email.endsWith(DEMO_EMAIL_SUFFIX), d.email);
    assert.deepEqual(P.validateCart(d.cart).errors, [], d.name);
    const { row, problems } = buildOrderRecord(demoSession(d, i));
    assert.deepEqual(problems, [], d.name);
    assert.ok(row.stripe_session_id.startsWith("cs_demo_"));
    assert.ok(row.customer_email.endsWith(DEMO_EMAIL_SUFFIX));
    if (d.status === "shipped" || d.status === "delivered") assert.ok(d.tracking, `${d.name} has a tracking number`);
  }
  const types = new Set(DEMO_ORDERS.flatMap((d) => d.cart.map((l) => l.hatType || "wool")));
  assert.deepEqual([...types].sort(), ["straw", "suede", "wool"]);
});

test("demo seed refuses to run in production", () => {
  const script = new URL("../scripts/seed-demo-orders.js", import.meta.url).pathname;
  const r = spawnSync(process.execPath, [script], { env: { ...process.env, NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Refusing to run: NODE_ENV is production/);
  const d = spawnSync(process.execPath, [script, "--delete"], { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8" });
  assert.equal(d.status, 1, "--delete is refused too");
});
