import { useEffect, useState } from "react";
import ContactCard from "./Contact.jsx";
import { bookingTemplates, firstName } from "./contact.js";
import { BOOKING_STATUSES, bookingStatusOf, dateTime, eventDay } from "./format.js";
import { supabase } from "./supabase.js";
import { Icon, Skeleton, StatusBadge } from "./ui.jsx";

// One booking request: how to reach them (WhatsApp, email, call, ready made
// replies), the event, a timeline from the request to the latest change,
// and the three things staff can change: the status (rescheduled needs a
// proposed date), the proposed date, and the internal notes.
//
// Shown as its own page (/admin/bookings/<id>) or inside the calendar's and
// the board's side panel (`panel`). No email goes to the customer from here:
// the contact buttons only open apps on this device. Status changes go
// through staff_set_booking_status, which checks the caller is staff and
// writes the history row in the same transaction.

const ERRORS = { "42501": "Your account cannot change bookings.", P0002: "This booking no longer exists." };
const friendly = (err, fallback) => ERRORS[err?.code] || (err?.code === "22023" ? err.message : fallback);
const SOURCES = { website: "Website form", "sheet-import": "Imported from the Google Sheet", demo: "Demo" };

export default function BookingDetail({ id, onChanged, panel = false }) {
  const [booking, setBooking] = useState(undefined);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: b, error: e1 }, { data: ev, error: e2 }] = await Promise.all([
      supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
      supabase.from("booking_events").select("*").eq("booking_id", id).order("created_at", { ascending: true }),
    ]);
    if (e1 || e2) {
      setError("This booking could not be loaded. Try again in a moment.");
      setBooking(null);
      return;
    }
    setBooking(b ?? null);
    setEvents(ev ?? []);
  };

  useEffect(() => {
    setBooking(undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changed = () => {
    load();
    onChanged?.();
  };

  if (booking === undefined)
    return (
      <div role="status" aria-label="Loading" className="ad-detail">
        <Skeleton h={30} w="60%" />
        <Skeleton h={120} />
        <Skeleton h={200} />
      </div>
    );
  if (!booking)
    return (
      <>
        {!panel && <BackLink />}
        <p role="alert" className="ad-muted" style={{ marginTop: 20 }}>
          {error || "No booking here. It may have been removed, or the link is not complete."}
        </p>
      </>
    );

  const contact = (
    <ContactCard
      name={firstName(booking.name)}
      email={booking.email}
      phone={booking.phone}
      greeting={`Hi ${firstName(booking.name)}! This is Tippin' Cowgirl about your ${booking.event_type ? booking.event_type.toLowerCase() : "event"} request.`}
      templates={bookingTemplates(booking)}
    />
  );
  const request = (
    <section className="ad-card" aria-labelledby="request-title">
      <div className="ad-card-h">
        <h2 id="request-title">The request</h2>
      </div>
      <dl className="ad-dl">
        <dt>Name</dt>
        <dd>{booking.name}</dd>
        <dt>Email</dt>
        <dd>{booking.email ? <a href={`mailto:${booking.email}`}>{booking.email}</a> : "None"}</dd>
        <dt>Phone</dt>
        <dd>{booking.phone || "None"}</dd>
        <dt>Event type</dt>
        <dd>{booking.event_type || "Not given"}</dd>
        <dt>Event date</dt>
        <dd>{booking.event_date ? eventDay(booking.event_date) : "Not given"}</dd>
        {booking.proposed_date && (
          <>
            <dt>Proposed date</dt>
            <dd>{eventDay(booking.proposed_date)}</dd>
          </>
        )}
        <dt>Received</dt>
        <dd>{dateTime(booking.created_at)}</dd>
        <dt>Source</dt>
        <dd>{SOURCES[booking.source] || booking.source}</dd>
      </dl>
      <div className="ad-label" style={{ marginTop: 16 }}>
        Notes from the customer
      </div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, overflowWrap: "anywhere" }} data-booking="notes">
        {booking.notes || <span className="ad-muted">No notes.</span>}
      </p>
    </section>
  );
  const side = (
    <>
      <StatusCard booking={booking} onChanged={changed} />
      <NotesCard booking={booking} onSaved={changed} />
      <Timeline booking={booking} events={events} />
    </>
  );

  return (
    <>
      {!panel && <BackLink />}
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="ad-h1" style={{ fontSize: panel ? 26 : undefined, overflowWrap: "anywhere" }}>
            {booking.name}
          </h1>
          <StatusBadge kind="booking" status={booking.status} />
        </div>
        <p className="ad-sub">{[booking.event_type, booking.event_date ? eventDay(booking.event_date) : "No date given"].filter(Boolean).join(" · ")}</p>
      </header>
      {panel ? (
        <div className="ad-detail">
          {contact}
          {side}
          {request}
        </div>
      ) : (
        <div className="ad-detail ad-detail--wide">
          <div className="ad-detail">
            {contact}
            {request}
          </div>
          <div className="ad-detail">{side}</div>
        </div>
      )}
    </>
  );
}

