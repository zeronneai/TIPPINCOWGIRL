import Configurator from "./components/Configurator.jsx";
import logo from "/logo.png";

const IG = "https://www.instagram.com/_tippincowgirl/";

const GRAIN =
  "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22/></svg>')";

const MARQUEE_TEXT =
  "CUSTOM HAT BAR ✦ EL PASO, TX ✦ MOBILE POP-UPS ✦ EVENTS & PARTIES ✦ ONE-OF-A-KIND ✦ TIP YOUR HAT ✦ CUSTOM HAT BAR ✦ EL PASO, TX ✦ MOBILE POP-UPS ✦ EVENTS & PARTIES ✦ ONE-OF-A-KIND ✦ TIP YOUR HAT ✦";

function Brand({ size = 30, fontSize = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <img
        src={logo}
        alt="Tippin Cowgirl logo"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }}
      />
      <span
        style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize,
          fontWeight: 700,
          letterSpacing: "-.01em",
          textTransform: "uppercase",
          color: "#f6efe2",
        }}
      >
        Tippin Cowgirl
      </span>
    </div>
  );
}

function Nav() {
  const link = {
    fontWeight: 600,
    fontSize: 14,
    color: "#e9dcc8",
    textDecoration: "none",
    letterSpacing: ".02em",
  };
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 36px",
        background: "rgba(36,23,16,.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(246,239,226,.08)",
      }}
    >
      <Brand />
      <div className="tc-nav-links" style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <a href="#build" style={{ ...link, display: "none" }}>
          The Hat Bar
        </a>
        <a href="#how" style={link}>
          Mobile Bar
        </a>
        <a href="#gallery" style={link}>
          Gallery
        </a>
        <a
          href="#events"
          className="tc-book-nav"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 18px",
            background: "#c25b34",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            borderRadius: 999,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(194,91,52,.35)",
          }}
        >
          Book the bar
        </a>
      </div>
    </nav>
  );
}

function Marquee() {
  const span = {
    fontFamily: "'Space Grotesk',sans-serif",
    fontSize: 13,
    fontWeight: 700,
    color: "#241710",
    letterSpacing: ".18em",
  };
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", background: "#c25b34", borderBottom: "2px solid #241710" }}>
      <div style={{ display: "inline-flex", gap: 34, padding: "9px 0", animation: "marquee 26s linear infinite" }}>
        <span style={span}>{MARQUEE_TEXT}</span>
        <span style={span}>{MARQUEE_TEXT}</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <header
      style={{
        position: "relative",
        maxWidth: 1180,
        margin: "0 auto",
        padding: "64px 36px 30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "7px 15px",
          border: "1px solid rgba(246,239,226,.22)",
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 12.5,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "#e0b48f",
          marginBottom: 24,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fa89a" }} /> El Paso, TX
        · Mobile Hat Bar
      </div>
      <h1
        style={{
          margin: 0,
          fontFamily: "'Fraunces',serif",
          fontWeight: 600,
          fontSize: "clamp(44px,7vw,86px)",
          lineHeight: 0.98,
          letterSpacing: "-.01em",
          color: "#f6efe2",
        }}
      >
        Tip your hat,
        <br />
        <span style={{ fontStyle: "italic", color: "#e0905f" }}>make it yours.</span>
      </h1>
      <p style={{ maxWidth: 560, margin: "24px 0 0", fontSize: 17, lineHeight: 1.6, color: "#d9c8b4" }}>
        Step up to the bar, pick your felt, shape the brim, wrap a band and pin your charm — and strut
        off with a one-of-a-kind custom hat. We bring the whole experience to your event.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", marginTop: 34 }}>
        <a
          href="#build"
          className="tc-cta-light"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "15px 28px",
            background: "#f6efe2",
            color: "#241710",
            fontWeight: 800,
            fontSize: 15,
            borderRadius: 999,
            textDecoration: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,.3)",
            transition: "transform .14s ease",
          }}
        >
          Start building →
        </a>
        <a
          href="#events"
          className="tc-cta-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            padding: "15px 28px",
            background: "transparent",
            color: "#f6efe2",
            fontWeight: 700,
            fontSize: 15,
            borderRadius: 999,
            textDecoration: "none",
            border: "1px solid rgba(246,239,226,.3)",
            transition: "background .14s ease",
          }}
        >
          Book an event
        </a>
      </div>
    </header>
  );
}

function HowCard({ num, title, body, dark }) {
  return (
    <div
      style={{
        background: dark ? "#241710" : "#fffaf0",
        color: dark ? "#f6efe2" : undefined,
        border: dark ? undefined : "1px solid #e7dcc8",
        borderRadius: 20,
        padding: 26,
      }}
    >
      <div
        style={{
          fontFamily: "'Fraunces',serif",
          fontSize: 34,
          color: dark ? "#e0905f" : "#c25b34",
          lineHeight: 1,
        }}
      >
        {num}
      </div>
      <div style={{ fontWeight: 800, fontSize: 17, margin: "14px 0 6px" }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: dark ? "#c9b7a2" : "#83705e" }}>{body}</div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" style={{ position: "relative", background: "#f6efe2", color: "#3a261c", padding: "72px 36px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 46 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11.5, fontWeight: 700, letterSpacing: ".24em", textTransform: "uppercase", color: "#c25b34", marginBottom: 12 }}>
            We come to you
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Fraunces',serif",
              fontWeight: 600,
              fontSize: "clamp(30px,4.4vw,48px)",
              lineHeight: 1,
              color: "#3a261c",
            }}
          >
            How the mobile hat bar works.
          </h2>
          <p style={{ maxWidth: 520, margin: "16px auto 0", fontSize: 16, lineHeight: 1.6, color: "#83705e" }}>
            A full custom-hat experience that rolls right up to your party, market, wedding or wellness
            event.
          </p>
        </div>
        <div className="tc-how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          <HowCard num="01" title="We roll up" body="The mobile bar arrives stocked with felt hats, bands, charms and tools — set up and ready to style." />
          <HowCard num="02" title="Pick your base" body="Choose your felt color and brim shape — the foundation of a hat that actually fits your vibe." />
          <HowCard num="03" title="Style it live" body="Band it, pin a charm, foil-stamp your initials. Our hat stylist shapes it on the spot." />
          <HowCard num="04" title="Tip your hat" body="Walk away wearing a one-of-a-kind hat — and the story of how you built it." dark />
        </div>
      </div>
    </section>
  );
}

