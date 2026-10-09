import { useEffect, useState } from "react";
import HatStack from "../shop/HatStack.jsx";
import { findSize } from "../shop/pricing.js";
import ContactCard from "./Contact.jsx";
import { firstName, orderTemplates } from "./contact.js";
import { STATUSES, addressLines, dateTime, money, statusOf } from "./format.js";
import { supabase } from "./supabase.js";
import { Icon, Skeleton, StatusBadge } from "./ui.jsx";

// One order: every hat drawn the way the customer built it (HatStack, from
// the config stored at payment), the customer and address with WhatsApp,
// email and call buttons, the totals, the status history, and the three
// things staff can change: the status (with a tracking number when it
// ships), the tracking number, and the notes.
//
// Status changes go through the staff_set_order_status function, which
// checks the caller is staff, requires a tracking number for "shipped", and
// writes the history row in the same transaction. The contact buttons only
// open apps on this device; nothing is sent from here.

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
      <div role="status" aria-label="Loading" className="ad-detail">
        <Skeleton h={30} w="60%" />
        <Skeleton h={160} />
        <Skeleton h={240} />
      </div>
    );
  if (!order)
    return (
      <>
        <BackLink />
        <p role="alert" className="ad-muted" style={{ marginTop: 20 }}>
          {error || "No order here. It may have been removed, or the link is not complete."}
        </p>
      </>
    );

  const hats = Array.isArray(order.hats) ? order.hats : [];
  const phone = order.shipping_address?.phone || null;
  return (
    <>
      <BackLink />
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="ad-h1" style={{ overflowWrap: "anywhere" }}>
            {order.customer_name || "No name"}
          </h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="ad-sub">
          {dateTime(order.created_at)} · {order.hat_count} {order.hat_count === 1 ? "hat" : "hats"} · {money(order.total, order.currency)}
        </p>
      </header>

      <div className="ad-detail ad-detail--wide">
        <div className="ad-detail">
          <section className="ad-card" aria-labelledby="hats-title">
            <div className="ad-card-h">
              <h2 id="hats-title">{hats.length === 1 ? "The hat" : `The hats (${hats.length})`}</h2>
            </div>
            <div style={{ display: "grid", gap: 22 }}>
              {hats.map((h, i) => (
                <Hat key={i} hat={h} n={i + 1} of={hats.length} currency={order.currency} />
              ))}
            </div>
          </section>

          <section className="ad-card" aria-labelledby="customer-title">
            <div className="ad-card-h">
              <h2 id="customer-title">Customer</h2>
            </div>
            <p style={{ margin: "0 0 4px", fontWeight: 800 }}>{order.customer_name}</p>
            {order.customer_email && (
              <a href={`mailto:${order.customer_email}`} style={{ color: "var(--ad-coral-deep)", fontWeight: 800, textDecoration: "none", overflowWrap: "anywhere" }}>
                {order.customer_email}
              </a>
            )}
            <div className="ad-label" style={{ marginTop: 14 }}>
              Ship to
            </div>
            <address style={{ fontStyle: "normal", lineHeight: 1.5, fontSize: 15 }}>
              {addressLines(order.shipping_address).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              {!order.shipping_address && <span className="ad-muted">No address on the payment.</span>}
            </address>
          </section>

          <section className="ad-card" aria-labelledby="totals-title">
            <div className="ad-card-h">
              <h2 id="totals-title">Totals</h2>
            </div>
            <dl className="ad-dl">
              <dt>Subtotal</dt>
              <dd>{money(order.subtotal, order.currency)}</dd>
              <dt>Shipping</dt>
              <dd>{order.shipping ? money(order.shipping, order.currency) : "Free"}</dd>
              <dt>Total charged</dt>
              <dd style={{ fontWeight: 900 }}>{money(order.total, order.currency)}</dd>
            </dl>
            <p className="ad-muted" style={{ fontSize: 12, marginTop: 10, wordBreak: "break-all" }}>
              Stripe: {order.stripe_session_id}
            </p>
          </section>
        </div>

        <div className="ad-detail">
          <StatusCard order={order} onChanged={load} />
          <ContactCard
            name={firstName(order.customer_name)}
            email={order.customer_email}
            phone={phone}
            greeting={`Hi ${firstName(order.customer_name)}! This is Tippin' Cowgirl about your order.`}
            templates={orderTemplates(order)}
          />
          <NotesCard order={order} onSaved={load} />
          <section className="ad-card" aria-labelledby="history-title">
            <div className="ad-card-h">
              <h2 id="history-title">History</h2>
            </div>
            <ol className="ad-tl" data-timeline>
              {events.map((e) => (
                <li key={e.id} data-event style={{ "--c": statusOf(e.to_status).color }}>
                  <span className="ad-tl-dot" aria-hidden />
                  <b>{e.from_status ? `${statusOf(e.from_status).name} to ${statusOf(e.to_status).name}` : statusOf(e.to_status).name}</b>
                  <small>
                    {dateTime(e.created_at)}
                    {e.actor_email ? ` · ${e.actor_email}` : ""}
                  </small>
                  {e.note && <p>{e.note}</p>}
                </li>
              ))}
              {!events.length && <li className="ad-muted">No changes yet.</li>}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <a href="/admin/orders" className="ad-back">
      <Icon name="left" size={16} /> All orders
    </a>
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
      <div className="ad-label" style={{ margin: 0 }}>
        Hat {n}
        {of > 1 ? ` of ${of}` : ""}
      </div>
      {hat.config ? (
        <div className="ad-hat">
          <HatStack config={hat.config} alt={`${hat.color} ${hat.hat_label}`} />
        </div>
      ) : (
        <p className="ad-muted">This order came from the first builder, so it has no preview.</p>
      )}
      <dl className="ad-dl">
        {rows.map(([k, v], i) => (
          <div key={k + i} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
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
    <section className="ad-card" aria-labelledby="status-title">
      <div className="ad-card-h">
        <h2 id="status-title">Status</h2>
      </div>
      <label htmlFor="status-select" className="ad-label">
        Move to
      </label>
      <select id="status-select" value={next} onChange={(e) => setNext(e.target.value)} className="ad-input" data-admin="status">
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.id === order.status ? " (now)" : ""}
          </option>
        ))}
      </select>

      {(needsTracking || order.tracking_number || order.status === "shipped") && (
        <>
          <label htmlFor="tracking" className="ad-label" style={{ marginTop: 14 }}>
            Tracking number{needsTracking && changed ? " (required)" : ""}
          </label>
          <input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} className="ad-input" autoComplete="off" data-admin="tracking" />
        </>
      )}

      {changed && (
        <>
          <label htmlFor="status-note" className="ad-label" style={{ marginTop: 14 }}>
            Note for the history (optional)
          </label>
          <input id="status-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="ad-input" data-admin="note" />
        </>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <button type="button" className="ad-btn ad-btn--coral" disabled={!changed || busy} onClick={saveStatus} style={{ flex: "1 1 200px" }} data-admin="save-status">
          {changed ? `Mark ${statusOf(next).name.toLowerCase()}` : "Pick a new status"}
        </button>
        {!changed && trackingChanged && (
          <button type="button" className="ad-btn ad-btn--ghost" disabled={busy} onClick={saveTracking} style={{ flex: "1 1 200px" }} data-admin="save-tracking">
            Save tracking number
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
    <section className="ad-card" aria-labelledby="notes-title">
      <div className="ad-card-h">
        <div>
          <h2 id="notes-title">Internal notes</h2>
          <p>Only staff see these. The customer never does.</p>
        </div>
      </div>
      <textarea
        id="notes"
        aria-labelledby="notes-title"
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
