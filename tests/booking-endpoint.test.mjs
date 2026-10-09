// POST /api/booking, the copy of each booking request kept in Supabase.
// Its own file because the Supabase client is mocked: nothing here may load
// the real one first (see webhook.test.mjs).
//
//   npm test
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { GOOD, call, fakeDb } from "./booking-fakes.mjs";

// what the mocked createClient hands back, set per test
let client = () => fakeDb();
const created = [];
mock.module("@supabase/supabase-js", { namedExports: { createClient: (...a) => (created.push(a), client()) } });
const KEY = "service-role-test";
Object.assign(process.env, { SUPABASE_URL: "https://demo.supabase.co", SUPABASE_SERVICE_ROLE_KEY: KEY });
const { default: handler } = await import("../api/booking.js");

test("the endpoint: method, size, bad JSON, honeypot and invalid fields, with nothing stored", async () => {
  created.length = 0;
  const get = await call(handler, { method: "GET" });
  assert.deepEqual([get.code, get.headers.Allow], [405, "POST"]);
  assert.equal((await call(handler, { headers: { "content-length": "9000" } })).code, 413);
  assert.equal((await call(handler, { body: "{not json" })).code, 400);
  const spam = await call(handler, { body: { ...GOOD, company: "x" } });
  assert.deepEqual([spam.code, spam.body], [200, { ok: true }], "a bot learns nothing");
  const bad = await call(handler, { body: { ...GOOD, email: "nope" } });
  assert.deepEqual([bad.code, bad.body], [400, { ok: false, errors: { email: "not a valid email" } }]);
  const long = await call(handler, { body: { ...GOOD, notes: "x".repeat(1001) } });
  assert.deepEqual([long.code, long.body.errors], [400, { notes: "longer than 1000 characters" }]);
  assert.equal(created.length, 0, "no database client for any of these");
});

test("a valid request is stored, cleaned, with the server only key", async () => {
  created.length = 0;
  const db = fakeDb();
  client = () => db;
  const ok = await call(handler, { body: JSON.stringify(GOOD) });
  assert.deepEqual([ok.code, ok.body], [200, { ok: true, stored: true, duplicate: false }], "a string body is parsed too");
  assert.deepEqual(created[0].slice(0, 2), ["https://demo.supabase.co", KEY]);
  const row = db.calls.find((c) => c.op === "insert" && c.table === "bookings").payload;
  assert.deepEqual([row.name, row.email, row.notes], ["Ana Ruiz", "ana@example.com", "10 people\n\nSaturday"]);

  client = () => fakeDb({ twin: true });
  const again = await call(handler);
  assert.deepEqual([again.code, again.body], [200, { ok: true, stored: true, duplicate: true }], "a quick resend is not a second request");
  client = () => fakeDb();
});

test("a database failure never breaks the form: 200, logged, nothing thrown", async () => {
  const logs = mock.method(console, "error", () => {});
  const warns = mock.method(console, "warn", () => {});
  try {
    const modes = {
      insert: () => fakeDb({ failInsert: "permission denied" }),
      lookup: () => fakeDb({ failLookup: "timeout" }),
      throw: () => ({
        from: () => {
          throw new Error("socket hang up");
        },
      }),
      client: () => {
        throw new Error("Invalid supabaseUrl");
      },
    };
    for (const [name, make] of Object.entries(modes)) {
      client = make;
      const r = await call(handler);
      assert.deepEqual([r.code, r.body], [200, { ok: true, stored: false }], name);
    }
    assert.equal(logs.mock.calls.length, 4);
    assert.match(String(logs.mock.calls[0].arguments[1]), /bookings insert failed: permission denied/);
    assert.match(String(logs.mock.calls[1].arguments[1]), /bookings lookup failed: timeout/);
    const printed = logs.mock.calls.flatMap((c) => c.arguments.map(String)).join(" ");
    assert.ok(!printed.includes(KEY) && !printed.includes("ana@example.com"), "no key, no customer data in the log");

    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const off = await call(handler);
    assert.deepEqual([off.code, off.body], [200, { ok: true, stored: false }], "not configured");
    assert.ok(warns.mock.calls.some((c) => /was not stored/.test(String(c.arguments[0]))));
  } finally {
    logs.mock.restore();
    warns.mock.restore();
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;
    client = () => fakeDb();
  }
});
