// Phase 2, booking requests: the endpoint's validation, a database failure
// never breaking the form, the form's copy never touching the Sheet write,
// the schema's rules, the CSV import, and the demo seed.
//
//   npm test
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { BOOKING_LIMITS, BOOKING_STATUSES, cleanBooking, isoDate, saveBooking } from "../api/_lib/bookings.js";
import { mirrorBooking } from "../src/booking/mirror.js";
import { GOOD, fakeDb } from "./booking-fakes.mjs";
import { importBookings, main as importMain, parseCsv, parseSheetTimestamp, readBookings } from "../scripts/import-bookings.js";
import { DEMO_BOOKINGS, demoRows, main as seedMain } from "../scripts/seed-demo-bookings.js";

const root = fileURLToPath(new URL("..", import.meta.url));

// ---- validation ---------------------------------------------------------------------------
test("a booking is trimmed, collapsed and lower cased; blanks become null", () => {
  const r = cleanBooking(GOOD);
  assert.deepEqual(r, {
    ok: true,
    row: { name: "Ana Ruiz", email: "ana@example.com", phone: "915 555 0100", event_type: "Birthday", event_date: "2026-12-05", notes: "10 people\n\nSaturday", source: "website" },
  });
  const bare = cleanBooking({ name: "Bo", email: "bo@x.co", eventType: "Other" });
  assert.deepEqual([bare.row.phone, bare.row.event_date, bare.row.notes], [null, null, null]);
  assert.equal(cleanBooking({ ...GOOD, name: "Ana\u0000\u0007Ruiz" }).row.name, "Ana Ruiz", "control characters out");
});

test("invalid bookings are refused with the field and the reason", () => {
  const errs = (patch) => cleanBooking({ ...GOOD, ...patch }).errors;
  assert.deepEqual(errs({ name: "   " }), { name: "required" });
  assert.deepEqual(errs({ email: "" }), { email: "required" });
  for (const bad of ["ana", "ana@", "ana@example", "a b@c.com", "@example.com"]) assert.deepEqual(errs({ email: bad }), { email: "not a valid email" }, bad);
  assert.deepEqual(errs({ eventType: "" }), { eventType: "required" });
  assert.deepEqual(errs({ eventDate: "12/05/2026" }), { eventDate: "not a date (YYYY-MM-DD)" });
  assert.deepEqual(errs({ eventDate: "2026-02-30" }), { eventDate: "not a date (YYYY-MM-DD)" });
  assert.deepEqual(errs({ name: "x".repeat(BOOKING_LIMITS.name + 1) }), { name: "longer than 80 characters" });
  assert.deepEqual(errs({ email: `${"x".repeat(120)}@a.co` }), { email: "longer than 120 characters" });
  assert.deepEqual(errs({ phone: "9".repeat(41) }), { phone: "longer than 40 characters" });
  assert.deepEqual(errs({ eventType: "x".repeat(41) }), { eventType: "longer than 40 characters" });
  assert.deepEqual(errs({ notes: "x".repeat(1001) }), { notes: "longer than 1000 characters" });
  assert.equal(cleanBooking({ ...GOOD, notes: "x".repeat(1000) }).ok, true, "exactly at the cap is fine");
  assert.deepEqual(cleanBooking(null), { ok: false, errors: { name: "required", email: "required", eventType: "required" } });
  assert.deepEqual(cleanBooking({ ...GOOD, company: "Acme Bots" }), { spam: true }, "honeypot");
  assert.equal(isoDate("2028-02-29"), "2028-02-29");
  assert.equal(isoDate("2027-02-29"), null);
});

