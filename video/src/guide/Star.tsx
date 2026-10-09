// ---------------------------------------------------------------------------
// The guide: the brand's little coral divider star. It flies in, leaves a
// soft coral trail, lands on what the camera is about to push into (showing
// the way), pulses on buttons and taps them with a ripple.
//
// Its stops are given on the page, on the screen or on the video frame; a
// stop on the page follows the camera, so the star rides along with a
// scroll or a push-in. Positions are a pure function of the frame, so the
// trail is just where it was a few frames ago.
// ---------------------------------------------------------------------------

import React from "react";
import { useCurrentFrame } from "remotion";
import { type Cam, type CamKeys, camAt, project, projectPage } from "./camera";
import { Ripple } from "./comic";
import { C } from "./theme";
import { clamp01, eased, lerp, onBeat, prog } from "./motion";

export type Spot = { page: [number, number] } | { screen: [number, number] } | { video: [number, number] };

export type Stop = {
  /** where it lands */
  at: Spot;
  /** the frame it lands */
  f: number;
  /** frames of flight to get here from the stop before (default 14) */
  fly?: number;
  /** which way the flight bows: 1 or -1 */
  bow?: number;
};

export type StarPlan = {
  stops: Stop[];
  /** where it comes from before the first stop (video px) */
  from?: [number, number];
  /** it flies off the frame from this frame, toward `exitTo` */
  exit?: number;
  exitTo?: [number, number];
  /** taps: the frame the star presses */
  taps?: number[];
  /** frames it pulses (sitting on a button) */
  pulse?: [number, number][];
  size?: number;
};

function spotAt(cam: Cam | null, s: Spot) {
  if ("video" in s) return { x: s.video[0], y: s.video[1] };
  if (!cam) return { x: 540, y: 960 };
  if ("page" in s) return projectPage(cam, s.page[0], s.page[1]);
  return project(cam, s.screen[0], s.screen[1]);
}

/** Where the star is at frame f (video px), and whether it is flying. */
export function starAt(f: number, plan: StarPlan, keys: CamKeys | null) {
  const cam = keys ? camAt(f, keys) : null;
  const stops = plan.stops;
  const pos = (i: number) => spotAt(cam, stops[i].at);
  const flight = (from: { x: number; y: number }, to: { x: number; y: number }, t: number, bow = 1) => {
    const e = eased(t, "glide", 0.06);
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    const lift = Math.min(260, d * 0.32) * bow;
    // a quadratic arc, bowed to one side
    const cx = mx + (-dy / d) * lift;
    const cy = my + (dx / d) * lift;
    const u = 1 - e;
    return { x: u * u * from.x + 2 * u * e * cx + e * e * to.x, y: u * u * from.y + 2 * u * e * cy + e * e * to.y };
  };
  if (plan.exit != null && f >= plan.exit) {
    const last = pos(stops.length - 1);
    const to = { x: plan.exitTo?.[0] ?? 1200, y: plan.exitTo?.[1] ?? -120 };
    const t = prog(f, plan.exit, plan.exit + 12);
    return { ...flight(last, to, t, -1), flying: t < 1, gone: t >= 1 };
  }
  const first = stops[0];
  const firstFly = first.fly ?? 16;
  if (f < first.f) {
    if (f < first.f - firstFly) return { x: -999, y: -999, flying: false, gone: true };
    const from = { x: plan.from?.[0] ?? 1180, y: plan.from?.[1] ?? 180 };
    return { ...flight(from, pos(0), prog(f, first.f - firstFly, first.f), first.bow ?? 1), flying: true, gone: false };
  }
  for (let i = 1; i < stops.length; i++) {
    const s = stops[i];
    const fly = s.fly ?? 14;
    if (f < s.f) {
      if (f < s.f - fly) return { ...pos(i - 1), flying: false, gone: false };
      return { ...flight(pos(i - 1), pos(i), prog(f, s.f - fly, s.f), s.bow ?? (i % 2 ? 1 : -1)), flying: true, gone: false };
    }
  }
  return { ...pos(stops.length - 1), flying: false, gone: false };
}

