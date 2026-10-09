import { useEffect, useMemo, useState } from "react";
import { BOOKING_STATUSES, bookingStatusOf, eventDay, searchTerm, shortDate } from "./format.js";
import { supabase } from "./supabase.js";
import { StatusBadge, ui } from "./ui.jsx";

// Booking requests: a list (newest first, status filter, search by name or
// email) or a month calendar of event dates with a dot per request, colored
// by status. ?view=calendar&month=2026-11 keeps the view across reloads.

const PAGE = 50;
const ymd = (d) => d.toISOString().slice(0, 10);
const monthKey = (d) => d.toISOString().slice(0, 7);

function readQuery() {
  const q = new URLSearchParams(window.location.search);
  const month = /^\d{4}-\d{2}$/.test(q.get("month") || "") ? q.get("month") : monthKey(new Date());
  return { view: q.get("view") === "calendar" ? "calendar" : "list", month };
}

function writeQuery(view, month) {
  const q = new URLSearchParams();
  if (view === "calendar") {
    q.set("view", "calendar");
    q.set("month", month);
  }
  const qs = q.toString();
  window.history.replaceState(null, "", `/admin/bookings${qs ? `?${qs}` : ""}`);
}

export default function BookingsList() {
  const initial = useMemo(readQuery, []);
  const [view, setView] = useState(initial.view);
  const [month, setMonth] = useState(initial.month);
  useEffect(() => writeQuery(view, month), [view, month]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 14px", flexWrap: "wrap" }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>Bookings</h1>
        <div role="group" aria-label="View" style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[
            ["list", "List"],
            ["calendar", "Calendar"],
          ].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} data-view={id} onClick={() => setView(id)} style={ui.chip(view === id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "calendar" ? <Calendar month={month} setMonth={setMonth} /> : <List />}
    </>
  );
}

