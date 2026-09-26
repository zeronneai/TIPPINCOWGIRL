import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { scrubEvent } from "./analytics.js";
import { CONTACT_EMAIL, STORE_HOURS } from "./business.js";
import CheckoutResult, { CHECKOUT_ROUTES } from "./components/CheckoutResult.jsx";
import TrustPage, { TRUST_ROUTES } from "./components/TrustPages.jsx";
import { BOOKING_ENDPOINT, BOOKING_ENDPOINT_READY, EVENTS, PROCESS_VIDEOS, REMOTE_MEDIA } from "./hat/data.js";
import Builder from "./shop/Builder.jsx";
import CartDrawer from "./shop/CartDrawer.jsx";
import { CartProvider, useCart } from "./shop/cart.jsx";
import { installLinkInterception, navigate, scrollToInitialHash, useCanonical, usePath } from "./router.js";
import logo from "/logo.png";

const IG = "https://www.instagram.com/_tippincowgirl/";

const GRAIN =
  "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22/></svg>')";

const MARQUEE_TEXT =
  "EL PASO'S FIRST HAT BAR ⭐ CUSTOM HATS ⭐ EVENTS & POP-UPS ⭐ EL PASO'S FIRST HAT BAR ⭐ CUSTOM HATS ⭐ EVENTS & POP-UPS ⭐ ";

const SOLANA_ADDRESS = "The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912";
const MAPS_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(SOLANA_ADDRESS)}&output=embed`;
const MAPS_DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SOLANA_ADDRESS)}`;

// ---------------------------------------------------------------------------
// Asset slots — every glob below is a drop-a-file-and-it-appears slot,
// detected at build time. Missing files render branded placeholders.
//
//   src/assets/video/hero-loop.mp4          hero background loop
//   src/assets/video/hero-poster.(webp|jpg) hero poster / fallback frame
//   src/assets/events/<event-id>/01.*       media per event (mp4/webp/jpg/png)
//   src/assets/deborah.webp                 Meet-Deborah portrait
//   src/assets/gallery/01…06.*              gallery photos (masonry, uncropped)
// ---------------------------------------------------------------------------
const HERO_VIDEO = import.meta.glob("./assets/video/hero-loop.{mp4,webm}", {
  eager: true,
  query: "?url",
  import: "default",
});
const HERO_POSTER = import.meta.glob("./assets/video/hero-poster.{webp,jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const EVENT_MEDIA = import.meta.glob("./assets/events/*/*.{mp4,webm,webp,jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const DEBORAH_PHOTO = import.meta.glob("./assets/deborah.{webp,jpg,jpeg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

const firstUrl = (globObj) => Object.values(globObj)[0] || null;

function eventMedia(id) {
  const keys = Object.keys(EVENT_MEDIA)
    .filter((k) => k.includes(`/events/${id}/`))
    .sort();
  if (!keys.length) return null;
  const key = keys[0];
  return { url: EVENT_MEDIA[key], video: /\.(mp4|webm)$/.test(key) };
}

// ---------------------------------------------------------------------------

// Autoplaying loop that stays lazy: the src only attaches when the tile nears
// the viewport (everything is lazy except the hero video, per spec).
function LazyVideo({ src, caption, ariaLabel, style }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100%" }}>
      {on && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          src={src}
          aria-label={ariaLabel}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }}
        />
      )}
      {caption && (
        <span
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            zIndex: "var(--z-ui)",
            background: "rgba(43,26,16,.82)",
            color: "#faf1e2",
            fontWeight: 800,
            fontSize: 11.5,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 8,
          }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Booking drawer: opens from every "Book the bar" on the site. It POSTs the
// request to the Google Apps Script web app as JSON, and every field name
// below becomes a column heading in Deborah's spreadsheet, so they are named
// for a reader and not for the code.
//
// CONTENT TYPE, deliberately text/plain. An Apps Script web app does not
// answer the CORS preflight that application/json triggers, so the browser
// would block the request before it left the page even with a perfect
// script on the other side. text/plain keeps it a simple request; doPost
// parses e.postData.contents as JSON either way. And no no-cors here: that
// would hide the response and leave us unable to tell success from failure.
//
// Apps Script validates nothing, so the checks below are the only ones there
// are. Focus-trapped, Escape/backdrop close, focus returns to the opener.
// ---------------------------------------------------------------------------
const EVENT_TYPES = ["Birthday", "Bachelorette", "Corporate", "Wedding", "Pop-up / Market", "Other"];

// Caps so nobody can paste a novel into a spreadsheet cell. The inputs carry
// maxLength too; this is the check that actually decides.
const FIELD_LIMITS = { name: 80, email: 120, phone: 40, eventType: 40, eventDate: 20, notes: 1000 };

// Permissive on purpose: real addresses are stranger than most patterns
// allow, and the only job here is to catch a typo before it costs a reply.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_BOOKING = { name: "", email: "", phone: "", eventType: "", eventDate: "", notes: "", company: "" };

/** @returns an object of field name to message; empty means valid. */
export function validateBooking(values) {
  const v = values || {};
  const errors = {};
  const get = (k) => String(v[k] ?? "").trim();
  const tooLong = (k) => String(v[k] ?? "").length > FIELD_LIMITS[k];

  const name = get("name");
  if (!name) errors.name = "Tell us who you are.";
  else if (tooLong("name")) errors.name = `Keep this under ${FIELD_LIMITS.name} characters.`;

  const email = get("email");
  const phone = get("phone");
  if (!email) errors.email = "We need an email to write back to.";
  else if (tooLong("email")) errors.email = `Keep this under ${FIELD_LIMITS.email} characters.`;
  else if (!EMAIL_PATTERN.test(email)) errors.email = "That email does not look right.";

  if (phone && tooLong("phone")) errors.phone = `Keep this under ${FIELD_LIMITS.phone} characters.`;

  // Belt and braces: email is required above, so this only ever fires if
  // that rule is ever relaxed. It keeps the promise that we can reach them.
  if (!email && !phone) errors.email = "Leave us an email or a phone number.";

  if (!get("eventType")) errors.eventType = "Pick the kind of event.";
  if (tooLong("notes")) errors.notes = `Keep this under ${FIELD_LIMITS.notes} characters.`;

  return errors;
}

const fieldStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 8,
  border: "1.5px solid rgba(43,26,16,.55)",
  background: "#fffaf0",
  fontFamily: "'Satoshi',sans-serif",
  fontSize: 14.5,
  color: "var(--ink)",
};
const labelStyle = {
  display: "block",
  fontWeight: 800,
  fontSize: 11.5,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  margin: "0 0 6px",
  color: "#6f4526",
};

