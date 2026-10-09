// ---------------------------------------------------------------------------
// ALL THE SOUND IN THE GUIDED JOURNEY AD: the tempo, the music slot, the
// sound effect files, their levels, and every cue.
//
// SWAP A SOUND: put a WAV with the same name in video/public/sfx/ (for
// example a professional whoosh as whoosh-short.wav). It plays in the same
// spots. `npm run sfx` rewrites the synthesized ones, so keep a copy of
// yours elsewhere or do not run it again.
//
// MOVE A SOUND: each cue hangs on a named moment of a section (see
// src/guide/timeline.ts, where the pictures are timed from the same names).
// `offset` nudges it in frames (30 a second), `volume` scales its level.
//
// MUSIC: put a track at video/public/guide-music.mp3. Set GUIDE_BPM to its
// tempo: every cut sits on a beat of it. It is ducked a little under every
// impact. Without the file the ad plays with the effects only.
// ---------------------------------------------------------------------------

import type { SectionId } from "./guide/timeline";

/** The tempo: one beat = 30 * 60 / GUIDE_BPM frames. Cuts land on beats. */
export const GUIDE_BPM = 120;

export const MUSIC = {
  file: "guide-music.mp3",
  volume: 0.5,
  /** how far the music dips under an impact (0.3 = to 70 %), and for how long (frames) */
  duck: 0.3,
  duckFrames: 14,
  /** frames of fade in at the start and out at the end */
  fadeIn: 6,
  fadeOut: 24,
};

/** The effects, by name: the files in public/sfx/. */
export const SFX = {
  "whoosh-short": "sfx/whoosh-short.wav",
  "whoosh-long": "sfx/whoosh-long.wav",
  impact: "sfx/impact.wav",
  tap: "sfx/tap.wav",
  pop: "sfx/pop.wav",
  shimmer: "sfx/shimmer.wav",
  riser: "sfx/riser.wav",
  "logo-hit": "sfx/logo-hit.wav",
} as const;
export type SfxName = keyof typeof SFX;

/** The mix: each effect's level (0..1) before a cue's own `volume`. */
export const LEVEL: Record<SfxName, number> = {
  "whoosh-short": 0.5,
  "whoosh-long": 0.45,
  impact: 0.8,
  tap: 0.55,
  pop: 0.6,
  shimmer: 0.32,
  riser: 0.5,
  "logo-hit": 0.9,
};

/** How long each synthesized whoosh is, and where it peaks (seconds): a whoosh is stretched so its peak lands mid move. */
export const WHOOSH = {
  "whoosh-short": { length: 0.45, peak: 0.19 },
  "whoosh-long": { length: 1.0, peak: 0.5 },
};

/**
 * A cue. `at` names a moment of the section (a frame, a move or a list of
 * them). `sfx: "whoosh"` picks the short or the long whoosh by the move's
 * length and fits it to the move. `duck` dips the music under it.
 */
export type Cue = { at: string; sfx: SfxName | "whoosh"; offset?: number; volume?: number; duck?: boolean };

const caption: Cue = { at: "caption", sfx: "impact", offset: 5, duck: true };

