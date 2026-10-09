// ---------------------------------------------------------------------------
// How things move in the guide ad: keyframe tracks with a human feel (ease
// in, glide, ease out, a tiny overshoot that settles), and the beat grid.
// ---------------------------------------------------------------------------

import { Easing } from "remotion";
import { GUIDE_BPM } from "../guide-sfx";

export const FPS = 30;
/** Frames per beat at the ad's tempo: every cut lands on one. */
export const BEAT = (FPS * 60) / GUIDE_BPM;
export const beats = (n: number) => Math.round(n * BEAT);

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 across [a, b] (clamped). */
export const prog = (f: number, a: number, b: number) => (b === a ? (f >= b ? 1 : 0) : clamp01((f - a) / (b - a)));
export const smooth = (t: number) => t * t * (3 - 2 * t);

const glideCurve = Easing.bezier(0.58, 0, 0.18, 1); // a slow start, a long soft landing
const whipCurve = Easing.bezier(0.7, 0, 0.12, 1); // most of the move in a blink

export type Ease = "glide" | "whip" | "linear" | "hold" | "out" | "in";

/**
 * Progress along a move, 0..1. "glide" and "whip" end with a small
 * overshoot that settles back (the camera operator's hand), `os` sized as a
 * fraction of the move.
 */
export function eased(t: number, ease: Ease = "glide", os = 0.03): number {
  t = clamp01(t);
  if (ease === "linear") return t;
  if (ease === "hold") return t < 1 ? 0 : 1;
  if (ease === "out") return 1 - Math.pow(1 - t, 3);
  // speeding up to the cut: a whip that leaves the frame on the last frame
  if (ease === "in") return Math.pow(t, 2.4);
  const base = (ease === "whip" ? whipCurve : glideCurve)(t);
  // the settle: a bump past the target over the last 30%, smooth at both ends
  const u = clamp01((t - 0.7) / 0.3);
  return base + os * Math.sin(Math.PI * u) ** 2;
}

export type Key = { f: number; v: number; ease?: Ease; os?: number };

/**
 * A value over time from keyframes. Each key says where the value is at
 * frame `f`; the move INTO a key uses that key's ease.
 */
export function track(f: number, keys: Key[]): number {
  if (!keys.length) return 0;
  if (f <= keys[0].f) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f <= k.f) {
      const a = keys[i - 1];
      // the default settle is small, and smaller still on long moves (a long
      // scroll overshoots by a few pixels, not a screen)
      const d = Math.abs(k.v - a.v);
      return lerp(a.v, k.v, eased(prog(f, a.f, k.f), k.ease ?? "glide", k.os ?? (d ? 0.025 * Math.min(1, 600 / d) : 0)));
    }
  }
  return keys[keys.length - 1].v;
}

/** The value of a step list ([frame, value] pairs) at `f`: the last one that has started. */
export function step<T>(f: number, list: [number, T][]): T {
  let v = list[0][1];
  for (const [at, x] of list) if (f >= at) v = x;
  return v;
}

/** A soft pulse on every beat, 0..1, peaking on the beat. */
export const onBeat = (f: number, every = BEAT) => Math.pow(Math.max(0, Math.cos((Math.PI * (f % every)) / every)), 6);

/** A seeded pseudo random number in 0..1 for a key and index. */
export function rand(seed: string, i = 0) {
  let h = 2166136261 ^ i;
  for (let k = 0; k < seed.length; k++) h = Math.imul(h ^ seed.charCodeAt(k), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
