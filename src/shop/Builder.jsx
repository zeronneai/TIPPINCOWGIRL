import { useEffect, useMemo, useRef, useState } from "react";
import { BASES, BLEND, BRAND_TEXT, CATEGORIES, SIZES, SIZE_GUIDE, findIn } from "./catalog.js";
import HatStack, { BrandTextLayer } from "./HatStack.jsx";
import { useCart } from "./cart.jsx";
import {
  FREE_SHIPPING_MIN_QTY,
  MAX_CART_QUANTITY,
  MAX_QUANTITY,
  MIN_QUANTITY,
  buildOrder,
  formatCents,
  sanitizeBrandText,
} from "./pricing.js";

// ---------------------------------------------------------------------------
// The hat builder: layered 2D product configurator driven entirely by
// catalog.js. Stage = square canvas with one absolutely-positioned full-size
// Cloudinary PNG per selected layer, stacked and blended per the catalog
// contract (base normal, brand multiply UNDER the band). The stack lives in
// an isolation:isolate element so the brand's multiply never bleeds into the
// stage background. Zoom is a CSS transform (wheel / pinch, 1x to 2.5x) with
// drag-to-pan while zoomed.
//
// A design lives in the URL query (?b=&bd=&br=&bt=&sz=) so any single build
// is shareable. That permalink is ONE hat, never the cart: opening it loads
// the design ready to add, it never adds itself. Quantity is not in there,
// because quantity belongs to a cart line rather than to a design.
//
// NOTHING here does money arithmetic: every amount on screen comes from
// buildOrder() in pricing.js, the same pure module the server uses to
// recompute the order before charging.
// ---------------------------------------------------------------------------

const fmt = formatCents;

const ZOOM_MIN = 1;
const ZOOM_MAX = 2.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// URL param per category (+ bt custom text, sz size). No quantity: see above.
const PARAM_KEYS = { base: "b", band: "bd", brand: "br" };

const defaultSelection = () => ({ base: "ivory", band: "none", brand: "none" });

function readUrl() {
  const sel = defaultSelection();
  let size = null;
  let brandText = "";
  try {
    const q = new URLSearchParams(window.location.search);
    for (const cat of CATEGORIES) {
      const v = q.get(PARAM_KEYS[cat.key]);
      if (v && findIn(cat.options, v)) sel[cat.key] = v;
    }
    const sz = q.get("sz");
    if (sz && SIZES.some((s) => s.id === sz)) size = sz;
    brandText = sanitizeBrandText(q.get("bt"));
  } catch {
    /* no window / malformed URL: fall through to defaults */
  }
  return { sel, size, brandText };
}