function Field({ id, label, optional, error, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {optional && <span style={{ opacity: 0.6, textTransform: "none", letterSpacing: 0 }}> (optional)</span>}
      </label>
      {children}
      {/* the message sits with its own field, not in a pile at the top */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--coral-deep)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function BookingDrawer({ open, onClose, returnRef }) {
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);
  // idle | sending | done | error | unconfigured
  const [status, setStatus] = useState("idle");
  const [values, setValues] = useState(EMPTY_BOOKING);
  const [errors, setErrors] = useState({});

  const setField = (key) => (e) => {
    const { value } = e.target;
    setValues((v) => ({ ...v, [key]: value }));
    // clear a complaint as soon as they start fixing it
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  useEffect(() => {
    if (!open) return undefined;
    setStatus("idle");
    setErrors({});
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstFieldRef.current?.focus(), 80);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = panelRef.current?.querySelectorAll("input,select,textarea,button,a[href]");
        if (!els?.length) return;
        const list = Array.from(els).filter((el) => !el.disabled);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      returnRef?.current?.focus?.();
    };
  }, [open, onClose, returnRef]);

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;

    const found = validateBooking(values);
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) {
      panelRef.current?.querySelector(`#bk-${firstBad === "eventType" ? "type" : firstBad}`)?.focus();
      return;
    }

    if (!BOOKING_ENDPOINT_READY) {
      console.error(
        "[booking] VITE_BOOKING_ENDPOINT is not set, so this request was not sent. Add it and rebuild."
      );
      setStatus("unconfigured");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        // text/plain keeps this a simple request: see the note above the
        // component. Do NOT switch this to application/json.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          eventType: values.eventType,
          eventDate: values.eventDate,
          notes: values.notes.trim(),
          // honeypot: a real person leaves this empty, and the Apps Script
          // drops anything that arrives with it filled
          company: values.company,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // The response is readable because this is not a no-cors request, so
      // an explicit failure from the script is treated as one.
      const body = await res.clone().json().catch(() => null);
      if (body && (body.ok === false || body.result === "error")) throw new Error(body.message || "script error");
      setValues(EMPTY_BOOKING);
      setErrors({});
      setStatus("done");
    } catch (err) {
      console.error("[booking] request failed:", err);
      setStatus("error");
    }
  };

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-overlay)" }}>
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: "absolute", inset: 0, background: "rgba(43,26,16,.5)" }}
      />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="booking-title" className="tc-drawer">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <h2 id="booking-title" className="tc-sticker" style={{ margin: 0, fontSize: "clamp(28px,6vw,36px)" }}>
            Book the bar
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close booking form"
            style={{
              flex: "none",
              width: 38,
              height: 38,
              border: "2px solid rgba(43,26,16,.4)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink)",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {status === "done" ? (
          <div>
            <p style={{ fontSize: 16.5, lineHeight: 1.6, fontWeight: 600, color: "#4a3a2c" }}>
              Got it, your request is in. Deborah reaches out personally, usually within a day, to talk
              dates and details.
            </p>
            <button type="button" className="tc-btn" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <Field id="bk-name" label="Name" error={errors.name}>
              <input
                ref={firstFieldRef}
                id="bk-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={FIELD_LIMITS.name}
                value={values.name}
                onChange={setField("name")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "bk-name-error" : undefined}
                style={fieldStyle}
              />
            </Field>
            <Field id="bk-email" label="Email" error={errors.email}>
              <input
                id="bk-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={FIELD_LIMITS.email}
                value={values.email}
                onChange={setField("email")}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "bk-email-error" : undefined}
                style={fieldStyle}
              />
            </Field>
            <Field id="bk-phone" label="Phone" optional error={errors.phone}>
              <input
                id="bk-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={FIELD_LIMITS.phone}
                value={values.phone}
                onChange={setField("phone")}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "bk-phone-error" : undefined}
                style={fieldStyle}
              />
            </Field>
            <Field id="bk-type" label="Event type" error={errors.eventType}>
              <select
                id="bk-type"
                name="eventType"
                value={values.eventType}
                onChange={setField("eventType")}
                aria-invalid={!!errors.eventType}
                aria-describedby={errors.eventType ? "bk-type-error" : undefined}
                style={fieldStyle}
              >
                <option value="" disabled>
                  Pick one
                </option>
                {EVENT_TYPES.map((t2) => (
                  <option key={t2} value={t2}>
                    {t2}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="bk-date" label="Tentative date" optional>
              <input
                id="bk-date"
                name="eventDate"
                type="date"
                value={values.eventDate}
                onChange={setField("eventDate")}
                style={fieldStyle}
              />
            </Field>
            <Field id="bk-notes" label="Notes" optional error={errors.notes}>
              <textarea
                id="bk-notes"
                name="notes"
                rows={3}
                maxLength={FIELD_LIMITS.notes}
                value={values.notes}
                onChange={setField("notes")}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? "bk-notes-error" : undefined}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </Field>

            {/* Honeypot. Hidden with CSS rather than type=hidden, which bots
                skip, and hidden from assistive tech too so nobody who cannot
                see it can fill it in by accident and have their request
                silently binned. */}
            <div className="tc-hp" aria-hidden="true">
              <label htmlFor="bk-company">Company</label>
              <input
                id="bk-company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={values.company}
                onChange={setField("company")}
              />
            </div>

            {status === "error" && (
              <p role="alert" style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}>
                Something hiccuped on the network. Give it another try?
              </p>
            )}
            {status === "unconfigured" && (
              <p role="alert" style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}>
                Our form is not hooked up yet. Please DM us on Instagram and we will get you booked.
              </p>
            )}
            <button type="submit" className="tc-btn" disabled={status === "sending"} style={{ width: "100%" }}>
              {status === "sending" ? "Sending..." : "Send booking request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Brand({ size = 30, fontSize = 19 }) {
  return (
    <div className="tc-brand" style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <img
        src={logo}
        alt="Tippin Cowgirl logo"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
      />
      <span
        style={{
          fontFamily: "'Alfa Slab One','Satoshi',serif",
          fontSize,
          fontWeight: 400,
          letterSpacing: ".01em",
          textTransform: "uppercase",
          color: "var(--coral-deep)",
        }}
      >
        Tippin Cowgirl
      </span>
    </div>
  );
}

// Cart button for the nav: always reachable, on every section and route.
// The count only appears once there is something in the cart.
function NavCart() {
  const { totalQuantity, openCart } = useCart();
  return (
    <button
      type="button"
      className="tc-nav-cart"
      onClick={openCart}
      aria-label={totalQuantity ? `Open cart, ${totalQuantity} hats` : "Open cart"}
      title="Your cart"
    >
      <span aria-hidden style={{ fontSize: 17, lineHeight: 1 }}>
        🛒
      </span>
      {totalQuantity > 0 && (
        <span className="tc-nav-cart-count" aria-hidden>
          {totalQuantity}
        </span>
      )}
    </button>
  );
}

function Nav({ onBook }) {
  const [open, setOpen] = useState(false);
  const link = {
    fontWeight: 800,
    fontSize: 14,
    color: "var(--ink)",
    textDecoration: "none",
    letterSpacing: ".02em",
  };
  return (
    <nav
      className="tc-px"
      style={{
        position: "sticky",
        top: 0,
        zIndex: "var(--z-nav)",
        background: "rgba(250,241,226,.9)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "2px solid rgba(43,26,16,.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "13px 0",
        }}
      >
        <a href="/" style={{ textDecoration: "none", minWidth: 0 }} aria-label="Tippin Cowgirl, home">
          <Brand />
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="tc-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 26, marginRight: 8 }}>
            <a href="/#builder" style={link}>
              Build your hat
            </a>
            <a href="/#events" style={link}>
              Events
            </a>
            <a href="/#gallery" style={link}>
              Gallery
            </a>
          </div>
          <button type="button" className="tc-book-nav" onClick={onBook}>
            Book the bar
          </button>
          <NavCart />
          <button
            type="button"
            className="tc-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {open && (
        <div className="tc-nav-mobile">
          <a href="/#builder" style={link} onClick={() => setOpen(false)}>
            Build your hat
          </a>
          <a href="/#deborah" style={link} onClick={() => setOpen(false)}>
            Meet Deborah
          </a>
          <a href="/#events" style={link} onClick={() => setOpen(false)}>
            Events & Pop-Ups
          </a>
          <a href="/#gallery" style={link} onClick={() => setOpen(false)}>
            Gallery
          </a>
          <a href="/#solana" style={{ ...link, color: "var(--coral-deep)" }} onClick={() => setOpen(false)}>
            Find us at Solana
          </a>
          <button
            type="button"
            className="tc-book-nav"
            onClick={(e) => {
              setOpen(false);
              onBook(e);
            }}
          >
            Book the bar
          </button>
        </div>
      )}
    </nav>
  );
}

// --- Hero: autoplay video loop slot with sticker headline over it ------------
function Hero({ onBook }) {
  // local files override the Cloudinary manifest when present
  const video = firstUrl(HERO_VIDEO) || REMOTE_MEDIA.heroVideo;
  const poster = firstUrl(HERO_POSTER) || REMOTE_MEDIA.heroPoster;
  const overVideo = !!(video || poster);
  return (
    <header
      id="top"
      className={overVideo ? "" : "tc-halftone"}
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "min(88vh, 760px)",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "72px 20px 84px",
      }}
    >
      {video ? (
        <video className="tc-hero-video" autoPlay muted loop playsInline preload="auto" poster={poster || undefined}>
          <source src={video} type="video/mp4" />
        </video>
      ) : poster ? (
        <img className="tc-hero-video" src={poster} alt="" />
      ) : (
        // branded fallback until src/assets/video/hero-loop.mp4 lands
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(75% 65% at 50% 30%, rgba(232,103,74,.24) 0%, rgba(232,103,74,.06) 55%, transparent 100%)",
          }}
        />
      )}
      {overVideo && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(232,103,74,.14), rgba(232,103,74,.14)), linear-gradient(180deg, rgba(30,15,8,.38) 0%, rgba(30,15,8,.6) 100%)",
          }}
        />
      )}
      <div style={{ position: "relative", maxWidth: 900 }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 12.5,
            letterSpacing: ".2em",
            textTransform: "uppercase",
            color: overVideo ? "#faf1e2" : "var(--coral-deep)",
            marginBottom: 22,
          }}
        >
          El Paso&apos;s first hat bar
        </div>
        <h1 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(44px,8.2vw,104px)" }}>
          Build
          <br />
          your hat
        </h1>
        <p
          style={{
            maxWidth: 520,
            margin: "26px auto 0",
            fontSize: 18,
            lineHeight: 1.55,
            fontWeight: 500,
            color: overVideo ? "#faf1e2" : "var(--ink)",
          }}
        >
          Pick your felt, shape the brim, pin your charm. Walk away with a hat nobody else has.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 34 }}>
          <a href="/#builder" className="tc-btn">
            Build your hat
          </a>
          <button type="button" className="tc-btn tc-btn--ghost" onClick={onBook}>
            Book the bar
          </button>
        </div>
      </div>
    </header>
  );
}

