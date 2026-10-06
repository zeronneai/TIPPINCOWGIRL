import { ENGRAVING_ANCHORS, ENGRAVING_FONT_FILES, ENGRAVING_GAP, ENGRAVING_STYLE } from "./catalog.js";
import { ENGRAVING_POSITIONS } from "./pricing.js";
import { elementInches, stampShape, useEngravingAssets } from "./engraving.js";

// ---------------------------------------------------------------------------
// The burned engraving, drawn over the base and under every accessory (the
// brand slot of the stack, see catalog.js). One SVG on the 1600 canvas, one
// row per position: elements side by side in the order added, ENGRAVING_GAP
// apart, the row centered on its anchor, then rotated, skewed and squeezed
// onto the crown. Stamps are drawn from their SVG path so they take the burn
// color; letters use the engraving fonts.
//
// A row waits until everything in it can be measured (fonts load on demand),
// so it never jumps from a fallback font to the real one.
// ---------------------------------------------------------------------------

export default function EngravingLayer({ engraving, hatType, anchors = ENGRAVING_ANCHORS, z }) {
  useEngravingAssets(engraving);
  const typeAnchors = anchors?.[hatType];
  if (!typeAnchors || !engraving?.length) return null;

  const rows = ENGRAVING_POSITIONS.map((p) => {
    const a = typeAnchors[p.id];
    const row = engraving.filter((e) => e.position === p.id);
    if (!a || !row.length) return null;
    const sizes = row.map(elementInches);
    if (sizes.some((s) => !s) || row.some((e) => e.kind === "stamp" && !stampShape(e.stampId))) return null;

    const ppi = a.pxPerInch;
    const total = sizes.reduce((w, s) => w + s.w, 0) + ENGRAVING_GAP * (row.length - 1);
    let x = (-total / 2) * ppi;
    const pieces = row.map((e, i) => {
      const w = sizes[i].w * ppi;
      const h = sizes[i].h * ppi;
      const left = x;
      x += w + ENGRAVING_GAP * ppi;
      if (e.kind === "stamp") {
        const { vb, paths } = stampShape(e.stampId);
        return (
          <g key={i} transform={`translate(${left} ${-h / 2}) scale(${w / vb[2]} ${h / vb[3]}) translate(${-vb[0]} ${-vb[1]})`}>
            {paths.map((d, j) => (
              <path key={j} d={d.d} fillRule={d.fillRule} />
            ))}
          </g>
        );
      }
      // baseline at half a capital below the center, so the capitals are centered
      return (
        <text
          key={i}
          x={left}
          y={h / 2}
          fontFamily={`"${ENGRAVING_FONT_FILES[e.font].family}"`}
          fontSize={sizes[i].fontSize * ppi}
          style={{ whiteSpace: "pre" }}
        >
          {e.text}
        </text>
      );
    });
    return (
      <g
        key={p.id}
        data-position={p.id}
        transform={`translate(${a.x} ${a.y}) rotate(${a.rotate}) skewX(${a.skewX}) scale(${a.scaleX} 1)`}
      >
        {pieces}
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 1600 1600"
      aria-hidden
      data-layer="engraving"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: z,
        mixBlendMode: ENGRAVING_STYLE.blend,
        opacity: ENGRAVING_STYLE.opacity,
        filter: `blur(${ENGRAVING_STYLE.blurPx}px)`,
        pointerEvents: "none",
      }}
      fill={ENGRAVING_STYLE.color}
    >
      {rows}
    </svg>
  );
}
