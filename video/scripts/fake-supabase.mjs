// ---------------------------------------------------------------------------
// A stand in for Supabase (Auth and the PostgREST calls the portal makes),
// answered inside Playwright, so the screenshots never touch a real project.
//
// DEMO DATA ONLY. The orders are the six from scripts/seed-demo-orders.js,
// built through the same code as a real order (buildOrderRecord), and the
// bookings are the four from scripts/seed-demo-bookings.js plus a few more
// invented ones below. Every email ends in @demo.tippin; names, phones
// (555 numbers) and addresses are made up.
// ---------------------------------------------------------------------------

import { DEMO_EMAIL_SUFFIX, DEMO_ORDERS, demoSession } from "../../scripts/seed-demo-orders.js";
import { demoRows } from "../../scripts/seed-demo-bookings.js";
import { buildOrderRecord } from "../../src/shop/orderRecord.js";

export const SUPABASE_URL = "https://demo-project.supabase.co";
export const STAFF = { id: "aaaaaaaa-0000-4000-8000-000000000001", email: `deborah${DEMO_EMAIL_SUFFIX}`, role: "owner" };

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const oid = (n) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
const bid = (n) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, "0")}`;

// More invented requests so the calendar and the board have something in
// later months. [name, phone, event type, event in days, status, sent days ago, notes]
const MORE_BOOKINGS = [
  ["Avery Collins", "915-555-0162", "Birthday", 46, "new", 1.5, "Sweet sixteen, 25 guests, backyard."],
  ["Lucia Navarro", "915-555-0174", "Wedding", 72, "confirmed", 12, "Hat bar for the bridal party, 10 hats."],
  ["Paige Whitfield", "512-555-0188", "Corporate", 118, "new", 0.4, "Client appreciation night, about 60 people."],
  ["Renata Flores", "915-555-0126", "Pop-up / Market", 158, "confirmed", 20, "Holiday market booth, two days."],
  ["Mackenzie Lane", "915-555-0193", "Bachelorette", -12, "completed", 40, "Downtown loft, 14 girls."],
];

/** The demo orders, bookings and their histories, dated relative to `now`. */
export function demoData(now = Date.now()) {
  const nowSec = Math.floor(now / 1000);
  const orders = [];
  const events = [];
  DEMO_ORDERS.forEach((demo, i) => {
    const session = demoSession(demo, i, nowSec);
    const { row } = buildOrderRecord(session);
    const id = oid(i + 1);
    const created = new Date(session.created * 1000).toISOString();
    orders.push({ ...row, id, created_at: created, updated_at: created, status: demo.status, tracking_number: demo.tracking || null, internal_notes: demo.note || null });
    events.push({ id: events.length + 1, order_id: id, created_at: created, actor_email: "stripe", from_status: null, to_status: "new", note: "Paid on Stripe" });
    let from = "new";
    (demo.history || []).forEach(([to, who, note], k) => {
      const at = Math.min(session.created + (k + 1) * 0.15 * 86400, nowSec);
      events.push({ id: events.length + 1, order_id: id, created_at: new Date(at * 1000).toISOString(), actor_email: `${who}${DEMO_EMAIL_SUFFIX}`, from_status: from, to_status: to, note });
      from = to;
    });
  });

  const seeded = demoRows(now).map((r) => ({ ...r }));
  const more = MORE_BOOKINGS.map(([name, phone, type, inDays, status, ago, notes]) => ({
    created_at: new Date(now - ago * DAY).toISOString(),
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}${DEMO_EMAIL_SUFFIX}`,
    phone,
    event_type: type,
    event_date: ymd(new Date(now + inDays * DAY)),
    proposed_date: null,
    notes,
    status,
    internal_notes: null,
    source: "demo",
  }));
  const bookings = [...seeded, ...more].map((b, i) => ({ ...b, id: bid(i + 1), updated_at: b.created_at, internal_notes: b.internal_notes ?? null }));
  const bevents = [];
  for (const b of bookings) {
    bevents.push({ id: bevents.length + 1, booking_id: b.id, created_at: b.created_at, actor_email: "website", from_status: null, to_status: "new", note: "Requested on the website" });
    if (b.status !== "new")
      bevents.push({
        id: bevents.length + 1,
        booking_id: b.id,
        created_at: new Date(Math.min(Date.parse(b.created_at) + DAY / 3, now)).toISOString(),
        actor_email: STAFF.email,
        from_status: "new",
        to_status: b.status,
        note: b.status === "rescheduled" ? `Proposed date: ${b.proposed_date}` : null,
      });
  }
  for (const r of [...orders, ...bookings]) {
    const email = r.customer_email ?? r.email;
    if (!String(email).endsWith(DEMO_EMAIL_SUFFIX)) throw new Error(`not demo data: ${email}`);
  }
  return { orders, events, bookings, bevents };
}