// ---- the endpoint -------------------------------------------------------------------------
test("saveBooking inserts once, writes the first history row, and folds a quick resend into the same request", async () => {
  const db = fakeDb();
  const r = await saveBooking(cleanBooking(GOOD).row, db, { now: Date.parse("2026-11-01T12:00:00Z") });
  assert.deepEqual(r, { saved: true, inserted: true, id: "b-1" });
  const lookup = db.calls.find((c) => c.op === "select");
  assert.deepEqual(lookup.filters, [["eq", "email", "ana@example.com"], ["eq", "event_type", "Birthday"], ["gte", "created_at", "2026-11-01T11:30:00.000Z"], ["eq", "event_date", "2026-12-05"]]);
  const ins = db.calls.filter((c) => c.op === "insert");
  assert.deepEqual(ins.map((c) => c.table), ["bookings", "booking_events"]);
  assert.equal(ins[0].payload.source, "website");
  assert.ok(!("status" in ins[0].payload), "status is the database default, new");
  assert.deepEqual(ins[1].payload, { booking_id: "b-1", actor_email: "website", from_status: null, to_status: "new", note: "Requested on the website" });

  const again = fakeDb({ twin: true });
  assert.deepEqual(await saveBooking(cleanBooking(GOOD).row, again), { saved: true, inserted: false, duplicate: true, id: "twin" });
  assert.equal(again.calls.filter((c) => c.op === "insert").length, 0);
  assert.deepEqual(await saveBooking(cleanBooking(GOOD).row, null), { saved: false });
});

// ---- the form: the copy is fire and forget, the Sheet write is untouched -----------------------
test("the form's copy is never awaited and never throws, whatever fetch does", async () => {
  const sent = [];
  mirrorBooking({ name: "Ana" }, (url, opts) => (sent.push([url, opts]), Promise.reject(new Error("offline"))));
  mirrorBooking({ name: "Ana" }, () => {
    throw new Error("fetch is broken");
  });
  mirrorBooking({ name: "Ana" }, () => new Promise(() => {})); // never settles
  mirrorBooking({ name: "Ana" }, null);
  assert.equal(mirrorBooking({ name: "Ana" }, () => Promise.resolve()), undefined);
  assert.deepEqual(sent[0][0], "/api/booking");
  assert.deepEqual([sent[0][1].method, sent[0][1].keepalive, sent[0][1].headers["Content-Type"]], ["POST", true, "application/json"]);
  await new Promise((r) => setTimeout(r, 10)); // an unhandled rejection would fail the run
});

test("the Sheet write in the booking form is exactly as before; the copy runs before it, unawaited", () => {
  const app = readFileSync(path.join(root, "src/App.jsx"), "utf8");
  const submit = app.slice(app.indexOf("const submit = async (e) =>"), app.indexOf("if (!open) return null;", app.indexOf("const submit")));
  // the Apps Script request, untouched: same URL, text/plain, same fields and honeypot
  assert.match(submit, /const res = await fetch\(BOOKING_ENDPOINT, \{\s*method: "POST",[\s\S]*?"Content-Type": "text\/plain;charset=utf-8"[\s\S]*?company: values\.company,\s*\}\),\s*\}\);/);
  assert.match(submit, /setStatus\("done"\)/);
  // the copy: called, not awaited, and before the Sheet request
  assert.match(submit, /\n\s*mirrorBooking\(\{/);
  assert.doesNotMatch(submit, /await mirrorBooking|mirrorBooking\([^)]*\)\.then/);
  assert.ok(submit.indexOf("mirrorBooking(") < submit.indexOf("fetch(BOOKING_ENDPOINT"));
  assert.ok(!submit.includes("/api/booking"), "the only new request goes through mirror.js");
});

// ---- the schema's rules --------------------------------------------------------------------------
const SQL = readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const phase2 = SQL.slice(SQL.indexOf("Phase 2: booking requests"))
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .toLowerCase();

