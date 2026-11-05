// ---------------------------------------------------------------------------
// The shared ticketed event page: the stage (video or photo), the flyer, the
// ticket form that goes to Stripe, and /<event>/ticket?session_id=... where
// Stripe returns the buyer. Each event page (BringYourBoo.jsx,
// BrimsAndBlowouts.jsx) only passes its words and pictures.
//
// The event facts come from src/events/ticketed.js; the seats left from
// GET /api/tickets; the purchase starts with POST /api/tickets, which holds
// the seats and returns the Stripe Checkout URL. See that file for the flow.
// The look is BringYourBoo.css (byb-* classes), shared by every event.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { TICKET_LIMITS, cleanTicketRequest, money, salesOpen } from "../events/ticketed.js";
import logo from "/logo.png";
import "./BringYourBoo.css";

export const IG = "https://www.instagram.com/_tippincowgirl/";

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
function calendarLink(event, details) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${event.title}: ${event.subtitle}`,
    dates: `${fmt(event.startsAt)}/${fmt(event.endsAt)}`,
    location: [event.venue, event.address].filter(Boolean).join(", "),
    details,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/**
 * @param {{event: object, content: object, path: string}} props
 *   content: kicker, title (node), facts [{b, span}], marquee (string),
 *   media {video?, webm?, poster}, intro (node), flyer {src, alt, width,
 *   height}, deal {heading, body (node)}, form {guestLabel, guestPlaceholder,
 *   defaultQuantity, totalLabel, payLabel(total)}, calendarDetails,
 *   ticketNote (node, under the ticket), pageClass (optional modifier)
 */
export default function TicketedEvent({ event, content, path }) {
  return path.endsWith("/ticket") ? <TicketView event={event} content={content} /> : <EventPage event={event} content={content} />;
}

// ---- the stage ---------------------------------------------------------------------------------
// A silent loop when the event has one, otherwise the photo. Visitors who
// ask for less motion get the still frame either way.
function StageMedia({ media }) {
  const [still, setStill] = useState(!media.video);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setStill(true);
  }, []);
  return (
    <div className={`byb-stage-media${media.video ? "" : " byb-stage-media--still"}`} style={{ "--poster": `url(${media.poster})` }}>
      {still ? (
        <img src={media.poster} alt="" />
      ) : (
        <>
          {/* wide screens only (CSS): the same clip, blurred, fills the sides */}
          <video className="byb-stage-blur" autoPlay muted loop playsInline preload="auto" aria-hidden tabIndex={-1}>
            {media.webm && <source src={media.webm} type="video/webm" />}
            <source src={media.video} type="video/mp4" />
          </video>
          <video className="byb-stage-clip" poster={media.poster} autoPlay muted loop playsInline preload="auto" aria-hidden>
            {media.webm && <source src={media.webm} type="video/webm" />}
            <source src={media.video} type="video/mp4" />
          </video>
        </>
      )}
    </div>
  );
}

const scrollToTickets = (e) => {
  e.preventDefault();
  document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "start" });
};

// ---- the event page -------------------------------------------------------------------------
function EventPage({ event, content: c }) {
  usePageMeta(`${event.title}: ${event.subtitle} | Tippin' Cowgirl`);
  const [seats, setSeats] = useState({ remaining: null, open: salesOpen(event) });
  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cancelled") === "1";

  const loadSeats = () =>
    fetch(`/api/tickets?event=${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSeats({ remaining: d.remaining, open: d.open }))
      .catch(() => {});
  useEffect(() => {
    loadSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soldOut = seats.remaining === 0;

  return (
    <div className={`byb-page byb-page--stage${c.pageClass ? ` ${c.pageClass}` : ""}`}>
      <header className="byb-stage">
        <StageMedia media={c.media} />
        <div className="byb-stage-shade" aria-hidden />
        <a href="/" className="byb-logo byb-stage-logo" aria-label="Tippin' Cowgirl home">
          <img src={logo} alt="" width="54" height="54" />
        </a>
        <div className="byb-stage-in">
          <p className="byb-kicker">{c.kicker}</p>
          <h1 className="byb-title">{c.title}</h1>
          <p className="byb-sub">{event.subtitle}</p>
          <ul className="byb-facts" aria-label="When and where">
            {c.facts.map((f) => (
              <li key={f.b}>
                <b>{f.b}</b>
                <span>{f.span}</span>
              </li>
            ))}
          </ul>
          <a href="#tickets" className="byb-btn byb-btn--hero" onClick={scrollToTickets}>
            Get my tickets
          </a>
        </div>
      </header>

      <div className="byb-marquee" aria-hidden>
        <div className="byb-marquee-track">
          {[0, 1].map((k) => (
            <span key={k}>{c.marquee}&nbsp;</span>
          ))}
        </div>
      </div>

      <div className="byb-wrap">
        <section className="byb-card byb-intro">{c.intro}</section>

        {/* the event flyer (the same file the /events card uses); tap for full size */}
        {c.flyer && (
          <figure className="byb-flyer">
            <a href={c.flyer.src} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${event.title} flyer`}>
              <img src={c.flyer.src} width={c.flyer.width} height={c.flyer.height} loading="lazy" decoding="async" alt={c.flyer.alt} />
            </a>
          </figure>
        )}

        <section className="byb-card byb-deal" aria-labelledby="byb-deal-h">
          <h2 id="byb-deal-h">{c.deal.heading}</h2>
          {c.deal.body}
        </section>

        <section className="byb-card byb-buy" id="tickets" aria-labelledby="byb-buy-h">
          <div className="byb-buy-head">
            <h2 id="byb-buy-h">{c.form.heading || "Get your tickets"}</h2>
            <SeatsBadge remaining={seats.remaining} />
          </div>
          {cancelled && (
            <p className="byb-note" role="status">
              Checkout was cancelled, nothing was charged. You can try again below.
            </p>
          )}
          {!seats.open ? (
            <p className="byb-closed">Ticket sales for this event are closed. Follow us for the next one!</p>
          ) : soldOut ? (
            <p className="byb-closed">
              This event is sold out 🖤 DM{" "}
              <a href={IG} target="_blank" rel="noopener noreferrer">
                @_tippincowgirl
              </a>{" "}
              to join the waitlist.
            </p>
          ) : (
            <TicketForm event={event} form={c.form} remaining={seats.remaining} onSeatsChanged={loadSeats} />
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

function TicketForm({ event, form, remaining, onSeatsChanged }) {
  const [v, setV] = useState({ name: "", email: "", phone: "", guestName: "", quantity: form.defaultQuantity || 1, company: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [message, setMessage] = useState("");
  const formRef = useRef(null);

  const max = Math.max(1, Math.min(event.maxPerOrder, remaining ?? event.maxPerOrder));
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
    const checked = cleanTicketRequest(v, event);
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
        body: JSON.stringify({ ...v, eventId: event.id }),
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

  const total = money(v.quantity * event.priceCents);
  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      {field("name", "Your name", { type: "text", autoComplete: "name" })}
      {field("email", "Email (your ticket goes here)", { type: "email", autoComplete: "email" })}
      {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
      {field("guestName", form.guestLabel, { type: "text", autoComplete: "off", placeholder: form.guestPlaceholder || "Their name" }, true)}

      <div className="byb-field">
        <span className="byb-label" id="byb-qty-label">
          {form.quantityLabel || "Tickets"}
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
            {form.totalLabel || "Total"} <b>{total}</b>
          </span>
        </div>
        {form.quantityHint && <p className="byb-small byb-qty-hint">{form.quantityHint(v.quantity)}</p>}
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
        {status === "sending" ? "One sec..." : form.payLabel(total)}
      </button>
      <p className="byb-small">Secure checkout with Stripe. Your ticket number shows up right after you pay and lands in your email.</p>
    </form>
  );
}

// ---- the ticket, after Stripe ---------------------------------------------------------------
function TicketView({ event, content: c }) {
  usePageMeta(`Your ticket | ${event.title}`);
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
    <div className={`byb-page${c.pageClass ? ` ${c.pageClass}` : ""}`}>
      <div className="byb-wrap">
        <header className="byb-hero byb-hero--small">
          <a href="/" className="byb-logo" aria-label="Tippin' Cowgirl home">
            <img src={logo} alt="" width="48" height="48" />
          </a>
          <h1 className="byb-title byb-title--small">{c.title}</h1>
        </header>

        {state.loading && !t?.folio ? (
          <section className="byb-card byb-center" role="status">
            <p>Confirming your payment with Stripe...</p>
          </section>
        ) : state.error ? (
          <section className="byb-card byb-center">
            <p role="alert">{state.error}</p>
            <a className="byb-btn byb-btn--ghost" href={event.path}>
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
                  {event.dateLabel}, {event.timeLabel}
                </b>
                <br />
                {event.venue}
                {event.address && (
                  <>
                    <br />
                    {event.address}
                  </>
                )}
              </p>
            </section>
            <p className="byb-small byb-center-text">Show this screen or your ticket number at the door. We also emailed it to you. {event.ticketNote}</p>
            <a className="byb-btn" href={calendarLink(event, c.calendarDetails)} target="_blank" rel="noopener noreferrer">
              Add to my calendar
            </a>
          </>
        ) : t?.status === "cancelled" ? (
          <section className="byb-card byb-center">
            <p>This ticket was cancelled. DM us on Instagram if that looks wrong.</p>
          </section>
        ) : (
          <section className="byb-card byb-center">
            <p>Your payment is still being confirmed. Give it a minute and refresh this page, or check your email for your ticket.</p>
          </section>
        )}
      </div>
    </div>
  );
}
