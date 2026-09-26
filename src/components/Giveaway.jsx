// ---------------------------------------------------------------------------
// /giveaway: a standalone entry page for the giveaway with Girls Run The 915.
//
// Reached only by link (Instagram), at /giveaway or /#/giveaway. It is not in
// the nav, the footer or the sitemap, and it renders on its own: no nav, no
// cart, no footer, so the whole thing fits one phone screen. It is loaded as
// its own chunk, so the main site bundle does not carry it.
//
// NOINDEX, only here. The meta tag below is added on mount and removed on
// unmount, so the rest of the site stays indexable. vercel.json also sends an
// X-Robots-Tag header for the /giveaway path, which covers crawlers that do
// not run JavaScript.
//
// SUBMISSION follows the booking form exactly: JSON in a text/plain body so
// the browser skips the CORS preflight an Apps Script web app cannot answer,
// and never no-cors, so the reply can be read. It posts to its OWN Apps
// Script and its own Sheet, VITE_GIVEAWAY_ENDPOINT. Entries must never land in
// the booking Sheet, so the booking URL is refused outright below.
//
// The script answers JSON:
//   { ok: true }                      entry recorded
//   { ok: true, duplicate: true }     already entered, nothing new recorded
//   { ok: false, error: "consent" }   consent missing
//   { ok: false, error: "invalid" }   a field did not pass its checks
// Anything else, including a reply that is not JSON, counts as a failure.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { BOOKING_ENDPOINT } from "../hat/data.js";
import logo from "/logo.png";
import "./Giveaway.css";

const GIVEAWAY_ENDPOINT = import.meta.env?.VITE_GIVEAWAY_ENDPOINT || "";
const ENDPOINT_READY =
  /^https:\/\/script\.google\.com\//.test(GIVEAWAY_ENDPOINT) && GIVEAWAY_ENDPOINT !== BOOKING_ENDPOINT;

// ---------------------------------------------------------------------------
// TODO(giveaway): FILL IN THE DRAW DATE, e.g. "October 31, 2026".
// While this is null the fine print says the date will be announced, so the
// page never shows a placeholder to the public.
// ---------------------------------------------------------------------------
const DRAW_DATE = null;

const TIPPIN_IG = "https://www.instagram.com/_tippincowgirl/";
const GRT_IG = "https://www.instagram.com/girlsrunthe915/";

const CLD = "https://res.cloudinary.com/dsprn0ew4/image/upload";
const GRT_LOGO = `${CLD}/w_240,q_auto,f_auto/v1790382484/ChatGPT_Image_Sep_25_2026_06_27_58_PM_fku7yk.png`;

// The prize, blurred BY CLOUDINARY, never by CSS: the pixels that reach the
// browser are already blurred, so there is nothing to switch off in devtools.
// The blur runs on the whole photo first and the crop comes after it, which
// keeps a readable silhouette; cropping first zooms in and turns it into a
// smear. e_blur:2000 is Cloudinary's maximum. Lower values (800, 1000) were
// tried and showed the band.
//
// NOTE: this does not hide the ORIGINAL file, which is still public at the
// same public id with no transformation. See the giveaway notes in README.
const PRIZE_ID = "v1790382472/GIVEWWAY_jtqlm2.jpg";
const PRIZE_WIDE = `${CLD}/w_600,c_limit/e_blur:2000/c_fill,ar_16:10,w_720,g_center,y_40/q_auto,f_auto/${PRIZE_ID}`;
const PRIZE_TALL = `${CLD}/w_600,c_limit/e_blur:2000/q_auto,f_auto/${PRIZE_ID}`;

