// ---------------------------------------------------------------------------
// Checkout result pages, served at real paths (see vercel.json rewrites):
//
//   /order-confirmed     Stripe's success_url. It appends session_id, which
//                        we deliberately do not look up yet; reading the
//                        session and emailing the owner is phase 2. Landing
//                        here WITH that parameter is what empties the cart.
//   /checkout-cancelled  Stripe's cancel_url. Nothing was charged and the
//                        cart is still in localStorage, so this page just
//                        opens it again.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useCart } from "../shop/cart.jsx";

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
  const { clearCart, openCart } = useCart();
  const confirmed = path === "/order-confirmed";
  const cleared = useRef(false);

  // Empty the cart ONLY when Stripe actually sent us here, which it marks
  // with session_id. Someone who wanders onto this URL by hand keeps their
  // cart, because they have not bought anything.
  useEffect(() => {
    if (!confirmed || cleared.current) return;
    let paid = false;
    try {
      paid = new URLSearchParams(window.location.search).has("session_id");
    } catch {
      /* unreadable URL: treat it as not paid and leave the cart alone */
    }
    if (paid) {
      cleared.current = true;
      clearCart();
    }
  }, [confirmed, clearCart]);

  if (confirmed)
    return (
      <Shell kicker="Your order is in" title="Thank you">
        <p style={P}>
          We got it. Your hats are going on the bench, and every one of ours is built by hand, one at a
          time, so they are worth the wait.
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

  // Cancelled: nothing was charged and the cart never left the browser.
  return (
    <Shell kicker="Nothing was charged" title="Your cart is right where you left it">
      <p style={P}>
        No payment went through and nothing was lost. Every hat you built is still waiting for you.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 10 }}>
        <button type="button" className="tc-btn" onClick={openCart}>
          Back to my cart
        </button>
        <a href="/" className="tc-btn tc-btn--ghost">
          Back to the bar
        </a>
      </div>
    </Shell>
  );
}
