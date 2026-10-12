// Private event add-ons (charcuterie, desserts): the menu's rules, what the
// endpoint stores, and the fallback when the add_ons column is missing.
//
//   npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ADDON_GROUPS, ADDON_ITEMS, addonsRecord, addonsSummary, money, normalizeAddons } from "../src/booking/addons.js";
import { cleanBooking, saveBooking } from "../api/_lib/bookings.js";
import { GOOD } from "./booking-fakes.mjs";

test("the menu matches Deborah's two menus", () => {
  const price = Object.fromEntries(ADDON_ITEMS.map((i) => [i.id, i.priceCents]));
  assert.deepEqual(price, {
    "charcuterie-cups": 1100,
    "charcuterie-boxes": 1600,
    "vintage-cake": 5000,
    cupcakes: 2000,
    "dessert-shooters": 4000,
    "chocolate-strawberries": 3500,
  });
  assert.equal(ADDON_GROUPS.find((g) => g.id === "charcuterie").minTotal, 10);
  assert.equal(new Set(ADDON_ITEMS.map((i) => i.id)).size, ADDON_ITEMS.length, "ids are unique");
  assert.equal(money(13200), "$132");
  assert.equal(money(1150), "$11.50");
});

test("a selection is cleaned: unknown ids, zeros and junk out, quantities whole and capped", () => {
  const sel = normalizeAddons({
    qty: { "charcuterie-cups": "12.7", cupcakes: 2, "free-pony": 4, "vintage-cake": 0, "dessert-shooters": -3, "chocolate-strawberries": 999 },
    quotes: ["charcuterie-board", "free-pony"],
  });
  assert.deepEqual(
    sel.items.map((i) => [i.id, i.qty, i.lineCents]),
    [
      ["charcuterie-cups", 12, 13200],
      ["cupcakes", 2, 4000],
      ["chocolate-strawberries", 20, 70000],
    ]
  );
  assert.deepEqual(sel.quotes, [{ id: "charcuterie-board", name: "A larger board instead" }]);
  assert.equal(sel.estimateCents, 13200 + 4000 + 70000);
  assert.deepEqual(sel.errors, {});
  for (const junk of [null, undefined, "x", [], { qty: [] }, { qty: { cupcakes: "abc" } }]) assert.equal(normalizeAddons(junk).empty, true, String(junk));
});

test("charcuterie has a 10 item minimum across cups and boxes; desserts have none", () => {
  assert.match(normalizeAddons({ qty: { "charcuterie-cups": 4, "charcuterie-boxes": 5 } }).errors.charcuterie, /10 item minimum \(you have 9\)/);
  assert.deepEqual(normalizeAddons({ qty: { "charcuterie-cups": 4, "charcuterie-boxes": 6 } }).errors, {});
  assert.deepEqual(normalizeAddons({ qty: { cupcakes: 1 } }).errors, {});
  assert.deepEqual(normalizeAddons({ quotes: ["charcuterie-board"] }).errors, {}, "a board quote alone is fine");
});

test("the Sheet gets one readable line", () => {
  const sel = normalizeAddons({ qty: { "charcuterie-cups": 12, cupcakes: 2 }, quotes: ["charcuterie-board"] });
  assert.equal(addonsSummary(sel), "Charcuterie Cups x 12 ($132); Cupcakes x 2 dozen ($40); A larger board instead (quote). Estimate $172");
  assert.equal(addonsSummary(normalizeAddons({})), "");
  assert.equal(addonsRecord(normalizeAddons({})), null);
});

test("the endpoint stores add-ons only when picked, priced from the menu, and refuses a short charcuterie order", () => {
  assert.ok(!("add_ons" in cleanBooking(GOOD).row), "no key at all without add-ons");
  const r = cleanBooking({ ...GOOD, addOns: { qty: { "charcuterie-boxes": 10 }, quotes: [] }, unitPriceCents: 1 });
  assert.deepEqual(r.row.add_ons, {
    items: [{ id: "charcuterie-boxes", name: "Individual Charcuterie Boxes", unit: "each", qty: 10, unitPriceCents: 1600, lineCents: 16000 }],
    quotes: [],
    estimateCents: 16000,
  });
  const short = cleanBooking({ ...GOOD, addOns: { qty: { "charcuterie-cups": 3 } } });
  assert.equal(short.ok, false);
  assert.match(short.errors.addOns, /10 item minimum/);
});

/** Bookings insert fails once with the given error, then succeeds. */
function dbMissingColumn(error) {
  const calls = [];
  let fails = 1;
  const chain = (table, op, payload) => {
    const q = {
      eq: () => q,
      is: () => q,
      gte: () => q,
      limit: () => q,
      select: () => q,
      then: (resolve) => {
        calls.push({ table, op, payload });
        if (op === "select") return resolve({ data: [], error: null });
        if (op === "insert" && table === "bookings") {
          if (fails-- > 0) return resolve({ data: null, error });
          return resolve({ data: [{ id: "b-9" }], error: null });
        }
        return resolve({ data: null, error: null });
      },
    };
    return q;
  };
  return { calls, from: (table) => ({ select: () => chain(table, "select"), insert: (row) => chain(table, "insert", row) }) };
}

test("before the add_ons migration, the booking is kept and its add-ons go into the notes", async () => {
  const row = cleanBooking({ ...GOOD, addOns: { qty: { cupcakes: 1 } } }).row;
  const db = dbMissingColumn({ code: "PGRST204", message: "Could not find the 'add_ons' column of 'bookings' in the schema cache" });
  const r = await saveBooking(row, db);
  assert.deepEqual(r, { saved: true, inserted: true, id: "b-9" });
  const inserts = db.calls.filter((c) => c.op === "insert" && c.table === "bookings");
  assert.equal(inserts.length, 2);
  assert.ok(!("add_ons" in inserts[1].payload));
  assert.equal(inserts[1].payload.notes, "10 people\n\nSaturday\n\nAdd-ons: Cupcakes x 1 dozen ($20). Estimate $20");

  // any other database error is still an error
  const other = dbMissingColumn({ code: "23505", message: "duplicate key" });
  await assert.rejects(saveBooking(row, other), /bookings insert failed/);
});

test("schema.sql adds the add_ons column so an existing project can re-run it", () => {
  const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.bookings add column if not exists add_ons jsonb;/);
});