export const CUES: Record<SectionId, Cue[]> = {
  hookA: [
    { at: "hat", sfx: "impact", offset: 1, duck: true },
    { ...caption, volume: 0.7 },
    { at: "pieces", sfx: "pop", offset: 6 },
    { at: "sweep", sfx: "shimmer" },
    { at: "out", sfx: "whoosh" },
  ],
  hookB: [
    { at: "push", sfx: "whoosh" },
    caption,
    { at: "sparkle", sfx: "shimmer" },
    { at: "out", sfx: "whoosh" },
  ],
  hookC: [
    { at: "logo", sfx: "logo-hit", duck: true, volume: 0.85 },
    { at: "shimmer", sfx: "shimmer", volume: 0.8 },
    { at: "phoneIn", sfx: "whoosh" },
    caption,
    { at: "out", sfx: "whoosh" },
  ],
  arrival: [
    { at: "phoneIn", sfx: "whoosh" },
    { at: "starIn", sfx: "whoosh", volume: 0.5 },
    { at: "starLand", sfx: "shimmer", volume: 0.8 },
    caption,
    { at: "push", sfx: "whoosh", volume: 0.7 },
  ],
  scroll: [
    { at: "pull", sfx: "whoosh", volume: 0.6 },
    caption,
    { at: "glide", sfx: "whoosh" },
  ],
  intoBuilder: [
    { at: "whip", sfx: "whoosh" },
    { at: "starLand", sfx: "tap", volume: 0.5 },
    { at: "lasso", sfx: "whoosh-short", volume: 0.7 },
    { at: "push", sfx: "whoosh", volume: 0.5 },
    caption,
    { at: "tap", sfx: "tap" },
    { at: "whipIn", sfx: "whoosh" },
  ],
  build: [
    { at: "baseCaption", sfx: "impact", offset: 5, duck: true },
    { at: "typeTaps", sfx: "tap" },
    { at: "typeTaps", sfx: "pop", offset: 3, volume: 0.8 },
    { at: "toColor", sfx: "whoosh", volume: 0.6 },
    { at: "colorTap", sfx: "tap" },
    { at: "colorTap", sfx: "pop", offset: 3, volume: 0.8 },
    { at: "straw", sfx: "impact", duck: true, volume: 0.7 },
    { at: "straw", sfx: "pop", offset: 13 },
    { at: "straw", sfx: "pop", offset: 19 },
    { at: "straw", sfx: "pop", offset: 25 },
    { at: "stack", sfx: "whoosh-short", offset: -6, volume: 0.6 },
    { at: "stackCaption", sfx: "impact", offset: 5, duck: true },
    { at: "stackTaps", sfx: "tap" },
    { at: "stackTaps", sfx: "pop", offset: 3 },
    { at: "stackMoves", sfx: "whoosh", volume: 0.6 },
    { at: "suede", sfx: "impact", duck: true, volume: 0.7 },
    { at: "suede", sfx: "pop", offset: 13 },
    { at: "suede", sfx: "pop", offset: 19 },
    { at: "suede", sfx: "pop", offset: 25 },
    { at: "yours", sfx: "whoosh-short", offset: -6, volume: 0.6 },
    { at: "yoursCaption", sfx: "impact", offset: 5, duck: true },
    { at: "toAdd", sfx: "whoosh", volume: 0.6 },
    { at: "addTap", sfx: "tap" },
    { at: "addTap", sfx: "pop", offset: 3 },
    { at: "wool", sfx: "impact", duck: true, volume: 0.75 },
    { at: "burn", sfx: "riser", offset: -2, volume: 0.25 },
    { at: "woolSweep", sfx: "shimmer" },
  ],
  cart: [
    caption,
    { at: "sizeTap", sfx: "tap" },
    { at: "addTap", sfx: "tap" },
    { at: "fly", sfx: "whoosh" },
    { at: "inCart", sfx: "pop" },
    { at: "drawer", sfx: "whoosh-short", volume: 0.7 },
    { at: "push", sfx: "whoosh", volume: 0.5 },
    { at: "price", sfx: "pop", offset: 2, volume: 0.8 },
    { at: "out", sfx: "whoosh", volume: 0.6 },
  ],
  bookings: [
    { at: "swing", sfx: "whoosh" },
    { at: "starLand", sfx: "tap", volume: 0.5 },
    { at: "lasso", sfx: "whoosh-short", volume: 0.7 },
    caption,
    { at: "tap", sfx: "tap" },
    { at: "drawer", sfx: "whoosh-short", volume: 0.8 },
    { at: "sparkle", sfx: "shimmer", volume: 0.7 },
  ],
  end: [
    // the riser builds through the last beats of the section before
    { at: "logo", sfx: "riser", offset: -52 },
    { at: "logo", sfx: "logo-hit", duck: true },
    { at: "url", sfx: "impact", offset: 4, volume: 0.45, duck: true },
    { at: "sign", sfx: "pop", offset: 4 },
    { at: "tap", sfx: "tap" },
    { at: "sparkle", sfx: "shimmer" },
  ],
  quickScroll: [
    { at: "phoneIn", sfx: "whoosh" },
    caption,
    { at: "starLand", sfx: "tap", volume: 0.5 },
    { at: "lasso", sfx: "whoosh-short", volume: 0.7 },
    { at: "tap", sfx: "tap" },
    { at: "whipIn", sfx: "whoosh" },
    { at: "glide", sfx: "whoosh", volume: 0.6 },
  ],
  buildShort: [], // same cues as `build`, see below
};
CUES.buildShort = CUES.build;
