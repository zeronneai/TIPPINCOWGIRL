// ---------------------------------------------------------------------------
// Screenshots for the demo video, from the real app running on this computer.
//
//   cd video && npm run shots
//
// 1. Builds the site into video/.app-build with a pretend Supabase project
//    and booking endpoint (no keys; nothing real is ever contacted).
// 2. Serves it with `vite preview` on http://localhost:4180.
// 3. Opens it in Playwright at phone size (390x844 at 2x) and walks
//    through the site and the staff portal, answering every Supabase call
//    from scripts/fake-supabase.mjs (demo orders and bookings only, emails
//    ending in @demo.tippin) with "Include demo data" switched on.
// 4. Writes PNGs to video/public/shots/ and video/src/shots.json: where
//    the highlighted elements are on each shot, plus the numbers the
//    video counts up to.
//
// The clock is pinned (DEMO_NOW below) and the time zone fixed, so running
// it again makes the same shots. Needs the app's own dependencies
// (npm install in the repository root) and a Playwright Chromium
// (npx playwright install chromium, once).
// ---------------------------------------------------------------------------

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { kpis, bookingMonths, weekly } from "../../src/admin/stats.js";
import { SUPABASE_URL, STAFF, demoData, fakeSupabase } from "./fake-supabase.mjs";

const VIDEO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = path.resolve(VIDEO, "..");
const BUILD = path.join(VIDEO, ".app-build");
const SHOTS = path.join(VIDEO, "public", "shots");
const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const TZ = "America/Denver";
// a Friday morning in El Paso; every date in the demo is relative to it
const DEMO_NOW = Date.parse(process.env.DEMO_NOW || "2026-10-09T09:30:00-06:00");
const VIEW = { width: 390, height: 844 };
const SCALE = 2;
const HEADER = 72; // the site's and the portal's sticky bars

const log = (...a) => console.log(...a);

// ---- build and serve -------------------------------------------------------------------
function build() {
  log("Building the site into video/.app-build ...");
  const vite = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const r = spawnSync(process.execPath, [vite, "build", "--outDir", BUILD, "--emptyOutDir"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      // public, pretend values: the browser only ever talks to the fake below
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: "demo-anon-key",
      VITE_BOOKING_ENDPOINT: "https://script.google.com/macros/s/DEMO/exec",
    },
  });
  if (r.status !== 0) throw new Error("the site did not build (run npm install in the repository root first)");
}

async function serve() {
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

// ---- helpers ---------------------------------------------------------------------------
const manifest = { viewport: { ...VIEW, scale: SCALE }, shots: {}, data: {} };

async function settle(page, ms = 400) {
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
async function box(page, selector) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`nothing on screen for ${selector}`);
  return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10);
}