function Marquee() {
  const span = {
    fontWeight: 800,
    fontSize: 14,
    color: "var(--ink)",
    letterSpacing: ".14em",
    textTransform: "uppercase",
  };
  return (
    <div
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        background: "var(--coral)",
        borderTop: "2px solid var(--ink)",
        borderBottom: "2px solid var(--ink)",
      }}
    >
      <div style={{ display: "inline-flex", gap: 30, padding: "10px 0", animation: "marquee 30s linear infinite" }}>
        <span style={span}>{MARQUEE_TEXT}</span>
        <span style={span}>{MARQUEE_TEXT}</span>
      </div>
    </div>
  );
}

// --- EventFeature: one reusable chapter. `featured` renders the big
// Grand-Opening treatment; without it, the same data renders as a chapter in
// the Events section — demoting the opening is a one-line data change. -------
// One frame per photo/clip. Frames use fixed aspect-ratios with object-fit
// cover, so portrait and landscape originals both sit well without knowing
// their dimensions up front; on mobile the whole set becomes a scroll-snap
// carousel (see .tc-event-media in styles.css).
const eventFrame = {
  borderRadius: 18,
  overflow: "hidden",
  border: "2px solid var(--ink)",
  boxShadow: "0 5px 0 var(--ink)",
  background: "#e9d9bf",
};

