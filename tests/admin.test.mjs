// The redesigned staff portal: contact links and message templates, the
// dashboard's numbers, the demo filter, the admin code staying in its own
// chunk, and the favicon set.
//
//   npm test
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { bookingTemplates, firstName, mailtoLink, orderTemplates, telLink, whatsappLink, whatsappNumber } from "../src/admin/contact.js";
import { addDays, addMonths, bookingDay, excludeDemo, isDemoEmail } from "../src/admin/format.js";
import { activity, attention, bookingMonths, eventTypes, kpis, niceMax, orderStatusCounts, weekly, withDemo } from "../src/admin/stats.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(path.join(root, p), "utf8");
const DASHES = /[\u2013\u2014]/;

// ---- contact ----------------------------------------------------------------------------
test("WhatsApp numbers: digits only, 10 digits get the US code, bad numbers are refused", () => {
  const ok = {
    "(915) 555-0141": "19155550141",
    "915.555.0150": "19155550150",
    "9155550123": "19155550123",
    "+1 915 555 0100": "19155550100",
    "1-915-555-0100": "19155550100",
    "52 656 123 4567": "526561234567",
    "+52 1 656 123 4567": "5216561234567",
    "0052 656 123 4567": "526561234567",
    "+44 20 7946 0958": "442079460958",
  };
  for (const [raw, want] of Object.entries(ok)) assert.equal(whatsappNumber(raw), want, raw);
  for (const bad of [null, undefined, "", "   ", "abc", "555", "12345", "555-0141", "0155550100", "1155550100", "1-015-555-0100", "1234567890123456", "0044 20"])
    assert.equal(whatsappNumber(bad), null, String(bad));
});

test("links: wa.me with the text encoded, tel and mailto, or nothing when unusable", () => {
  assert.equal(whatsappLink("(915) 555-0141", "Hi Ana! See you Saturday & Sunday?\n\nT"), "https://wa.me/19155550141?text=Hi%20Ana!%20See%20you%20Saturday%20%26%20Sunday%3F%0A%0AT");
  assert.equal(whatsappLink("(915) 555-0141"), "https://wa.me/19155550141");
  assert.equal(whatsappLink("12345", "hi"), null);
  assert.equal(telLink("(915) 555-0141"), "tel:9155550141");
  assert.equal(telLink("+44 20 7946 0958"), "tel:+442079460958");
  assert.equal(telLink("12345"), null);
  assert.equal(telLink(null), null);
  assert.equal(mailtoLink("ana@example.com", "Your booking", "Line 1\nA & B"), "mailto:ana@example.com?subject=Your%20booking&body=Line%201%0AA%20%26%20B");
  assert.equal(mailtoLink("ana@example.com"), "mailto:ana@example.com");
  for (const bad of [null, "", "ana", "ana@example", "a b@c.com"]) assert.equal(mailtoLink(bad, "s", "b"), null, String(bad));
});

test("first names: trimmed and capitalized, a friendly fallback", () => {
  assert.equal(firstName("  ana maría RUIZ "), "Ana");
  assert.equal(firstName("JASMINE"), "Jasmine");
  assert.equal(firstName(""), "there");
  assert.equal(firstName(null), "there");
});

