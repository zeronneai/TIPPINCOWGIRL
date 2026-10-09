// Small helpers shared by the portal's screens.

export const STATUSES = [
  { id: "new", name: "New", color: "#e8674a", text: "#fff" },
  { id: "in_production", name: "In production", color: "#3fa89a", text: "#fff" },
  { id: "ready", name: "Ready", color: "#e0a526", text: "#2b1a10" },
  { id: "shipped", name: "Shipped", color: "#3d5a80", text: "#fff" },
  { id: "delivered", name: "Delivered", color: "#4f7a3a", text: "#fff" },
  { id: "cancelled", name: "Cancelled", color: "#9a8f86", text: "#fff" },
];
export const statusOf = (id) => STATUSES.find((s) => s.id === id) || { id, name: id || "Unknown", color: "#9a8f86", text: "#fff" };

// Booking requests have their own statuses (supabase/schema.sql, phase 2).
export const BOOKING_STATUSES = [
  { id: "new", name: "New", color: "#e8674a", text: "#fff" },
  { id: "confirmed", name: "Confirmed", color: "#3fa89a", text: "#fff" },
  { id: "rescheduled", name: "Rescheduled", color: "#e0a526", text: "#2b1a10" },
  { id: "declined", name: "Declined", color: "#9a8f86", text: "#fff" },
  { id: "completed", name: "Completed", color: "#3d5a80", text: "#fff" },
];
export const bookingStatusOf = (id) =>
  BOOKING_STATUSES.find((s) => s.id === id) || { id, name: id || "Unknown", color: "#9a8f86", text: "#fff" };

/** A calendar date ("2026-11-14", no time zone) as "Sat, Nov 14, 2026". */
export const eventDay = (ymd, opts = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) => {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

/** Cents to "$245.00", the way an invoice reads. */
export const money = (cents, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "usd").toUpperCase(), minimumFractionDigits: 2 }).format(
    (Number(cents) || 0) / 100
  );

export const dateTime = (iso) =>
  iso ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "";

export const shortDate = (iso) => (iso ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso)) : "");

/** The address block as lines, blanks dropped. */
export function addressLines(a) {
  if (!a) return [];
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [a.name, a.line1, a.line2, cityLine, a.country, a.phone].filter((v) => v && String(v).trim());
}

/**
 * Text that is safe inside a PostgREST or() filter: its separators and
 * wildcards are dropped, so a search box can never change the query.
 */
export const searchTerm = (q) => String(q || "").replace(/[%*,()\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