/** Scroll so `selector` starts just under the sticky header. */
async function scrollTo(page, selector, offset = HEADER + 8) {
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

async function shot(page, name, boxes = {}, { element } = {}) {
  // no focus ring or hover state that only shows on some runs
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(-10, -10);
  await settle(page);
  const file = `${name}.png`;
  const marks = {};
  for (const [k, sel] of Object.entries(boxes)) marks[k] = await box(page, sel);
  if (element) {
    const b = await page.locator(element).first().boundingBox();
    await page.locator(element).first().screenshot({ path: path.join(SHOTS, file), animations: "disabled" });
    manifest.shots[name] = { file: `shots/${file}`, width: Math.round(b.width), height: Math.round(b.height), boxes: marks };
  } else {
    await page.screenshot({ path: path.join(SHOTS, file), animations: "disabled" });
    manifest.shots[name] = { file: `shots/${file}`, width: VIEW.width, height: VIEW.height, boxes: marks };
  }
  log(`  ${file}`);
}

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

async function newPage(browser, { signedIn = false } = {}) {
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
  if (signedIn) {
    await page.goto(`${BASE}/admin`);
    await page.fill("#admin-email", STAFF.email);
    await page.fill("#admin-password", "demo-password");
    await page.click('button[type="submit"]');
    await page.waitForSelector("[data-kpi]");
    if ((await page.getByTestId("demo-toggle").getAttribute("aria-checked")) !== "true") await page.getByTestId("demo-toggle").click();
    await page.waitForTimeout(300);
  }
  return { ctx, page, sb };
}

// ---- the public site ---------------------------------------------------------------------
async function site(browser) {
  log("The site");
  const { ctx, page } = await newPage(browser);
  await page.goto(BASE + "/");
  await page.waitForSelector("h1");
  // the hero is a video (its poster where video cannot play): wait for a frame
  await page
    .waitForFunction(() => {
      const v = document.querySelector("video.tc-hero-video");
      return !v || v.readyState >= 2;
    }, null, { timeout: 12000 })
    .catch(() => {});
  // hold the video on the same frame every time, so re-runs match
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const v = document.querySelector("video.tc-hero-video");
        if (!v || !v.duration) return resolve();
        v.pause();
        v.addEventListener("seeked", () => resolve(), { once: true });
        v.currentTime = 0.05; // the opening shot: a cowgirl in her hat
        setTimeout(resolve, 4000);
      })
  );
  await settle(page, 800);
  await shot(page, "site-hero", { title: "h1" });

  // the builder: wool, suede, straw, then accessories and engraving
  await page.waitForSelector('#builder [data-step="type"]');
  const opt = (id) => page.click(`#builder [data-option="${id}"]`);
  await scrollTo(page, ".tc-stage", HEADER - 4);
  await opt("type-wool");
  await opt("base-ivory");
  await shot(page, "builder-wool", { stage: ".tc-stage", choice: '#builder [data-option="type-wool"]' });
  await shot(page, "preview-wool", {}, { element: ".tc-stage" });

  await opt("type-suede");
  await opt("base-camel");
  await scrollTo(page, ".tc-stage", HEADER - 4);
  await shot(page, "builder-suede", { stage: ".tc-stage", choice: '#builder [data-option="type-suede"]' });
  await shot(page, "preview-suede", {}, { element: ".tc-stage" });

  await opt("type-straw");
  await scrollTo(page, ".tc-stage", HEADER - 4);
  await shot(page, "builder-straw", { stage: ".tc-stage", choice: '#builder [data-option="type-straw"]' });
  await shot(page, "preview-straw", {}, { element: ".tc-stage" });

  // back to wool for accessories and engraving (the demo's first order)
  await opt("type-wool");
  await opt("base-ivory");
  await opt("feather-natural");
  await opt("cord-stitching");
  await page.click('#builder [data-step="cord"] [data-color="rust"]');
  await scrollTo(page, '#builder [data-step="feather"]', HEADER + 370);
  await shot(page, "builder-accessories", { stage: ".tc-stage", choice: '#builder [data-option="feather-natural"]' });
  await shot(page, "preview-accessories", {}, { element: ".tc-stage" });

  // engraving shows best on a hat without the feather rosette over the front
  await opt("feather-none");
  await scrollTo(page, '#builder [data-step="engraving"]', HEADER + 370);
  await page.click('[data-engrave="open"]');
  await page.waitForSelector("[data-engraving-step]");
  await page.click('[data-engrave="mode-text"]').catch(() => {});
  await page.fill("#engrave-text", "VM");
  await page.click('[data-font="durango"]').catch(() => {});
  await page.click('[data-engrave="add-text"]');
  await page.click('[data-engrave="mode-stamp"]');
  await page.click('[data-engrave="position-left"]');
  await page.click('[data-stamp="horseshoe"]');
  await page.click('[data-engrave="stamp-size-small"]').catch(() => {});
  await page.click('[data-engrave="add-stamp"]');
  await page.waitForTimeout(600);
  await scrollTo(page, '[data-engrave="add-stamp"]', HEADER + 640);
  await shot(page, "builder-engraving", { stage: ".tc-stage" });
  await shot(page, "preview-engraving", {}, { element: ".tc-stage" });

  // size, then the cart
  await page.click('#builder [data-step="size"] button[aria-pressed]:first-child');
  await page.locator("#builder .tc-btn", { hasText: /add to cart/i }).last().click();
  await page.getByRole("button", { name: /^Open cart, 1 hat/ }).click();
  await page.getByRole("dialog").waitFor();
  await settle(page, 700);
  await shot(page, "cart", { checkout: 'button:has-text("Checkout")' });

  // the thank you page Stripe sends people back to
  await page.goto(`${BASE}/order-confirmed?session_id=cs_demo_video`);
  await page.waitForSelector("h1");
  await shot(page, "order-confirmed");

  // a booking request through the form
  await page.goto(BASE + "/");
  await page.waitForSelector("h1");
  await page.getByRole("button", { name: "Book the bar" }).first().click();
  await page.fill("#bk-name", "Avery Collins");
  await page.fill("#bk-email", "avery.collins@demo.tippin");
  await page.fill("#bk-phone", "915-555-0162");
  await page.selectOption("#bk-type", "Birthday");
  await page.fill("#bk-date", new Date(DEMO_NOW + 46 * 86400000).toISOString().slice(0, 10));
  await page.fill("#bk-notes", "Sweet sixteen, 25 guests, backyard.");
  await page.locator("#bk-notes").blur();
  await shot(page, "booking-form", { submit: 'button:has-text("Send booking request")' });
  await page.getByRole("button", { name: "Send booking request" }).click();
  await page.getByText("Got it, your request is in.").waitFor();
  await shot(page, "booking-sent");
  await ctx.close();
}