test("booking templates: first name, event type and dates filled in; proposed date when there is one", () => {
  const b = { name: "jasmine ortega", event_type: "Bachelorette", event_date: "2026-10-12", proposed_date: null };
  const [confirm, decline, propose] = bookingTemplates(b);
  assert.deepEqual([confirm.id, decline.id, propose.id], ["confirm", "decline", "propose"]);
  assert.deepEqual([confirm.title, decline.title, propose.title], ["Confirm", "Decline politely", "Propose a new date"]);
  assert.match(confirm.text, /^Hi Jasmine! Thank you for booking Tippin' Cowgirl\. Your bachelorette hat bar on Monday, October 12 is confirmed\./);
  assert.match(decline.text, /^Hi Jasmine, thank you so much for thinking of Tippin' Cowgirl for your bachelorette on Monday, October 12\. Unfortunately/);
  assert.match(propose.text, /Could you share a few other dates/);
  const withDate = bookingTemplates({ ...b, proposed_date: "2026-10-24" })[2];
  assert.match(withDate.text, /we could bring the hat bar on Saturday, October 24\. Would that work for you\?/);
  assert.match(bookingTemplates({ name: "Bo", event_type: "Pop-up / Market" })[0].text, /Your pop-up hat bar is confirmed/);
  assert.match(bookingTemplates({ name: "Bo", event_type: "Other" })[1].text, /for your event\. Unfortunately/);
  assert.match(bookingTemplates({ name: "", event_type: null })[0].text, /^Hi there!/);
  for (const t of bookingTemplates({ ...b, proposed_date: "2026-10-24" })) {
    assert.ok(t.subject && !DASHES.test(t.subject + t.text), t.id);
    assert.match(t.text, /\n\nTippin' Cowgirl$/);
  }
});

test("order templates: the hats, and the tracking number only when there is one", () => {
  const o = {
    customer_name: "Hannah Brooks",
    hat_count: 2,
    hats: [
      { color: "Black", hat_label: "Wool Hat", quantity: 1 },
      { color: "Ivory", hat_label: "Straw Hat", quantity: 1 },
    ],
    tracking_number: "1Z999AA10123456784",
  };
  const [production, shipped, pickup] = orderTemplates(o);
  assert.deepEqual([production.title, shipped.title, pickup.title], ["Order is in production", "Order shipped", "Ready for pickup"]);
  assert.match(production.text, /^Hi Hannah! Your Tippin' Cowgirl order, 2 hats \(Black Wool Hat, Ivory Straw Hat\), is now in production\./);
  assert.match(shipped.text, /has shipped\. Your tracking number is 1Z999AA10123456784\./);
  assert.match(pickup.text, /is ready for pickup\./);
  assert.doesNotMatch(orderTemplates({ ...o, tracking_number: "  " })[1].text, /tracking/);
  assert.match(orderTemplates({ customer_name: "Bo", hat_count: 1, hats: [] })[0].text, /order, 1 hat, is now/);
  for (const t of orderTemplates(o)) assert.ok(!DASHES.test(t.subject + t.text), t.id);
});

// ---- dashboard numbers -------------------------------------------------------------------------
const H = 3600000;
const D = 24 * H;
const NOW = new Date(2026, 9, 14, 12, 0, 0).getTime(); // Wednesday, October 14, local time
const at = (ms) => new Date(NOW - ms).toISOString();
const ORDERS = [
  { id: "o1", created_at: at(2 * H), customer_name: "A", customer_email: "a@x.co", status: "new", total: 21200, currency: "usd" },
  { id: "o2", created_at: at(8 * D), customer_name: "B", customer_email: "b@x.co", status: "in_production", total: 32000, currency: "usd" },
  { id: "o3", created_at: at(6 * D), customer_name: "C", customer_email: "c@x.co", status: "new", total: 10000, currency: "usd" },
  { id: "o4", created_at: at(3 * D), customer_name: "D", customer_email: "d@x.co", status: "cancelled", total: 99900, currency: "usd" },
  { id: "o5", created_at: at(20 * D), customer_name: "E", customer_email: "e@x.co", status: "ready", total: 15000, currency: "usd" },
  { id: "o6", created_at: at(40 * D), customer_name: "F", customer_email: "f@x.co", status: "delivered", total: 22700, currency: "usd" },
  { id: "o7", created_at: at(200 * D), customer_name: "G", customer_email: "g@x.co", status: "delivered", total: 5000, currency: "usd" },
  { id: "od", created_at: at(1 * D), customer_name: "Demo", customer_email: "Dana@Demo.Tippin", status: "new", total: 40000, currency: "usd" },
];
const BOOKINGS = [
  { id: "b1", created_at: at(25 * H), name: "Jas", email: "j@x.co", event_type: "Bachelorette", event_date: "2026-10-20", proposed_date: null, status: "new" },
  { id: "b2", created_at: at(23 * H), name: "Mo", email: "m@x.co", event_type: "Birthday", event_date: "2026-11-30", proposed_date: null, status: "new" },
  { id: "b3", created_at: at(3 * D), name: "Sof", email: "s@x.co", event_type: "Birthday", event_date: "2026-10-16", proposed_date: "2027-01-09", status: "rescheduled" },
  { id: "b4", created_at: at(3 * D), name: "Tay", email: null, event_type: "Wedding", event_date: "2026-10-18", proposed_date: null, status: "declined" },
  { id: "b5", created_at: at(9 * D), name: "Rae", email: "r@x.co", event_type: "Corporate", event_date: "2026-11-13", proposed_date: null, status: "confirmed" },
  { id: "b6", created_at: at(9 * D), name: "Old", email: "o@x.co", event_type: "", event_date: "2026-09-01", proposed_date: null, status: "completed" },
  { id: "bd", created_at: at(5 * D), name: "Demo", email: "x@demo.tippin", event_type: "Corporate", event_date: "2026-10-22", proposed_date: null, status: "new" },
];

test("demo rows: matched by the email ending, case blind, and dropped unless wanted", () => {
  assert.ok(isDemoEmail("Dana@Demo.Tippin"));
  assert.ok(!isDemoEmail("demo.tippin@example.com"));
  assert.ok(!isDemoEmail(null));
  const off = withDemo({ orders: ORDERS, bookings: BOOKINGS }, false);
  assert.deepEqual([off.orders.length, off.bookings.length], [7, 6]);
  assert.deepEqual(withDemo({ orders: ORDERS, bookings: BOOKINGS }, true).orders.length, 8);
  // the query filter keeps rows with no email
  const calls = [];
  excludeDemo({ or: (s) => (calls.push(s), "q") }, "customer_email");
  assert.deepEqual(calls, ["customer_email.is.null,customer_email.not.ilike.*@demo.tippin"]);
});

test("KPIs: new, in production, this month's revenue without cancelled, new bookings, next 30 days", () => {
  const { orders, bookings } = withDemo({ orders: ORDERS, bookings: BOOKINGS }, false);
  const k = kpis({ orders, bookings, now: NOW });
  assert.equal(k.newOrders, 2);
  assert.equal(k.inProduction, 1);
  // October: o1, o2, o3 (o4 cancelled, o5 is September 24)
  assert.equal(k.revenueMonth, 21200 + 32000 + 10000);
  assert.equal(k.ordersMonth, 3);
  assert.equal(k.monthLabel, "October");
  assert.equal(k.newBookings, 2);
  // b1 Oct 20, b5 Nov 13 (30 days: up to Nov 13); b3 moved to January; b4 declined; b2 too far
  assert.equal(k.upcomingEvents, 2);
  assert.equal(k.upcomingConfirmed, 1);
  assert.equal(kpis({ ...withDemo({ orders: ORDERS, bookings: BOOKINGS }, true), now: NOW }).newOrders, 3);
});

test("needs attention: bookings New past 24 hours, orders New or In production past 7 days, oldest first", () => {
  const { orders, bookings } = withDemo({ orders: ORDERS, bookings: BOOKINGS }, false);
  const a = attention({ orders, bookings, now: NOW });
  assert.deepEqual(
    a.map((x) => x.id),
    ["o2", "b1"]
  );
  assert.equal(a[0].href, "/admin/orders/o2");
  assert.equal(a[1].href, "/admin/bookings/b1");
  // o3 is New for 6 days, b2 for 23 hours, o5 is Ready: none of them yet
  assert.deepEqual(attention({ orders: [{ ...ORDERS[2], created_at: at(7 * D + H) }], bookings: [], now: NOW }).length, 1);
});

test("weekly: twelve Monday weeks, oldest first, cancelled left out", () => {
  const w = weekly({ orders: ORDERS, now: NOW });
  assert.equal(w.length, 12);
  assert.equal(new Date(`${w[11].key}T00:00:00`).getDay(), 1, "weeks start on Monday");
  assert.equal(w[11].key, "2026-10-12");
  assert.deepEqual([w[11].orders, w[11].revenue], [2, 21200 + 40000]); // o1 and the demo order, both this week
  assert.deepEqual([w[10].orders, w[10].revenue], [2, 32000 + 10000]); // o2 (Oct 6) and o3 (Oct 8); o4 cancelled
  assert.equal(w.reduce((s, x) => s + x.orders, 0), 6, "o7 is older than 12 weeks");
});

test("bookings by month: the next 12 months by the expected day, declined left out", () => {
  const m = bookingMonths({ bookings: BOOKINGS, now: NOW });
  assert.equal(m.length, 12);
  assert.deepEqual(m.slice(0, 4).map((x) => [x.key, x.value]), [["2026-10", 2], ["2026-11", 2], ["2026-12", 0], ["2027-01", 1]]);
  assert.equal(m[0].label, "Oct");
  assert.equal(bookingDay(BOOKINGS[2]), "2027-01-09");
  assert.equal(bookingDay({ status: "confirmed", event_date: "2026-10-16", proposed_date: "2027-01-09" }), "2026-10-16");
});

test("event types, statuses and the activity feed", () => {
  assert.deepEqual(eventTypes(BOOKINGS.slice(0, 6)), [
    { label: "Birthday", value: 2 },
    { label: "Bachelorette", value: 1 },
    { label: "Corporate", value: 1 },
    { label: "Not given", value: 1 },
    { label: "Wedding", value: 1 },
  ]);
  assert.deepEqual(
    orderStatusCounts(ORDERS).map((s) => s.value),
    [3, 1, 1, 0, 2, 1]
  );
  const { orders, bookings } = withDemo({ orders: ORDERS, bookings: BOOKINGS }, false);
  const feed = activity({
    orderEvents: [
      { id: 1, order_id: "o2", created_at: at(1 * D), actor_email: "deb@x.co", from_status: "new", to_status: "in_production", note: null },
      { id: 2, order_id: "od", created_at: at(1 * H), actor_email: "deb@x.co", from_status: "new", to_status: "ready", note: null },
    ],
    bookingEvents: [{ id: 9, booking_id: "b5", created_at: at(2 * H), actor_email: null, from_status: "new", to_status: "confirmed", note: "Deposit in" }],
    orders,
    bookings,
  });
  assert.deepEqual(
    feed.map((e) => [e.kind, e.name, e.who, e.to]),
    [
      ["booking", "Rae", "system", "confirmed"],
      ["order", "B", "deb@x.co", "in_production"],
    ],
    "newest first, the hidden demo order's change left out"
  );
});

test("dates and axes", () => {
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.deepEqual([0, 3, 5, 9, 12, 390, 42000, 61200].map(niceMax), [4, 4, 6, 10, 20, 400, 60000, 80000]);
});

// ---- the admin code stays in the /admin chunk -----------------------------------------------------
const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));

test("nothing outside src/admin imports the portal, except App's lazy import", () => {
  const outside = walk(path.join(root, "src")).filter((f) => /\.(jsx?|css)$/.test(f) && !f.includes(`${path.sep}admin${path.sep}`));
  for (const f of outside) {
    const text = readFileSync(f, "utf8");
    const imports = [...text.matchAll(/(?:import|from)\s*\(?\s*["']([^"']*admin[^"']*)["']/g)].map((m) => m[1]);
    if (f.endsWith(`${path.sep}App.jsx`)) assert.deepEqual(imports, ["./admin/AdminApp.jsx"], f);
    else assert.deepEqual(imports, [], f);
  }
  const app = read("src/App.jsx");
  assert.match(app, /const AdminApp = lazy\(\(\) => import\("\.\/admin\/AdminApp\.jsx"\)\);/);
  // the charts and the portal's stylesheet are only reachable from the portal
  const admin = walk(path.join(root, "src/admin"));
  const chartUsers = admin.filter((f) => /from "\.\/charts\.jsx"/.test(readFileSync(f, "utf8"))).map((f) => path.basename(f));
  assert.deepEqual(chartUsers, ["Dashboard.jsx"]);
  assert.deepEqual(admin.filter((f) => /import "\.\/admin\.css"/.test(readFileSync(f, "utf8"))).map((f) => path.basename(f)), ["AdminApp.jsx"]);
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(Object.keys(pkg.dependencies || {}).filter((d) => /chart|d3|recharts|victory|nivo/i.test(d)), [], "no chart library");
});

test("the portal never sends anything itself: no fetch, no email or WhatsApp API", () => {
  for (const f of walk(path.join(root, "src/admin"))) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|sendBeacon|graph\.facebook|api\.whatsapp|resend|sendgrid|nodemailer/i, f);
  }
});

// ---- favicon --------------------------------------------------------------------------------------
const pngSize = (file) => {
  const b = readFileSync(file);
  assert.equal(b.toString("ascii", 1, 4), "PNG", file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test("favicon: every icon index.html and the manifest point to exists, at its size", () => {
  const html = read("index.html");
  const links = [...html.matchAll(/<link\s+rel="(icon|apple-touch-icon|manifest)"([^>]*)>/g)].map((m) => ({ rel: m[1], href: m[2].match(/href="([^"]+)"/)[1], sizes: m[2].match(/sizes="([^"]+)"/)?.[1] }));
  assert.deepEqual(
    links.map((l) => l.href),
    ["/favicon.ico", "/favicon-32.png", "/favicon-16.png", "/apple-touch-icon.png", "/site.webmanifest"]
  );
  for (const l of links) assert.ok(existsSync(path.join(root, "public", l.href)), `public${l.href} is missing`);
  for (const l of links.filter((x) => x.href.endsWith(".png"))) {
    const [w, h] = pngSize(path.join(root, "public", l.href));
    assert.equal(`${w}x${h}`, l.sizes, l.href);
  }
  // favicon.ico holds 16, 32 and 48
  const ico = readFileSync(path.join(root, "public/favicon.ico"));
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1]);
  const count = ico.readUInt16LE(4);
  assert.deepEqual(
    Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b),
    [16, 32, 48]
  );
  const manifest = JSON.parse(read("public/site.webmanifest"));
  for (const i of manifest.icons) {
    assert.ok(existsSync(path.join(root, "public", i.src)), i.src);
    assert.equal(pngSize(path.join(root, "public", i.src)).join("x"), i.sizes, i.src);
  }
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" \/>/i);
  // the old generic hat icon is gone and nothing points to it
  assert.ok(!existsSync(path.join(root, "public/favicon.svg")));
  for (const f of ["index.html", "public/site.webmanifest", ...walk(path.join(root, "src")).map((f) => path.relative(root, f))])
    assert.doesNotMatch(read(f), /favicon\.svg/, f);
});