function EventMediaSlot({ event, tall }) {
  const local = eventMedia(event.id); // local file overrides the manifest
  const remote = event.media;
  const main = local
    ? { url: local.url, video: local.video }
    : remote
      ? { url: remote.main, video: /\.(mp4|webm)($|\?)/.test(remote.main) }
      : null;

  if (!main)
    return (
      <div
        className="tc-halftone"
        style={{
          ...eventFrame,
          minHeight: tall ? 380 : 260,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 40 }}>🤠</span>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: "#6f5b48" }}>
          [ drop media in src/assets/events/{event.id}/ ]
        </span>
      </div>
    );

  const extras = (!local && remote?.extras ? remote.extras : []).slice(0, 2);
  return (
    <div className="tc-event-media">
      <figure className="tc-event-slide tc-event-slide--main" style={{ ...eventFrame, margin: 0 }}>
        {main.video ? (
          <LazyVideo src={main.url} ariaLabel={event.title} />
        ) : (
          <img
            src={main.url}
            alt={event.title}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
      </figure>
      {extras.map((url, i) => (
        <figure key={url} className="tc-event-slide" style={{ ...eventFrame, margin: 0 }}>
          <img
            src={url}
            alt={`${event.title}, photo ${i + 2}`}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </figure>
      ))}
    </div>
  );
}

function EventFeature({ event, featured = false, onBook }) {
  if (featured)
    return (
      <section id="grand-opening" className="tc-px" style={{ position: "relative", padding: "76px 36px 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              background: "var(--teal)",
              color: "#fff",
              border: "2px solid var(--ink)",
              boxShadow: "0 3px 0 var(--ink)",
              borderRadius: 10,
              padding: "6px 14px",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            {event.date}
          </div>
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(40px,6.4vw,76px)" }}>
            {event.title}
          </h2>
          <p style={{ maxWidth: 560, margin: "20px auto 28px", fontSize: 17, lineHeight: 1.6, color: "#4a3a2c" }}>
            {event.blurb}
          </p>
          <EventMediaSlot event={event} tall />
          {event.cta && (
            <div style={{ marginTop: 30 }}>
              <button type="button" className="tc-btn" onClick={onBook}>
                {event.cta.label}
              </button>
            </div>
          )}
        </div>
      </section>
    );

  return (
    <article style={{ display: "grid", gap: 22 }}>
      <EventMediaSlot event={event} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "10px 16px" }}>
        <h3 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(26px,3.4vw,38px)" }}>
          {event.title}
        </h3>
        <span
          style={{
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--coral-deep)",
          }}
        >
          {event.date}
        </span>
      </div>
      <p style={{ margin: 0, maxWidth: 620, fontSize: 15.5, lineHeight: 1.6, color: "#4a3a2c" }}>{event.blurb}</p>
    </article>
  );
}

