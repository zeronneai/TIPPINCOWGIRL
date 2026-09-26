import { useEffect, useMemo, useRef, useState } from "react";
import { BASES, BRANDS, BRANDS_ENABLED, BRAND_TEXT, SIZES, SIZE_GUIDE, findIn, thumbKey } from "./catalog.js";
import HatStack, { BrandTextLayer } from "./HatStack.jsx";
import { preloadLayer, thumbUrl } from "./layerArt.js";
import { useCart } from "./cart.jsx";
import { useDialog } from "./useDialog.js";
import {
  BUD_SIZES,
  CORD_OPTIONS,
  FEATHER_OPTIONS,
  LEGACY_PARAM_KEYS,
  MATCHES,
  MAX_CART_QUANTITY,
  PARAM_KEYS,
  STITCHING_NOTE_MAX_LEN,
  buildOrder,
  buildPermalinkQuery,
  describeConfig,
  findBudSize,
  findCord,
  formatCents,
  normalizeConfig,
  parsePermalink,
  sanitizeBrandText,
} from "./pricing.js";

// ---------------------------------------------------------------------------
// The hat builder (v2): a base plus stacked, optional accessories.
//
//   01 Base       one of six felts, required
//   02 Feather    None or one
//   03 Cord       None or one; Suede Stitching adds a color and a note
//   04 Brim bud   None, or Small / Large, then a color for that size
//   05 Strike It Up (matches)  None or matches, then a color
//   06 Size       required
//
// The stage is HatStack: one full canvas PNG per chosen piece, stacked in
// the order catalog.js fixes. The burned brand step is off
// (BRANDS_ENABLED in pricing.js); its code is kept below and returns with
// that flag.
//
// A design lives in the URL query (see PARAM_KEYS in pricing.js) so any
// single build is shareable; old links with a band, charm or brand still
// open. That permalink is ONE hat, never the cart.
//
// NOTHING here does money arithmetic: every amount on screen comes from
// buildOrder() in pricing.js, the same pure module the server uses to
// recompute the order before charging.
// ---------------------------------------------------------------------------

const fmt = formatCents;

const ZOOM_MIN = 1;
const ZOOM_MAX = 2.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Everything the builder writes to the address bar is dropped first, so a
// stale key from an older link (a band, a charm) never lingers.
const OWN_KEYS = [...Object.values(PARAM_KEYS), ...LEGACY_PARAM_KEYS];

function readUrl() {
  try {
    return parsePermalink(window.location.search);
  } catch {
    return parsePermalink("");
  }
}

function writeUrl(design) {
  try {
    const q = new URLSearchParams(window.location.search);
    for (const k of OWN_KEYS) q.delete(k);
    for (const [k, v] of new URLSearchParams(buildPermalinkQuery(design))) q.set(k, v);
    const qs = q.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  } catch {
    /* ignore: permalink is a nice-to-have */
  }
}

const firstColor = (colors) => colors?.[0]?.id ?? null;
const priceTag = (price) => (price > 0 ? `+${fmt(price)}` : "");

// Color chips reuse the real thumbnails, zoomed onto the piece so the color
// reads at chip size. transform-origin is where the piece sits in the thumb.
const CHIP_ZOOM = {
  cord: { origin: "50% 58%", scale: 2.6 },
  bud: { origin: "42% 52%", scale: 2 },
  matches: { origin: "50% 50%", scale: 1.25 },
};

// --- one option tile ------------------------------------------------------------
// `thumb` is an image URL, or null for the None tile. `warm` starts loading
// the full size layer on hover, touch or keyboard focus, before the click.
function Tile({ label, price, thumb, selected, onPick, warm, testId }) {
  return (
    <button
      type="button"
      onClick={onPick}
      onPointerEnter={warm}
      onPointerDown={warm}
      onFocus={warm}
      aria-pressed={selected}
      data-option={testId}
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
        {thumb ? (
          <img
            src={thumb}
            alt=""
            draggable={false}
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 22, color: "#a08a72" }}>
            ø
          </span>
        )}
      </span>
      <span style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.2, color: "var(--ink)" }}>{label}</span>
      {price !== null && (
        <span style={{ fontWeight: 700, fontSize: 11.5, color: "var(--coral-deep)", minHeight: 14 }}>{price}</span>
      )}
    </button>
  );
}

