import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { niceMax } from "./stats.js";
import { Icon } from "./ui.jsx";

// Hand built SVG charts for the dashboard. They live in the /admin chunk
// only (nothing outside src/admin imports them) and add no dependency.
//
// The rules they follow: one axis per chart, thin columns (24px at most)
// with a 4px rounded end on a single baseline, hairline solid gridlines,
// a label on the tallest column only, a tooltip on hover and keyboard focus,
// and a table view for every chart so no value hides behind a tooltip.

const GRID = "rgba(43,26,16,.10)";
const AXIS_TEXT = "#77604e";

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A rounded-top column from the baseline. */
function columnPath(x, y, w, h, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div className="ad-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <b>{tip.value}</b>
      {tip.label}
    </div>
  );
}

/**
 * Columns for one series over ordered categories (weeks, months).
 * data: [{ key, label, value }]; format turns a value into its text.
 */
export function ColumnChart({ data, color, format = String, axisFormat = format, height = 180, name = "value", tipLabel = (d) => d.label }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const m = { l: 44, r: 6, t: 20, b: 26 };
  const plotW = Math.max(0, width - m.l - m.r);
  const plotH = height - m.t - m.b;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(4, Math.min(24, band * 0.6));
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 46))));
  const maxI = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const y = (v) => m.t + plotH - (v / top) * plotH;

  return (
    <div className="ad-chart" ref={ref} onMouseLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${name} chart`}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={m.l} x2={width - m.r} y1={y(top * f)} y2={y(top * f)} stroke={GRID} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={m.l - 8} y={y(top * f)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT} style={{ fontVariantNumeric: "tabular-nums" }}>
                {axisFormat(top * f)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = m.l + band * i + band / 2;
            const h = Math.max(0, y(0) - y(d.value));
            const show = () => setTip({ x: cx, y: y(d.value), value: format(d.value), label: tipLabel(d) });
            return (
              <g key={d.key} data-col={d.key}>
                <rect
                  className="ad-hit"
                  x={m.l + band * i}
                  y={m.t}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${tipLabel(d)}: ${format(d.value)}`}
                  onMouseEnter={show}
                  onFocus={show}
                  onBlur={() => setTip(null)}
                />
                <path className="ad-mark" d={columnPath(cx - barW / 2, y(d.value), barW, h)} fill={color} pointerEvents="none" />
                {i === maxI && d.value > 0 && (
                  <text x={cx} y={y(d.value) - 6} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#2b1a10" pointerEvents="none">
                    {format(d.value)}
                  </text>
                )}
                {i % every === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={AXIS_TEXT} pointerEvents="none">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {width === 0 && <div style={{ height }} />}
      <Tip tip={tip} />
    </div>
  );
}

/** Horizontal bars for unordered categories, value at the tip. */
export function HBars({ data, color, format = String }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="ad-hbars" role="list">
      {data.map((d) => (
        <div className="ad-hbar" key={d.label} role="listitem" data-hbar={d.label}>
          <span className="ad-hbar-label" title={d.label}>
            {d.label}
          </span>
          <span className="ad-hbar-track">
            <span className="ad-hbar-fill" style={{ width: `${(d.value / max) * 82}%`, background: color }} />
            <b>{format(d.value)}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Part of a whole: a donut with a 2px gap between segments and its legend. */
export function Donut({ data, total = data.reduce((s, d) => s + d.value, 0), centerLabel = "total" }) {
  const [tip, setTip] = useState(null);
  const size = 150;
  const r = 58;
  const sw = 20;
  const c = size / 2;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2 / r : 0;
  let a = -Math.PI / 2;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = a + gap / 2;
      const a1 = a + sweep - gap / 2;
      a += sweep;
      const mid = (a0 + a1) / 2;
      if (sweep >= Math.PI * 2 - 1e-6) return { d, path: null, mid };
      const p = (ang) => `${c + r * Math.cos(ang)},${c + r * Math.sin(ang)}`;
      return { d, path: `M${p(a0)}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`, mid };
    });
  const pct = (v) => (total ? `${Math.round((v / total) * 100)}%` : "0%");
  return (
    <div className="ad-donut">
      <div className="ad-chart" style={{ width: size }} onMouseLeave={() => setTip(null)}>
        <svg width={size} height={size} role="img" aria-label={`${total} ${centerLabel}`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#f3e9d9" strokeWidth={sw} />
          {arcs.map(({ d, path, mid }) => {
            const show = () => setTip({ x: c + r * Math.cos(mid), y: c + r * Math.sin(mid), value: `${d.value} (${pct(d.value)})`, label: d.name });
            const common = {
              className: "ad-hit",
              tabIndex: 0,
              "aria-label": `${d.name}: ${d.value}`,
              onMouseEnter: show,
              onFocus: show,
              onBlur: () => setTip(null),
              fill: "none",
              stroke: d.color,
              strokeWidth: sw,
              "data-seg": d.id,
            };
            return path ? <path key={d.id} d={path} {...common} /> : <circle key={d.id} cx={c} cy={c} r={r} {...common} />;
          })}
          <text x={c} y={c - 4} textAnchor="middle" fontSize="28" fontWeight="900" fill="#2b1a10">
            {total}
          </text>
          <text x={c} y={c + 16} textAnchor="middle" fontSize="11.5" fill={AXIS_TEXT}>
            {centerLabel}
          </text>
        </svg>
        <Tip tip={tip} />
      </div>
      <ul className="ad-donut-legend">
        {data.map((d) => (
          <li key={d.id} data-legend={d.id}>
            <i style={{ background: d.color }} aria-hidden />
            <span>{d.name}</span>
            <b>
              {d.value} <span style={{ color: AXIS_TEXT, fontWeight: 600 }}>· {pct(d.value)}</span>
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A dashboard card holding a chart, with a Chart / Table switch. */
export function ChartCard({ id, title, sub, table, empty, children, className = "" }) {
  const [asTable, setAsTable] = useState(false);
  useEffect(() => setAsTable(false), [empty]);
  return (
    <section className={`ad-card ${className}`} data-chart={id} aria-labelledby={`${id}-title`}>
      <div className="ad-card-h">
        <div style={{ minWidth: 0 }}>
          <h2 id={`${id}-title`}>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {!empty && table && (
          <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" aria-pressed={asTable} onClick={() => setAsTable(!asTable)} data-table-toggle>
            <Icon name={asTable ? "dashboard" : "bookings"} size={16} />
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {empty ? (
        empty
      ) : asTable ? (
        <div className="ad-table-wrap">
          <table className="ad-table" data-chart-table>
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((v, i) => (i === 0 ? <th key={i} scope="row" style={{ textAlign: "left", fontWeight: 700, textTransform: "none", letterSpacing: 0, color: "#2b1a10", fontSize: 13.5 }}>{v}</th> : <td key={i}>{v}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