// ---- the staff portal ---------------------------------------------------------------------
async function portal(browser) {
  log("The staff portal");
  const data = demoData(DEMO_NOW);
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector("#admin-email");
    await page.fill("#admin-email", STAFF.email);
    await page.fill("#admin-password", "demo-password");
    await page.locator("#admin-password").blur();
    await shot(page, "signin", { form: ".ad-login form", submit: 'button[type="submit"]' });
    await ctx.close();
  }

  const { ctx, page } = await newPage(browser, { signedIn: true });
  await settle(page, 800);
  await shot(page, "dashboard-top", {
    toggle: '[data-testid="demo-toggle"]',
    kpis: ".ad-kpis",
    kpiOrders: '[data-kpi="new-orders"]',
    kpiRevenue: '[data-kpi="revenue"]',
    kpiBookings: '[data-kpi="new-bookings"]',
  });
  await scrollTo(page, '[data-chart="weekly"]');
  await shot(page, "dashboard-charts", { weekly: '[data-chart="weekly"]', months: '[data-chart="months"]' });
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector("[data-kpi]");
  await settle(page, 600);
  await page.getByTestId("account").click();
  await shot(page, "account", { menu: ".ad-menu", toggle: '[data-testid="demo-toggle"]' });
  await page.keyboard.press("Escape");

  // orders
  await page.goto(`${BASE}/admin/orders`);
  await page.waitForSelector("[data-order] [data-hat-preview] img");
  await settle(page, 1200);
  const first = data.orders[0];
  await shot(page, "orders", { chips: ".ad-chips", first: `[data-order="${first.id}"]` });

  // an order with its hat drawn
  await page.goto(`${BASE}/admin/orders/${first.id}`);
  await page.waitForSelector(".ad-hat img");
  await settle(page, 1200);
  await shot(page, "order-detail", { hat: ".ad-hat", title: "header .ad-h1" });

  // moving a Ready order to Shipped, with a tracking number
  const ready = data.orders.find((o) => o.status === "ready");
  await page.goto(`${BASE}/admin/orders/${ready.id}`);
  await page.waitForSelector('[data-admin="status"]');
  await page.selectOption('[data-admin="status"]', "shipped");
  await page.fill('[data-admin="tracking"]', "9400 1112 0206 5555 0123 45");
  await page.fill('[data-admin="note"]', "USPS Priority, both hats in one box.");
  await page.locator('[data-admin="note"]').blur();
  await scrollTo(page, "#status-title", HEADER + 26);
  await shot(page, "order-status", { card: 'section[aria-labelledby="status-title"]', tracking: '[data-admin="tracking"]', save: '[data-admin="save-status"]' });
  await page.click('[data-admin="save-status"]');
  await page.getByText("Marked shipped.").waitFor();
  await scrollTo(page, '[data-timeline]', HEADER + 70);
  await shot(page, "order-history", { timeline: "[data-timeline]" });
  manifest.data.shippedOrder = { name: ready.customer_name, tracking: "9400 1112 0206 5555 0123 45" };

  // bookings
  await page.goto(`${BASE}/admin/bookings`);
  await page.waitForSelector("a[data-booking]");
  await shot(page, "bookings-list", { chips: ".ad-chips", first: "a[data-booking]" });
  await page.click('[data-view="board"]');
  await page.waitForSelector("[data-board] [data-card]");
  await shot(page, "bookings-board", { column: '[data-column="new"]' });

  // the calendar, on the first day ahead with something on it
  await page.goto(`${BASE}/admin/calendar`);
  await page.waitForSelector("[data-day] [data-dot]", { state: "attached" });
  const today = new Date(DEMO_NOW).toLocaleDateString("en-CA", { timeZone: TZ });
  const days = await page
    .locator("[data-day]")
    .evaluateAll((els) => els.filter((e) => e.querySelector('[data-dot="new"], [data-dot="confirmed"]')).map((e) => e.dataset.day));
  const pick = days.find((d) => d >= today) || days[0];
  await page.click(`[data-day="${pick}"] .ad-day-n`);
  await shot(page, "calendar", { strip: ".ad-strip", grid: ".ad-cal", day: `[data-day="${pick}"]` });

  // a booking, with WhatsApp, email and the ready made replies
  const b = data.bookings.find((x) => x.status === "new" && x.phone && x.event_date);
  await page.goto(`${BASE}/admin/bookings/${b.id}`);
  await page.waitForSelector("[data-contact]");
  await shot(page, "booking-detail", {
    whatsapp: '[data-contact-btn="whatsapp"]',
    email: '[data-contact-btn="email"]',
    call: '[data-contact-btn="call"]',
    buttons: ".ad-contact-btns",
  });
  await page.click('[data-template="confirm"] .ad-tpl-more');
  await scrollTo(page, '[data-template="confirm"]', HEADER + 16);
  await shot(page, "booking-templates", {
    confirm: '[data-template="confirm"]',
    copy: '[data-template="confirm"] [data-copy]',
    whatsapp: '[data-template="confirm"] [data-template-btn="whatsapp"]',
  });
  manifest.data.booking = {
    name: b.name,
    eventType: b.event_type,
    confirmText: (await page.locator('[data-template="confirm"] [data-template-text]').textContent()).trim(),
    whatsappHref: await page.locator('[data-contact-btn="whatsapp"]').getAttribute("href"),
  };
  await ctx.close();

  // the numbers the dashboard scene counts up to, from the same demo data
  const k = kpis({ orders: data.orders, bookings: data.bookings, now: DEMO_NOW });
  manifest.data.kpis = k;
  manifest.data.weekly = weekly({ orders: data.orders, now: DEMO_NOW }).map((w) => ({ label: w.label, revenue: w.revenue, orders: w.orders }));
  manifest.data.months = bookingMonths({ bookings: data.bookings, now: DEMO_NOW }).map((m) => ({ key: m.key, label: m.label, value: m.value }));
  manifest.data.firstOrder = { name: first.customer_name, total: first.total, hats: first.hat_count };
  manifest.data.counts = { orders: data.orders.length, bookings: data.bookings.length };
}

// ---- run --------------------------------------------------------------------------------
async function run() {
  log(`Demo screenshots: building the app, then capturing at ${VIEW.width}x${VIEW.height} @${SCALE}x into video/public/shots (demo data only).`);
  build();
  const server = await serve();
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    await site(browser);
    await portal(browser);
  } finally {
    await browser.close();
    server.kill();
  }
  manifest.demoNow = new Date(DEMO_NOW).toISOString();
  writeFileSync(path.join(VIDEO, "src", "shots.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const n = readdirSync(SHOTS).length;
  log(`Done: ${n} screenshots in video/public/shots and their positions in video/src/shots.json.`);
}

run().catch((e) => {
  console.error(`Failed: ${e.message}`);
  process.exitCode = 1;
});