// --- a row of color chips under a chosen option ---------------------------------------
function ColorChips({ legend, step, colors, value, onPick, keyFor }) {
  const zoom = CHIP_ZOOM[step];
  return (
    <div role="group" aria-label={legend} style={{ marginTop: 12 }}>
      <div
        style={{
          fontWeight: 800,
          fontSize: 11.5,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          margin: "0 0 8px",
          color: "#6f4526",
        }}
      >
        {legend}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {colors.map((c) => {
          const key = keyFor(c.id);
          const selected = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              aria-label={c.name}
              data-color={c.id}
              onClick={() => onPick(c.id)}
              onPointerEnter={() => preloadLayer(key)}
              onPointerDown={() => preloadLayer(key)}
              onFocus={() => preloadLayer(key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                width: 64,
                padding: 4,
                border: selected ? "2px solid var(--coral)" : "2px solid rgba(43,26,16,.22)",
                boxShadow: selected ? "0 2px 0 var(--coral-deep)" : "none",
                borderRadius: 10,
                background: "#fffaf0",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{ position: "relative", display: "block", width: 48, height: 48, borderRadius: "50%", overflow: "hidden" }}
              >
                <img
                  src={thumbUrl(key)}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: `scale(${zoom.scale})`,
                    transformOrigin: zoom.origin,
                  }}
                />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- the burned brand step (OFF: rendered only while BRANDS_ENABLED) -------------
// Thumbnails are ivory mini stacks with the mark in multiply, cropped onto the
// crown, exactly as before the step was switched off.
const BRAND_CROP = `${(BRAND_TEXT.cx / 1600) * 100}% ${(BRAND_TEXT.cy / 1600) * 100}%`;
function BrandStep({ value, text, onPick, onText, textHint }) {
  const imgSt = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  return (
    <>
      <div className="tc-opt-grid">
        {BRANDS.map((it) => (
          <button
            key={it.id}
            type="button"
            aria-pressed={value === it.id}
            className="tc-opt"
            onClick={() => onPick(it.id)}
            style={{
              border: value === it.id ? "2px solid var(--coral)" : "2px solid rgba(43,26,16,.28)",
              background: "#fffaf0",
              borderRadius: 12,
              padding: 8,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span aria-hidden style={{ display: "block", aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", position: "relative" }}>
              {it.id !== "none" && (
                <span style={{ position: "absolute", inset: 0, isolation: "isolate", transform: "scale(2.5)", transformOrigin: BRAND_CROP }}>
                  <img src={BASES[0].layerImg} alt="" draggable={false} style={imgSt} />
                  {it.custom ? (
                    <BrandTextLayer text={text || "ABC"} z={2} />
                  ) : (
                    <img src={it.layerImg} alt="" draggable={false} style={{ ...imgSt, mixBlendMode: "multiply" }} />
                  )}
                </span>
              )}
            </span>
            <span style={{ fontWeight: 800, fontSize: 12 }}>{it.name}</span>
          </button>
        ))}
      </div>
      {findIn(BRANDS, value)?.custom && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="brand-text" style={{ display: "block", fontWeight: 800, fontSize: 11.5, margin: "0 0 6px" }}>
            Your word ({BRAND_TEXT.maxLen} characters max)
          </label>
          <input
            id="brand-text"
            type="text"
            value={text}
            maxLength={BRAND_TEXT.maxLen}
            onChange={(e) => onText(sanitizeBrandText(e.target.value))}
            style={{ width: "100%", padding: "11px 12px", borderRadius: 8, border: "1.5px solid rgba(43,26,16,.55)" }}
          />
          {textHint && !text.trim() && (
            <p role="alert" style={{ margin: "8px 0 0", fontSize: 13.5, fontWeight: 700, color: "var(--coral-deep)" }}>
              Type your word to continue.
            </p>
          )}
        </div>
      )}
    </>
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

// --- The builder section ------------------------------------------------------
const legendRow = { display: "flex", alignItems: "baseline", gap: 10, width: "100%", padding: 0, marginBottom: 12 };
const legendLabel = { fontWeight: 800, fontSize: 13.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink)" };
const legendNum = { fontWeight: 800, fontSize: 15, color: "var(--coral)" };
const legendValue = { fontSize: 13, color: "#8a7460", fontWeight: 600 };

function Step({ num, label, value, children, stepRef, id }) {
  return (
    <fieldset ref={stepRef} data-step={id} style={{ border: 0, margin: "0 0 26px", padding: 0, minWidth: 0 }}>
      <legend style={legendRow}>
        <span style={legendNum}>{String(num).padStart(2, "0")}</span>
        <span style={legendLabel}>{label}</span>
        {value && <span style={legendValue}>{value}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export default function Builder() {
  // `draft` holds what the controls hold, typed text included; `design` is
  // its normalized form, which is what the stage, the price, the URL and the
  // cart all read.
  const initial = useMemo(readUrl, []);
  const [draft, setDraft] = useState(initial);
  const [sizeModal, setSizeModal] = useState(false);
  const [sizeHint, setSizeHint] = useState(false);
  const [textHint, setTextHint] = useState(false);
  // null while building a new hat; a cart line id while editing that row
  const [editingId, setEditingId] = useState(null);
  const [added, setAdded] = useState("");

  const { cart, addLine, updateLine, isFull, openCart, editRequest, clearEditRequest } = useCart();

  // zoom / pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const pinchDist = useRef(0);

  const sizeBtnRef = useRef(null);
  const sizeRowRef = useRef(null);
  const brandRowRef = useRef(null);
  const sectionRef = useRef(null);

  const design = normalizeConfig(draft);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    writeUrl(design);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(design)]);

  // The "added to cart" confirmation is a quiet line, not a modal: it clears
  // itself so she can keep building straight away.
  useEffect(() => {
    if (!added) return undefined;
    const t = setTimeout(() => setAdded(""), 2600);
    return () => clearTimeout(t);
  }, [added]);

  // Warm the selected base right away and the rest of the bases shortly
  // after: base swaps are the most common tap and should feel instant.
  // Accessories warm on hover or touch instead (see Tile and ColorChips).
  useEffect(() => {
    const warm = (u) => {
      if (!u) return;
      const im = new Image();
      im.src = u;
    };
    warm(findIn(BASES, design.baseId)?.layerImg);
    const t = setTimeout(() => BASES.forEach((b) => warm(b.layerImg)), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- step handlers: each keeps the draft valid as it changes -------------------
  const pickCord = (id) => {
    const cord = findCord(id);
    set({ cordId: id, cordColor: cord?.colors ? design.cordColor || firstColor(cord.colors) : null });
  };
  const pickBudSize = (id) => {
    const bud = findBudSize(id);
    const keep = bud?.colors.some((c) => c.id === design.budColor);
    set({ budSize: id, budColor: id === "none" ? null : keep ? design.budColor : firstColor(bud.colors) });
  };
  const pickMatches = (on) => set({ matchesColor: on ? design.matchesColor !== "none" ? design.matchesColor : firstColor(MATCHES.colors) : "none" });

  // Two calls, one engine: the cart order drives the drawer, and the design
  // on its own gives the stage its per hat price.
  const order = buildOrder(cart);
  const unitPrice = buildOrder([{ ...design, quantity: 1 }]).lines[0].unitSubtotal;

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
    if (BRANDS_ENABLED && findIn(BRANDS, design.brandId)?.custom && !design.customText) {
      setTextHint(true);
      brandRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (!design.size) {
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
      openCart();
      return;
    }
    if (isFull) {
      setAdded(`Your cart already holds ${MAX_CART_QUANTITY} hats.`);
      return;
    }
    addLine({ ...design, quantity: 1 });
    setAdded("Added to your cart.");
  };

  useEffect(() => {
    if (!editRequest) return;
    const line = cart.find((l) => l.id === editRequest);
    clearEditRequest();
    if (!line) return;
    setDraft(normalizeConfig(line));
    setEditingId(editRequest);
    setAdded("");
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editRequest, cart, clearEditRequest]);

  const cancelEditing = () => {
    setEditingId(null);
    setAdded("");
  };

  const editingIndex = editingId ? cart.findIndex((l) => l.id === editingId) : -1;

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

  // ---- current values for the step headings ---------------------------------------
  const base = findIn(BASES, design.baseId);
  const feather = FEATHER_OPTIONS.find((o) => o.id === design.featherId);
  const cord = findCord(design.cordId);
  const bud = findBudSize(design.budSize);
  const colorName = (colors, id) => colors?.find((c) => c.id === id)?.name;
  const cordValue =
    design.cordId === "none" ? "None" : cord.colors ? `${cord.name}, ${colorName(cord.colors, design.cordColor)}` : cord.name;
  const budValue = design.budSize === "none" ? "None" : `${bud.name}, ${colorName(bud.colors, design.budColor)}`;
  const matchesValue = design.matchesColor === "none" ? "None" : colorName(MATCHES.colors, design.matchesColor);

  let n = 0;
  const next = () => (n += 1);

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
          <p style={{ maxWidth: 540, margin: "18px auto 0", fontSize: 16, lineHeight: 1.6, color: "#4a3a2c" }}>
            Pick your felt, then stack a feather, a cord, a brim bud and matches. Every piece updates the price as you go.
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
                <HatStack config={design} alt={`Custom hat preview: ${describeConfig(design)}`} />
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
                data-testid="stage-price"
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
            <Step num={next()} id="base" label="Base" value={base?.name}>
              <div className="tc-opt-grid">
                {BASES.map((b) => (
                  <Tile
                    key={b.id}
                    testId={`base-${b.id}`}
                    label={b.name}
                    price={fmt(b.price)}
                    thumb={b.layerImg}
                    selected={design.baseId === b.id}
                    onPick={() => set({ baseId: b.id })}
                  />
                ))}
              </div>
            </Step>

            {BRANDS_ENABLED && (
              <Step num={next()} id="brand" label="Brand" value={findIn(BRANDS, design.brandId)?.name} stepRef={brandRowRef}>
                <BrandStep
                  value={design.brandId}
                  text={draft.customText || ""}
                  textHint={textHint}
                  onPick={(id) => set({ brandId: id })}
                  onText={(t) => {
                    set({ customText: t });
                    setTextHint(false);
                  }}
                />
              </Step>
            )}

            <Step num={next()} id="feather" label="Feather" value={feather?.id === "none" ? "None" : feather?.name}>
              <div className="tc-opt-grid">
                {FEATHER_OPTIONS.map((f) => {
                  const key = f.id === "none" ? null : thumbKey.feather(f.id);
                  return (
                    <Tile
                      key={f.id}
                      testId={`feather-${f.id}`}
                      label={f.id === "none" ? "None" : f.name}
                      price={priceTag(f.price)}
                      thumb={key && thumbUrl(key)}
                      selected={design.featherId === f.id}
                      warm={() => key && preloadLayer(key)}
                      onPick={() => set({ featherId: f.id })}
                    />
                  );
                })}
              </div>
            </Step>

            <Step num={next()} id="cord" label="Cord" value={cordValue}>
              <div className="tc-opt-grid">
                {CORD_OPTIONS.map((c) => {
                  const color = c.colors ? design.cordColor || firstColor(c.colors) : null;
                  const key = c.id === "none" ? null : thumbKey.cord(c.id, color);
                  return (
                    <Tile
                      key={c.id}
                      testId={`cord-${c.id}`}
                      label={c.id === "none" ? "None" : c.name}
                      price={priceTag(c.price)}
                      thumb={key && thumbUrl(key)}
                      selected={design.cordId === c.id}
                      warm={() => key && preloadLayer(key)}
                      onPick={() => pickCord(c.id)}
                    />
                  );
                })}
              </div>
              {cord?.colors && (
                <>
                  <ColorChips
                    legend={`${cord.name} color`}
                    step="cord"
                    colors={cord.colors}
                    value={design.cordColor}
                    keyFor={(id) => thumbKey.cord("stitching", id)}
                    onPick={(id) => set({ cordColor: id })}
                  />
                  <div style={{ marginTop: 12 }}>
                    <label
                      htmlFor="stitching-note"
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
                      Want a different shade? Tell us <span style={{ opacity: 0.6, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                    </label>
                    <input
                      id="stitching-note"
                      type="text"
                      value={draft.stitchingNote || ""}
                      maxLength={STITCHING_NOTE_MAX_LEN}
                      placeholder="e.g. a softer pink"
                      onChange={(e) => set({ stitchingNote: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: 8,
                        border: "1.5px solid rgba(43,26,16,.55)",
                        background: "#fffaf0",
                        fontFamily: "'Satoshi',sans-serif",
                        fontSize: 16,
                        color: "var(--ink)",
                      }}
                    />
                  </div>
                </>
              )}
            </Step>

            <Step num={next()} id="bud" label="Brim bud" value={budValue}>
              <div className="tc-opt-grid">
                {BUD_SIZES.map((b) => {
                  const color = b.id === design.budSize ? design.budColor : firstColor(b.colors);
                  const key = b.id === "none" ? null : thumbKey.bud(b.id, color);
                  return (
                    <Tile
                      key={b.id}
                      testId={`bud-${b.id}`}
                      label={b.id === "none" ? "None" : b.name}
                      price={priceTag(b.price)}
                      thumb={key && thumbUrl(key)}
                      selected={design.budSize === b.id}
                      warm={() => key && preloadLayer(key)}
                      onPick={() => pickBudSize(b.id)}
                    />
                  );
                })}
              </div>
              {design.budSize !== "none" && (
                <ColorChips
                  legend={`${bud.name} color`}
                  step="bud"
                  colors={bud.colors}
                  value={design.budColor}
                  keyFor={(id) => thumbKey.bud(design.budSize, id)}
                  onPick={(id) => set({ budColor: id })}
                />
              )}
            </Step>

            <Step num={next()} id="matches" label={MATCHES.name} value={matchesValue}>
              <div className="tc-opt-grid">
                <Tile
                  testId="matches-none"
                  label="None"
                  price=""
                  thumb={null}
                  selected={design.matchesColor === "none"}
                  onPick={() => pickMatches(false)}
                />
                <Tile
                  testId="matches-on"
                  label={MATCHES.name}
                  price={priceTag(MATCHES.price)}
                  thumb={thumbUrl(
                    thumbKey.matches(design.matchesColor !== "none" ? design.matchesColor : firstColor(MATCHES.colors))
                  )}
                  selected={design.matchesColor !== "none"}
                  warm={() => preloadLayer(thumbKey.matches(firstColor(MATCHES.colors)))}
                  onPick={() => pickMatches(true)}
                />
              </div>
              {design.matchesColor !== "none" && (
                <ColorChips
                  legend="Color"
                  step="matches"
                  colors={MATCHES.colors}
                  value={design.matchesColor}
                  keyFor={(id) => thumbKey.matches(id)}
                  onPick={(id) => set({ matchesColor: id })}
                />
              )}
            </Step>

            {/* --- size (required) --- */}
            <fieldset ref={sizeRowRef} data-step="size" style={{ border: 0, margin: "0 0 22px", padding: 0, minWidth: 0 }}>
              <legend style={legendRow}>
                <span style={legendNum}>{String(next()).padStart(2, "0")}</span>
                <span style={legendLabel}>Size</span>
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
                    aria-pressed={design.size === s.id}
                    onClick={() => {
                      set({ size: s.id });
                      setSizeHint(false);
                    }}
                    style={{
                      flex: "1 1 70px",
                      border: design.size === s.id ? "2px solid var(--coral)" : "2px solid rgba(43,26,16,.28)",
                      boxShadow: design.size === s.id ? "0 3px 0 var(--coral-deep)" : "none",
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
              {sizeHint && !design.size && (
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
                <span style={{ color: "var(--coral-deep)" }} data-testid="panel-price">
                  {fmt(unitPrice)}
                </span>
              </div>
              <button type="button" className="tc-btn" style={{ width: "100%" }} onClick={submitDesign}>
                {editingId ? "Update this hat" : "Add to cart"}
              </button>
              {!design.size && (
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
                  onClick={openCart}
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
          set({ size: id });
          setSizeHint(false);
        }}
        returnRef={sizeBtnRef}
      />
    </section>
  );
}