// --- Meet Deborah -------------------------------------------------------------
function MeetDeborah() {
  const photo = firstUrl(DEBORAH_PHOTO) || REMOTE_MEDIA.deborah;
  return (
    <section id="deborah" className="tc-px" style={{ position: "relative", padding: "72px 36px" }}>
      <div
        className="tc-deborah-grid"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: 44,
          alignItems: "center",
        }}
      >
        <div
          className={photo ? "" : "tc-halftone"}
          style={{
            borderRadius: 22,
            overflow: "hidden",
            border: "2px solid var(--ink)",
            boxShadow: "0 6px 0 var(--ink)",
            background: "#e9d9bf",
            minHeight: 420,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photo ? (
            <img
              src={photo}
              alt="Deborah, founder of Tippin Cowgirl"
              loading="lazy"
              decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: "#6f5b48" }}>
              [ drop src/assets/deborah.webp ]
            </span>
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: ".24em",
              textTransform: "uppercase",
              color: "var(--teal)",
              marginBottom: 12,
            }}
          >
            The cowgirl behind the bar
          </div>
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(36px,4.8vw,58px)" }}>
            Meet Deborah
          </h2>
          <p style={{ margin: "20px 0 0", fontSize: 16.5, lineHeight: 1.65, color: "#4a3a2c" }}>
            Tippin&apos; Cowgirl didn&apos;t start with a storefront. It started with a bar on wheels,
            because Deborah knew the best hat moments don&apos;t wait for business hours. The bachelorette
            that comes together in a week. The birthday nobody planned. The Sunday somebody finally
            decides it&apos;s their hat day.
          </p>
          <p style={{ margin: "14px 0 0", fontSize: 16.5, lineHeight: 1.65, color: "#4a3a2c" }}>
            She thought about a permanent home for a long time. What held her back was simple: she
            never wanted to be the shop you have to come to. She wanted to be the one that shows up.
            Now, with the first Hat Bar in El Paso opening at The Solana, she doesn&apos;t have to
            choose. The bar has a home, and it still rolls.
          </p>
          <blockquote
            style={{
              margin: "26px 0 0",
              padding: 0,
              border: 0,
              fontWeight: 800,
              fontSize: "clamp(19px,2.4vw,24px)",
              lineHeight: 1.35,
              color: "var(--coral-deep)",
            }}
          >
            “A hat finds you at the right moment. I just make sure I&apos;m there when it does.”
          </blockquote>
        </div>
      </div>
    </section>
  );
}

// --- How the hat bar works: the in-person experience, four comic steps -------
const HOW_STEPS = [
  {
    num: "01",
    title: "Step up to the bar",
    body: "Walk up and try on the base hats. Felts in every color, laid out like a candy shop.",
  },
  {
    num: "02",
    title: "Pick your base",
    body: "Choose your felt color and brim shape. That hat is yours from this moment on.",
  },
  {
    num: "03",
    title: "Make it yours",
    body: "Wrap a band, pin charms and feathers, brand your initials. Styled with you, on the spot.",
  },
  {
    num: "04",
    title: "Wear it out",
    body: "No box, no bag. You built it, you're wearing it, straight into the party.",
    accent: true,
  },
];

function HowCard({ num, title, body, accent }) {
  return (
    <div
      style={{
        background: accent ? "var(--coral)" : "#fffaf0",
        color: accent ? "#fff" : "var(--ink)",
        border: "2px solid var(--ink)",
        boxShadow: "0 5px 0 var(--ink)",
        borderRadius: 18,
        padding: 24,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 28,
          lineHeight: 1,
          color: accent ? "#fff" : "var(--coral)",
        }}
      >
        {num}
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: 15.5,
          margin: "13px 0 7px",
          textTransform: "uppercase",
          letterSpacing: ".02em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: accent ? "#ffe9df" : "#4a3a2c" }}>{body}</div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="tc-px tc-halftone" style={{ position: "relative", padding: "68px 36px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 42 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: ".24em",
              textTransform: "uppercase",
              color: "var(--teal)",
              marginBottom: 12,
            }}
          >
            Four steps, one hat
          </div>
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(32px,4.8vw,54px)" }}>
            How the hat bar works
          </h2>
        </div>
        <div className="tc-how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {HOW_STEPS.map((s, i) => (
            <HowCard key={s.num} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Born at the bar: the build clips, the 4 steps made visible --------------
