import { useCallback, useEffect, useMemo, useState } from "react";
import BookingDetail from "./BookingDetail.jsx";
import { BOOKING_STATUSES, bookingStatusOf, eventDay, excludeDemo, searchTerm, shortDate } from "./format.js";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Panel, Skeleton, StatusBadge, useDemo } from "./ui.jsx";

// Booking requests as a list (status filter, search, sort, pages of 50) or
// a board with one column per status. On the board a card moves with its
// "Move to" menu or by dragging it to another column; both go through
// staff_set_booking_status, the same function as the detail screen.
// ?view=board&sort=event keeps the choice across reloads.

const PAGE = 50;
const COLS = "id, created_at, name, email, event_type, event_date, status, proposed_date";
const SORTS = { received: "Received, newest first", event: "Event date, soonest first" };

function readQuery() {
  const q = new URLSearchParams(window.location.search);
  return { view: q.get("view") === "board" ? "board" : "list", sort: q.get("sort") === "event" ? "event" : "received" };
}

/** The shared parts of every bookings query: search, demo rows, sort. */
function scoped(q, { term, includeDemo, sort }) {
  // "*" is PostgREST's ilike wildcard; searchTerm() strips it and every
  // other separator from what was typed
  if (term) q = q.or(`name.ilike.*${term}*,email.ilike.*${term}*`);
  if (!includeDemo) q = excludeDemo(q, "email");
  if (sort === "event") q = q.order("event_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  else if (sort) q = q.order("created_at", { ascending: false });
  return q;
}

export default function BookingsList({ onChanged }) {
  const initial = useMemo(readQuery, []);
  const { includeDemo } = useDemo();
  const [view, setView] = useState(initial.view);
  const [sort, setSort] = useState(initial.sort);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [counts, setCounts] = useState(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (view === "board") q.set("view", "board");
    if (sort === "event") q.set("sort", "event");
    const qs = q.toString();
    window.history.replaceState(null, "", `/admin/bookings${qs ? `?${qs}` : ""}`);
  }, [view, sort]);

  useEffect(() => {
    const t = setTimeout(() => setTerm(searchTerm(query)), 300);
    return () => clearTimeout(t);
  }, [query]);

  // the counts on the filter chips follow the search and the demo switch
  useEffect(() => {
    let alive = true;
    scoped(supabase.from("bookings").select("status"), { term, includeDemo })
      .limit(5000)
      .then(({ data, error }) => {
        if (!alive || error) return;
        const c = { all: data.length };
        for (const r of data) c[r.status] = (c[r.status] || 0) + 1;
        setCounts(c);
      });
    return () => {
      alive = false;
    };
  }, [term, includeDemo, tick]);

  const refresh = useCallback(() => {
    setTick((n) => n + 1);
    onChanged?.();
  }, [onChanged]);

  return (
    <>
      <PageHead
        title="Bookings"
        sub="Every request from the site's booking form."
        actions={
          <div className="ad-seg" role="group" aria-label="View">
            {[
              ["list", "List", "bookings"],
              ["board", "Board", "dashboard"],
            ].map(([id, label, icon]) => (
              <button key={id} type="button" aria-pressed={view === id} data-view={id} onClick={() => setView(id)}>
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="ad-toolbar">
        <div className="ad-toolbar-row">
          <label className="ad-search">
            <span className="ad-sr">Search by name or email</span>
            <Icon name="search" size={18} />
            <input id="booking-search" type="search" className="ad-input" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            <span className="ad-sr">Sort</span>
            <select className="ad-select" value={sort} onChange={(e) => setSort(e.target.value)} data-sort>
              {Object.entries(SORTS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {view === "list" && (
          <div className="ad-chips" role="group" aria-label="Filter by status">
            {[{ id: "all", name: "All" }, ...BOOKING_STATUSES].map((s) => (
              <button key={s.id} type="button" className="ad-fchip" aria-pressed={status === s.id} data-filter={s.id} onClick={() => setStatus(s.id)}>
                {s.color && <span className="ad-dot" style={{ background: s.color }} aria-hidden />}
                {s.name}
                <span className="ad-fchip-n" data-count>
                  {counts ? counts[s.id] || 0 : "·"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "list" ? (
        <List status={status} term={term} sort={sort} includeDemo={includeDemo} tick={tick} />
      ) : (
        <Board term={term} sort={sort} includeDemo={includeDemo} tick={tick} onChanged={refresh} onOpen={setOpen} />
      )}

      {open && (
        <Panel title="Booking" onClose={() => setOpen(null)}>
          <BookingDetail id={open} panel onChanged={refresh} />
        </Panel>
      )}
    </>
  );
}

export function BookingRow({ b }) {
  return (
    <a href={`/admin/bookings/${b.id}`} data-booking={b.id} className="ad-card ad-row">
      <span className="ad-row-title">{b.name}</span>
      <span className="ad-row-right" style={{ fontWeight: 800, fontSize: 14 }}>
        {b.event_date ? eventDay(b.event_date, { month: "short", day: "numeric", year: "numeric" }) : "No date"}
      </span>
      <span className="ad-row-meta">{[b.event_type, b.email].filter(Boolean).join(" · ")}</span>
      <span className="ad-row-right ad-row-meta">received {shortDate(b.created_at)}</span>
      <span>
        <StatusBadge kind="booking" status={b.status} />
      </span>
      {b.status === "rescheduled" && b.proposed_date ? (
        <span className="ad-row-right ad-row-meta">proposed {eventDay(b.proposed_date, { month: "short", day: "numeric" })}</span>
      ) : (
        <span />
      )}
    </a>
  );
}

function List({ status, term, sort, includeDemo, tick }) {
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (offset = 0) => {
    setLoading(true);
    setError("");
    let q = scoped(supabase.from("bookings").select(COLS), { term, includeDemo, sort }).range(offset, offset + PAGE - 1);
    if (status !== "all") q = q.eq("status", status);
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
  }, [status, term, sort, includeDemo, tick]);

  return (
    <>
      {error && (
        <p role="alert" className="ad-msg-err">
          {error}
        </p>
      )}
      {loading && !rows.length ? (
        <div className="ad-rows" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={74} r={16} />
          ))}
        </div>
      ) : (
        <ul className="ad-rows" aria-busy={loading} style={{ opacity: loading ? 0.6 : 1 }}>
          {rows.map((b) => (
            <li key={b.id}>
              <BookingRow b={b} />
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="ad-card">
          {term || status !== "all" ? (
            <Empty icon="search" title="No bookings match">Try another name, or another status.</Empty>
          ) : (
            <Empty icon="bookings" title="No booking requests yet">When someone sends the form on the site, it shows up here.</Empty>
          )}
        </div>
      )}
      {more && !loading && (
        <button type="button" className="ad-btn ad-btn--ghost" style={{ width: "100%", marginTop: 16 }} onClick={() => load(rows.length)}>
          Show more
        </button>
      )}
    </>
  );
}

function Board({ term, sort, includeDemo, tick, onChanged, onOpen }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(null);
  const [pending, setPending] = useState(null); // { id, date } while picking a proposed date
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    scoped(supabase.from("bookings").select(COLS), { term, includeDemo, sort })
      .limit(500)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError("The board could not be loaded. Try again in a moment.");
        else setRows(data);
      });
    return () => {
      alive = false;
    };
  }, [term, sort, includeDemo, tick]);

  const move = async (b, to, proposed = null) => {
    if (to === b.status) return;
    if (to === "rescheduled" && !proposed && !b.proposed_date) {
      setPending({ id: b.id, date: "" });
      return;
    }
    setBusy(b.id);
    setError("");
    const { error: err } = await supabase.rpc("staff_set_booking_status", {
      p_booking_id: b.id,
      p_status: to,
      p_proposed_date: to === "rescheduled" ? proposed || null : null,
      p_note: null,
    });
    setBusy(null);
    setPending(null);
    if (err) return setError(err.code === "22023" ? err.message : "That booking could not be moved. Try again.");
    // move it here at once, then reload in the background
    setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, status: to, proposed_date: proposed || r.proposed_date } : r)));
    onChanged();
    return undefined;
  };

  if (!rows && !error)
    return (
      <div className="ad-board" role="status" aria-label="Loading">
        {BOOKING_STATUSES.map((s) => (
          <div className="ad-col" key={s.id}>
            <Skeleton h={18} w="50%" />
            <Skeleton h={70} />
            <Skeleton h={70} />
          </div>
        ))}
      </div>
    );

  return (
    <>
      {error && (
        <p role="alert" className="ad-msg-err" style={{ marginBottom: 10 }}>
          {error}
        </p>
      )}
      <div className="ad-board" data-board>
        {BOOKING_STATUSES.map((s) => {
          const list = (rows || []).filter((r) => r.status === s.id);
          return (
            <section
              key={s.id}
              className="ad-col"
              data-column={s.id}
              data-over={over === s.id}
              aria-label={`${s.name}, ${list.length}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.id);
              }}
              onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const b = rows.find((r) => r.id === e.dataTransfer.getData("text/plain"));
                if (b) move(b, s.id);
              }}
            >
              <div className="ad-col-h">
                <span className="ad-dot" style={{ background: s.color }} aria-hidden />
                {s.name}
                <span className="ad-fchip-n" data-column-count>
                  {list.length}
                </span>
              </div>
              {list.map((b) => (
                <article
                  key={b.id}
                  className="ad-bcard"
                  style={{ "--c": s.color, opacity: busy === b.id ? 0.55 : 1 }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", b.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  data-card={b.id}
                >
                  <button type="button" className="ad-bcard-open" onClick={() => onOpen(b.id)} aria-label={`Open ${b.name}`}>
                    <b>{b.name}</b>
                    <small>
                      {[b.event_type, b.event_date ? eventDay(b.event_date, { month: "short", day: "numeric", year: "numeric" }) : "No date"].filter(Boolean).join(" · ")}
                    </small>
                    {b.status === "rescheduled" && b.proposed_date && <small>Proposed {eventDay(b.proposed_date, { month: "short", day: "numeric" })}</small>}
                    <small>Received {shortDate(b.created_at)}</small>
                  </button>
                  {pending?.id === b.id ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <label className="ad-label" htmlFor={`pd-${b.id}`} style={{ margin: 0 }}>
                        Proposed date
                      </label>
                      <input id={`pd-${b.id}`} type="date" className="ad-input" style={{ fontSize: 14, padding: "6px 8px" }} value={pending.date} onChange={(e) => setPending({ id: b.id, date: e.target.value })} data-pending-date />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="ad-btn ad-btn--sm ad-btn--coral" disabled={!pending.date || busy} onClick={() => move(b, "rescheduled", pending.date)} data-pending-save>
                          Reschedule
                        </button>
                        <button type="button" className="ad-btn ad-btn--sm ad-btn--ghost" onClick={() => setPending(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label>
                      <span className="ad-sr">Move {b.name} to</span>
                      <select className="ad-select" value={b.status} onChange={(e) => move(b, e.target.value)} disabled={busy === b.id} data-move={b.id}>
                        {BOOKING_STATUSES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.id === b.status ? t.name : `Move to ${t.name}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </article>
              ))}
              {!list.length && <p className="ad-col-empty">No {bookingStatusOf(s.id).name.toLowerCase()} bookings.</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
