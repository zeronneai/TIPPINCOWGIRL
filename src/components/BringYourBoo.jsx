// ---------------------------------------------------------------------------
// /bringyourboo: the ticketed "Bring Your Boo: Boots, Brims & Bubbly" night,
// and /bringyourboo/ticket?session_id=... where Stripe returns the buyer.
//
// Standalone like /giveaway (no nav, cart or footer) and its own chunk. The
// event facts come from src/events/ticketed.js; the seats left from
// GET /api/tickets; the purchase starts with POST /api/tickets, which holds
// the seats and returns the Stripe Checkout URL. See that file for the flow.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { TICKET_LIMITS, cleanTicketRequest, getTicketedEvent, money, salesOpen } from "../events/ticketed.js";
import logo from "/logo.png";
import "./BringYourBoo.css";

const EVENT = getTicketedEvent("bring-your-boo-2026");
const IG = "https://www.instagram.com/_tippincowgirl/";

function usePageMeta(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

/** Google Calendar link for the event (no account needed to open it). */
function calendarLink() {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${EVENT.title}: ${EVENT.subtitle} at Tippin' Cowgirl`,
    dates: `${fmt(EVENT.startsAt)}/${fmt(EVENT.endsAt)}`,
    location: EVENT.address,
    details: "Bring your ticket number. Your ticket price goes toward your hat that night.",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export default function BringYourBoo({ path }) {
  return path.endsWith("/ticket") ? <TicketView /> : <EventPage />;
}

// ---- the event page -------------------------------------------------------------------------
function EventPage() {
  usePageMeta(`${EVENT.title}: ${EVENT.subtitle} | Tippin' Cowgirl`);
  const [seats, setSeats] = useState({ remaining: null, open: salesOpen(EVENT) });
  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cancelled") === "1";

  const loadSeats = () =>
    fetch(`/api/tickets?event=${EVENT.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSeats({ remaining: d.remaining, open: d.open }))
      .catch(() => {});
  useEffect(() => {
    loadSeats();
  }, []);

  const soldOut = seats.remaining === 0;

  return (
    <div className="byb-page">
      <div className="byb-wrap">
        <header className="byb-hero">
          <a href="/" className="byb-logo" aria-label="Tippin' Cowgirl home">
            <img src={logo} alt="" width="54" height="54" />
          </a>
          <p className="byb-kicker">Tippin' Cowgirl presents</p>
          <h1 className="byb-title">
            Bring Your <span>Boo</span>
          </h1>
          <p className="byb-sub">{EVENT.subtitle}</p>
          <ul className="byb-facts" aria-label="When and where">
            <li>
              <b>{EVENT.dateLabel}</b>
              <span>{EVENT.timeLabel}</span>
            </li>
            <li>
              <b>The Hat Bar</b>
              <span>Shoppes at Solana</span>
            </li>
          </ul>
        </header>

        <section className="byb-card byb-intro">
          <p>
            A cute western night out at the hat bar. Your boo can be your boyfriend, your girlfriend, your spouse or your
            bestie, so make it a <b>date night</b> or a <b>girls' night</b> 👻🤠
          </p>
          <ul className="byb-list">
            <li>🎶 Live country music</li>
            <li>🥂 Complimentary drinks</li>
            <li>🧀 Small bites</li>
            <li>📸 A cute photo area</li>
          </ul>
        </section>

        <section className="byb-card byb-deal" aria-labelledby="byb-deal-h">
          <h2 id="byb-deal-h">The deal</h2>
          <p>
            Tickets are <b>{money(EVENT.priceCents)} per person</b>, and the full {money(EVENT.priceCents)} goes toward your hat
            that night.
          </p>
          <p className="byb-special">
            <b>Bring your boo special:</b> when two guests buy hats, each one gets a free premium upgrade (a pin, a studded band
            or a feather bundle) plus a pair of matching custom branded leather keychains 💕
          </p>
        </section>

        <section className="byb-card byb-buy" aria-labelledby="byb-buy-h">
          <div className="byb-buy-head">
            <h2 id="byb-buy-h">Get your tickets</h2>
            <SeatsBadge remaining={seats.remaining} />
          </div>
          {cancelled && (
            <p className="byb-note" role="status">
              Checkout was cancelled, nothing was charged. You can try again below.
            </p>
          )}
          {!seats.open ? (
            <p className="byb-closed">Ticket sales for this night are closed. Follow us for the next one!</p>
          ) : soldOut ? (
            <p className="byb-closed">
              This night is sold out 🖤 DM{" "}
              <a href={IG} target="_blank" rel="noopener noreferrer">
                @_tippincowgirl
              </a>{" "}
              to join the waitlist.
            </p>
          ) : (
            <TicketForm remaining={seats.remaining} onSeatsChanged={loadSeats} />
          )}
        </section>

        <p className="byb-foot">
          Limited spots so it stays cozy. Questions? DM{" "}
          <a href={IG} target="_blank" rel="noopener noreferrer">
            @_tippincowgirl
          </a>
          .
        </p>
      </div>
    </div>
  );
}

// No seat count on the public page, on purpose: only "Sold out", or a
// nudge once few are left. The exact numbers are for the staff portal.
const FEW_LEFT = 5;
function SeatsBadge({ remaining }) {
  if (remaining === null || remaining === undefined) return null;
  if (remaining === 0) return <span className="byb-badge byb-badge--out">Sold out</span>;
  if (remaining <= FEW_LEFT)
    return (
      <span className="byb-badge" aria-live="polite">
        Almost sold out
      </span>
    );
  return null;
}

const EMPTY = { name: "", email: "", phone: "", guestName: "", quantity: 2, company: "" };

function TicketForm({ remaining, onSeatsChanged }) {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [message, setMessage] = useState("");
  const formRef = useRef(null);

  const max = Math.max(1, Math.min(EVENT.maxPerOrder, remaining ?? EVENT.maxPerOrder));
  useEffect(() => {
    if (v.quantity > max) setV((x) => ({ ...x, quantity: max }));
  }, [max, v.quantity]);

  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x));
  };
  const setQty = (q) => setV((x) => ({ ...x, quantity: Math.max(1, Math.min(max, q)) }));

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    const checked = cleanTicketRequest(v, EVENT);
    if (!checked.ok && !checked.spam) {
      setErrors(checked.errors);
      formRef.current?.querySelector(`#byb-${Object.keys(checked.errors)[0]}`)?.focus();
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, eventId: EVENT.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        window.location.assign(d.url);
        return;
      }
      if (r.ok && !d.url) {
        setStatus("idle");
        return;
      }
      if (d.errors) setErrors(d.errors);
      setMessage(d.error || "Something hiccuped. Try again in a moment.");
      setStatus("error");
      if (r.status === 409) onSeatsChanged();
    } catch {
      setMessage("Something hiccuped on the network. Try again in a moment.");
      setStatus("error");
    }
  };

  const field = (id, label, props, optional) => (
    <div className="byb-field">
      <label htmlFor={`byb-${id}`}>
        {label}
        {optional && <span> (optional)</span>}
      </label>
      <input
        id={`byb-${id}`}
        value={v[id]}
        onChange={set(id)}
        maxLength={TICKET_LIMITS[id]}
        aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? `byb-${id}-err` : undefined}
        {...props}
      />
      {errors[id] && (
        <p id={`byb-${id}-err`} className="byb-err" role="alert">
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      {field("name", "Your name", { type: "text", autoComplete: "name" })}
      {field("email", "Email (your ticket goes here)", { type: "email", autoComplete: "email" })}
      {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
      {field("guestName", "Who's your boo?", { type: "text", autoComplete: "off", placeholder: "Their name" }, true)}

      <div className="byb-field">
        <span className="byb-label" id="byb-qty-label">
          Tickets
        </span>
        <div className="byb-qty-row">
          <span className="byb-stepper" role="group" aria-labelledby="byb-qty-label">
            <button type="button" aria-label="One less ticket" disabled={v.quantity <= 1} onClick={() => setQty(v.quantity - 1)}>
              −
            </button>
            <output id="byb-quantity" aria-live="polite">
              {v.quantity}
            </output>
            <button type="button" aria-label="One more ticket" disabled={v.quantity >= max} onClick={() => setQty(v.quantity + 1)}>
              +
            </button>
          </span>
          <span className="byb-total">
            Total <b>{money(v.quantity * EVENT.priceCents)}</b>
          </span>
        </div>
        {errors.quantity && (
          <p className="byb-err" role="alert">
            {errors.quantity}
          </p>
        )}
      </div>

      {/* honeypot, as on the booking form */}
      <div className="tc-hp" aria-hidden="true">
        <label htmlFor="byb-company">Company</label>
        <input id="byb-company" tabIndex={-1} autoComplete="off" value={v.company} onChange={set("company")} />
      </div>

      {message && (
        <p className="byb-err byb-err--block" role="alert">
          {message}
        </p>
      )}
      <button type="submit" className="byb-btn" disabled={status === "sending"}>
        {status === "sending" ? "One sec..." : `Pay ${money(v.quantity * EVENT.priceCents)} and save my spot`}
      </button>
      <p className="byb-small">Secure checkout with Stripe. Your ticket number shows up right after you pay and lands in your email.</p>
    </form>
  );
}

// ---- the ticket, after Stripe ---------------------------------------------------------------
function TicketView() {
  usePageMeta(`Your ticket | ${EVENT.title}`);
  const sessionId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session_id") || "" : "";
  const [state, setState] = useState({ loading: true, ticket: null, error: "" });

  useEffect(() => {
    if (!sessionId) {
      setState({ loading: false, ticket: null, error: "This link is missing its ticket. Check your email for the ticket we sent you." });
      return undefined;
    }
    let alive = true;
    let tries = 0;
    const load = async () => {
      tries += 1;
      try {
        const r = await fetch(`/api/tickets?session_id=${encodeURIComponent(sessionId)}`);
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) {
          setState({ loading: false, ticket: null, error: d.error || "We could not load your ticket." });
          return;
        }
        // Stripe can take a few seconds to confirm: keep asking a little while
        if (d.ticket?.status === "pending" && tries < 10) {
          setState({ loading: true, ticket: d.ticket, error: "" });
          setTimeout(load, 2000);
          return;
        }
        setState({ loading: false, ticket: d.ticket, error: "" });
      } catch {
        if (alive) setState({ loading: false, ticket: null, error: "Something hiccuped on the network. Refresh in a moment." });
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const t = state.ticket;
  return (
    <div className="byb-page">
      <div className="byb-wrap">
        <header className="byb-hero byb-hero--small">
          <a href="/" className="byb-logo" aria-label="Tippin' Cowgirl home">
            <img src={logo} alt="" width="48" height="48" />
          </a>
          <h1 className="byb-title byb-title--small">
            Bring Your <span>Boo</span>
          </h1>
        </header>

        {state.loading && !t?.folio ? (
          <section className="byb-card byb-center" role="status">
            <p>Confirming your payment with Stripe...</p>
          </section>
        ) : state.error ? (
          <section className="byb-card byb-center">
            <p role="alert">{state.error}</p>
            <a className="byb-btn byb-btn--ghost" href={EVENT.path}>
              Back to the event
            </a>
          </section>
        ) : t?.status === "paid" && t.folio ? (
          <>
            <section className="byb-ticket" aria-label="Your ticket">
              <p className="byb-ticket-k">You're in, {t.name.split(" ")[0]}! 🤠</p>
              <p className="byb-ticket-label">Ticket</p>
              <p className="byb-folio" data-testid="folio">
                {t.folio}
              </p>
              <p className="byb-ticket-admit">
                Admits {t.quantity} {t.quantity === 1 ? "guest" : "guests"}
                {t.guestName ? ` · with ${t.guestName}` : ""}
              </p>
              <div className="byb-ticket-cut" aria-hidden />
              <p className="byb-ticket-when">
                <b>
                  {EVENT.dateLabel}, {EVENT.timeLabel}
                </b>
                <br />
                {EVENT.venue}
                <br />
                {EVENT.address}
              </p>
            </section>
            <p className="byb-small byb-center-text">
              Show this screen or your ticket number at the door. We also emailed it to you. Your {money(EVENT.priceCents)} per
              ticket goes toward your hat that night.
            </p>
            <a className="byb-btn" href={calendarLink()} target="_blank" rel="noopener noreferrer">
              Add to my calendar
            </a>
          </>
        ) : t?.status === "cancelled" ? (
          <section className="byb-card byb-center">
            <p>This ticket was cancelled. DM us on Instagram if that looks wrong.</p>
          </section>
        ) : (
          <section className="byb-card byb-center">
            <p>
              Your payment is still being confirmed. Give it a minute and refresh this page, or check your email for your ticket.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
