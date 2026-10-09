import { interpolate } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Screenshots shown one after another in the same phone: each fades in over
 * `fade` frames at its start, and stops drawing once the next one covers it.
 */
export function stack(frame: number, starts: number[], fade = 9): number[] {
  return starts.map((start, i) => {
    const fadeIn = i === 0 ? 1 : interpolate(frame, [start, start + fade], [0, 1], clamp);
    const covered = i < starts.length - 1 && frame > starts[i + 1] + fade;
    return covered ? 0 : fadeIn;
  });
}

/** Which of several consecutive steps is current at `frame` (-1 before the first). */
export const stepAt = (frame: number, starts: number[]) => starts.reduce((cur, s, i) => (frame >= s ? i : cur), -1);

/** 0 to 1 between two frames, smoothed. */
export function ramp(frame: number, from: number, to: number) {
  const t = interpolate(frame, [from, to], [0, 1], clamp);
  return t * t * (3 - 2 * t);
}

/** 1 inside [from, to], fading over `fade` frames at both ends. */
export const during = (frame: number, from: number, to: number, fade = 8) => Math.min(ramp(frame, from, from + fade), 1 - ramp(frame, to - fade, to));
