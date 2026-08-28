import { lazy, Suspense, useState } from "react";
import { FELTS, BRIMS, BANDS, CHARMS, nameOf } from "../hat/data.js";

// The 3D stack (three + react-three) is ~1MB minified — lazy-load it so the
// landing paints from a small initial chunk (see manualChunks in vite.config).
const Hat3D = lazy(() => import("../hat/Hat3D.jsx"));

const STEPS = ["Felt", "Brim", "Band", "Charm", "Initials"];
const TITLES = [
  ["Choose your felt", "The base of every great hat."],
  ["Shape the brim", "How you wear it."],
  ["Wrap it up", "Pick a hatband."],
  ["Add a charm", "Your signature touch."],
  ["Make it yours", "Stamp your initials in brass."],
];
const DATA_BY_STEP = [FELTS, BRIMS, BANDS, CHARMS];
const KEY_BY_STEP = ["felt", "brim", "band", "charm"];

// Stage glow accent — Terracotta is the brand default (props.stageGlow in the DC).
const GLOW = "radial-gradient(circle, rgba(194,91,52,.55) 0%, transparent 70%)";

function tabStyle(active) {
  return {
    flex: "none",
    padding: "9px 15px",
    borderRadius: "999px",
    border: "none",
    cursor: "pointer",
    background: active ? "#c25b34" : "#ece0cc",
    color: active ? "#fff" : "#695442",
    fontFamily: "'Satoshi',sans-serif",
    fontWeight: 700,
    fontSize: "13px",
    letterSpacing: ".01em",
    whiteSpace: "nowrap",
  };
}

function cardStyle(sel) {
  const base = {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: "11px 12px",
    borderRadius: "14px",
    cursor: "pointer",
    transition: "transform .14s ease, box-shadow .14s ease, border-color .14s ease",
    width: "100%",
    textAlign: "left",
    fontFamily: "'Satoshi',sans-serif",
  };
  return sel
    ? {
        ...base,
        background: "#fff4ea",
        border: "2px solid #c25b34",
        boxShadow: "0 8px 20px rgba(194,91,52,.20)",
        transform: "translateY(-1px)",
      }
    : { ...base, background: "#fffaf0", border: "2px solid #ece0cc" };
}

function dotStyle(color, sel) {
  const base = {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    flex: "none",
    boxShadow: "inset 0 2px 5px rgba(0,0,0,.18)",
    border: sel ? "2px solid #c25b34" : "1px solid rgba(0,0,0,.10)",
  };
  if (color === "transparent")
    return {
      ...base,
      background: "#efe6d2",
      backgroundImage:
        "linear-gradient(45deg, transparent 44%, #b9a489 44%, #b9a489 56%, transparent 56%)",
    };
  return { ...base, background: color };
}

const rand = (a) => a[Math.floor(Math.random() * a.length)];

