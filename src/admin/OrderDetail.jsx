import { useEffect, useState } from "react";
import HatStack from "../shop/HatStack.jsx";
import { findSize } from "../shop/pricing.js";
import { STATUSES, addressLines, dateTime, money, statusOf } from "./format.js";
import { supabase } from "./supabase.js";
import { StatusBadge, ui } from "./ui.jsx";

// One order: every hat drawn the way the customer built it (HatStack, from
// the config stored at payment), the customer and address, the totals, the
// status history, and the three things staff can change: the status (with
// a tracking number when it ships), the tracking number, and the notes.
//
// Status changes go through the staff_set_order_status function, which
// checks the caller is staff, requires a tracking number for "shipped", and
// writes the history row in the same transaction.

const ERRORS = {
  "42501": "Your account cannot change orders.",
  P0002: "This order no longer exists.",
};
const friendly = (err, fallback) => ERRORS[err?.code] || (err?.code === "22023" ? err.message : fallback);

export default function OrderDetail({ id }) {
  const [order, setOrder] = useState(undefined);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: o, error: e1 }, { data: ev, error: e2 }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    ]);
    if (e1 || e2) {
      setError("This order could not be loaded. Try again in a moment.");
      setOrder(null);
      return;
    }
    setOrder(o ?? null);
    setEvents(ev ?? []);
  };

  useEffect(() => {
    setOrder(undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (order === undefined)
    return (
      <p style={{ ...ui.muted, textAlign: "center", marginTop: 40 }} role="status">
        Loading
      </p>
    );
  if (!order)
    return (
      <>
        <BackLink />
        <p role="alert" style={{ ...ui.muted, marginTop: 20 }}>
          {error || "No order here. It may have been removed, or the link is not complete."}
        </p>
      </>
    );

  const hats = Array.isArray(order.hats) ? order.hats : [];
  return (
    <>
      <BackLink />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "6px 0 4px" }}>
        <h1 style={{ ...ui.h1, margin: 0 }}>{order.customer_name || "No name"}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p style={{ ...ui.muted, margin: "0 0 16px" }}>
        {dateTime(order.created_at)} · {order.hat_count} {order.hat_count === 1 ? "hat" : "hats"} · {money(order.total, order.currency)}
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        <StatusCard order={order} onChanged={load} />

        <section style={ui.card} aria-labelledby="hats-title">
          <h2 id="hats-title" style={ui.h2}>
            {hats.length === 1 ? "The hat" : `The hats (${hats.length})`}
          </h2>
          <div style={{ display: "grid", gap: 18 }}>
            {hats.map((h, i) => (
              <Hat key={i} hat={h} n={i + 1} of={hats.length} currency={order.currency} />
            ))}
          </div>
        </section>

        <section style={ui.card} aria-labelledby="customer-title">
          <h2 id="customer-title" style={ui.h2}>
            Customer
          </h2>
          <p style={{ margin: "0 0 4px", fontWeight: 800 }}>{order.customer_name}</p>
          {order.customer_email && (
            <a href={`mailto:${order.customer_email}`} style={ui.link}>
              {order.customer_email}
            </a>
          )}
          <div style={{ ...ui.label, marginTop: 14 }}>Ship to</div>
          <address style={{ fontStyle: "normal", lineHeight: 1.5, fontSize: 15 }}>
            {addressLines(order.shipping_address).map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            {!order.shipping_address && <span style={ui.muted}>No address on the payment.</span>}
          </address>
        </section>

        <section style={ui.card} aria-labelledby="totals-title">
          <h2 id="totals-title" style={ui.h2}>
            Totals
          </h2>
          <Rows
            rows={[
              ["Subtotal", money(order.subtotal, order.currency)],
              ["Shipping", order.shipping ? money(order.shipping, order.currency) : "Free"],
              ["Total charged", money(order.total, order.currency)],
            ]}
            strongLast
          />
          <p style={{ ...ui.muted, fontSize: 12, marginTop: 10, wordBreak: "break-all" }}>Stripe: {order.stripe_session_id}</p>
        </section>

        <NotesCard order={order} onSaved={load} />

        <section style={ui.card} aria-labelledby="history-title">
          <h2 id="history-title" style={ui.h2}>
            History
          </h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {events.map((e) => (
              <li key={e.id} data-event style={{ borderLeft: "3px solid var(--coral)", paddingLeft: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>
                  {e.from_status ? `${statusOf(e.from_status).name} to ${statusOf(e.to_status).name}` : statusOf(e.to_status).name}
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
    <a href="/admin" style={{ ...ui.link, display: "inline-block", margin: "6px 0 8px" }}>
      All orders
    </a>
  );
}

function Rows({ rows, strongLast = false }) {
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(90px, auto) 1fr", gap: "6px 14px", fontSize: 15 }}>
      {rows.map(([k, v], i) => (
        <div key={k + i} style={{ display: "contents" }}>
          <dt style={{ color: "#7a6553", fontWeight: 700 }}>{k}</dt>
          <dd style={{ margin: 0, fontWeight: strongLast && i === rows.length - 1 ? 800 : 600, overflowWrap: "anywhere" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Hat({ hat, n, of, currency }) {
  const size = findSize(hat.size, hat.hat_type);
  const sizeText = size ? (size.us ? `${size.name} (US ${size.us})` : `${size.name} (${size.inches})`) : hat.size_label || hat.size || "Not set";
  const rows = [
    ["Hat", hat.hat_label],
    ["Color", hat.color || hat.base_id],
    ["Size", sizeText],
    ["Quantity", String(hat.quantity)],
    ...(hat.accessories || []).map((a) => [a.label, a.detail ? `${a.name}, ${a.detail}` : a.name]),
    ...(hat.stitching_note ? [["Color note", hat.stitching_note]] : []),
    ...(hat.engraving_rows || []),
    ...(hat.legacy && hat.legacy_fields
      ? [
          ["Band (first builder)", hat.legacy_fields.bandId || "none"],
          ["Brand (first builder)", hat.legacy_fields.brandId || "none"],
          ...(hat.legacy_fields.customText ? [["Custom text", hat.legacy_fields.customText]] : []),
        ]
      : []),
    ...(hat.unit_price != null ? [["Price", hat.quantity > 1 ? `${money(hat.unit_price, currency)} each` : money(hat.unit_price, currency)]] : []),
  ];
  return (
    <article data-hat={n} style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: "#6f4526", letterSpacing: ".06em", textTransform: "uppercase" }}>
        Hat {n}
        {of > 1 ? ` of ${of}` : ""}
      </div>
      {hat.config ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 360,
            aspectRatio: "1 / 1",
            borderRadius: 14,
            overflow: "hidden",
            border: "1.5px solid rgba(43,26,16,.2)",
            background: "radial-gradient(80% 70% at 50% 38%, #fffaf0 0%, var(--cream-2) 70%)",
          }}
        >
          <HatStack config={hat.config} alt={`${hat.color} ${hat.hat_label}`} />
        </div>
      ) : (
        <p style={ui.muted}>This order came from the first builder, so it has no preview.</p>
      )}
      <Rows rows={rows} />
    </article>
  );
}

function StatusCard({ order, onChanged }) {
  const [next, setNext] = useState(order.status);
  const [tracking, setTracking] = useState(order.tracking_number || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });

  useEffect(() => {
    setNext(order.status);
    setTracking(order.tracking_number || "");
  }, [order.status, order.tracking_number]);

  const needsTracking = next === "shipped";
  const changed = next !== order.status;
  const trackingChanged = (tracking.trim() || null) !== (order.tracking_number || null);

  const saveStatus = async () => {
    if (needsTracking && !tracking.trim()) return setMsg({ text: "Add the tracking number to mark it shipped.", ok: false });
    setBusy(true);
    setMsg({ text: "", ok: false });
    const { error } = await supabase.rpc("staff_set_order_status", {
      p_order_id: order.id,
      p_status: next,
      p_tracking_number: needsTracking ? tracking.trim() : null,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ text: friendly(error, "The status could not be changed. Try again."), ok: false });
    setNote("");
    setMsg({ text: `Marked ${statusOf(next).name.toLowerCase()}.`, ok: true });
    onChanged();
    return undefined;
  };

  const saveTracking = async () => {
    setBusy(true);
    setMsg({ text: "", ok: false });
    const { error } = await supabase.from("orders").update({ tracking_number: tracking.trim() || null }).eq("id", order.id);
    setBusy(false);
    if (error) return setMsg({ text: friendly(error, "The tracking number could not be saved. Try again."), ok: false });
    setMsg({ text: "Tracking number saved.", ok: true });
    onChanged();
    return undefined;
  };

  return (
    <section style={ui.card} aria-labelledby="status-title">
      <h2 id="status-title" style={ui.h2}>
        Status
      </h2>
      <label htmlFor="status-select" style={ui.label}>
        Move to
      </label>
      <select id="status-select" value={next} onChange={(e) => setNext(e.target.value)} style={ui.input} data-admin="status">
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.id === order.status ? " (now)" : ""}
          </option>
        ))}
      </select>

      {(needsTracking || order.tracking_number || order.status === "shipped") && (
        <>
          <label htmlFor="tracking" style={{ ...ui.label, marginTop: 14 }}>
            Tracking number{needsTracking && changed ? " (required)" : ""}
          </label>
          <input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} style={ui.input} autoComplete="off" data-admin="tracking" />
        </>
      )}

      {changed && (
        <>
          <label htmlFor="status-note" style={{ ...ui.label, marginTop: 14 }}>
            Note for the history (optional)
          </label>
          <input id="status-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} style={ui.input} data-admin="note" />
        </>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" className="tc-btn" disabled={!changed || busy} onClick={saveStatus} style={{ flex: "1 1 200px" }} data-admin="save-status">
          {changed ? `Mark ${statusOf(next).name.toLowerCase()}` : "Pick a new status"}
        </button>
        {!changed && trackingChanged && (
          <button type="button" className="tc-btn tc-btn--ghost" disabled={busy} onClick={saveTracking} style={{ flex: "1 1 200px" }} data-admin="save-tracking">
            Save tracking number
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

function NotesCard({ order, onSaved }) {
  const [notes, setNotes] = useState(order.internal_notes || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  useEffect(() => setNotes(order.internal_notes || ""), [order.internal_notes]);
  const dirty = notes !== (order.internal_notes || "");

  const save = async () => {
    setBusy(true);
    setMsg({ text: "", ok: false });
    const { error } = await supabase.from("orders").update({ internal_notes: notes.trim() || null }).eq("id", order.id);
    setBusy(false);
    if (error) return setMsg({ text: friendly(error, "The notes could not be saved. Try again."), ok: false });
    setMsg({ text: "Notes saved.", ok: true });
    onSaved();
    return undefined;
  };

  return (
    <section style={ui.card} aria-labelledby="notes-title">
      <h2 id="notes-title" style={ui.h2}>
        Internal notes
      </h2>
      <p style={{ ...ui.muted, margin: "0 0 10px" }}>Only staff see these. The customer never does.</p>
      <textarea
        id="notes"
        aria-labelledby="notes-title"
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