function BackLink() {
  return (
    <a href="/admin/bookings" className="ad-back">
      <Icon name="left" size={16} /> All bookings
    </a>
  );
}

/** Received, then every status change, oldest first. */
function Timeline({ booking, events }) {
  // the first history row ("Requested on the website", "Imported from...")
  // is the request itself; it is folded into "Received"
  const first = events.find((e) => !e.from_status);
  const changes = events.filter((e) => e !== first);
  return (
    <section className="ad-card" aria-labelledby="timeline-title">
      <div className="ad-card-h">
        <h2 id="timeline-title">Timeline</h2>
      </div>
      <ol className="ad-tl" data-timeline>
        <li data-event="received" style={{ "--c": bookingStatusOf("new").color }}>
          <span className="ad-tl-dot" aria-hidden />
          <b>Request received</b>
          <small>{dateTime(booking.created_at)}</small>
          {first?.note && <p>{first.note}</p>}
        </li>
        {changes.map((e) => (
          <li key={e.id} data-event style={{ "--c": bookingStatusOf(e.to_status).color }}>
            <span className="ad-tl-dot" aria-hidden />
            <b>
              {e.from_status ? `${bookingStatusOf(e.from_status).name} to ${bookingStatusOf(e.to_status).name}` : bookingStatusOf(e.to_status).name}
            </b>
            <small>
              {dateTime(e.created_at)}
              {e.actor_email ? ` · ${e.actor_email}` : ""}
            </small>
            {e.note && <p>{e.note}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusCard({ booking, onChanged }) {
  const [next, setNext] = useState(booking.status);
  const [proposed, setProposed] = useState(booking.proposed_date || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  useEffect(() => {
    setNext(booking.status);
    setProposed(booking.proposed_date || "");
  }, [booking.status, booking.proposed_date]);

  const changed = next !== booking.status;
  const needsDate = next === "rescheduled";
  const proposedChanged = (proposed || null) !== (booking.proposed_date || null);

  const saveStatus = async () => {
    if (needsDate && !proposed) return setMsg({ text: "Pick the proposed date to mark it rescheduled.", ok: false });
    setBusy(true);
    setMsg({ text: "", ok: false });
    const { error } = await supabase.rpc("staff_set_booking_status", {
      p_booking_id: booking.id,
      p_status: next,
      p_proposed_date: needsDate ? proposed : null,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ text: friendly(error, "The status could not be changed. Try again."), ok: false });
    setNote("");
    setMsg({ text: `Marked ${bookingStatusOf(next).name.toLowerCase()}.`, ok: true });
    onChanged();
    return undefined;
  };

  const saveProposed = async () => {
    setBusy(true);
    setMsg({ text: "", ok: false });
    const { error } = await supabase.from("bookings").update({ proposed_date: proposed || null }).eq("id", booking.id);
    setBusy(false);
    if (error) return setMsg({ text: friendly(error, "The proposed date could not be saved. Try again."), ok: false });
    setMsg({ text: "Proposed date saved.", ok: true });
    onChanged();
    return undefined;
  };

  return (
    <section className="ad-card" aria-labelledby="status-title">
      <div className="ad-card-h">
        <div>
          <h2 id="status-title">Status</h2>
          <p>Changing the status does not email the customer. Reach out to them yourself for now.</p>
        </div>
      </div>
      <label htmlFor={`booking-status-${booking.id}`} className="ad-label">
        Move to
      </label>
      <select id={`booking-status-${booking.id}`} value={next} onChange={(e) => setNext(e.target.value)} className="ad-input" data-admin="status">
        {BOOKING_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.id === booking.status ? " (now)" : ""}
          </option>
        ))}
      </select>

      {(needsDate || booking.proposed_date || booking.status === "rescheduled") && (
        <>
          <label htmlFor={`proposed-${booking.id}`} className="ad-label" style={{ marginTop: 14 }}>
            Proposed date{needsDate && changed ? " (required)" : ""}
          </label>
          <input id={`proposed-${booking.id}`} type="date" value={proposed} onChange={(e) => setProposed(e.target.value)} className="ad-input" data-admin="proposed" />
        </>
      )}

      {changed && (
        <>
          <label htmlFor={`booking-note-${booking.id}`} className="ad-label" style={{ marginTop: 14 }}>
            Note for the history (optional)
          </label>
          <input id={`booking-note-${booking.id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="ad-input" data-admin="note" />
        </>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" className="ad-btn ad-btn--coral" disabled={!changed || busy} onClick={saveStatus} style={{ flex: "1 1 200px" }} data-admin="save-status">
          {changed ? `Mark ${bookingStatusOf(next).name.toLowerCase()}` : "Pick a new status"}
        </button>
        {!changed && proposedChanged && (
          <button type="button" className="ad-btn ad-btn--ghost" disabled={busy} onClick={saveProposed} style={{ flex: "1 1 200px" }} data-admin="save-proposed">
            Save proposed date
          </button>
        )}
      </div>
      {msg.text && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "ad-msg-ok" : "ad-msg-err"}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

function NotesCard({ booking, onSaved }) {
  const [notes, setNotes] = useState(booking.internal_notes || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  useEffect(() => setNotes(booking.internal_notes || ""), [booking.internal_notes]);
  const dirty = notes !== (booking.internal_notes || "");

  const save = async () => {
    setBusy(true);
    setMsg({ text: "", ok: false });
    const { error } = await supabase.from("bookings").update({ internal_notes: notes.trim() || null }).eq("id", booking.id);
    setBusy(false);
    if (error) return setMsg({ text: friendly(error, "The notes could not be saved. Try again."), ok: false });
    setMsg({ text: "Notes saved.", ok: true });
    onSaved();
    return undefined;
  };

  return (
    <section className="ad-card" aria-labelledby="bnotes-title">
      <div className="ad-card-h">
        <div>
          <h2 id="bnotes-title">Internal notes</h2>
          <p>Only staff see these. The customer never does.</p>
        </div>
      </div>
      <textarea
        aria-labelledby="bnotes-title"
        value={notes}
        rows={4}
        onChange={(e) => setNotes(e.target.value)}
        className="ad-input"
        style={{ resize: "vertical", lineHeight: 1.45 }}
        data-admin="notes"
      />
      <button type="button" className="ad-btn ad-btn--ghost" disabled={!dirty || busy} onClick={save} style={{ width: "100%", marginTop: 12 }} data-admin="save-notes">
        Save notes
      </button>
      {msg.text && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "ad-msg-ok" : "ad-msg-err"}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
