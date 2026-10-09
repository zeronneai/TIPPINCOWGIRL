// ---------------------------------------------------------------------------
// The guide ad's timeline: which sections play in each version, how long
// each one is (in beats, so cuts land on the music) and the named moments
// inside them (local frames). The visuals are built from these moments, and
// src/guide-sfx.ts hangs every sound on them by name, so a sound stays on
// its picture when the timing changes.
//
// A moment is a frame, a move { from, to } (a whoosh is sized to it), or a
// list of either (one cue each).
// ---------------------------------------------------------------------------

import { beats } from "./motion";

export type Move = { from: number; to: number };
export type Moment = number | Move | number[] | Move[];
export type Plan = { dur: number } & Record<string, Moment>;

const B = beats;

// ---- the hooks (the first ~2 seconds; only these differ between a, b and c) ----
const hookA = {
  dur: B(4),
  hat: 0, // the plain hat lands
  caption: 3,
  pieces: [12, 20, 28, 36], // feather, cord, bud, matches slam on
  sweep: 42,
  sparkle: 44,
  out: { from: 54, to: 60 },
};
const hookB = {
  dur: B(4),
  caption: 3,
  push: { from: 2, to: 24 }, // a fast push into the builder's preview
  sparkle: 30,
  out: { from: 54, to: 60 },
};
const hookC = {
  dur: B(4),
  logo: 1, // the logo sting
  shimmer: 6,
  phoneIn: { from: 14, to: 26 }, // then the hero
  caption: 16,
  out: { from: 54, to: 60 },
};

// ---- the 30 second journey ----
const arrival = {
  dur: B(6),
  phoneIn: { from: 0, to: 14 },
  starIn: { from: 8, to: 26 },
  starLand: 26,
  caption: 14,
  push: { from: 30, to: 50 },
};
const scroll = {
  dur: B(8),
  pull: { from: 0, to: 14 }, // out of the push-in, and the phone frame drops away (full bleed)
  caption: 4,
  glide: { from: 14, to: 98 },
  frameBack: { from: 100, to: 116 }, // the phone frame comes back
};
const intoBuilder = {
  dur: B(6),
  whip: { from: 0, to: 12 },
  starLand: 20,
  lasso: 22,
  push: { from: 18, to: 36 },
  caption: 24,
  tap: 44,
  whipIn: { from: 52, to: 68 },
};
/** The build, 20 beats: phone, full screen straw, phone, full screen suede, phone, full screen wool. */
const build = {
  dur: B(20),
  // a) Pick your base, on the phone
  base: 0,
  baseCaption: 4,
  typeTaps: [10, 22, 34], // straw, faux suede, wool
  toColor: { from: 38, to: 48 },
  colorTap: 52,
  // b) a straw hat, full screen
  straw: B(4),
  // c) Stack your style, on the phone
  stack: B(7),
  stackCaption: B(7) + 4,
  stackTaps: [B(7) + 8, B(7) + 30, B(7) + 52],
  stackMoves: [
    { from: B(7) + 14, to: B(7) + 26 },
    { from: B(7) + 36, to: B(7) + 48 },
  ],
  // d) a faux suede hat, full screen
  suede: B(11),
  // e) Make it unmistakably yours, on the phone
  yours: B(14),
  yoursCaption: B(14) + 4,
  toAdd: { from: B(14) + 14, to: B(14) + 26 },
  addTap: B(14) + 32,
  // f) the wool hat, engraved, full screen
  wool: B(17),
  burn: B(17) + 8,
  woolSweep: B(17) + 24,
  woolSparkle: B(17) + 30,
};
const cart = {
  dur: B(6),
  caption: 6,
  sizeTap: 12,
  addTap: 24,
  fly: { from: 26, to: 42 },
  inCart: 42,
  drawer: 48,
  push: { from: 50, to: 66 },
  price: 58,
  out: { from: 80, to: 90 },
};
const bookings = {
  dur: B(6),
  swing: { from: 0, to: 16 },
  starLand: 18,
  lasso: 20,
  caption: 22,
  push: { from: 16, to: 34 },
  tap: 40,
  drawer: 44,
  pull: { from: 46, to: 60 },
  sparkle: 64,
};
const end = {
  dur: B(4),
  logo: 2,
  line: 10,
  url: 14,
  sign: 20,
  starLand: 32,
  tap: 44,
  sparkle: 48,
};

// ---- the 15 second cut ----
const quickScroll = {
  dur: B(6),
  phoneIn: { from: 0, to: 12 },
  caption: 6,
  starLand: 22,
  lasso: 24,
  tap: 34,
  whipIn: { from: 40, to: 54 },
  glide: { from: 56, to: 86 },
};
const buildShort = {
  dur: B(16),
  base: 0,
  baseCaption: 3,
  typeTaps: [8, 16, 24],
  toColor: { from: 28, to: 36 },
  colorTap: 40,
  straw: B(3),
  stack: B(5),
  stackCaption: B(5) + 3,
  stackTaps: [B(5) + 8, B(5) + 28, B(5) + 48],
  stackMoves: [
    { from: B(5) + 12, to: B(5) + 24 },
    { from: B(5) + 32, to: B(5) + 44 },
  ],
  suede: B(9),
  yours: B(11),
  yoursCaption: B(11) + 3,
  toAdd: { from: B(11) + 8, to: B(11) + 18 },
  addTap: B(11) + 24,
  wool: B(13),
  burn: B(13) + 6,
  woolSweep: B(13) + 20,
  woolSparkle: B(13) + 26,
};

export const PLANS = { hookA, hookB, hookC, arrival, scroll, intoBuilder, build, cart, bookings, end, quickScroll, buildShort };
export type SectionId = keyof typeof PLANS;
export type BuildPlan = typeof build;

export type Cut = "a" | "b" | "c" | "15";

/** The sections of each version, in order. */
export const CUTS: Record<Cut, SectionId[]> = {
  a: ["hookA", "arrival", "scroll", "intoBuilder", "build", "cart", "bookings", "end"],
  b: ["hookB", "arrival", "scroll", "intoBuilder", "build", "cart", "bookings", "end"],
  c: ["hookC", "arrival", "scroll", "intoBuilder", "build", "cart", "bookings", "end"],
  "15": ["hookA", "quickScroll", "buildShort", "end"],
};

/** Where each section starts in a version (frames). */
export function layout(cut: Cut) {
  let at = 0;
  return CUTS[cut].map((id) => {
    const s = { id, from: at, dur: PLANS[id].dur };
    at += s.dur;
    return s;
  });
}

export const totalFrames = (cut: Cut) => layout(cut).reduce((n, s) => n + s.dur, 0);
