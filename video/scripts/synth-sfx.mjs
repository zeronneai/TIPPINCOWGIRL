// ---------------------------------------------------------------------------
// The guided journey ad's sound effects, synthesized from scratch (nothing is
// downloaded), into video/public/sfx/:
//
//   whoosh-short.wav   a quick camera move or whip pan (about 0.45 s)
//   whoosh-long.wav    a long glide down the page (about 1 s)
//   impact.wav         a headline landing: soft sub-bass thump
//   tap.wav            the star tapping a button: a crisp UI tap
//   pop.wav            an accessory landing on the hat: pop and snap
//   shimmer.wav        sparkles: light bell partials and air
//   riser.wav          the build into the end card
//   logo-hit.wav       the final hit on the logo, with a bright tail
//
//   cd video && npm run sfx
//
// Each one is shaped like a studio sound, not a chip tune: filtered noise
// and sines with proper envelopes, a little stereo width, a short room, no
// DC, faded tails and a peak of -1 dBFS (no clipping). The random numbers
// are seeded, so every run writes the same files.
//
// To use professional sounds instead, drop a WAV with the same name into
// public/sfx/ (and do not run this script again, or keep a copy): the ad
// plays whatever file is there, in the same spot (src/guide-sfx.ts).
// ---------------------------------------------------------------------------

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../public/sfx/", import.meta.url));
const SR = 48000;
const TAU = Math.PI * 2;

// ---- building blocks -------------------------------------------------------------------------------
/** A seeded random number generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const buf = (sec) => new Float64Array(Math.round(sec * SR));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** White noise, or pink-ish noise (Paul Kellet's filter) when `pink`. */
function noise(sec, seed, pink = false) {
  const r = rng(seed);
  const out = buf(sec);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r() * 2 - 1;
    if (!pink) {
      out[i] = w;
      continue;
    }
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/**
 * An RBJ biquad run over `x`, its cutoff (and Q) following functions of
 * time, recomputed every 16 samples: sweeps without zipper noise.
 */
function biquad(x, type, freqAt, qAt = () => 0.707, gainDb = 0) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % 16 === 0) {
      const t = i / SR;
      const f = Math.min(SR * 0.45, Math.max(10, freqAt(t)));
      const q = qAt(t);
      const w = (TAU * f) / SR;
      const cs = Math.cos(w);
      const al = Math.sin(w) / (2 * q);
      const A = Math.pow(10, gainDb / 40);
      let n0, n1, n2, d0, d1, d2;
      if (type === "lp") [n0, n1, n2, d0, d1, d2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + al, -2 * cs, 1 - al];
      else if (type === "hp") [n0, n1, n2, d0, d1, d2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al];
      else if (type === "bp") [n0, n1, n2, d0, d1, d2] = [al, 0, -al, 1 + al, -2 * cs, 1 - al];
      else if (type === "peak") [n0, n1, n2, d0, d1, d2] = [1 + al * A, -2 * cs, 1 - al * A, 1 + al / A, -2 * cs, 1 - al / A];
      else throw new Error(type);
      b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = d1 / d0; a2 = d2 / d0;
    }
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}
const lp = (x, f, q) => biquad(x, "lp", typeof f === "function" ? f : () => f, q ? () => q : undefined);
const hp = (x, f, q) => biquad(x, "hp", typeof f === "function" ? f : () => f, q ? () => q : undefined);
const bp = (x, f, q = 1) => biquad(x, "bp", typeof f === "function" ? f : () => f, typeof q === "function" ? q : () => q);

/** Multiply by an envelope given as a function of time. */
function env(x, fn) {
  for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR);
  return x;
}
/** Attack then exponential decay (decay = time to fall by 60 dB). */
const ad = (attack, decay, delay = 0) => (t) => {
  const u = t - delay;
  if (u < 0) return 0;
  if (u < attack) return Math.sin((u / attack) * (Math.PI / 2)) ** 2;
  return Math.pow(10, (-3 * (u - attack)) / decay);
};
/** A smooth bell: up over `rise`, down over `fall`, with `curve` shaping. */
const bell = (rise, fall, curve = 2) => (t) => {
  if (t < rise) return Math.pow(Math.sin((t / rise) * (Math.PI / 2)), curve);
  const u = clamp01((t - rise) / fall);
  return Math.pow(Math.cos(u * (Math.PI / 2)), curve);
};

