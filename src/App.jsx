import { useEffect, useState } from "react";
import Configurator from "./components/Configurator.jsx";
import { EVENTS } from "./hat/data.js";
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
//   src/assets/gallery/01…05.*              gallery photos and mp4 loops
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

function Nav() {
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
        <a href="#top" style={{ textDecoration: "none", minWidth: 0 }} aria-label="Tippin Cowgirl — home">
          <Brand />
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="tc-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 26, marginRight: 8 }}>
            <a href="#events" style={link}>
              Events
            </a>
            <a href="#build" style={link}>
              Hat Bar
            </a>
            <a href="#gallery" style={link}>
              Gallery
            </a>
          </div>
          <a href="#events" className="tc-book-nav">
            Book the bar
          </a>
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
          <a href="#grand-opening" style={link} onClick={() => setOpen(false)}>
            Grand Opening
          </a>
          <a href="#deborah" style={link} onClick={() => setOpen(false)}>
            Meet Deborah
          </a>
          <a href="#build" style={link} onClick={() => setOpen(false)}>
            The Hat Bar
          </a>
          <a href="#events" style={link} onClick={() => setOpen(false)}>
            Events & Pop-Ups
          </a>
          <a href="#gallery" style={link} onClick={() => setOpen(false)}>
            Gallery
          </a>
          <a href="#solana" style={{ ...link, color: "var(--coral-deep)" }} onClick={() => setOpen(false)}>
            Find us at Solana
          </a>
        </div>
      )}
    </nav>
  );
}

// --- Hero: autoplay video loop slot with sticker headline over it ------------
function Hero() {
  const video = firstUrl(HERO_VIDEO);
  const poster = firstUrl(HERO_POSTER);
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
        <video className="tc-hero-video" autoPlay muted loop playsInline preload="metadata" poster={poster || undefined}>
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
            background: "linear-gradient(180deg, rgba(30,15,8,.30) 0%, rgba(30,15,8,.52) 100%)",
          }}
        />
      )}
      <div style={{ position: "relative", maxWidth: 900 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 15px",
            background: overVideo ? "rgba(250,241,226,.92)" : "#fff",
            border: "2px solid var(--ink)",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 12.5,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--ink)",
            marginBottom: 26,
            boxShadow: "0 3px 0 var(--ink)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal)" }} /> Mobile hat
          bar · El Paso, TX
        </div>
        <h1
          className="tc-sticker"
          style={{ margin: 0, fontSize: "clamp(44px,8.2vw,104px)", transform: "rotate(-1.2deg)" }}
        >
          El Paso&apos;s
          <br />
          first hat bar
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
          Pick your felt, shape the brim, pin your charm — walk away with a hat nobody else has.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 34 }}>
          <a href="#events" className="tc-btn">
            Book the bar
          </a>
          <a href="#build" className="tc-btn tc-btn--ghost">
            Build a hat →
          </a>
        </div>
      </div>
    </header>
  );
}

