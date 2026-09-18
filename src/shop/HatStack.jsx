import { useEffect, useId, useRef, useState } from "react";
import { BLEND, BRAND_TEXT, CATEGORIES, Z_INDEX, findIn } from "./catalog.js";

// ---------------------------------------------------------------------------
// The composed hat, shared by the builder stage and the cart thumbnails so
// both render through exactly the same stacking rules. Nothing here decides
// anything: z-order and blend modes come from catalog.js, and the images are
// the plain layer URLs (no Cloudinary transforms beyond the ones already
// baked into them).
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

// Maps a config's category key to its selected id.
const SELECTED = { base: "baseId", band: "bandId", brand: "brandId" };

/**
 * @param config  { baseId, bandId, brandId, customText }
 * @param alt     accessible description of the composed hat
 */
export default function HatStack({ config, alt }) {
  const c = config || {};
  return (
    <div role="img" aria-label={alt} style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
      {CATEGORIES.map((cat) => {
        const it = findIn(cat.options, c[SELECTED[cat.key]]);
        if (cat.key === "brand" && it?.custom)
          return <BrandTextLayer key="brand-text" text={c.customText} z={Z_INDEX.brand} />;
        if (!it?.layerImg) return null;
        return (
          <div
            key={cat.key}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: Z_INDEX[cat.key],
              mixBlendMode: BLEND[cat.key],
            }}
          >
            <FadeImg src={it.layerImg} />
          </div>
        );
      })}
    </div>
  );
}
