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

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { kpis, bookingMonths, weekly } from "../../src/admin/stats.js";
import { STAFF, demoData } from "./fake-supabase.mjs";
import { BASE, DEMO_NOW, HEADER, SCALE, TZ, VIDEO, VIEW, build, holdHeroVideo, log, newPage as phonePage, scrollTo, serve, settle, shooter } from "./lib/browser.mjs";

const SHOTS = path.join(VIDEO, "public", "shots");
const manifest = { viewport: { ...VIEW, scale: SCALE }, shots: {}, data: {} };
const shot = shooter({ dir: SHOTS, urlPrefix: "shots/", manifest });

/** A phone page; signed in to the portal with "Include demo data" on when asked. */
async function newPage(browser, { signedIn = false } = {}) {
  const { ctx, page, sb } = await phonePage(browser);
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
  // the hero is a video: held on its first frame so re-runs match
  await holdHeroVideo(page);
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