const LIMITS = { name: 80, email: 120, phone: 20 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { name: "", email: "", phone: "", consent: false, company: "" };

/** US numbers only (the giveaway is El Paso only): 10 digits, or 11 with a leading 1. */
function phoneDigits(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

/** @returns field name to message; empty means valid. */
export function validateEntry(values) {
  const v = values || {};
  const errors = {};
  const name = String(v.name || "").trim();
  const email = String(v.email || "").trim();
  const phone = String(v.phone || "").trim();

  if (!name) errors.name = "Tell us your name.";
  else if (name.length > LIMITS.name) errors.name = `Keep this under ${LIMITS.name} characters.`;

  if (!email) errors.email = "We need your email to reach you.";
  else if (email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) errors.email = "That email does not look right.";

  if (!phone) errors.phone = "We need a phone number too.";
  else if (phoneDigits(phone).length !== 10) errors.phone = "Enter a 10 digit US phone number.";

  if (v.consent !== true) errors.consent = "Tick the box to enter.";
  return errors;
}

const ERROR_COPY = {
  network: "We could not send your entry. Check your connection and try again. Everything you typed is still here.",
  invalid: "Something in your entry did not look right. Check your name, email and phone, then try again.",
  consent: "Please tick the box above to enter.",
  unconfigured: "Entries are not open just yet. Please try again soon.",
  unknown: "Something went wrong on our side. Please try again in a moment.",
};

function Field({ id, label, error, children }) {
  return (
    <div className="gw-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p id={`${id}-error`} className="gw-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function FollowButtons() {
  return (
    <div className="gw-follow">
      <a href={TIPPIN_IG} target="_blank" rel="noopener noreferrer" className="tc-btn tc-btn--ghost">
        @_tippincowgirl
      </a>
      <a href={GRT_IG} target="_blank" rel="noopener noreferrer" className="tc-btn tc-btn--ghost">
        @girlsrunthe915
      </a>
    </div>
  );
}

function Success({ duplicate }) {
  const ref = useRef(null);
  // move focus to the result so a screen reader announces it
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="gw-success">
      <p className="tc-sticker gw-success-title">{duplicate ? "You're already in!" : "You're in!"}</p>
      <p className="gw-success-body">
        {duplicate
          ? "Looks like you entered already, and one entry is all it takes. Good luck!"
          : "Your entry is saved. Check your inbox: a confirmation email is on its way."}
      </p>
      <p className="gw-success-body" style={{ marginBottom: 12 }}>
        Follow us both so you don't miss the reveal.
      </p>
      <FollowButtons />
    </div>
  );
}

export default function Giveaway() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  // idle | sending | done | duplicate | error
  const [status, setStatus] = useState("idle");
  const [errorKind, setErrorKind] = useState(null);
  const formRef = useRef(null);

  // noindex for this page only, plus its own tab title; both undone on leave
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = "Win a custom hat · Tippin' Cowgirl x Girls Run The 915";
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);

  const setField = (key) => (e) => {
    const value = key === "consent" ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    if (status === "error") {
      setStatus("idle");
      setErrorKind(null);
    }
  };

  const fail = (kind) => {
    setErrorKind(kind);
    setStatus("error");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;

    const found = validateEntry(values);
    setErrors(found);
    const firstBad = Object.keys(found)[0];
    if (firstBad) {
      formRef.current?.querySelector(`#gw-${firstBad}`)?.focus();
      return;
    }

    if (!ENDPOINT_READY) {
      console.error(
        "[giveaway] VITE_GIVEAWAY_ENDPOINT is missing, is not an Apps Script URL, or is the booking endpoint. Nothing was sent."
      );
      fail("unconfigured");
      return;
    }

    setStatus("sending");
    setErrorKind(null);
    let res;
    try {
      res = await fetch(GIVEAWAY_ENDPOINT, {
        method: "POST",
        // text/plain keeps this a simple request. Do NOT switch it to
        // application/json: Apps Script cannot answer the preflight.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          name: values.name.trim(),
          // lowercased so the script's duplicate check is not fooled by case
          email: values.email.trim().toLowerCase(),
          // digits only, 10 of them, so one number is always written one way
          phone: phoneDigits(values.phone),
          consent: values.consent === true,
          // honeypot: a person leaves it empty; the script drops filled ones
          company: values.company,
        }),
      });
    } catch (err) {
      console.error("[giveaway] request failed:", err);
      fail("network");
      return;
    }

    const body = await res.json().catch(() => null);
    if (body?.ok === true) {
      setValues(EMPTY);
      setErrors({});
      setStatus(body.duplicate === true ? "duplicate" : "done");
      return;
    }
    console.error("[giveaway] entry refused:", res.status, body);
    if (body?.error === "consent") {
      setErrors((prev) => ({ ...prev, consent: "Tick the box to enter." }));
      fail("consent");
    } else if (body?.error === "invalid") fail("invalid");
    else fail("unknown");
  };

  const sending = status === "sending";
  const finished = status === "done" || status === "duplicate";

  return (
    <main className="gw-page">
      <div className="gw-wrap">
        <header className="gw-logos">
          <img src={logo} alt="Tippin' Cowgirl" className="gw-logo-tc" width="48" height="48" />
          <span className="gw-x" aria-hidden="true">
            x
          </span>
          <img src={GRT_LOGO} alt="Girls Run The 915" className="gw-logo-grt" width="62" height="62" />
        </header>

        <h1 className="tc-sticker gw-title">Win a custom hat</h1>
        <p className="gw-sub">A custom hat, plus surprise accessories.</p>

        <div className="gw-grid">
          <figure className="gw-prize">
            <picture>
              <source media="(min-width: 820px)" srcSet={PRIZE_TALL} />
              <img src={PRIZE_WIDE} alt="The prize, blurred until the reveal" />
            </picture>
            <figcaption className="tc-sticker gw-ready">She's almost ready</figcaption>
          </figure>

          <section className="gw-panel" aria-label="Enter the giveaway">
            {finished ? (
              <Success duplicate={status === "duplicate"} />
            ) : (
              <form ref={formRef} onSubmit={submit} noValidate>
                <Field id="gw-name" label="Name" error={errors.name}>
                  <input
                    id="gw-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={LIMITS.name}
                    value={values.name}
                    onChange={setField("name")}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "gw-name-error" : undefined}
                    required
                  />
                </Field>
                <Field id="gw-email" label="Email" error={errors.email}>
                  <input
                    id="gw-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={LIMITS.email}
                    value={values.email}
                    onChange={setField("email")}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "gw-email-error" : undefined}
                    required
                  />
                </Field>
                <Field id="gw-phone" label="Phone" error={errors.phone}>
                  <input
                    id="gw-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={LIMITS.phone}
                    value={values.phone}
                    onChange={setField("phone")}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "gw-phone-error" : undefined}
                    required
                  />
                </Field>

                {/* honeypot, same treatment as the booking form */}
                <div className="tc-hp" aria-hidden="true">
                  <label htmlFor="gw-company">Company</label>
                  <input
                    id="gw-company"
                    name="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.company}
                    onChange={setField("company")}
                  />
                </div>

                <label className="gw-consent" htmlFor="gw-consent">
                  <input
                    id="gw-consent"
                    name="consent"
                    type="checkbox"
                    checked={values.consent}
                    onChange={setField("consent")}
                    aria-describedby={errors.consent ? "gw-consent-error" : undefined}
                    required
                  />
                  <span>Yes, send me updates from Tippin' Cowgirl and Girls Run The 915.</span>
                </label>
                {errors.consent && (
                  <p id="gw-consent-error" className="gw-field-error" role="alert">
                    {errors.consent}
                  </p>
                )}

                <button
                  type="submit"
                  className="tc-btn gw-submit"
                  disabled={!values.consent || sending}
                  aria-busy={sending}
                >
                  {sending ? "Sending your entry..." : "Enter to win"}
                </button>

                {status === "error" && errorKind && (
                  <p className="gw-error" role="alert">
                    {ERROR_COPY[errorKind] || ERROR_COPY.unknown}
                  </p>
                )}
              </form>
            )}
          </section>
        </div>

        <p className="gw-fine">
          No purchase necessary. Open to El Paso, TX residents 18 and older.{" "}
          {DRAW_DATE ? `Winner drawn on ${DRAW_DATE}.` : "Drawing date to be announced."} The winner is contacted by
          email or phone. This giveaway is not sponsored, endorsed or administered by, or associated with, Instagram.
        </p>
      </div>
    </main>
  );
}
