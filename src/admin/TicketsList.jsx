import { useEffect, useState } from "react";
import { TICKETED_EVENTS } from "../events/ticketed.js";
import { dateTime, money, searchTerm } from "./format.js";
import { supabase } from "./supabase.js";
import { Empty, Icon, PageHead, Skeleton } from "./ui.jsx";

// Tickets for the ticketed events (src/events/ticketed.js): how many seats
// are sold, who bought, their folio, paid or not, and a check in button for
// the door. Staff can also cancel a ticket (frees its seats) or restore it.
// Marking a ticket paid by hand is not possible: only Stripe does that.

const FILTERS = [
  { id: "paid", name: "Paid" },
  { id: "pending", name: "Not paid yet" },
  { id: "cancelled", name: "Cancelled" },
  { id: "all", name: "All" },
];

const EVENTS = Object.values(TICKETED_EVENTS);
const isLiveHold = (t, now = Date.now()) => t.status === "pending" && t.hold_expires_at && Date.parse(t.hold_expires_at) > now;

export default function TicketsList() {
  const [eventId, setEventId] = useState(EVENTS[0]?.id);
  const event = TICKETED_EVENTS[eventId];
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("paid");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setError("");
    const { data, error: err } = await supabase.from("event_tickets").select("*").eq("event_id", eventId).order("created_at", { ascending: true }).limit(1000);
    if (err) {
      setError("The tickets could not be loaded. If this is new, run supabase/schema.sql again in Supabase.");
      setRows([]);
      return;
    }
    setRows(data);
  };
  useEffect(() => {
    setRows(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const update = async (t, patch) => {
    setBusy(t.id);
    const { error: err } = await supabase.from("event_tickets").update(patch).eq("id", t.id);
    setBusy(null);
    if (err) {
      setError(err.code === "22023" ? err.message : "That change could not be saved. Try again.");
      return;
    }
    load();
  };

  const all = rows || [];
  const paid = all.filter((t) => t.status === "paid");
  const seatsSold = paid.reduce((s, t) => s + t.quantity, 0);
  const seatsHeld = all.filter((t) => isLiveHold(t)).reduce((s, t) => s + t.quantity, 0);
  const checkedIn = paid.filter((t) => t.checked_in_at).reduce((s, t) => s + t.quantity, 0);
  const revenue = paid.reduce((s, t) => s + (t.amount_cents || 0), 0);

  const term = searchTerm(query).toLowerCase();
  const shown = all
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => !term || [t.name, t.email, t.guest_name, t.folio, t.phone].some((x) => String(x || "").toLowerCase().includes(term)))
    .sort((a, b) => (a.folio && b.folio ? a.folio.localeCompare(b.folio) : Date.parse(b.created_at) - Date.parse(a.created_at)));
  const count = (id) => (id === "all" ? all.length : all.filter((t) => t.status === id).length);

  return (
    <>
      <PageHead
        title="Tickets"
        sub={event ? `${event.title}: ${event.subtitle} · ${event.dateLabel}, ${event.timeLabel}` : "Ticketed events"}
        actions={
          EVENTS.length > 1 && (
            <select className="ad-input" value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
              {EVENTS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.dateLabel})
                </option>
              ))}
            </select>
          )
        }
      />

      {event && (
        <div className="ad-kpis">
          <Tile id="sold" label="Seats sold" value={`${seatsSold} / ${event.capacity}`} sub={`${Math.max(event.capacity - seatsSold - seatsHeld, 0)} still available`} icon="check" />
          <Tile id="held" label="In checkout" value={seatsHeld} sub="held while they pay (35 min)" icon="clock" />
          <Tile id="in" label="Checked in" value={`${checkedIn} / ${seatsSold}`} sub="at the door" icon="hat" />
          <Tile id="revenue" label="Ticket sales" value={money(revenue)} sub="goes toward their hats" icon="money" />
        </div>
      )}

      <div className="ad-toolbar">
        <label className="ad-search" style={{ maxWidth: 520 }}>
          <span className="ad-sr">Search by name, email or folio</span>
          <Icon name="search" size={18} />
          <input type="search" className="ad-input" placeholder="Search name, email or folio" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="ad-chips" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="ad-fchip" aria-pressed={filter === f.id} data-filter={f.id} onClick={() => setFilter(f.id)}>
              {f.name}
              <span className="ad-fchip-n">{rows ? count(f.id) : "·"}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="ad-msg-err">
          {error}
        </p>
      )}

      {!rows ? (
        <div className="ad-rows" role="status" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={92} r={16} />
          ))}
        </div>
      ) : shown.length ? (
        <ul className="ad-rows">
          {shown.map((t) => (
            <li key={t.id}>
              <TicketRow t={t} busy={busy === t.id} onUpdate={(patch) => update(t, patch)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="ad-card">
          {all.length ? (
            <Empty icon="search" title="No tickets match">
              Try another name, or another filter.
            </Empty>
          ) : (
            <Empty icon="inbox" title="No tickets yet">
              Tickets show up here as soon as someone starts checkout, and get their folio when Stripe confirms the payment.
            </Empty>
          )}
        </div>
      )}
    </>
  );
}

function Tile({ id, label, value, sub, icon }) {
  return (
    <div className="ad-card ad-kpi" data-kpi={id}>
      <div className="ad-kpi-top">
        <span className="ad-kpi-label">{label}</span>
        <span className="ad-kpi-icon">
          <Icon name={icon} size={17} />
        </span>
      </div>
      <div className="ad-kpi-value">{value}</div>
      <div className="ad-kpi-sub">{sub}</div>
    </div>
  );
}

const STATUS_LOOK = {
  paid: { label: "Paid", bg: "#e3f1e6", ink: "#256b3a" },
  pending: { label: "Not paid", bg: "#fff1d6", ink: "#8a5a00" },
  expired: { label: "Checkout abandoned", bg: "#efe9e2", ink: "#6d5b4b" },
  cancelled: { label: "Cancelled", bg: "#f6dfdb", ink: "#9b3423" },
};

function TicketRow({ t, busy, onUpdate }) {
  const look = STATUS_LOOK[t.status === "pending" && !isLiveHold(t) ? "expired" : t.status] || STATUS_LOOK.pending;
  return (
    <div className="ad-card ad-ticket" data-ticket={t.folio || t.id}>
      <div className="ad-ticket-folio">{t.folio || "No folio"}</div>
      <div className="ad-ticket-main">
        <div className="ad-row-title">
          {t.name}
          {t.guest_name ? <span className="ad-muted" style={{ fontWeight: 600 }}> + {t.guest_name}</span> : null}
        </div>
        <div className="ad-row-meta">
          {t.quantity} {t.quantity === 1 ? "seat" : "seats"} · {t.email}
          {t.phone ? ` · ${t.phone}` : ""}
        </div>
        <div className="ad-row-meta">{t.paid_at ? `Paid ${dateTime(t.paid_at)} · ${money(t.amount_cents || 0)}` : `Started ${dateTime(t.created_at)}`}</div>
      </div>
      <div className="ad-ticket-side">
        <span className="ad-ticket-status" style={{ background: look.bg, color: look.ink }}>
          {look.label}
        </span>
        {t.status === "paid" && (
          <button
            type="button"
            className={`ad-btn ad-btn--sm ${t.checked_in_at ? "ad-btn--ghost" : "ad-btn--coral"}`}
            disabled={busy}
            onClick={() => onUpdate({ checked_in_at: t.checked_in_at ? null : new Date().toISOString() })}
            data-admin="check-in"
          >
            {t.checked_in_at ? "✓ Checked in" : "Check in"}
          </button>
        )}
        {t.status === "paid" && (
          <button
            type="button"
            className="ad-linkbtn"
            disabled={busy}
            onClick={() => window.confirm(`Cancel ticket ${t.folio}? Its seats become available again. Refund the payment in Stripe if needed.`) && onUpdate({ status: "cancelled" })}
          >
            Cancel ticket
          </button>
        )}
        {t.status === "cancelled" && t.folio && (
          <button type="button" className="ad-linkbtn" disabled={busy} onClick={() => onUpdate({ status: "paid" })}>
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