/** A sine whose frequency follows f(t) (phase accumulated, so sweeps are clean). */
function sine(sec, f, phase = 0) {
  const out = buf(sec);
  let p = phase;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.sin(p);
    p += (TAU * f(i / SR)) / SR;
  }
  return out;
}

function mixInto(dst, src, gain = 1, offsetSec = 0) {
  const o = Math.round(offsetSec * SR);
  for (let i = 0; i < src.length && i + o < dst.length; i++) dst[i + o] += src[i] * gain;
  return dst;
}
const sat = (x, drive = 1.5) => x.map((v) => Math.tanh(v * drive) / Math.tanh(drive));

/** A short stereo room (a small Freeverb): returns [left, right] wet signals. */
function room(x, { size = 0.72, damp = 0.35, seconds = 0.5 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const alls = [556, 441, 341, 225];
  const scale = SR / 44100;
  const n = x.length + Math.round(seconds * SR);
  const run = (spread) => {
    const out = new Float64Array(n);
    for (const c of combs) {
      const len = Math.round((c + spread) * scale);
      const line = new Float64Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < n; i++) {
        const input = i < x.length ? x[i] : 0;
        const o = line[idx];
        store = o * (1 - damp) + store * damp;
        line[idx] = input * 0.015 + store * size;
        idx = (idx + 1) % len;
        out[i] += o;
      }
    }
    for (const a of alls) {
      const len = Math.round((a + spread) * scale);
      const line = new Float64Array(len);
      let idx = 0;
      for (let i = 0; i < n; i++) {
        const bufout = line[idx];
        const v = out[i];
        line[idx] = v + bufout * 0.5;
        out[i] = bufout - v;
        idx = (idx + 1) % len;
      }
    }
    return out;
  };
  return [run(0), run(23)];
}

/**
 * Finish a sound: stereo from a mono dry signal (with optional pan over
 * time and room), DC removed, a faded tail, peak at `peakDb`.
 */
function finish(name, { L, R }, { peakDb = -1, fadeOut = 0.03 } = {}) {
  let n = Math.max(L.length, R.length);
  let l = new Float64Array(n), r = new Float64Array(n);
  l.set(L); r.set(R);
  l = hp(l, 22); r = hp(r, 22);
  // short tails: cut 60 ms after the sound falls below -70 dB of its peak
  let top = 0;
  for (let i = 0; i < n; i++) top = Math.max(top, Math.abs(l[i]), Math.abs(r[i]));
  let last = n - 1;
  while (last > 0 && Math.abs(l[last]) < top * 3.2e-4 && Math.abs(r[last]) < top * 3.2e-4) last--;
  n = Math.min(n, last + Math.round(0.06 * SR));
  fadeOut = Math.min(fadeOut, (n / SR) * 0.4);
  l = l.subarray(0, n); r = r.subarray(0, n);
  const f = Math.round(fadeOut * SR);
  for (let i = 0; i < f; i++) {
    const g = Math.cos(((i + 1) / f) * (Math.PI / 2)) ** 2;
    l[n - f + i] *= g;
    r[n - f + i] *= g;
  }
  // a 1 ms fade in: no click at the start
  for (let i = 0; i < 48; i++) {
    l[i] *= i / 48;
    r[i] *= i / 48;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const g = Math.pow(10, peakDb / 20) / (peak || 1);
  writeWav(path.join(DIR, `${name}.wav`), l.map((v) => v * g), r.map((v) => v * g));
  console.log(`  ${name}.wav  ${(n / SR).toFixed(2)} s`);
}

/**
 * Mono dry plus a stereo room, panned with equal power from -1 (left) to 1
 * (right) over time. `width` widens the room (mid/side), never the dry
 * sound, so nothing smears or phases on a phone speaker.
 */
function stereo(dry, { wet = 0.15, roomOpts, pan = () => 0, width = 0 } = {}) {
  const [wl, wr] = wet ? room(dry, roomOpts) : [new Float64Array(dry.length), new Float64Array(dry.length)];
  const n = Math.max(dry.length, wl.length);
  const L = new Float64Array(n), R = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = ((pan(i / SR) + 1) / 2) * (Math.PI / 2);
    const d = i < dry.length ? dry[i] : 0;
    const m = ((wl[i] || 0) + (wr[i] || 0)) / 2;
    const sd = (((wl[i] || 0) - (wr[i] || 0)) / 2) * (1 + width);
    L[i] = d * Math.cos(a) * Math.SQRT2 + (m + sd) * wet;
    R[i] = d * Math.sin(a) * Math.SQRT2 + (m - sd) * wet;
  }
  return { L, R };
}