function Marquee() {
  const span = {
    fontFamily: "'Alfa Slab One','Satoshi',serif",
    fontSize: 15,
    color: "var(--ink)",
    letterSpacing: ".08em",
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
function EventMediaSlot({ id, title, tall }) {
  const media = eventMedia(id);
  const frame = {
    borderRadius: 22,
    overflow: "hidden",
    border: "2px solid var(--ink)",
    boxShadow: "0 6px 0 var(--ink)",
    background: "#e9d9bf",
    minHeight: tall ? 380 : 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (media?.video)
    return (
      <div style={frame}>
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src={media.url}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  if (media)
    return (
      <div style={frame}>
        <img
          src={media.url}
          alt={title}
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  return (
    <div className="tc-halftone" style={{ ...frame, flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 40 }}>🤠</span>
      <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11.5, color: "#6f5b48" }}>
        [ drop media in src/assets/events/{id}/ ]
      </span>
    </div>
  );
}

function EventFeature({ event, featured = false }) {
  if (featured)
    return (
      <section id="grand-opening" className="tc-px" style={{ position: "relative", padding: "76px 36px 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              transform: "rotate(2deg)",
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
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(40px,6.4vw,76px)", transform: "rotate(-1deg)" }}>
            {event.title}
          </h2>
          <p style={{ maxWidth: 560, margin: "20px auto 28px", fontSize: 17, lineHeight: 1.6, color: "#4a3a2c" }}>
            {event.blurb}
          </p>
          <EventMediaSlot id={event.id} title={event.title} tall />
          {event.cta && (
            <div style={{ marginTop: 30 }}>
              <a href={event.cta.href} className="tc-btn">
                {event.cta.label}
              </a>
            </div>
          )}
        </div>
      </section>
    );

  return (
    <article style={{ display: "grid", gap: 22 }}>
      <EventMediaSlot id={event.id} title={event.title} />
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
  const photo = firstUrl(DEBORAH_PHOTO);
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
            transform: "rotate(-1.2deg)",
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
            TODO — Deborah&apos;s real story goes here: how the first hat happened, why El Paso, what the bar
            means to her. Two or three sentences, first person or close third.
          </p>
          <p style={{ margin: "14px 0 0", fontSize: 16.5, lineHeight: 1.65, color: "#4a3a2c" }}>
            TODO — second short paragraph: what a guest experiences at the bar, in her words.
          </p>
          <blockquote
            style={{
              margin: "26px 0 0",
              padding: 0,
              border: 0,
              fontFamily: "'Alfa Slab One','Satoshi',serif",
              fontSize: "clamp(19px,2.4vw,24px)",
              lineHeight: 1.3,
              color: "var(--coral-deep)",
            }}
          >
            “TODO — one line from Deborah that sounds like her.”
          </blockquote>
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
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(34px,5vw,58px)", transform: "rotate(-.8deg)" }}>
            Events &amp; Pop-Ups
          </h2>
          <p style={{ maxWidth: 540, margin: "18px auto 0", fontSize: 16, lineHeight: 1.6, color: "#4a3a2c" }}>
            Weddings, birthdays, markets, corporate parties — the bar rolls up anywhere in El Paso. DM{" "}
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
            More pop-ups announcing soon — follow{" "}
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

function GalleryTile({ name, alt, label, style }) {
  const src = name ? gallerySrc(name) : null;
  const frame = {
    borderRadius: 16,
    overflow: "hidden",
    border: "2px solid var(--ink)",
    ...style,
  };
  if (src?.video)
    return (
      <div style={frame}>
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src={src.video}
          aria-label={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  if (src)
    return (
      <figure style={{ ...frame, margin: 0 }}>
        <picture>
          {src.webp && <source srcSet={src.webp} type="image/webp" />}
          <img
            src={src.fallback}
            alt={alt}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </picture>
      </figure>
    );
  return (
    <div style={{ ...frame, background: HATCH, display: "flex", alignItems: "flex-end", padding: 14 }}>
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
        <div
          className="tc-gallery-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridAutoRows: "165px", gap: 10 }}
        >
          <GalleryTile
            name="01"
            alt="Guests building custom hats at a Tippin Cowgirl pop-up"
            label="[ 01 · vertical ]"
            style={{ gridRow: "span 2" }}
          />
          <GalleryTile name="02" alt="A finished custom hat with band and charm" label="[ 02 ]" />
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              background: "var(--coral)",
              border: "2px solid var(--ink)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <span style={{ fontFamily: "'Alfa Slab One','Satoshi',serif", fontSize: 19, color: "#fff", lineHeight: 1.15 }}>
              “Best part of the whole party.”
            </span>
          </div>
          <GalleryTile name="03" alt="The mobile hat bar set up at an event" label="[ 03 ]" />
          <GalleryTile name="04" alt="A guest styling their hat at the bar" label="[ 04 ]" />
          <GalleryTile
            name="05"
            alt="Wide shot of the Tippin Cowgirl hat bar at an event"
            label="[ 05 · wide / mp4 ok ]"
            style={{ gridColumn: "span 2" }}
          />
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
                transform: "rotate(-2deg)",
                marginBottom: 16,
              }}
            >
              Now open
            </div>
            <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(30px,4vw,46px)" }}>
              At the Shoppes at Solana
            </h2>
            <p style={{ margin: "16px 0 24px", fontSize: 15.5, lineHeight: 1.6, color: "#3a1508", fontWeight: 600 }}>
              750 Sunland Park Dr, El Paso, TX 79912. Come find the bar and build your own.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href={MAPS_DIRECTIONS} target="_blank" rel="noopener noreferrer" className="tc-btn tc-btn--ghost">
                Get directions →
              </a>
            </div>
          </div>
          <div style={{ minHeight: 340, position: "relative", borderLeft: "2px solid var(--ink)" }}>
            {mapOn ? (
              <iframe
                title="Map — The Shoppes at Solana, El Paso"
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

// --- Sticky mobile booking CTA: appears after the hero, hides at the footer --
function StickyCTA() {
  const [heroGone, setHeroGone] = useState(false);
  const [footerSeen, setFooterSeen] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("top");
    const footer = document.getElementById("site-footer");
    if (typeof IntersectionObserver === "undefined" || !hero || !footer) return undefined;
    const heroIO = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting));
    const footIO = new IntersectionObserver(([e]) => setFooterSeen(e.isIntersecting));
    heroIO.observe(hero);
    footIO.observe(footer);
    return () => {
      heroIO.disconnect();
      footIO.disconnect();
    };
  }, []);
  return (
    <div className={`tc-sticky-cta${heroGone && !footerSeen ? " on" : ""}`}>
      <a href="#events" className="tc-btn" style={{ width: "100%" }}>
        🤠 Book the bar
      </a>
    </div>
  );
}

function Footer() {
  return (
    <footer
      id="site-footer"
      className="tc-px"
      style={{ position: "relative", borderTop: "2px solid rgba(43,26,16,.14)", padding: "40px 36px 96px" }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Brand size={28} fontSize={16} />
        <div style={{ fontSize: 13.5, color: "#6f5b48", fontWeight: 600 }}>
          Custom Hat Bar · The Shoppes at Solana · El Paso, TX
        </div>
        <a
          href={IG}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 800, fontSize: 13.5, color: "var(--coral-deep)", textDecoration: "none" }}
        >
          @_tippincowgirl
        </a>
      </div>
    </footer>
  );
}

export default function App() {
  const featured = EVENTS.find((e) => e.featured);
  return (
    <div
      style={{
        position: "relative",
        fontFamily: "'Satoshi',sans-serif",
        background: "var(--cream)",
        color: "var(--ink)",
        overflow: "hidden",
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
      <Nav />
      <Hero />
      <Marquee />
      {featured && <EventFeature event={featured} featured />}
      <MeetDeborah />
      <Configurator />
      <EventsSection />
      <Gallery />
      <Solana />
      <StickyCTA />
      <Footer />
    </div>
  );
}