test("schema: bookings and booking_events, idempotent, statuses match the portal", () => {
  assert.match(phase2, /create table if not exists public\.bookings \(/);
  assert.match(phase2, /create table if not exists public\.booking_events \(/);
  for (const col of ["created_at", "updated_at", "name", "email", "phone", "event_type", "event_date", "notes", "status", "proposed_date", "internal_notes", "source"])
    assert.match(phase2, new RegExp(`\\n\\s+${col}\\s+\\w`), col);
  assert.match(phase2, /event_date\s+date,/);
  assert.match(phase2, /proposed_date\s+date,/);
  assert.match(phase2, /source\s+text not null default 'website'/);
  assert.match(phase2, /status\s+text not null default 'new'/);
  const statuses = phase2.match(/check \(status in \(([^)]*)\)\)/)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(statuses.sort(), [...BOOKING_STATUSES].sort());
  // everything re-runnable
  assert.doesNotMatch(phase2, /create table (?!if not exists)/);
  assert.doesNotMatch(phase2, /create index (?!if not exists)/);
  assert.equal((phase2.match(/create policy/g) || []).length, (phase2.match(/drop policy if exists/g) || []).length);
  assert.equal((phase2.match(/create trigger/g) || []).length, (phase2.match(/drop trigger if exists/g) || []).length);
});

test("schema: RLS on, staff read, staff update three columns, no browser insert or delete", () => {
  for (const t of ["bookings", "booking_events"]) assert.match(phase2, new RegExp(`alter table public\\.${t} enable row level security;`));
  const policies = [...phase2.matchAll(/create policy "[^"]+" on public\.(\w+)\s+for (\w+) to (\w+) using \(([^)]*\)?)\)/g)];
  assert.deepEqual(policies.map((p) => `${p[1]}:${p[2]}:${p[3]}`), ["bookings:select:authenticated", "bookings:update:authenticated", "booking_events:select:authenticated"]);
  for (const p of policies) assert.match(p[4], /public\.is_staff\(\)/);
  assert.doesNotMatch(phase2, /for (insert|delete|all)\b/);
  assert.match(phase2, /revoke all on public\.bookings, public\.booking_events from anon;/);
  for (const t of ["bookings", "booking_events"]) assert.match(phase2, new RegExp(`revoke insert, update, delete, truncate on public\\.${t} from authenticated;`));
  assert.match(phase2, /grant update \(status, proposed_date, internal_notes\) on public\.bookings to authenticated;/);
  assert.doesNotMatch(phase2, /grant (insert|delete|all)/);
  // history by trigger, the same way as orders
  assert.match(phase2, /after update of status on public\.bookings/);
  assert.match(phase2, /insert into public\.booking_events \(booking_id, actor_email, from_status, to_status, note\)/);
  assert.match(phase2, /coalesce\(auth\.jwt\(\) ->> 'email', 'system'\)/);
  // the status function: staff only, rescheduled needs a proposed date
  assert.match(phase2, /create or replace function public\.staff_set_booking_status/);
  assert.match(phase2, /if not public\.is_staff\(\) then/);
  assert.match(phase2, /a proposed date is required to mark a booking rescheduled/);
  assert.match(phase2, /grant execute on function public\.staff_set_booking_status\(uuid, text, date, text\) to authenticated;/);
});

// ---- the CSV import ------------------------------------------------------------------------------
const CSV = [
  "Timestamp,name,email,phone,eventType,eventDate,notes",
  '14/11/2026 9:05:07,Ana Ruiz,Ana@Example.com,915-555-0100,Birthday,2026-12-05,"10 people, outdoors"',
  "1/7/2026 18:30:00,Bo Lee,,,Corporate,,",
  '3/1/2026 0:00:00,Cy Diaz,cy@x.co,,Wedding,2026-06-20,"line one\nline two ""quoted"""',
  "not a time,Dee,dee@x.co,,Other,2026-01-01,",
  "5/5/2026 10:00:00,,e@x.co,,Other,,",
  "6/5/2026 10:00:00,Fay,fay@x.co,,Other,05/06/2026,",
  '14/11/2026 9:05:07,Ana Ruiz,ana@example.com,915-555-0100,Birthday,2026-12-05,"10 people, outdoors"',
].join("\r\n");

test("CSV parsing: quotes, commas and newlines inside fields, a BOM, CRLF, blank lines", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, ""y""","1\n2"\r\n\r\n,\n'), [["a", "b"], ['x, "y"', "1\n2"]]);
  assert.deepEqual(parseCsv("a,b"), [["a", "b"]]);
});

test("Sheet timestamps are day/month/year in the Sheet's time zone, daylight saving included", () => {
  assert.equal(parseSheetTimestamp("14/11/2026 9:05:07"), "2026-11-14T16:05:07.000Z", "MST is UTC-7");
  assert.equal(parseSheetTimestamp("1/7/2026 18:30:00"), "2026-07-02T00:30:00.000Z", "MDT is UTC-6, and day 1 month 7 is July 1");
  assert.equal(parseSheetTimestamp("03/01/2026 00:00:00"), "2026-01-03T07:00:00.000Z", "3 January, not March 1");
  assert.equal(parseSheetTimestamp("14/11/2026 9:05"), "2026-11-14T16:05:00.000Z", "seconds optional");
  assert.equal(parseSheetTimestamp("14/11/2026 9:05:07", "America/Chicago"), "2026-11-14T15:05:07.000Z");
  assert.equal(parseSheetTimestamp("14/11/2026 9:05:07", "UTC"), "2026-11-14T09:05:07.000Z");
  for (const bad of ["11/14/2026 9:05:07", "31/2/2026 10:00:00", "14/11/2026", "2026-11-14 10:00:00", "14/11/2026 25:00:00", ""]) assert.equal(parseSheetTimestamp(bad), null, bad);
  assert.equal(parseSheetTimestamp("14/11/2026 9:05:07", "Mars/Olympus"), null);
});

test("CSV rows map to the table: blanks null, email lower cased, status new, source sheet-import", () => {
  const { rows, unreadable } = readBookings(CSV);
  assert.deepEqual(rows[0].row, {
    created_at: "2026-11-14T16:05:07.000Z",
    name: "Ana Ruiz",
    email: "ana@example.com",
    phone: "915-555-0100",
    event_type: "Birthday",
    event_date: "2026-12-05",
    notes: "10 people, outdoors",
    status: "new",
    source: "sheet-import",
  });
  assert.deepEqual([rows[1].row.email, rows[1].row.phone, rows[1].row.event_date, rows[1].row.notes], [null, null, null, null]);
  assert.equal(rows[2].row.notes, 'line one\nline two "quoted"');
  assert.deepEqual(unreadable, [
    { line: 5, reason: 'Timestamp "not a time" is not day/month/year hour:minute:second' },
    { line: 6, reason: "no name" },
    { line: 7, reason: 'eventDate "05/06/2026" is not YYYY-MM-DD' },
  ]);
  // columns matched by name, in any order and case
  const shuffled = readBookings("EMAIL,Notes,TimeStamp,Name\nz@x.co,hi,1/2/2026 10:00:00,Zed");
  assert.deepEqual([shuffled.rows[0].row.email, shuffled.rows[0].row.name, shuffled.rows[0].row.notes, shuffled.rows[0].row.created_at], ["z@x.co", "Zed", "hi", "2026-02-01T17:00:00.000Z"]);
  assert.throws(() => readBookings("name,email\nA,a@x.co"), /the header has no Timestamp column/);
  assert.throws(() => readBookings(""), /the file is empty/);
});

/** A stand in for bookings and booking_events that answers the import's queries. */
function memoryDb() {
  const bookings = [];
  const events = [];
  let n = 0;
  const from = (table) => {
    if (table === "booking_events") return { insert: async (row) => (events.push(...[row].flat()), { error: null }) };
    return {
      select: () => {
        const f = [];
        const q = {
          eq: (k, v) => (f.push((r) => r[k] === v), q),
          is: (k, v) => (f.push((r) => r[k] === v), q),
          limit: () => q,
          then: (resolve) => resolve({ data: bookings.filter((r) => f.every((fn) => fn(r))).map((r) => ({ id: r.id })), error: null }),
        };
        return q;
      },
      insert: (row) => ({
        select: async () => {
          const id = `b-${++n}`;
          bookings.push({ id, ...row });
          return { data: [{ id }], error: null };
        },
      }),
    };
  };
  return { bookings, events, from };
}

test("the import is idempotent: same email, event date and sent time is never inserted twice", async () => {
  const db = memoryDb();
  const log = [];
  const first = await importBookings({ csvText: CSV, db, log: (l) => log.push(l) });
  assert.deepEqual(first, { inserted: 3, existing: 1, unreadable: 3, wouldInsert: 0 }, "the repeated Ana row counts as existing");
  assert.equal(db.bookings.length, 3);
  assert.ok(log.includes("skipped line 8: the same request appears earlier in the file"));
  assert.deepEqual(db.events[0], { booking_id: "b-1", actor_email: "sheet-import", from_status: null, to_status: "new", note: "Imported from the Google Sheet", created_at: "2026-11-14T16:05:07.000Z" });

  // staff move one, then the import runs again: nothing new, nothing reset
  db.bookings[0].status = "confirmed";
  const second = await importBookings({ csvText: CSV, db, log: () => {} });
  assert.deepEqual(second, { inserted: 0, existing: 4, unreadable: 3, wouldInsert: 0 });
  assert.equal(db.bookings.length, 3);
  assert.equal(db.bookings[0].status, "confirmed");

  // a row without email or date is matched on the nulls (Bo), not inserted again
  assert.equal(db.bookings.filter((b) => b.name === "Bo Lee").length, 1);
  // the same person, another sent time: a different request
  const third = await importBookings({ csvText: `${CSV}\r\n15/11/2026 9:05:07,Ana Ruiz,ana@example.com,,Birthday,2026-12-05,`, db, log: () => {} });
  assert.equal(third.inserted, 1);
});

test("import command: first and last line, dry run touches nothing, missing env and files are explained", async () => {
  const lines = (fn) => {
    const out = [];
    const err = [];
    return { out, err, run: (opts) => fn({ out: (l) => out.push(l), err: (l) => err.push(l), ...opts }) };
  };
  const dry = lines(importMain);
  const untouchable = () => new Proxy({}, { get: () => assert.fail("the dry run touched the database") });
  assert.equal(await dry.run({ argv: ["node", "import", "--dry-run", "x.csv"], env: {}, readFile: () => CSV, connect: untouchable }), 0);
  assert.equal(dry.out[0], "Import bookings (dry run, nothing is written): reading x.csv, times in America/Denver.");
  assert.equal(dry.out.at(-1), "Dry run: 3 bookings would be inserted (any already in the portal are skipped), 3 unreadable. Nothing was written.");

  const real = lines(importMain);
  const db = memoryDb();
  const env = { SUPABASE_URL: "https://abcd.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2VjcmV0" };
  assert.equal(await real.run({ argv: ["node", "import"], env, readFile: () => CSV, connect: () => db }), 0);
  assert.equal(real.out[0], "Import bookings: reading data/bookings.csv, times in America/Denver.");
  assert.equal(real.out[1], "Supabase project: abcd.supabase.co");
  assert.equal(real.out.at(-1), "Done: 3 inserted, 4 skipped (1 already in the portal, 3 unreadable).");
  assert.ok(!real.out.join("\n").includes(env.SUPABASE_SERVICE_ROLE_KEY));

  const noFile = lines(importMain);
  assert.equal(await noFile.run({ argv: ["node", "import"], env, readFile: () => { throw Object.assign(new Error("nope"), { code: "ENOENT" }); } }), 1);
  assert.match(noFile.err[0], /^Failed: cannot read data\/bookings\.csv \(no such file\)/);

  const refused = lines(importMain);
  const failing = { from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'relation "public.bookings" does not exist', code: "42P01" } }) }) }) }) }) }) };
  assert.equal(await refused.run({ argv: ["node", "import"], env, readFile: () => CSV, connect: () => failing }), 1);
  assert.equal(refused.err[0], 'Failed: relation "public.bookings" does not exist (code 42P01)');
  const tz = lines(importMain);
  assert.equal(await tz.run({ argv: ["node", "import", "--tz=Nowhere/Land"], env, readFile: () => CSV }), 1);
  assert.match(tz.err[0], /"Nowhere\/Land" is not a time zone/);
});

// ---- spawned: never silent, on any path --------------------------------------------------------------
const bare = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT };
test("import-bookings.js and seed-demo-bookings.js run directly with no env: first line, the missing variables, exit 1", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "tippin import "));
  try {
    const csv = path.join(dir, "bookings.csv");
    writeFileSync(csv, CSV);
    const imp = spawnSync(process.execPath, [path.join(root, "scripts/import-bookings.js"), csv], { env: bare, encoding: "utf8" });
    assert.equal(imp.status, 1);
    assert.equal(imp.stdout.split("\n")[0], `Import bookings: reading ${csv}, times in America/Denver.`);
    assert.match(imp.stderr, /^Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\. .*Nothing was changed\.\n$/);
    const dry = spawnSync(process.execPath, [path.join(root, "scripts/import-bookings.js"), csv, "--dry-run"], { env: bare, encoding: "utf8" });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout.trim().split("\n").at(-1), /^Dry run: 3 bookings would be inserted/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const seed = spawnSync(process.execPath, [path.join(root, "scripts/seed-demo-bookings.js")], { env: bare, encoding: "utf8" });
  assert.equal(seed.status, 1);
  assert.match(seed.stdout, /^Seed demo bookings: adding 4 demo booking requests/);
  assert.match(seed.stderr, /^Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\./);
  const prod = spawnSync(process.execPath, [path.join(root, "scripts/seed-demo-bookings.js"), "--delete"], { env: { ...bare, NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, encoding: "utf8" });
  assert.equal(prod.status, 1);
  assert.match(prod.stderr, /Refusing to run: NODE_ENV is production/);
});

// ---- demo seed ---------------------------------------------------------------------------------------
test("demo bookings: four, different statuses, @demo.tippin, a proposed date for the rescheduled one", async () => {
  assert.equal(DEMO_BOOKINGS.length, 4);
  const rows = demoRows(Date.parse("2026-11-01T12:00:00Z"));
  assert.equal(new Set(rows.map((r) => r.status)).size, 4);
  for (const r of rows) {
    assert.ok(r.email.endsWith("@demo.tippin"));
    assert.ok(BOOKING_STATUSES.includes(r.status));
    assert.equal(r.source, "demo");
    assert.ok(cleanBooking({ name: r.name, email: r.email, eventType: r.event_type, eventDate: r.event_date }).ok, r.name);
  }
  const rescheduled = rows.find((r) => r.status === "rescheduled");
  assert.ok(rescheduled.proposed_date > rescheduled.event_date);

  const db = memoryDb();
  const out = [];
  assert.equal(await seedMain({ argv: ["node", "seed"], env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, out: (l) => out.push(l), err: () => {}, connect: () => db }), 0);
  assert.equal(out.at(-1), "Done: 4 demo bookings added, 0 already there. Remove them with: npm run seed:demo-bookings:delete");
  assert.ok(db.events.some((e) => e.to_status === "rescheduled" && /^Proposed date: /.test(e.note)));
  const again = [];
  await seedMain({ argv: ["node", "seed"], env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, out: (l) => again.push(l), err: () => {}, connect: () => db });
  assert.equal(again.at(-1), "Done: 0 demo bookings added, 4 already there. Remove them with: npm run seed:demo-bookings:delete");
  assert.equal(db.bookings.length, 4);
});

test("data/ is gitignored, so a Sheet export can never be committed", () => {
  assert.match(readFileSync(path.join(root, ".gitignore"), "utf8"), /^data\/$/m);
  const r = spawnSync("git", ["check-ignore", "-q", "data/bookings.csv"], { cwd: root });
  assert.equal(r.status, 0);
});
