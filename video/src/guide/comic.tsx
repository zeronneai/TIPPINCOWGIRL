// ---------------------------------------------------------------------------
// The coral comic layer, all hand-drawn SVG in one color (the brand coral,
// with ink and cream only where a sticker needs an edge): a rope lasso,
// motion lines, dust puffs, sparkles, halftone dots and underlines. Strokes
// reveal as if drawn; the wobble is seeded, so every render is the same.
// ---------------------------------------------------------------------------

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "./theme";
import { clamp01, eased, prog, rand } from "./motion";

type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** A wobbly closed loop around a rectangle, as a list of points (more than one turn). */
function loopPoints(r: Rect, seed: string, turns = 1.18, pad = 26) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w / 2 + pad;
  const ry = r.h / 2 + pad * 0.9;
  const n = 90;
  const pts: Pt[] = [];
  for (let i = 0; i <= n * turns; i++) {
    const a = -Math.PI * 0.62 + (i / n) * Math.PI * 2;
    // the hand: radius breathes a little, and the second pass sits wider
    const wob = 1 + (rand(seed, Math.floor(i / 9)) - 0.5) * 0.05 + Math.sin(i / 7) * 0.015 + (i > n ? 0.07 * ((i - n) / (n * (turns - 1) || 1)) : 0);
    pts.push({ x: cx + Math.cos(a) * rx * wob, y: cy + Math.sin(a) * ry * wob });
  }
  return pts;
}
const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

/**
 * A rope lasso thrown around a rectangle (video px): the loop draws from
 * `at` over `dur` frames, then cinches a touch tighter. The rope trails off
 * toward `tail` (a corner of the frame).
 */
export const Lasso: React.FC<{ rect: Rect; at: number; dur?: number; out?: number; seed?: string; tail?: Pt }> = ({ rect, at, dur = 14, out, seed = "lasso", tail }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const draw = eased(prog(f, at, at + dur), "out");
  const cinch = 1 + 0.1 * (1 - eased(prog(f, at + dur - 2, at + dur + 8), "glide", 0.25));
  const fade = out == null ? 1 : 1 - prog(f, out, out + 6);
  if (fade <= 0) return null;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const pts = loopPoints(rect, seed);
  const end = pts[0];
  const t = tail ?? { x: 1080 + 40, y: rect.y - 260 };
  // the rope away from the knot: a lazy curve off the frame
  const rope = `M${end.x.toFixed(1)} ${end.y.toFixed(1)} Q ${((end.x + t.x) / 2 + 60).toFixed(1)} ${(Math.min(end.y, t.y) - 80).toFixed(1)} ${t.x} ${t.y}`;
  const loop = toPath(pts);
  const ropeDraw = clamp01(draw * 1.6);
  const id = `lasso-${seed}`;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity: fade, overflow: "visible" }}>
      <defs>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x={-200} y={-200} width={1480} height={2320}>
          <path d={rope} pathLength={1} stroke="#fff" strokeWidth={30} fill="none" strokeDasharray={`${ropeDraw} 1`} strokeDashoffset={0} style={{ transform: "scale(1)" }} />
          <path d={loop} pathLength={1} stroke="#fff" strokeWidth={30} fill="none" strokeDasharray={`${draw} 1`} />
        </mask>
      </defs>
      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scale(${cinch})` }} mask={`url(#${id}-m)`}>
        {[rope, loop].map((d, i) => (
          <g key={i}>
            {/* the rope: an ink edge, the coral body, a twist pattern in cream */}
            <path d={d} stroke={C.ink} strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} stroke={C.coral} strokeWidth={8.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} stroke={C.cream} strokeWidth={8.5} fill="none" strokeDasharray="2.2 7" strokeLinecap="butt" opacity={0.8} />
          </g>
        ))}
        {/* the honda knot where the loop meets the rope */}
        <ellipse cx={end.x} cy={end.y} rx={11} ry={8} fill={C.coral} stroke={C.ink} strokeWidth={4} />
      </g>
    </svg>
  );
};

/**
 * Speed lines: short strokes trailing a move, pointing along `angle`
 * (degrees, 0 = to the right), drawn in and pulled away.
 */
