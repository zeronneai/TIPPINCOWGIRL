// ---------------------------------------------------------------------------
// Checkout result pages, served at real paths (see vercel.json rewrites):
//
//   /order-confirmed     Stripe's success_url. It appends session_id, which
//                        we deliberately do not look up yet; reading the
//                        session and emailing the owner is phase 2.
//   /checkout-cancelled  Stripe's cancel_url. The server puts the builder's
//                        own query string on this URL, so the way back is a
//                        link to the exact hat she was building, never an
//                        empty builder.
// ---------------------------------------------------------------------------

export const CHECKOUT_ROUTES = ["/order-confirmed", "/checkout-cancelled"];

function Shell({ kicker, title, children }) {
  return (
    <main className="tc-px" style={{ padding: "72px 36px 96px", minHeight: "62vh" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
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
          {kicker}
        </div>
        <h1 className="tc-sticker" style={{ margin: "0 0 24px", fontSize: "clamp(34px,5.6vw,58px)" }}>
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}

const P = { margin: "0 0 16px", fontSize: 16.5, lineHeight: 1.65, color: "#4a3a2c" };

export default function CheckoutResult({ path }) {
  if (path === "/order-confirmed")
    return (
      <Shell kicker="Your order is in" title="Thank you">
        <p style={P}>
          We got it. Your hat is going on the bench, and every one of ours is built by hand, one at a
          time, so it is worth the wait.
        </p>
        <p style={P}>
          Deborah reaches out personally with your build details and a shipping update. Keep an eye on
          your email and your phone.
        </p>
        <a href="/" className="tc-btn" style={{ marginTop: 10 }}>
          Back to the bar
        </a>
      </Shell>
    );

  // Cancelled: carry whatever the server put on this URL straight back into
  // the builder, so the hat she configured is still there.
  let query = "";
  try {
    query = window.location.search || "";
  } catch {
    /* no window: fall back to a bare builder link */
  }
  return (
    <Shell kicker="Nothing was charged" title="Your hat is right where you left it">
      <p style={P}>
        No payment went through. Your build is saved in the link below, ready to pick up whenever you
        are.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 10 }}>
        <a href={`/${query}#builder`} className="tc-btn">
          Back to my hat
        </a>
        <a href="/" className="tc-btn tc-btn--ghost">
          Back to the bar
        </a>
      </div>
    </Shell>
  );
}