const HATCH = "repeating-linear-gradient(135deg,#3a2417,#3a2417 14px,#2f1d11 14px,#2f1d11 28px)";

function GalleryTile({ label, style }) {
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        background: HATCH,
        border: "1px solid rgba(246,239,226,.08)",
        display: "flex",
        alignItems: "flex-end",
        padding: 16,
        ...style,
      }}
    >
      <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#a98a68" }}>{label}</span>
    </div>
  );
}

function Gallery() {
  return (
    <section id="gallery" style={{ position: "relative", padding: "72px 36px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 30,
          }}
        >
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11.5, fontWeight: 700, letterSpacing: ".24em", textTransform: "uppercase", color: "#3fa89a", marginBottom: 11 }}>
              From the bar
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: "'Fraunces',serif",
                fontWeight: 600,
                fontSize: "clamp(30px,4.4vw,48px)",
                lineHeight: 1,
                color: "#f6efe2",
              }}
            >
              Hats with a backstory.
            </h2>
          </div>
          <a href={IG} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 14, color: "#e0905f", textDecoration: "none" }}>
            @_tippincowgirl on Instagram →
          </a>
        </div>
        <div
          className="tc-gallery-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridAutoRows: "200px", gap: 12 }}
        >
          <GalleryTile label="[ pop-up event photo · vertical ]" style={{ gridRow: "span 2" }} />
          <GalleryTile label="[ finished hat ]" />
          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              background: "#c25b34",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <span style={{ fontFamily: "'Fraunces',serif", fontSize: 22, color: "#241710", lineHeight: 1.05 }}>
              “Best part of the whole party.”
            </span>
          </div>
          <GalleryTile label="[ bar setup ]" />
          <GalleryTile label="[ guest styling ]" />
          <GalleryTile label="[ wide event shot · horizontal ]" style={{ gridColumn: "span 2" }} />
        </div>
      </div>
    </section>
  );
}

function EventInfo({ label, value }) {
  return (
    <div style={{ background: "rgba(36,23,16,.16)", borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#3a1c0e" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, color: "#241710", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Events() {
  return (
    <section id="events" style={{ position: "relative", padding: "24px 36px 90px" }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          borderRadius: 28,
          overflow: "hidden",
          background: "linear-gradient(135deg,#c25b34 0%,#a8421f 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage: "radial-gradient(circle at 80% 20%, #fff 0, transparent 40%)",
          }}
        />
        <div
          className="tc-events-grid"
          style={{ position: "relative", display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 30, padding: 48 }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 13px",
                background: "rgba(36,23,16,.25)",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "#241710",
                marginBottom: 20,
              }}
            >
              Next stop
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: "'Fraunces',serif",
                fontWeight: 600,
                fontSize: "clamp(30px,4.2vw,46px)",
                lineHeight: 1.02,
                color: "#241710",
              }}
            >
              June 28th — Sunday Funday Wellness Event
            </h2>
            <p style={{ maxWidth: 440, margin: "16px 0 0", fontSize: 16, lineHeight: 1.55, color: "#3a1c0e" }}>
              Come find the bar in El Paso and build your own. Hosting a wedding, birthday, market or
              corporate party? Bring the hat bar to you.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
              <a
                href={IG}
                target="_blank"
                rel="noopener noreferrer"
                className="tc-event-dark"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "15px 26px",
                  background: "#241710",
                  color: "#f6efe2",
                  fontWeight: 800,
                  fontSize: 15,
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                DM to book your event
              </a>
              <a
                href="#build"
                className="tc-event-light"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "15px 26px",
                  background: "rgba(255,255,255,.85)",
                  color: "#241710",
                  fontWeight: 800,
                  fontSize: 15,
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                Build a hat first
              </a>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
            <EventInfo label="Where" value="El Paso, TX" />
            <EventInfo label="We do" value="Pop-ups · Private events" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ position: "relative", borderTop: "1px solid rgba(246,239,226,.1)", padding: "40px 36px" }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <Brand size={28} fontSize={18} />
        <div style={{ fontSize: 13.5, color: "#a98a68" }}>Custom Hat Bar · Mobile · El Paso, TX</div>
        <a href={IG} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 13.5, color: "#e0905f", textDecoration: "none" }}>
          @_tippincowgirl
        </a>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div
      style={{
        position: "relative",
        fontFamily: "'Space Grotesk',sans-serif",
        background: "#241710",
        color: "#f6efe2",
        overflow: "hidden",
      }}
    >
      {/* grain overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          pointerEvents: "none",
          opacity: 0.05,
          mixBlendMode: "overlay",
          backgroundImage: GRAIN,
        }}
      />
      <Nav />
      <Marquee />
      <Hero />
      <Configurator />
      <HowItWorks />
      <Gallery />
      <Events />
      <Footer />
    </div>
  );
}