// ---- the PostgREST filters the portal uses ------------------------------------------------
function condition(text) {
  const m = text.match(/^([a-z_]+)\.(not\.)?(eq|ilike|is|gte|lt|lte|gt)\.(.*)$/);
  if (!m) throw new Error(`unsupported filter ${text}`);
  const [, col, not, op, raw] = m;
  return (row) => {
    const v = row[col];
    let r;
    if (op === "is") r = raw === "null" ? v == null : String(v) === raw;
    else if (op === "eq") r = String(v) === raw;
    else if (v == null) return null;
    else if (op === "ilike") r = new RegExp(`^${raw.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i").test(String(v));
    else if (op === "gte") r = v >= raw;
    else if (op === "lt") r = v < raw;
    else if (op === "lte") r = v <= raw;
    else r = v > raw;
    return not ? !r : r;
  };
}

function query(rows, params) {
  let out = rows;
  for (const [k, v] of params.entries()) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    if (k === "or") {
      const parts = v.replace(/^\(|\)$/g, "").split(",").map(condition);
      out = out.filter((r) => parts.some((t) => t(r) === true));
    } else {
      const t = condition(`${k}.${v}`);
      out = out.filter((r) => t(r) === true);
    }
  }
  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((s) => s.split("."));
    out = [...out].sort((a, b) => {
      for (const [col, dir = "asc", nulls] of keys) {
        const x = a[col];
        const y = b[col];
        if (x === y) continue;
        if (x == null) return nulls === "nullsfirst" ? -1 : 1;
        if (y == null) return nulls === "nullsfirst" ? 1 : -1;
        return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
      }
      return 0;
    });
  }
  const offset = Number(params.get("offset") || 0);
  const limit = params.get("limit") ? Number(params.get("limit")) : Infinity;
  return out.slice(offset, offset + limit);
}

/** A Playwright route handler for SUPABASE_URL/**, with its own copy of the data. */
export function fakeSupabase(data = demoData(), { now = Date.now() } = {}) {
  const db = structuredClone(data);
  let signedIn = false;
  const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" };
  const json = (route, status, body, headers = {}) =>
    route.fulfill({ status, contentType: "application/json", headers: { ...cors, ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
  const tables = { orders: db.orders, bookings: db.bookings, order_events: db.events, booking_events: db.bevents };
  const handler = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const p = url.pathname;
    if (p === "/auth/v1/token") {
      signedIn = true;
      const user = { id: STAFF.id, aud: "authenticated", role: "authenticated", email: STAFF.email, app_metadata: {}, user_metadata: {}, created_at: new Date(now).toISOString() };
      return json(route, 200, { access_token: "demo-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(now / 1000) + 86400, refresh_token: "demo", user });
    }
    if (p === "/auth/v1/logout") return route.fulfill({ status: 204, headers: cors });
    if (p === "/auth/v1/user") return signedIn ? json(route, 200, { id: STAFF.id, email: STAFF.email }) : json(route, 401, {});
    const single = (req.headers().accept || "").includes("vnd.pgrst.object");
    if (p === "/rest/v1/staff") return single ? json(route, 200, { email: STAFF.email, role: STAFF.role }) : json(route, 200, [{ email: STAFF.email, role: STAFF.role }]);
    const table = tables[p.replace("/rest/v1/", "")];
    if (table && (method === "GET" || method === "HEAD")) {
      const rows = query(table, url.searchParams);
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": `*/${rows.length}` } });
      if (single) return json(route, 200, rows[0] ?? null);
      return json(route, 200, rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }
    if (table && method === "PATCH") {
      const id = url.searchParams.get("id").replace(/^eq\./, "");
      Object.assign(table.find((r) => r.id === id), JSON.parse(req.postData()));
      return route.fulfill({ status: 204, headers: cors });
    }
    if (p === "/rest/v1/rpc/staff_set_order_status" || p === "/rest/v1/rpc/staff_set_booking_status") {
      const a = JSON.parse(req.postData());
      const isOrder = p.endsWith("order_status");
      const row = (isOrder ? db.orders : db.bookings).find((r) => r.id === (isOrder ? a.p_order_id : a.p_booking_id));
      const log = isOrder ? db.events : db.bevents;
      log.push({ id: log.length + 100, [isOrder ? "order_id" : "booking_id"]: row.id, created_at: new Date(now).toISOString(), actor_email: STAFF.email, from_status: row.status, to_status: a.p_status, note: a.p_note });
      row.status = a.p_status;
      if (a.p_tracking_number) row.tracking_number = a.p_tracking_number;
      if (a.p_proposed_date) row.proposed_date = a.p_proposed_date;
      return json(route, 200, row);
    }
    return json(route, 404, { message: `not in the demo: ${method} ${p}` });
  };
  return { handler, db };
}
