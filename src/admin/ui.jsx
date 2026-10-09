import { bookingStatusOf, statusOf } from "./format.js";

// The portal's frame and shared styles: the site's cream, ink and coral,
// Alfa Slab One for headings and Satoshi for everything else. Built for a
// phone first; on a wide screen it simply centers.

export const ui = {
  page: {
    minHeight: "100vh",
    background: "var(--cream)",
    color: "var(--ink)",
    fontFamily: "'Satoshi', system-ui, sans-serif",
  },
  wrap: { maxWidth: 880, margin: "0 auto", padding: "16px 16px 64px" },
  card: {
    background: "#fffaf0",
    border: "2px solid var(--ink)",
    boxShadow: "0 4px 0 var(--ink)",
    borderRadius: 16,
    padding: "18px 18px 20px",
  },
  h1: { fontFamily: "'Alfa Slab One', 'Satoshi', serif", fontWeight: 400, fontSize: 28, margin: "0 0 6px", color: "var(--coral)" },
  h2: { fontFamily: "'Alfa Slab One', 'Satoshi', serif", fontWeight: 400, fontSize: 19, margin: "0 0 12px", color: "var(--ink)" },
  muted: { fontSize: 14, color: "#7a6553", margin: 0, lineHeight: 1.5 },
  label: { display: "block", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#6f4526", marginBottom: 6 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    fontSize: 16, // 16px keeps iOS from zooming into the field
    borderRadius: 10,
    border: "1.5px solid rgba(43,26,16,.5)",
    background: "#fff",
    color: "var(--ink)",
    fontFamily: "inherit",
  },
  error: { margin: "12px 0 0", fontSize: 14, fontWeight: 700, color: "var(--coral-deep)" },
  ok: { margin: "12px 0 0", fontSize: 14, fontWeight: 700, color: "#2f7a5f" },
  chip: (on) => ({
    border: on ? "2px solid var(--ink)" : "1.5px solid rgba(43,26,16,.3)",
    background: on ? "var(--ink)" : "#fffaf0",
    color: on ? "#fff" : "var(--ink)",
    borderRadius: 999,
    padding: "7px 13px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  }),
  link: { color: "var(--coral-deep)", fontWeight: 800, textDecoration: "none" },
};

export function StatusBadge({ status, kind = "order" }) {
  const s = kind === "booking" ? bookingStatusOf(status) : statusOf(status);
  return (
    <span
      data-status={s.id}
      style={{
        display: "inline-block",
        background: s.color,
        color: s.text,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
      }}
    >
      {s.name}
    </span>
  );
}

/** Orders / Bookings, under the header. `newBookings` shows as a badge. */
function Sections({ section, newBookings }) {
  const tab = (href, label, on, badge) => (
    <a
      href={href}
      aria-current={on ? "page" : undefined}
      data-section={label.toLowerCase()}
      style={{
        flex: 1,
        textAlign: "center",
        padding: "10px 8px",
        fontWeight: 800,
        fontSize: 14.5,
        textDecoration: "none",
        color: on ? "var(--ink)" : "#7a6553",
        borderBottom: on ? "3px solid var(--coral)" : "3px solid transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      {label}
      {badge > 0 && (
        <span
          data-testid="new-bookings-badge"
          aria-label={`${badge} new`}
          style={{ background: "var(--coral)", color: "#fff", borderRadius: 999, fontSize: 11.5, fontWeight: 800, padding: "1px 7px", minWidth: 20 }}
        >
          {badge}
        </span>
      )}
    </a>
  );
  return (
    <nav aria-label="Portal sections" style={{ background: "#fffaf0", borderBottom: "1.5px solid rgba(43,26,16,.15)" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", padding: "0 8px" }}>
        {tab("/admin", "Orders", section === "orders", 0)}
        {tab("/admin/bookings", "Bookings", section === "bookings", newBookings)}
      </div>
    </nav>
  );
}

export function Shell({ user, onSignOut, section, newBookings = 0, children }) {
  return (
    <div style={ui.page}>
      <header style={{ background: "var(--ink)", color: "#faf1e2" }}>
        <div style={{ ...ui.wrap, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href="/admin" style={{ color: "#faf1e2", textDecoration: "none", fontFamily: "'Alfa Slab One', serif", fontSize: 18 }}>
            Tippin' Cowgirl <span style={{ color: "var(--coral)" }}>Staff</span>
          </a>
          {user && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{user}</span>
              <button
                type="button"
                onClick={onSignOut}
                style={{ border: "1.5px solid rgba(250,241,226,.5)", background: "none", color: "#faf1e2", borderRadius: 8, padding: "6px 10px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      {user && section && <Sections section={section} newBookings={newBookings} />}
      <main style={ui.wrap}>{children}</main>
    </div>
  );
}
