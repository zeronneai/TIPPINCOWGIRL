import { useEffect, useRef, useState } from "react";
import HatStack from "./HatStack.jsx";
import { useCart } from "./cart.jsx";
import { useDialog } from "./useDialog.js";
import { FREE_SHIPPING_MIN_QTY, MAX_QUANTITY, MIN_QUANTITY, buildOrder, formatCents } from "./pricing.js";

// ---------------------------------------------------------------------------
// The cart drawer. Mounted once at the app root so the nav can open it from
// any section and any route, using the same panel system as the booking
// drawer. Every amount here is read off the order buildOrder() computed for
// the whole cart; nothing is summed locally.
//
// Checkout posts ONLY the configuration of each line. The server revalidates
// with validateCart() and recomputes with buildOrder() before charging, so
// nothing about the price travels from this browser.
// ---------------------------------------------------------------------------

const fmt = formatCents;

const rowAction = {
  border: 0,
  background: "none",
  padding: 0,
  color: "var(--coral-deep)",
  fontWeight: 800,
  fontSize: 12.5,
  cursor: "pointer",
  textDecoration: "underline",
};

function CartRow({ line, invalid, canEdit, onQuantity, onEdit, onRemove }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 10px",
        margin: "0 -10px",
        borderBottom: "1px solid rgba(43,26,16,.12)",
        // a line the server refused is called out where it lives
        background: invalid ? "rgba(176,78,40,.09)" : undefined,
        borderRadius: invalid ? 10 : undefined,
      }}
    >
      {/* the very same layer stack as the builder stage, just small */}
      <div
        style={{
          position: "relative",
          flex: "none",
          width: 74,
          height: 74,
          borderRadius: 10,
          overflow: "hidden",
          border: "2px solid var(--ink)",
          background: "var(--cream-2)",
        }}
      >
        <HatStack config={line.config} alt={line.description} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <strong style={{ fontSize: 14, lineHeight: 1.35, color: "var(--ink)" }}>{line.description}</strong>
          <span style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>{fmt(line.lineSubtotal)}</span>
        </div>
        {invalid && (
          <p role="alert" style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--coral-deep)" }}>
            {invalid}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <label htmlFor={`qty-${line.id}`} style={{ fontSize: 12, color: "#8a7460", fontWeight: 700 }}>
            Qty
          </label>
          <select
            id={`qty-${line.id}`}
            value={line.quantity}
            onChange={(e) => onQuantity(line.id, Number(e.target.value))}
            style={{
              padding: "4px 8px",
              borderRadius: 7,
              border: "1.5px solid rgba(43,26,16,.5)",
              background: "#fffaf0",
              fontFamily: "'Satoshi',sans-serif",
              fontWeight: 700,
              fontSize: 13.5,
              color: "var(--ink)",
            }}
          >
            {Array.from({ length: MAX_QUANTITY - MIN_QUANTITY + 1 }, (_, i) => MIN_QUANTITY + i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {canEdit && (
            <button type="button" onClick={() => onEdit(line.id)} style={rowAction}>
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            style={{ ...rowAction, color: "#8a5a4a" }}
            aria-label={`Remove ${line.description}`}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CartDrawer({ canEdit = true, onAddAnother }) {
  const { cart, cartOpen, closeCart, setLineQuantity, removeLine, requestEdit } = useCart();
  const panelRef = useRef(null);
  const returnRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [errorMsg, setErrorMsg] = useState("");
  // server reported problems, keyed by cart line index
  const [lineErrors, setLineErrors] = useState({});

  useDialog(cartOpen, closeCart, panelRef, returnRef);
  useEffect(() => {
    if (cartOpen) {
      setStatus("idle");
      setErrorMsg("");
      setLineErrors({});
    }
  }, [cartOpen]);
  // Any edit to the cart clears every stale complaint about it, the row
  // flags and the message under the button alike: she just changed the
  // thing the server objected to.
  useEffect(() => {
    setLineErrors({});
    setErrorMsg("");
    setStatus((s) => (s === "error" ? "idle" : s));
  }, [cart]);

  if (!cartOpen) return null;

  const order = buildOrder(cart);
  const empty = order.lines.length === 0;
  const totalLine = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 14.5,
    padding: "6px 0",
  };

  const onCheckout = async () => {
    if (status === "sending" || empty) return;
    setStatus("sending");
    setErrorMsg("");
    setLineErrors({});
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // configuration only, never prices; the line id stays home
        body: JSON.stringify({
          cart: order.lines.map((line) => ({
            baseId: line.config.baseId,
            bandId: line.config.bandId,
            brandId: line.config.brandId,
            customText: line.config.customText,
            size: line.config.size,
            quantity: line.quantity,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return; // leave the button in its sending state during the redirect
      }
      if (res.status === 400 && Array.isArray(data.errors)) {
        const byLine = {};
        let cartWide = "";
        for (const err of data.errors) {
          if (err.index === null || err.index === undefined) cartWide = err.message;
          else byLine[err.index] = err.message;
        }
        setLineErrors(byLine);
        setErrorMsg(
          cartWide ||
            (Object.keys(byLine).length
              ? "One of these hats needs another look."
              : "Something is off with this cart.")
        );
      } else {
        setErrorMsg("We could not open checkout just now. Please try again in a moment.");
      }
      setStatus("error");
    } catch {
      setErrorMsg("Check your connection and try again.");
      setStatus("error");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-overlay)" }}>
      <div onClick={closeCart} aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(43,26,16,.5)" }} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="cart-title" className="tc-drawer">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 id="cart-title" className="tc-sticker" style={{ margin: 0, fontSize: "clamp(28px,6vw,36px)" }}>
            Your cart
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
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

        {empty ? (
          <div>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#4a3a2c" }}>
              Nothing in here yet. Build a hat and it lands in your cart.
            </p>
            <button type="button" className="tc-btn" style={{ width: "100%", marginTop: 8 }} onClick={onAddAnother}>
              Start building
            </button>
          </div>
        ) : (
          <>
            <div>
              {order.lines.map((line, index) => (
                <CartRow
                  key={line.id}
                  line={line}
                  invalid={lineErrors[index]}
                  canEdit={canEdit}
                  onQuantity={setLineQuantity}
                  onEdit={requestEdit}
                  onRemove={removeLine}
                />
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={totalLine}>
                <span style={{ color: "#4a3a2c" }}>Subtotal</span>
                <span style={{ fontWeight: 700 }}>{fmt(order.subtotal)}</span>
              </div>
              <div style={totalLine}>
                <span style={{ color: "#4a3a2c" }}>Shipping</span>
                <span style={{ fontWeight: 700, color: order.freeShippingApplied ? "var(--teal)" : undefined }}>
                  {order.freeShippingApplied ? "FREE SHIPPING" : fmt(order.shipping)}
                </span>
              </div>
              {order.totalQuantity < FREE_SHIPPING_MIN_QTY && (
                <p style={{ margin: "2px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "#6f5b48" }}>
                  Add one more hat and shipping is on us.
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: "2px solid var(--ink)",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                <span>Total</span>
                <span style={{ color: "var(--coral-deep)" }}>{fmt(order.total)}</span>
              </div>
            </div>

            <button
              type="button"
              className="tc-btn"
              style={{ width: "100%", marginTop: 18 }}
              onClick={onCheckout}
              disabled={status === "sending" || empty}
            >
              {status === "sending" ? "Taking you to checkout..." : "Checkout"}
            </button>
            {/* The drawer is a modal, so following a link has to close it or
                the page would open underneath, hidden. */}
            <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12.5, lineHeight: 1.5, color: "#6f5b48" }}>
              By checking out you agree to our{" "}
              <a href="#/terms" onClick={closeCart} style={{ color: "var(--coral-deep)", fontWeight: 800 }}>
                Terms
              </a>{" "}
              and{" "}
              <a href="#/shipping-returns" onClick={closeCart} style={{ color: "var(--coral-deep)", fontWeight: 800 }}>
                Shipping &amp; Returns
              </a>
              . We ship within the US only.
            </p>
            {status === "error" && errorMsg && (
              <p
                role="alert"
                style={{ margin: "10px 0 0", textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}
              >
                {errorMsg}
              </p>
            )}
            <button
              type="button"
              className="tc-btn tc-btn--ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={onAddAnother}
            >
              Add another hat
            </button>
          </>
        )}
      </div>
    </div>
  );
}
