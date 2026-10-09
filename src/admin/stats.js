// ---------------------------------------------------------------------------
// The dashboard's numbers, worked out in the browser from the rows staff can
// already read (Row Level Security decides which). Pure functions: rows and
// "now" in, numbers out, so they are tested without a browser or a database.
//
// Times follow the browser's own time zone: "this month" and "this week" are
// the staff member's, and event dates are plain calendar days.
// ---------------------------------------------------------------------------

import { BOOKING_STATUSES, STATUSES, addDays, addMonths, bookingDay, isDemoEmail, localMonth, localYmd, monthName } from "./format.js";

const DAY = 86400000;

/** Drop demo orders and bookings unless they are wanted. */
export function withDemo({ orders = [], bookings = [] }, include) {
  if (include) return { orders, bookings };
  return { orders: orders.filter((o) => !isDemoEmail(o.customer_email)), bookings: bookings.filter((b) => !isDemoEmail(b.email)) };
}

/** The five headline numbers. Revenue leaves cancelled orders out. */
export function kpis({ orders, bookings, now = Date.now() }) {
  const month = localMonth(new Date(now));
  const today = localYmd(new Date(now));
  const in30 = addDays(today, 30);
  const thisMonth = orders.filter((o) => o.status !== "cancelled" && localMonth(new Date(o.created_at)) === month);
  const upcoming = bookings.filter((b) => {
    const d = bookingDay(b);
    return b.status !== "declined" && d && d >= today && d <= in30;
  });
  return {
    newOrders: orders.filter((o) => o.status === "new").length,
    inProduction: orders.filter((o) => o.status === "in_production").length,
    revenueMonth: thisMonth.reduce((s, o) => s + (Number(o.total) || 0), 0),
    ordersMonth: thisMonth.length,
    monthLabel: monthName(month, { month: "long" }),
    newBookings: bookings.filter((b) => b.status === "new").length,
    upcomingEvents: upcoming.length,
    upcomingConfirmed: upcoming.filter((b) => b.status === "confirmed").length,
  };
}

/**
 * What is waiting too long: bookings still New after 24 hours, orders still
 * New or In production after 7 days. Oldest first.
 */
export function attention({ orders, bookings, now = Date.now() }) {
  const items = [];
  for (const b of bookings) {
    const age = now - new Date(b.created_at).getTime();
    if (b.status === "new" && age > DAY)
      items.push({ kind: "booking", id: b.id, name: b.name || "No name", status: b.status, age, href: `/admin/bookings/${b.id}`, detail: [b.event_type, b.event_date].filter(Boolean) });
  }
  for (const o of orders) {
    const age = now - new Date(o.created_at).getTime();
    if ((o.status === "new" || o.status === "in_production") && age > 7 * DAY)
      items.push({ kind: "order", id: o.id, name: o.customer_name || "No name", status: o.status, age, href: `/admin/orders/${o.id}`, total: o.total, currency: o.currency });
  }
  return items.sort((a, b) => b.age - a.age);
}

/** Monday 00:00 (local) of the week holding `d`. */
function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Revenue (cents) and order count for each of the last `weeks` weeks, oldest first. */
export function weekly({ orders, now = Date.now(), weeks = 12 }) {
  const first = weekStart(new Date(now));
  first.setDate(first.getDate() - 7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * i);
    return { key: localYmd(start), label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start), revenue: 0, orders: 0 };
  });
  const index = new Map(out.map((w, i) => [w.key, i]));
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const i = index.get(localYmd(weekStart(new Date(o.created_at))));
    if (i === undefined) continue;
    out[i].revenue += Number(o.total) || 0;
    out[i].orders += 1;
  }
  return out;
}

/** How many orders sit in each status, in the statuses' own order. */
export function orderStatusCounts(orders) {
  return STATUSES.map((s) => ({ ...s, value: orders.filter((o) => o.status === s.id).length }));
}

/** How many bookings sit in each booking status. */
export function bookingStatusCounts(bookings) {
  return BOOKING_STATUSES.map((s) => ({ ...s, value: bookings.filter((b) => b.status === s.id).length }));
}

/**
 * Bookings expected in each of the next `months` months (this one first),
 * by the day they should happen; declined ones are left out.
 */
export function bookingMonths({ bookings, now = Date.now(), months = 12 }) {
  const start = localMonth(new Date(now));
  const out = Array.from({ length: months }, (_, i) => {
    const key = addMonths(start, i);
    return { key, label: monthName(key, { month: "short" }), year: key.slice(0, 4), value: 0 };
  });
  const index = new Map(out.map((m, i) => [m.key, i]));
  for (const b of bookings) {
    if (b.status === "declined") continue;
    const d = bookingDay(b);
    const i = d ? index.get(d.slice(0, 7)) : undefined;
    if (i !== undefined) out[i].value += 1;
  }
  return out;
}

/** Bookings per event type, most first; a blank type is "Not given". */
export function eventTypes(bookings) {
  const counts = new Map();
  for (const b of bookings) {
    const t = String(b.event_type || "").trim() || "Not given";
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/**
 * The latest status changes across orders and bookings, newest first. An
 * event whose order or booking is not in the given rows (a demo one that is
 * hidden, say) is left out.
 */
export function activity({ orderEvents = [], bookingEvents = [], orders, bookings, limit = 12 }) {
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const items = [];
  for (const e of orderEvents) {
    const o = orderById.get(e.order_id);
    if (o) items.push({ kind: "order", key: `o${e.id}`, id: o.id, name: o.customer_name || "No name", href: `/admin/orders/${o.id}`, ...pick(e) });
  }
  for (const e of bookingEvents) {
    const b = bookingById.get(e.booking_id);
    if (b) items.push({ kind: "booking", key: `b${e.id}`, id: b.id, name: b.name || "No name", href: `/admin/bookings/${b.id}`, ...pick(e) });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
const pick = (e) => ({ at: e.created_at, who: e.actor_email || "system", from: e.from_status, to: e.to_status, note: e.note });

/**
 * Round an axis top up to a clean number whose half is clean too, since the
 * charts label 0, the middle and the top: 4, 6, 8, 10, 20, 40, 60...
 */
export function niceMax(v) {
  if (!(v > 0)) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 4, 6, 8, 10]) if (v <= m * p) return Math.max(m * p, 4);
  return 10 * p;
}
