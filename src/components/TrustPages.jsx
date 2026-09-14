// ---------------------------------------------------------------------------
// Trust pages: Shipping & Returns, Privacy, FAQ. Simple hash routes
// (#/shipping-returns, #/privacy, #/faq) rendered instead of the landing.
// Copy below is placeholder in the site's voice; every line that needs the
// real policy is marked TODO.
// ---------------------------------------------------------------------------

const P = { margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.65, color: "#4a3a2c" };
const H3 = {
  margin: "26px 0 10px",
  fontWeight: 800,
  fontSize: 15,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "var(--ink)",
};

function Todo({ children }) {
  return (
    <p
      style={{
        margin: "0 0 14px",
        fontSize: 13,
        lineHeight: 1.55,
        color: "#8a6a3f",
        background: "#fdf3dd",
        border: "1.5px dashed rgba(138,106,63,.5)",
        borderRadius: 10,
        padding: "9px 12px",
        fontFamily: "ui-monospace,monospace",
      }}
    >
      TODO: {children}
    </p>
  );
}

export const TRUST_ROUTES = {
  "#/shipping-returns": {
    kicker: "The fine print, tipped politely",
    title: "Shipping & Returns",
    body: (
      <>
        <h3 style={H3}>Shipping</h3>
        <p style={P}>
          Every hat is built to order at the bar in El Paso, then packed in a box that can take a road trip.
          Once your hat ships you get a tracking number by email.
        </p>
        <Todo>confirm carriers, shipping times, flat rate and the free-shipping threshold once checkout goes live.</Todo>
        <h3 style={H3}>Returns & exchanges</h3>
        <p style={P}>
          Custom means yours: every build is made for you, so we handle issues case by case. If your hat
          arrives damaged or the size is not right, write us within 7 days and we will make it right.
        </p>
        <Todo>set the final return window, exchange rules for custom builds, and who covers return shipping.</Todo>
        <h3 style={H3}>Questions</h3>
        <p style={P}>
          DM <a href="https://www.instagram.com/_tippincowgirl/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--coral-deep)", fontWeight: 800 }}>@_tippincowgirl</a> and
          we will sort it out.
        </p>
      </>
    ),
  },
  "#/privacy": {
    kicker: "Your data, kept under our hat",
    title: "Privacy",
    body: (
      <>
        <p style={P}>
          We collect only what we need to build and ship your hat: your name, contact details, size and the
          build you chose. We do not sell your information, ever.
        </p>
        <h3 style={H3}>What we store</h3>
        <p style={P}>
          Booking requests and orders you send us. Payment details are handled by our payment processor and
          never touch our servers.
        </p>
        <Todo>name the payment processor and any analytics tools once checkout goes live, and add the effective date.</Todo>
        <h3 style={H3}>Your choices</h3>
        <p style={P}>
          Want your info gone? Write us and we will delete it. No hoops.
        </p>
        <Todo>add the contact email for privacy requests.</Todo>
      </>
    ),
  },
  "#/faq": {
    kicker: "Asked at the bar, answered here",
    title: "FAQ",
    body: (
      <>
        <h3 style={H3}>How long does my hat take?</h3>
        <p style={P}>
          Each hat is built to order. Most builds leave the bar within a few days, then shipping time on top.
        </p>
        <Todo>confirm the real build time once production settles.</Todo>
        <h3 style={H3}>How do I know my size?</h3>
        <p style={P}>
          Wrap a soft tape (or a string) around your head just above your eyebrows and ears, and match the
          centimeters to the size chart in the builder. Between two sizes? Go with the larger one.
        </p>
        <h3 style={H3}>How does shipping work?</h3>
        <p style={P}>Flat-rate shipping across the US, free over the threshold shown at checkout.</p>
        <Todo>confirm carriers, rates and whether we ship outside the US.</Todo>
        <h3 style={H3}>Can I exchange it?</h3>
        <p style={P}>
          If the size is off or something arrived wrong, write us within 7 days and we will fix it. Custom
          builds are made for you, so exchanges are case by case.
        </p>
        <Todo>align this answer with the final returns policy.</Todo>
        <h3 style={H3}>Where are you located?</h3>
        <p style={P}>
          At The Shoppes at Solana, 750 Sunland Park Dr, El Paso, TX 79912. The bar also rolls out to events
          and pop-ups around town.
        </p>
      </>
    ),
  },
};

export default function TrustPage({ route }) {
  const page = TRUST_ROUTES[route];
  if (!page) return null;
  return (
    <main className="tc-px" style={{ padding: "64px 36px 90px", minHeight: "60vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
          {page.kicker}
        </div>
        <h1 className="tc-sticker" style={{ margin: "0 0 26px", fontSize: "clamp(34px,5.4vw,56px)" }}>
          {page.title}
        </h1>
        {page.body}
        <a href="#top" className="tc-btn tc-btn--ghost" style={{ marginTop: 18 }}>
          ← Back to the bar
        </a>
      </div>
    </main>
  );
}
