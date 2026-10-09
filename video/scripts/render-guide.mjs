// ---------------------------------------------------------------------------
// Renders one version of the guided journey ad, with its sound mixed to
// about -14 LUFS (the level Reels, TikTok and YouTube play at) and no clipping.
//
//   npm run render:guide-a     out/tippin-guide-30s-a.mp4
//   npm run render:guide-b     out/tippin-guide-30s-b.mp4
//   npm run render:guide-c     out/tippin-guide-30s-c.mp4
//   npm run render:guide15     out/tippin-guide-15s.mp4
//
// Steps: the pictures (silent), the sound on its own (WAV), the sound
// brought to -14 LUFS through a look-ahead true-peak limiter (ceiling
// -1.5 dBTP; scripts/lib/loudness.mjs), then both put together and the
// result measured again as it will play (AAC decoded back). A file over 20 MB
// also gets a smaller preview copy in out/previews/ for sending. The silent
// picture is kept in out/.guide/ so `--reuse-picture` can redo only the sound.
// Uses the ffmpeg that ships with Remotion: nothing else to install.
// ---------------------------------------------------------------------------

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { master, measure, readWav, writeWav } from "./lib/loudness.mjs";

const VIDEO = fileURLToPath(new URL("..", import.meta.url));
const cut = process.argv[2];
if (!["a", "b", "c", "15"].includes(cut)) {
  console.error("Usage: node scripts/render-guide.mjs a|b|c|15");
  process.exit(1);
}
const id = `ad-guide-${cut}`;
const name = cut === "15" ? "tippin-guide-15s" : `tippin-guide-30s-${cut}`;
const OUT = path.join(VIDEO, "out");
const WORK = path.join(OUT, ".guide");
// the limiter's ceiling sits a little under the -1 dBTP streaming limit: the
// AAC encode adds about half a dB of peak back
const TARGET = { I: -14, TP: -2 };
const PREVIEW_MB = 19.5;

const remotion = path.join(VIDEO, "node_modules", ".bin", process.platform === "win32" ? "remotion.cmd" : "remotion");
function run(cmd, args, { capture = false, env } = {}) {
  const r = spawnSync(cmd, args, { cwd: VIDEO, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env } });
  if (r.status !== 0) {
    if (capture) console.error(r.stderr?.slice(-3000));
    throw new Error(`${path.basename(cmd)} ${args.slice(0, 2).join(" ")} failed`);
  }
  return capture ? `${r.stdout}\n${r.stderr}` : "";
}
const ffmpeg = (args, opts) => run(remotion, ["ffmpeg", "-hide_banner", "-y", ...args], opts);

mkdirSync(WORK, { recursive: true });
const silent = path.join(WORK, `${name}-picture.mp4`);
const wav = path.join(WORK, `${name}-sound.wav`);
const final = path.join(OUT, `${name}.mp4`);

console.log(`\n${id}: fonts, hat art and sound effects`);
run(process.execPath, ["scripts/fetch-fonts.mjs"]);
run(process.execPath, ["scripts/prepare-ad.mjs"]);
// the synthesized effects only if one is missing: never over your own sounds
const SFX = ["whoosh-short", "whoosh-long", "impact", "tap", "pop", "shimmer", "riser", "logo-hit"];
if (SFX.some((s) => !existsSync(path.join(VIDEO, "public", "sfx", `${s}.wav`)))) run(process.execPath, ["scripts/synth-sfx.mjs"]);

// --reuse-picture: keep the pictures from the last run (when only the sound changed)
if (!(process.argv.includes("--reuse-picture") && existsSync(silent))) {
  console.log(`\n${id}: the pictures`);
  run(remotion, ["render", "src/index.ts", id, silent, "--muted"]);
}
console.log(`\n${id}: the sound`);
run(remotion, ["render", "src/index.ts", id, wav, "--codec=wav"], { env: { REMOTION_AUDIO_ONLY: "1" } });

console.log(`\n${id}: loudness to ${TARGET.I} LUFS, true peak under ${TARGET.TP} dBTP`);
const mix = readWav(wav);
const before = measure(mix);
console.log(`  as mixed: ${before.lufs.toFixed(1)} LUFS, true peak ${before.tp.toFixed(1)} dBTP`);
const mastered = path.join(WORK, `${name}-master.wav`);
writeWav(mastered, master(mix, { lufs: TARGET.I, ceiling: TARGET.TP }));
ffmpeg(["-i", silent, "-i", mastered, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", final], { capture: true });
// check the file as it will be played: decode its AAC back and measure
const check = path.join(WORK, `${name}-check.wav`);
ffmpeg(["-i", final, "-vn", "-c:a", "pcm_s16le", check], { capture: true });
const after = measure(readWav(check));
console.log(`  final:    ${after.lufs.toFixed(1)} LUFS, true peak ${after.tp.toFixed(1)} dBTP`);
rmSync(check, { force: true });
rmSync(mastered, { force: true });

const mb = statSync(final).size / 1e6;
console.log(`\nDone: out/${name}.mp4 (${mb.toFixed(1)} MB)`);
if (mb > PREVIEW_MB) {
  const dur = cut === "15" ? 15 : 30;
  const kbps = Math.floor(((PREVIEW_MB * 8e6) / dur) / 1000) - 256 - 150;
  mkdirSync(path.join(OUT, "previews"), { recursive: true });
  const prev = path.join(OUT, "previews", `${name}-preview.mp4`);
  ffmpeg(["-i", final, "-c:v", "libx264", "-preset", "slow", "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.4)}k`, "-bufsize", `${kbps * 2}k`, "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-c:a", "copy", "-movflags", "+faststart", prev], { capture: true });
  console.log(`Preview: out/previews/${name}-preview.mp4 (${(statSync(prev).size / 1e6).toFixed(1)} MB)`);
}
rmSync(wav, { force: true });
