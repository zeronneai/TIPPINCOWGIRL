// Helpers for /admin/content. The day math is pure (tested in
// tests/content.test.mjs); the overlay drawing and burning run in the
// browser: one function draws the live preview and the final video, so what
// the staff sees is exactly what gets posted.

export const TZ = "America/Denver";
export const OVERLAY_STYLES = { shadow: "White", box: "White box", dark: "Dark box", coral: "Coral box" };
export const POSITIONS = { top: "Top", center: "Middle", bottom: "Bottom" };
export const CAPTION_KIND = { largo: "Long", corto: "Short", directo: "No call to action", editor: "From the editor" };
export const POST_STATUS = { waiting_media: "Scheduled", scheduled: "Scheduled", published: "Posted", partial: "Posted", failed: "Did not post", canceled: "Canceled" };
const FONT = "Satoshi";
const MAX_MB = 50; // Roots Engine storage limit per file

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** YYYY-MM-DD of an instant, in El Paso time. */
export const ymdTz = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
export const todayTz = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: TZ });
export const dayLabel = (k, o = { weekday: "short", month: "short", day: "numeric" }) => new Date(`${k}T12:00:00`).toLocaleDateString("en-US", o);
export const whenLabel = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const firstLine = (s) => String(s || "").split("\n").find((l) => l.trim()) || "No copy yet";

/** The next n days, today included (any day of the week). */
export function nextDays(today, n = 14) {
  const out = [];
  const d = new Date(`${today}T12:00:00`);
  for (let k = 0; k < n; k++) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Days already used by another video: approved with a day, or scheduled and posted. */
export function takenDays(items, exceptId) {
  const t = new Set();
  for (const i of items || []) {
    if (i.id === exceptId) continue;
    if (i.status === "approved" && i.postOn) t.add(i.postOn);
    if (i.post?.at) t.add(ymdTz(i.post.at));
  }
  return t;
}

/** The first free day, skipping the ones other drafts already picked. */
export function defaultDay(days, taken, others = new Set()) {
  return days.find((x) => !taken.has(x) && !others.has(x)) || days.find((x) => !taken.has(x)) || null;
}

/** Month grid: 5 or 6 weeks of YYYY-MM-DD, Sunday first. */
export function monthGrid(month) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = [];
  for (let n = 0; n < 42; n++) {
    const d = new Date(start);
    d.setDate(start.getDate() + n);
    if (n >= 35 && d.getMonth() !== m - 1) break;
    cells.push({ key: ymd(d), day: d.getDate(), inMonth: d.getMonth() === m - 1 });
  }
  return cells;
}
export function shiftMonth(month, by) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ---- text on the video ----------------------------------------------------------------------
function wrap(ctx, text, max) {
  const out = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > max && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** o = { text, style, position }. t = current second (fades in during the first quarter second). */
export function drawOverlay(ctx, w, h, o, t) {
  const text = String(o.text || "").trim();
  if (!text) return;
  const alpha = Math.min(1, Math.max(0, t / 0.25));
  if (alpha <= 0) return;
  const fs = Math.round(Math.min(w, h * 0.5625) * 0.072);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${fs}px "${FONT}", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text, w * 0.82);
  const lh = fs * 1.24;
  const block = lh * lines.length;
  const cy = o.position === "top" ? h * 0.17 + block / 2 : o.position === "center" ? h * 0.45 : h * 0.72 - block / 2;
  const bg = { box: "#ffffff", dark: "rgba(43,26,16,0.86)", coral: "#e8674a" }[o.style];
  const fg = o.style === "box" ? "#2b1a10" : "#ffffff";
  lines.forEach((line, i) => {
    const y = cy - block / 2 + lh * (i + 0.5);
    if (bg) {
      const tw = ctx.measureText(line).width;
      const px = fs * 0.42;
      ctx.fillStyle = bg;
      roundRect(ctx, w / 2 - tw / 2 - px, y - lh / 2 - fs * 0.02, tw + px * 2, lh + fs * 0.04, fs * 0.22);
      ctx.fill();
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.75)";
      ctx.shadowBlur = fs * 0.35;
      ctx.shadowOffsetY = fs * 0.06;
    }
    ctx.fillStyle = fg;
    ctx.fillText(line, w / 2, y);
    ctx.shadowColor = "transparent";
  });
  ctx.restore();
}

/** Burns the text into the video (1080 on the short side at most, sized for the upload limit). */
export async function burnText(file, o, onProgress) {
  await document.fonts.load(`700 40px ${FONT}`).catch(() => {});
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const duration = await input.computeDuration();
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(duration > 0)) throw new Error("Could not read the video");
  const short = Math.min(track.displayWidth, track.displayHeight);
  const k = short > 1080 ? 1080 / short : 1;
  const W = Math.round((track.displayWidth * k) / 2) * 2;
  const H = Math.round((track.displayHeight * k) / 2) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const videoBps = Math.max(1_500_000, Math.min(10_000_000, (MAX_MB * 1e6 * 0.85 * 8) / duration - 160_000));
  const avc = await mb.canEncodeVideo("avc", { width: W, height: H }).catch(() => false);
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({
    input,
    output,
    video: {
      width: W,
      height: H,
      fit: "fill",
      allowTransformationMetadata: false,
      forceTranscode: true,
      quality: new mb.Quality({ bitrate: Math.round(videoBps) }),
      ...(avc ? { codec: "avc" } : {}),
      process: (sample) => {
        ctx.clearRect(0, 0, W, H);
        sample.draw(ctx, 0, 0, W, H);
        drawOverlay(ctx, W, H, o, sample.timestamp);
        return canvas;
      },
      processedWidth: W,
      processedHeight: H,
    },
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error("This browser cannot add text to the video. Try Chrome on a computer.");
  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();
  const buf = output.target.buffer;
  if (!buf) throw new Error("Could not create the video with text");
  return new Blob([buf], { type: "video/mp4" });
}
