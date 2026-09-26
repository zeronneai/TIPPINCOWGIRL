import { useEffect, useId, useRef, useState } from "react";
import { BASES, BLEND, BRANDS, BRANDS_ENABLED, BRAND_TEXT, Z_INDEX, accessoryLayers, findIn } from "./catalog.js";
import { layerUrl } from "./layerArt.js";

// ---------------------------------------------------------------------------
// The composed hat, shared by the builder stage and the cart thumbnails so
// both render through exactly the same stacking rules. Nothing here decides
// anything: which layers, their z-order and blend modes all come from
// catalog.js (accessoryLayers), and the files from layerArt.js. The base is
// the Cloudinary PNG; every accessory is a local 1600px PNG on the same
// canvas, so all of them stack at inset 0 with no offsets.
//
// It fills its positioned parent, so give the parent a size and
// position: relative.
// ---------------------------------------------------------------------------

// One layer image with a ~150ms crossfade: the previous image stays mounted
// underneath until the incoming one has actually loaded, so switching pieces
// never flashes white while the network catches up.
function FadeImg({ src }) {
  const [prev, setPrev] = useState(null);
  const [cur, setCur] = useState(src || null);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  const curRef = useRef(cur);
  curRef.current = cur;

  useEffect(() => {
    if (src === curRef.current) return;
    if (!src) {
      setPrev(null);
      setCur(null);
      setLoaded(false);
      return;
    }
    if (loadedRef.current) setPrev(curRef.current);
    setCur(src);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (!loaded || !prev) return undefined;
    const t = setTimeout(() => setPrev(null), 220);
    return () => clearTimeout(t);
  }, [loaded, prev]);

  const st = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    userSelect: "none",
    pointerEvents: "none",
  };
  return (
    <>
      {prev && <img src={prev} alt="" draggable={false} style={st} />}
      {cur && (
        <img
          key={cur}
          src={cur}
          alt=""
          draggable={false}
          ref={(el) => {
            if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          onLoad={() => setLoaded(true)}
          style={{ ...st, opacity: loaded ? 1 : 0, transition: "opacity .15s ease" }}
        />
      )}
    </>
  );
}

// Browser-drawn custom brand text: same spot, blend and burn look as the
// branded marks. Dark brown glyphs in multiply over a blurred lighter-brown
// halo (the scorch), slight rotate/skew to follow the crown's curve. All
// placement numbers live in catalog.js (BRAND_TEXT).
export function BrandTextLayer({ text, z }) {
  const fid = useId();
  const chars = (text || "").trim().toUpperCase();
  if (!chars) return null;
  const size = Math.min(BRAND_TEXT.fontSize, BRAND_TEXT.maxWidth / (0.62 * chars.length));
  return (
    <svg
      viewBox="0 0 1600 1600"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: z,
        mixBlendMode: "multiply",
        pointerEvents: "none",
      }}
    >
      <defs>
        <filter id={fid} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
      </defs>
      <g
        transform={`translate(${BRAND_TEXT.cx} ${BRAND_TEXT.cy}) rotate(${BRAND_TEXT.rotate}) skewX(${BRAND_TEXT.skewX})`}
        fontFamily="'Alfa Slab One','Satoshi',serif"
        fontSize={size}
        textAnchor="middle"
      >
        <text
          y={size * 0.35}
          fill={BRAND_TEXT.haloColor}
          opacity="0.85"
          stroke={BRAND_TEXT.haloColor}
          strokeWidth="14"
          filter={`url(#${fid})`}
        >
          {chars}
        </text>
        <text y={size * 0.35} fill={BRAND_TEXT.color}>
          {chars}
        </text>
      </g>
    </svg>
  );
}

// The optional steps, bottom to top. Each keeps its own slot even when empty,
// so swapping a color crossfades inside that slot instead of remounting.
const ACCESSORY_STEPS = ["feather", "cord", "bud", "matches"];

const slot = (step, z, blend, children) => (
  <div key={step} data-layer={step} style={{ position: "absolute", inset: 0, zIndex: z, mixBlendMode: blend }}>
    {children}
  </div>
);

/**
 * @param config  a hat config (see pricing.js): baseId, featherId, cordId,
 *                cordColor, budSize, budColor, matchesColor (+ brand fields,
 *                used only while BRANDS_ENABLED)
 * @param alt     accessible description of the composed hat
 */
export default function HatStack({ config, alt }) {
  const c = config || {};
  const base = findIn(BASES, c.baseId);
  const byStep = Object.fromEntries(accessoryLayers(c).map((l) => [l.step, l]));

  let brandLayer = null;
  if (BRANDS_ENABLED) {
    const brand = findIn(BRANDS, c.brandId);
    if (brand?.custom) brandLayer = <BrandTextLayer key="brand" text={c.customText} z={Z_INDEX.brand} />;
    else if (brand?.layerImg) brandLayer = slot("brand", Z_INDEX.brand, BLEND.brand, <FadeImg src={brand.layerImg} />);
  }

  return (
    <div role="img" aria-label={alt} style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
      {slot("base", Z_INDEX.base, BLEND.base, <FadeImg src={base?.layerImg} />)}
      {brandLayer}
      {ACCESSORY_STEPS.map((step) => {
        const l = byStep[step];
        return slot(step, Z_INDEX[step], BLEND[step], <FadeImg src={l ? layerUrl(l.key) : null} />);
      })}
    </div>
  );
}