export default function Configurator({ onBook }) {
  const [step, setStep] = useState(0);
  const [felt, setFelt] = useState("terracotta");
  const [brim, setBrim] = useState("curl");
  const [band, setBand] = useState("turquoise");
  const [charm, setCharm] = useState("feather");
  const [initials, setInitials] = useState("");

  const setters = { felt: setFelt, brim: setBrim, band: setBand, charm: setCharm };
  const values = { felt, brim, band, charm };

  const shuffle = () => {
    setFelt(rand(FELTS).id);
    setBrim(rand(BRIMS).id);
    setBand(rand(BANDS).id);
    setCharm(rand(CHARMS).id);
  };

  const isMono = step === 4;
  const feltName = nameOf(FELTS, felt);
  const brimName = nameOf(BRIMS, brim);
  const bandName = nameOf(BANDS, band);
  const charmName = nameOf(CHARMS, charm);
  const monoOut = initials ? initials : "—";
  const combo = FELTS.length * BRIMS.length * BANDS.length * CHARMS.length;

  return (
    <section
      id="build"
      className="tc-px"
      style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "40px 36px 70px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 26,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Satoshi',sans-serif",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".24em",
              textTransform: "uppercase",
              color: "#3fa89a",
              marginBottom: 10,
            }}
          >
            The Hat Bar
          </div>
          <h2
            className="tc-sticker"
            style={{ margin: 0, fontSize: "clamp(32px,4.6vw,52px)" }}
          >
            Build your brim.
          </h2>
        </div>
        <div style={{ fontSize: 13.5, color: "#6f5b48", maxWidth: 280, textAlign: "right" }}>
          Live preview: every pick updates your hat in real time.{" "}
          <span style={{ color: "#e0905f", fontWeight: 700 }}>{combo}+</span> base combos before you
          even add initials.
        </div>
      </div>

      <div
        className="tc-config-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 26,
          alignItems: "stretch",
        }}
      >
        {/* STAGE — badge and captions live in normal flow above/below the
            canvas, so the brim can never overlap them no matter the style
            or how far the user drags the hat around. */}
        <div
          style={{
            position: "relative",
            borderRadius: 26,
            overflow: "hidden",
            // Cool slate-teal backdrop: the warm felt separates from it
            // instead of melting into the old brown-on-brown.
            background:
              "radial-gradient(120% 90% at 50% 18%, #46514e 0%, #2a3230 55%, #161c1a 100%)",
            border: "1px solid rgba(246,239,226,.1)",
            minHeight: 480,
            display: "flex",
            flexDirection: "column",
            padding: "16px 20px 18px",
          }}
        >
          {/* decorative backdrops, behind everything */}
          <div
            style={{
              position: "absolute",
              zIndex: "var(--z-base)",
              width: "62%",
              height: "50%",
              top: "18%",
              left: "19%",
              borderRadius: "50%",
              filter: "blur(60px)",
              animation: "glowpulse 7s ease-in-out infinite",
              background: GLOW,
            }}
          />
          <div
            style={{
              position: "absolute",
              zIndex: "var(--z-base)",
              bottom: 92,
              left: "27%",
              width: "46%",
              height: 26,
              borderRadius: "50%",
              background: "rgba(0,0,0,.55)",
              filter: "blur(16px)",
            }}
          />
          {/* badge row — reserved space, in flow */}
          <div
            style={{
              position: "relative",
              zIndex: "var(--z-ui)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#9b8060",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#3fa89a",
                boxShadow: "0 0 8px #3fa89a",
              }}
            />{" "}
            Live preview
          </div>
          {/* hat — live 3D model, one parametric mesh for all combos */}
          <div style={{ position: "relative", zIndex: "var(--z-canvas)", width: "100%", flex: 1, minHeight: 330 }}>
            <Suspense
              fallback={
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    letterSpacing: ".16em",
                    textTransform: "uppercase",
                    color: "#a98a68",
                  }}
                >
                  Saddling up…
                </div>
              }
            >
              <Hat3D felt={felt} brim={brim} band={band} charm={charm} initials={initials} />
            </Suspense>
          </div>
          {/* captions — reserved space below the canvas, in flow */}
          <div style={{ position: "relative", zIndex: "var(--z-ui)", textAlign: "center", paddingTop: 10 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "#a98a68",
              }}
            >
              Drag to spin · scroll to zoom · 3D preview
            </div>
            <div
              style={{
                marginTop: 6,
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "#e9dcc8",
              }}
            >
              {feltName} · {brimName}
            </div>
          </div>
        </div>

        {/* CONTROLS — fixed minHeight so switching to the shorter Initials
            step never reflows the stage next to it. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            background: "#f6efe2",
            borderRadius: 26,
            padding: 22,
            color: "#3a261c",
            minHeight: 540,
          }}
        >
          {/* step tabs */}
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
            {STEPS.map((label, i) => (
              <button key={label} type="button" onClick={() => setStep(i)} style={tabStyle(i === step)}>
                {label}
              </button>
            ))}
          </div>

          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 20,
                lineHeight: 1.15,
                color: "#3a261c",
              }}
            >
              {TITLES[step][0]}
            </div>
            <div style={{ fontSize: 13, color: "#6f5b48", marginTop: 5 }}>{TITLES[step][1]}</div>
          </div>

          {/* swatch grid */}
          {!isMono && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
                gap: 9,
              }}
            >
              {DATA_BY_STEP[step].map((opt) => {
                const key = KEY_BY_STEP[step];
                const sel = values[key] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="tc-swatch"
                    onClick={() => setters[key](opt.id)}
                    style={cardStyle(sel)}
                  >
                    <span style={dotStyle(opt.color, sel)} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: "#3a261c",
                          lineHeight: 1.15,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: 11,
                          color: "#6f5b48",
                          letterSpacing: ".01em",
                        }}
                      >
                        {opt.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* monogram panel */}
          {isMono && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 2px" }}>
              <input
                value={initials}
                onChange={(e) =>
                  setInitials(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3))
                }
                maxLength={3}
                placeholder="ABC"
                aria-label="Your initials, up to 3 letters, stamped on the band"
                className="tc-mono-input"
                style={{
                  width: "100%",
                  padding: "16px 18px",
                  borderRadius: 14,
                  border: "2px solid #e2d4bd",
                  background: "#fffaf0",
                  fontWeight: 800,
                  fontSize: 28,
                  letterSpacing: ".18em",
                  textAlign: "center",
                  color: "#9a5a2e",
                  textTransform: "uppercase",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setInitials("")}
                  className="tc-btn tc-btn--ghost"
                  style={{ flex: 1, padding: 10, fontSize: 11.5 }}
                >
                  Clear
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: "#6f5b48", lineHeight: 1.5 }}>
                Up to 3 letters, foil-stamped on the band in brass. Free with any build at the bar.
              </div>
            </div>
          )}

          <div style={{ height: 1, background: "#e6dac4", margin: "2px 0" }} />

          {/* build summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "#7d6650",
              }}
            >
              Your build
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 16px" }}>
              <SummaryRow label="Felt" value={feltName} />
              <SummaryRow label="Brim" value={brimName} />
              <SummaryRow label="Band" value={bandName} />
              <SummaryRow label="Charm" value={charmName} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  gridColumn: "1 / -1",
                }}
              >
                <span style={{ color: "#6f5b48" }}>Initials</span>
                <span style={{ fontWeight: 700, color: "#c25b34", letterSpacing: ".1em" }}>
                  {monoOut}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 2 }}>
            <button type="button" className="tc-btn" style={{ flex: 1, padding: 13, fontSize: 12 }} onClick={onBook}>
              Reserve this build
            </button>
            <button
              type="button"
              onClick={shuffle}
              title="Surprise me"
              className="tc-btn tc-btn--ghost"
              style={{ flex: "none", padding: "13px 15px", fontSize: 12 }}
            >
              ↻ Shuffle
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#6f5b48" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#3a261c" }}>{value}</span>
    </div>
  );
}