function BookingRow({ b }) {
  return (
    <a
      href={`/admin/bookings/${b.id}`}
      data-booking={b.id}
      style={{
        ...ui.card,
        boxShadow: "0 3px 0 var(--ink)",
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "4px 12px",
        color: "var(--ink)",
        textDecoration: "none",
      }}
    >
      <span style={{ fontWeight: 800, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
      <span style={{ fontWeight: 800, fontSize: 14, textAlign: "right", whiteSpace: "nowrap" }}>{b.event_date ? eventDay(b.event_date, { month: "short", day: "numeric", year: "numeric" }) : "No date"}</span>
      <span style={{ fontSize: 13, color: "#7a6553", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {[b.event_type, b.email].filter(Boolean).join(" · ")}
      </span>
      <span style={{ fontSize: 12.5, color: "#7a6553", textAlign: "right", whiteSpace: "nowrap" }}>sent {shortDate(b.created_at)}</span>
      <span>
        <StatusBadge kind="booking" status={b.status} />
      </span>
      {b.status === "rescheduled" && b.proposed_date ? (
        <span style={{ fontSize: 12.5, color: "#7a6553", textAlign: "right" }}>proposed {eventDay(b.proposed_date, { month: "short", day: "numeric" })}</span>
      ) : (
        <span />
      )}
    </a>
  );
}

function List() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTerm(searchTerm(query)), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = async (offset = 0) => {
    setLoading(true);
    setError("");
    let q = supabase
      .from("bookings")
      .select("id, created_at, name, email, event_type, event_date, status, proposed_date")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (status !== "all") q = q.eq("status", status);
    // "*" is PostgREST's ilike wildcard; searchTerm() strips it and every
    // other separator from what was typed
    if (term) q = q.or(`name.ilike.*${term}*,email.ilike.*${term}*`);
    const { data, error: err } = await q;
    setLoading(false);
    if (err) return setError("The bookings could not be loaded. Try again in a moment.");
    setRows((prev) => (offset ? [...prev, ...data] : data));
    setMore(data.length === PAGE);
    return undefined;
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, term]);

  return (
    <>
      <label htmlFor="booking-search" style={ui.label}>
        Search
      </label>
      <input id="booking-search" type="search" placeholder="Name or email" value={query} onChange={(e) => setQuery(e.target.value)} style={ui.input} />
      <div role="group" aria-label="Filter by status" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 16px 6px", margin: "0 -16px" }}>
        {[{ id: "all", name: "All" }, ...BOOKING_STATUSES].map((s) => (
          <button key={s.id} type="button" aria-pressed={status === s.id} data-filter={s.id} onClick={() => setStatus(s.id)} style={ui.chip(status === s.id)}>
            {s.name}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" style={ui.error}>
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 10 }} aria-busy={loading}>
        {rows.map((b) => (
          <li key={b.id}>
            <BookingRow b={b} />
          </li>
        ))}
      </ul>
      {!loading && !error && rows.length === 0 && (
        <p style={{ ...ui.muted, textAlign: "center", marginTop: 30 }}>{term || status !== "all" ? "No bookings match." : "No booking requests yet."}</p>
      )}
      {loading && (
        <p style={{ ...ui.muted, textAlign: "center", marginTop: 20 }} role="status">
          Loading
        </p>
      )}
      {more && !loading && (
        <button type="button" className="tc-btn tc-btn--ghost" style={{ width: "100%", marginTop: 16 }} onClick={() => load(rows.length)}>
          Show more
        </button>
      )}
    </>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Calendar({ month, setMonth }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const shift = (n) => {
    setPicked(null);
    setMonth(monthKey(new Date(Date.UTC(y, m - 1 + n, 1))));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    supabase
      .from("bookings")
      .select("id, name, event_type, event_date, status")
      .gte("event_date", ymd(first))
      .lt("event_date", ymd(next))
      .order("event_date", { ascending: true })
      .then(({ data, error: err }) => {
        if (!alive) return;
        setLoading(false);
        if (err) setError("The calendar could not be loaded. Try again in a moment.");
        else setRows(data);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const byDay = useMemo(() => {
    const map = {};
    for (const b of rows) (map[b.event_date] ||= []).push(b);
    return map;
  }, [rows]);

  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const today = ymd(new Date());
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const title = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <section aria-label={`Bookings in ${title}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" style={ui.chip(false)} data-cal="prev">
          ‹
        </button>
        <h2 style={{ ...ui.h2, margin: 0, flex: 1, textAlign: "center" }} data-cal="title">
          {title}
        </h2>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" style={ui.chip(false)} data-cal="next">
          ›
        </button>
      </div>

      <div style={{ ...ui.card, padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
          {WEEKDAYS.map((d) => (
            <div key={d} aria-hidden style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#7a6553", padding: "4px 0" }}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`x${i}`} />;
            const list = byDay[day] || [];
            const on = picked === day;
            return (
              <button
                key={day}
                type="button"
                data-day={day}
                onClick={() => setPicked(on ? null : day)}
                aria-pressed={on}
                aria-label={`${eventDay(day)}: ${list.length ? `${list.length} booking${list.length === 1 ? "" : "s"}` : "no bookings"}`}
                style={{
                  minHeight: 50,
                  padding: "4px 2px",
                  borderRadius: 8,
                  border: on ? "2px solid var(--ink)" : day === today ? "1.5px solid var(--coral)" : "1px solid rgba(43,26,16,.12)",
                  background: list.length ? "#fff" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "inherit",
                  color: "var(--ink)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: day === today ? 800 : 600 }}>{Number(day.slice(8))}</span>
                <span style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 3, maxWidth: 34 }}>
                  {list.slice(0, 4).map((b) => (
                    <span key={b.id} data-dot={b.status} style={{ width: 7, height: 7, borderRadius: "50%", background: bookingStatusOf(b.status).color }} />
                  ))}
                  {list.length > 4 && <span style={{ fontSize: 9.5, fontWeight: 800, lineHeight: "7px" }}>+{list.length - 4}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div aria-label="Status colors" style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", margin: "10px 2px 0", fontSize: 12.5, color: "#7a6553" }}>
        {BOOKING_STATUSES.map((s) => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      {error && (
        <p role="alert" style={ui.error}>
          {error}
        </p>
      )}
      {loading && (
        <p style={{ ...ui.muted, textAlign: "center", marginTop: 14 }} role="status">
          Loading
        </p>
      )}

      {!loading && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ ...ui.label, marginBottom: 8 }} data-cal="picked">
            {picked ? eventDay(picked, { weekday: "long", month: "long", day: "numeric" }) : `${rows.length} event${rows.length === 1 ? "" : "s"} this month`}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {(picked ? byDay[picked] || [] : rows).map((b) => (
              <li key={b.id}>
                <BookingRow b={b} />
              </li>
            ))}
          </ul>
          {picked && !(byDay[picked] || []).length && <p style={ui.muted}>Nothing on this day.</p>}
        </div>
      )}
    </section>
  );
}
