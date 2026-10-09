// ---------------------------------------------------------------------------
// What the two screenshot scripts share (capture.mjs for the portal demo,
// capture-ad.mjs for the hat builder ad): building and serving the site,
// a phone sized Playwright page with a pinned clock, and a shot() that waits
// until the page is completely still, so every run makes the same pictures.
// ---------------------------------------------------------------------------

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUPABASE_URL, demoData, fakeSupabase } from "../fake-supabase.mjs";

export const VIDEO = fileURLToPath(new URL("../..", import.meta.url));
export const ROOT = path.resolve(VIDEO, "..");
export const BUILD = path.join(VIDEO, ".app-build");
export const PORT = 4180;
export const BASE = `http://localhost:${PORT}`;
export const TZ = "America/Denver";
// a Friday morning in El Paso; every date in the demo is relative to it
export const DEMO_NOW = Date.parse(process.env.DEMO_NOW || "2026-10-09T09:30:00-06:00");
export const VIEW = { width: 390, height: 844 };
export const SCALE = 2;
export const HEADER = 72; // the site's and the portal's sticky bars

export const log = (...a) => console.log(...a);

// ---- build and serve -------------------------------------------------------------------
export function build() {
  log("Building the site into video/.app-build ...");
  const vite = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const r = spawnSync(process.execPath, [vite, "build", "--outDir", BUILD, "--emptyOutDir"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      // public, pretend values: the browser only ever talks to the fake Supabase
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: "demo-anon-key",
      VITE_BOOKING_ENDPOINT: "https://script.google.com/macros/s/DEMO/exec",
    },
  });
  if (r.status !== 0) throw new Error("the site did not build (run npm install in the repository root first)");
}

export async function serve() {
  const vite = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [vite, "preview", "--outDir", BUILD, "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error(`the preview server did not start on port ${PORT}`);
}

// ---- waiting for a still page ---------------------------------------------------------------
export async function settle(page, ms = 400) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  // a picture that failed (a slow CDN, a flaky network) gets two more tries
  for (let round = 0; round < 3; round++) {
    const broken = await page.evaluate(() => {
      const bad = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src);
      for (const i of bad) {
        const src = i.src;
        i.src = "";
        i.src = src;
      }
      return bad.length;
    });
    if (!broken) break;
    await page.waitForTimeout(1500);
  }
  await page.evaluate(async () => {
    await Promise.all(
      ["400 40px 'Alfa Slab One'", "400 16px Satoshi", "500 16px Satoshi", "700 16px Satoshi", "900 16px Satoshi"].map((f) => document.fonts.load(f).catch(() => null))
    );
    await document.fonts.ready;
    const imgs = [...document.images].filter((i) => i.getBoundingClientRect().bottom > 0 && i.getBoundingClientRect().top < innerHeight);
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r), setTimeout(r, 8000))))));
    // drawers sliding in, fades: wait until every one has finished
    const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations !== Infinity);
    await Promise.race([Promise.all(running.map((a) => a.finished.catch(() => null))), new Promise((r) => setTimeout(r, 3000))]);
  });
  await page.waitForTimeout(ms);
}

/** Where an element sits on the current screen, in CSS pixels (390 wide). */
export async function box(page, selector) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`nothing on screen for ${selector}`);
  return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
}

/** Scroll so `selector` starts `offset` pixels from the top. */
export async function scrollTo(page, selector, offset = HEADER + 8) {
  // twice: pictures above it can finish loading and move it after the first
  for (let i = 0; i < 2; i++) {
    await settle(page, 150);
    await page.evaluate(
      ([sel, off]) => {
        const el = document.querySelector(sel);
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "instant" });
      },
      [selector, offset]
    );
  }
  await page.waitForTimeout(300);
}

/**
 * shot(page, name, boxes, { element }) for one output folder. Writes
 * <dir>/<name>.png and records it in `manifest.shots[name]` with the boxes
 * (CSS pixel rectangles of the given selectors) the video points at.
 */
export function shooter({ dir, urlPrefix, manifest }) {
  return async function shot(page, name, boxes = {}, { element } = {}) {
    // no focus ring or hover state that only shows on some runs
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(-10, -10);
    await settle(page);
    const file = `${name}.png`;
    const marks = {};
    for (const [k, sel] of Object.entries(boxes)) marks[k] = await box(page, sel);
    if (element) {
      const b = await page.locator(element).first().boundingBox();
      await page.locator(element).first().screenshot({ path: path.join(dir, file), animations: "disabled" });
      manifest.shots[name] = { file: `${urlPrefix}${file}`, width: Math.round(b.width), height: Math.round(b.height), boxes: marks };
    } else {
      await page.screenshot({ path: path.join(dir, file), animations: "disabled" });
      manifest.shots[name] = { file: `${urlPrefix}${file}`, width: VIEW.width, height: VIEW.height, boxes: marks };
    }
    log(`  ${file}`);
  };
}

// ---- the page ----------------------------------------------------------------------------------
const cdnCache = new Map();
async function cachedFetch(route) {
  const url = route.request().url();
  let hit = cdnCache.get(url);
  for (let attempt = 0; !hit && attempt < 4; attempt++) {
    try {
      const res = await route.fetch({ timeout: 20000 });
      if (res.ok()) hit = { status: res.status(), headers: res.headers(), body: await res.body() };
    } catch {
      /* try again */
    }
    if (!hit) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  if (!hit) return route.abort();
  cdnCache.set(url, hit);
  return route.fulfill({ status: hit.status, headers: { ...hit.headers, "access-control-allow-origin": "*" }, body: hit.body });
}

/** A phone sized page with a pinned clock; Supabase is answered by the demo fake. */
export async function newPage(browser) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    timezoneId: TZ,
    // some networks (proxies, the sandbox this was written in) re-sign HTTPS;
    // the only outside requests are fonts and the hat images
    ignoreHTTPSErrors: true,
  });
  // fonts and hat pictures come from CDNs: fetched once, retried if the network
  // hiccups, and served with a CORS header (some proxies strip it), so every
  // shot gets the brand fonts and every hat picture
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|api\.fontshare\.com|cdn\.fontshare\.com|res\.cloudinary\.com/, cachedFetch);
  // the booking form's two requests: the Google Sheet and the portal copy
  await ctx.route("https://script.google.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"ok":true}' }));
  await ctx.route("**/api/booking", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"stored":true}' }));
  // analytics never runs for the shots
  await ctx.route("**/_vercel/**", (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(DEMO_NOW);
  page.on("pageerror", (e) => log(`  page error: ${e.message}`));
  const sb = fakeSupabase(demoData(DEMO_NOW), { now: DEMO_NOW });
  await page.route(`${SUPABASE_URL}/**`, sb.handler);
  return { ctx, page, sb };
}

/** The landing's hero video, held on its first frame (a cowgirl in her hat). */
export async function holdHeroVideo(page) {
  await page
    .waitForFunction(
      () => {
        const v = document.querySelector("video.tc-hero-video");
        return !v || v.readyState >= 2;
      },
      null,
      { timeout: 12000 }
    )
    .catch(() => {});
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector("video.tc-hero-video");
        if (!v || !v.duration) return resolve();
        v.pause();
        v.addEventListener("seeked", () => resolve(), { once: true });
        v.currentTime = 0.05;
        setTimeout(resolve, 4000);
      })
  );
}
