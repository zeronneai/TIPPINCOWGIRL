// Small helpers shared by the portal's screens.
//
// Every status has one color, used everywhere: `color` is the mark (dots,
// chart segments, chip edges), `bg` and `ink` are the badge's tint and text
// (ink on bg clears WCAG AA). Cancelled and Declined are deliberately gray.

export const STATUSES = [
  { id: "new", name: "New", color: "#e8674a", bg: "#fde3da", ink: "#8f3416", text: "#fff" },
  { id: "in_production", name: "In production", color: "#22a493", bg: "#d5f0eb", ink: "#0d5b51", text: "#fff" },
  { id: "ready", name: "Ready", color: "#e0a526", bg: "#faefcf", ink: "#6e4b00", text: "#2b1a10" },
  { id: "shipped", name: "Shipped", color: "#33609f", bg: "#dfe8f5", ink: "#22416d", text: "#fff" },
  { id: "delivered", name: "Delivered", color: "#4f7a3a", bg: "#e2edd9", ink: "#33531f", text: "#fff" },
  { id: "cancelled", name: "Cancelled", color: "#9a8f86", bg: "#ece7e2", ink: "#544b44", text: "#fff" },
];
const unknown = (id) => ({ id, name: id || "Unknown", color: "#9a8f86", bg: "#ece7e2", ink: "#544b44", text: "#fff" });
export const statusOf = (id) => STATUSES.find((s) => s.id === id) || unknown(id);

// Booking requests have their own statuses (supabase/schema.sql, phase 2).
export const BOOKING_STATUSES = [
  { id: "new", name: "New", color: "#e8674a", bg: "#fde3da", ink: "#8f3416", text: "#fff" },
  { id: "confirmed", name: "Confirmed", color: "#22a493", bg: "#d5f0eb", ink: "#0d5b51", text: "#fff" },
  { id: "rescheduled", name: "Rescheduled", color: "#e0a526", bg: "#faefcf", ink: "#6e4b00", text: "#2b1a10" },
  { id: "declined", name: "Declined", color: "#9a8f86", bg: "#ece7e2", ink: "#544b44", text: "#fff" },
  { id: "completed", name: "Completed", color: "#33609f", bg: "#dfe8f5", ink: "#22416d", text: "#fff" },
];
export const bookingStatusOf = (id) => BOOKING_STATUSES.find((s) => s.id === id) || unknown(id);

// ---- demo data ---------------------------------------------------------------------
// The demo seeds give every made up order and booking an email ending in
// @demo.tippin. The top bar's "Include demo data" switch decides whether
// they count anywhere.
export const DEMO_SUFFIX = "@demo.tippin";
export const isDemoEmail = (email) => String(email || "").toLowerCase().endsWith(DEMO_SUFFIX);

/**
 * Leave demo rows out of a Supabase query. A row with no email is kept
 * (a plain "not like" would drop it, since NULL never matches).
 */
export const excludeDemo = (q, column) => q.or(`${column}.is.null,${column}.not.ilike.*${DEMO_SUFFIX}`);

// ---- dates ------------------------------------------------------------------------------
/** A Date as "2026-11-14" in the browser's own time zone. */
export const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "2026-11" for a Date, in the browser's time zone. */
export const localMonth = (d = new Date()) => localYmd(d).slice(0, 7);

/** "2026-11" moved by n months. */
export const addMonths = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/** "2026-11-14" moved by n days (calendar arithmetic, no time zone). */
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** "November 2026" (or with other options) for "2026-11". */
export const monthName = (ym, opts = { month: "long", year: "numeric" }) => {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
};

/** A calendar date ("2026-11-14", no time zone) as "Sat, Nov 14, 2026". */
export const eventDay = (ymd, opts = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) => {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

/**
 * The day a booking is expected to happen: a rescheduled request moves to its
 * proposed date when there is one.
 */
export const bookingDay = (b) => (b.status === "rescheduled" && b.proposed_date ? b.proposed_date : b.event_date) || null;

/** "3 days ago", "5 hours ago", "just now". */
export function ago(iso, now = Date.now()) {
  const ms = now - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// ---- money and text ------------------------------------------------------------------

/** Cents to "$245.00", the way an invoice reads. */
export const money = (cents, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "usd").toUpperCase(), minimumFractionDigits: 2 }).format(
    (Number(cents) || 0) / 100
  );

/** Cents to "$1,860" or "$12.4K" for tiles and chart axes. */
export const moneyShort = (cents) => {
  const d = (Number(cents) || 0) / 100;
  if (d >= 10000) return `$${(d / 1000).toFixed(d >= 100000 ? 0 : 1)}K`;
  return `$${Math.round(d).toLocaleString("en-US")}`;
};

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
