import { useRef, useState } from "react";
import { ENGRAVING_LETTER_HEIGHT } from "./catalog.js";
import { ENGRAVING_POSITIONS } from "./pricing.js";

// ---------------------------------------------------------------------------
// Calibration for the engraving anchors: ?preview=engraving&calibrate=1.
// A private tool for whoever places the rows; nothing here ships to the
// public builder (it is loaded lazily, only under that address).
//
// The overlay is the selected position's row box (its maximum width by a
// large letter's height), drawn with the same transform as the engraving.
// Drag it, or use the arrow keys, to move the anchor; the panel sets the
// scale (canvas pixels per inch), rotate, skewX, scaleX and the maximum
// width. "Copy anchors" puts both tables on the clipboard as JSON, ready to
// paste over ENGRAVING_ANCHORS and ENGRAVING_MAX_WIDTH in catalog.js.
// ---------------------------------------------------------------------------

export const CALIBRATE_TYPES = ["wool", "suede"];

const round = (n, step = 1) => Math.round(n / step) * step;
const fix = (n) => Math.round(n * 1000) / 1000;

/** The row box over the stage. Lives inside the zoomed stage, on the 1600 canvas. */
export function CalibrationOverlay({ anchors, maxWidths, typeId, position, onMove }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const a = anchors[typeId]?.[position];
  const max = maxWidths[typeId]?.[position];
  if (!a || max == null) return null;
  const w = max * a.pxPerInch;
  const h = ENGRAVING_LETTER_HEIGHT.large * a.pxPerInch;

  // screen pixels to canvas units, whatever the stage size and zoom
  const unit = () => 1600 / (svgRef.current?.getBoundingClientRect().width || 1600);
  const down = (e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ax: a.x, ay: a.y };
  };
  const move = (e) => {
    if (!drag.current) return;
    e.stopPropagation();
    const k = unit();
    onMove({ x: round(drag.current.ax + (e.clientX - drag.current.x) * k), y: round(drag.current.ay + (e.clientY - drag.current.y) * k) });
  };
  const up = (e) => {
    e.stopPropagation();
    drag.current = null;
  };
  const key = (e) => {
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onMove({ x: a.x + d[0], y: a.y + d[1] });
  };

  return (
    <svg ref={svgRef} viewBox="0 0 1600 1600" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }}>
      <g transform={`translate(${a.x} ${a.y}) rotate(${a.rotate}) skewX(${a.skewX}) scale(${a.scaleX} 1)`}>
        <rect
          data-calibrate-box
          tabIndex={0}
          role="slider"
          aria-label={`Move the ${position} anchor (arrow keys, shift for 10)`}
          aria-valuetext={`x ${a.x}, y ${a.y}`}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          fill="rgba(255,90,60,.12)"
          stroke="#e0533a"
          strokeWidth={4}
          strokeDasharray="14 8"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "all", cursor: "move", touchAction: "none" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        />
        <line x1={-20} x2={20} y1={0} y2={0} stroke="#e0533a" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={0} y1={-20} y2={20} stroke="#e0533a" strokeWidth={3} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

function Slider({ label, value, min, max, step, onChange, name }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "110px 1fr 70px", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700 }}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} data-calibrate={name} />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        aria-label={`${label} value`}
        style={{ width: "100%", padding: "3px 4px", border: "1px solid rgba(43,26,16,.4)", borderRadius: 4 }}
      />
    </label>
  );
}

/** The controls, under the stage. */
export function CalibrationPanel({ anchors, setAnchors, maxWidths, setMaxWidths, typeId, onType, position, setPosition }) {
  const [copied, setCopied] = useState("");
  const a = anchors[typeId]?.[position];
  if (!a) return null;
  const setA = (patch) => setAnchors((all) => ({ ...all, [typeId]: { ...all[typeId], [position]: { ...all[typeId][position], ...patch } } }));
  const setMax = (v) => setMaxWidths((all) => ({ ...all, [typeId]: { ...all[typeId], [position]: v } }));
  const json = JSON.stringify(
    {
      ENGRAVING_ANCHORS: Object.fromEntries(
        Object.entries(anchors).map(([t, ps]) => [t, Object.fromEntries(Object.entries(ps).map(([p, v]) => [p, Object.fromEntries(Object.entries(v).map(([k, n]) => [k, fix(n)]))]))])
      ),
      ENGRAVING_MAX_WIDTH: maxWidths,
    },
    null,
    2
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied("Copied. Paste it to update catalog.js.");
    } catch {
      setCopied("The clipboard is blocked here; copy the text below instead.");
    }
  };
  const sel = { padding: "6px 8px", borderRadius: 6, border: "1.5px solid rgba(43,26,16,.5)", background: "#fffaf0", fontWeight: 700 };

  return (
    <div
      data-calibrate-panel
      style={{ marginTop: 14, padding: 14, border: "2px dashed #e0533a", borderRadius: 14, background: "#fffaf0", display: "grid", gap: 10 }}
    >
      <strong style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#b5402b" }}>Calibrate engraving</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12.5, fontWeight: 700 }}>
        <label>
          Type{" "}
          <select value={typeId} onChange={(e) => onType(e.target.value)} style={sel} data-calibrate="type">
            {Object.keys(anchors).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position{" "}
          <select value={position} onChange={(e) => setPosition(e.target.value)} style={sel} data-calibrate="position">
            {ENGRAVING_POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <span data-calibrate="xy">
          x {a.x}, y {a.y}
        </span>
      </div>
      <Slider name="scale" label="Scale (px per in)" value={a.pxPerInch} min={30} max={300} step={1} onChange={(v) => setA({ pxPerInch: v })} />
      <Slider name="rotate" label="Rotate (deg)" value={a.rotate} min={-45} max={45} step={0.5} onChange={(v) => setA({ rotate: v })} />
      <Slider name="skewX" label="Skew X (deg)" value={a.skewX} min={-45} max={45} step={0.5} onChange={(v) => setA({ skewX: v })} />
      <Slider name="scaleX" label="Scale X" value={a.scaleX} min={0.2} max={1.5} step={0.01} onChange={(v) => setA({ scaleX: v })} />
      <Slider name="maxWidth" label="Max width (in)" value={maxWidths[typeId][position]} min={0.5} max={8} step={0.1} onChange={setMax} />
      <button type="button" className="tc-btn" onClick={copy} data-calibrate="copy">
        Copy anchors
      </button>
      {copied && (
        <p role="status" style={{ margin: 0, fontSize: 12.5, fontWeight: 700 }}>
          {copied}
        </p>
      )}
      <textarea readOnly value={json} rows={6} aria-label="Anchors JSON" style={{ width: "100%", fontFamily: "monospace", fontSize: 11 }} data-calibrate="json" />
    </div>
  );
}
