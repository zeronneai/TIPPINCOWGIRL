import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CURRENCY, SHIPPING, SIZES, SIZE_GUIDE, Z_INDEX, findIn } from "./catalog.js";

// ---------------------------------------------------------------------------
// The hat builder: layered 2D product configurator driven entirely by
// catalog.js. Stage = square canvas with one absolutely-positioned full-size
// image per selected layer, stacked by Z_INDEX. Zoom is a CSS transform
// (wheel / pinch, 1x to 2.5x) with drag-to-pan while zoomed. The current
// configuration lives in the URL query (?b=&bd=&ch=&br=&sz=) so any build is
// shareable. Checkout is a summary drawer only for now; the serializable
// order object below is the contract for the upcoming Stripe phase.
// ---------------------------------------------------------------------------

const fmt = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

const ZOOM_MIN = 1;
const ZOOM_MAX = 2.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// URL param per category (+ sz for size). Short keys keep permalinks tidy.
const PARAM_KEYS = { base: "b", band: "bd", charm: "ch", brand: "br" };

const defaultSelection = () => ({ base: "terracotta", band: "none", charm: "none", brand: "none" });

function readUrl() {
  const sel = defaultSelection();
  let size = null;
  try {
    const q = new URLSearchParams(window.location.search);
    for (const cat of CATEGORIES) {
      const v = q.get(PARAM_KEYS[cat.key]);
      if (v && findIn(cat.options, v)) sel[cat.key] = v;
    }
    const sz = q.get("sz");
    if (sz && SIZES.some((s) => s.id === sz)) size = sz;
  } catch {
    /* no window / malformed URL: fall through to defaults */
  }
  return { sel, size };
}

