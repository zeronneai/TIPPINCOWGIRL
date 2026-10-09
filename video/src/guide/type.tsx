// ---------------------------------------------------------------------------
// Type for the guide ad. Headlines are stickers: Alfa Slab One in coral with
// a thick cream outline and a soft peel shadow, stacked and compact, ALWAYS
// straight (no rotation, ever). Small lines are Satoshi. Buttons are flat
// western wooden signs.
// ---------------------------------------------------------------------------

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Underline } from "./comic";
import { C, FONT, HEAD_TOP } from "./theme";
import { clamp01, onBeat, prog } from "./motion";

/** Split "*word*" markup into parts, the starred ones underlined. */
function parts(line: string) {
  return line.split(/(\*[^*]+\*)/).filter(Boolean).map((p) => (p.startsWith("*") ? { text: p.slice(1, -1), mark: true } : { text: p, mark: false }));
}

/** A size that fits the longest line in `width` (Alfa Slab One caps run about 0.74 em a letter). */
export function fitSize(lines: readonly string[], width = 960, max = 118) {
  const longest = Math.max(...lines.map((l) => l.replace(/\*/g, "").length));
  return Math.min(max, Math.floor(width / (longest * 0.74)));
}

/** When each line of a headline lands (frames after `at`). */
export const lineLand = (i: number, stagger = 4) => i * stagger + 5;

/**
 * A sticker headline. Lines slap down one after another (scale, never
 * rotation), each starred word gets an underline once its line has landed.
 */
export const Sticker: React.FC<{
  lines: readonly string[];
  at: number;
  out?: number;
  top?: number;
  size?: number;
  stagger?: number;
  align?: "center" | "left";
}> = ({ lines, at, out, top = HEAD_TOP, size, stagger = 4, align = "center" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fs = size ?? fitSize(lines);
  if (f < at) return null;
  const gone = out == null ? 0 : prog(f, out, out + 7);
  if (gone >= 1) return null;
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top, display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start" }}>
      {lines.map((line, i) => {
        const p = spring({ frame: f - at - i * stagger, fps, config: { damping: 11, stiffness: 260, mass: 0.55 } });
        const appear = clamp01((f - at - i * stagger) / 2);
        // the slap: big and light, then down with a squash, then settle
        const sc = 1.5 - 0.5 * p;
        const squash = Math.max(0, Math.sin(Math.PI * clamp01((f - at - i * stagger - 3) / 6))) * 0.06;
        const leave = gone * (1 + i * 0.3);
        return (
          <div
            key={i}
            style={{
              fontFamily: FONT.display,
              fontSize: fs,
              lineHeight: 0.98,
              textTransform: "uppercase",
              letterSpacing: "0.01em",
              color: C.coral,
              WebkitTextStroke: `${fs * 0.17}px ${C.cream}`,
              paintOrder: "stroke fill",
              whiteSpace: "nowrap",
              textAlign: "center",
              opacity: appear * (1 - leave),
              transform: `translateY(${-leave * 40}px) scale(${(sc + squash) * (1 - leave * 0.1)}, ${(sc - squash) * (1 - leave * 0.1)})`,
              transformOrigin: "50% 80%",
              // the peel: a crisp lift shadow, then a soft one on the cream
              filter: `drop-shadow(0 ${fs * 0.06}px 0 rgba(43,33,24,.16)) drop-shadow(0 ${fs * 0.14}px ${fs * 0.16}px rgba(43,33,24,.32))`,
              marginTop: i ? -fs * 0.04 : 0,
            }}
          >
            {parts(line).map((pt, k) =>
              pt.mark ? (
                <span key={k} style={{ position: "relative", display: "inline-block" }}>
                  {pt.text}
                  <Underline at={at + i * stagger + 10} seed={`${line}-${k}`} />
                </span>
              ) : (
                <span key={k} style={{ whiteSpace: "pre" }}>
                  {pt.text}
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};

/** The headline's height, to place things under it. */
export const stickerHeight = (lines: readonly string[], size?: number) => (size ?? fitSize(lines)) * 0.94 * lines.length;

/** A small label: Satoshi caps on a cream pill with an ink edge. */
export const Chip: React.FC<{ children: React.ReactNode; at: number; out?: number; style?: React.CSSProperties; size?: number; dark?: boolean }> = ({ children, at, out, style, size = 34, dark }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < at) return null;
  const p = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 200, mass: 0.6 } });
  const gone = out == null ? 0 : prog(f, out, out + 6);
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: FONT.body,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: dark ? C.cream : C.ink,
        background: dark ? C.ink : C.cream,
        border: `4px solid ${C.ink}`,
        borderRadius: 999,
        padding: `${size * 0.42}px ${size * 0.95}px`,
        boxShadow: `0 6px 0 ${C.ink}`,
        whiteSpace: "nowrap",
        opacity: clamp01(p * 2) * (1 - gone),
        transform: `translateY(${(1 - p) * 26}px) scale(${0.85 + p * 0.15})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * A flat western wooden sign, the site's button made big: brown planks with
 * grain, an ink edge, two nails and cream slab lettering. Pulses on the beat.
 */
export const WoodSign: React.FC<{ label: string; width?: number; height?: number; at: number; pulse?: boolean; press?: number }> = ({ label, width = 640, height = 150, at, pulse = true, press }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < at) return null;
  const p = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 190, mass: 0.7 } });
  const beat = pulse ? onBeat(f) * 0.035 : 0;
  const pr = press == null ? 0 : Math.max(0, 1 - Math.abs(f - press) / 4) * 0.06;
  const fs = Math.min(height * 0.36, (width * 0.82) / (label.length * 0.82));
  return (
    <div style={{ position: "relative", width, height, opacity: clamp01(p * 2), transform: `translateY(${(1 - p) * 60}px) scale(${(0.9 + 0.1 * p) * (1 + beat - pr)})` }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="wood-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.16" numOctaves={3} seed={7} />
            <feColorMatrix values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0.03  0 0 0 0.42 0" />
          </filter>
          <linearGradient id="wood-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.wood} />
            <stop offset="0.6" stopColor={C.woodMid} />
            <stop offset="1" stopColor={C.woodDark} />
          </linearGradient>
          <clipPath id="wood-clip">
            <rect x={0} y={0} width={width} height={height} rx={14} />
          </clipPath>
        </defs>
        <g clipPath="url(#wood-clip)">
          <rect x={0} y={0} width={width} height={height} fill="url(#wood-fill)" />
          <rect x={0} y={0} width={width} height={height} filter="url(#wood-grain)" />
          {/* the seam between two planks */}
          <line x1={0} y1={height * 0.5} x2={width} y2={height * 0.5} stroke="rgba(43,26,16,.35)" strokeWidth={3} />
          <line x1={0} y1={height * 0.5 + 3} x2={width} y2={height * 0.5 + 3} stroke="rgba(255,230,190,.08)" strokeWidth={2} />
        </g>
        <rect x={3} y={3} width={width - 6} height={height - 6} rx={13} fill="none" stroke={C.ink} strokeWidth={6} />
        {[0.07, 0.93].map((x) => (
          <g key={x}>
            <circle cx={width * x} cy={height * 0.5} r={8} fill="#3a2a1f" stroke={C.ink} strokeWidth={2} />
            <circle cx={width * x - 2} cy={height * 0.5 - 2} r={2.5} fill="rgba(255,240,210,.5)" />
          </g>
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT.display,
          fontSize: fs,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: C.woodText,
          textShadow: "0 3px 0 rgba(43,26,16,.55)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
};
