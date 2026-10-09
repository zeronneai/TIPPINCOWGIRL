import { useEffect, useState } from "react";
import { BOOKING_STATUSES, bookingStatusOf, dateTime, eventDay } from "./format.js";
import { supabase } from "./supabase.js";
import { StatusBadge, ui } from "./ui.jsx";

// One booking request: who, how to reach them, the event, the history, and
// the three things staff can change: the status (rescheduled needs a
// proposed date), the proposed date, and the internal notes.
//
// No email goes to the customer from here yet: accept, decline and
// reschedule messages come in a later phase, once their wording is approved.
// Status changes go through staff_set_booking_status, which checks the
// caller is staff and writes the history row in the same transaction.

const ERRORS = { "42501": "Your account cannot change bookings.", P0002: "This booking no longer exists." };
const friendly = (err, fallback) => ERRORS[err?.code] || (err?.code === "22023" ? err.message : fallback);
const SOURCES = { website: "Website form", "sheet-import": "Imported from the Google Sheet", demo: "Demo" };

export default function BookingDetail({ id, onChanged }) {
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
      <p style={{ ...ui.muted, textAlign: "center", marginTop: 40 }} role="status">
        Loading
      </p>
    );
  if (!booking)
    return (
      <>
        <BackLink />
        <p role="alert" style={{ ...ui.muted, marginTop: 20 }}>
          {error || "No booking here. It may have been removed, or the link is not complete."}
        </p>
      </>
    );

  return (
    <>
      <BackLink />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "6px 0 4px" }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>{booking.name}</h1>
        <StatusBadge kind="booking" status={booking.status} />
      </div>
      <p style={{ ...ui.muted, margin: "0 0 16px" }}>
        {[booking.event_type, booking.event_date ? eventDay(booking.event_date) : "No date given"].filter(Boolean).join(" · ")}
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        <StatusCard booking={booking} onChanged={changed} />

        <section style={ui.card} aria-labelledby="request-title">
          <h2 id="request-title" style={ui.h2}>
            The request
          </h2>
          <Rows
            rows={[
              ["Name", booking.name],
              [
                "Email",
                booking.email ? (
                  <a href={`mailto:${booking.email}`} style={ui.link}>
                    {booking.email}
                  </a>
                ) : (
                  "None"
                ),
              ],
              [
                "Phone",
                booking.phone ? (
                  <a href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`} style={ui.link}>
                    {booking.phone}
                  </a>
                ) : (
                  "None"
                ),
              ],
              ["Event type", booking.event_type || "Not given"],
              ["Event date", booking.event_date ? eventDay(booking.event_date) : "Not given"],
              ...(booking.proposed_date ? [["Proposed date", eventDay(booking.proposed_date)]] : []),
              ["Sent", dateTime(booking.created_at)],
              ["Source", SOURCES[booking.source] || booking.source],
            ]}
          />
          <div style={{ ...ui.label, marginTop: 14 }}>Notes from the customer</div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 15 }} data-booking="notes">
            {booking.notes || <span style={ui.muted}>No notes.</span>}
          </p>
        </section>

        <NotesCard booking={booking} onSaved={changed} />

        <section style={ui.card} aria-labelledby="history-title">
          <h2 id="history-title" style={ui.h2}>
            History
          </h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {events.map((e) => (
              <li key={e.id} data-event style={{ borderLeft: "3px solid var(--coral)", paddingLeft: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>
                  {e.from_status ? `${bookingStatusOf(e.from_status).name} to ${bookingStatusOf(e.to_status).name}` : bookingStatusOf(e.to_status).name}
                </div>
                <div style={{ fontSize: 12.5, color: "#7a6553" }}>
                  {dateTime(e.created_at)}
                  {e.actor_email ? ` · ${e.actor_email}` : ""}
                </div>
                {e.note && <div style={{ fontSize: 14, marginTop: 2 }}>{e.note}</div>}
              </li>
            ))}
            {!events.length && <li style={ui.muted}>No changes yet.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <a href="/admin/bookings" style={{ ...ui.link, display: "inline-block", margin: "6px 0 8px" }}>
      All bookings
    </a>
  );
}

function Rows({ rows }) {
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(96px, auto) 1fr", gap: "6px 14px", fontSize: 15 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ color: "#7a6553", fontWeight: 700 }}>{k}</dt>
          <dd style={{ margin: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{v}</dd>
        </div>
      ))}
    </dl>
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
    <section style={ui.card} aria-labelledby="status-title">
      <h2 id="status-title" style={ui.h2}>
        Status
      </h2>
      <p style={{ ...ui.muted, margin: "0 0 12px", fontSize: 13 }}>Changing the status does not email the customer. Reach out to them yourself for now.</p>
      <label htmlFor="booking-status" style={ui.label}>
        Move to
      </label>
      <select id="booking-status" value={next} onChange={(e) => setNext(e.target.value)} style={ui.input} data-admin="status">
        {BOOKING_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.id === booking.status ? " (now)" : ""}
          </option>
        ))}
      </select>

      {(needsDate || booking.proposed_date || booking.status === "rescheduled") && (
        <>
          <label htmlFor="proposed" style={{ ...ui.label, marginTop: 14 }}>
            Proposed date{needsDate && changed ? " (required)" : ""}
          </label>
          <input id="proposed" type="date" value={proposed} onChange={(e) => setProposed(e.target.value)} style={ui.input} data-admin="proposed" />
        </>
      )}

      {changed && (
        <>
          <label htmlFor="booking-note" style={{ ...ui.label, marginTop: 14 }}>
            Note for the history (optional)
          </label>
          <input id="booking-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} style={ui.input} data-admin="note" />
        </>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" className="tc-btn" disabled={!changed || busy} onClick={saveStatus} style={{ flex: "1 1 200px" }} data-admin="save-status">
          {changed ? `Mark ${bookingStatusOf(next).name.toLowerCase()}` : "Pick a new status"}
        </button>
        {!changed && proposedChanged && (
          <button type="button" className="tc-btn tc-btn--ghost" disabled={busy} onClick={saveProposed} style={{ flex: "1 1 200px" }} data-admin="save-proposed">
            Save proposed date
          </button>
        )}
      </div>
      {msg.text && (
        <p role={msg.ok ? "status" : "alert"} style={msg.ok ? ui.ok : ui.error}>
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
    <section style={ui.card} aria-labelledby="bnotes-title">
      <h2 id="bnotes-title" style={ui.h2}>
        Internal notes
      </h2>
      <p style={{ ...ui.muted, margin: "0 0 10px" }}>Only staff see these. The customer never does.</p>
      <textarea
        aria-labelledby="bnotes-title"
        value={notes}
        rows={4}
        onChange={(e) => setNotes(e.target.value)}
        style={{ ...ui.input, resize: "vertical", lineHeight: 1.45 }}
        data-admin="notes"
      />
      <button type="button" className="tc-btn tc-btn--ghost" disabled={!dirty || busy} onClick={save} style={{ width: "100%", marginTop: 12 }} data-admin="save-notes">
        Save notes
      </button>
      {msg.text && (
        <p role={msg.ok ? "status" : "alert"} style={msg.ok ? ui.ok : ui.error}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