function writeUrl(sel, size) {
  try {
    const q = new URLSearchParams(window.location.search);
    for (const cat of CATEGORIES) q.set(PARAM_KEYS[cat.key], sel[cat.key]);
    if (size) q.set("sz", size);
    else q.delete("sz");
    const url = `${window.location.pathname}?${q.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  } catch {
    /* ignore: permalink is a nice-to-have */
  }
}

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

// The composed hat: every selected layer as a full-canvas image. Reused at
// full size on the stage and small in the order summary.
function HatLayers({ sel, alt }) {
  return (
    <div role="img" aria-label={alt} style={{ position: "absolute", inset: 0 }}>
      {CATEGORIES.map((cat) => {
        const it = findIn(cat.options, sel[cat.key]);
        if (!it?.layerImg) return null;
        return (
          <img
            key={cat.key}
            src={it.layerImg}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: Z_INDEX[cat.key],
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        );
      })}
    </div>
  );
}

// Thumbnails share the layer image; bands/charms/brands zoom into their spot
// on the canvas so the tiny detail reads at swatch size. transform-origin is
// the detail's position in canvas coordinates, so the crop follows the real
// PNGs when they replace the placeholder SVGs.
const THUMB_CROP = {
  base: null,
  band: { origin: "50% 58%", scale: 2.3 },
  charm: { origin: "40% 58%", scale: 2.5 },
  brand: { origin: "50% 46%", scale: 2.5 },
};

function OptionThumb({ catKey, item, selected, onPick }) {
  const crop = THUMB_CROP[catKey];
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
        {item.layerImg ? (
          <img
            src={item.layerImg}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: crop ? `scale(${crop.scale})` : "none",
              transformOrigin: crop ? crop.origin : "center",
            }}
          />
        ) : (
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

// --- Order summary drawer ----------------------------------------------------
// Same drawer system as booking. Submit stays a disabled placeholder until
// the Stripe phase; `order` is the serializable payload that phase will send.
function OrderDrawer({ open, onClose, sel, size, order, returnRef }) {
  const panelRef = useRef(null);
  useDialog(open, onClose, panelRef, returnRef);
  useEffect(() => {
    if (open) console.debug("[order] ready for checkout phase:", JSON.stringify(order));
  }, [open, order]);
  if (!open) return null;
  const sizeInfo = SIZES.find((s) => s.id === size);
  const line = { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14.5, padding: "8px 0", borderBottom: "1px solid rgba(43,26,16,.12)" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-overlay)" }}>
      <div onClick={onClose} aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(43,26,16,.5)" }} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="order-title" className="tc-drawer">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h2 id="order-title" className="tc-sticker" style={{ margin: 0, fontSize: "clamp(28px,6vw,36px)" }}>
            Your hat
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order summary"
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

        <div
          style={{
            position: "relative",
            aspectRatio: "1 / 1",
            maxWidth: 240,
            margin: "0 auto 18px",
            borderRadius: 14,
            overflow: "hidden",
            border: "2px solid var(--ink)",
            background: "var(--cream-2)",
          }}
        >
          <HatLayers sel={sel} alt="Preview of your custom hat" />
        </div>

        <div>
          {order.items.map((it) => (
            <div key={`${it.category}-${it.id}`} style={line}>
              <span style={{ color: "#4a3a2c" }}>
                <strong style={{ color: "var(--ink)" }}>{it.name}</strong>
                <span style={{ fontSize: 12, marginLeft: 8, textTransform: "capitalize", color: "#8a7460" }}>{it.category}</span>
              </span>
              <span style={{ fontWeight: 700 }}>{fmt(it.price)}</span>
            </div>
          ))}
          <div style={line}>
            <span style={{ color: "#4a3a2c" }}>
              <strong style={{ color: "var(--ink)" }}>Size</strong>
            </span>
            <span style={{ fontWeight: 700 }}>
              {sizeInfo ? `${sizeInfo.name} (${sizeInfo.cm})` : "?"}
            </span>
          </div>
          <div style={{ ...line, borderBottom: "none", paddingTop: 12 }}>
            <span style={{ color: "#4a3a2c" }}>Subtotal</span>
            <span style={{ fontWeight: 700 }}>{fmt(order.subtotal)}</span>
          </div>
          <div style={{ ...line, borderBottom: "none", paddingTop: 0 }}>
            <span style={{ color: "#4a3a2c" }}>Shipping</span>
            <span style={{ fontWeight: 700 }}>{order.shipping === 0 ? "Free" : fmt(order.shipping)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 8,
              paddingTop: 12,
              borderTop: "2px solid var(--ink)",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            <span>Total</span>
            <span style={{ color: "var(--coral-deep)" }}>{fmt(order.total)}</span>
          </div>
          {order.shipping > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#6f5b48" }}>
              Free shipping on orders over {fmt(SHIPPING.freeOver)}.
            </p>
          )}
        </div>

        <button type="button" className="tc-btn" disabled style={{ width: "100%", marginTop: 20 }}>
          Place order
        </button>
        <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--coral-deep)" }}>
          Checkout coming this week. Your build is saved in this page&apos;s link.
        </p>
      </div>
    </div>
  );
}

// --- The builder section ------------------------------------------------------
export default function Builder() {
  const initial = useMemo(readUrl, []);
  const [sel, setSel] = useState(initial.sel);
  const [size, setSize] = useState(initial.size);
  const [sizeModal, setSizeModal] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [sizeHint, setSizeHint] = useState(false);

  // zoom / pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);

  const sizeBtnRef = useRef(null);
  const checkoutBtnRef = useRef(null);
  const sizeRowRef = useRef(null);

  useEffect(() => {
    writeUrl(sel, size);
  }, [sel, size]);

  const pick = (key, id) => setSel((s) => ({ ...s, [key]: id }));

  const subtotal = CATEGORIES.reduce((sum, cat) => sum + (findIn(cat.options, sel[cat.key])?.price || 0), 0);
  const shipping = subtotal >= SHIPPING.freeOver ? 0 : SHIPPING.flat;
  const order = {
    items: CATEGORIES.map((cat) => {
      const it = findIn(cat.options, sel[cat.key]);
      return it && it.id !== "none" ? { category: cat.key, id: it.id, name: it.name, price: it.price } : null;
    }).filter(Boolean),
    size,
    subtotal,
    shipping,
    total: subtotal + shipping,
    currency: CURRENCY,
    timestamp: new Date().toISOString(),
  };

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

  const tryCheckout = () => {
    if (!size) {
      setSizeHint(true);
      sizeRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setOrderOpen(true);
  };

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
    <section id="builder" className="tc-px tc-halftone" style={{ position: "relative", padding: "72px 36px" }}>
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
            Stack your base, band, charm and brand. Every piece updates the price as you go.
          </p>
        </div>

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
                <HatLayers sel={sel} alt={`Custom hat preview: ${selNames}`} />
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
                {fmt(subtotal)}
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
                <fieldset key={cat.key} style={{ border: 0, margin: "0 0 26px", padding: 0 }}>
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
                        onPick={() => pick(cat.key, it.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              );
            })}

            {/* --- size (required) --- */}
            <fieldset ref={sizeRowRef} style={{ border: 0, margin: "0 0 22px", padding: 0 }}>
              <legend style={{ display: "flex", alignItems: "baseline", gap: 10, width: "100%", padding: 0, marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: "var(--coral)" }}>05</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#4a3a2c", padding: "3px 0" }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 700 }}>{fmt(subtotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#4a3a2c", padding: "3px 0" }}>
                <span>Shipping</span>
                <span style={{ fontWeight: 700 }}>{shipping === 0 ? "Free" : fmt(shipping)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 800,
                  fontSize: 19,
                  padding: "10px 0 2px",
                  marginTop: 8,
                  borderTop: "2px solid rgba(43,26,16,.2)",
                }}
              >
                <span>Total</span>
                <span style={{ color: "var(--coral-deep)" }}>{fmt(subtotal + shipping)}</span>
              </div>
              <button ref={checkoutBtnRef} type="button" className="tc-btn" style={{ width: "100%", marginTop: 14 }} onClick={tryCheckout}>
                Continue to checkout
              </button>
              {!size && (
                <p style={{ margin: "9px 0 0", textAlign: "center", fontSize: 12.5, color: "#8a7460", fontWeight: 600 }}>
                  Pick your size to continue.
                </p>
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
      <OrderDrawer open={orderOpen} onClose={() => setOrderOpen(false)} sel={sel} size={size} order={order} returnRef={checkoutBtnRef} />
    </section>
  );
}