export const MotionLines: React.FC<{ x: number; y: number; angle: number; at: number; dur?: number; count?: number; spread?: number; length?: number; seed?: string }> = ({
  x,
  y,
  angle,
  at,
  dur = 12,
  count = 5,
  spread = 120,
  length = 150,
  seed = "ml",
}) => {
  const f = useCurrentFrame();
  const t = (f - at) / dur;
  if (t < 0 || t > 1) return null;
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const nx = -dy;
  const ny = dx;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {Array.from({ length: count }, (_, i) => {
        const off = (i / (count - 1 || 1) - 0.5) * spread + (rand(seed, i) - 0.5) * 24;
        const len = length * (0.55 + rand(seed, i + 9) * 0.6);
        const head = clamp01(t * 2.2 - rand(seed, i + 3) * 0.3);
        const tail = clamp01(t * 2.2 - 1 + rand(seed, i + 5) * 0.2);
        const back = 40 + rand(seed, i + 7) * 60;
        const sx = x - dx * back + nx * off;
        const sy = y - dy * back + ny * off;
        return (
          <line
            key={i}
            x1={sx - dx * len * tail}
            y1={sy - dy * len * tail}
            x2={sx - dx * len * head}
            y2={sy - dy * len * head}
            stroke={C.coral}
            strokeWidth={7 - i % 2 * 2}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
};

/** A dust puff on an impact: little clouds rolling out from a point and fading. */
export const DustPuff: React.FC<{ x: number; y: number; at: number; size?: number; seed?: string; spread?: number }> = ({ x, y, at, size = 1, seed = "puff", spread = 1 }) => {
  const f = useCurrentFrame();
  const t = (f - at) / 18;
  if (t < 0 || t > 1) return null;
  const n = 7;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {Array.from({ length: n }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const a = Math.PI + side * (0.15 + (i / n) * 1.1) + (rand(seed, i) - 0.5) * 0.3;
        const dist = (40 + rand(seed, i + 2) * 70) * size * spread * eased(t, "out");
        const r = (16 + rand(seed, i + 4) * 18) * size * (0.6 + t * 0.7);
        const cx = x + Math.cos(a) * dist * (side > 0 ? -1 : 1);
        const cy = y - Math.abs(Math.sin(a)) * dist * 0.35 - t * 18 * size;
        const o = 1 - t;
        return (
          <g key={i} opacity={o}>
            <circle cx={cx} cy={cy} r={r} fill={C.cream} stroke={C.coral} strokeWidth={4.5} />
            <circle cx={cx - r * 0.35} cy={cy - r * 0.3} r={r * 0.32} fill="none" stroke={C.coral} strokeWidth={3} opacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
};

/** One four point sparkle, scaling in and out. */
const Spark: React.FC<{ x: number; y: number; r: number; k: number; fill?: string }> = ({ x, y, r, k, fill = C.coral }) => {
  const s = r * Math.sin(Math.PI * clamp01(k));
  if (s <= 0.2) return null;
  const w = s * 0.28;
  const d = `M${x} ${y - s} Q ${x + w * 0.4} ${y - w * 0.4} ${x + s} ${y} Q ${x + w * 0.4} ${y + w * 0.4} ${x} ${y + s} Q ${x - w * 0.4} ${y + w * 0.4} ${x - s} ${y} Q ${x - w * 0.4} ${y - w * 0.4} ${x} ${y - s} Z`;
  return <path d={d} fill={fill} stroke={C.ink} strokeWidth={Math.min(3, s * 0.12)} strokeLinejoin="round" />;
};

/** Sparkles twinkling around a point, staggered. */
export const Sparkles: React.FC<{ x: number; y: number; at: number; count?: number; radius?: number; size?: number; seed?: string; dur?: number }> = ({
  x,
  y,
  at,
  count = 6,
  radius = 160,
  size = 26,
  seed = "sp",
  dur = 22,
}) => {
  const f = useCurrentFrame();
  if (f < at || f > at + dur + count * 3) return null;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {Array.from({ length: count }, (_, i) => {
        const a = rand(seed, i) * Math.PI * 2;
        const d = radius * (0.45 + rand(seed, i + 11) * 0.6);
        const k = (f - at - i * 2.5) / (dur * (0.6 + rand(seed, i + 3) * 0.5));
        return <Spark key={i} x={x + Math.cos(a) * d} y={y + Math.sin(a) * d * 0.8} r={size * (0.6 + rand(seed, i + 5) * 0.8)} k={k} fill={i % 3 === 2 ? C.cream : C.coral} />;
      })}
    </svg>
  );
};

/** A tap: rings rippling out from a point. */
export const Ripple: React.FC<{ x: number; y: number; at: number; size?: number }> = ({ x, y, at, size = 1 }) => {
  const f = useCurrentFrame();
  const t = (f - at) / 16;
  if (t < 0 || t > 1.4) return null;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {[0, 0.28].map((d, i) => {
        const k = clamp01((t - d) / 1);
        if (k <= 0 || k >= 1) return null;
        return <circle key={i} cx={x} cy={y} r={(16 + eased(k, "out") * 70) * size} fill="none" stroke={C.coral} strokeWidth={(9 - i * 3) * (1 - k)} opacity={1 - k * 0.6} />;
      })}
    </svg>
  );
};

/** Halftone dots in coral, heavier toward the corners, drifting with `shift` (parallax). */
export const Halftone: React.FC<{ opacity?: number; shift?: number; size?: number }> = ({ opacity = 1, shift = 0, size = 22 }) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: `radial-gradient(rgba(232,103,74,.22) 2.6px, transparent 3px)`,
      backgroundSize: `${size}px ${size}px`,
      backgroundPosition: `0px ${shift % size}px`,
      WebkitMaskImage: "radial-gradient(75% 60% at 50% 48%, rgba(0,0,0,.08) 30%, rgba(0,0,0,.9) 100%)",
      maskImage: "radial-gradient(75% 60% at 50% 48%, rgba(0,0,0,.08) 30%, rgba(0,0,0,.9) 100%)",
    }}
  />
);

/** A hand-drawn underline that fills its box (place it under a word), drawn from `at`. */
export const Underline: React.FC<{ at: number; seed?: string; color?: string; dur?: number }> = ({ at, seed = "ul", color = C.coral, dur = 9 }) => {
  const f = useCurrentFrame();
  const p = eased(prog(f, at, at + dur), "out");
  if (p <= 0) return null;
  // a quick, slightly uneven double stroke, like a marker going back
  const y1 = 8 + rand(seed, 1) * 4;
  const y2 = 14 + rand(seed, 2) * 4;
  const d = `M2 ${y1} C 30 ${y1 - 5}, 70 ${y1 + 4}, 98 ${y1 - 2} M 90 ${y2 - 5} C 64 ${y2}, 30 ${y2 - 3}, 8 ${y2 + 1}`;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ position: "absolute", left: "-3%", width: "106%", bottom: "-0.32em", height: "0.42em", overflow: "visible" }}>
      <path d={d} pathLength={1} stroke={C.cream} strokeWidth={13} strokeLinecap="round" fill="none" strokeDasharray={`${p} 1`} vectorEffect="non-scaling-stroke" />
      <path d={d} pathLength={1} stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={`${p} 1`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