function writeWav(file, l, r) {
  const n = l.length;
  const data = Buffer.alloc(n * 4);
  const d = rng(99); // TPDF dither for the 16 bit words
  for (let i = 0; i < n; i++) {
    for (const [c, v] of [[0, l[i]], [1, r[i]]]) {
      const dith = (d() - d()) / 32768;
      const s = Math.max(-32768, Math.min(32767, Math.round((v + dith) * 32767)));
      data.writeInt16LE(s, i * 4 + c * 2);
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

// ---- the sounds ------------------------------------------------------------------------------------------
/** Air moving past: a band of noise sweeping up then down, panning across. */
function whoosh(name, sec, seed, { lo, hi, end, peakAt }) {
  const rise = sec * peakAt;
  const fall = sec - rise;
  const sweep = (t) => (t < rise ? lerp(lo, hi, Math.pow(t / rise, 1.6)) : lerp(hi, end, Math.pow((t - rise) / fall, 0.7)));
  // the body: pink noise through a moving band
  const body = bp(noise(sec, seed, true), sweep, (t) => lerp(0.9, 1.6, clamp01(t / sec)));
  env(body, bell(rise, fall, 2.2));
  // the air on top: a thin, brighter band a little ahead
  const air = bp(noise(sec, seed + 1), (t) => sweep(t) * 2.6, 2.2);
  env(air, bell(rise * 0.9, fall * 0.8, 3));
  // weight underneath: lowpassed noise, the push of the move
  const low = lp(noise(sec, seed + 2, true), (t) => sweep(t) * 0.35, 0.9);
  env(low, bell(rise, fall * 0.7, 2));
  const dry = buf(sec);
  mixInto(dry, body, 1);
  mixInto(dry, air, 0.35);
  mixInto(dry, low, 0.8);
  finish(name, stereo(dry, { wet: 0.12, roomOpts: { size: 0.6, seconds: 0.25 }, pan: (t) => lerp(-0.55, 0.55, clamp01(t / sec)), width: 0.4 }), { peakDb: -1, fadeOut: 0.04 });
}

function impact() {
  const sec = 0.95;
  // sub: a sine dropping from 92 to 40 Hz, a fast attack and a short bloom
  const sub = sine(sec, (t) => 40 + 52 * Math.exp(-t * 14));
  env(sub, ad(0.004, 0.55));
  // the body: lowpassed noise, the "thud" of something landing
  const body = lp(noise(sec, 11, true), (t) => 900 * Math.exp(-t * 18) + 120, 0.8);
  env(body, ad(0.002, 0.16));
  // the transient: a short bright click so it reads on phone speakers
  const click = hp(noise(0.03, 12), 2400, 0.7);
  env(click, ad(0.0005, 0.018));
  // a low mid knock, so small speakers hear the weight
  const knock = sine(sec, (t) => 140 * Math.exp(-t * 6) + 70);
  env(knock, ad(0.002, 0.12));
  const dry = buf(sec);
  mixInto(dry, sat(sub, 1.4), 1);
  mixInto(dry, body, 0.55);
  mixInto(dry, click, 0.22);
  mixInto(dry, knock, 0.35);
  finish("impact", stereo(dry, { wet: 0.1, roomOpts: { size: 0.68, damp: 0.5, seconds: 0.35 } }), { peakDb: -1, fadeOut: 0.12 });
}

function tap() {
  const sec = 0.16;
  // a glassy tick: a short sine falling from 2.2 to 1.5 kHz
  const tick = sine(sec, (t) => 1500 + 700 * Math.exp(-t * 90));
  env(tick, ad(0.0008, 0.035));
  // the click: very short, high, crisp
  const click = hp(noise(0.02, 21), 3500, 0.8);
  env(click, ad(0.0003, 0.008));
  // a soft finger thump underneath
  const thump = sine(sec, (t) => 220 * Math.exp(-t * 20) + 120);
  env(thump, ad(0.001, 0.04));
  const dry = buf(sec);
  mixInto(dry, tick, 0.5);
  mixInto(dry, click, 0.45);
  mixInto(dry, thump, 0.6);
  finish("tap", stereo(dry, { wet: 0.06, roomOpts: { size: 0.5, seconds: 0.12 } }), { peakDb: -1, fadeOut: 0.03 });
}

function pop() {
  const sec = 0.32;
  // the pop: a round bubble, pitch springing up fast
  const bubble = sine(sec, (t) => 260 + 620 * (1 - Math.exp(-t * 70)));
  env(bubble, ad(0.0015, 0.075));
  // the snap: a band of noise around 3 kHz, very short
  const snap = bp(noise(0.05, 31), 3200, 1.4);
  env(snap, ad(0.0004, 0.014));
  // weight: the piece settling onto the felt
  const body = sine(sec, (t) => 150 * Math.exp(-t * 10) + 90);
  env(body, ad(0.002, 0.06));
  // a tiny high glint so it feels satisfying
  const glint = sine(sec, () => 2400);
  env(glint, ad(0.002, 0.09, 0.012));
  const dry = buf(sec);
  mixInto(dry, bubble, 0.7);
  mixInto(dry, snap, 0.5);
  mixInto(dry, body, 0.55);
  mixInto(dry, glint, 0.08);
  finish("pop", stereo(dry, { wet: 0.1, roomOpts: { size: 0.55, seconds: 0.18 }, width: 0.3 }), { peakDb: -1, fadeOut: 0.05 });
}

/** Bell partials, staggered like light catching on rhinestones. */
function bells(sec, seed, notes, { spread = 0.06, decay = 0.6, start = 0 } = {}) {
  const r = rng(seed);
  const out = buf(sec);
  notes.forEach((f0, k) => {
    const delay = start + k * spread + r() * 0.01;
    // a bell: fundamental plus inharmonic partials, each decaying faster
    for (const [mult, amp, dmul] of [[1, 1, 1], [2.76, 0.35, 0.6], [5.4, 0.12, 0.35], [8.93, 0.05, 0.25]]) {
      const f = f0 * mult * (1 + (r() - 0.5) * 0.002);
      const s = sine(sec, () => f, r() * TAU);
      env(s, ad(0.002, decay * dmul, delay));
      mixInto(out, s, amp / notes.length);
    }
  });
  return out;
}

function shimmer() {
  const sec = 1.3;
  const dry = buf(sec);
  // a major add9 sparkle, high: E7 B6 G#7 F#7 B7 (gentle, not shrill)
  mixInto(dry, bells(sec, 41, [2637, 1976, 3322, 2960, 3951], { spread: 0.055, decay: 0.75 }), 1);
  // air: a breath of high noise that swells and fades with the sparkle
  const air = hp(noise(sec, 42), 7000, 0.7);
  env(air, bell(0.12, 0.7, 2));
  mixInto(dry, air, 0.05);
  finish("shimmer", stereo(lp(dry, 11000), { wet: 0.35, roomOpts: { size: 0.82, damp: 0.25, seconds: 0.8 }, pan: (t) => Math.sin(t * 9) * 0.35, width: 0.6 }), { peakDb: -1, fadeOut: 0.25 });
}

function riser() {
  const sec = 1.6;
  const curve = (t) => Math.pow(clamp01(t / sec), 2.2);
  // noise rising through a narrowing band, getting louder
  const wash = bp(noise(sec, 51, true), (t) => lerp(280, 6500, curve(t)), (t) => lerp(0.8, 2.4, clamp01(t / sec)));
  env(wash, (t) => lerp(0.05, 1, curve(t)));
  // a tone climbing two octaves underneath, softened by a lowpass, with a
  // vibrato that speeds up (tension)
  let vib = 0;
  const toneRaw = buf(sec);
  {
    let p1 = 0, p2 = 0;
    for (let i = 0; i < toneRaw.length; i++) {
      const t = i / SR;
      vib += (TAU * lerp(4, 11, t / sec)) / SR;
      const f = lerp(110, 440, Math.pow(t / sec, 1.7)) * (1 + Math.sin(vib) * 0.006);
      p1 += (TAU * f) / SR;
      p2 += (TAU * f * 1.5) / SR;
      // a soft saw-ish blend of a few harmonics
      toneRaw[i] = Math.sin(p1) + 0.4 * Math.sin(2 * p1) + 0.2 * Math.sin(3 * p1) + 0.35 * Math.sin(p2);
    }
  }
  const tone = lp(toneRaw, (t) => lerp(500, 3800, curve(t)), 0.9);
  env(tone, (t) => lerp(0.0, 0.8, Math.pow(clamp01(t / sec), 1.5)));
  const dry = buf(sec);
  mixInto(dry, wash, 1);
  mixInto(dry, tone, 0.18);
  // it stops dead into the hit: a short fade, no tail
  finish("riser", stereo(dry, { wet: 0.15, roomOpts: { size: 0.7, seconds: 0.05 }, pan: (t) => Math.sin(t * 5) * 0.2, width: 0.5 }), { peakDb: -1, fadeOut: 0.02 });
}

function logoHit() {
  const sec = 2.4;
  const sub = sine(sec, (t) => 34 + 48 * Math.exp(-t * 9));
  env(sub, ad(0.004, 1.1));
  const body = lp(noise(sec, 61, true), (t) => 1400 * Math.exp(-t * 10) + 140, 0.8);
  env(body, ad(0.002, 0.3));
  const click = hp(noise(0.04, 62), 2000, 0.7);
  env(click, ad(0.0005, 0.025));
  const knock = sine(sec, (t) => 160 * Math.exp(-t * 5) + 80);
  env(knock, ad(0.002, 0.2));
  // the bright tail: an octave stack of bells, and air
  const tail = bells(sec, 63, [1318.5, 1976, 2637, 3136], { spread: 0.03, decay: 1.4, start: 0.01 });
  const air = hp(noise(sec, 64), 6000, 0.7);
  env(air, ad(0.01, 1.0));
  const dry = buf(sec);
  mixInto(dry, sat(sub, 1.5), 1);
  mixInto(dry, body, 0.5);
  mixInto(dry, click, 0.25);
  mixInto(dry, knock, 0.35);
  mixInto(dry, tail, 0.42);
  mixInto(dry, air, 0.03);
  finish("logo-hit", stereo(dry, { wet: 0.22, roomOpts: { size: 0.84, damp: 0.3, seconds: 1.0 }, width: 0.35 }), { peakDb: -1, fadeOut: 0.4 });
}

mkdirSync(DIR, { recursive: true });
console.log("Sound effects for the guide ad (public/sfx):");
whoosh("whoosh-short", 0.45, 1, { lo: 380, hi: 3400, end: 900, peakAt: 0.42 });
whoosh("whoosh-long", 1.0, 2, { lo: 240, hi: 2600, end: 550, peakAt: 0.5 });
impact();
tap();
pop();
shimmer();
riser();
logoHit();
console.log("Done.");