function writeUrl(sel, size, brandText) {
  try {
    const q = new URLSearchParams(window.location.search);
    for (const cat of CATEGORIES) q.set(PARAM_KEYS[cat.key], sel[cat.key]);
    if (size) q.set("sz", size);
    else q.delete("sz");
    if (sel.brand === "custom" && brandText) q.set("bt", brandText);
    else q.delete("bt");
    // A stale q= from an older shared link would be misleading now.
    q.delete("q");
    const url = `${window.location.pathname}?${q.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  } catch {
    /* ignore: permalink is a nice-to-have */
  }
}

// Turn the builder's own selection state into a catalog config.
const toConfig = (sel, size, brandText) => ({
  baseId: sel.base,
  bandId: sel.band,
  brandId: sel.brand,
  customText: sel.brand === "custom" ? brandText : null,
  size,
});

// Focus trap shared by the size modal and the order drawer (same behavior as
// the booking drawer: Tab cycles inside, Escape closes, focus returns).
function useDialog(open, onClose, panelRef, returnRef) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      panelRef.current?.querySelector("button,a[href],input,select")?.focus();
    }, 80);
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
  }, [open, onClose, panelRef, returnRef]);
}

// Thumbnails are real mini-stacks (ivory base + the piece, same blend as the
// stage) cropped by CSS to the piece's zone, so they always match what the
// stage renders. transform-origin is the piece's spot in canvas coordinates.
const THUMB_CROP = {
  base: null,
  band: { origin: "50% 58%", scale: 2.3 },
  brand: { origin: `${(BRAND_TEXT.cx / 1600) * 100}% ${(BRAND_TEXT.cy / 1600) * 100}%`, scale: 2.5 },
};
const THUMB_BASE = BASES[0].layerImg; // ivory: the burn and bands read best on it

function OptionThumb({ catKey, item, selected, onPick, brandText }) {
  const crop = THUMB_CROP[catKey];
  const imgSt = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const empty = !item.layerImg && !item.custom;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className="tc-opt"
      style={{
        border: selected ? "2px solid var(--coral)" : "2px solid rgba(43,26,16,.28)",
        boxShadow: selected ? "0 3px 0 var(--coral-deep)" : "none",
        background: "#fffaf0",
        borderRadius: 12,
        padding: 8,
        cursor: "pointer",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "border-color .15s ease",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "block",
          aspectRatio: "1 / 1",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--cream-2)",
          position: "relative",
        }}
      >
        {empty ? (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              color: "#a08a72",
            }}
          >
            ø
          </span>
        ) : (
          <span
            style={{
              position: "absolute",
              inset: 0,
              isolation: "isolate",
              transform: crop ? `scale(${crop.scale})` : undefined,
              transformOrigin: crop ? crop.origin : undefined,
            }}
          >
            {catKey !== "base" && <img src={THUMB_BASE} alt="" draggable={false} style={imgSt} />}
            {item.custom ? (
              <BrandTextLayer text={brandText || "ABC"} z={2} />
            ) : (
              <img src={item.layerImg} alt="" draggable={false} style={{ ...imgSt, mixBlendMode: BLEND[catKey] }} />
            )}
          </span>
        )}
      </span>
      <span style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.2, color: "var(--ink)" }}>{item.name}</span>
      <span style={{ fontWeight: 700, fontSize: 11.5, color: "var(--coral-deep)" }}>
        {catKey === "base" ? fmt(item.price) : item.price > 0 ? `+${fmt(item.price)}` : "Included"}
      </span>
    </button>
  );
}

// --- Find-your-size modal ----------------------------------------------------
function SizeModal({ open, onClose, onPick, returnRef }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef, returnRef);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-overlay)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={onClose} aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(43,26,16,.5)" }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        style={{
          position: "relative",
          width: "min(520px, 100%)",
          maxHeight: "86vh",
          overflowY: "auto",
          background: "var(--cream)",
          border: "2px solid var(--ink)",
          boxShadow: "0 6px 0 var(--ink)",
          borderRadius: 18,
          padding: "22px 22px 26px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h3 id="size-guide-title" className="tc-sticker" style={{ margin: 0, fontSize: "clamp(24px,5vw,30px)" }}>
            {SIZE_GUIDE.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close size guide"
            style={{
              flex: "none",
              width: 36,
              height: 36,
              border: "2px solid rgba(43,26,16,.4)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink)",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <ol style={{ margin: "0 0 18px", padding: "0 0 0 20px", display: "grid", gap: 8 }}>
          {SIZE_GUIDE.howTo.map((step) => (
            <li key={step} style={{ fontSize: 14.5, lineHeight: 1.55, color: "#4a3a2c" }}>
              {step}
            </li>
          ))}
        </ol>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              {["Size", "Centimeters", "Inches", ""].map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    fontSize: 11,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "#6f4526",
                    borderBottom: "2px solid rgba(43,26,16,.3)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_GUIDE.rows.map((r) => (
              <tr key={r.size}>
                <td style={{ padding: "9px 10px", fontWeight: 800, borderBottom: "1px solid rgba(43,26,16,.14)" }}>{r.size}</td>
                <td style={{ padding: "9px 10px", borderBottom: "1px solid rgba(43,26,16,.14)", color: "#4a3a2c" }}>{r.cm}</td>
                <td style={{ padding: "9px 10px", borderBottom: "1px solid rgba(43,26,16,.14)", color: "#4a3a2c" }}>{r.inches}</td>
                <td style={{ padding: "9px 6px", borderBottom: "1px solid rgba(43,26,16,.14)", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r.size.toLowerCase());
                      onClose();
                    }}
                    style={{
                      border: "2px solid rgba(43,26,16,.35)",
                      borderRadius: 7,
                      background: "#fffaf0",
                      color: "var(--coral-deep)",
                      fontWeight: 800,
                      fontSize: 11.5,
                      padding: "5px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Pick {r.size}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Cart drawer -------------------------------------------------------------
// Same drawer system as booking. Every amount here is read off the order
// that buildOrder() computed for the whole cart; nothing is summed locally.
function CartRow({ line, onQuantity, onEdit, onRemove }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 0",
        borderBottom: "1px solid rgba(43,26,16,.12)",
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
          <button type="button" onClick={() => onEdit(line.id)} style={rowAction}>
            Edit
          </button>
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

function CartDrawer({ open, onClose, order, onQuantity, onEdit, onRemove, onAddAnother, returnRef }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef, returnRef);
  if (!open) return null;

  const empty = order.lines.length === 0;
  const totalLine = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 14.5,
    padding: "6px 0",
  };

  // TODO(phase 1D): POST the cart to the checkout endpoint, which revalidates
  // with validateCart() and recomputes with buildOrder() before creating the
  // Stripe session. Intentionally inert for now.
  const onCheckout = () => {};

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-overlay)" }}>
      <div onClick={onClose} aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(43,26,16,.5)" }} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="cart-title" className="tc-drawer">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 id="cart-title" className="tc-sticker" style={{ margin: 0, fontSize: "clamp(28px,6vw,36px)" }}>
            Your cart
          </h2>
          <button
            type="button"
            onClick={onClose}
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
              {order.lines.map((line) => (
                <CartRow key={line.id} line={line} onQuantity={onQuantity} onEdit={onEdit} onRemove={onRemove} />
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

            <button type="button" className="tc-btn" style={{ width: "100%", marginTop: 18 }} onClick={onCheckout}>
              Checkout
            </button>
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

// --- The builder section ------------------------------------------------------
export default function Builder() {
  const initial = useMemo(readUrl, []);
  const [sel, setSel] = useState(initial.sel);
  const [size, setSize] = useState(initial.size);
  const [brandText, setBrandText] = useState(initial.brandText);
  const [sizeModal, setSizeModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [sizeHint, setSizeHint] = useState(false);
  const [textHint, setTextHint] = useState(false);
  // null while building a new hat; a cart line id while editing that row
  const [editingId, setEditingId] = useState(null);
  const [added, setAdded] = useState("");

  const { cart, addLine, updateLine, setLineQuantity, removeLine, isFull } = useCart();

  // zoom / pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);

  const sizeBtnRef = useRef(null);
  const cartBtnRef = useRef(null);
  const sizeRowRef = useRef(null);
  const brandRowRef = useRef(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    writeUrl(sel, size, brandText);
  }, [sel, size, brandText]);

  // The "added to cart" confirmation is a quiet line, not a modal: it clears
  // itself so she can keep building straight away.
  useEffect(() => {
    if (!added) return undefined;
    const t = setTimeout(() => setAdded(""), 2600);
    return () => clearTimeout(t);
  }, [added]);

  // Warm the selected base right away and the rest of the bases shortly
  // after: base swaps are the most common tap and should feel instant.
  useEffect(() => {
    const warm = (u) => {
      if (!u) return;
      const im = new Image();
      im.src = u;
    };
    warm(findIn(BASES, sel.base)?.layerImg);
    const t = setTimeout(() => BASES.forEach((b) => warm(b.layerImg)), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (key, id) => setSel((s) => ({ ...s, [key]: id }));

  const isCustomBrand = sel.brand === "custom";
  const design = toConfig(sel, size, brandText);

  // Two calls, one engine: the cart order drives the drawer, and the design
  // on its own gives the stage its per hat price. No component in this file
  // adds prices together; they only read fields off these objects.
  const order = buildOrder(cart);
  const designOrder = buildOrder([{ ...design, quantity: 1 }]);
  const unitPrice = designOrder.lines[0].unitSubtotal;

  const clampPan = (p, z, rect) => {
    const limit = ((z - 1) * (rect?.width || 0)) / 2;
    return { x: clamp(p.x, -limit, limit), y: clamp(p.y, -limit, limit) };
  };

  // Wheel zoom needs a non-passive listener to preventDefault page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setZoom((z) => {
        const nz = clamp(z * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX);
        setPan((p) => (nz === 1 ? { x: 0, y: 0 } : clampPan(p, nz, rect)));
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    stageRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = stageRef.current?.getBoundingClientRect();
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) {
        const ratio = d / pinchDist.current;
        setZoom((z) => {
          const nz = clamp(z * ratio, ZOOM_MIN, ZOOM_MAX);
          setPan((p) => (nz === 1 ? { x: 0, y: 0 } : clampPan(p, nz, rect)));
          return nz;
        });
      }
      pinchDist.current = d;
    } else if (zoom > 1) {
      setPan((p) => clampPan({ x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }, zoom, rect));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
  };

  const setZoomClamped = (z) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const nz = clamp(z, ZOOM_MIN, ZOOM_MAX);
    setZoom(nz);
    setPan((p) => (nz === 1 ? { x: 0, y: 0 } : clampPan(p, nz, rect)));
  };

  // Both the add and the update path need the design to be complete first.
  const designReady = () => {
    if (isCustomBrand && !brandText.trim()) {
      setTextHint(true);
      brandRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (!size) {
      setSizeHint(true);
      sizeRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  };

  const submitDesign = () => {
    if (!designReady()) return;
    if (editingId) {
      updateLine(editingId, design);
      setEditingId(null);
      setCartOpen(true);
      return;
    }
    if (isFull) {
      setAdded(`Your cart already holds ${MAX_CART_QUANTITY} hats.`);
      return;
    }
    addLine({ ...design, quantity: 1 });
    setAdded("Added to your cart.");
  };

  const startEditing = (id) => {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    setSel({ base: line.baseId, band: line.bandId, brand: line.brandId });
    setSize(line.size);
    setBrandText(line.customText || "");
    setEditingId(id);
    setCartOpen(false);
    setAdded("");
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setAdded("");
  };

  const editingIndex = editingId ? cart.findIndex((l) => l.id === editingId) : -1;

  const selNames = CATEGORIES.map((c) => findIn(c.options, sel[c.key]))
    .filter((it) => it && it.id !== "none")
    .map((it) => it.name)
    .join(", ");

  const zoomBtn = {
    width: 34,
    height: 34,
    border: "2px solid rgba(43,26,16,.4)",
    borderRadius: 8,
    background: "#fffaf0",
    color: "var(--ink)",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    lineHeight: 1,
  };

  return (
    <section ref={sectionRef} id="builder" className="tc-px tc-halftone" style={{ position: "relative", padding: "72px 36px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
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
            Made to order, shipped to you
          </div>
          <h2 className="tc-sticker" style={{ margin: 0, fontSize: "clamp(34px,5vw,58px)" }}>
            Build your hat
          </h2>
          <p style={{ maxWidth: 520, margin: "18px auto 0", fontSize: 16, lineHeight: 1.6, color: "#4a3a2c" }}>
            Stack your base, band and brand. Every piece updates the price as you go.
          </p>
        </div>

        {editingIndex >= 0 && (
          <div
            role="status"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px 14px",
              maxWidth: 560,
              margin: "0 auto 26px",
              padding: "12px 18px",
              background: "var(--teal)",
              color: "#fff",
              border: "2px solid var(--ink)",
              boxShadow: "0 4px 0 var(--ink)",
              borderRadius: 14,
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            <span>Editing hat {editingIndex + 1} in your cart</span>
            <button
              type="button"
              onClick={cancelEditing}
              style={{
                border: 0,
                background: "none",
                padding: 0,
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Cancel and keep it as it was
            </button>
          </div>
        )}

        <div className="tc-builder-grid">
          {/* --- stage --- */}
          <div className="tc-builder-stage-wrap">
            <div
              ref={stageRef}
              className="tc-stage"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: 20,
                overflow: "hidden",
                border: "2px solid var(--ink)",
                boxShadow: "0 6px 0 var(--ink)",
                background: "radial-gradient(80% 70% at 50% 38%, #fffaf0 0%, var(--cream-2) 70%)",
                touchAction: "none",
                cursor: zoom > 1 ? "grab" : "default",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center",
                  transition: pointers.current.size ? "none" : "transform .12s ease-out",
                }}
              >
                <HatStack config={design} alt={`Custom hat preview: ${selNames}`} />
              </div>
              {/* live total, always on top of the stage */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  zIndex: "var(--z-ui)",
                  background: "var(--ink)",
                  color: "#faf1e2",
                  border: "2px solid var(--ink)",
                  borderRadius: 10,
                  padding: "7px 13px",
                  fontWeight: 800,
                  fontSize: 15,
                }}
                aria-live="polite"
              >
                {fmt(unitPrice)}
              </div>
              <div style={{ position: "absolute", right: 12, bottom: 12, zIndex: "var(--z-ui)", display: "flex", gap: 6 }}>
                <button type="button" style={zoomBtn} aria-label="Zoom out" onClick={() => setZoomClamped(zoom / 1.25)}>
                  −
                </button>
                <button type="button" style={zoomBtn} aria-label="Zoom in" onClick={() => setZoomClamped(zoom * 1.25)}>
                  +
                </button>
                {zoom > 1 && (
                  <button type="button" style={{ ...zoomBtn, width: "auto", padding: "0 10px", fontSize: 11.5 }} onClick={() => setZoomClamped(1)}>
                    Reset
                  </button>
                )}
              </div>
            </div>
            <p className="tc-stage-hint" style={{ margin: "10px 2px 0", fontSize: 12, color: "#8a7460", textAlign: "center" }}>
              Scroll or pinch to zoom. Drag to look closer.
            </p>
          </div>

          {/* --- steps --- */}
          <div className="tc-builder-panel">
            {CATEGORIES.map((cat, i) => {
              const current = findIn(cat.options, sel[cat.key]);
              return (
                <fieldset
                  key={cat.key}
                  ref={cat.key === "brand" ? brandRowRef : undefined}
                  style={{ border: 0, margin: "0 0 26px", padding: 0 }}
                >
                  <legend
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 10,
                      width: "100%",
                      padding: 0,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 15, color: "var(--coral)" }}>0{i + 1}</span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 13.5,
                        letterSpacing: ".12em",
                        textTransform: "uppercase",
                        color: "var(--ink)",
                      }}
                    >
                      {cat.label}
                    </span>
                    <span style={{ fontSize: 13, color: "#8a7460", fontWeight: 600 }}>{current?.name}</span>
                  </legend>
                  <div className="tc-opt-grid">
                    {cat.options.map((it) => (
                      <OptionThumb
                        key={it.id}
                        catKey={cat.key}
                        item={it}
                        selected={sel[cat.key] === it.id}
                        brandText={brandText}
                        onPick={() => pick(cat.key, it.id)}
                      />
                    ))}
                  </div>
                  {cat.key === "brand" && isCustomBrand && (
                    <div style={{ marginTop: 12 }}>
                      <label
                        htmlFor="brand-text"
                        style={{
                          display: "block",
                          fontWeight: 800,
                          fontSize: 11.5,
                          letterSpacing: ".1em",
                          textTransform: "uppercase",
                          margin: "0 0 6px",
                          color: "#6f4526",
                        }}
                      >
                        Your word ({BRAND_TEXT.maxLen} characters max)
                      </label>
                      <input
                        id="brand-text"
                        type="text"
                        value={brandText}
                        maxLength={BRAND_TEXT.maxLen}
                        placeholder="e.g. RODEO"
                        onChange={(e) => {
                          setBrandText(sanitizeBrandText(e.target.value));
                          setTextHint(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "11px 12px",
                          borderRadius: 8,
                          border: "1.5px solid rgba(43,26,16,.55)",
                          background: "#fffaf0",
                          fontFamily: "'Satoshi',sans-serif",
                          fontSize: 15,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          color: "var(--ink)",
                        }}
                      />
                      {textHint && !brandText.trim() && (
                        <p role="alert" style={{ margin: "8px 0 0", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}>
                          Type your word to continue.
                        </p>
                      )}
                    </div>
                  )}
                </fieldset>
              );
            })}

            {/* --- size (required) --- */}
            <fieldset ref={sizeRowRef} style={{ border: 0, margin: "0 0 22px", padding: 0 }}>
              <legend style={{ display: "flex", alignItems: "baseline", gap: 10, width: "100%", padding: 0, marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: "var(--coral)" }}>04</span>
                <span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" }}>
                  Size
                </span>
                <button
                  ref={sizeBtnRef}
                  type="button"
                  onClick={() => setSizeModal(true)}
                  style={{
                    marginLeft: "auto",
                    border: 0,
                    background: "none",
                    color: "var(--coral-deep)",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Find your size
                </button>
              </legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={size === s.id}
                    onClick={() => {
                      setSize(s.id);
                      setSizeHint(false);
                    }}
                    style={{
                      flex: "1 1 70px",
                      border: size === s.id ? "2px solid var(--coral)" : "2px solid rgba(43,26,16,.28)",
                      boxShadow: size === s.id ? "0 3px 0 var(--coral-deep)" : "none",
                      background: "#fffaf0",
                      borderRadius: 12,
                      padding: "10px 8px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: "#8a7460", fontWeight: 600 }}>{s.cm}</span>
                  </button>
                ))}
              </div>
              {sizeHint && !size && (
                <p role="alert" style={{ margin: "10px 0 0", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}>
                  Pick your size to continue.
                </p>
              )}
            </fieldset>

            {/* --- totals + checkout --- */}
            <div
              style={{
                border: "2px solid var(--ink)",
                boxShadow: "0 5px 0 var(--ink)",
                borderRadius: 16,
                background: "#fffaf0",
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontWeight: 800,
                  fontSize: 19,
                  padding: "2px 0 10px",
                }}
              >
                <span>This hat</span>
                <span style={{ color: "var(--coral-deep)" }}>{fmt(unitPrice)}</span>
              </div>
              <button ref={cartBtnRef} type="button" className="tc-btn" style={{ width: "100%" }} onClick={submitDesign}>
                {editingId ? "Update this hat" : "Add to cart"}
              </button>
              {!size && (
                <p style={{ margin: "9px 0 0", textAlign: "center", fontSize: 12.5, color: "#8a7460", fontWeight: 600 }}>
                  Pick your size to continue.
                </p>
              )}
              {added && (
                <p
                  role="status"
                  style={{ margin: "9px 0 0", textAlign: "center", fontSize: 13, fontWeight: 800, color: "var(--teal)" }}
                >
                  {added}
                </p>
              )}
              {order.lines.length > 0 && (
                <button
                  type="button"
                  className="tc-btn tc-btn--ghost"
                  style={{ width: "100%", marginTop: 10 }}
                  onClick={() => setCartOpen(true)}
                >
                  View cart ({order.totalQuantity}) &nbsp;{fmt(order.total)}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <SizeModal
        open={sizeModal}
        onClose={() => setSizeModal(false)}
        onPick={(id) => {
          setSize(id);
          setSizeHint(false);
        }}
        returnRef={sizeBtnRef}
      />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        order={order}
        onQuantity={setLineQuantity}
        onEdit={startEditing}
        onRemove={removeLine}
        onAddAnother={() => {
          setCartOpen(false);
          sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        returnRef={cartBtnRef}
      />
    </section>
  );
}
