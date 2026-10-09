// ---------------------------------------------------------------------------
// Loudness for the guide ad's mix, in plain JavaScript (the ffmpeg that
// ships with Remotion has no limiter):
//
//   measure()   integrated loudness per ITU-R BS.1770-4 / EBU R128 (LUFS):
//               K-weighting, 400 ms blocks, absolute and relative gates;
//               and the true peak (4x oversampled), in dBTP
//   master()    gain to a target loudness through a look-ahead true-peak
//               limiter (smooth, no clipping), repeated until it lands
//
// WAV in and out (16 or 24 bit PCM, or 32 bit float).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from "node:fs";

export function readWav(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error(`${file} is not a WAV file`);
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= b.length) {
    const id = b.toString("ascii", pos, pos + 4);
    let size = b.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") fmt = { format: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), rate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    if (id === "data") {
      if (!fmt) throw new Error("WAV data before its format");
      // some writers leave the size at 0 or too large when streaming: use what is there
      if (!size || body + size > b.length) size = b.length - body;
      const bytes = fmt.bits / 8;
      const frames = Math.floor(size / (bytes * fmt.channels));
      const ch = Array.from({ length: fmt.channels }, () => new Float64Array(frames));
      const float = fmt.format === 3;
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < fmt.channels; c++) {
          const o = body + (i * fmt.channels + c) * bytes;
          let v;
          if (float) v = b.readFloatLE(o);
          else if (fmt.bits === 16) v = b.readInt16LE(o) / 32768;
          else if (fmt.bits === 24) v = b.readIntLE(o, 3) / 8388608;
          else if (fmt.bits === 32) v = b.readInt32LE(o) / 2147483648;
          else throw new Error(`${fmt.bits} bit WAV files are not supported`);
          ch[c][i] = v;
        }
      }
      return { rate: fmt.rate, ch };
    }
    pos = body + size + (size % 2);
  }
  throw new Error(`${file} has no audio data`);
}

/** 24 bit PCM, with triangular dither. */
export function writeWav(file, { rate, ch }) {
  const n = ch[0].length;
  const C = ch.length;
  const data = Buffer.alloc(n * C * 3);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < C; c++) {
      const d = (rnd() - rnd()) / 8388608;
      const s = Math.max(-8388608, Math.min(8388607, Math.round((ch[c][i] + d) * 8388607)));
      data.writeIntLE(s, (i * C + c) * 3, 3);
    }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(C, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * C * 3, 28);
  h.writeUInt16LE(C * 3, 32);
  h.writeUInt16LE(24, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

// ---- BS.1770 ----------------------------------------------------------------------------------------------
function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

/** The K-weighting filters for any sample rate (the same design as pyloudnorm / libebur128). */
function kFilters(rate) {
  // high shelf
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / rate);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  // high pass
  f0 = 38.13547087602444; Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / rate);
  a0 = 1 + K / Q + K * K;
  const hp = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  return [shelf, hp];
}

export function integratedLoudness({ rate, ch }) {
  const [shelf, hp] = kFilters(rate);
  const z = ch.map((x) => biquad(biquad(x, shelf), hp));
  const block = Math.round(0.4 * rate);
  const hop = Math.round(0.1 * rate);
  const powers = [];
  for (let s = 0; s + block <= z[0].length; s += hop) {
    let p = 0;
    for (const c of z) {
      let sum = 0;
      for (let i = s; i < s + block; i++) sum += c[i] * c[i];
      p += sum / block; // channel weights are 1 for left and right
    }
    powers.push(p);
  }
  const L = (p) => -0.691 + 10 * Math.log10(p);
  const abs = powers.filter((p) => L(p) > -70);
  if (!abs.length) return -Infinity;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = L(mean(abs)) - 10;
  const gated = abs.filter((p) => L(p) > rel);
  return L(mean(gated));
}

/**
 * The true peak envelope: for each sample, the highest of the signal
 * between it and the next one, found by 4x oversampling (windowed sinc).
 */
function truePeakEnvelope(x) {
  const taps = 12;
  const phases = [0.25, 0.5, 0.75].map((ph) => {
    const k = [];
    for (let t = -taps + 1; t <= taps; t++) {
      const d = t - ph;
      const sinc = Math.sin(Math.PI * d) / (Math.PI * d);
      const w = 0.5 * (1 + Math.cos((Math.PI * d) / (taps + 0.5)));
      k.push(sinc * w);
    }
    return k;
  });
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let m = Math.abs(x[i]);
    for (const k of phases) {
      let v = 0;
      for (let j = 0; j < k.length; j++) {
        const idx = i + j - taps + 1;
        if (idx >= 0 && idx < x.length) v += k[j] * x[idx];
      }
      m = Math.max(m, Math.abs(v));
    }
    out[i] = m;
  }
  return out;
}

export function truePeak({ ch }) {
  let m = 0;
  for (const c of ch) for (const v of truePeakEnvelope(c)) m = Math.max(m, v);
  return 20 * Math.log10(m || 1e-12);
}

export const measure = (audio) => ({ lufs: integratedLoudness(audio), tp: truePeak(audio) });

/**
 * Gain to `lufs`, with a look-ahead limiter holding true peaks under
 * `ceiling` dBTP: it sees a peak coming 5 ms early, turns down smoothly,
 * and lets go over 120 ms, so nothing clips and nothing pumps.
 */
function limit({ rate, ch }, gainDb, ceiling) {
  const g = Math.pow(10, gainDb / 20);
  const c = Math.pow(10, ceiling / 20);
  const n = ch[0].length;
  const env = new Float64Array(n);
  for (const x of ch) {
    const tp = truePeakEnvelope(x);
    for (let i = 0; i < n; i++) env[i] = Math.max(env[i], tp[i] * g);
  }
  const look = Math.round(0.005 * rate);
  const rel = Math.exp(-1 / (0.12 * rate));
  // the gain each sample needs, then the lowest ahead of it (look-ahead)
  const need = new Float64Array(n);
  for (let i = 0; i < n; i++) need[i] = env[i] > c ? c / env[i] : 1;
  const ahead = new Float64Array(n);
  const dq = [];
  for (let i = n - 1; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + look) dq.shift();
    ahead[i] = need[dq[0]];
  }
  // the turn down: a moving average of the look-ahead minimum. Every value
  // averaged is already at or under what the peak needs, so no peak gets
  // through, and the gain ramps down over 5 ms instead of jumping.
  const avg = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += ahead[i] - (i >= look ? ahead[i - look] : 0);
    avg[i] = (acc + Math.max(0, look - i - 1)) / look;
  }
  // the let go: back up slowly (never above what the average allows)
  const gain = new Float64Array(n);
  let cur = 1;
  for (let i = 0; i < n; i++) {
    cur = avg[i] < cur ? avg[i] : avg[i] + (cur - avg[i]) * rel;
    gain[i] = cur;
  }
  return { rate, ch: ch.map((x) => x.map((v, i) => v * g * gain[i])) };
}

export function master(audio, { lufs = -14, ceiling = -1.5 } = {}) {
  let gainDb = lufs - integratedLoudness(audio);
  let out = audio;
  for (let round = 0; round < 6; round++) {
    out = limit(audio, gainDb, ceiling);
    const l = integratedLoudness(out);
    if (Math.abs(l - lufs) < 0.1) break;
    gainDb += lufs - l;
  }
  return out;
}