function TheProcess() {
  return (
    <section id="process" className="tc-px" style={{ position: "relative", padding: "68px 36px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 42 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: ".24em",
              textTransform: "uppercase",
              color: "var(--teal)",
              marginBottom: 12,
            }}
          >
            The process, on tape
          </div>
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(32px,4.8vw,54px)" }}>
            Born at the bar
          </h2>
        </div>
        <div className="tc-process-grid">
          {PROCESS_VIDEOS.map((v) => (
            <div
              key={v.id}
              className="tc-process-slide"
              style={{
                borderRadius: 18,
                overflow: "hidden",
                border: "2px solid var(--ink)",
                boxShadow: "0 5px 0 var(--ink)",
                background: "#e9d9bf",
              }}
            >
              <LazyVideo src={v.video} caption={v.caption} ariaLabel={v.caption} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Events & Pop-Ups: vertical chapters, data-driven from data.js ----------
function EventsSection() {
  const chapters = EVENTS.filter((e) => !e.featured);
  return (
    <section id="events" className="tc-px" style={{ position: "relative", padding: "72px 36px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(34px,5vw,58px)" }}>
            Events &amp; Pop-Ups
          </h2>
          <p style={{ maxWidth: 540, margin: "18px auto 0", fontSize: 16, lineHeight: 1.6, color: "#4a3a2c" }}>
            Weddings, birthdays, markets, corporate parties. The bar rolls up anywhere in El Paso. DM{" "}
            <a href={IG} target="_blank" rel="noopener noreferrer" style={{ color: "var(--coral-deep)", fontWeight: 800 }}>
              @_tippincowgirl
            </a>{" "}
            to book.
          </p>
        </div>
        {chapters.length ? (
          <div style={{ display: "grid", gap: 64 }}>
            {chapters.map((e) => (
              <EventFeature key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div
            className="tc-halftone"
            style={{
              borderRadius: 22,
              border: "2px dashed rgba(43,26,16,.35)",
              padding: "44px 24px",
              textAlign: "center",
              color: "#6f5b48",
              fontWeight: 600,
            }}
          >
            More pop-ups announcing soon. Follow{" "}
            <a href={IG} target="_blank" rel="noopener noreferrer" style={{ color: "var(--coral-deep)", fontWeight: 800 }}>
              @_tippincowgirl
            </a>{" "}
            for dates.
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 44 }}>
          <a href={IG} target="_blank" rel="noopener noreferrer" className="tc-btn">
            DM to book your event
          </a>
        </div>
      </div>
    </section>
  );
}

// --- Gallery: compact product grid; slots accept photos AND mp4 loops --------
const HATCH = "repeating-linear-gradient(135deg,#efe2ca,#efe2ca 14px,#e7d7b9 14px,#e7d7b9 28px)";

const GALLERY_FILES = import.meta.glob("./assets/gallery/*.{webp,jpg,jpeg,png,mp4,webm}", {
  eager: true,
  query: "?url",
  import: "default",
});

function gallerySrc(name) {
  const find = (ext) => GALLERY_FILES[`./assets/gallery/${name}.${ext}`];
  const video = find("mp4") || find("webm");
  const webp = find("webp");
  const fallback = find("jpg") || find("jpeg") || find("png");
  if (!video && !webp && !fallback) return null;
  return { video, webp, fallback: fallback || webp };
}

// Masonry piece: comic frame, natural proportions, NO crop (gallery only —
// events and the rest of the site keep their fixed-aspect cover frames).
const pieceFrame = {
  borderRadius: 16,
  overflow: "hidden",
  border: "2px solid var(--ink)",
  boxShadow: "0 5px 0 var(--ink)",
  background: "#e9d9bf",
  breakInside: "avoid",
  marginBottom: 12,
};
const naturalImg = { width: "100%", height: "auto", display: "block" };

function GalleryPiece({ name, alt, label }) {
  const local = name ? gallerySrc(name) : null;
  const remote = name ? REMOTE_MEDIA.gallery[name] : null;
  // local file overrides the Cloudinary manifest
  if (local?.video)
    return (
      <div style={{ ...pieceFrame, aspectRatio: "4 / 5" }}>
        <LazyVideo src={local.video} ariaLabel={alt} />
      </div>
    );
  if (local)
    return (
      <figure style={{ ...pieceFrame, margin: "0 0 12px" }}>
        <picture>
          {local.webp && <source srcSet={local.webp} type="image/webp" />}
          <img src={local.fallback} alt={alt} loading="lazy" decoding="async" style={naturalImg} />
        </picture>
      </figure>
    );
  if (remote?.image)
    return (
      <figure style={{ ...pieceFrame, margin: "0 0 12px" }}>
        <img src={remote.image} alt={alt} loading="lazy" decoding="async" style={naturalImg} />
      </figure>
    );
  return (
    <div
      style={{
        ...pieceFrame,
        background: HATCH,
        aspectRatio: "4 / 5",
        display: "flex",
        alignItems: "flex-end",
        padding: 14,
      }}
    >
      <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#6f5b48" }}>{label}</span>
    </div>
  );
}

function Gallery() {
  return (
    <section id="gallery" className="tc-px" style={{ position: "relative", padding: "64px 36px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 26,
          }}
        >
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(30px,4.2vw,48px)" }}>
            Hats off the bar
          </h2>
          <a
            href={IG}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontWeight: 800, fontSize: 14, color: "var(--coral-deep)", textDecoration: "none" }}
          >
            @_tippincowgirl on Instagram →
          </a>
        </div>
        {/* CSS-columns masonry: every photo at its natural ratio, uncropped */}
        <div className="tc-masonry">
          <GalleryPiece name="01" alt="Custom hat built at the bar" label="[ 01 ]" />
          <GalleryPiece name="02" alt="Guest wearing their custom hat" label="[ 02 ]" />
          <div
            style={{
              ...pieceFrame,
              background: "var(--coral)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "38px 22px",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 18, color: "#fff", lineHeight: 1.3 }}>
              “Best part of the whole party.”
            </span>
          </div>
          <GalleryPiece name="03" alt="Hat bar guests at a pop-up" label="[ 03 ]" />
          <GalleryPiece name="04" alt="Hat details: band and charms" label="[ 04 ]" />
          <GalleryPiece name="05" alt="Styling a custom hat at the bar" label="[ 05 ]" />
          <GalleryPiece name="06" alt="Finished custom hat, ready to wear" label="[ 06 ]" />
        </div>
      </div>
    </section>
  );
}

// --- Solana: now-open callout + lazy Google Maps embed -----------------------
function Solana() {
  const [mapOn, setMapOn] = useState(false);
  return (
    <section id="solana" className="tc-px" style={{ position: "relative", padding: "64px 36px 90px" }}>
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          borderRadius: 26,
          border: "2px solid var(--ink)",
          boxShadow: "0 6px 0 var(--ink)",
          background: "var(--coral)",
          overflow: "hidden",
        }}
      >
        <div className="tc-solana-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 0 }}>
          <div style={{ padding: "44px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                background: "#fff",
                border: "2px solid var(--ink)",
                boxShadow: "0 3px 0 var(--ink)",
                borderRadius: 10,
                padding: "5px 12px",
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--ink)",
                marginBottom: 16,
              }}
            >
              Now open
            </div>
            <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(30px,4vw,46px)" }}>
              At the Shoppes at Solana
            </h2>
            <p style={{ margin: "16px 0 18px", fontSize: 15.5, lineHeight: 1.6, color: "#3a1508", fontWeight: 600 }}>
              750 Sunland Park Dr, El Paso, TX 79912. Come find the bar and build your own.
            </p>
            {/* Same STORE_HOURS list the customer email prints. */}
            <div style={{ margin: "0 0 24px" }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--ink)",
                  marginBottom: 6,
                }}
              >
                Hours
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {STORE_HOURS.map((line) => (
                  <li key={line} style={{ fontSize: 15, lineHeight: 1.6, color: "#3a1508", fontWeight: 600 }}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href={MAPS_DIRECTIONS} target="_blank" rel="noopener noreferrer" className="tc-btn tc-btn--ghost">
                Get directions →
              </a>
            </div>
          </div>
          <div style={{ minHeight: 340, position: "relative", borderLeft: "2px solid var(--ink)" }}>
            {mapOn ? (
              <iframe
                title="Map: The Shoppes at Solana, El Paso"
                src={MAPS_EMBED}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setMapOn(true)}
                className="tc-halftone"
                aria-label="Load the interactive map"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  border: 0,
                  background: "var(--cream-2)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 42 }}>📍</span>
                <span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 15 }}>Tap to load the map</span>
                <span style={{ fontSize: 12.5, color: "#6f5b48" }}>Google Maps · loads on demand</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Mobile-only builder FAB: a corner button that fades in once the scroll
// passes ~60vh (the hero has its own CTA), and stays out of the way when the
// builder itself is on screen or any dialog (booking drawer, size guide,
// order summary) is open. Dialog detection reads the body scroll-lock every
// dialog on the site already sets, so the builder's logic stays untouched.
// On its very first appearance it shows a side label for 2.5s, then
// collapses to icon only (once per session, via sessionStorage). ------------
function BuildFab() {
  const [pastHero, setPastHero] = useState(false);
  const [builderOnScreen, setBuilderOnScreen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [labelOn, setLabelOn] = useState(false);
  const introduced = useRef(false);
  const shown = pastHero && !builderOnScreen && !dialogOpen;

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const builder = document.getElementById("builder");
    if (typeof IntersectionObserver === "undefined" || !builder) return undefined;
    const io = new IntersectionObserver(([e]) => setBuilderOnScreen(e.isIntersecting));
    io.observe(builder);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const mo = new MutationObserver(() => setDialogOpen(document.body.style.overflow === "hidden"));
    mo.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!shown || introduced.current) return;
    introduced.current = true;
    try {
      if (sessionStorage.getItem("tc-fab-intro") === "1") return;
      sessionStorage.setItem("tc-fab-intro", "1");
    } catch {
      /* private mode etc: show the intro, just do not remember it */
    }
    setLabelOn(true);
  }, [shown]);

  // Own effect so the countdown is never restarted (or cancelled) by the FAB
  // hiding and reappearing while the label is up.
  useEffect(() => {
    if (!labelOn) return undefined;
    const t = setTimeout(() => setLabelOn(false), 2500);
    return () => clearTimeout(t);
  }, [labelOn]);

  return (
    <a
      href="/#builder"
      className={`tc-fab${shown ? " on" : ""}${labelOn ? " tc-fab--intro" : ""}`}
      aria-label="Build Your Hat"
      title="Build Your Hat"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
    >
      <span aria-hidden style={{ fontSize: 25, lineHeight: 1 }}>
        🤠
      </span>
      <span className="tc-fab-label" aria-hidden>
        Build Your Hat
      </span>
    </a>
  );
}

function Footer({ onBook }) {
  const trustLink = {
    fontWeight: 700,
    fontSize: 13.5,
    color: "#6f5b48",
    textDecoration: "none",
  };
  return (
    <footer
      id="site-footer"
      className="tc-px"
      style={{ position: "relative", borderTop: "2px solid rgba(43,26,16,.14)", padding: "40px 36px 96px" }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <Brand size={28} fontSize={16} />
          <button type="button" className="tc-book-nav" onClick={onBook}>
            Book the bar
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px 20px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px 20px", flexWrap: "wrap" }}>
            <a href="/shipping-returns" style={trustLink}>
              Shipping &amp; Returns
            </a>
            <a href="/privacy" style={trustLink}>
              Privacy
            </a>
            <a href="/terms" style={trustLink}>
              Terms
            </a>
            <a href="/faq" style={trustLink}>
              FAQ
            </a>
          </div>
          <div style={{ display: "flex", gap: "10px 20px", flexWrap: "wrap", alignItems: "center" }}>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              style={{ fontWeight: 800, fontSize: 13.5, color: "var(--coral-deep)", textDecoration: "none", overflowWrap: "anywhere" }}
            >
              {CONTACT_EMAIL}
            </a>
            <a
              href={IG}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 800, fontSize: 13.5, color: "var(--coral-deep)", textDecoration: "none" }}
            >
              @_tippincowgirl
            </a>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#8a7460", fontWeight: 600 }}>
          Custom Hat Bar · The Shoppes at Solana · El Paso, TX
        </div>
      </div>
    </footer>
  );
}

// The giveaway renders instead of the whole site, with no nav, cart or footer,
// and in its own chunk so ordinary visitors never download it. It answers at
// /giveaway; the old /#/giveaway links are rewritten to it by router.js.
const Giveaway = lazy(() => import("./components/Giveaway.jsx"));

export default function App() {
  const path = usePath();
  // one handler for the whole app turns internal link clicks into pushState
  useEffect(() => installLinkInterception(), []);
  useEffect(() => scrollToInitialHash(), []);
  useCanonical(path);

  return (
    <>
      {/* mounted once for every page, the giveaway included; it follows
          pushState navigation on its own. See src/analytics.js. */}
      <Analytics beforeSend={scrubEvent} />
      {path === "/giveaway" ? (
        <Suspense fallback={<div className="gw-page" />}>
          <Giveaway />
        </Suspense>
      ) : (
        <CartProvider>
          <Site />
        </CartProvider>
      )}
    </>
  );
}

function Site() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingReturnRef = useRef(null);
  const openBooking = (e) => {
    bookingReturnRef.current = e?.currentTarget || null;
    setBookingOpen(true);
  };
  const closeBooking = () => setBookingOpen(false);

  // Clean paths (see router.js): /shipping-returns, /privacy, /terms and /faq
  // swap the landing for a trust page, and Stripe returns to
  // /order-confirmed and /checkout-cancelled. Every path is served by
  // index.html through the rewrite in vercel.json. Hashes are only section
  // anchors on the landing now.
  const pathname = usePath();
  const trustRoute = TRUST_ROUTES[pathname] ? pathname : null;
  const { closeCart } = useCart();
  const checkoutRoute = CHECKOUT_ROUTES.includes(pathname) ? pathname : null;

  useEffect(() => {
    if (trustRoute || checkoutRoute) window.scrollTo(0, 0);
  }, [trustRoute, checkoutRoute]);

  // Editing a cart line needs the builder mounted, which only the landing
  // has; elsewhere the row still shows with quantity and remove.
  const isLanding = !trustRoute && !checkoutRoute;

  return (
    <div
      style={{
        position: "relative",
        fontFamily: "'Satoshi',sans-serif",
        background: "var(--cream)",
        color: "var(--ink)",
        // clip, not hidden: hidden turns this div into a scroll container,
        // which silently disables every position:sticky inside (nav, stage)
        overflow: "clip",
      }}
    >
      {/* grain overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: "var(--z-overlay)",
          pointerEvents: "none",
          opacity: 0.04,
          mixBlendMode: "multiply",
          backgroundImage: GRAIN,
        }}
      />
      <Nav onBook={openBooking} />
      {checkoutRoute ? (
        <CheckoutResult path={checkoutRoute} />
      ) : trustRoute ? (
        <TrustPage route={trustRoute} />
      ) : (
        <>
          <Hero onBook={openBooking} />
          <Marquee />
          <Builder />
          <HowItWorks />
          <TheProcess />
          <MeetDeborah />
          <EventsSection />
          <Gallery />
          <Solana />
          <BuildFab />
        </>
      )}
      <BookingDrawer open={bookingOpen} onClose={closeBooking} returnRef={bookingReturnRef} />
      {/* one cart drawer for the whole app, so the nav can open it anywhere */}
      <CartDrawer
        canEdit={isLanding}
        onAddAnother={() => {
          closeCart();
          if (isLanding) document.getElementById("builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
          else navigate("/#builder");
        }}
      />
      <Footer onBook={openBooking} />
    </div>
  );
}