/** The star itself: five points, coral with an ink edge and a cream glint. */
export const StarShape: React.FC<{ size: number; spin?: number; squash?: number }> = ({ size, spin = 0, squash = 0 }) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.43 : 1;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(Math.cos(a) * r * 46).toFixed(2)},${(Math.sin(a) * r * 46).toFixed(2)}`);
  }
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" style={{ overflow: "visible", transform: `rotate(${spin}deg) scale(${1 + squash * 0.25}, ${1 - squash * 0.25})` }}>
      <polygon points={pts.join(" ")} fill={C.coral} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" />
      <polygon points={pts.join(" ")} fill="none" stroke={C.coralDeep} strokeWidth={3} strokeLinejoin="round" transform="translate(3 4) scale(.82)" opacity={0.45} />
      <ellipse cx={-12} cy={-14} rx={7} ry={4} fill={C.cream} opacity={0.85} transform="rotate(-35 -12 -14)" />
    </svg>
  );
};

export const Star: React.FC<{ plan: StarPlan; keys: CamKeys | null }> = ({ plan, keys }) => {
  const f = useCurrentFrame();
  const now = starAt(f, plan, keys);
  if (now.gone && !(plan.exit != null && f < plan.exit + 14)) return null;
  const size = plan.size ?? 70;

  // the trail: where it was over the last frames, soft and fading
  const trail = [];
  for (let k = 1; k <= 12; k++) {
    const p = starAt(f - k * 0.75, plan, keys);
    if (p.gone) break;
    trail.push(p);
  }
  const pts = [now, ...trail];
  const moving = Math.hypot(now.x - (trail[0]?.x ?? now.x), now.y - (trail[0]?.y ?? now.y));

  // taps: a quick press (the star squashes down) and a ripple
  const taps = plan.taps ?? [];
  const press = taps.reduce((s, t) => s + Math.max(0, 1 - Math.abs(f - t) / 4), 0);
  const pulse = (plan.pulse ?? []).some(([a, b]) => f >= a && f < b) ? onBeat(f) : 0;
  const land = plan.stops.reduce((s, st) => s + Math.max(0, 1 - Math.abs(f - st.f - 2) / 5) * (f >= st.f ? 1 : 0), 0);
  const scale = 1 + pulse * 0.16 - press * 0.22 + land * 0.12;
  const spin = Math.min(40, moving * 0.6) * Math.sign(now.x - (trail[0]?.x ?? now.x) || 1) + Math.sin(f / 18) * 4;

  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: "blur(1.2px)" }}>
        {pts.slice(0, -1).map((p, i) => {
          const q = pts[i + 1];
          const k = 1 - i / pts.length;
          if (Math.hypot(p.x - q.x, p.y - q.y) < 0.5) return null;
          return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={C.coral} strokeOpacity={0.55 * k} strokeWidth={size * 0.42 * k} strokeLinecap="round" />;
        })}
      </svg>
      {taps.map((t) => {
        const p = starAt(t, plan, keys);
        return <Ripple key={t} x={p.x} y={p.y} at={t} size={1.1} />;
      })}
      <div style={{ position: "absolute", left: now.x - size / 2, top: now.y - size / 2, width: size, height: size, transform: `scale(${scale})`, filter: "drop-shadow(0 8px 10px rgba(43,33,24,.3))" }}>
        <StarShape size={size} spin={spin} squash={press * 0.6} />
      </div>
    </>
  );
};

/** A stop helper: the middle of a box [x, y, w, h], nudged by (dx, dy). */
export const mid = (b: number[], dx = 0, dy = 0): [number, number] => [b[0] + b[2] / 2 + dx, b[1] + b[3] / 2 + dy];
export { clamp01, lerp };
